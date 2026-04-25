#!/usr/bin/env bash
set -euo pipefail

# 子 issue を順に作って番号を取得 → 最後に親 issue を立てる。
# 既に作成済みの場合は流し直さないこと（重複作成される）。
# 子 issue 本文の依存先は「Task X」表記で書き、解決は tasks/thread-archive-plan.md の依存グラフ参照。

CREATED=()  # 各要素 "番号|タイトル"

create() {
  local title="$1"
  local body="$2"
  shift 2
  local args=()
  for label in "$@"; do
    args+=( --label "$label" )
  done
  local url
  url=$(gh issue create --title "$title" --body "$body" "${args[@]}")
  local num="${url##*/}"
  echo "  -> #$num  $title"
  CREATED+=("$num|$title")
}

LABELS_BASE=( "status: todo" "owner: codex" "type: feature" )

###############################################################################
# Task 0
###############################################################################
create "[task] Task 0: extract-post-from-article に in_reply_to_post_id 抽出を追加" "$(cat <<'BODY'
## Objective

`extractPostFromArticle()` の出力に `in_reply_to_post_id: string | null` を追加する。手動保存・通常保存・likes import の **全経路で共有される基盤**。

## Scope

- `src/features/x/extract-post-from-article.ts`
  - 取得方法は以下の順で試行:
    1. React Fiber の `in_reply_to_status_id_str`（既存の Fiber アクセスパターン: `annotate-quoted-post-containers.ts`）
    2. DOM の "Replying to @user" リンクからの URL 抽出（fallback）
    3. 取れなければ `null`
- `src/types/archive.ts`
  - `SavePostInput` / `PostRecord` 系に `in_reply_to_post_id?: string | null` 型追加（DB 反映は Task 1a 側）

## Acceptance

- [ ] 単独投稿で `in_reply_to_post_id === null`
- [ ] 連投の途中ポストで前のコマ ID が入る
- [ ] 既存の単発保存・likes import がリグレッションしない
- [ ] `npm run typecheck && npm run build` pass

## References

- 設計: `tasks/thread-archive-plan.md` Task 0
- spike findings: `docs/findings/2026-04-26-thread-archive-spike.md`
- 依存: なし
BODY
)" "${LABELS_BASE[@]}" "priority: high" "area: content"

###############################################################################
# Task 1a
###############################################################################
create "[task] Task 1a: Dexie v16 — posts に in_reply_to_post_id / thread_root_id 追加" "$(cat <<'BODY'
## Objective

`posts` テーブルに `in_reply_to_post_id` と `thread_root_id` を追加。Dexie スキーマを v15 → v16 にバージョンアップ。

## Scope

- `src/db/archive-database.ts`
  - v16 スキーマ追加。`posts` のインデックスに `in_reply_to_post_id`, `thread_root_id` を含める
  - 追加フィールドは undefined のまま既存レコードに触らない（マイグレーションロジック不要）
- `src/types/archive.ts`
  - `PostRecord` / `ArchivePostRecord` に `in_reply_to_post_id?: string | null`, `thread_root_id?: string | null`

## Acceptance

- [ ] 既存レコードを開いても両フィールドは undefined
- [ ] `posts` のインデックスに `in_reply_to_post_id`, `thread_root_id` がある
- [ ] `npm run typecheck && npm run build` pass

## References

- 設計: `tasks/thread-archive-plan.md` データモデル
- 依存: なし（Task 0 と並列可）
BODY
)" "${LABELS_BASE[@]}" "priority: high" "area: db"

###############################################################################
# Task 1b
###############################################################################
create "[task] Task 1b: Dexie v16 — thread_expand_queue + tweet_detail_template テーブル新設" "$(cat <<'BODY'
## Objective

スレッド自動展開用のキューと、TweetDetail GraphQL request の template キャッシュ用テーブルを Dexie v16 で新設。

## Scope

- `src/db/archive-database.ts`
  - **`thread_expand_queue`**:
    ```
    id: ++ (auto-increment, primary key)
    candidate_post_id: string
    thread_root_id: string  (de-dup キー、index)
    status: 'pending' | 'in_progress' | 'failed'  (index)
    retry_count: number
    last_error: string | null
    created_at: number
    updated_at: number
    next_attempt_at: number  (backoff、index)
    ```
  - **`tweet_detail_template`**: 単一行（`id: 'current'` 固定）。最新キャプチャを上書き保存
    ```
    id: 'current'
    url: string
    method: 'GET' | 'POST'
    headers: Record<string, string>
    variables: Record<string, unknown>
    features: Record<string, unknown> | null
    fieldToggles: Record<string, unknown> | null
    captured_at: number
    ```
