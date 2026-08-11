import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitConfig {
  points: number;
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
}

const MEMORY_DEFAULT_CONFIG: RateLimitConfig = {
  points: 10,
  windowMs: 60 * 1000,
};

const ROUTE_CONFIGS: Record<string, RateLimitConfig> = {
  pipeline: { points: 5, windowMs: 60 * 1000 },
  "ai-chat": { points: 10, windowMs: 60 * 1000 },
  "ai-advice": { points: 15, windowMs: 60 * 1000 },
  "ai-stream": { points: 5, windowMs: 60 * 1000 },
  procedures: { points: 10, windowMs: 60 * 1000 },
  "procedures-executions": { points: 30, windowMs: 60 * 1000 },
  "q-r": { points: 10, windowMs: 60 * 1000 },
  "q-r-sync": { points: 20, windowMs: 60 * 1000 },
  "auth-login": { points: 5, windowMs: 60 * 1000 },
  "auth-refresh": { points: 10, windowMs: 60 * 1000 },
  "auth-me": { points: 30, windowMs: 60 * 1000 },
};

export function getRateLimitConfig(routeKey: string): RateLimitConfig {
  return ROUTE_CONFIGS[routeKey] ?? MEMORY_DEFAULT_CONFIG;
}

export function getClientIp(request: Request): string {
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const first = xForwardedFor.split(",")[0].trim();
    if (first) return first;
  }

  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }

  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) {
    return xRealIp.trim();
  }

  return "unknown";
}

const MAX_MEMORY_ENTRIES = 1000;

export class InMemoryLimiter {
  private store = new Map<string, { count: number; resetTime: number }>();

  private evictExpired(now: number): void {
    Array.from(this.store.entries()).forEach(([key, entry]) => {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    });
  }

  private enforceCapacity(): void {
    if (this.store.size > MAX_MEMORY_ENTRIES) {
      const now = Date.now();
      this.evictExpired(now);
      if (this.store.size > MAX_MEMORY_ENTRIES) {
        const excess = this.store.size - MAX_MEMORY_ENTRIES;
        const keys = Array.from(this.store.keys());
        for (let i = 0; i < excess; i++) {
          this.store.delete(keys[i]);
        }
      }
    }
  }

  async check(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const now = Date.now();
    this.evictExpired(now);

    const entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      this.store.set(key, { count: 1, resetTime: now + config.windowMs });
      return {
        success: true,
        remaining: config.points - 1,
        resetTime: now + config.windowMs,
      };
    }

    if (entry.count >= config.points) {
      return { success: false, remaining: 0, resetTime: entry.resetTime };
    }

    entry.count++;
    return {
      success: true,
      remaining: config.points - entry.count,
      resetTime: entry.resetTime,
    };
  }
}

let redisClient: Redis | null = null;
const redisLimiterCache = new Map<string, Ratelimit>();
const fallbackLimiter = new InMemoryLimiter();

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
  try {
    redisClient = new Redis({
      url: UPSTASH_REDIS_REST_URL,
      token: UPSTASH_REDIS_REST_TOKEN,
    });
  } catch {
    redisClient = null;
  }
}

function getOrCreateRedisLimiter(config: RateLimitConfig): Ratelimit | null {
  if (!redisClient) return null;

  const cacheKey = `${config.points}:${config.windowMs}`;
  const existing = redisLimiterCache.get(cacheKey);
  if (existing) return existing;

  const limiter = new Ratelimit({
    redis: redisClient,
    limiter: Ratelimit.slidingWindow(
      config.points,
      `${config.windowMs / 1000} s`,
    ),
  });
  redisLimiterCache.set(cacheKey, limiter);
  return limiter;
}

let warnedInMemory = false;

export async function rateLimit(
  identifier: string,
  routeKey: string = "default",
): Promise<RateLimitResult> {
  const config = getRateLimitConfig(routeKey);

  const redisLimiter = getOrCreateRedisLimiter(config);
  if (redisLimiter) {
    try {
      const result = await redisLimiter.limit(identifier);
      return {
        success: result.success,
        remaining: result.remaining,
        resetTime: Date.now() + config.windowMs,
      };
    } catch {
      // Fall through to in-memory fallback
    }
  }

  if (process.env.NODE_ENV === "production" && !warnedInMemory) {
    warnedInMemory = true;
    console.warn(
      "Rate limiting is using in-memory fallback. This is not shared across serverless instances. " +
        "Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for distributed rate limiting.",
    );
  }

  return fallbackLimiter.check(identifier, config);
}

export function getRateLimitHeaders(
  result: RateLimitResult,
): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetTime),
    "Retry-After": String(
      Math.max(1, Math.ceil((result.resetTime - Date.now()) / 1000)),
    ),
  };
}

export function tooManyResponses(result: RateLimitResult): Response {
  return new Response(
    JSON.stringify({ error: "Trop de requêtes. Réessayez plus tard." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(result.resetTime),
        "Retry-After": String(
          Math.max(1, Math.ceil((result.resetTime - Date.now()) / 1000)),
        ),
      },
    },
  );
}
