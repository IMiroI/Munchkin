import { PrismaClient } from '@prisma/client';

// Single shared instance — PrismaClient manages its own connection pool.
export const prisma = new PrismaClient({
  log: process.env['NODE_ENV'] === 'development' ? ['warn', 'error'] : ['error'],
});
