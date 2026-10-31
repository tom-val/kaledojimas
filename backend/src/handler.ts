import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';

import { handleRequest } from './app.ts';
import { createDynamoStore } from './store.ts';

const store = createDynamoStore(process.env.TABLE_NAME!);

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  // HTTP API lower-cases header names.
  const body = event.body && event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  try {
    const res = await handleRequest(
      {
        method: event.requestContext.http.method,
        path: event.rawPath,
        query: event.queryStringParameters ?? {},
        headers: event.headers ?? {},
        body,
      },
      store,
    );
    return {
      statusCode: res.status,
      headers: res.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: res.body === undefined ? undefined : JSON.stringify(res.body),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
}
