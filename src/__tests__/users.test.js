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

describe("Users Routes", () => {
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

  describe("GET /api/users", () => {
    test("returns 401 without token", async () => {
      const res = await request(app).get("/api/users");
      expect(res.status).toBe(401);
    });

    test("returns 403 for viewer role", async () => {
      const token = signToken("viewer");
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Insufficient permissions");
    });

    test("returns 403 for operator role", async () => {
      const token = signToken("operator");
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toBe("Insufficient permissions");
    });

    test("returns 200 with user list for admin", async () => {
      const mockUsers = [
        { id: 1, username: "admin", role: "admin" },
        { id: 2, username: "user1", role: "viewer" },
      ];
      pool.query.mockResolvedValue({ rows: [{ p_result: mockUsers }] });
      const token = signToken("admin");
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockUsers);
    });
  });

  describe("PATCH /api/users/:id/role", () => {
    test("returns 401 without token", async () => {
      const res = await request(app)
        .patch("/api/users/2/role")
        .send({ role: "operator" });
      expect(res.status).toBe(401);
    });

    test("returns 403 for non-admin role", async () => {
      const token = signToken("operator");
      const res = await request(app)
        .patch("/api/users/2/role")
        .set("Authorization", `Bearer ${token}`)
        .send({ role: "viewer" });
      expect(res.status).toBe(403);
    });

    test("returns 400 for invalid role", async () => {
      const token = signToken("admin");
      const res = await request(app)
        .patch("/api/users/2/role")
        .set("Authorization", `Bearer ${token}`)
        .send({ role: "superuser" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid role");
    });

    test("returns 200 on successful role upgrade by admin", async () => {
      pool.query.mockResolvedValue({ rows: [{ p_result: { id: 2, username: "user1", role: "operator" } }] });
      const token = signToken("admin");
      const res = await request(app)
        .patch("/api/users/2/role")
        .set("Authorization", `Bearer ${token}`)
        .send({ role: "operator" });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe("operator");
    });

    test("returns 404 if user not found", async () => {
      pool.query.mockResolvedValue({ rows: [{ p_result: null }] });
      const token = signToken("admin");
      const res = await request(app)
        .patch("/api/users/999/role")
        .set("Authorization", `Bearer ${token}`)
        .send({ role: "operator" });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("User not found");
    });
  });
});
