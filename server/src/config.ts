const secret = process.env['JWT_SECRET'];
if (!secret || secret.length < 32) {
  console.error('FATAL: JWT_SECRET must be set with at least 32 characters in environment variables');
  process.exit(1);
}

export const JWT_SECRET: string = secret;
