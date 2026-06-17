import { MongoClient } from 'mongodb';
import { config } from './config.js';

let clientPromise;

export function getClient() {
  if (!config.mongoUri) {
    throw new Error('Missing MONGODB_URI. Set it in .env or Vercel variables.');
  }

  if (!clientPromise) {
    const client = new MongoClient(config.mongoUri);
    clientPromise = client.connect();
  }

  return clientPromise;
}

export async function getQuestStatesCollection() {
  const client = await getClient();
  return client.db(config.dbName).collection('quest_states');
}
