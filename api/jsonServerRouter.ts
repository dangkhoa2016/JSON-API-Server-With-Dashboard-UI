import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, posts, comments, albums, photos, todos } from "@db/schema";
import { eq, like, and, asc, desc, sql } from "drizzle-orm";
import { getCache, setCache, invalidateCache } from "./lib/redis";
import { env } from "./lib/env";
import type { User, Post, Comment, Album, Photo, Todo } from "@db/schema";

export const VALID_RESOURCES = [
  "users", "posts", "comments", "albums", "photos", "todos",
] as const;

// Helper to build cache key
function cacheKey(resource: string, id?: string | number, query?: string): string {
  if (id) return `cache:${resource}:${id}`;
  if (query) return `cache:${resource}:q:${query}`;
  return `cache:${resource}:all`;
}

// Helper to try cache first
async function tryCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
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
  table: Record<string, any>,
  filters: Record<string, string>
): any[] {
  const conditions: any[] = [];
  for (const [key, value] of Object.entries(filters)) {
    if (key === "_sort" || key === "_order" || key === "_limit" || key === "_page" || key === "q") continue;
    if (typeof value === "string" && value.includes("*")) {
      conditions.push(like(table[key], value.replace(/\*/g, "%")));
    } else {
      conditions.push(eq(table[key], isNaN(Number(value)) ? value : Number(value)));
    }
  }
  return conditions;
}

// Generic list handler
async function handleList<T>(
  resource: string,
  table: any,
  input: { filters: Record<string, any>; sort?: string; order?: string; limit?: number; page?: number; q?: string }
): Promise<T[]> {
  const cacheK = cacheKey(resource, undefined, JSON.stringify(input));
  
  return tryCache<T[]>(cacheK, async () => {
    const db = getDb();
    const conditions = buildWhereConditions(table, input.filters);
    
    let baseQuery = db.select().from(table);
    
    if (conditions.length > 0) {
      baseQuery = baseQuery.where(and(...conditions)) as any;
    }
    
    // Sorting
    if (input.sort) {
      const fields = input.sort.split(",");
      const orders = input.order?.split(",") || [];
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        const dir = (orders[i] || "asc").toLowerCase();
        const column = table[field];
        if (column) {
          baseQuery = baseQuery.orderBy(
            dir === "desc" ? desc(column) : asc(column)
          ) as any;
        }
      }
    }
    
    // Pagination
    if (input.limit) {
      const page = input.page || 1;
      baseQuery = (baseQuery as any).limit(input.limit).offset((page - 1) * input.limit);
    }
    
    return baseQuery as Promise<T[]>;
  });
}

// Generic count
async function handleCount(resource: string, table: any): Promise<number> {
  const cacheK = `cache:${resource}:count`;
  return tryCache<number>(cacheK, async () => {
    const db = getDb();
    const result = await db.select({ count: sql<number>`count(*)` }).from(table);
    return Number(result[0]?.count || 0);
  });
}

// Generic get by id
async function handleGetById<T>(resource: string, table: any, id: number): Promise<T | null> {
  const cacheK = cacheKey(resource, id);
  return tryCache<T | null>(cacheK, async () => {
    const db = getDb();
    const results = await db.select().from(table).where(eq(table.id, id)).limit(1);
    return (results[0] as T) || null;
  });
}

// Generic create
async function handleCreate<T>(resource: string, table: any, data: Record<string, any>): Promise<T> {
  const db = getDb();
  const result = await db.insert(table).values(data).returning({ id: table.id }) as any[];
  const fullRecord = await handleGetById<T>(resource, table, result[0].id);
  await invalidateCache(`cache:${resource}:*`);
  return fullRecord!;
}

// Generic update
async function handleUpdate<T>(resource: string, table: any, id: number, data: Record<string, any>): Promise<T | null> {
  const db = getDb();
  await db.update(table).set(data).where(eq(table.id, id));
  const fullRecord = await handleGetById<T>(resource, table, id);
  if (!fullRecord) return null;
  await invalidateCache(`cache:${resource}:*`);
  return fullRecord;
}

