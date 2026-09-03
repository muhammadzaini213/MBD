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

describe("Deliveries Route", () => {
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

  describe("GET /api/deliveries/:webhookId", () => {
    test("returns 401 without token", async () => {
      const res = await request(app).get("/api/deliveries/1");
      expect(res.status).toBe(401);
    });

    test("returns 200 with delivery history", async () => {
      const mockDeliveries = [
        { id: 1, webhook_id: 1, status: "sent" },
        { id: 2, webhook_id: 1, status: "failed" },
      ];
      pool.query.mockResolvedValue({ rows: [{ p_result: mockDeliveries }] });
      const token = signToken("operator");
      const res = await request(app)
        .get("/api/deliveries/1")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
    });

    test("allows viewer to access deliveries", async () => {
      pool.query.mockResolvedValue({ rows: [{ p_result: [] }] });
      const token = signToken("viewer");
      const res = await request(app)
        .get("/api/deliveries/1")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
    });
  });
});
