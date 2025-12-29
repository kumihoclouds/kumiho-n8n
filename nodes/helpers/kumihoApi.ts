import type { IDataObject, IExecuteFunctions, ITriggerFunctions } from 'n8n-workflow';

export interface KumihoApiCredentials {
  baseUrl: string;
  serviceToken: string;
}

type RequestContext = IExecuteFunctions | ITriggerFunctions;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const getKumihoCredentials = async (context: RequestContext): Promise<KumihoApiCredentials> => {
  const credentials = (await context.getCredentials('kumihoApi')) as KumihoApiCredentials;
  if (!credentials || !credentials.serviceToken) {
    throw new Error('Missing Kumiho service token');
  }

  return {
    baseUrl: trimTrailingSlash(credentials.baseUrl || 'https://api.kumiho.cloud'),
    serviceToken: credentials.serviceToken
  };
};

export const kumihoRequest = async (
  context: RequestContext,
  options: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    path: string;
    qs?: Record<string, string | number | boolean | string[] | undefined>;
    body?: unknown;
  }
): Promise<IDataObject> => {
  const { baseUrl, serviceToken } = await getKumihoCredentials(context);

  const response = await context.helpers.request({
    method: options.method,
    uri: `${baseUrl}${options.path}`,
    headers: {
      'X-Kumiho-Token': serviceToken
    },
    qs: options.qs,
    body: options.body,
    json: true
  });

  if (response && typeof response === 'object') {
    return response as IDataObject;
  }

  return { value: response } as IDataObject;
};
