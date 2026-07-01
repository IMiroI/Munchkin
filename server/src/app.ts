import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createHmac, randomUUID } from 'crypto';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { JWT_SECRET } from './config.js';

export const app = express();

const CORS_ORIGINS = (process.env['CORS_ORIGINS'] || 'http://localhost:4200,http://localhost:3002').split(',');

app.use(helmet());
app.use(cors({ origin: CORS_ORIGINS, credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  cookieHeader.split(';').forEach(c => {
    const [k, ...v] = c.trim().split('=');
    if (k) cookies[k.trim()] = decodeURIComponent(v.join('='));
  });
  return cookies;
}

function makeJwt(sub: string, name: string, gender: 'male' | 'female'): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ sub, name, gender, iat: now, exp: now + 7 * 24 * 60 * 60 })).toString('base64url');
  const sig = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

app.post('/auth/guest', authLimiter, (req, res) => {
  const body = req.body as { name?: string; gender?: string };
  const name = (body.name ?? '').trim().slice(0, 24) || 'Guest';
  if (name !== 'Guest' && !/^[\p{L}\p{N}\s'\-]{1,24}$/u.test(name)) {
    return res.status(400).json({ error: 'Nom invalide' });
  }
  const gender: 'male' | 'female' = body.gender === 'female' ? 'female' : 'male';
  const sub = randomUUID();
  const token = makeJwt(sub, name, gender);
  res.cookie('jwt', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env['NODE_ENV'] === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return res.json({ playerId: sub, name, gender });
});

app.get('/auth/me', (req, res) => {
  const token = req.cookies?.['jwt'] as string | undefined;
  if (!token) return res.status(401).json({ error: 'Non authentifié' });

  const parts = token.split('.');
  if (parts.length !== 3) return res.status(401).json({ error: 'Token invalide' });

  const [header, body, providedSig] = parts as [string, string, string];
  const expectedSig = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  if (providedSig !== expectedSig) return res.status(401).json({ error: 'Token invalide' });

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8')) as {
      sub?: string; name?: string; gender?: string; exp?: number;
    };
    if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
      return res.status(401).json({ error: 'Session expirée' });
    }
    return res.json({ playerId: payload.sub, name: payload.name, gender: payload.gender });
  } catch {
    return res.status(401).json({ error: 'Token invalide' });
  }
});