- `src/types/` に対応型を定義（`thread.ts` 新規 or 既存に追加）
- repository 関数（`enqueueThreadExpand`, `dequeueNextPending`, `markInProgress`, `markFailed`, `getTemplate`, `setTemplate` 等）を最小実装

## Acceptance

- [ ] 両テーブルが v16 で出現する
- [ ] repository 関数を呼んで CRUD できる
- [ ] `npm run typecheck && npm run build` pass

## References

- 設計: `tasks/thread-archive-plan.md` データモデル
- spike findings: `docs/findings/2026-04-26-thread-archive-spike.md`（template 項目の根拠）
- 依存: なし
BODY
)" "${LABELS_BASE[@]}" "priority: medium" "area: db"

###############################################################################
# Task 2
###############################################################################
create "[task] Task 2: スレッドページ判定 + OP 限定 DOM 抽出関数" "$(cat <<'BODY'
## Objective

`https://x.com/:username/status/:id` を表示中、ページ内の article から **OP 投稿者本人のもの**だけを表示順に抽出する関数を作る。

## Scope

- `src/features/x/detect-thread-page.ts` 新規
  - URL から OP の `:username` と focal `:id` を取得する純関数
- `src/features/x/extract-thread-posts.ts` 新規
  - 全 article を `extractPostFromArticle` で抽出 → `x_username === OP` でフィルタ → DOM 表示順で配列化 → `in_reply_to_post_id` を隣接連結 → 配列先頭の `x_post_id` を `thread_root_id` にセット
  - 1 件しかない場合は `thread_root_id`/`in_reply_to_post_id` を `null` のまま返す（単独扱い）

## Acceptance

- [ ] サンプル 1〜3 で OP のチェーンを抽出できる（手動 console 確認可）
- [ ] 他人のリプライ記事は結果に含まれない
- [ ] 連投の中央ポスト URL からでも、ページに描画されている前後の OP 記事を含めて返す
- [ ] 単独投稿の場合は size 1 の配列で `thread_root_id === null`
- [ ] `npm run typecheck && npm run build` pass

## References

- 設計: `tasks/thread-archive-plan.md` Task 2
- 依存: Task 0 (in_reply_to_post_id 抽出)
BODY
)" "${LABELS_BASE[@]}" "priority: high" "area: content"

###############################################################################
# Task 3
###############################################################################
create "[task] Task 3: 「連投を保存」ボタン挿入 + 押下処理" "$(cat <<'BODY'
## Objective

スレッドページに「連投を保存（N件）」ボタンを挿入。押下で抽出結果を background に送信。

## Scope

- `src/features/x/inject-save-thread-button.ts` 新規（`inject-save-button.ts` の隣接パターン参照）
- `src/features/x/bootstrap-x-content-script.ts`
  - スレッドページ検出時のみボタン表示。OP 抽出が 1 件しかなければ「連投ではありません」表記 + 非活性
  - 押下で `posts/save-thread` ランタイムメッセージを送る
- 既存の単発「投稿を保存」ボタンとは独立配置（重複しない）

## Acceptance

- [ ] スレッドページのみボタン出現
- [ ] 件数が動的に表示される（DOM 更新時に追従）
- [ ] OP が 1 件しかない場合は非活性
- [ ] 押下後ボタンが `saving` → `saved` 遷移する（既存 button-state 流儀踏襲）
- [ ] `npm run typecheck && npm run build` pass

## References

- 設計: `tasks/thread-archive-plan.md` Task 3
- 依存: Task 2
BODY
)" "${LABELS_BASE[@]}" "priority: high" "area: content"

###############################################################################
# Task 4
###############################################################################
create "[task] Task 4: posts/save-thread runtime ハンドラ" "$(cat <<'BODY'
## Objective

`posts/save-thread` メッセージを background で受け取り、配列をループして既存 `savePost` で保存する。

## Scope

- `src/types/runtime.ts`: `SaveThreadMessage` / `SaveThreadResponse` 型定義
- `src/features/archive/archive-service.ts`: `saveThread()` 関数追加
- `src/features/runtime/handle-runtime-message.ts`: ルーティング追加
- 各 post に `thread_root_id` と `in_reply_to_post_id` をセットして保存
- メディアは既存 OPFS キュー任せ
- 重複は既存 `savePost` の重複スキップに任せる

