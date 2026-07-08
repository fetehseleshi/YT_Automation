import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const runtimeConnectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (runtimeConnectionString) {
  process.env.DATABASE_URL = runtimeConnectionString;
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}