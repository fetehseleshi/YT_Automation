import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

const connectionString = env('DATABASE_URL') || env('DIRECT_URL');

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: connectionString,
  },
});