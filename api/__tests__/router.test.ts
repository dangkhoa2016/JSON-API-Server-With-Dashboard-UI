import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { appRouter } from "../router";
import { env } from "../lib/env";
import { setupTestDatabase, seedTestData, clearTestDatabase } from "./helpers";

process.env.APP_SECRET = "test-secret";
process.env.DATABASE_URL = "file::memory:?cache=shared";
process.env.CACHE_ENABLED = "true";
process.env.REDIS_ENABLED = "false";
process.env.RATE_LIMIT_ENABLED = "false";
process.env.DEBUG_SQL = "false";

beforeAll(async () => {
  await setupTestDatabase();
});

beforeEach(async () => {
  await clearTestDatabase();
  await seedTestData();
});

describe("appRouter - ping", () => {
  it("returns ok with timestamp", async () => {
    const caller = appRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
    const result = await caller.ping();
    expect(result.ok).toBe(true);
    expect(typeof result.ts).toBe("number");
  });
});

describe("appRouter - json.users", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
  });

  it("list returns data and total count", async () => {
    const result = await caller.json.users.list({});
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(result.total).toBe(3);
    expect(result.data).toHaveLength(3);
  });

  it("list total respects exact match filter", async () => {
    const result = await caller.json.users.list({
      filters: { name: "Leanne Graham" },
    });
    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(1);
  });

  it("list total respects wildcard filter", async () => {
    const result = await caller.json.users.list({
      filters: { name: "Clem*" },
    });
    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe("Clementine Bauch");
  });

  it("list total is unaffected by pagination", async () => {
    const result = await caller.json.users.list({
      limit: 1,
      page: 1,
    });
    expect(result.total).toBe(3);
    expect(result.data).toHaveLength(1);
  });

  it("list total with pagination returns correct second page", async () => {
    const result = await caller.json.users.list({
      limit: 1,
      page: 2,
    });
    expect(result.total).toBe(3);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe(2);
  });

  it("list total with filter and pagination", async () => {
    const result = await caller.json.users.list({
      filters: { name: "Ervin Howell" },
      limit: 10,
    });
    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe("Ervin Howell");
  });

  it("list without filters still returns total", async () => {
    const result = await caller.json.users.list({});
    expect(result.total).toBe(3);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it("count returns total number of users", async () => {
    const count = await caller.json.users.count();
    expect(count).toBe(3);
  });

  it("count returns 0 after deleting all users", async () => {
    const all = await caller.json.users.list({});
    for (const user of all.data) {
      await caller.json.users.delete({ id: user.id });
    }
    const count = await caller.json.users.count();
    expect(count).toBe(0);
  });

  it("getById returns a single user", async () => {
    const user = await caller.json.users.getById({ id: 1 });
    expect(user).not.toBeNull();
    expect(user!.id).toBe(1);
    expect(user!.name).toBe("Leanne Graham");
  });

  it("getById returns null for non-existent user", async () => {
    const user = await caller.json.users.getById({ id: 9999 });
    expect(user).toBeNull();
  });

  it("create inserts a new user", async () => {
    const created = await caller.json.users.create({ name: "New User", username: "newuser" });
    expect(created.id).toBe(4);
    expect(created.name).toBe("New User");

    const count = await caller.json.users.count();
    expect(count).toBe(4);
  });

  it("create serializes address and company objects", async () => {
    const created = await caller.json.users.create({
      name: "Addr User",
      username: "addruser",
      address: { street: "123 Test St", city: "Testville" },
      company: { name: "Test Corp" },
    });
    expect(created.id).toBeGreaterThan(0);
    expect(created.address).toEqual({ street: "123 Test St", city: "Testville" });
    expect(created.company).toEqual({ name: "Test Corp" });
  });

  it("update modifies an existing user", async () => {
    const updated = await caller.json.users.update({ id: 1, data: { name: "Updated Name" } });
    expect(updated!.name).toBe("Updated Name");

    const user = await caller.json.users.getById({ id: 1 });
    expect(user!.name).toBe("Updated Name");
  });

  it("update returns null for non-existent user", async () => {
    const result = await caller.json.users.update({ id: 9999, data: { name: "test" } });
    expect(result).toBeNull();
  });

  it("delete removes a user", async () => {
    await caller.json.users.delete({ id: 1 });
    const user = await caller.json.users.getById({ id: 1 });
    expect(user).toBeNull();
  });

  it("list supports sorting ascending", async () => {
    const result = await caller.json.users.list({
      sort: "name",
      order: "asc",
    });
    expect(result.total).toBe(3);
    expect(result.data[0].name).toBe("Clementine Bauch");
    expect(result.data[2].name).toBe("Leanne Graham");
  });

  it("list supports sorting descending", async () => {
    const result = await caller.json.users.list({
      sort: "name",
      order: "desc",
    });
    expect(result.total).toBe(3);
    expect(result.data[0].name).toBe("Leanne Graham");
    expect(result.data[2].name).toBe("Clementine Bauch");
  });

  it("list supports sort without order (defaults to asc)", async () => {
    const result = await caller.json.users.list({
      sort: "name",
    });
    expect(result.total).toBe(3);
    expect(result.data[0].name).toBe("Clementine Bauch");
  });

  it("list silently skips sort for non-existent column", async () => {
    const result = await caller.json.users.list({
      sort: "nonexistent_field",
    });
    expect(result.total).toBe(3);
    expect(result.data).toHaveLength(3);
  });

  it("list filters by numeric field on posts", async () => {
    const postsCaller = appRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
    const result = await postsCaller.json.posts.list({
      filters: { userId: "1" },
    });
    expect(result.total).toBe(2);
    expect(result.data.every((p: any) => p.userId === 1)).toBe(true);
  });
});

