import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

const connectionString = env('DIRECT_URL') || env('DATABASE_URL');

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: connectionString,
  },
});