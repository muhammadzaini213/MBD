process.env.JWT_SECRET = "test-secret";

jest.mock("pg", () => {
  const mPool = { query: jest.fn(), connect: jest.fn(), end: jest.fn() };
  return { Pool: jest.fn(() => mPool) };
});

jest.mock("bcrypt", () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

function signToken(payload) {
  return jwt.sign(payload, "test-secret", { expiresIn: "15m" });
}

describe("verifyToken middleware", () => {
  let req, res, next, verifyToken;

  beforeEach(() => {
    req = { headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    const auth = require("../middleware/auth");
    verifyToken = auth.verifyToken;
  });

  afterEach(() => jest.clearAllMocks());

  test("rejects request without Authorization header", () => {
    verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Missing or invalid Authorization header" });
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects request with non-Bearer token", () => {
    req.headers.authorization = "Basic abc123";
    verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects invalid token", () => {
    req.headers.authorization = "Bearer invalidtoken";
    verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid or expired token" });
    expect(next).not.toHaveBeenCalled();
  });

  test("rejects expired token", () => {
    const expiredToken = jwt.sign({ sub: 1, role: "viewer" }, "test-secret", { expiresIn: "0s" });
    req.headers.authorization = `Bearer ${expiredToken}`;
    verifyToken(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("accepts valid token and sets req.user", () => {
    const payload = { sub: 1, username: "testuser", role: "admin" };
    const token = signToken(payload);
    req.headers.authorization = `Bearer ${token}`;
    verifyToken(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.sub).toBe(1);
    expect(req.user.username).toBe("testuser");
    expect(req.user.role).toBe("admin");
  });
});

describe("requireRole middleware", () => {
  let req, res, next, requireRole;

  beforeEach(() => {
    req = {};
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
    const auth = require("../middleware/auth");
    requireRole = auth.requireRole;
  });

  afterEach(() => jest.clearAllMocks());

  test("returns 403 if req.user is not set", () => {
    const mw = requireRole("admin");
    mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Insufficient permissions" });
    expect(next).not.toHaveBeenCalled();
  });

  test("returns 403 if user role does not match", () => {
    req.user = { role: "viewer" };
    const mw = requireRole("admin");
    mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("allows access if user role matches", () => {
    req.user = { role: "admin" };
    const mw = requireRole("admin");
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test("allows access if user role is in multiple allowed roles", () => {
    req.user = { role: "operator" };
    const mw = requireRole("admin", "operator");
    mw(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test("denies access if user role is not in multiple allowed roles", () => {
    req.user = { role: "viewer" };
    const mw = requireRole("admin", "operator");
    mw(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