describe("appRouter - edge cases", () => {
  it("list returns total when cache is disabled", async () => {
    const original = env.cacheEnabled;
    env.cacheEnabled = false;
    const caller = appRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
    const result = await caller.json.users.list({});
    expect(result.total).toBe(3);
    env.cacheEnabled = original;
  });

  it("list uses cached data on second call", async () => {
    const caller = appRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
    const first = await caller.json.users.list({});
    expect(first.total).toBe(3);
    const second = await caller.json.users.list({});
    expect(second.total).toBe(3);
  });

  it("list skips special query params in buildWhereConditions", async () => {
    const caller = appRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
    const result = await caller.json.users.list({
      filters: { _sort: "name", name: "Leanne Graham" },
    });
    expect(result.total).toBe(1);
    expect(result.data[0].name).toBe("Leanne Graham");
  });
});

describe("appRouter - json.posts", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
  });

  it("list returns data and total", async () => {
    const result = await caller.json.posts.list({});
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(result.total).toBe(3);
    expect(result.data).toHaveLength(3);
  });

  it("list total with pagination on posts", async () => {
    const result = await caller.json.posts.list({
      limit: 1,
    });
    expect(result.total).toBe(3);
    expect(result.data).toHaveLength(1);
  });

  it("count returns number of posts", async () => {
    const count = await caller.json.posts.count();
    expect(count).toBe(3);
  });

  it("getById returns a single post", async () => {
    const post = await caller.json.posts.getById({ id: 1 });
    expect(post).not.toBeNull();
    expect(post!.id).toBe(1);
  });

  it("create inserts a new post", async () => {
    const created = await caller.json.posts.create({
      userId: 1,
      title: "New Post",
      body: "Post body content",
    });
    expect(created.id).toBe(4);
    expect(created.title).toBe("New Post");
  });

  it("update modifies an existing post", async () => {
    const updated = await caller.json.posts.update({
      id: 1,
      data: { title: "Updated Title" },
    });
    expect(updated!.title).toBe("Updated Title");
  });

  it("update returns null for non-existent post", async () => {
    const result = await caller.json.posts.update({
      id: 9999,
      data: { title: "test" },
    });
    expect(result).toBeNull();
  });

  it("delete removes a post", async () => {
    await caller.json.posts.delete({ id: 1 });
    const post = await caller.json.posts.getById({ id: 1 });
    expect(post).toBeNull();
  });
});

describe("appRouter - json.comments", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
  });

  it("list returns data and total", async () => {
    const result = await caller.json.comments.list({});
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(result.total).toBe(2);
    expect(result.data).toHaveLength(2);
  });

  it("count returns number of comments", async () => {
    const count = await caller.json.comments.count();
    expect(count).toBe(2);
  });

  it("getById returns a single comment", async () => {
    const comment = await caller.json.comments.getById({ id: 1 });
    expect(comment).not.toBeNull();
    expect(comment!.id).toBe(1);
  });

  it("create inserts a new comment", async () => {
    const created = await caller.json.comments.create({
      postId: 1,
      name: "Test Comment",
      email: "test@example.com",
      body: "Comment body",
    });
    expect(created.id).toBe(3);
    expect(created.name).toBe("Test Comment");
  });

  it("update modifies an existing comment", async () => {
    const updated = await caller.json.comments.update({
      id: 1,
      data: { name: "Updated Name" },
    });
    expect(updated!.name).toBe("Updated Name");
  });

  it("delete removes a comment", async () => {
    await caller.json.comments.delete({ id: 1 });
    const comment = await caller.json.comments.getById({ id: 1 });
    expect(comment).toBeNull();
  });
});

