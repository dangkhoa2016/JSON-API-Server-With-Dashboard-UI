import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { users, posts, comments, albums, photos, todos, settings } from "@db/schema";
import { eq, like, and, or, asc, desc, sql, inArray, type SQL } from "drizzle-orm";
import type { AnySQLiteTable } from "drizzle-orm/sqlite-core";
import { getCache, setCache, invalidateCache } from "./lib/redis";
import { env } from "./lib/env";
import type { User, Post, Comment, Album, Photo, Todo } from "@db/schema";

export const VALID_RESOURCES = [
  "users", "posts", "comments", "albums", "photos", "todos",
] as const;

export type ResourceCounts = Record<typeof VALID_RESOURCES[number], number>

// Helper to build cache key
function cacheKey(resource: string, query: string, id?: string | number): string {
  if (id !== undefined) return `cache:${resource}:${id}`;
  return `cache:${resource}:q:${query}`;
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
    if (!table[key]) continue;
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
  input: { filters: Record<string, any>; sort?: string; order?: string; limit?: number; page?: number; q?: string },
  searchFields?: string[]
): Promise<{ data: T[]; total: number }> {
  const cacheK = cacheKey(resource, JSON.stringify(input));
  
  return tryCache<{ data: T[]; total: number }>(cacheK, async () => {
    const db = getDb();
    const conditions = buildWhereConditions(table, input.filters);
    
    // Add full-text search if q is provided
    if (input.q && searchFields && searchFields.length > 0) {
      const escaped = input.q.replace(/[%_]/g, '\\$&');
      const searchConditions = searchFields.map(f => like(table[f], `%${escaped}%`));
      conditions.push(or(...searchConditions));
    }
    
    // Count query (with filters, no pagination/sorting)
    let countQuery = db.select({ count: sql<number>`count(*)` }).from(table);
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions)) as any;
    }
    const countResult = await countQuery;
    const total = Number(countResult[0].count);
    
    // Data query
    let dataQuery = db.select().from(table);
    if (conditions.length > 0) {
      dataQuery = dataQuery.where(and(...conditions)) as any;
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
          dataQuery = dataQuery.orderBy(
            dir === "desc" ? desc(column) : asc(column)
          ) as any;
        }
      }
    }
    
    // Pagination
    if (input.limit) {
      const page = input.page || 1;
      dataQuery = (dataQuery as any).limit(input.limit).offset((page - 1) * input.limit);
    }
    
    const data = await dataQuery;
    return { data: data as T[], total };
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
  const cacheK = cacheKey(resource, '', id);
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
  if (!fullRecord) {
    throw new Error(`Failed to retrieve created record in ${resource}`);
  }
  return fullRecord;
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
  filters: z.record(z.string(), z.string()).optional().default(() => ({})),
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
  getCounts: publicQuery.query(async () => {
    const [userCount, postCount, commentCount, albumCount, photoCount, todoCount] = await Promise.all([
      handleCount("users", users),
      handleCount("posts", posts),
      handleCount("comments", comments),
      handleCount("albums", albums),
      handleCount("photos", photos),
      handleCount("todos", todos),
    ]);
    return { users: userCount, posts: postCount, comments: commentCount, albums: albumCount, photos: photoCount, todos: todoCount } satisfies ResourceCounts;
  }),

  getFeatureCards: publicQuery.query(async () => {
    const db = getDb();

    interface FeatureCardRow {
      key: string;
      label: string;
      description: string;
      icon: string;
      iconBg: string;
      iconColor: string;
      healthy?: boolean;
    }

    const defaultCards: FeatureCardRow[] = [
      {
        key: "feature_card_sqlite",
        label: "SQLite Database",
        description: "Local SQLite database with Drizzle ORM.\nAll data persists in a local file.",
        icon: "Database",
        iconBg: "bg-blue-100 dark:bg-blue-900/30",
        iconColor: "text-blue-600 dark:text-blue-400",
      },
      {
        key: "feature_card_redis",
        label: "Redis Cache",
        description: "Host: {{REDIS_HOST}}:{{REDIS_PORT}}\nTTL: {{REDIS_TTL}}s",
        icon: "Zap",
        iconBg: "bg-orange-100 dark:bg-orange-900/30",
        iconColor: "text-orange-600 dark:text-orange-400",
      },
      {
        key: "feature_card_ratelimit",
        label: "Rate Limiting",
        description: "Max: {{RATE_LIMIT_MAX_REQUESTS}} requests\nWindow: {{RATE_LIMIT_WINDOW_MS}}ms",
        icon: "Shield",
        iconBg: "bg-green-100 dark:bg-green-900/30",
        iconColor: "text-green-600 dark:text-green-400",
      },
    ];

    const dbCards = await db.select().from(settings)
      .where(eq(settings.group, "featureCards"))
      .all();

    const raw: FeatureCardRow[] = dbCards.length > 0
      ? dbCards.map((s) => {
          const meta: Record<string, string> = s.value ? JSON.parse(s.value) : {};
          return {
            key: s.key,
            label: s.label ?? "",
            description: s.description ?? "",
            icon: meta.icon ?? "Database",
            iconBg: meta.iconBg ?? "bg-blue-100 dark:bg-blue-900/30",
            iconColor: meta.iconColor ?? "text-blue-600 dark:text-blue-400",
          };
        })
      : defaultCards;

    const keyPattern = /\{\{(\w+)\}\}/g;
    const referenced = new Set<string>();
    for (const card of raw) {
      for (const text of [card.label, card.description]) {
        if (!text) continue;
        let m: RegExpExecArray | null;
        keyPattern.lastIndex = 0;
        while ((m = keyPattern.exec(text)) !== null) referenced.add(m[1]);
      }
    }

    for (const card of raw) {
      if (card.key === "feature_card_redis") referenced.add("REDIS_ENABLED");
      else if (card.key === "feature_card_ratelimit") referenced.add("RATE_LIMIT_ENABLED");
    }

    const valueByKey: Record<string, string> = {};
    if (referenced.size > 0) {
      const resolved = await db.select().from(settings)
        .where(inArray(settings.key, [...referenced]))
        .all();
      for (const s of resolved) valueByKey[s.key] = s.value;

      const replaceRefs = (text: string) =>
        text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => valueByKey[k] ?? `{{${k}}}`);

      for (const card of raw) {
        card.label = replaceRefs(card.label);
        card.description = replaceRefs(card.description);
      }
    }

    for (const card of raw) {
      if (card.key === "feature_card_redis") {
        card.healthy = valueByKey.REDIS_ENABLED === "true";
      } else if (card.key === "feature_card_ratelimit") {
        card.healthy = valueByKey.RATE_LIMIT_ENABLED === "true";
      }
    }

    return raw;
  }),

  // ===== USERS =====
  users: createRouter({
    list: publicQuery
      .input(listInputSchema)
      .query(async ({ input }) => {
        const result = await handleList<User>("users", users, input, ["name", "username", "email", "phone", "website", "address", "company"]);
        return { ...result, data: result.data.map(deserializeUser) };
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
      .query(({ input }) => handleList<Post>("posts", posts, input, ["title", "body"])),
    
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
      .query(({ input }) => handleList<Comment>("comments", comments, input, ["name", "email", "body"])),
    
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
      .query(({ input }) => handleList<Album>("albums", albums, input, ["title"])),
    
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
      .query(({ input }) => handleList<Photo>("photos", photos, input, ["title", "url", "thumbnailUrl"])),
    
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
      .query(({ input }) => handleList<Todo>("todos", todos, input, ["title"])),
    
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
