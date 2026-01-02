import type { IDataObject, INodeType, INodeTypeDescription, ITriggerFunctions, ITriggerResponse } from 'n8n-workflow';
import { sleep } from 'n8n-workflow';
import { getKumihoCredentials, getKumihoRequestHeaders } from '../helpers/kumihoApi';

type TriggerType = 'project' | 'space' | 'item' | 'revision' | 'artifact' | 'edge';
type StreamAction = 'created' | 'updated' | 'deleted' | 'tagged';

const normalizeContextPathToKrefFilter = (contextPathRaw: string): string => {
  const raw = (contextPathRaw ?? '').trim();
  if (!raw) return '';

  // If the user already provided a glob/pattern, don't second-guess it.
  if (raw.includes('*') || raw.includes('?')) return raw;

  const withScheme = raw.startsWith('kref://') ? raw : `kref://${raw.replace(/^\/+/, '')}`;
  const trimmed = withScheme.replace(/\/+$/, '');

  // Common intent: limit to a project/space subtree.
  return `${trimmed}/**`;
};

const getContextPrefixFromKrefFilter = (krefFilter: string): string => {
  const filter = (krefFilter ?? '').trim();
  if (!filter) return '';
  // Strip common subtree glob.
  if (filter.endsWith('/**')) return filter.slice(0, -3);
  // If filter contains wildcards, we can't reliably create a prefix.
  if (filter.includes('*') || filter.includes('?')) return '';
  return filter;
};

