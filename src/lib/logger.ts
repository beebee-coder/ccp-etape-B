type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configuredLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || "info";

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[configuredLevel];
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      message: value.message,
      stack: value.stack,
      name: value.name,
    };
  }
  if (typeof value === "object" && value !== null) {
    try {
      JSON.stringify(value);
      return value;
    } catch {
      return String(value);
    }
  }
  return value;
}

function buildEntry(level: LogLevel, message: string, context?: LogContext): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context && Object.keys(context).length > 0) {
    entry.context = {};
    for (const key of Object.keys(context)) {
      entry.context[key] = serializeValue(context[key]);
    }
  }

  return entry;
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return;

  const entry = buildEntry(level, message, context);

  if (process.env.NODE_ENV === "production") {
    const line = JSON.stringify(entry);
    if (level === "error" || level === "warn") {
      console.error(line);
    } else {
      console.log(line);
    }
  } else {
    const ctx = context && Object.keys(context).length > 0 ? context : undefined;
    const label: Record<LogLevel, string> = {
      debug: "\x1b[36mDEBUG\x1b[0m",
      info: "\x1b[32mINFO\x1b[0m",
      warn: "\x1b[33mWARN\x1b[0m",
      error: "\x1b[31mERROR\x1b[0m",
    };
    const prefix = `[${label[level]}]`;
    if (ctx) {
      console.log(`${prefix} ${entry.timestamp} ${message}`, ctx);
    } else {
      console.log(`${prefix} ${entry.timestamp} ${message}`);
    }
  }
}

export interface AuthLogger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
}

export function createLogger(defaultContext?: LogContext): AuthLogger {
  const base: LogContext = defaultContext ?? {};

  return {
    debug(message: string, context?: LogContext): void {
      emit("debug", message, { ...base, ...context });
    },
    info(message: string, context?: LogContext): void {
      emit("info", message, { ...base, ...context });
    },
    warn(message: string, context?: LogContext): void {
      emit("warn", message, { ...base, ...context });
    },
    error(message: string, context?: LogContext): void {
      emit("error", message, { ...base, ...context });
    },
  };
}

export const logger = createLogger();

export type { LogLevel };
