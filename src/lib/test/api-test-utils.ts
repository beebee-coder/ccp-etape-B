import { NextResponse } from "next/server";

export const SMALL_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

export const MOCK_USER = {
  sub: "user-1",
  role: "chef_de_quart",
  firstName: "Test",
  lastName: "User",
};

export function createMockRequest(
  url: string,
  options: RequestInit = {}
): Request {
  const opts: RequestInit = {
    headers: {
      "content-type": "application/json",
      cookie: "auth_token=mock-token",
      ...options.headers,
    },
    ...options,
  };
  return new Request(url, opts);
}

export function jsonBody(data: unknown): RequestInit {
  return {
    body: JSON.stringify(data),
    headers: { "content-type": "application/json" },
  };
}
