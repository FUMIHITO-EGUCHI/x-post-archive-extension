import { useEffect, useState } from "react";
import { listLogRecords } from "../../../db/repositories/logs-repository";
import type { LogLevel, LogRecord } from "../../../types/logger";
import { createLogger } from "../../logging/logger";
import type { ArchiveLanguage } from "../../settings/archive-language";

const LOG_LIMIT = 200;
const LOG_LEVEL_OPTIONS: LogLevel[] = ["debug", "info", "warn", "error"];
const viewerLogger = createLogger("viewer-settings");

export function SettingsLogPanel({ language }: { language: ArchiveLanguage }) {
  const isJapanese = language === "ja";
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>([]);
  const [fromValue, setFromValue] = useState("");
  const [toValue, setToValue] = useState("");
  const [logs, setLogs] = useState<LogRecord[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [includeMessage, setIncludeMessage] = useState(true);
  const [includeContext, setIncludeContext] = useState(true);
  const [includeRequestId, setIncludeRequestId] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadLogs() {
      setStatus("loading");
      setNotice(null);

      try {
        const records = await listLogRecords({
          levels: selectedLevels.length === 0 ? null : selectedLevels,
          from: parseDateFilterValue(fromValue),
          to: parseDateFilterValue(toValue, "end"),
          limit: LOG_LIMIT
        });

        if (!cancelled) {
          setLogs(records);
          setStatus("ready");
        }
      } catch (error) {
        viewerLogger.error("logs.list.failed", {
          message: "Failed to load logs for settings view.",
          context: {
            error,
            selectedLevels: selectedLevels.join(","),
            fromValue,
            toValue
          }
        });

        if (!cancelled) {
          setLogs([]);
          setStatus("ready");
          setNotice(isJapanese ? "ログを読み込めませんでした。" : "Logs could not be loaded.");
        }
      }
    }

    void loadLogs();

    return () => {
      cancelled = true;
    };
  }, [fromValue, isJapanese, selectedLevels, toValue]);

  return (
    <section className="viewer-settings-card">
      <div className="viewer-settings-card-header">
        <h3>{isJapanese ? "アプリログ" : "App logs"}</h3>
        <p>
          {isJapanese
            ? "保存されたログを種類と期間で絞り込みます。最新 200 件まで表示します。"
            : "Filter persistent logs by type and time range. The latest 200 matching records are shown."}
        </p>
      </div>

      <div className="viewer-log-filters" aria-label="Log filters">
        <div className="viewer-sort-label">
          <span>{isJapanese ? "種類" : "Type"}</span>
          <div
            className="viewer-log-export-options viewer-log-level-options"
            role="group"
            aria-label="Log levels"
          >
            {LOG_LEVEL_OPTIONS.map((level) => (
              <label className="viewer-log-export-option" key={level}>
                <input
                  type="checkbox"
                  checked={selectedLevels.includes(level)}
                  onChange={() => {
                    setSelectedLevels((current) =>
                      current.includes(level)
                        ? current.filter((item) => item !== level)
                        : [...current, level]
                    );
                  }}
                />
                <span>{formatLevelLabel(level)}</span>
              </label>
            ))}
          </div>
        </div>

        <label className="viewer-sort-label">
          <span>{isJapanese ? "開始" : "From"}</span>
          <input
            className="viewer-log-date-input"
            type="datetime-local"
            value={fromValue}
            onChange={(event) => {
              setFromValue(event.currentTarget.value);
            }}
          />
        </label>

        <label className="viewer-sort-label">
          <span>{isJapanese ? "終了" : "To"}</span>
          <input
            className="viewer-log-date-input"
            type="datetime-local"
            value={toValue}
            onChange={(event) => {
              setToValue(event.currentTarget.value);
            }}
          />
        </label>

        <button
          className="viewer-log-clear-button"
          type="button"
          onClick={() => {
            setSelectedLevels([]);
            setFromValue("");
            setToValue("");
          }}
        >
          {isJapanese ? "クリア" : "Clear"}
        </button>
      </div>

      <div className="viewer-log-export-panel">
        <div className="viewer-log-export-copy">
          <strong>{isJapanese ? "エクスポート" : "Export"}</strong>
          <span>
            {isJapanese
              ? "現在の絞り込み結果を出力します。ファイルに含める項目を選べます。"
              : "Exports the currently filtered logs. Choose which fields to include in the file."}
          </span>
        </div>
        <div className="viewer-log-export-options" role="group" aria-label="Log export fields">
          <label className="viewer-log-export-option">
            <input
              type="checkbox"
              checked={includeMessage}
              onChange={(event) => {
                setIncludeMessage(event.currentTarget.checked);
              }}
            />
            <span>Message</span>
          </label>
          <label className="viewer-log-export-option">
            <input
              type="checkbox"
              checked={includeContext}
              onChange={(event) => {
                setIncludeContext(event.currentTarget.checked);
              }}
            />
            <span>Context</span>
          </label>
          <label className="viewer-log-export-option">
            <input
              type="checkbox"
              checked={includeRequestId}
              onChange={(event) => {
                setIncludeRequestId(event.currentTarget.checked);
              }}
            />
            <span>Request ID</span>
          </label>
        </div>
        <button
          className="viewer-log-export-button"
          type="button"
          disabled={logs.length === 0}
          onClick={() => {
            try {
              exportLogsAsJson(logs, {
                includeMessage,
                includeContext,
                includeRequestId,
                selectedLevels,
                fromValue,
                toValue
              });
            } catch (error) {
              viewerLogger.error("logs.export.failed", {
                message: "Failed to export logs from settings view.",
                context: {
                  error,
                  selectedLevels: selectedLevels.join(","),
                  fromValue,
                  toValue
                }
              });
              setNotice(isJapanese ? "ログの書き出しに失敗しました。" : "Log export failed.");
            }
          }}
        >
          {isJapanese ? "JSON を書き出す" : "Export JSON"}
        </button>
      </div>

      {status === "loading" && (
        <p className="viewer-message">{isJapanese ? "ログを読み込み中..." : "Loading logs..."}</p>
      )}
      {notice !== null && <p className="viewer-message viewer-message-error">{notice}</p>}
      {status === "ready" && logs.length === 0 && (
        <p className="viewer-message">
          {isJapanese ? "現在の条件に一致するログはありません。" : "No logs matched the current filters."}
        </p>
      )}

      {logs.length > 0 && (
        <div className="viewer-log-list" role="list" aria-label="Persistent application logs">
          {logs.map((log) => (
            <article className="viewer-log-item" key={log.log_id} role="listitem">
              <div className="viewer-log-item-header">
                <div className="viewer-log-item-meta">
                  <span className={`viewer-log-level viewer-log-level-${log.level}`}>
                    {log.level.toUpperCase()}
                  </span>
                  <time dateTime={new Date(log.created_at).toISOString()}>
                    {formatLogDate(log.created_at)}
                  </time>
                </div>
                {log.request_id !== null && (
                  <span className="viewer-log-request-id">req {shortenId(log.request_id)}</span>
                )}
              </div>

              <p className="viewer-log-event">
                <strong>{log.event}</strong>
                <span>{log.scope}</span>
              </p>

              {log.message !== null && <p className="viewer-log-message">{log.message}</p>}

              {Object.keys(log.context).length > 0 && (
                <dl className="viewer-log-context">
                  {Object.entries(log.context).map(([key, value]) => (
                    <div className="viewer-log-context-item" key={`${log.log_id}-${key}`}>
                      <dt>{key}</dt>
                      <dd>{formatContextValue(value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function parseDateFilterValue(value: string, boundary: "start" | "end" = "start"): number | null {
  if (value.trim() === "") {
    return null;
  }

  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return null;
  }

  return boundary === "end" ? timestamp + 59_999 : timestamp;
}

function formatLogDate(value: number): string {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "medium"
  }).format(value);
}

function shortenId(value: string): string {
  return value.slice(0, 8);
}

function formatContextValue(value: string | number | boolean | null): string {
  if (value === null) {
    return "null";
  }

  return String(value);
}

function formatLevelLabel(level: LogLevel): string {
  switch (level) {
    case "debug":
      return "Debug";
    case "info":
      return "Info";
    case "warn":
      return "Warn";
    case "error":
      return "Error";
  }
}

function exportLogsAsJson(
  logs: LogRecord[],
  options: {
    includeMessage: boolean;
    includeContext: boolean;
    includeRequestId: boolean;
    selectedLevels: LogLevel[];
    fromValue: string;
    toValue: string;
  }
): void {
  const exportedLogs = logs.map((log) => {
    const baseRecord: Record<string, unknown> = {
      created_at: new Date(log.created_at).toISOString(),
      level: log.level,
      scope: log.scope,
      event: log.event
    };

    if (options.includeMessage) {
      baseRecord.message = log.message;
    }

    if (options.includeContext) {
      baseRecord.context = log.context;
    }

    if (options.includeRequestId) {
      baseRecord.request_id = log.request_id;
    }

    return baseRecord;
  });

  const payload = {
    exported_at: new Date().toISOString(),
    filters: {
      levels: options.selectedLevels.length === 0 ? null : options.selectedLevels,
      from: options.fromValue === "" ? null : options.fromValue,
      to: options.toValue === "" ? null : options.toValue
    },
    fields: {
      include_message: options.includeMessage,
      include_context: options.includeContext,
      include_request_id: options.includeRequestId
    },
    records: exportedLogs
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `x-post-archive-logs-${new Date().toISOString().replaceAll(":", "-")}.json`;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
