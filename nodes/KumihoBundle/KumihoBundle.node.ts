import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { kumihoRequest } from '../helpers/kumihoApi';

export class KumihoBundle implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Kumiho Bundle',
    name: 'kumihoBundle',
    icon: 'file:Bundle.png',
    group: ['transform'],
    version: 1,
    description: 'Create or manage Kumiho bundles.',
    defaults: {
      name: 'Kumiho Bundle'
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
          { name: 'Create', value: 'create' },
          { name: 'Get', value: 'get' },
          { name: 'Add Member', value: 'addMember' },
          { name: 'Remove Member', value: 'removeMember' },
          { name: 'List Members', value: 'listMembers' },
          { name: 'History', value: 'history' }
        ],
        default: 'create'
      },
      {
        displayName: 'Space Path',
        name: 'spacePath',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['create']
          }
        }
      },
      {
        displayName: 'Bundle Name',
        name: 'bundleName',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['create']
          }
        }
      },
      {
        displayName: 'Bundle Kref',
        name: 'bundleKref',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['get', 'addMember', 'removeMember', 'listMembers', 'history']
          }
        }
      },
      {
        displayName: 'Item Kref',
        name: 'itemKref',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['addMember', 'removeMember']
          }
        }
      },
      {
        displayName: 'Metadata',
        name: 'metadata',
        type: 'json',
        default: '{}',
        displayOptions: {
          show: {
            operation: ['create', 'addMember', 'removeMember']
          }
        }
      },
      {
        displayName: 'Revision Number',
        name: 'revisionNumber',
        type: 'number',
        default: 0,
        displayOptions: {
          show: {
            operation: ['listMembers']
          }
        }
      }
    ]
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const operation = this.getNodeParameter('operation', 0) as string;
    const responses: INodeExecutionData[] = [];

    for (let index = 0; index < items.length; index += 1) {
      let data: IDataObject;

      if (operation === 'create') {
        data = await kumihoRequest(this, {
          method: 'POST',
          path: '/api/v1/bundles',
          body: {
            space_path: this.getNodeParameter('spacePath', index) as string,
            bundle_name: this.getNodeParameter('bundleName', index) as string,
            metadata: this.getNodeParameter('metadata', index, {}) as object
          }
        });
      } else if (operation === 'get') {
        data = await kumihoRequest(this, {
          method: 'GET',
          path: '/api/v1/bundles/by-kref',
          qs: {
            kref: this.getNodeParameter('bundleKref', index) as string
          }
        });
      } else if (operation === 'addMember') {
        data = await kumihoRequest(this, {
          method: 'POST',
          path: '/api/v1/bundles/members/add',
          body: {
            bundle_kref: this.getNodeParameter('bundleKref', index) as string,
            item_kref: this.getNodeParameter('itemKref', index) as string,
            metadata: this.getNodeParameter('metadata', index, {}) as object
          }
        });
      } else if (operation === 'removeMember') {
        data = await kumihoRequest(this, {
          method: 'POST',
          path: '/api/v1/bundles/members/remove',
          body: {
            bundle_kref: this.getNodeParameter('bundleKref', index) as string,
            item_kref: this.getNodeParameter('itemKref', index) as string,
            metadata: this.getNodeParameter('metadata', index, {}) as object
          }
        });
      } else if (operation === 'listMembers') {
        const revisionNumber = this.getNodeParameter('revisionNumber', index, 0) as number;
        data = await kumihoRequest(this, {
          method: 'GET',
          path: '/api/v1/bundles/members',
          qs: {
            bundle_kref: this.getNodeParameter('bundleKref', index) as string,
            revision_number: revisionNumber || undefined
          }
        });
      } else if (operation === 'history') {
        data = await kumihoRequest(this, {
          method: 'GET',
          path: '/api/v1/bundles/history',
          qs: {
            bundle_kref: this.getNodeParameter('bundleKref', index) as string
          }
        });
      } else {
        data = { error: `Unsupported operation: ${operation}` };
      }

      responses.push({ json: data });
    }

    return [responses];
  }
}




