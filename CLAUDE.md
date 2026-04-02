# CLAUDE.md

Claude Code がこのリポジトリで作業するときの運用ガイド。
プロダクト仕様・設計方針は [AGENTS.md](AGENTS.md) が正とする。矛盾があれば AGENTS.md を優先する。

---

## 作業開始時の読み順

技術情報を毎回広く読まない。次の順で必要な範囲だけ読む:

1. `ai-handoff/current-task.md` — 今何をやっているか確認
2. task packet の **Files to read first** — 対象ファイルを絞る
3. `docs/tech-index.md` — ファイルの場所が分からないときだけ参照

---

## Claude の担当と非担当

### 担当（Claude が主に行う）
- 要件整理・実装方針の確認
- Chrome / X 上の調査（DOM、セレクタ、ネットワーク、イベント切り分け）
- ブラウザ上のデバッグ分析
- 調査結果の圧縮・handoff 準備

### 非担当（Codex に渡す）
- 実装・リファクタ・テスト
- レビュー・ドキュメント作成
- Git 関連作業（コミット、PR、バージョン管理）

Chrome / X 側の広い探索を Codex に振らないこと。Codex が扱う場合も、対象を絞った確認に限める。

---

## Handoff 手順

### Claude → Codex へ渡すとき

1. `ai-handoff/findings/` に**圧縮済みの**調査ノートを作る（生ログ禁止）
2. `ai-handoff/templates/task-packet.template.md` から `ai-handoff/tasks/` に task packet を作る
3. task packet に以下を揃えてから渡す:
   - Goal / In scope / Out of scope / Constraints
   - Compressed findings（結論・根拠・未解決点のみ）
   - Files to read first
   - Acceptance criteria
   - Open questions
4. `ai-handoff/current-task.md` を更新して新しい packet を参照させる

### Codex から返ってきたとき

task packet の結果欄（Changed files / Verification / Remaining issues / Suggested next action）と `current-task.md` の状態が更新されているか確認する。

### ai-handoff/ の構造

| パス | 用途 |
|---|---|
| `current-task.md` | アクティブタスクを1件だけ指すダッシュボード |
| `tasks/` | task packet（1タスク1ファイル） |
| `findings/` | 圧縮済み調査結果のみ（生ログ置き場にしない） |
| `templates/` | packet / finding / current-task の雛形 |
| `archive/` | 完了済みの退避先 |

長期的な要件・設計・仕様判断は `docs/` に残す。

---

## プロジェクト概要

X（旧Twitter）投稿を1件ずつ保存・検索するための Chrome 拡張（Manifest V3）。個人用アーカイブ兼検索ツール。スナップショット保存が基本方針で、保存後の自動更新は行わない。

---

## コマンド

```bash
npm install          # 依存インストール
npm run dev          # 開発用（WXT dev server）
npm run build        # ビルド → .output/chrome-mv3/
npm run typecheck    # 型チェック（コミット前に必ず実行）
npm run zip          # リリース用 zip 作成
```

Chrome では `.output/chrome-mv3/` を unpacked extension として読み込む。テストコマンドは未設定（手動確認）。

---

## アーキテクチャ

```
content script (X.com DOM)
    ↓ chrome.runtime.sendMessage
service worker (background)
    ↓ Dexie / OPFS
IndexedDB + OPFS
    ↑
viewer UI (React, 別タブ)
```

### エントリポイント

| ファイル | 役割 |
|---|---|
| `src/entrypoints/x.content.ts` | X.com（isolated world）。DOM 監視・ボタン注入・メッセージ送信 |
| `src/entrypoints/x-main.content.ts` | X.com（main world）。fetch/XHR 傍受で動画 GraphQL レスポンス取得 |
| `src/entrypoints/background.ts` | Service worker。メッセージ受付・DB 操作の起点 |
| `src/entrypoints/viewer/main.tsx` | 閲覧UI（React）。一覧・検索・タグ管理・設定 |

