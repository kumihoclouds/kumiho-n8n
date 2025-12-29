import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { kumihoRequest } from '../helpers/kumihoApi';

export class KumihoProject implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Kumiho Project',
    name: 'kumihoProject',
    icon: 'file:Project.png',
    group: ['transform'],
    version: 1,
    description: 'Create, read, list, or delete Kumiho projects.',
    defaults: {
      name: 'Kumiho Project'
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
          { name: 'List', value: 'list' },
          { name: 'Delete', value: 'delete' }
        ],
        default: 'create'
      },
      {
        displayName: 'Project Name',
        name: 'projectName',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['create', 'get', 'delete']
          }
        }
      },
      {
        displayName: 'Description',
        name: 'description',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['create']
          }
        }
      },
      {
        displayName: 'Force Delete',
        name: 'force',
        type: 'boolean',
        default: false,
        description: 'Permanently delete the project and all its contents',
        displayOptions: {
          show: {
            operation: ['delete']
          }
        }
      }
    ]
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const responses: INodeExecutionData[] = [];

    for (let index = 0; index < items.length; index += 1) {
      const operation = this.getNodeParameter('operation', index) as string;
      let responseData;

      if (operation === 'create') {
        const name = this.getNodeParameter('projectName', index) as string;
        const description = this.getNodeParameter('description', index, '') as string;
        responseData = await kumihoRequest(this, {
          method: 'POST',
          path: '/api/v1/projects',
          body: { name, description }
        });
      } else if (operation === 'get') {
        const name = this.getNodeParameter('projectName', index) as string;
        responseData = await kumihoRequest(this, {
          method: 'GET',
          path: `/api/v1/projects/${name}`
        });
      } else if (operation === 'list') {
        responseData = await kumihoRequest(this, {
          method: 'GET',
          path: '/api/v1/projects'
        });
      } else if (operation === 'delete') {
        const name = this.getNodeParameter('projectName', index) as string;
        const force = this.getNodeParameter('force', index, false) as boolean;
        responseData = await kumihoRequest(this, {
          method: 'DELETE',
          path: `/api/v1/projects/${name}`,
          qs: { force }
        });
      }

      responses.push({ json: responseData as IDataObject });
    }

    return [responses];
  }
}
