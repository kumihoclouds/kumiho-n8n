import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { kumihoRequest } from '../helpers/kumihoApi';

export class KumihoItem implements INodeType {
  constructor() {}
  description: INodeTypeDescription = {
    displayName: 'Kumiho Item',
    name: 'kumihoItem',
    icon: 'file:Item.png',
    group: ['transform'],
    version: 1,
    description: 'Create, read, update, deprecate, or delete Kumiho items.',
    defaults: {
      name: 'Kumiho Item'
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
          { name: 'Read (Kref)', value: 'read' },
          { name: 'Search', value: 'search' },
          { name: 'Set Attribute', value: 'setAttribute' },
          { name: 'Update Metadata', value: 'updateMetadata' },
          { name: 'Deprecate', value: 'deprecate' },
          { name: 'Delete', value: 'delete' }
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
        displayName: 'Item Name',
        name: 'itemName',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['create']
          }
        }
      },
      {
        displayName: 'Kind',
        name: 'kind',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['create']
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
            operation: ['updateMetadata']
          }
        }
      },
      {
        displayName: 'Kref',
        name: 'kref',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['read', 'setAttribute', 'updateMetadata', 'deprecate', 'delete']
          }
        }
      },
      {
        displayName: 'Deprecated',
        name: 'deprecated',
        type: 'boolean',
        default: true,
        displayOptions: {
          show: {
            operation: ['deprecate']
          }
        }
      },
      {
        displayName: 'Attribute Key',
        name: 'attributeKey',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['setAttribute']
          }
        }
      },
      {
        displayName: 'Attribute Value',
        name: 'attributeValue',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['setAttribute']
          }
        }
      },
      {
        displayName: 'Context Filter',
        name: 'contextFilter',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['search']
          }
        }
      },
      {
        displayName: 'Name Filter',
        name: 'nameFilter',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['search']
          }
        }
      },
      {
        displayName: 'Kind Filter',
        name: 'kindFilter',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['search']
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
          path: '/api/v1/items',
          body: {
            space_path: this.getNodeParameter('spacePath', index) as string,
            item_name: this.getNodeParameter('itemName', index) as string,
            kind: this.getNodeParameter('kind', index) as string
          }
        });
      } else if (operation === 'read') {
        data = await kumihoRequest(this, {
          method: 'GET',
          path: '/api/v1/items/by-kref',
          qs: {
            kref: this.getNodeParameter('kref', index) as string
          }
        });
      } else if (operation === 'search') {
        data = await kumihoRequest(this, {
          method: 'GET',
          path: '/api/v1/items/search',
          qs: {
            context_filter: this.getNodeParameter('contextFilter', index, '') as string,
            name_filter: this.getNodeParameter('nameFilter', index, '') as string,
            kind_filter: this.getNodeParameter('kindFilter', index, '') as string
          }
        });
      } else if (operation === 'setAttribute') {
        data = await kumihoRequest(this, {
          method: 'POST',
          path: '/api/v1/attributes',
          body: {
            kref: this.getNodeParameter('kref', index) as string,
            key: this.getNodeParameter('attributeKey', index) as string,
            value: this.getNodeParameter('attributeValue', index) as string
          }
        });
      } else if (operation === 'updateMetadata') {
        data = await kumihoRequest(this, {
          method: 'PATCH',
          path: '/api/v1/items/by-kref',
          qs: {
            kref: this.getNodeParameter('kref', index) as string
          },
          body: {
            metadata: this.getNodeParameter('metadata', index) as object
          }
        });
      } else if (operation === 'deprecate') {
        data = await kumihoRequest(this, {
          method: 'POST',
          path: '/api/v1/items/deprecate',
          qs: {
            kref: this.getNodeParameter('kref', index) as string,
            deprecated: this.getNodeParameter('deprecated', index, true) as boolean
          }
        });
      } else if (operation === 'delete') {
        await kumihoRequest(this, {
          method: 'DELETE',
          path: '/api/v1/items/by-kref',
          qs: {
            kref: this.getNodeParameter('kref', index) as string
          }
        });
        data = { deleted: true };
      } else {
        data = { error: `Unsupported operation: ${operation}` };
      }

      responses.push({ json: data });
    }

    return [responses];
  }
}




