import type {
  IDataObject,
  IExecuteFunctions,
  ILoadOptionsFunctions,
  INodeExecutionData,
  INodePropertyOptions,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { ApplicationError } from 'n8n-workflow';

type KumihoApiCredentials = {
  baseUrl?: string;
  serviceToken?: string;
  tenantId?: string;
  userToken?: string;
};

const DEFAULT_KUMIHO_MCP_ENDPOINT = 'https://api.kumiho.cloud/api/v1/mcp/tools';

type NodeContext = IExecuteFunctions | ILoadOptionsFunctions;

type McpTool = {
  name?: unknown;
  description?: unknown;
};

const asToolName = (tool: McpTool): string | undefined => {
  const value = tool?.name;
  if (typeof value === 'string' && value.trim()) return value.trim();
  return undefined;
};

const asToolDescription = (tool: McpTool): string | undefined => {
  const value = tool?.description;
  if (typeof value === 'string' && value.trim()) return value.trim();
  return undefined;
};

const getKumihoCreds = async (ctx: NodeContext): Promise<KumihoApiCredentials> => {
  return (await ctx.getCredentials('kumihoApi')) as unknown as KumihoApiCredentials;
};

const buildDefaultEndpointFromCreds = (creds: KumihoApiCredentials): string => {
  const baseUrl = String(creds?.baseUrl ?? '').trim();
  if (!baseUrl) return DEFAULT_KUMIHO_MCP_ENDPOINT;
  return `${baseUrl.replace(/\/+$/, '')}/api/v1/mcp/tools`;
};

const buildAuthHeadersFromCreds = (creds: KumihoApiCredentials): Record<string, string> => {
  const serviceToken = String(creds?.serviceToken ?? '').trim();
  if (!serviceToken) throw new ApplicationError('Missing Service Token (kumihoApi)');

  const userToken = String(creds?.userToken ?? '').trim();
  const tenantId = String(creds?.tenantId ?? '').trim();

  const headers: Record<string, string> = {
    'X-Kumiho-Token': serviceToken,
    Authorization: `Bearer ${userToken || serviceToken}`,
  };

  if (tenantId) headers['x-tenant-id'] = tenantId;
  return headers;
};

const normalizeEndpoint = (endpointRaw: unknown): { toolsUrl: string; listUrl: string; invokeUrl: string } => {
  const endpoint = String(endpointRaw ?? '').trim();
  const toolsUrl = endpoint.replace(/\/+$/, '');
  // Our FastAPI exposes StreamableHTTP under /tools and legacy REST under /list.
  const listUrl = toolsUrl.endsWith('/tools') ? `${toolsUrl.slice(0, -'/tools'.length)}/list` : `${toolsUrl}/list`;
  const invokeUrl = toolsUrl.endsWith('/tools') ? `${toolsUrl.slice(0, -'/tools'.length)}/invoke` : `${toolsUrl}/invoke`;
  return { toolsUrl, listUrl, invokeUrl };
};

const getEndpoint = async (ctx: NodeContext, itemIndex = 0): Promise<string> => {
  // Endpoint is preconfigured; only override if the user explicitly enables it.
  const options = (ctx.getNodeParameter?.('options', itemIndex, {}) as IDataObject) ?? {};
  const overrideEnabled = Boolean(options.endpointOverrideEnabled);
  const override = String(options.endpointOverride ?? '').trim();
  if (overrideEnabled && override) return override;

  // Default: derive from the Kumiho API credential baseUrl.
  try {
    const creds = await getKumihoCreds(ctx);
    return buildDefaultEndpointFromCreds(creds);
  } catch {
    return DEFAULT_KUMIHO_MCP_ENDPOINT;
  }
};

const listTools = async (ctx: NodeContext): Promise<unknown[]> => {
  const endpointRaw = await getEndpoint(ctx, 0);
  const { listUrl } = normalizeEndpoint(endpointRaw);
  const creds = await getKumihoCreds(ctx);
  const headers = buildAuthHeadersFromCreds(creds);

  const data = (await ctx.helpers.request({
    method: 'GET',
    uri: listUrl,
    json: true,
    headers,
  })) as unknown;

  return Array.isArray(data) ? data : [];
};

const invokeTool = async (
  ctx: IExecuteFunctions,
  options: {
    toolName: string;
    arguments: Record<string, unknown>;
    itemIndex: number;
  },
): Promise<IDataObject> => {
  const endpointRaw = await getEndpoint(ctx, options.itemIndex);
  const { invokeUrl } = normalizeEndpoint(endpointRaw);
  const creds = await getKumihoCreds(ctx);
  const headers = buildAuthHeadersFromCreds(creds);

  const data = (await ctx.helpers.request({
    method: 'POST',
    uri: invokeUrl,
    json: true,
    headers,
    body: {
      name: options.toolName,
      arguments: options.arguments,
    },
  })) as unknown;

  return (data && typeof data === 'object' ? (data as IDataObject) : ({ result: data } as IDataObject)) as IDataObject;
};

const parseJsonArguments = (value: unknown): Record<string, unknown> => {
  if (value === undefined || value === null) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  const raw = String(value).trim();
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApplicationError('Tool Arguments must be valid JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new ApplicationError('Tool Arguments must be a JSON object');
  }
  return parsed as Record<string, unknown>;
};

export class KumihoMcpClient implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Kumiho MCP Client',
    name: 'kumihoMcpClient',
    icon: 'file:../images/MCP.svg',
    usableAsTool: true,
    group: ['transform'],
    version: 1,
    description: 'Connect to the Kumiho MCP endpoint and expose tools to n8n.',
    defaults: {
      name: 'Kumiho MCP Client',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'kumihoApi',
        required: true,
      },
    ],
    properties: [
      {
        displayName: 'Server Transport',
        name: 'serverTransport',
        type: 'options',
        options: [{ name: 'HTTP Streamable', value: 'httpStreamable' }],
        default: 'httpStreamable',
        noDataExpression: true,
      },
      {
        displayName: 'Tool Name or ID',
        name: 'toolName',
        type: 'options',
        typeOptions: {
          loadOptionsMethod: 'getToolOptions',
        },
        default: '',
        required: true,
        description:
          'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
      },
      {
        displayName: 'Tool Arguments (JSON)',
        name: 'toolArguments',
        type: 'string',
        default: '{}',
        description: 'JSON object passed as the tool arguments',
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        default: {},
        options: [
          {
            displayName: 'Advanced: Override Endpoint',
            name: 'endpointOverrideEnabled',
            type: 'boolean',
            default: false,
          },
          {
            displayName: 'Endpoint',
            name: 'endpointOverride',
            type: 'string',
            default: DEFAULT_KUMIHO_MCP_ENDPOINT,
            description: 'Override the MCP StreamableHTTP endpoint (defaults to Kumiho Cloud)',
            displayOptions: {
              show: {
                endpointOverrideEnabled: [true],
              },
            },
          },
        ],
      },
    ],
  };

  methods = {
    loadOptions: {
      async getToolOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
        let data: unknown[];
        try {
          data = await listTools(this);
        } catch {
          // Missing credentials or endpoint unreachable; don't hard-fail the UI.
          return [];
        }

        return data
          .map((tool: unknown): INodePropertyOptions | undefined => {
            if (!tool || typeof tool !== 'object') return undefined;
            const record = tool as McpTool;
            const name = asToolName(record);
            if (!name) return undefined;

            const description = asToolDescription(record);
            return {
              name: description ? `${name} — ${description}` : name,
              value: name,
            };
          })
          .filter((entry): entry is INodePropertyOptions => !!entry);
      },
    },
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const responses: INodeExecutionData[] = [];

    for (let index = 0; index < items.length; index += 1) {
      const toolName = String(this.getNodeParameter('toolName', index, '')).trim();
      if (!toolName) throw new ApplicationError('Tool Name is required');

      const toolArgumentsRaw = this.getNodeParameter('toolArguments', index, '{}');
      const args = parseJsonArguments(toolArgumentsRaw);

      const result = await invokeTool(this, { toolName, arguments: args, itemIndex: index });
      responses.push({ json: result });
    }

    return [responses];
  }
}