const matchesContextPath = (event: unknown, contextPathRaw: string): boolean => {
  const krefFilter = normalizeContextPathToKrefFilter(contextPathRaw);
  if (!krefFilter) return true;

  if (!event || typeof event !== 'object') return false;
  const evt = event as { kref?: string };
  const kref = String(evt.kref ?? '');
  if (!kref) return false;

  const prefix = getContextPrefixFromKrefFilter(krefFilter);
  if (!prefix) return true; // Pattern-based filter; rely on server-side filtering.

  // Ensure subtree semantics even if the user entered a bare project/space.
  if (kref === prefix) return true;
  if (kref.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`)) return true;
  return false;
};

const getKrefQueryParam = (kref: string, key: string): string | undefined => {
  const idx = kref.indexOf('?');
  if (idx === -1) return undefined;
  const query = kref.slice(idx + 1);
  for (const part of query.split('&')) {
    const [k, v] = part.split('=');
    if (k === key) return v;
  }
  return undefined;
};

const getKrefLastSegment = (kref: string): string => {
  const withoutQuery = kref.split('?')[0];
  const parts = withoutQuery.split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : withoutQuery;
};

const matchesNameFilter = (event: unknown, triggerType: TriggerType, streamAction: StreamAction, filter: string): boolean => {
  const needle = filter.trim();
  if (!needle) return true;

  if (!event || typeof event !== 'object') return false;
  const evt = event as { kref?: string; routing_key?: string; details?: Record<string, unknown> };
  const kref = String(evt.kref ?? '');
  const routingKey = String(evt.routing_key ?? '');
  const details = (evt.details && typeof evt.details === 'object' ? evt.details : {}) as Record<string, unknown>;

  // Most robust (always present): routing_key substring match.
  if (routingKey && routingKey.includes(needle)) return true;

  // Next: kref substring match.
  if (kref && kref.includes(needle)) return true;

  // Type-specific interpretations
  if (triggerType === 'revision' && streamAction === 'tagged') {
    const tag = String(details.tag ?? details.tag_name ?? '');
    return tag === needle;
  }

  if (triggerType === 'revision') {
    const r = getKrefQueryParam(kref, 'r');
    if (r && r === needle) return true;
    const n = String(details.revision_number ?? details.number ?? '');
    if (n && n === needle) return true;
  }

  if (triggerType === 'artifact') {
    const a = getKrefQueryParam(kref, 'a');
    if (a && a === needle) return true;
    const name = String(details.artifact_name ?? details.name ?? '');
    if (name && name === needle) return true;
  }

  if (triggerType === 'item' || triggerType === 'project' || triggerType === 'space') {
    const last = getKrefLastSegment(kref);
    // Item krefs often look like: itemName.kind
    const baseName = last.includes('.') ? last.split('.')[0] : last;
    return baseName === needle;
  }

  return false;
};

export class KumihoEventStreamTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Kumiho Event Trigger',
    name: 'kumihoEventStreamTrigger',
    icon: 'file:../images/EventStream.svg',
    usableAsTool: true,
    group: ['trigger'],
    version: 1,
    description: 'Trigger workflows from Kumiho event streams.',
    defaults: {
      name: 'Kumiho Event Trigger'
    },
    inputs: [],
    outputs: ['main'],
    credentials: [
      {
        name: 'kumihoApi',
        required: true
      }
    ],
    properties: [
      {
        displayName: 'Trigger Type',
        name: 'triggerType',
        type: 'options',
        options: [
          { name: 'Artifact', value: 'artifact' },
          { name: 'Edge', value: 'edge' },
          { name: 'Item', value: 'item' },
          { name: 'Project', value: 'project' },
          { name: 'Revision', value: 'revision' },
          { name: 'Space', value: 'space' },
        ],
        default: 'revision',
      },
      {
        displayName: 'Path Filter (Project/Space)',
        name: 'contextPath',
        type: 'string',
        default: '',
        description: "Limit events to a project or space subtree (e.g. 'my-project', 'my-project/my-space', or 'kref://my-project/my-space/**')",
      },
      {
        displayName: 'Stream Action',
        name: 'streamAction',
        type: 'options',
        options: [
          { name: 'Created', value: 'created' },
          { name: 'Updated', value: 'updated' },
          { name: 'Deleted', value: 'deleted' },
        ],
        default: 'created',
        displayOptions: {
          show: {
            triggerType: ['project', 'space', 'item', 'artifact', 'edge'],
          },
        },
      },
      {
        displayName: 'Stream Action',
        name: 'streamActionRevision',
        type: 'options',
        options: [
          { name: 'Created', value: 'created' },
          { name: 'Updated', value: 'updated' },
          { name: 'Deleted', value: 'deleted' },
          { name: 'Tagged', value: 'tagged' },
        ],
        default: 'created',
        displayOptions: {
          show: {
            triggerType: ['revision'],
          },
        },
      },
      {
        displayName: 'Routing Key Name Filter',
        name: 'routingKeyNameFilter',
        type: 'string',
        default: '',
      },
      {
        displayName: 'Advanced',
        name: 'advanced',
        type: 'collection',
        default: {},
        options: [
          {
            displayName: 'Cursor',
            name: 'cursor',
            type: 'string',
            default: '',
          },
        ],
      },
      {
        displayName: 'Reconnect Delay (Seconds)',
        name: 'pollIntervalSeconds',
        type: 'number',
        default: 30,
      },
    ],
  };

  async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
    const pollIntervalSeconds = this.getNodeParameter('pollIntervalSeconds') as number;
    const staticData = this.getWorkflowStaticData('node');
    const advanced = this.getNodeParameter('advanced') as { cursor?: string };
    let cursor = (advanced?.cursor as string) || (staticData.cursor as string);
    let isStopped = false;

    let abortController: AbortController | undefined;

    const connectSse = async (url: string, headers: Record<string, string>, onMessage: (payload: string) => void) => {
      abortController = new AbortController();

      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'text/event-stream',
            ...headers,
          },
          signal: abortController.signal,
        });

        if (!res.ok || !res.body) return;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const flush = () => {
          buffer = buffer.replace(/\r\n/g, '\n');

          while (true) {
            const splitIndex = buffer.indexOf('\n\n');
            if (splitIndex === -1) break;

            const rawEvent = buffer.slice(0, splitIndex);
            buffer = buffer.slice(splitIndex + 2);

            const lines = rawEvent.split('\n');
            const dataLines = lines.filter((line) => line.startsWith('data:'));
            if (!dataLines.length) continue;

            const data = dataLines
              .map((line) => line.slice('data:'.length).replace(/^\s*/, ''))
              .join('\n');
            if (!data) continue;

            onMessage(data);
          }
        };

        while (!isStopped) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!value) continue;
          buffer += decoder.decode(value, { stream: true });
          flush();
        }
      } catch {
        // swallow connection errors; reconnect loop will handle retries
        return;
      }
    };

    const streamLoop = async () => {
      while (!isStopped) {
        const triggerType = this.getNodeParameter('triggerType') as TriggerType;
        const streamAction = (triggerType === 'revision'
          ? (this.getNodeParameter('streamActionRevision') as StreamAction)
          : (this.getNodeParameter('streamAction') as StreamAction));
        const routingKeyFilter = `${triggerType}.${streamAction}`;
        const routingKeyNameFilter = this.getNodeParameter('routingKeyNameFilter') as string;
        const contextPath = this.getNodeParameter('contextPath') as string;
        const krefFilter = normalizeContextPathToKrefFilter(contextPath);

        const creds = await getKumihoCredentials(this);
        const headers = await getKumihoRequestHeaders(this);

        const streamUrl = new URL(`${creds.baseUrl}/api/v1/events/stream`);
        streamUrl.searchParams.set('routing_key_filter', routingKeyFilter);
        if (krefFilter) streamUrl.searchParams.set('kref_filter', krefFilter);
        if (cursor) streamUrl.searchParams.set('cursor', cursor);

        await connectSse(streamUrl.toString(), headers, (payload: string) => {
          if (isStopped) return;

          let event: unknown;
          try {
            event = JSON.parse(payload);
          } catch {
            return;
          }

          if (!matchesContextPath(event, contextPath)) return;
          if (!matchesNameFilter(event, triggerType, streamAction, routingKeyNameFilter)) return;

          if (event && typeof event === 'object' && 'cursor' in event) {
            const eventCursor = (event as { cursor?: string }).cursor;
            if (eventCursor) {
              cursor = eventCursor;
              staticData.cursor = eventCursor;
            }
          }

          this.emit([[{ json: event as IDataObject }]]);
        });

        // Reconnect delay (re-uses the existing Poll Interval field).
        await sleep(Math.max(1, pollIntervalSeconds) * 1000);
      }
    };

    void streamLoop();

    return {
      closeFunction: async () => {
        isStopped = true;
        try {
          abortController?.abort();
        } catch {
          // ignore
        }
      }
    };
  }
}