## Acceptance

- [ ] response に `saved / skipped / failed` 件数を含む
- [ ] 全件の `thread_root_id` が同じ値になる
- [ ] `npm run typecheck && npm run build` pass

## References

- 設計: `tasks/thread-archive-plan.md` Task 4
- 依存: Task 1a (DB 拡張), Task 3 (送信元)
BODY
)" "${LABELS_BASE[@]}" "priority: high" "area: background"

###############################################################################
# Task 5
###############################################################################
create "[task] Task 5: TweetDetail template キャプチャ（MAIN world fetch/XHR patch）" "$(cat <<'BODY'
## Objective

X 上で organic に飛ぶ `/i/api/graphql/<id>/TweetDetail` request を MAIN world から intercept し、URL（query ID 込み）/ method / headers / variables / features / fieldToggles を抜いて IndexedDB の `tweet_detail_template` に保存する。

## Scope

- `src/features/x/install-tweet-detail-template-capture.ts` 新規（MAIN world 動作）
  - `window.fetch` と `XMLHttpRequest` を patch（既存 `install-graphql-video-response-observer.ts` のパターン踏襲）
  - URL に `/i/api/graphql/<id>/TweetDetail` を含む request を捕捉
  - GET の場合は URL の `variables` / `features` / `fieldToggles` クエリを `JSON.parse`
  - POST の場合は body を `JSON.parse`
  - 受信した template を CustomEvent で isolated world へ送り、isolated 側で `setTemplate('current', ...)` を呼ぶ
- `src/entrypoints/x-main.content.ts` に installer 呼び出しを追加
- isolated 側のリスナは `src/features/x/bootstrap-x-content-script.ts` に追加（または別ファイル分離）

## Acceptance

- [ ] x.com の任意のスレッド/投稿ページを開くと数秒以内に template が IndexedDB に保存される
- [ ] 保存される headers に `authorization` (`Bearer ...`) が含まれる
- [ ] `x-csrf-token` は保存しても良い（実 fetch 時は cookie ct0 から取り直す前提）
- [ ] `npm run typecheck && npm run build` pass

## References

- 設計: `tasks/thread-archive-plan.md` Task 5
- spike findings: `docs/findings/2026-04-26-thread-archive-spike.md`（実装ヒント詳述）
- 依存: Task 1b (テーブル)
BODY
)" "${LABELS_BASE[@]}" "priority: high" "area: content"

###############################################################################
# Task 6
###############################################################################
create "[task] Task 6: TweetDetail GraphQL client（background, cookies fetch + chain extract）" "$(cat <<'BODY'
## Objective

任意の `focalTweetId` を引数に取り、保存済み template + cookie を使って TweetDetail を直接 fetch、レスポンスから OP の self-reply chain を抽出して返す client を background に作る。

## Scope

- `src/features/x/tweet-detail-client.ts` 新規
  - `fetchTweetDetail(focalTweetId): Promise<TweetDetailResponse>`:
    1. `getTemplate('current')` で template ロード。無ければ `template-missing` エラー
    2. `chrome.cookies.get({url: 'https://x.com', name: 'ct0'})` で csrf 取得。無ければ `not-logged-in`
    3. template の variables に `focalTweetId` をマージして URL/body 再構築
    4. `fetch(url, { ...template, headers: {...template.headers, 'x-csrf-token': ct0}, credentials: 'include' })`
    5. JSON parse → 走査して `rest_id` を持つ tweet record を全部集める
- `src/features/x/extract-thread-from-tweet-detail.ts` 新規
  - 入力 JSON から OP filter（`core.user_results.result.rest_id === <opUserId>`）
  - `legacy.in_reply_to_status_id_str` で親子関係を構築、focal を含む単一チェーン（root → ... → leaf）を返す
  - `legacy.full_text`, `legacy.entities.media[]` も取り出して `SavePostInput` 形式で返す
- 失敗時: 401/403 は `auth-stale` で返す、429 は `rate-limited`、その他は `unknown`

## Acceptance

- [ ] x.com にログインしている状態で任意の focalTweetId を渡すと chain が返る
- [ ] チェーン途中の ID（中央コマ）でも root から末端まで返る
- [ ] OP 以外の tweet は除外される
- [ ] 401/403/429 を区別したエラーを返す
- [ ] template 未取得時は `template-missing` を返す
- [ ] `npm run typecheck && npm run build` pass

