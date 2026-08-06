/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";
import { AUTH_COOKIE_ACCESS, AUTH_COOKIE_REFRESH, CSRF_COOKIE_NAME } from "@/lib/auth/cookies";

vi.mock("@/lib/auth/jwt", () => ({
  verifyToken: vi.fn(),
}));

import { verifyToken } from "@/lib/auth/jwt";

const VALID_PAYLOAD = { sub: "user-1", role: "admin" };

function makeRequest(url: string, cookieHeader?: string, authHeader?: string, method = "GET") {
  const headers: Record<string, string> = {};
  if (cookieHeader) {
    headers.cookie = cookieHeader;
  }
  if (authHeader) {
    headers.authorization = authHeader;
  }
  return new NextRequest(url, { method, headers: headers as HeadersInit });
}

const accessCookie = (token: string) => `${AUTH_COOKIE_ACCESS}=${token}`;
const refreshCookie = (token: string) => `${AUTH_COOKIE_REFRESH}=${token}`;

function isContinuation(res: Response) {
  return res.status === 200 && res.headers.get("location") === null;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("middleware — public API routes are not blocked", () => {
  const publicRoutes = [
    "http://localhost:3000/api/auth/login",
    "http://localhost:3000/api/auth/refresh",
    "http://localhost:3000/api/auth/logout",
    "http://localhost:3000/api/health",
    "http://localhost:3000/api/openapi",
  ];

  for (const url of publicRoutes) {
    it(`lets ${url.replace("http://localhost:3000", "")} through without credentials`, async () => {
      const req = makeRequest(url);
      const res = await middleware(req);

      expect(isContinuation(res)).toBe(true);
      expect(verifyToken).not.toHaveBeenCalled();
    });

    it(`lets ${url.replace("http://localhost:3000", "")} through even with an invalid token`, async () => {
      vi.mocked(verifyToken).mockResolvedValue(null);
      const req = makeRequest(
        url,
        `${accessCookie("expired")}; ${refreshCookie("expired")}`
      );

      const res = await middleware(req);

      expect(isContinuation(res)).toBe(true);
    });
  }
});

describe("middleware — private API routes require authentication", () => {
  it("returns 401 when no credentials are provided", async () => {
    const req = makeRequest("http://localhost:3000/api/images");

    const res = await middleware(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Authentification requise");
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it("returns 401 for an invalid access token cookie", async () => {
    vi.mocked(verifyToken).mockResolvedValue(null);
    const req = makeRequest("http://localhost:3000/api/images", accessCookie("invalid"));

    const res = await middleware(req);

    expect(res.status).toBe(401);
  });

  it("returns 401 for an invalid bearer token", async () => {
    vi.mocked(verifyToken).mockResolvedValue(null);
    const req = makeRequest("http://localhost:3000/api/images", undefined, "Bearer invalid");

    const res = await middleware(req);

    expect(res.status).toBe(401);
    expect(verifyToken).toHaveBeenCalledWith("invalid");
  });

  it("passes through with a valid access token cookie", async () => {
    vi.mocked(verifyToken).mockResolvedValue(VALID_PAYLOAD);
    const req = makeRequest("http://localhost:3000/api/images", accessCookie("access-valid"));

    const res = await middleware(req);

    expect(isContinuation(res)).toBe(true);
    expect(verifyToken).toHaveBeenCalledWith("access-valid");
  });

  it("passes through with a valid bearer token", async () => {
    vi.mocked(verifyToken).mockResolvedValue(VALID_PAYLOAD);
    const req = makeRequest("http://localhost:3000/api/images", undefined, "Bearer bearer-valid");

    const res = await middleware(req);

    expect(isContinuation(res)).toBe(true);
    expect(verifyToken).toHaveBeenCalledWith("bearer-valid");
  });

  it("rejects a refresh token alone for a private API route", async () => {
    vi.mocked(verifyToken).mockResolvedValue(VALID_PAYLOAD);
    const req = makeRequest("http://localhost:3000/api/images", refreshCookie("refresh-valid"));

    const res = await middleware(req);

    expect(res.status).toBe(401);
  });
});

describe("middleware — page / dashboard routes redirect to login when unauthenticated", () => {
  it("redirects unauthenticated /admin to /login", async () => {
    const req = makeRequest("http://localhost:3000/admin");

    const res = await middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/login\?callbackUrl=%2Fadmin$/);
  });

  it("redirects unauthenticated dashboard route /actions-ia to /login", async () => {
    const req = makeRequest("http://localhost:3000/actions-ia");

    const res = await middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/login\?callbackUrl=%2Factions-ia$/);
  });

  it("passes through with a valid access token cookie", async () => {
    vi.mocked(verifyToken).mockResolvedValue(VALID_PAYLOAD);
    const req = makeRequest("http://localhost:3000/actions-ia", accessCookie("access-valid"));

    const res = await middleware(req);

    expect(isContinuation(res)).toBe(true);
    expect(verifyToken).toHaveBeenCalledWith("access-valid");
  });

  it("stays alive with a valid refresh token cookie (access token may have rotated)", async () => {
    vi.mocked(verifyToken).mockResolvedValue(VALID_PAYLOAD);
    const req = makeRequest("http://localhost:3000/actions-ia", refreshCookie("refresh-valid"));

    const res = await middleware(req);

    expect(isContinuation(res)).toBe(true);
    expect(verifyToken).toHaveBeenCalledWith("refresh-valid");
  });

  it("does not protect the /login page", async () => {
    const req = makeRequest("http://localhost:3000/login");

    const res = await middleware(req);

    expect(isContinuation(res)).toBe(true);
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it("does not protect the public root /", async () => {
    const req = makeRequest("http://localhost:3000/");

    const res = await middleware(req);

    expect(isContinuation(res)).toBe(true);
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it("does not protect /contact", async () => {
    const req = makeRequest("http://localhost:3000/contact");

    const res = await middleware(req);

    expect(isContinuation(res)).toBe(true);
  });
});

describe("middleware — CSRF protection on mutations", () => {
   it("allows POST with valid CSRF token", async () => {
     vi.mocked(verifyToken).mockResolvedValue(VALID_PAYLOAD);
     const csrfToken = "csrf-valid";
     const req = makeRequest(
       "http://localhost:3000/api/procedures",
       `${accessCookie("valid")}; ${CSRF_COOKIE_NAME}=${csrfToken}`,
       undefined,
       "POST",
     );
     req.headers.set("x-csrf-token", csrfToken);

     const res = await middleware(req);

     expect(isContinuation(res)).toBe(true);
   });

   it("returns 403 on POST without CSRF token", async () => {
     vi.mocked(verifyToken).mockResolvedValue(VALID_PAYLOAD);
     const req = makeRequest("http://localhost:3000/api/procedures", accessCookie("valid"), undefined, "POST");

     const res = await middleware(req);

     expect(res.status).toBe(403);
   });

   it("returns 403 on POST with mismatched CSRF token", async () => {
     vi.mocked(verifyToken).mockResolvedValue(VALID_PAYLOAD);
     const req = makeRequest("http://localhost:3000/api/procedures", `${accessCookie("valid")}; ${CSRF_COOKIE_NAME}=token-a`, undefined, "POST");
     req.headers.set("x-csrf-token", "token-b");

     const res = await middleware(req);

     expect(res.status).toBe(403);
   });

   it("does not check CSRF on GET requests", async () => {
     vi.mocked(verifyToken).mockResolvedValue(VALID_PAYLOAD);
     const req = makeRequest("http://localhost:3000/api/procedures", accessCookie("valid"), undefined, "GET");

     const res = await middleware(req);

     expect(isContinuation(res)).toBe(true);
   });
 });

 describe("middleware — CORS headers on API routes", () => {
   it("adds Access-Control-Allow-Origin on GET to public API route", async () => {
     const req = makeRequest("http://localhost:3000/api/health");
     req.headers.set("origin", "http://localhost:3000");

     const res = await middleware(req);

     expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
   });

   it("adds CORS headers on OPTIONS preflight for API route", async () => {
     const req = makeRequest("http://localhost:3000/api/images", undefined, undefined, "OPTIONS");
     req.headers.set("origin", "http://localhost:3000");

     const res = await middleware(req);

     expect(res.status).toBe(200);
     expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
     expect(res.headers.get("access-control-allow-methods")).toBe("GET, POST, PUT, DELETE, PATCH, OPTIONS");
     expect(res.headers.get("access-control-allow-headers")).toBe("Content-Type, Authorization, x-csrf-token");
   });

   it("adds CORS headers on 401 response for protected API route", async () => {
     const req = makeRequest("http://localhost:3000/api/images");
     req.headers.set("origin", "http://localhost:3000");

     const res = await middleware(req);

     expect(res.status).toBe(401);
     expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
   });
 });
