import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

export interface HouseItem {
  cell: string;
  id: string;
  lat: number;
  lng: number;
  note?: string;
  tokenHash: string;
  createdAt: number;
  /** Epoch seconds; DynamoDB TTL removes the item some time after this. */
  expiresAt: number;
}

export interface HouseStore {
  put(item: HouseItem): Promise<void>;
  /** Active (not expired) houses in one geohash cell. */
  listCell(cell: string, nowSeconds: number): Promise<HouseItem[]>;
  /** Deletes only if the token hash matches. Returns false when not found or not owned. */
  deleteOwned(cell: string, id: string, tokenHash: string): Promise<boolean>;
}

/** Table keys: PK = CELL#<geohash>, SK = HOUSE#<id>. */
const keys = (cell: string, id: string) => ({ PK: `CELL#${cell}`, SK: `HOUSE#${id}` });

export function createDynamoStore(tableName: string, endpoint?: string): HouseStore {
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient(endpoint ? { endpoint } : {}), {
    marshallOptions: { removeUndefinedValues: true },
  });

  return {
    async put(item) {
      await doc.send(new PutCommand({ TableName: tableName, Item: { ...keys(item.cell, item.id), ...item } }));
    },

    async listCell(cell, nowSeconds) {
      const items: HouseItem[] = [];
      let startKey: Record<string, unknown> | undefined;
      do {
        const res = await doc.send(new QueryCommand({
          TableName: tableName,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
          // TTL deletion is lazy, so filter out anything already past its expiry.
          FilterExpression: 'expiresAt > :now',
          ExpressionAttributeValues: { ':pk': `CELL#${cell}`, ':sk': 'HOUSE#', ':now': nowSeconds },
          ExclusiveStartKey: startKey,
        }));
        items.push(...((res.Items ?? []) as HouseItem[]));
        startKey = res.LastEvaluatedKey;
      } while (startKey);
      return items;
    },

    async deleteOwned(cell, id, tokenHash) {
      try {
        await doc.send(new DeleteCommand({
          TableName: tableName,
          Key: keys(cell, id),
          ConditionExpression: 'tokenHash = :tokenHash',
          ExpressionAttributeValues: { ':tokenHash': tokenHash },
        }));
        return true;
      } catch (err) {
        if ((err as Error).name === 'ConditionalCheckFailedException') return false;
        throw err;
      }
    },
  };
}

/** Zero-setup store for tests and `npm run dev` without DynamoDB Local. */
export function createMemoryStore(): HouseStore {
  const items = new Map<string, HouseItem>();
  const key = (cell: string, id: string) => `${cell}#${id}`;
  return {
    async put(item) {
      items.set(key(item.cell, item.id), item);
    },
    async listCell(cell, nowSeconds) {
      return [...items.values()].filter((i) => i.cell === cell && i.expiresAt > nowSeconds);
    },
    async deleteOwned(cell, id, tokenHash) {
      const item = items.get(key(cell, id));
      if (!item || item.tokenHash !== tokenHash) return false;
      items.delete(key(cell, id));
      return true;
    },
  };
}