// Generic delete
async function handleDelete(resource: string, table: any, id: number): Promise<boolean> {
  const db = getDb();
  await db.delete(table).where(eq(table.id, id));
  await invalidateCache(`cache:${resource}:*`);
  return true;
}

// Query params schema
const listInputSchema = z.object({
  filters: z.record(z.string(), z.any()).optional().default(() => ({})),
  sort: z.string().optional(),
  order: z.string().optional(),
  limit: z.number().int().positive().optional(),
  page: z.number().int().positive().optional(),
  q: z.string().optional(),
});

function serializeUser(input: Record<string, any>): Record<string, any> {
  const data = { ...input };
  if (data.address && typeof data.address === "object") data.address = JSON.stringify(data.address);
  if (data.company && typeof data.company === "object") data.company = JSON.stringify(data.company);
  return data;
}

function deserializeUser(user: any): any {
  if (!user) return user;
  return {
    ...user,
    address: typeof user.address === "string" ? JSON.parse(user.address) : user.address,
    company: typeof user.company === "string" ? JSON.parse(user.company) : user.company,
  };
}

export const jsonServerRouter = createRouter({
  // ===== USERS =====
  users: createRouter({
    list: publicQuery
      .input(listInputSchema)
      .query(async ({ input }) => {
        const items = await handleList<User>("users", users, input);
        return items.map(deserializeUser);
      }),

    count: publicQuery.query(() => handleCount("users", users)),

    getById: publicQuery
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input }) => {
        const item = await handleGetById<User>("users", users, input.id);
        return deserializeUser(item);
      }),

    create: publicQuery
      .input(z.object({
        name: z.string().optional(),
        username: z.string().optional(),
        email: z.string().optional(),
        address: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
        phone: z.string().optional(),
        website: z.string().optional(),
        company: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
      }))
      .mutation(async ({ input }) => {
        const result = await handleCreate<User>("users", users, serializeUser(input));
        return deserializeUser(result);
      }),

    update: publicQuery
      .input(z.object({
        id: z.number().int().positive(),
        data: z.object({
          name: z.string().optional(),
          username: z.string().optional(),
          email: z.string().optional(),
          address: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
          phone: z.string().optional(),
          website: z.string().optional(),
          company: z.union([z.string(), z.record(z.string(), z.unknown())]).optional(),
        }),
      }))
      .mutation(async ({ input }) => {
        const result = await handleUpdate<User>("users", users, input.id, serializeUser(input.data));
        return deserializeUser(result);
      }),

    delete: publicQuery
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => handleDelete("users", users, input.id)),
  }),

  // ===== POSTS =====
  posts: createRouter({
    list: publicQuery
      .input(listInputSchema)
      .query(({ input }) => handleList<Post>("posts", posts, input)),
    
    count: publicQuery.query(() => handleCount("posts", posts)),
    
    getById: publicQuery
      .input(z.object({ id: z.number().int().positive() }))
      .query(({ input }) => handleGetById<Post>("posts", posts, input.id)),
    
    create: publicQuery
      .input(z.object({
        userId: z.number().int().positive(),
        title: z.string().min(1),
        body: z.string().min(1),
      }))
      .mutation(({ input }) => handleCreate<Post>("posts", posts, input)),
    
    update: publicQuery
      .input(z.object({
        id: z.number().int().positive(),
        data: z.object({
          userId: z.number().int().positive().optional(),
          title: z.string().min(1).optional(),
          body: z.string().min(1).optional(),
        }),
      }))
      .mutation(({ input }) => handleUpdate<Post>("posts", posts, input.id, input.data)),
    
    delete: publicQuery
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => handleDelete("posts", posts, input.id)),
  }),

  // ===== COMMENTS =====
  comments: createRouter({
    list: publicQuery
      .input(listInputSchema)
      .query(({ input }) => handleList<Comment>("comments", comments, input)),
    
    count: publicQuery.query(() => handleCount("comments", comments)),
    
    getById: publicQuery
      .input(z.object({ id: z.number().int().positive() }))
      .query(({ input }) => handleGetById<Comment>("comments", comments, input.id)),
    
    create: publicQuery
      .input(z.object({
        postId: z.number().int().positive(),
        name: z.string().min(1),
        email: z.string().email(),
        body: z.string().min(1),
      }))
      .mutation(({ input }) => handleCreate<Comment>("comments", comments, input)),
    
    update: publicQuery
      .input(z.object({
        id: z.number().int().positive(),
        data: z.object({
          postId: z.number().int().positive().optional(),
          name: z.string().min(1).optional(),
          email: z.string().email().optional(),
          body: z.string().min(1).optional(),
        }),
      }))
      .mutation(({ input }) => handleUpdate<Comment>("comments", comments, input.id, input.data)),
    
    delete: publicQuery
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => handleDelete("comments", comments, input.id)),
  }),

  // ===== ALBUMS =====
  albums: createRouter({
    list: publicQuery
      .input(listInputSchema)
      .query(({ input }) => handleList<Album>("albums", albums, input)),
    
    count: publicQuery.query(() => handleCount("albums", albums)),
    
    getById: publicQuery
      .input(z.object({ id: z.number().int().positive() }))
      .query(({ input }) => handleGetById<Album>("albums", albums, input.id)),
    
    create: publicQuery
      .input(z.object({
        userId: z.number().int().positive(),
        title: z.string().min(1),
      }))
      .mutation(({ input }) => handleCreate<Album>("albums", albums, input)),
    
    update: publicQuery
      .input(z.object({
        id: z.number().int().positive(),
        data: z.object({
          userId: z.number().int().positive().optional(),
          title: z.string().min(1).optional(),
        }),
      }))
      .mutation(({ input }) => handleUpdate<Album>("albums", albums, input.id, input.data)),
    
    delete: publicQuery
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => handleDelete("albums", albums, input.id)),
  }),

  // ===== PHOTOS =====
  photos: createRouter({
    list: publicQuery
      .input(listInputSchema)
      .query(({ input }) => handleList<Photo>("photos", photos, input)),
    
    count: publicQuery.query(() => handleCount("photos", photos)),
    
    getById: publicQuery
      .input(z.object({ id: z.number().int().positive() }))
      .query(({ input }) => handleGetById<Photo>("photos", photos, input.id)),
    
    create: publicQuery
      .input(z.object({
        albumId: z.number().int().positive(),
        title: z.string().min(1),
        url: z.string().url(),
        thumbnailUrl: z.string().url(),
      }))
      .mutation(({ input }) => handleCreate<Photo>("photos", photos, input)),
    
    update: publicQuery
      .input(z.object({
        id: z.number().int().positive(),
        data: z.object({
          albumId: z.number().int().positive().optional(),
          title: z.string().min(1).optional(),
          url: z.string().url().optional(),
          thumbnailUrl: z.string().url().optional(),
        }),
      }))
      .mutation(({ input }) => handleUpdate<Photo>("photos", photos, input.id, input.data)),
    
    delete: publicQuery
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => handleDelete("photos", photos, input.id)),
  }),

  // ===== TODOS =====
  todos: createRouter({
    list: publicQuery
      .input(listInputSchema)
      .query(({ input }) => handleList<Todo>("todos", todos, input)),
    
    count: publicQuery.query(() => handleCount("todos", todos)),
    
    getById: publicQuery
      .input(z.object({ id: z.number().int().positive() }))
      .query(({ input }) => handleGetById<Todo>("todos", todos, input.id)),
    
    create: publicQuery
      .input(z.object({
        userId: z.number().int().positive(),
        title: z.string().min(1),
        completed: z.boolean().default(false),
      }))
      .mutation(({ input }) => handleCreate<Todo>("todos", todos, input)),
    
    update: publicQuery
      .input(z.object({
        id: z.number().int().positive(),
        data: z.object({
          userId: z.number().int().positive().optional(),
          title: z.string().min(1).optional(),
          completed: z.boolean().optional(),
        }),
      }))
      .mutation(({ input }) => handleUpdate<Todo>("todos", todos, input.id, input.data)),
    
    delete: publicQuery
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => handleDelete("todos", todos, input.id)),
  }),
});
