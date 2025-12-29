import type { IDataObject, INodeType, INodeTypeDescription, ITriggerFunctions, ITriggerResponse } from 'n8n-workflow';
import { kumihoRequest } from '../helpers/kumihoApi';

export class KumihoEventStreamTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Kumiho Event Stream',
    name: 'kumihoEventStreamTrigger',
    icon: 'file:EventStream.png',
    group: ['trigger'],
    version: 1,
    description: 'Trigger workflows from Kumiho event streams.',
    defaults: {
      name: 'Kumiho Event Stream'
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
        displayName: 'Stream Name',
        name: 'streamName',
        type: 'string',
        default: 'revisions',
      },
      {
        displayName: 'Cursor',
        name: 'cursor',
        type: 'string',
        default: '',
      },
      {
        displayName: 'Routing Key Filter',
        name: 'routingKeyFilter',
        type: 'string',
        default: 'revision.*',
      },
      {
        displayName: 'Kref Filter',
        name: 'krefFilter',
        type: 'string',
        default: '',
      },
      {
        displayName: 'Poll Interval (Seconds)',
        name: 'pollIntervalSeconds',
        type: 'number',
        default: 30,
      },
      {
        displayName: 'Max Events',
        name: 'maxEvents',
        type: 'number',
        default: 10,
      },
    ],
  };

  async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
    const pollIntervalSeconds = this.getNodeParameter('pollIntervalSeconds') as number;
    const maxEvents = this.getNodeParameter('maxEvents') as number;
    const staticData = this.getWorkflowStaticData('node');
    let cursor = (this.getNodeParameter('cursor') as string) || (staticData.cursor as string);
    let isStopped = false;

    const poll = async () => {
      const events = await kumihoRequest(this, {
        method: 'GET',
        path: '/api/v1/events/poll',
        qs: {
          routing_key_filter: this.getNodeParameter('routingKeyFilter') as string,
          kref_filter: this.getNodeParameter('krefFilter') as string,
          cursor: cursor || undefined,
          max_events: maxEvents
        }
      });

      if (Array.isArray(events) && events.length > 0) {
        const output = events.map((event) => {
          if (event && typeof event === 'object' && 'cursor' in event) {
            const eventCursor = (event as { cursor?: string }).cursor;
            if (eventCursor) {
              cursor = eventCursor;
              staticData.cursor = eventCursor;
            }
          }
          return { json: event as IDataObject };
        });

        this.emit([output]);
      }
    };

    const interval = setInterval(() => {
      if (!isStopped) {
        void poll();
      }
    }, Math.max(1, pollIntervalSeconds) * 1000);

    // Run first poll in background to avoid blocking trigger activation
    setTimeout(() => {
      void poll();
    }, 100);

    return {
      closeFunction: async () => {
        isStopped = true;
        clearInterval(interval);
      }
    };
  }
}




