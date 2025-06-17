import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

// Users table
export const users = sqliteTable("users", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  name: text("name"),
  username: text("username"),
  email: text("email"),
  address: text("address"),
  phone: text("phone"),
  website: text("website"),
  company: text("company"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Posts table
export const posts = sqliteTable("posts", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: integer("user_id", { mode: "number" }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
});

export type Post = typeof posts.$inferSelect;
export type InsertPost = typeof posts.$inferInsert;

// Comments table
export const comments = sqliteTable("comments", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  postId: integer("post_id", { mode: "number" }).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  body: text("body").notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;

// Albums table
export const albums = sqliteTable("albums", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: integer("user_id", { mode: "number" }).notNull(),
  title: text("title").notNull(),
});

export type Album = typeof albums.$inferSelect;
export type InsertAlbum = typeof albums.$inferInsert;

// Photos table
export const photos = sqliteTable("photos", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  albumId: integer("album_id", { mode: "number" }).notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url").notNull(),
});

export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = typeof photos.$inferInsert;

// Todos table
export const todos = sqliteTable("todos", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: integer("user_id", { mode: "number" }).notNull(),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
});

export type Todo = typeof todos.$inferSelect;
export type InsertTodo = typeof todos.$inferInsert;
