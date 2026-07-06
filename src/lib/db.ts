import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

// Create the connection pool with explicit SSL handling
const pool = new pg.Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: {
    // Overrides standard CA validation for managed/self-signed database instances
    rejectUnauthorized: false
  }
});

const adapter = new PrismaPg(pool);

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter, // Injecting the configured adapter for Prisma 7
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}