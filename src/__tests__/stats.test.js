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

describe("Stats Route", () => {
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

  describe("GET /api/stats/:webhookId", () => {
    test("returns 401 without token", async () => {
      const res = await request(app).get("/api/stats/1");
      expect(res.status).toBe(401);
    });

    test("returns 200 with stats data", async () => {
      const mockStats = { total: 10, success: 8, failed: 2 };
      pool.query.mockResolvedValue({ rows: [{ p_result: mockStats }] });
      const token = signToken("operator");
      const res = await request(app)
        .get("/api/stats/1")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(10);
    });

    test("returns 404 if stats not found", async () => {
      pool.query.mockResolvedValue({ rows: [{ p_result: null }] });
      const token = signToken("operator");
      const res = await request(app)
        .get("/api/stats/999")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(404);
    });

    test("allows viewer to access stats", async () => {
      pool.query.mockResolvedValue({ rows: [{ p_result: { total: 5 } }] });
      const token = signToken("viewer");
      const res = await request(app)
        .get("/api/stats/1")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });
});
