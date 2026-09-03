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

describe("Send Route", () => {
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

  describe("POST /api/send/:id/send", () => {
    test("returns 401 without token", async () => {
      const res = await request(app)
        .post("/api/send/1/send")
        .send({ content: "Hello" });
      expect(res.status).toBe(401);
    });

    test("returns 403 for viewer role", async () => {
      const token = signToken("viewer");
      const res = await request(app)
        .post("/api/send/1/send")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Hello" });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Insufficient permissions");
    });

    test("returns 403 for admin role", async () => {
      const token = signToken("admin");
      const res = await request(app)
        .post("/api/send/1/send")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Hello" });
      expect(res.status).toBe(403);
    });

    test("returns 201 for operator role", async () => {
      pool.query.mockResolvedValue({ rows: [{ p_result: { id: 1, status: "sent" } }] });
      const token = signToken("operator");
      const res = await request(app)
        .post("/api/send/1/send")
        .set("Authorization", `Bearer ${token}`)
        .send({ content: "Hello" });
      expect(res.status).toBe(201);
      expect(res.body.status).toBe("sent");
    });

    test("sends default payload if body is empty", async () => {
      pool.query.mockResolvedValue({ rows: [{ p_result: { id: 1, status: "sent" } }] });
      const token = signToken("operator");
      const res = await request(app)
        .post("/api/send/1/send")
        .set("Authorization", `Bearer ${token}`)
        .send();
      expect(res.status).toBe(201);
    });
  });
});
