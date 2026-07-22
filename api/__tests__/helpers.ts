import { sql } from "drizzle-orm";
import { getDb } from "../queries/connection";

export async function setupTestDatabase() {
  const db = getDb();

  await db.run(sql`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    username TEXT,
    email TEXT,
    address TEXT,
    phone TEXT,
    website TEXT,
    company TEXT
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    body TEXT NOT NULL
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    album_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT NOT NULL
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0
  )`);

  await db.run(sql`CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'string',
    label TEXT,
    description TEXT,
    "group" TEXT,
    is_public INTEGER NOT NULL DEFAULT 0
  )`);

  await db.run(sql`INSERT OR IGNORE INTO settings (key, value, type, label, description, "group", is_public) VALUES
    ('ADMIN_SESSION_SECRET', 'test-session-secret-key-for-testing', 'string', 'Admin Session Secret', 'HMAC signing key', 'auth', 0)
  `);
}

export async function seedTestData() {
  const db = getDb();

  await db.run(sql`
    INSERT INTO users (id, name, username, email, phone, website)
    VALUES
      (1, 'Leanne Graham', 'Bret', 'Sincere@april.biz', '1-770-736-8031 x56442', 'hildegard.org'),
      (2, 'Ervin Howell', 'Antonette', 'Shanna@melissa.tv', '010-692-6593 x09125', 'anastasia.net'),
      (3, 'Clementine Bauch', 'Samantha', 'Nathan@yesenia.net', '1-463-123-4447', 'ramiro.info')
  `);

  await db.run(sql`
    INSERT INTO posts (id, user_id, title, body)
    VALUES
      (1, 1, 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit', 'quia et suscipit'),
      (2, 1, 'qui est esse', 'est rerum tempore vitae'),
      (3, 2, 'ea molestias quasi exercitationem repellat qui ipsa sit aut', 'et iusto sed quo')
  `);

  await db.run(sql`
    INSERT INTO comments (id, post_id, name, email, body)
    VALUES
      (1, 1, 'id labore ex et quam laborum', 'Eliseo@gardner.biz', 'laudantium enim quasi'),
      (2, 1, 'quo vero reiciendis velit similique earum', 'Jayne_Kuhic@sydney.com', 'est natus enim nihil')
  `);

  await db.run(sql`
    INSERT INTO albums (id, user_id, title)
    VALUES
      (1, 1, 'quidem molestiae enim'),
      (2, 1, 'sunt qui excepturi placeat culpa')
  `);

  await db.run(sql`
    INSERT INTO photos (id, album_id, title, url, thumbnail_url)
    VALUES
      (1, 1, 'accusamus beatae ad facilis cum similique qui sunt', 'https://via.placeholder.com/600/92c952', 'https://via.placeholder.com/150/92c952'),
      (2, 1, 'reprehenderit est deserunt velit ipsam', 'https://via.placeholder.com/600/771796', 'https://via.placeholder.com/150/771796')
  `);

  await db.run(sql`
    INSERT INTO todos (id, user_id, title, completed)
    VALUES
      (1, 1, 'delectus aut autem', 0),
      (2, 1, 'quis ut nam facilis et officia qui', 1),
      (3, 2, 'fugiat veniam minus', 0)
  `);

  await db.run(sql`INSERT OR IGNORE INTO settings (key, value, type, label, description, "group", is_public) VALUES
    ('ADMIN_SESSION_SECRET', 'test-session-secret-key-for-testing', 'string', 'Admin Session Secret', 'HMAC signing key', 'auth', 0)
  `);
}

export async function clearTestDatabase() {
  const db = getDb();
  await db.run(sql`DELETE FROM photos`);
  await db.run(sql`DELETE FROM comments`);
  await db.run(sql`DELETE FROM posts`);
  await db.run(sql`DELETE FROM albums`);
  await db.run(sql`DELETE FROM todos`);
  await db.run(sql`DELETE FROM users`);
  await db.run(sql`DELETE FROM settings`);
}