## References

- 設計: `tasks/thread-archive-plan.md` Task 6
- spike findings: `docs/findings/2026-04-26-thread-archive-spike.md`（payload 構造の例）
- 依存: Task 1b (template 保存), Task 5 (template 供給)
BODY
)" "${LABELS_BASE[@]}" "priority: high" "area: background"

###############################################################################
# Task 7
###############################################################################
create "[task] Task 7: thread_expand_queue worker（1 req/5s, exponential backoff, 3 retry）" "$(cat <<'BODY'
## Objective

`thread_expand_queue` を直列に消化する singleton worker を background に追加。各 entry について TweetDetail client を呼び、取得 chain を `saveThread` で保存する。

## Scope

- `src/features/archive/thread-expand-worker.ts` 新規
  - singleton。同時並列なし
  - **固定 throttle: 1 req / 5 s**（前回開始から 5 s 経過するまで次を始めない）
  - 失敗時 backoff: 5s → 30s → 5min → fail (`status='failed'`)
  - SW 起動時 (`onInstalled` / `onStartup`) に pending を resume
  - キューが空になれば worker は idle に戻る
- `src/entrypoints/background.ts`
  - 既存 `resumePendingMediaPersistence` / `resumeRefetchProcessing` と同列に `resumeThreadExpandProcessing()` を呼ぶ

## Acceptance

- [ ] 1 件処理完了から次の開始まで >= 5 s
- [ ] 失敗時は backoff 通りに `next_attempt_at` が設定される
- [ ] 3 回失敗で `status='failed'` 保留、自動再試行されない
- [ ] SW 再起動でも pending が再開される
- [ ] `npm run typecheck && npm run build` pass

## References

- 設計: `tasks/thread-archive-plan.md` Task 7（throttle / 起点ポリシー）
- 既存類似パターン: `src/features/refetch/refetch-coordinator.ts`
- 依存: Task 1b (queue), Task 6 (client), Task 4 (saveThread)
BODY
)" "${LABELS_BASE[@]}" "priority: high" "area: background"

###############################################################################
# Task 8
###############################################################################
create "[task] Task 8: thread_expand_queue 登録ロジック（連投保存 / 通常保存 / likes import）" "$(cat <<'BODY'
## Objective

`in_reply_to_post_id` が同一投稿者を指す投稿を保存した時、`thread_expand_queue` に root id ベースで de-dup 登録する。各保存経路に組み込む。

## Scope

- `src/features/archive/archive-service.ts` の `savePost()`:
  - 保存対象が self-reply 候補の場合 `enqueueThreadExpand({candidate_post_id, thread_root_id_estimate})`
  - `thread_root_id` 未確定でも `candidate_post_id` 単独で enqueue 可、worker 側で root 解決
- `src/features/x/likes-import-controls.ts`: import フローからも同様にキュー登録
- 連投保存ボタン経由（Task 4）でもキュー登録（DOM 抽出が page truncation で取り逃した分の fallback）
- de-dup: 既に同じ `thread_root_id` で `pending` / `in_progress` がある場合は登録しない

## Acceptance

- [ ] サンプル 1〜3 のいずれの中央 ID を単発保存しても、5 s 後にチェーン全件揃う
- [ ] likes import 中に self-reply 候補があればキューが登録される（実機確認）
- [ ] 単発投稿（リプライ先なし）はキューに乗らない
- [ ] de-dup により同じ root に対する重複 entry が生成されない
- [ ] 既存の通常保存 / likes import 体感速度がリグレッションしない（キュー登録は同期一瞬）
- [ ] `npm run typecheck && npm run build` pass

## References

- 設計: `tasks/thread-archive-plan.md` Task 8
- 依存: Task 0, Task 1b, Task 7
BODY
)" "${LABELS_BASE[@]}" "priority: medium" "area: background"

###############################################################################
# Task 9
###############################################################################
create "[task] Task 9: スレッドリポジトリクエリ getThread + hydrateThreadTree" "$(cat <<'BODY'
## Objective

`thread_root_id` でスレッド全体を取得し、ツリー（実態は単一チェーン）に整列するクエリ層を追加。

## Scope

- `src/db/repositories/posts-repository.ts`
  - `getThread(rootId: string): Promise<PostRecord[]>`
  - `thread_root_id` インデックスで全件取得 → `in_reply_to_post_id` でチェーン順にソート
