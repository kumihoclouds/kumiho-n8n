import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { kumihoRequest } from '../helpers/kumihoApi';

export class KumihoRevision implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Kumiho Revision',
    name: 'kumihoRevision',
    icon: 'file:Revision.png',
    group: ['transform'],
    version: 1,
    description: 'Create, read, update, deprecate, or delete Kumiho revisions.',
    defaults: {
      name: 'Kumiho Revision'
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
          { name: 'Update Metadata', value: 'updateMetadata' },
          { name: 'Tag', value: 'tag' },
          { name: 'Untag', value: 'untag' },
          { name: 'Deprecate', value: 'deprecate' },
          { name: 'Delete', value: 'delete' }
        ],
        default: 'create'
      },
      {
        displayName: 'Item Kref',
        name: 'itemKref',
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
            operation: ['create', 'updateMetadata']
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
            operation: ['read', 'updateMetadata', 'tag', 'untag', 'deprecate', 'delete']
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
        displayName: 'Revision Number',
        name: 'revisionNumber',
        type: 'number',
        default: 0,
        displayOptions: {
          show: {
            operation: ['create', 'read', 'updateMetadata', 'tag', 'untag', 'deprecate', 'delete']
          }
        }
      },
      {
        displayName: 'Tag',
        name: 'tag',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['read', 'tag', 'untag']
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
      const revisionNumber = this.getNodeParameter('revisionNumber', index, 0) as number;

      if (operation === 'create') {
        data = await kumihoRequest(this, {
          method: 'POST',
          path: '/api/v1/revisions',
          body: {
            item_kref: this.getNodeParameter('itemKref', index) as string,
            metadata: this.getNodeParameter('metadata', index, {}) as object,
            number: revisionNumber || undefined
          }
        });
      } else if (operation === 'read') {
        data = await kumihoRequest(this, {
          method: 'GET',
          path: '/api/v1/revisions/by-kref',
          qs: {
            kref: this.getNodeParameter('kref', index) as string,
            r: revisionNumber || undefined,
            t: this.getNodeParameter('tag', index, '') as string || undefined
          }
        });
      } else if (operation === 'updateMetadata') {
        data = await kumihoRequest(this, {
          method: 'PATCH',
          path: '/api/v1/revisions/by-kref',
          qs: {
            kref: this.getNodeParameter('kref', index) as string,
            r: revisionNumber || undefined
          },
          body: {
            metadata: this.getNodeParameter('metadata', index, {}) as object
          }
        });
      } else if (operation === 'tag') {
        data = await kumihoRequest(this, {
          method: 'POST',
          path: '/api/v1/revisions/tags',
          qs: {
            kref: this.getNodeParameter('kref', index) as string,
            r: revisionNumber || undefined
          },
          body: {
            tag: this.getNodeParameter('tag', index) as string
          }
        });
      } else if (operation === 'untag') {
        data = await kumihoRequest(this, {
          method: 'DELETE',
          path: '/api/v1/revisions/tags',
          qs: {
            kref: this.getNodeParameter('kref', index) as string,
            r: revisionNumber || undefined,
            tag: this.getNodeParameter('tag', index) as string
          }
        });
      } else if (operation === 'deprecate') {
        data = await kumihoRequest(this, {
          method: 'POST',
          path: '/api/v1/revisions/deprecate',
          qs: {
            kref: this.getNodeParameter('kref', index) as string,
            r: revisionNumber || undefined,
            deprecated: this.getNodeParameter('deprecated', index, true) as boolean
          }
        });
      } else if (operation === 'delete') {
        await kumihoRequest(this, {
          method: 'DELETE',
          path: '/api/v1/revisions/by-kref',
          qs: {
            kref: this.getNodeParameter('kref', index) as string,
            r: revisionNumber || undefined
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




