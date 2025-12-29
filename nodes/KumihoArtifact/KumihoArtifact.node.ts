import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { kumihoRequest } from '../helpers/kumihoApi';

export class KumihoArtifact implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Kumiho Artifact',
    name: 'kumihoArtifact',
    icon: 'file:Artifact.png',
    group: ['transform'],
    version: 1,
    description: 'Create, read, update, deprecate, or delete Kumiho artifacts.',
    defaults: {
      name: 'Kumiho Artifact'
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
          { name: 'Deprecate', value: 'deprecate' },
          { name: 'Delete', value: 'delete' }
        ],
        default: 'create'
      },
      {
        displayName: 'Revision Kref',
        name: 'revisionKref',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['create', 'read']
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
            operation: ['read', 'updateMetadata', 'deprecate', 'delete']
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
        displayName: 'Artifact Name',
        name: 'artifactName',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['create', 'read']
          }
        }
      },
      {
        displayName: 'Location',
        name: 'location',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['create']
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
          path: '/api/v1/artifacts',
          body: {
            revision_kref: this.getNodeParameter('revisionKref', index) as string,
            name: this.getNodeParameter('artifactName', index) as string,
            location: this.getNodeParameter('location', index) as string
          }
        });
      } else if (operation === 'read') {
        data = await kumihoRequest(this, {
          method: 'GET',
          path: '/api/v1/artifacts/by-kref',
          qs: {
            kref: this.getNodeParameter('kref', index) as string,
            revision_kref: this.getNodeParameter('revisionKref', index, '') as string || undefined,
            name: this.getNodeParameter('artifactName', index, '') as string || undefined
          }
        });
      } else if (operation === 'updateMetadata') {
        data = await kumihoRequest(this, {
          method: 'PATCH',
          path: '/api/v1/artifacts/by-kref',
          qs: {
            kref: this.getNodeParameter('kref', index) as string
          },
          body: {
            metadata: this.getNodeParameter('metadata', index, {}) as object
          }
        });
      } else if (operation === 'deprecate') {
        data = await kumihoRequest(this, {
          method: 'POST',
          path: '/api/v1/artifacts/deprecate',
          qs: {
            kref: this.getNodeParameter('kref', index) as string,
            deprecated: this.getNodeParameter('deprecated', index, true) as boolean
          }
        });
      } else if (operation === 'delete') {
        await kumihoRequest(this, {
          method: 'DELETE',
          path: '/api/v1/artifacts/by-kref',
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




