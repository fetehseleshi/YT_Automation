import { Prisma, type Channel } from "@prisma/client";
import { db } from "@/lib/db";

const columnExistsCache = new Map<string, boolean>();
const userIdCacheKey = "channel.userId";

export type ChannelRow = Channel;

async function queryWithUserIdFallback<T>(query: Prisma.Sql, fallback: () => Promise<T>): Promise<T> {
  try {
    return await db.$queryRaw<T>(query);
  } catch (error: any) {
    const message = String(error?.message || "").toLowerCase();
    const missingColumn =
      error?.code === "42703" ||
      message.includes("column \"userid\" does not exist") ||
      message.includes("column \"userId\" does not exist") ||
      message.includes("column \"user_id\" does not exist");
    if (missingColumn) {
      columnExistsCache.set(userIdCacheKey, false);
      return fallback();
    }
    throw error;
  }
}

export async function channelHasUserIdColumn(): Promise<boolean> {
  if (columnExistsCache.has(userIdCacheKey)) {
    return columnExistsCache.get(userIdCacheKey)!;
  }

  try {
    const result = await db.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count
      FROM information_schema.columns
      WHERE lower(table_name) = 'channel'
        AND lower(column_name) = 'userid'
        AND table_schema = current_schema()
    `;

    const hasColumn = Number(result?.[0]?.count || 0) > 0;
    columnExistsCache.set(userIdCacheKey, hasColumn);
    return hasColumn;
  } catch (error: any) {
    columnExistsCache.set(userIdCacheKey, false);
    return false;
  }
}

export async function findChannelsForUser(userId: string) {
  if (await channelHasUserIdColumn()) {
    try {
      return await db.channel.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
    } catch (error: any) {
      const message = String(error?.message || "").toLowerCase();
      const missingColumn =
        error?.code === "42703" ||
        message.includes("column \"userid\" does not exist") ||
        message.includes("column \"userId\" does not exist") ||
        message.includes("column \"user_id\" does not exist");
      if (missingColumn) {
        columnExistsCache.set(userIdCacheKey, false);
        return db.channel.findMany({ orderBy: { createdAt: "desc" } });
      }
      throw error;
    }
  }

  return db.channel.findMany({ orderBy: { createdAt: "desc" } });
}

export async function findChannelByIdForUser(id: string, userId: string) {
  if (await channelHasUserIdColumn()) {
    try {
      return db.channel.findFirst({ where: { id, userId } });
    } catch (error: any) {
      const message = String(error?.message || "").toLowerCase();
      const missingColumn =
        error?.code === "42703" ||
        message.includes("column \"userid\" does not exist") ||
        message.includes("column \"userId\" does not exist") ||
        message.includes("column \"user_id\" does not exist");
      if (missingColumn) {
        columnExistsCache.set(userIdCacheKey, false);
        return db.channel.findUnique({ where: { id } });
      }
      throw error;
    }
  }

  return db.channel.findUnique({ where: { id } });
}

export async function findChannelByYoutubeIdForUser(youtubeChannelId: string, userId: string) {
  if (await channelHasUserIdColumn()) {
    try {
      return db.channel.findFirst({ where: { youtubeChannelId, userId } });
    } catch (error: any) {
      const message = String(error?.message || "").toLowerCase();
      const missingColumn =
        error?.code === "42703" ||
        message.includes("column \"userid\" does not exist") ||
        message.includes("column \"userId\" does not exist") ||
        message.includes("column \"user_id\" does not exist");
      if (missingColumn) {
        columnExistsCache.set(userIdCacheKey, false);
        return db.channel.findFirst({ where: { youtubeChannelId } });
      }
      throw error;
    }
  }

  return db.channel.findFirst({ where: { youtubeChannelId } });
}

export async function createChannelForUser(data: Record<string, unknown>, userId: string) {
  const channelData = { ...data } as Record<string, unknown>;
  if (await channelHasUserIdColumn()) {
    channelData.userId = userId;
  }

  try {
    return db.channel.create({ data: channelData as Prisma.ChannelCreateInput });
  } catch (error: any) {
    const message = String(error?.message || "").toLowerCase();
    const missingColumn =
      error?.code === "42703" ||
      message.includes("column \"userid\" does not exist") ||
      message.includes("column \"userId\" does not exist") ||
      message.includes("column \"user_id\" does not exist");
    if (missingColumn) {
      columnExistsCache.set(userIdCacheKey, false);
      delete channelData.userId;
      return db.channel.create({ data: channelData as Prisma.ChannelCreateInput });
    }
    throw error;
  }
}

export async function updateChannelById(id: string, data: Record<string, unknown>) {
  return db.channel.update({ where: { id }, data: data as Prisma.ChannelUpdateInput });
}

export async function updateChannelForUser(id: string, userId: string, data: Record<string, unknown>) {
  if (await channelHasUserIdColumn()) {
    try {
      const existing = await db.channel.findFirst({ where: { id, userId } });
      if (!existing) return null;
    } catch (error: any) {
      const message = String(error?.message || "").toLowerCase();
      const missingColumn =
        error?.code === "42703" ||
        message.includes("column \"userid\" does not exist") ||
        message.includes("column \"userId\" does not exist") ||
        message.includes("column \"user_id\" does not exist");
      if (missingColumn) {
        columnExistsCache.set(userIdCacheKey, false);
        const existing = await db.channel.findUnique({ where: { id } });
        if (!existing) return null;
      } else {
        throw error;
      }
    }
  } else {
    const existing = await db.channel.findUnique({ where: { id } });
    if (!existing) return null;
  }

  return db.channel.update({ where: { id }, data: data as Prisma.ChannelUpdateInput });
}

export async function deleteChannelForUser(id: string, userId: string) {
  if (await channelHasUserIdColumn()) {
    try {
      const existing = await db.channel.findFirst({ where: { id, userId } });
      if (!existing) return null;
    } catch (error: any) {
      const message = String(error?.message || "").toLowerCase();
      const missingColumn =
        error?.code === "42703" ||
        message.includes("column \"userid\" does not exist") ||
        message.includes("column \"userId\" does not exist") ||
        message.includes("column \"user_id\" does not exist");
      if (missingColumn) {
        columnExistsCache.set(userIdCacheKey, false);
        const existing = await db.channel.findUnique({ where: { id } });
        if (!existing) return null;
      } else {
        throw error;
      }
    }
  } else {
    const existing = await db.channel.findUnique({ where: { id } });
    if (!existing) return null;
  }

  return db.channel.delete({ where: { id } });
}