- `src/features/archive/archive-service.ts` または `src/features/viewer/`
  - `hydrateThreadTree(rootId): Promise<ThreadedPostRecord>` 各 post にメディア・タグを付加
- `src/types/viewer.ts`: `ThreadedPostRecord` ビューモデル

## Acceptance

- [ ] `getThread(rootId)` が `thread_root_id === rootId` の全件を返す
- [ ] 配列順は root → ... → leaf
- [ ] 単独投稿（thread_root_id null）には影響しない既存クエリは残す
- [ ] `npm run typecheck && npm run build` pass

## References

- 設計: `tasks/thread-archive-plan.md` Task 9
- 依存: Task 1a
BODY
)" "${LABELS_BASE[@]}" "priority: medium" "area: db"

###############################################################################
# Task 10
###############################################################################
create "[task] Task 10: viewer スレッドカード（根のみ表示、全N件バッジ）" "$(cat <<'BODY'
## Objective

投稿一覧で連投は **根のみ表示**、「全N件」バッジを付ける。ランダムソート時も根しか抽選対象にならないようにする。

## Scope

- `src/features/viewer/components/thread-card.tsx` 新規
- `src/features/viewer/components/post-list.tsx`
  - スレッド根のみ表示にする group 化ロジックを追加
  - `thread_root_id !== null && x_post_id === thread_root_id` のレコードだけを 1 列として扱う
- 根のカードに「全N件」バッジ（N は同 root の件数）

## Acceptance

- [ ] 一覧で連投の根だけ出現、途中コマは出ない（デフォルト）
- [ ] 「全N件」バッジが表示される
- [ ] ランダムソートで根のみ抽選される（途中コマがランダム単独表示されない）
- [ ] 単独投稿の表示はリグレッションしない
- [ ] `npm run typecheck && npm run build` pass

## References

- 設計: `tasks/thread-archive-plan.md` Task 10
- 依存: Task 9
BODY
)" "${LABELS_BASE[@]}" "priority: medium" "area: viewer"

###############################################################################
# Task 11
###############################################################################
create "[task] Task 11: viewer インライン展開（クリックで縦に全コマ）" "$(cat <<'BODY'
## Objective

スレッドカードをクリックで展開し、縦に全コマを時系列順で並べて読める UI。

## Scope

- `thread-card.tsx` に展開トグル（local state）
- 展開時は内部で既存 `PostCard` を順に並べる
- 展開状態は URL に載せない（コンポーネントローカル）

## Acceptance

- [ ] クリックで展開、再クリックで畳まれる
- [ ] 展開時に root から末端まで順番に並ぶ
- [ ] スクロール位置や他のカードの状態に副作用なし
- [ ] `npm run typecheck && npm run build` pass

## References

- 設計: `tasks/thread-archive-plan.md` Task 11
- 依存: Task 10
BODY
)" "${LABELS_BASE[@]}" "priority: medium" "area: viewer"

###############################################################################
# Task 12
###############################################################################
create "[task] Task 12: viewer lightbox 拡張（i/N + 「Xコマ目/全Nコマ」）" "$(cat <<'BODY'
## Objective

既存 `media-lightbox.tsx` を拡張し、複数画像表示時に `i / N` ページインジケーター + 連投時の「Xコマ目 / 全Nコマ」オーバーレイを表示する。連投の全画像をひとつの slideshow として `←/→` で送れるよう、entry point を「スレッドカードからスライドで読む」ボタンとして追加。

## Scope

- `src/features/viewer/components/media-lightbox.tsx`
  - 既存の `←/→` キー送り、prev/next ボタンはそのまま流用
  - オーバーレイ追加（`i / N`、所属投稿情報）
- `thread-card.tsx`
  - 「スライドで読む」ボタンを追加
  - 押下で連投全コマの `MediaRecord[]` を結合して既存 `setActiveMedia()` に渡す
- 単独投稿の複数画像 lightbox にも `i / N` インジケーターは表示する（小改善）

## Acceptance

- [ ] 連投の全画像が `←/→` で連続して送れる
- [ ] `i / N` が常に正しい
- [ ] 連投時のみ「Xコマ目 / 全Nコマ」が出る、単独時は出ない
- [ ] 既存の単独複数画像 lightbox がリグレッションしない
- [ ] `npm run typecheck && npm run build` pass

## References

