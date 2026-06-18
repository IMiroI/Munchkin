import express from 'express';
import cors from 'cors';
import { createHmac, randomUUID } from 'crypto';

export const app = express();

app.use(cors({ origin: 'http://localhost:4200' }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-secret-change-in-prod';

function makeJwt(sub: string, name: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ sub, name, iat: Math.floor(Date.now() / 1000) })).toString('base64url');
  const sig = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

app.post('/auth/guest', (req, res) => {
  const raw = (req.body as { name?: string }).name ?? '';
  const name = raw.trim().slice(0, 24) || 'Guest';
  const sub = randomUUID();
  res.json({ jwt: makeJwt(sub, name), playerId: sub, name });
});
