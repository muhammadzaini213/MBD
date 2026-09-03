process.env.JWT_SECRET = "test-secret";

jest.mock("pg", () => {
  const mPool = { query: jest.fn(), connect: jest.fn(), end: jest.fn() };
  return { Pool: jest.fn(() => mPool) };
});

const request = require("supertest");
const jwt = require("jsonwebtoken");

function signToken(role) {
  return jwt.sign({ sub: 1, username: "testuser", role }, "test-secret", { expiresIn: "15m" });
}

describe("Webhooks Routes", () => {
  let app, pool;

  beforeEach(() => {
    jest.resetModules();
    jest.mock("pg", () => {
      const mPool = { query: jest.fn(), connect: jest.fn(), end: jest.fn() };
      return { Pool: jest.fn(() => mPool) };
    });
    app = require("../app");
    pool = require("pg").Pool();
  });

  afterEach(() => jest.clearAllMocks());

  describe("POST /api/webhooks", () => {
    test("returns 401 without token", async () => {
      const res = await request(app)
        .post("/api/webhooks")
        .send({ name: "test", webhook_url: "https://discord.com/api/webhooks/123" });
      expect(res.status).toBe(401);
    });

    test("returns 403 for viewer role", async () => {
      const token = signToken("viewer");
      const res = await request(app)
        .post("/api/webhooks")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "test", webhook_url: "https://discord.com/api/webhooks/123" });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Insufficient permissions");
    });

    test("returns 201 for operator role", async () => {
      pool.query.mockResolvedValue({ rows: [{ p_result: { id: 1, name: "test", webhook_url: "https://discord.com/api/webhooks/123" } }] });
      const token = signToken("operator");
      const res = await request(app)
        .post("/api/webhooks")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "test", webhook_url: "https://discord.com/api/webhooks/123" });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe("test");
    });

    test("returns 409 for duplicate webhook (23505)", async () => {
      pool.query.mockRejectedValue({ code: "23505" });
      const token = signToken("operator");
      const res = await request(app)
        .post("/api/webhooks")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "dup", webhook_url: "https://discord.com/api/webhooks/123" });
      expect(res.status).toBe(409);
    });
  });

  describe("GET /api/webhooks", () => {
    test("returns 401 without token", async () => {
      const res = await request(app).get("/api/webhooks");
      expect(res.status).toBe(401);
    });

    test("returns 200 for any authenticated user", async () => {
      pool.query.mockResolvedValue({ rows: [{ p_result: [{ id: 1, name: "wh1" }] }] });
      const token = signToken("viewer");
      const res = await request(app)
        .get("/api/webhooks")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe("GET /api/webhooks/:id", () => {
    test("returns 401 without token", async () => {
      const res = await request(app).get("/api/webhooks/1");
      expect(res.status).toBe(401);
    });

    test("returns 200 with webhook data", async () => {
      pool.query.mockResolvedValue({ rows: [{ p_result: { id: 1, name: "wh1" } }] });
      const token = signToken("operator");
      const res = await request(app)
        .get("/api/webhooks/1")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(1);
    });

    test("returns 404 if webhook not found", async () => {
      pool.query.mockResolvedValue({ rows: [{ p_result: null }] });
      const token = signToken("operator");
      const res = await request(app)
        .get("/api/webhooks/999")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/webhooks/:id", () => {
    test("returns 401 without token", async () => {
      const res = await request(app)
        .patch("/api/webhooks/1")
        .send({ name: "updated" });
      expect(res.status).toBe(401);
    });

    test("returns 200 on successful update", async () => {
      pool.query.mockResolvedValue({ rows: [{ p_result: { id: 1, name: "updated" } }] });
      const token = signToken("operator");
      const res = await request(app)
        .patch("/api/webhooks/1")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "updated" });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("updated");
    });

    test("returns 404 if webhook not found", async () => {
      pool.query.mockResolvedValue({ rows: [{ p_result: null }] });
      const token = signToken("operator");
      const res = await request(app)
        .patch("/api/webhooks/999")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "updated" });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/webhooks/:id", () => {
    test("returns 401 without token", async () => {
      const res = await request(app).delete("/api/webhooks/1");
      expect(res.status).toBe(401);
    });

    test("returns 204 on successful delete", async () => {
      pool.query.mockResolvedValue({ rows: [{}] });
      const token = signToken("operator");
      const res = await request(app)
        .delete("/api/webhooks/1")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(204);
    });
  });
});
