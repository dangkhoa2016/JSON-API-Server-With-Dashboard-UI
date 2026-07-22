import { z } from "zod";
import { getDb } from "../queries/connection";
import {
  eq,
  and,
  or,
  asc,
  desc,
  sql,
  getTableColumns,
  type SQL,
} from "drizzle-orm";
import type { AnySQLiteTable } from "drizzle-orm/sqlite-core";
import { getCache, setCache, invalidateCache } from "../lib/redis";
import { env } from "../lib/env";

// Helper to build cache key
export function cacheKey(
  resource: string,
  query: string,
  id?: string | number
): string {
  if (id !== undefined) return `cache:${resource}:${id}`;
  return `cache:${resource}:q:${query}`;
}

// Helper to try cache first
export async function tryCache<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  if (!env.cacheEnabled) return fetcher();
  const cached = await getCache(key);
  if (cached) {
    try {
      return JSON.parse(cached) as T;
    } catch {
      // cached data corrupted, fall through to fetch fresh
    }
  }
  const result = await fetcher();
  await setCache(key, JSON.stringify(result));
  return result;
}

// Build where conditions from query params
function buildWhereConditions(
  table: AnySQLiteTable,
  filters: Record<string, string>
): SQL[] {
  const conditions: SQL[] = [];
  const columns = getTableColumns(table);
  for (const [key, value] of Object.entries(filters)) {
    if (
      key === "_sort" ||
      key === "_order" ||
      key === "_limit" ||
      key === "_page" ||
      key === "q"
    )
      continue;
    const column = columns[key];
    if (!column) continue;
    if (typeof value === "string" && value.includes("*")) {
      const escaped = value.replace(/[\\%_]/g, "\\$&").replace(/\*/g, "%");
      conditions.push(
        sql`${column} LIKE ${sql.param(escaped)} ESCAPE ${sql.raw("'\\'")}`
      );
    } else {
      conditions.push(eq(column, isNaN(Number(value)) ? value : Number(value)));
    }
  }
  return conditions;
}

// Generic list handler
export async function handleList<T>(
  resource: string,
  table: AnySQLiteTable,
  input: {
    filters: Record<string, string>;
    sort?: string;
    order?: string;
    limit?: number;
    page?: number;
    q?: string;
  },
  searchFields?: string[]
): Promise<{ data: T[]; total: number }> {
  const cacheK = cacheKey(resource, JSON.stringify(input));

  return tryCache<{ data: T[]; total: number }>(cacheK, async () => {
    const db = getDb();
    const conditions = buildWhereConditions(table, input.filters);

    // Add full-text search if q is provided
    if (input.q && searchFields && searchFields.length > 0) {
      const escaped = input.q.replace(/[\\%_]/g, "\\$&");
      const pattern = "%" + escaped + "%";
      const columns = getTableColumns(table);
      const searchConditions = searchFields.map(
        f =>
          sql`${columns[f]} LIKE ${sql.param(pattern)} ESCAPE ${sql.raw("'\\'")}`
      );
      const combined = or(...searchConditions);
      /* v8 ignore next -- or() is truthy when searchFields is non-empty */
      if (combined) conditions.push(combined);
    }

    // Count query (with filters, no pagination/sorting)
    let countQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .$dynamic();
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions));
    }
    const countResult = await countQuery;
    const total = Number(countResult[0].count);

    // Data query
    let dataQuery = db.select().from(table).$dynamic();
    if (conditions.length > 0) {
      dataQuery = dataQuery.where(and(...conditions));
    }

    // Sorting
    if (input.sort) {
      const fields = input.sort.split(",");
      const orders = input.order?.split(",") || [];
      const columns = getTableColumns(table);
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        const dir = (orders[i] || "asc").toLowerCase();
        const column = columns[field];
        if (column) {
          dataQuery = dataQuery.orderBy(
            dir === "desc" ? desc(column) : asc(column)
          );
        }
      }
    }

    // Pagination
    if (input.limit) {
      const page = input.page || 1;
      dataQuery = dataQuery.limit(input.limit).offset((page - 1) * input.limit);
    }

    const data = await dataQuery;
    return { data: data as T[], total };
  });
}

// Generic count
export async function handleCount(
  resource: string,
  table: AnySQLiteTable
): Promise<number> {
  const cacheK = `cache:${resource}:count`;
  return tryCache<number>(cacheK, async () => {
    const db = getDb();
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(table);
    return Number(result[0]?.count || 0);
  });
}

async function selectById<T>(
  table: AnySQLiteTable,
  id: number
): Promise<T | null> {
  const db = getDb();
  const records = await db
    .select()
    .from(table)
    .where(eq(getTableColumns(table).id, id))
    .limit(1);

  return (records[0] as T | undefined) ?? null;
}

// Generic get by id
export async function handleGetById<T>(
  resource: string,
  table: AnySQLiteTable,
  id: number
): Promise<T | null> {
  const cacheK = cacheKey(resource, "", id);
  return tryCache<T | null>(cacheK, () => selectById<T>(table, id));
}

// Generic create
export async function handleCreate<T>(
  resource: string,
  table: AnySQLiteTable,
  data: Record<string, unknown>
): Promise<T> {
  const db = getDb();
  const result = (await db
    .insert(table)
    .values(data)
    .returning({ id: getTableColumns(table).id })) as { id: number }[];
  await invalidateCache(`cache:${resource}:*`);
  const record = await selectById<T>(table, result[0].id);
  if (!record)
    throw new Error(`Failed to retrieve created record in ${resource}`);
  return record;
}

// Generic update
export async function handleUpdate<T>(
  resource: string,
  table: AnySQLiteTable,
  id: number,
  data: Record<string, unknown>
): Promise<T | null> {
  const db = getDb();
  await db
    .update(table)
    .set(data)
    .where(eq(getTableColumns(table).id, id));
  await invalidateCache(`cache:${resource}:*`);
  return selectById<T>(table, id);
}

// Generic delete
export async function handleDelete(
  resource: string,
  table: AnySQLiteTable,
  id: number
): Promise<boolean> {
  const db = getDb();
  await db.delete(table).where(eq(getTableColumns(table).id, id));
  await invalidateCache(`cache:${resource}:*`);
  return true;
}

// Query params schema
export const listInputSchema = z.object({
  filters: z
    .record(z.string(), z.string())
    .optional()
    .default(() => ({})),
  sort: z.string().optional(),
  order: z.string().optional(),
  limit: z.number().int().positive().optional(),
  page: z.number().int().positive().optional(),
  q: z.string().optional(),
});
