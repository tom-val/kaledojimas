/**
 * Creates the KnockKnock table in DynamoDB Local (idempotent). Production tables come from Terraform.
 *   DYNAMODB_ENDPOINT=http://localhost:8000 TABLE_NAME=KnockKnock node scripts/create-table.ts
 */
import { CreateTableCommand, DynamoDBClient, ResourceInUseException } from '@aws-sdk/client-dynamodb';

const endpoint = process.env.DYNAMODB_ENDPOINT ?? 'http://localhost:8000';
const tableName = process.env.TABLE_NAME ?? 'KnockKnock';

const client = new DynamoDBClient({
  endpoint,
  region: process.env.AWS_REGION ?? 'eu-west-1',
  // DynamoDB Local accepts any credentials.
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

try {
  await client.send(new CreateTableCommand({
    TableName: tableName,
    BillingMode: 'PAY_PER_REQUEST',
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' },
    ],
  }));
  console.log(`Created table ${tableName} at ${endpoint}`);
} catch (err) {
  if (err instanceof ResourceInUseException) console.log(`Table ${tableName} already exists at ${endpoint}`);
  else throw err;
}
