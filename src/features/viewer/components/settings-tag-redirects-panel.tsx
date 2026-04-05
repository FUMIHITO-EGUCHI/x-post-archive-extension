import { useEffect, useState } from "react";
import type { ArchiveTagRedirectSummaryRecord } from "../../../types/viewer";
import { requestDeleteTagRedirect, requestTagRedirects } from "../../runtime/client";
import type { ArchiveLanguage } from "../../settings/archive-language";

type SettingsTagRedirectsPanelProps = {
  language: ArchiveLanguage;
};

export function SettingsTagRedirectsPanel({ language }: SettingsTagRedirectsPanelProps) {
  const [redirects, setRedirects] = useState<ArchiveTagRedirectSummaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);
  const isJapanese = language === "ja";

  useEffect(() => {
    void loadRedirects();
  }, []);

  async function loadRedirects(): Promise<void> {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await requestTagRedirects();
      setRedirects(response.redirects.filter((redirect) => redirect.target_display_name !== null));
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message.trim() !== ""
          ? error.message
          : isJapanese
            ? "自動タグ変換一覧の読み込みに失敗しました。"
            : "Failed to load automatic tag redirects."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteRedirect(tagRedirectId: string): Promise<void> {
    setPendingDeleteId(tagRedirectId);
    setErrorMessage(null);
    setNoticeMessage(null);

    try {
      const response = await requestDeleteTagRedirect(tagRedirectId);

      if (!response.deleted) {
        setErrorMessage(
          isJapanese ? "削除対象の自動タグ変換が見つかりませんでした。" : "The selected redirect was not found."
        );
        return;
      }

      await loadRedirects();
      setDeleteConfirmationId(null);
      setNoticeMessage(
        isJapanese ? "自動タグ変換を削除しました。" : "Deleted the automatic tag redirect."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message.trim() !== ""
          ? error.message
          : isJapanese
            ? "自動タグ変換の削除に失敗しました。"
            : "Failed to delete the automatic tag redirect."
      );
    } finally {
      setPendingDeleteId(null);
    }
  }

  function handleDeleteClick(tagRedirectId: string): void {
    if (pendingDeleteId !== null) {
      return;
    }

    setErrorMessage(null);
    setNoticeMessage(null);

    if (deleteConfirmationId === tagRedirectId) {
      void handleDeleteRedirect(tagRedirectId);
      return;
    }

    setDeleteConfirmationId(tagRedirectId);
  }

  return (
    <section className="viewer-settings-card">
      <div className="viewer-settings-card-header">
        <h3>{isJapanese ? "自動タグ変換" : "Automatic tag redirects"}</h3>
        <p>
          {isJapanese
            ? "統合したタグの古い名前が再び使われたときに、どのタグへ自動で置き換えるかを確認できます。"
            : "Review which tag each old merged tag will be replaced with the next time it is used."}
        </p>
      </div>

      {errorMessage !== null ? (
        <p className="viewer-message viewer-message-error">{errorMessage}</p>
      ) : noticeMessage !== null ? (
        <p className="viewer-message viewer-message-success">{noticeMessage}</p>
      ) : loading ? (
        <p className="viewer-message">
          {isJapanese ? "自動タグ変換を読み込み中..." : "Loading automatic tag redirects..."}
        </p>
      ) : redirects.length === 0 ? (
        <p className="viewer-message">
          {isJapanese ? "まだ自動タグ変換はありません。" : "No automatic tag redirects yet."}
        </p>
      ) : (
        <div className="viewer-tag-management-redirect-list">
          {redirects.map((redirect) => {
            const isPendingDelete = pendingDeleteId === redirect.tag_redirect_id;
            const isDeleteConfirmationActive = deleteConfirmationId === redirect.tag_redirect_id;

            return (
              <div key={redirect.tag_redirect_id} className="viewer-tag-management-redirect-item">
                <div className="viewer-tag-management-redirect-row">
                  <div className="viewer-tag-management-redirect-copy">
                    <strong>{redirect.source_display_name}</strong>
                    <span aria-hidden="true">→</span>
                    <strong>{redirect.target_display_name}</strong>
                  </div>
                  <button
                    className={
                      isDeleteConfirmationActive
                        ? "viewer-danger-button viewer-tag-management-redirect-delete"
                        : "viewer-secondary-button viewer-tag-management-redirect-delete viewer-tag-management-redirect-delete-soft"
                    }
                    type="button"
                    disabled={isPendingDelete}
                    onClick={() => {
                      handleDeleteClick(redirect.tag_redirect_id);
                    }}
                  >
                    {isPendingDelete
                      ? isJapanese
                        ? "削除中..."
                        : "Deleting..."
                      : isDeleteConfirmationActive
                        ? isJapanese
                          ? "削除する"
                          : "Delete"
                        : isJapanese
                          ? "削除"
                          : "Delete"}
                  </button>
                </div>

                {isDeleteConfirmationActive && !isPendingDelete && (
                  <p className="viewer-settings-inline-note">
                    {isJapanese
                      ? "もう一度押すと、この自動タグ変換を削除します。"
                      : "Press the button again to delete this automatic tag redirect."}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
