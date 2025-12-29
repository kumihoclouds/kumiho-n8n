import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class KumihoApi implements ICredentialType {
  name = 'kumihoApi';
  displayName = 'Kumiho API';
  documentationUrl = 'https://kumiho.io/resources/n8n';
  properties: INodeProperties[] = [
    {
      displayName: 'Base URL',
      name: 'baseUrl',
      type: 'string',
      default: 'https://api.kumiho.cloud'
    },
    {
      displayName: 'Service Token',
      name: 'serviceToken',
      type: 'string',
      typeOptions: {
        password: true
      },
      default: ''
    }
  ];
}
