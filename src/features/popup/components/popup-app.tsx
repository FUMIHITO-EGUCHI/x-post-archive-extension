export function PopupApp() {
  function openViewer() {
    void chrome.tabs.create({
      url: chrome.runtime.getURL("/viewer.html")
    });
  }

  return (
    <main className="popup-shell">
      <section className="popup-panel">
        <h1 className="popup-title">X Post Archive</h1>
        <p className="popup-copy">
          最低限の Chrome 拡張テンプレートです。保存機能の本実装前ですが、viewer を開いて拡張の配線確認ができます。
        </p>

        <div className="popup-actions">
          <button className="popup-button" type="button" onClick={openViewer}>
            Open Viewer
          </button>
          <button
            className="popup-button secondary"
            type="button"
            onClick={() => window.close()}>
            Close
          </button>
        </div>
      </section>
    </main>
  );
}
