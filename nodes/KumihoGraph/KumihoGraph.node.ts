import type { IDataObject, IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { kumihoRequest } from '../helpers/kumihoApi';

export class KumihoGraph implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Kumiho Graph',
    name: 'kumihoGraph',
    icon: 'file:Graph.png',
    group: ['transform'],
    version: 1,
    description: 'Manage relationships and analyze dependencies between revisions.',
    defaults: {
      name: 'Kumiho Graph'
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
          { name: 'Create Edge', value: 'createEdge' },
          { name: 'Get Dependencies', value: 'getDependencies' },
          { name: 'Find Path', value: 'findPath' },
          { name: 'Analyze Impact', value: 'analyzeImpact' }
        ],
        default: 'createEdge'
      },
      {
        displayName: 'Source Revision KRef',
        name: 'sourceKref',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            operation: ['createEdge', 'findPath']
          }
        }
      },
      {
        displayName: 'Target Revision KRef',
        name: 'targetKref',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            operation: ['createEdge', 'findPath']
          }
        }
      },
      {
        displayName: 'Revision KRef',
        name: 'revisionKref',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            operation: ['getDependencies', 'analyzeImpact']
          }
        }
      },
      {
        displayName: 'Edge Type',
        name: 'edgeType',
        type: 'options',
        options: [
          { name: 'Depends On', value: 'DEPENDS_ON' },
          { name: 'Derived From', value: 'DERIVED_FROM' },
          { name: 'Referenced', value: 'REFERENCED' },
          { name: 'Contains', value: 'CONTAINS' },
          { name: 'Created From', value: 'CREATED_FROM' },
          { name: 'Belongs To', value: 'BELONGS_TO' }
        ],
        default: 'DEPENDS_ON',
        displayOptions: {
          show: {
            operation: ['createEdge']
          }
        }
      },
      {
        displayName: 'Max Depth',
        name: 'maxDepth',
        type: 'number',
        default: 5,
        displayOptions: {
          show: {
            operation: ['getDependencies', 'findPath', 'analyzeImpact']
          }
        }
      },
      {
        displayName: 'Filter Edge Types',
        name: 'filterEdgeTypes',
        type: 'string',
        default: '',
        description: 'Comma-separated list of edge types to include (e.g., DEPENDS_ON,DERIVED_FROM)',
        displayOptions: {
          show: {
            operation: ['getDependencies', 'findPath', 'analyzeImpact']
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

      if (operation === 'createEdge') {
        const sourceKref = this.getNodeParameter('sourceKref', index) as string;
        const targetKref = this.getNodeParameter('targetKref', index) as string;
        const edgeType = this.getNodeParameter('edgeType', index) as string;
        
        responseData = await kumihoRequest(this, {
          method: 'POST',
          path: '/api/v1/graph/edges',
          body: {
            source_kref: sourceKref,
            target_kref: targetKref,
            edge_type: edgeType
          }
        });
      } else if (operation === 'getDependencies') {
        const revisionKref = this.getNodeParameter('revisionKref', index) as string;
        const maxDepth = this.getNodeParameter('maxDepth', index, 5) as number;
        const filterTypes = this.getNodeParameter('filterEdgeTypes', index, '') as string;
        
        responseData = await kumihoRequest(this, {
          method: 'GET',
          path: '/api/v1/graph/dependencies',
          qs: {
            revision_kref: revisionKref,
            max_depth: maxDepth,
            edge_types: filterTypes ? filterTypes.split(',') : undefined
          }
        });
      } else if (operation === 'findPath') {
        const sourceKref = this.getNodeParameter('sourceKref', index) as string;
        const targetKref = this.getNodeParameter('targetKref', index) as string;
        const maxDepth = this.getNodeParameter('maxDepth', index, 10) as number;
        const filterTypes = this.getNodeParameter('filterEdgeTypes', index, '') as string;

        responseData = await kumihoRequest(this, {
          method: 'GET',
          path: '/api/v1/graph/path',
          qs: {
            source_kref: sourceKref,
            target_kref: targetKref,
            max_depth: maxDepth,
            edge_types: filterTypes ? filterTypes.split(',') : undefined
          }
        });
      } else if (operation === 'analyzeImpact') {
        const revisionKref = this.getNodeParameter('revisionKref', index) as string;
        const maxDepth = this.getNodeParameter('maxDepth', index, 10) as number;
        const filterTypes = this.getNodeParameter('filterEdgeTypes', index, '') as string;

        responseData = await kumihoRequest(this, {
          method: 'GET',
          path: '/api/v1/graph/impact',
          qs: {
            revision_kref: revisionKref,
            max_depth: maxDepth,
            edge_types: filterTypes ? filterTypes.split(',') : undefined
          }
        });
      }

      responses.push({ json: responseData as IDataObject });
    }

    return [responses];
  }
}
