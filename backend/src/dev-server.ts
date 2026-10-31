/**
 * Local API server. Uses an in-memory store unless TABLE_NAME is set, in which
 * case it talks to DynamoDB (set DYNAMODB_ENDPOINT for DynamoDB Local).
 */
import { createServer } from 'node:http';

import { handleRequest } from './app.ts';
import { createDynamoStore, createMemoryStore } from './store.ts';

const port = Number(process.env.PORT ?? 3001);
const store = process.env.TABLE_NAME
  ? createDynamoStore(process.env.TABLE_NAME, process.env.DYNAMODB_ENDPOINT)
  : createMemoryStore();

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type,x-house-token',
};

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors).end();
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);

  try {
    const result = await handleRequest(
      {
        method: req.method ?? 'GET',
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])),
        body: Buffer.concat(chunks).toString('utf8'),
      },
      store,
    );
    if (result.body === undefined) {
      res.writeHead(result.status, cors).end();
    } else {
      res.writeHead(result.status, { ...cors, 'content-type': 'application/json' }).end(JSON.stringify(result.body));
    }
  } catch (err) {
    console.error(err);
    res.writeHead(500, cors).end();
  }
}).listen(port, () => {
  console.log(`Knock Knock API on http://localhost:${port} (${process.env.TABLE_NAME ? 'DynamoDB' : 'in-memory'} store)`);
});