- 設計: `tasks/thread-archive-plan.md` Task 12
- 依存: Task 10
BODY
)" "${LABELS_BASE[@]}" "priority: medium" "area: viewer"

###############################################################################
# Task 13
###############################################################################
create "[task] Task 13: viewer 「単発のみ／連投のみ」フィルター" "$(cat <<'BODY'
## Objective

投稿一覧に「すべて / 単発のみ / 連投のみ」3 値の絞り込みフィルターを追加。

## Scope

- `src/features/viewer/components/use-sort-filter.ts` または該当 filter UI
- `thread_root_id === null` を「単発」、それ以外（かつ x_post_id === thread_root_id）を「連投の根」として扱う
- 既存ソート・既存検索と組み合わせ可能

## Acceptance

- [ ] 3 値が UI で切り替えられる
- [ ] フィルタ結果が正しい
- [ ] 既存ソート（newest / oldest / random など）と独立に動く
- [ ] `npm run typecheck && npm run build` pass

## References

- 設計: `tasks/thread-archive-plan.md` Task 13
- 依存: Task 10
BODY
)" "${LABELS_BASE[@]}" "priority: low" "area: viewer"

###############################################################################
# Task 14
###############################################################################
create "[task] Task 14: viewer 「未取得分あり / 再取得」ボタン" "$(cat <<'BODY'
## Objective

GraphQL fetch が失敗した連投や、まだ展開キュー処理待ちのスレッドで viewer から再キュー化できる UI。

## Scope

- スレッドカードに状態表示:
  - `thread_expand_queue` に当該 `thread_root_id` の `failed` がある → 「再取得失敗 / もう一度」
  - 当該 root のキュー未消化（`pending`）→ 「展開待ち」表示
  - 取得済みのみ → 通常表示
- 押下で該当 entry を `retry_count=0`, `status='pending'`, `next_attempt_at=now` に戻して worker に再消化させる

## Acceptance

- [ ] 失敗状態のスレッドにラベルが出る
- [ ] 押下後ラベルが「展開待ち」に切り替わる
- [ ] worker が消化したら通常表示に戻る
- [ ] `npm run typecheck && npm run build` pass

## References

- 設計: `tasks/thread-archive-plan.md` Task 14
- 依存: Task 7, Task 10
BODY
)" "${LABELS_BASE[@]}" "priority: low" "area: viewer"

###############################################################################
# 親 issue
###############################################################################
{
  echo "## Objective"
  echo
  echo "X の連投（漫画コマ・self-reply チェーン）を OP 投稿者本人のみ抽出して保存・閲覧できるようにする。likes import / 通常保存中も自動で続編まで揃える。"
  echo
  echo "## Background"
  echo
  echo "spike 完了済み。隠れタブ DOM 抽出は不採用、TweetDetail GraphQL 直叩き + per-user-action throttling (1 req/5 s) で確定。詳細は \`docs/findings/2026-04-26-thread-archive-spike.md\`。"
  echo
  echo "## Scope"
  echo
  echo "- 設計書: \`tasks/thread-archive-plan.md\` (v3)"
  echo "- ブランチ: \`feat/thread-archive-design\`（design + findings + 本スクリプト）"
  echo
  echo "## Sub-tasks"
  echo
  for entry in "${CREATED[@]}"; do
    num="${entry%%|*}"
    title="${entry#*|}"
    echo "- [ ] #${num} ${title}"
  done
  echo
  echo "## Critical path"
  echo
  echo "Task 0 → 1a → 2 → 3 → 4 → 9 → 10 → 11"
  echo
  echo "## Definition of Done"
  echo
  echo "すべての子 Issue が close されたとき、本 Issue を close する。実機確認:"
  echo "- サンプル 1〜3 で「連投を保存」が機能"
  echo "- likes import で self-reply 候補が後追いで揃う"
  echo "- viewer でランダムソート時も連投が分断されない"
} > /tmp/parent-issue-body.md

PARENT_URL=$(gh issue create --title "[epic] スレッド（OP self-reply）アーカイブ機能" \
  --body-file /tmp/parent-issue-body.md \
  --label "status: todo" --label "owner: claude" --label "type: feature" \
  --label "priority: high" --label "area: other")

echo
echo "Parent issue: $PARENT_URL"
echo
echo "=== Created child issues ==="
for entry in "${CREATED[@]}"; do
  echo "  #${entry%%|*}  ${entry#*|}"
done
