process.env.JWT_SECRET = "test-secret";

const request = require("supertest");

describe("Auth Routes", () => {
  let app, pool, bcrypt;

  beforeEach(() => {
    jest.resetModules();
    jest.mock("pg", () => {
      const mPool = { query: jest.fn(), connect: jest.fn(), end: jest.fn() };
      return { Pool: jest.fn(() => mPool) };
    });
    jest.mock("bcrypt", () => ({
      compare: jest.fn(),
      hash: jest.fn(),
    }));
    app = require("../app");
    pool = require("pg").Pool();
    bcrypt = require("bcrypt");
  });

  afterEach(() => jest.clearAllMocks());

  describe("POST /auth/login", () => {
    test("returns 400 if username is missing", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({ password: "12345678" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Username and password are required");
    });

    test("returns 400 if password is missing", async () => {
      const res = await request(app)
        .post("/auth/login")
        .send({ username: "testuser" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Username and password are required");
    });

    test("returns 401 if user not found", async () => {
      pool.query.mockResolvedValue({ rows: [{ p_result: null }] });
      const res = await request(app)
        .post("/auth/login")
        .send({ username: "nonexistent", password: "12345678" });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid username or password");
    });

    test("returns 401 if password does not match", async () => {
      pool.query.mockResolvedValue({
        rows: [{
          p_result: {
            id: 1, username: "testuser", role: "viewer",
            password_hash: "$2b$12$hashedpassword"
          }
        }]
      });
      bcrypt.compare.mockResolvedValue(false);

      const res = await request(app)
        .post("/auth/login")
        .send({ username: "testuser", password: "wrongpassword" });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Invalid username or password");
    });

    test("returns 200 with token on successful login", async () => {
      const mockUser = { id: 1, username: "testuser", role: "operator", password_hash: "$2b$12$hashedpassword" };
      pool.query.mockResolvedValue({ rows: [{ p_result: mockUser }] });
      bcrypt.compare.mockResolvedValue(true);

      const res = await request(app)
        .post("/auth/login")
        .send({ username: "testuser", password: "12345678" });
      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.password_hash).toBeUndefined();
      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toBe("testuser");
      expect(res.body.user.role).toBe("operator");
    });
  });

  describe("POST /auth/register", () => {
    test("returns 400 if required fields are missing", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ username: "newuser" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Username, email, and password are required");
    });

    test("returns 400 if password is too short", async () => {
      const res = await request(app)
        .post("/auth/register")
        .send({ username: "newuser", email: "a@b.com", password: "short" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Password must be at least 8 characters");
    });

    test("returns 201 with user and token on successful registration", async () => {
      const mockUser = { id: 2, username: "newuser", role: "viewer" };
      pool.query.mockResolvedValue({ rows: [{ p_result: mockUser }] });
      bcrypt.hash.mockResolvedValue("$2b$12$hashedpassword");

      const res = await request(app)
        .post("/auth/register")
        .send({ username: "newuser", email: "new@b.com", password: "12345678" });
      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.token).toBeDefined();
      expect(res.body.user.username).toBe("newuser");
    });

    test("returns 409 if username is taken", async () => {
      bcrypt.hash.mockResolvedValue("$2b$12$hashedpassword");
      pool.query.mockRejectedValue({ message: "USERNAME_TAKEN" });

      const res = await request(app)
        .post("/auth/register")
        .send({ username: "existing", email: "a@b.com", password: "12345678" });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe("Username already taken");
    });

    test("returns 409 if email is taken", async () => {
      bcrypt.hash.mockResolvedValue("$2b$12$hashedpassword");
      pool.query.mockRejectedValue({ message: "EMAIL_TAKEN" });

      const res = await request(app)
        .post("/auth/register")
        .send({ username: "newuser", email: "taken@b.com", password: "12345678" });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe("Email already registered");
    });
  });

  describe("POST /auth/forgot-password", () => {
    test("returns 400 if email is missing", async () => {
      const res = await request(app)
        .post("/auth/forgot-password")
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Email is required");
    });

    test("returns generic message even if user not found", async () => {
      pool.query.mockResolvedValue({ rows: [{ p_result: null }] });
      const res = await request(app)
        .post("/auth/forgot-password")
        .send({ email: "notfound@test.com" });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("If that email exists, a reset link has been sent.");
    });

    test("returns dev_token on success", async () => {
      pool.query.mockResolvedValue({ rows: [{ p_result: "ok" }] });
      const res = await request(app)
        .post("/auth/forgot-password")
        .send({ email: "user@test.com" });
      expect(res.status).toBe(200);
      expect(res.body.dev_token).toBeDefined();
    });
  });

  describe("POST /auth/reset-password", () => {
    test("returns 400 if token is missing", async () => {
      const res = await request(app)
        .post("/auth/reset-password")
        .send({ newPassword: "12345678" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Token and new password are required");
    });

    test("returns 400 if new password is too short", async () => {
      const res = await request(app)
        .post("/auth/reset-password")
        .send({ token: "abc", newPassword: "short" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Password must be at least 8 characters");
    });

    test("returns 400 if token is invalid", async () => {
      bcrypt.hash.mockResolvedValue("$2b$12$hashedpassword");
      pool.query.mockResolvedValue({ rows: [{ p_result: null }] });
      const res = await request(app)
        .post("/auth/reset-password")
        .send({ token: "invalidtoken", newPassword: "12345678" });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe("Invalid or expired token");
    });

    test("returns 200 on successful reset", async () => {
      bcrypt.hash.mockResolvedValue("$2b$12$hashedpassword");
      pool.query.mockResolvedValue({ rows: [{ p_result: "ok" }] });
      const res = await request(app)
        .post("/auth/reset-password")
        .send({ token: "validtoken", newPassword: "12345678" });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Password has been reset successfully.");
    });
  });
});
