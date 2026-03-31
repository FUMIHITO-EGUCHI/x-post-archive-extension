export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContextValue = string | number | boolean | null;
export type LogContext = Record<string, LogContextValue>;

export type LogRecord = {
  log_id: string;
  level: LogLevel;
  scope: string;
  event: string;
  message: string | null;
  context: LogContext;
  request_id: string | null;
  created_at: number;
};

export type LogListFilter = {
  level?: LogLevel | null;
  levels?: LogLevel[] | null;
  from?: number | null;
  to?: number | null;
  limit?: number;
};
