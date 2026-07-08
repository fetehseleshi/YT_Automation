import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const runtimeConnectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (runtimeConnectionString) {
  process.env.DATABASE_URL = runtimeConnectionString;
}

const pool = new pg.Pool({
  connectionString: runtimeConnectionString,
  ssl:
    runtimeConnectionString?.includes("sslmode=require") || process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : undefined,
});

const adapter = new PrismaPg(pool);

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}