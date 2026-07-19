import { relations } from "drizzle-orm";
import { users, posts, comments, albums, photos, todos } from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  albums: many(albums),
  todos: many(todos),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.userId], references: [users.id] }),
  comments: many(comments),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, { fields: [comments.postId], references: [posts.id] }),
}));

export const albumsRelations = relations(albums, ({ one, many }) => ({
  author: one(users, { fields: [albums.userId], references: [users.id] }),
  photos: many(photos),
}));

export const photosRelations = relations(photos, ({ one }) => ({
  album: one(albums, { fields: [photos.albumId], references: [albums.id] }),
}));

export const todosRelations = relations(todos, ({ one }) => ({
  author: one(users, { fields: [todos.userId], references: [users.id] }),
}));
