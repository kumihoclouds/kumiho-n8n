import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { kumihoRequest } from '../helpers/kumihoApi';

export class KumihoResolveKref implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Kumiho Resolve Kref',
    name: 'kumihoResolveKref',
    icon: 'file:ResolveKref.png',
    group: ['transform'],
    version: 1,
    description: 'Resolve Kref URIs to locations or metadata.',
    defaults: {
      name: 'Kumiho Resolve Kref'
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
        displayName: 'Kref',
        name: 'kref',
        type: 'string',
        default: ''
      },
      {
        displayName: 'Revision Number',
        name: 'revisionNumber',
        type: 'number',
        default: 0
      },
      {
        displayName: 'Tag',
        name: 'tag',
        type: 'string',
        default: ''
      },
      {
        displayName: 'Artifact',
        name: 'artifact',
        type: 'string',
        default: ''
      }
    ]
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const responses: INodeExecutionData[] = [];

    for (let index = 0; index < items.length; index += 1) {
      const revisionNumber = this.getNodeParameter('revisionNumber', index, 0) as number;
      const data = (await kumihoRequest(this, {
        method: 'GET',
        path: '/api/v1/resolve',
        qs: {
          kref: this.getNodeParameter('kref', index) as string,
          r: revisionNumber || undefined,
          t: this.getNodeParameter('tag', index, '') as string || undefined,
          a: this.getNodeParameter('artifact', index, '') as string || undefined
        }
      })) as IDataObject;

      responses.push({ json: data });
    }

    return [responses];
  }
}




