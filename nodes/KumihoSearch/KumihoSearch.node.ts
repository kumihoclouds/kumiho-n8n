import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { kumihoRequest } from '../helpers/kumihoApi';

export class KumihoSearch implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Kumiho Search',
    name: 'kumihoSearch',
    icon: 'file:Search.png',
    group: ['transform'],
    version: 1,
    description: 'Search Kumiho items by context, name, or kind.',
    defaults: {
      name: 'Kumiho Search'
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
        displayName: 'Context Filter',
        name: 'contextFilter',
        type: 'string',
        default: ''
      },
      {
        displayName: 'Name Filter',
        name: 'nameFilter',
        type: 'string',
        default: ''
      },
      {
        displayName: 'Kind Filter',
        name: 'kindFilter',
        type: 'string',
        default: ''
      }
    ]
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const responses: INodeExecutionData[] = [];

    for (let index = 0; index < items.length; index += 1) {
      const data = (await kumihoRequest(this, {
        method: 'GET',
        path: '/api/v1/items/search',
        qs: {
          context_filter: this.getNodeParameter('contextFilter', index, '') as string,
          name_filter: this.getNodeParameter('nameFilter', index, '') as string,
          kind_filter: this.getNodeParameter('kindFilter', index, '') as string
        }
      })) as IDataObject;

      responses.push({ json: data });
    }

    return [responses];
  }
}




