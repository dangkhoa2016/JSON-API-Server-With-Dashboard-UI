import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { users, posts } from "@db/schema";
import type { User, Post } from "@db/schema";
import {
  listInputSchema,
  handleList,
  handleCount,
  handleGetById,
  handleCreate,
  handleUpdate,
  handleDelete,
} from "./handlers";

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
});
