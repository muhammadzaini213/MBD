process.env.JWT_SECRET = "test-secret";

jest.mock("pg", () => {
  const mPool = { query: jest.fn(), connect: jest.fn(), end: jest.fn() };
  return { Pool: jest.fn(() => mPool) };
});

const request = require("supertest");

describe("Health Route", () => {
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

  describe("GET /health", () => {
    test("returns 200 when database is ok", async () => {
      pool.query.mockResolvedValue({ rows: [] });
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.database).toBe("ok");
      expect(res.body.time).toBeDefined();
    });

    test("returns 500 when database is down", async () => {
      pool.query.mockRejectedValue(new Error("Connection refused"));
      const res = await request(app).get("/health");
      expect(res.status).toBe(500);
      expect(res.body.error).toBe("Connection refused");
    });
  });

  describe("GET /", () => {
    test("returns API info", async () => {
      const res = await request(app).get("/");
      expect(res.status).toBe(200);
      expect(res.body.service).toBe("Discord Webhook Manager API");
      expect(res.body.version).toBe("1.0.0");
      expect(res.body.endpoints).toBeDefined();
    });
  });
});
