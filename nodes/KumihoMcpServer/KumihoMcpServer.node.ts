import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';

export class KumihoMcpServer implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Kumiho MCP Server',
    name: 'kumihoMcpServer',
    icon: 'fa:server',
    group: ['transform'],
    version: 1,
    description: 'Run Kumiho MCP server tools via the FastAPI BFF.',
    defaults: {
      name: 'Kumiho MCP Server'
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'kumihoApi',
        required: true
      }
    ],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        options: [
          { name: 'Start', value: 'start' },
          { name: 'Stop', value: 'stop' },
          { name: 'Status', value: 'status' }
        ],
        default: 'start'
      },
      {
        displayName: 'Port',
        name: 'port',
        type: 'number',
        default: 3030
      },
      {
        displayName: 'Entrypoint',
        name: 'entrypoint',
        type: 'string',
        default: 'kumiho.mcp'
      }
    ]
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const operation = this.getNodeParameter('operation', 0) as string;
    const response = items.map((item, index) => {
      const payload = {
        resource: 'mcp',
        operation,
        status: 'not_implemented',
        request: {
          port: this.getNodeParameter('port', index, 3030) as number,
          entrypoint: this.getNodeParameter('entrypoint', index, '') as string
        }
      };

      return {
        json: {
          ...item.json,
          kumiho: payload
        }
      };
    });

    return [response];
  }
}




