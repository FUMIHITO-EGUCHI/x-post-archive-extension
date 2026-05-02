import { useEffect, useState } from "react";
import { requestThreadExpandAuthStaleCheck } from "../../runtime/client";
import type { ArchiveLanguage } from "../../settings/archive-language";

const AUTH_STALE_NOTICE_DISMISSED_KEY = "xpa-template-stale-notice-dismissed";
const AUTH_STALE_NOTICE_POLL_MS = 60_000;

type AuthStaleState = {
  hasAuthStaleItems: boolean;
  count: number;
};

export function TemplateStaleNotice({
  language
}: {
  language: ArchiveLanguage;
}) {
  const [authStaleState, setAuthStaleState] = useState<AuthStaleState | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return window.sessionStorage.getItem(AUTH_STALE_NOTICE_DISMISSED_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const nextState = await requestThreadExpandAuthStaleCheck();

        if (cancelled) {
          return;
        }

        setAuthStaleState(nextState);

        if (!nextState.hasAuthStaleItems) {
          setDismissed(false);

          try {
            window.sessionStorage.removeItem(AUTH_STALE_NOTICE_DISMISSED_KEY);
          } catch {
            // Ignore storage access failures; visibility still follows runtime state.
          }
        }
      } catch {
        if (!cancelled) {
          setAuthStaleState((current) => current ?? { hasAuthStaleItems: false, count: 0 });
        }
      }
    }

    void refresh();
    const intervalId = window.setInterval(() => {
      void refresh();
    }, AUTH_STALE_NOTICE_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  if (authStaleState === null || !authStaleState.hasAuthStaleItems || dismissed) {
    return null;
  }

  const isJapanese = language === "ja";

  return (
    <section className="viewer-message viewer-message-warning template-stale-notice" role="status">
      <div className="template-stale-notice-body">
        <p className="template-stale-notice-title">
          {isJapanese
            ? "X 側で投稿詳細を一度開いて、取得テンプレートを更新してください。"
            : "Open any X post detail once to refresh the fetch template."}
        </p>
        <p className="template-stale-notice-text">
          {isJapanese
            ? `${authStaleState.count} 件のスレッド取得が認証切れで停止しています。`
            : `${authStaleState.count} thread fetch item(s) are paused by stale auth.`}
        </p>
      </div>
      <button
        className="viewer-secondary-button template-stale-notice-dismiss"
        type="button"
        onClick={() => {
          setDismissed(true);

          try {
            window.sessionStorage.setItem(AUTH_STALE_NOTICE_DISMISSED_KEY, "1");
          } catch {
            // Ignore storage access failures; local state still hides the notice.
          }
        }}
      >
        {isJapanese ? "閉じる" : "Dismiss"}
      </button>
    </section>
  );
}
