import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 4317),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '30d',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  seedAdminKey: process.env.SEED_ADMIN_KEY ?? '',
  databaseUrl: process.env.DATABASE_URL ?? '',
  isProd: process.env.NODE_ENV === 'production',
} as const;

if (!config.databaseUrl) {
  console.error(
    '\n[config] DATABASE_URL manquant. Définissez la connection string Postgres (Neon) dans .env (local) ou dans les variables d\'environnement (production).\n',
  );
  process.exit(1);
}

if (config.jwtSecret === 'dev-insecure-secret-change-me') {
  console.warn(
    '[config] JWT_SECRET non défini — utilisation d\'un secret de dev. À NE PAS utiliser en production.',
  );
}
