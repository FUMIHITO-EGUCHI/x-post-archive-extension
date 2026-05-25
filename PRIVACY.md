# Privacy Policy

**Last updated:** 2026-05-25

> 日本語版は本ドキュメント末尾の [プライバシーポリシー（日本語）](#プライバシーポリシー日本語) を参照。

This document describes how the **Offline X Archive** Chrome extension ("the Extension") handles user data. This policy applies to the Chrome extension distributed from this repository and the Chrome Web Store.

## Summary

- The Extension stores all data **locally** on the user's device.
- The Extension does **not** transmit any data to the developer or any third party.
- The Extension does **not** include analytics, telemetry, advertising, or tracking.
- There is **no** account, login, or server operated by the developer.

## Data the Extension stores locally

The Extension saves data only when the user explicitly triggers a save action on a post on `x.com` / `twitter.com`. Saved data is stored in the browser's IndexedDB on the user's own device and is never transmitted off-device by the Extension.

The following information may be stored:

- The post identifier (`x_post_id`), author username, post body text, post URL, and timestamp at the moment of saving.
- Media URLs and locally cached media blobs referenced by the saved post (when applicable).
- Thread context required to reproduce the saved post in the viewer.
- A request template captured from the user's own active X session, used to call the same GraphQL `TweetDetail` endpoint that x.com itself uses. The template stored in persistent IndexedDB contains only non-sensitive fields (URL, request method, query/body variables, and non-authentication request headers such as `accept-language` and `x-twitter-client-language`). Authentication-bearing headers (`authorization`, `x-csrf-token`, `x-client-transaction-id`, `x-client-uuid`) are kept only in the browser's session-scoped storage (`chrome.storage.session`) and are cleared when the browser closes.
- Internal application state required to operate the Extension (e.g. queue state, settings, alarms metadata).

The Extension uses the following Chrome APIs to provide its functionality:

| API / Permission | Purpose |
| --- | --- |
| `storage`, `unlimitedStorage` | Local persistence in IndexedDB and `chrome.storage` for user settings and saved posts. |
| `cookies` | Reading the `ct0` CSRF cookie from `x.com` / `twitter.com` is required to fetch the user's own active session's GraphQL endpoint (`TweetDetail`) for capturing the full post and thread context the user is currently viewing. The cookie value is used only on the user's own machine to compose the request to `x.com` and is never transmitted to the developer or any third party. |
| `alarms` | Background service worker scheduling for retrying failed saves and processing queued work. |
| `host_permissions` (`https://x.com/*`, `https://twitter.com/*`, `https://pbs.twimg.com/*`, `https://video.twimg.com/*`) | Required to attach the save UI to the X interface, fetch the post via the user's authenticated session, and locally cache referenced media. |

## Data the Extension does NOT collect

- The Extension does **not** send any usage data, error reports, or telemetry to the developer or to any third party.
- The Extension does **not** include analytics SDKs, advertising identifiers, or trackers.
- The Extension does **not** open any network connection to a server operated by the developer. The developer operates no backend.

## Network activity

The Extension only contacts the following domains, all of which are operated by X Corp.:

- `x.com`, `twitter.com` — to load the user's own session-authenticated post and thread data via the same endpoints the user's browser already uses while signed in.
- `pbs.twimg.com`, `video.twimg.com` — to fetch media referenced by saved posts so that they can be rendered in the local viewer.

No request from the Extension is sent to any domain not listed above.

## Third parties

The Extension does not share data with third parties. The Extension does not embed third-party analytics, advertising, or tracking SDKs.

## User control

- Saved data can be deleted at any time from the in-extension viewer.
- Uninstalling the Extension removes all data the Extension created in the browser's storage area.
- The user's X account credentials are managed entirely by the user's browser; the Extension never reads passwords. The Extension reads the `ct0` CSRF cookie via the `cookies` permission and observes authentication-bearing request headers from the user's active X session in order to call the same GraphQL endpoint that x.com itself calls. Authentication headers are kept only in the browser's session-scoped storage (`chrome.storage.session`) and are cleared when the browser session ends; they are never written to disk-backed IndexedDB and never transmitted off-device by the Extension.

## Children's privacy

The Extension is not directed to children under 13 and does not knowingly collect any data, since it does not collect data at all.

## Changes to this policy

Material changes to this policy will be reflected in this file and the `Last updated` date above. The current version of this policy lives at:

`https://github.com/FUMIHITO-EGUCHI/x-post-archive-extension/blob/master/PRIVACY.md`

## Contact

For questions about this policy or the Extension's data handling, open an issue on the GitHub repository:

`https://github.com/FUMIHITO-EGUCHI/x-post-archive-extension/issues`

---

## プライバシーポリシー（日本語）

**最終更新日:** 2026-05-25

本ドキュメントは、Chrome 拡張機能 **Offline X Archive**（以下「本拡張機能」）におけるユーザーデータの取り扱いを定める。本ポリシーは、本リポジトリおよび Chrome ウェブストアで配布される Chrome 拡張機能に適用される。英語版と本日本語版で内容に差異がある場合は、英語版を正とする。

### 要約

- 本拡張機能は、すべてのデータをユーザーの端末内に**ローカル保存**する。
- 本拡張機能は、開発者および第三者にいかなるデータも**送信しない**。
- 本拡張機能は、アナリティクス、テレメトリ、広告、トラッキングを**含まない**。
- 開発者が運営するアカウント、ログイン、サーバーは**存在しない**。

### ローカルに保存されるデータ

本拡張機能は、ユーザーが `x.com` / `twitter.com` 上の投稿に対して明示的に保存操作を行った場合にのみデータを保存する。保存データはユーザー自身の端末内のブラウザ IndexedDB に格納され、本拡張機能から端末外へ送信されることはない。

保存される情報:

- 投稿 ID（`x_post_id`）、投稿者ユーザー名、投稿本文、投稿 URL、保存時点のタイムスタンプ
- 保存対象投稿が参照するメディア URL およびローカルキャッシュしたメディアバイナリ
- ビューワーで保存投稿を再現するために必要なスレッド文脈情報
- ユーザー自身のアクティブな X セッションから取得したリクエストテンプレート。x.com 自身が呼び出すのと同じ GraphQL `TweetDetail` エンドポイントを呼び出すために使用する。永続 IndexedDB に保存するのは非機微フィールド（URL、リクエストメソッド、クエリ／ボディ変数、`accept-language` や `x-twitter-client-language` などの非認証リクエストヘッダー）のみ。認証情報を含むヘッダー（`authorization`, `x-csrf-token`, `x-client-transaction-id`, `x-client-uuid`）はブラウザのセッションスコープストレージ（`chrome.storage.session`）にのみ保持され、ブラウザを閉じると消去される。
- 本拡張機能の動作に必要な内部状態（キュー、設定、アラームメタデータなど）

本拡張機能が使用する Chrome API と用途:

| API / 権限 | 用途 |
| --- | --- |
| `storage`, `unlimitedStorage` | ユーザー設定および保存投稿の IndexedDB / `chrome.storage` への永続化 |
| `cookies` | `x.com` / `twitter.com` の `ct0` CSRF クッキーを参照し、ユーザー自身の認証済みセッションで GraphQL エンドポイント（`TweetDetail`）にリクエストを送るために使用する。クッキー値はユーザー端末上で `x.com` へのリクエスト組み立てにのみ用い、開発者および第三者には一切送信しない。 |
| `alarms` | バックグラウンドサービスワーカーの再起動・保存ジョブの再試行・キュー処理のスケジューリング |
| `host_permissions`（`https://x.com/*`, `https://twitter.com/*`, `https://pbs.twimg.com/*`, `https://video.twimg.com/*`） | X の画面に保存 UI を組み込み、ユーザー自身の認証済みセッション経由で投稿を取得し、参照メディアをローカルキャッシュするために必要 |

### 収集しないデータ

- 利用状況データ、エラーレポート、テレメトリの開発者または第三者への送信は**行わない**
- アナリティクス SDK、広告 ID、トラッカーは**含まない**
- 開発者が運営するサーバーへの通信は**発生しない**。開発者はバックエンドを運用していない。

### 通信先

本拡張機能が通信するのは、以下の X Corp. が運営するドメインのみ:

- `x.com`, `twitter.com` — ユーザーがブラウザでサインインしているのと同一のエンドポイントを介し、ユーザー自身のセッションで投稿およびスレッドデータを取得する
- `pbs.twimg.com`, `video.twimg.com` — 保存投稿が参照するメディアをローカルビューワーで表示するために取得する

上記以外のドメインへ本拡張機能がリクエストを発することはない。

### 第三者への提供

本拡張機能は、第三者にユーザーデータを共有しない。第三者によるアナリティクス、広告、トラッキング SDK を一切埋め込まない。

### ユーザーの制御

- 保存データは拡張機能内のビューワーからいつでも削除できる
- 本拡張機能をアンインストールすると、本拡張機能がブラウザストレージに作成したすべてのデータが削除される
- ユーザーの X アカウント認証情報はユーザーのブラウザによって完全に管理される。本拡張機能はパスワードを一切読み取らない。`cookies` 権限を用いて `ct0` CSRF クッキーを参照し、ユーザーのアクティブな X セッションが発する認証情報を含むリクエストヘッダーを観測することで、x.com 自身が呼び出すのと同じ GraphQL エンドポイントを呼び出す。認証ヘッダーはブラウザのセッションスコープストレージ（`chrome.storage.session`）にのみ保持され、ブラウザセッション終了時に消去される。ディスク永続化される IndexedDB には書き込まれず、本拡張機能から端末外へ送信されることもない。

### 子どもに関するプライバシー

本拡張機能は 13 歳未満の子どもを対象としていない。そもそもデータ収集を行わないため、子どもからのデータ収集も行わない。

### ポリシーの変更

本ポリシーに重要な変更があった場合、本ファイルおよび「最終更新日」に反映する。本ポリシーの現行版は以下に常置される:

`https://github.com/FUMIHITO-EGUCHI/x-post-archive-extension/blob/master/PRIVACY.md`

### お問い合わせ

本ポリシーまたは本拡張機能のデータ取り扱いに関する問い合わせは、GitHub リポジトリの Issue で受け付ける:

`https://github.com/FUMIHITO-EGUCHI/x-post-archive-extension/issues`