isolated world からはページの `fetch` を傍受できないため、main world 側で monkey-patch しカスタムイベント経由で isolated world に動画候補を渡す。

### データフロー（投稿保存）

1. `bootstrap-x-content-script.ts` が DOM を監視し、投稿ごとに保存ボタンを注入
2. ボタンクリック → `extract-post-from-article.ts` で DOM から投稿データを抽出
3. `client.ts` が `posts/save` メッセージを送信（タイムアウト 180秒）
4. `handle-runtime-message.ts` が受け取り → `archive-service.ts` で保存処理
5. `archive-service.ts` が DB に PostRecord を書き込み、バックグラウンドでメディアを OPFS に保存

### ストレージ

- **IndexedDB（Dexie）**: `src/db/archive-database.ts` に単一インスタンス（v1〜v9）
- **OPFS**: 画像・動画バイナリ。`/media/images|videos/{x_post_id}/{media_id}.bin`
- **chrome.storage.local**: 言語設定など軽量設定のみ

DB テーブル: `posts`, `media`, `tags`, `post_tags`, `logs`
DB アクセスは `src/db/repositories/` に集約。UI コンポーネントから直接触らない。

### メッセージプロトコル

型定義: `src/types/runtime.ts` / 送信: `features/runtime/client.ts` / 受信: `features/runtime/handle-runtime-message.ts`

対応メッセージ: `posts/save`, `posts/save-batch`, `posts/has`, `posts/list`, `posts/list-page`, `posts/delete`, `posts/tags/add`, `posts/tags/remove`, `posts/summary`, `logs/clear`, `debug/log`

### タグの種類

- **システムタグ** (`system_key` あり): `liked` / `image` / `video`。ビルトインで多言語ラベルを持つ
- **自動タグ** (`source: "auto"`): ハッシュタグ等を自動抽出
- **手動タグ** (`source: "manual"`): ユーザーが明示的に付与

---

## 実装ルール

### TypeScript
- `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- `any` 禁止（`unknown` + 型ガードを使う）
- Boxed type 禁止（`String` ではなく `string`）
- DOM から取得した値は変換関数を通してから内部型に流す

### React
- **viewer UI にのみ使用**。content script と service worker では使わない
- データ整形ロジックをコンポーネントに直接書かず、mapper/utility に分離する

### 設計方針
- 「表示単位」と「保存単位」を混同しない
- X 固有の DOM 取得ロジックは `features/x/` に閉じ込め、他に散らさない
- 複数テーブルへの意味的に一体の更新は Dexie のトランザクションを使う
- メディアの OPFS 書き込みは非同期バックグラウンド処理。保存完了を待たずに PostRecord を DB に書く
- Service Worker 再起動時に `resumePendingMediaPersistence()` で未完了メディアを最大 24 件リトライ

---

## Git ルール

- `master` への直接コミットは避ける。feature branch で作業する
- コミット前に `npm run typecheck` と `npm run build` が通ることを確認する
- `git push` はユーザーから明示的な指示がある場合にのみ行う
- ドキュメント変更と実装変更はコミットを分ける
- コミット件名には `feat(likes-import): ...` のように種別と補助ラベルを付ける
- version bump は `master` マージ後に行い、対応するリリースノートを `docs/release-notes/` に作成する
- `git push` する場合は release tag 作成・`docs/release-notes/` 更新・GitHub Release 作成まで同じ作業で完了させる

---

## 大きな変更前の作業順

新機能・データモデル変更・設計変更に入る前は以下を先に整理する:
- `docs/requirements.md`
- `docs/mvp-plan.md`
- `docs/data-model.md`
- `docs/implementation-steps.md`

軽微な修正では毎回全ドキュメント更新は不要。

---

## 判断優先順位

迷ったら: 検索性 → 保存時点の再現性 → データ構造の自然さ → 実装の単純さ → 見た目
