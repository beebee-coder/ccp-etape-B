import { toast } from "sonner";
import { getCsrfTokenClient } from "@/lib/auth/cookies";

interface ApiClientConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
  onTokenRefresh?: () => Promise<string | null>;
  onAuthError?: () => void;
  retryAttempts?: number;
  retryDelay?: number;
}

export class ApiError extends Error {
  status: number;
  body?: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

class ApiClient {
  private baseUrl: string;
  private headers: Record<string, string>;
  private onTokenRefresh: (() => Promise<string | null>) | null;
  private onAuthError: (() => void) | null;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? "";
    this.headers = config.headers ?? {};
    this.onTokenRefresh = config.onTokenRefresh ?? null;
    this.onAuthError = config.onAuthError ?? null;
    this.retryAttempts = config.retryAttempts ?? 2;
    this.retryDelay = config.retryDelay ?? 1000;
  }

  private async getAuthToken(): Promise<string | null> {
    try {
      const token = localStorage.getItem("auth_token");
      if (token) return token;
    } catch {
      // localStorage unavailable (SSR)
    }
    return null;
  }

  private getCsrfToken(): string | null {
    const fromCookie = getCsrfTokenClient();
    if (fromCookie) return fromCookie;
    try {
      return localStorage.getItem("csrf_token");
    } catch {
      return null;
    }
  }

  private MUTATION_METHODS = new Set(["POST", "PUT", "DELETE", "PATCH"]);

  private buildHeaders(
    method: string,
    options: RequestInit,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.headers,
      ...((options.headers as Record<string, string>) ?? {}),
    };

    const csrfToken = this.getCsrfToken();
    if (csrfToken && this.MUTATION_METHODS.has(method.toUpperCase())) {
      headers["x-csrf-token"] = csrfToken;
    }

    return headers;
  }

  private async refreshToken(): Promise<string | null> {
    if (!this.onTokenRefresh) return null;
    try {
      const newToken = await this.onTokenRefresh();
      if (newToken) {
        try {
          localStorage.setItem("auth_token", newToken);
        } catch {
          // localStorage unavailable
        }
      }
      return newToken;
    } catch {
      return null;
    }
  }

  private buildUrl(url: string): string {
    if (url.startsWith("http")) return url;
    if (!this.baseUrl) return url;
    const resolved = `${this.baseUrl}${url}`;
    try {
      const currentOrigin = typeof window !== "undefined" ? window.location.origin : "";
      const resolvedUrl = new URL(resolved);
      if (currentOrigin && resolvedUrl.origin !== currentOrigin) {
        return url;
      }
    } catch {
      // invalid URL, fall through
    }
    return resolved;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      let message = `Erreur HTTP ${response.status}`;
      try {
        const body = await response.json();
        message =
          (body as { error?: string; message?: string }).error ??
          (body as { error?: string; message?: string }).message ??
          message;
      } catch {
        // ignore JSON parse error
      }
      throw new ApiError(response.status, message);
    }

    if (response.status === 204) return undefined as T;
    const body = (await response.json()) as T | { data: T; error?: string };
    if (typeof body === "object" && body !== null && "data" in body) {
      return (body as { data: T }).data;
    }
    return body as T;
  }

  private async request<T>(
    method: string,
    url: string,
    options: RequestInit,
    attempt = 1,
    authRetried = false,
  ): Promise<T> {
    const token = await this.getAuthToken();
    const headers = this.buildHeaders(method, options);
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const resolvedUrl = url ? this.buildUrl(url) : this.baseUrl;

    let response: Response;
    try {
      response = await fetch(resolvedUrl, {
        ...options,
        method,
        headers,
      });
    } catch (error) {
      if (attempt <= this.retryAttempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.retryDelay * attempt),
        );
        return this.request<T>(method, url, options, attempt + 1, authRetried);
      }

      if (error instanceof TypeError && error.message === "Failed to fetch") {
        throw new ApiError(
          0,
          "Impossible de joindre le serveur. Vérifiez votre connexion.",
        );
      }
      throw new ApiError(
        0,
        error instanceof Error ? error.message : "Erreur inconnue",
      );
    }

    if (response.status === 401) {
      const newToken = await this.refreshToken();
      if (newToken && !authRetried) {
        return this.request<T>(method, url, options, attempt, true);
      }
      this.onAuthError?.();
      throw new ApiError(401, "Session expirée. Veuillez vous reconnecter.");
    }

    return this.handleResponse<T>(response);
  }

  async get<T>(url: string, options?: RequestInit): Promise<T> {
    return this.request<T>("GET", url, options ?? {});
  }

  async post<T>(
    url: string,
    body?: unknown,
    options?: RequestInit,
  ): Promise<T> {
    return this.request<T>("POST", url, {
      ...options,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(url: string, body?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>("PUT", url, {
      ...options,
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(url: string, options?: RequestInit): Promise<T> {
    return this.request<T>("DELETE", url, options ?? {});
  }

  async patch<T>(
    url: string,
    body?: unknown,
    options?: RequestInit,
  ): Promise<T> {
    return this.request<T>("PATCH", url, {
      ...options,
      body: body ? JSON.stringify(body) : undefined,
    });
  }
}

export const apiClient = new ApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "",
  onTokenRefresh: async () => {
    try {
      const res = await fetch("/api/auth/refresh", { method: "POST" });
      if (!res.ok) return null;
      const data = await res.json();
      return data.token ?? null;
    } catch {
      return null;
    }
  },
  onAuthError: () => {
    toast.error("Votre session a expiré. Veuillez vous reconnecter.");
    window.location.href = "/login";
  },
});

export { ApiClient };