describe("appRouter - json.albums", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
  });

  it("list returns data and total", async () => {
    const result = await caller.json.albums.list({});
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(result.total).toBe(2);
    expect(result.data).toHaveLength(2);
  });

  it("count returns number of albums", async () => {
    const count = await caller.json.albums.count();
    expect(count).toBe(2);
  });

  it("getById returns a single album", async () => {
    const album = await caller.json.albums.getById({ id: 1 });
    expect(album).not.toBeNull();
    expect(album!.id).toBe(1);
  });

  it("create inserts a new album", async () => {
    const created = await caller.json.albums.create({
      userId: 1,
      title: "New Album",
    });
    expect(created.id).toBe(3);
    expect(created.title).toBe("New Album");
  });

  it("update modifies an existing album", async () => {
    const updated = await caller.json.albums.update({
      id: 1,
      data: { title: "Updated Album" },
    });
    expect(updated!.title).toBe("Updated Album");
  });

  it("delete removes an album", async () => {
    await caller.json.albums.delete({ id: 1 });
    const album = await caller.json.albums.getById({ id: 1 });
    expect(album).toBeNull();
  });
});

describe("appRouter - json.photos", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
  });

  it("list returns data and total", async () => {
    const result = await caller.json.photos.list({});
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(result.total).toBe(2);
    expect(result.data).toHaveLength(2);
  });

  it("count returns number of photos", async () => {
    const count = await caller.json.photos.count();
    expect(count).toBe(2);
  });

  it("getById returns a single photo", async () => {
    const photo = await caller.json.photos.getById({ id: 1 });
    expect(photo).not.toBeNull();
    expect(photo!.id).toBe(1);
  });

  it("create inserts a new photo", async () => {
    const created = await caller.json.photos.create({
      albumId: 1,
      title: "New Photo",
      url: "https://example.com/photo.jpg",
      thumbnailUrl: "https://example.com/thumb.jpg",
    });
    expect(created.id).toBe(3);
  });

  it("update modifies an existing photo", async () => {
    const updated = await caller.json.photos.update({
      id: 1,
      data: { title: "Updated Title" },
    });
    expect(updated!.title).toBe("Updated Title");
  });

  it("delete removes a photo", async () => {
    await caller.json.photos.delete({ id: 1 });
    const photo = await caller.json.photos.getById({ id: 1 });
    expect(photo).toBeNull();
  });
});

describe("appRouter - json.todos", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    caller = appRouter.createCaller({
      req: new Request("http://test.com"),
      resHeaders: new Headers(),
    });
  });

  it("list returns data and total", async () => {
    const result = await caller.json.todos.list({});
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(result.total).toBe(3);
    expect(result.data).toHaveLength(3);
  });

  it("count returns number of todos", async () => {
    const count = await caller.json.todos.count();
    expect(count).toBe(3);
  });

  it("getById returns a single todo", async () => {
    const todo = await caller.json.todos.getById({ id: 1 });
    expect(todo).not.toBeNull();
    expect(todo!.id).toBe(1);
    expect(todo!.completed).toBe(false);
  });

  it("create inserts a new todo", async () => {
    const created = await caller.json.todos.create({
      userId: 1,
      title: "New Todo",
    });
    expect(created.id).toBe(4);
    expect(created.title).toBe("New Todo");
    expect(created.completed).toBe(false);
  });

  it("create with completed=true", async () => {
    const created = await caller.json.todos.create({
      userId: 1,
      title: "Done Todo",
      completed: true,
    });
    expect(created.completed).toBe(true);
  });

  it("update modifies a todo", async () => {
    const updated = await caller.json.todos.update({
      id: 1,
      data: { completed: true },
    });
    expect(updated!.completed).toBe(true);
  });

  it("delete removes a todo", async () => {
    await caller.json.todos.delete({ id: 1 });
    const todo = await caller.json.todos.getById({ id: 1 });
    expect(todo).toBeNull();
  });
});
