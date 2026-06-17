import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(apiRoot, '..');

dotenv.config({ path: path.join(apiRoot, '.env') });
dotenv.config({ path: path.join(workspaceRoot, 'atlas-credentials.env') });

function readTextIfExists(fileName) {
  const filePath = path.join(workspaceRoot, fileName);
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8').trim();
}

function normalizeMongoUri(uri) {
  if (!uri) return '';
  const [base, query = ''] = uri.split('?');
  const hasDbName = /mongodb(\+srv)?:\/\/.+\/[^/?]+$/.test(base);
  const dbName = process.env.MONGODB_DB || 'quest_notes';
  const normalizedBase = hasDbName ? base : `${base.replace(/\/$/, '')}/${dbName}`;
  const params = new URLSearchParams(query);
  if (!params.has('retryWrites')) params.set('retryWrites', 'true');
  if (!params.has('w')) params.set('w', 'majority');
  return `${normalizedBase}?${params.toString()}`;
}

function buildMongoUri() {
  if (process.env.MONGODB_URI) return normalizeMongoUri(process.env.MONGODB_URI);

  const template = readTextIfExists('connect_database.txt');
  const credentials = readTextIfExists('username_password_database.txt')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const username = process.env.MONGODB_USERNAME || credentials[0];
  const password = process.env.MONGODB_PASSWORD || credentials[1];

  if (template && username && password) {
    return normalizeMongoUri(
      template.replace('<db_username>', encodeURIComponent(username)),
    );
  }

  return '';
}

export const config = {
  mongoUri: buildMongoUri(),
  dbName: process.env.MONGODB_DB || 'quest_notes',
  userId: process.env.QUEST_USER_ID || 'default',
  port: Number(process.env.PORT || 3000),
};
