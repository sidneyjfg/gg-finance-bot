type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, message: string, meta?: any) {
  const timestamp = new Date().toISOString();
  console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}`, meta || "");
}

export const logger = {
  info: (msg: string, meta?: any) => log("info", msg, meta),
  warn: (msg: string, meta?: any) => log("warn", msg, meta),
  error: (msg: string, meta?: any) => log("error", msg, meta),
};
