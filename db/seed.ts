import { fileURLToPath } from "node:url";
import { getDb, type SeedDb } from "./config";
import * as schema from "./schema";

interface JsonUser {
  id: number; name: string; username: string; email: string;
  address: object; phone: string; website: string; company: object;
}

interface JsonPost { id: number; userId: number; title: string; body: string; }
interface JsonComment { id: number; postId: number; name: string; email: string; body: string; }
interface JsonAlbum { id: number; userId: number; title: string; }
interface JsonPhoto { id: number; albumId: number; title: string; url: string; thumbnailUrl: string; }
interface JsonTodo { id: number; userId: number; title: string; completed: boolean; }

export type { SeedDb } from "./config";

export async function seedDatabase(dbInstance: SeedDb) {
  const existing = await dbInstance.select().from(schema.users).limit(1);
  if (existing.length > 0) {
    console.log("Database already seeded, skipping.");
    return;
  }

  const BASE = "https://jsonplaceholder.typicode.com";

  const seedUsers = await fetch(`${BASE}/users`).then((r) => r.json()) as JsonUser[];
  await dbInstance.insert(schema.users).values(
    seedUsers.map((u) => ({
      id: u.id, name: u.name, username: u.username, email: u.email,
      address: JSON.stringify(u.address), phone: u.phone, website: u.website,
      company: JSON.stringify(u.company),
    }))
  );
  console.log(`Inserted ${seedUsers.length} users`);

  const seedPosts = await fetch(`${BASE}/posts`).then((r) => r.json()) as JsonPost[];
  await dbInstance.insert(schema.posts).values(
    seedPosts.map((p) => ({ id: p.id, userId: p.userId, title: p.title, body: p.body }))
  );
  console.log(`Inserted ${seedPosts.length} posts`);

  const seedComments = await fetch(`${BASE}/comments`).then((r) => r.json()) as JsonComment[];
  await dbInstance.insert(schema.comments).values(
    seedComments.map((c) => ({ id: c.id, postId: c.postId, name: c.name, email: c.email, body: c.body }))
  );
  console.log(`Inserted ${seedComments.length} comments`);

  const seedAlbums = await fetch(`${BASE}/albums`).then((r) => r.json()) as JsonAlbum[];
  await dbInstance.insert(schema.albums).values(
    seedAlbums.map((a) => ({ id: a.id, userId: a.userId, title: a.title }))
  );
  console.log(`Inserted ${seedAlbums.length} albums`);

  const seedPhotos = await fetch(`${BASE}/photos`).then((r) => r.json()) as JsonPhoto[];
  await dbInstance.insert(schema.photos).values(
    seedPhotos.map((p) => ({ id: p.id, albumId: p.albumId, title: p.title, url: p.url, thumbnailUrl: p.thumbnailUrl }))
  );
  console.log(`Inserted ${seedPhotos.length} photos`);

  const seedTodos = await fetch(`${BASE}/todos`).then((r) => r.json()) as JsonTodo[];
  await dbInstance.insert(schema.todos).values(
    seedTodos.map((t) => ({ id: t.id, userId: t.userId, title: t.title, completed: t.completed }))
  );
  console.log(`Inserted ${seedTodos.length} todos`);

  console.log("Seeding complete!");
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  const db = getDb();
  seedDatabase(db).catch(console.error);
}
