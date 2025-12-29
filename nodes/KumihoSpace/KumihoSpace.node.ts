import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { kumihoRequest } from '../helpers/kumihoApi';

export class KumihoSpace implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Kumiho Space',
    name: 'kumihoSpace',
    icon: 'file:Space.png',
    group: ['transform'],
    version: 1,
    description: 'Create, read, list, or delete Kumiho spaces.',
    defaults: {
      name: 'Kumiho Space'
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
        required: true,
        description: 'The project containing the space'
      },
      {
        displayName: 'Space Name',
        name: 'spaceName',
        type: 'string',
        default: '',
        displayOptions: {
          show: {
            operation: ['create', 'delete']
          }
        }
      },
      {
        displayName: 'Space Path',
        name: 'spacePath',
        type: 'string',
        default: '',
        description: 'Full path to the space (e.g., /project/space)',
        displayOptions: {
          show: {
            operation: ['get']
          }
        }
      },
      {
        displayName: 'Parent Path',
        name: 'parentPath',
        type: 'string',
        default: '',
        description: 'Optional parent path for nested spaces',
        displayOptions: {
          show: {
            operation: ['create']
          }
        }
      },
      {
        displayName: 'Recursive',
        name: 'recursive',
        type: 'boolean',
        default: false,
        description: 'Include nested spaces in list',
        displayOptions: {
          show: {
            operation: ['list']
          }
        }
      },
      {
        displayName: 'Force Delete',
        name: 'force',
        type: 'boolean',
        default: false,
        description: 'Delete space even if it contains items',
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
      const projectName = this.getNodeParameter('projectName', index) as string;
      let responseData;

      if (operation === 'create') {
        const spaceName = this.getNodeParameter('spaceName', index) as string;
        const parentPath = this.getNodeParameter('parentPath', index, '') as string;
        responseData = await kumihoRequest(this, {
          method: 'POST',
          path: '/api/v1/spaces',
          body: { 
            project_name: projectName,
            space_name: spaceName,
            parent_path: parentPath || undefined
          }
        });
      } else if (operation === 'get') {
        const spacePath = this.getNodeParameter('spacePath', index) as string;
        responseData = await kumihoRequest(this, {
          method: 'GET',
          path: '/api/v1/spaces/path',
          qs: { space_path: spacePath }
        });
      } else if (operation === 'list') {
        const recursive = this.getNodeParameter('recursive', index, false) as boolean;
        responseData = await kumihoRequest(this, {
          method: 'GET',
          path: '/api/v1/spaces',
          qs: { 
            project_name: projectName,
            recursive
          }
        });
      } else if (operation === 'delete') {
        const spaceName = this.getNodeParameter('spaceName', index) as string;
        const force = this.getNodeParameter('force', index, false) as boolean;
        // Assuming delete endpoint structure based on project delete
        // Note: API might require full path or ID, adjusting to likely structure
        responseData = await kumihoRequest(this, {
          method: 'DELETE',
          path: `/api/v1/spaces/${projectName}/${spaceName}`,
          qs: { force }
        });
      }

      responses.push({ json: responseData as IDataObject });
    }

    return [responses];
  }
}
