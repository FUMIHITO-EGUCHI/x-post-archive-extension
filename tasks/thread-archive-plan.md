# 計画: スレッド（OP self-reply チェーン）アーカイブ機能

- Status: Draft v3 — spike 完了、案 B + user-trigger 限定で確定
- Date: 2026-04-26
- Spike findings: `docs/findings/2026-04-26-thread-archive-spike.md`

---

## 目的

X（旧 Twitter）で漫画のコマや連投のように、**同一投稿者が自分の投稿に連続でリプライしたチェーン**を保存し、後から順番に読み返せるようにする。

**対象**: 投稿者本人の self-reply チェーン（OP のポスト + OP が自分にリプライした続きの投稿）
**対象外**: 他人のリプライ、引用、ファンアート

## 想定ユースケース（実サンプル）

| パターン | 例 | 件数 | 間隔 | 特徴 |
|---|---|---|---|---|
| 手動連投（ゆっくり） | @kankan33333 | 3 | 数十秒〜分 | 投稿しながら追加 |
| 手動連投（短間隔） | @sino_sakisaki | 2 | 約1分 | 続編を直後に |
| Thread Compose | @tatsunoko_777 | 5 | 約2秒ずつ | X 標準機能、5コマ漫画 |

---

## 取得手段の方針（spike で確定）

### ❌ 不採用: 隠れタブ + DOM 抽出

`chrome.tabs.create({active:false})` で開いたタブは X が conversation 続編を描画しない（`Page.navigate` では描画される）。`active:true` / `windows.update({focused:true})` / `visibilityState` 偽装 / scroll 強制でも改善せず。詳細は findings 参照。

### ✅ 採用: TweetDetail GraphQL 直叩き

1. **MAIN world** で `fetch` / `XHR` を patch、ユーザーが X を使っている間に飛ぶ `/i/api/graphql/<id>/TweetDetail` request を template としてキャプチャ（URL / authorization / x-csrf-token / variables / features / fieldToggles）
2. 任意 focalTweetId で template を replay
3. 取得 JSON から OP filter（`core.user_results.result.rest_id === OP_user_id`）+ `legacy.in_reply_to_status_id_str` でチェーン構築
4. **隠れタブ不要**。background から `chrome.cookies` 経由で直接 fetch（host_permissions に x.com あり、`credentials:'include'` で auth_token 自動付与、ct0 を `x-csrf-token` に手動セット）
5. 単一 request でチェーン全件 + 後続続編まで一括取得（spike 実測 0.4〜1.0 s/req）

### 自動取得の起点（per-user-action 限定）

ToS / rate limit 緩和のため、**ユーザー操作起点でのみ**走らせる。自動 polling / cron は禁止。

| 起点 | 動作 |
|---|---|
| 連投ページの「連投を保存」ボタン押下 | DOM 抽出（即時） + GraphQL 補完（バックグラウンドキュー） |
| 単発「投稿を保存」押下 | 通常保存。self-reply 候補ならキューに登録 |
| 「いいね一括取得」押下 | 各投稿を保存。self-reply 候補ならキューに登録 |
| viewer の「未取得分あり、再取得」ボタン押下 | 該当 root をキューに再登録 |

### Throttle（安全寄り固定）

- **1 req / 5 s** の固定間隔
- 直列実行（worker は singleton）
- 連続失敗（429 / 401）で exponential backoff（5 s → 30 s → 5 min → fail）
- 3 回失敗で `status=failed` 保留、自動再試行なし。viewer から手動再キュー化のみ

---

## データモデル

```
posts テーブル（v16 で拡張）:
  in_reply_to_post_id?: string | null   # 直接の親ポスト ID
  thread_root_id?: string | null        # スレッド根の x_post_id

thread_expand_queue テーブル（v16 新規）:
  id: auto                              # primary key
  candidate_post_id: string             # キュー登録元の投稿 ID
  thread_root_id: string                # de-dup キー
  status: 'pending' | 'in_progress' | 'failed'
  retry_count: number
  last_error: string | null
  created_at: number
  updated_at: number
  next_attempt_at: number               # backoff 用

tweet_detail_template テーブル（v16 新規、シングルトン）:
  id: 'current'                         # 固定キー
  url: string                           # operation URL（query ID 込み）
  method: 'GET' | 'POST'
  headers: Record<string, string>       # authorization, x-client-transaction-id, etc.
  variables: Record<string, unknown>    # focalTweetId 以外の variables
  features: Record<string, unknown> | null
  fieldToggles: Record<string, unknown> | null
  captured_at: number
```

`x-csrf-token` は cookie ct0 から都度取るので template には含めない（保存時の値が古くなるリスク回避）。

---

## 依存グラフ

```
Issue #N1 Task 0: in_reply_to_post_id 抽出
    ↓
Issue #N2 Task 1a: posts スキーマ拡張
Issue #N3 Task 1b: queue / template テーブル追加
    ↓
    ├─→ #N4 Task 2: スレッドページ DOM 抽出関数
    │     ↓
    │     └─→ #N5 Task 3: 「連投を保存」ボタン
    │           ↓
    │           └─→ #N6 Task 4: posts/save-thread ハンドラ
    │
    ├─→ #N7 Task 5: TweetDetail template キャプチャ（MAIN world）
    │     ↓
    │     └─→ #N8 Task 6: TweetDetail GraphQL client
    │           ↓
    │           └─→ #N9 Task 7: thread_expand_queue worker（throttled）
    │                 ↑
    │                 └─ #N10 Task 8: 各保存経路からのキュー登録
    │
    └─→ #N11 Task 9: viewer リポジトリクエリ
          ↓
          ├─→ #N12 Task 10: スレッドカード（根のみ表示）
          ├─→ #N13 Task 11: インライン展開
          ├─→ #N14 Task 12: lightbox 拡張（i / N オーバーレイ）
          ├─→ #N15 Task 13: フィルター（連投のみ／単発のみ）
          └─→ #N16 Task 14: 「未取得分あり / 再取得」ボタン
```

**Critical path**（手動保存の最低限）: 0 → 1a → 2 → 3 → 4 → 9 → 10 → 11

**自動展開**: 1b, 5, 6, 7, 8 が揃った時点で likes import / 通常保存からも完取り

---

## チェックポイント

| CP | 完了タスク | 確認 |
|---|---|---|
| CP-A | #N1, #N2 | typecheck / build pass、既存保存リグレッションなし |
| CP-B | #N3, #N4, #N5, #N6 | スレッドページの「連投を保存」で IndexedDB に thread_root_id が入る |
| CP-C | #N7, #N8 | x.com 開いている状態で `chrome.runtime.sendMessage` 経由で任意 ID の TweetDetail を fetch、OP self-reply chain 全件返る |
| CP-D | #N9, #N10 | likes import / 通常保存後、5 s 間隔でキューが消化、未保存コマが揃う |
| CP-E | #N11〜#N16 | viewer でスレッドが一覧・展開・スライドショー、ランダムソートで分断されない |

---

## スコープ外（将来）

- 分岐ツリー（同じポストへ OP 自身が複数の続編を分岐させた場合）
- 他人のリプライアーカイブ（一定 like 数しきい値、ホワイトリスト等）
- スクロール自動化による超長尺連投の補完（GraphQL 1 req で取れる範囲を超える場合）
- スレッドエクスポート（ZIP）
- viewer 全文検索の連投コマ含み（初期は根のみ）
- キュー手動管理 UI（停止 / 優先度 / 個別失敗の再試行は viewer 側「再取得」ボタンのみ）
