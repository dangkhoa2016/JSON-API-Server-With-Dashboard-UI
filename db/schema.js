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

/** @typedef {typeof users.$inferSelect} User */
/** @typedef {typeof users.$inferInsert} InsertUser */

// Posts table
export const posts = sqliteTable("posts", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: integer("user_id", { mode: "number" }).notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
});

/** @typedef {typeof posts.$inferSelect} Post */
/** @typedef {typeof posts.$inferInsert} InsertPost */

// Comments table
export const comments = sqliteTable("comments", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  postId: integer("post_id", { mode: "number" }).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  body: text("body").notNull(),
});

/** @typedef {typeof comments.$inferSelect} Comment */
/** @typedef {typeof comments.$inferInsert} InsertComment */

// Albums table
export const albums = sqliteTable("albums", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: integer("user_id", { mode: "number" }).notNull(),
  title: text("title").notNull(),
});

/** @typedef {typeof albums.$inferSelect} Album */
/** @typedef {typeof albums.$inferInsert} InsertAlbum */

// Photos table
export const photos = sqliteTable("photos", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  albumId: integer("album_id", { mode: "number" }).notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url").notNull(),
});

/** @typedef {typeof photos.$inferSelect} Photo */
/** @typedef {typeof photos.$inferInsert} InsertPhoto */

// Todos table
export const todos = sqliteTable("todos", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  userId: integer("user_id", { mode: "number" }).notNull(),
  title: text("title").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false),
});

/** @typedef {typeof todos.$inferSelect} Todo */
/** @typedef {typeof todos.$inferInsert} InsertTodo */

// Settings table (admin-configurable settings from .env)
export const settings = sqliteTable("settings", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull().default(""),
  type: text("type").notNull().default("string"),
  label: text("label"),
  description: text("description"),
  group: text("group"),
  isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
});

/** @typedef {typeof settings.$inferSelect} Setting */
/** @typedef {typeof settings.$inferInsert} InsertSetting */
