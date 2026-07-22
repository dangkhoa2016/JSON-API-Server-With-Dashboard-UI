import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { users, posts, comments, albums, photos, todos } from "@db/schema";
import type { User } from "@db/schema";
import {
  listInputSchema,
  handleList,
  handleCount,
  handleGetById,
  handleCreate,
  handleUpdate,
  handleDelete,
} from "./handlers";
import { getFeatureCards } from "./featureCards";

export const VALID_RESOURCES = [
  "users", "posts", "comments", "albums", "photos", "todos",
] as const;

type ResourceTable = typeof users | typeof posts | typeof comments | typeof albums | typeof photos | typeof todos;

interface ResourceConfig {
  name: string;
  table: ResourceTable;
  searchFields: string[];
  createSchema: z.ZodObject<z.ZodRawShape>;
  updateSchema: z.ZodObject<z.ZodRawShape>;
}

function createCrudRoutes(config: ResourceConfig) {
  const { name, table, searchFields, createSchema, updateSchema } = config;
  return createRouter({
    list: publicQuery
      .input(listInputSchema)
      .query(({ input }) => handleList(name, table, input, searchFields)),

    count: publicQuery.query(() => handleCount(name, table)),

    getById: publicQuery
      .input(z.object({ id: z.number().int().positive() }))
      .query(({ input }) => handleGetById(name, table, input.id)),

    create: publicQuery
      .input(createSchema)
      .mutation(({ input }) => handleCreate(name, table, input as Record<string, unknown>)),

    update: publicQuery
      .input(z.object({ id: z.number().int().positive(), data: updateSchema }))
      .mutation(({ input }) => handleUpdate(name, table, input.id, input.data as Record<string, unknown>)),

    delete: publicQuery
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => handleDelete(name, table, input.id)),
  });
}

function serializeUser(input: Record<string, unknown>): Record<string, unknown> {
  const data = { ...input };
  if (data.address && typeof data.address === "object") data.address = JSON.stringify(data.address);
  if (data.company && typeof data.company === "object") data.company = JSON.stringify(data.company);
  return data;
}

function deserializeUser(user: User | null): User | null {
  if (!user) return user;
  return {
    ...user,
    address: typeof user.address === "string" ? JSON.parse(user.address) as string : user.address,
    company: typeof user.company === "string" ? JSON.parse(user.company) as string : user.company,
  };
}

export type ResourceCounts = Record<typeof VALID_RESOURCES[number], number>

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

  getFeatureCards: publicQuery.query(() => getFeatureCards()),

  // ===== USERS (custom serialize/deserialize) =====
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
  posts: createCrudRoutes({
    name: "posts", table: posts, searchFields: ["title", "body"],
    createSchema: z.object({ userId: z.number().int().positive(), title: z.string().min(1), body: z.string().min(1) }),
    updateSchema: z.object({ userId: z.number().int().positive().optional(), title: z.string().min(1).optional(), body: z.string().min(1).optional() }),
  }),

  // ===== COMMENTS =====
  comments: createCrudRoutes({
    name: "comments", table: comments, searchFields: ["name", "email", "body"],
    createSchema: z.object({ postId: z.number().int().positive(), name: z.string().min(1), email: z.string().email(), body: z.string().min(1) }),
    updateSchema: z.object({ postId: z.number().int().positive().optional(), name: z.string().min(1).optional(), email: z.string().email().optional(), body: z.string().min(1).optional() }),
  }),

  // ===== ALBUMS =====
  albums: createCrudRoutes({
    name: "albums", table: albums, searchFields: ["title"],
    createSchema: z.object({ userId: z.number().int().positive(), title: z.string().min(1) }),
    updateSchema: z.object({ userId: z.number().int().positive().optional(), title: z.string().min(1).optional() }),
  }),

  // ===== PHOTOS =====
  photos: createCrudRoutes({
    name: "photos", table: photos, searchFields: ["title", "url", "thumbnailUrl"],
    createSchema: z.object({ albumId: z.number().int().positive(), title: z.string().min(1), url: z.string().url(), thumbnailUrl: z.string().url() }),
    updateSchema: z.object({ albumId: z.number().int().positive().optional(), title: z.string().min(1).optional(), url: z.string().url().optional(), thumbnailUrl: z.string().url().optional() }),
  }),

  // ===== TODOS =====
  todos: createCrudRoutes({
    name: "todos", table: todos, searchFields: ["title"],
    createSchema: z.object({ userId: z.number().int().positive(), title: z.string().min(1), completed: z.boolean().default(false) }),
    updateSchema: z.object({ userId: z.number().int().positive().optional(), title: z.string().min(1).optional(), completed: z.boolean().optional() }),
  }),
});
