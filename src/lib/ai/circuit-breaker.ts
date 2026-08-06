type CircuitState = "closed" | "open" | "half-open";

interface CircuitOptions {
  threshold: number;
  resetTimeMs: number;
  halfOpenMaxCalls: number;
}

interface CircuitStats {
  failures: number;
  successes: number;
  lastFailureTime: number;
  state: CircuitState;
}

export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private halfOpenCalls = 0;

  constructor(private readonly options: CircuitOptions) {}

  async execute<T>(fn: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    if (this.state === "open") {
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeMs) {
        this.state = "half-open";
        this.halfOpenCalls = 0;
      } else {
        return fallback();
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch {
      this.onFailure();
      return fallback();
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    if (this.state === "half-open") {
      this.successes++;
      if (this.successes >= this.options.halfOpenMaxCalls) {
        this.state = "closed";
        this.successes = 0;
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.state === "half-open") {
      this.state = "open";
      this.halfOpenCalls = 0;
      this.successes = 0;
    } else if (this.failures >= this.options.threshold) {
      this.state = "open";
    }
  }

  getStats(): CircuitStats {
    return {
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      state: this.state,
    };
  }
}
