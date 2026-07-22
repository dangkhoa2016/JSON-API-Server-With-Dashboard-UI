import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { users, posts, comments, albums, photos, todos } from "@db/schema";
import type { User, Post, Comment, Album, Photo, Todo } from "@db/schema";
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
