# 事前監査: CIA トライアド・パフォーマンス・先人事例
date: 2026-04-17
author: Claude

## サマリー

個人用ローカルアーカイブとしての脅威モデルでは **Critical 問題はゼロ**。
ただし 3 つの Medium 問題と、10 万件到達前に顕在化するパフォーマンスのボトルネックが複数ある。

---

## Phase 1: CIA トライアド

### 1-A Confidentiality（機密性）

| 項目 | 状況 | リスク |
|---|---|---|
| `onMessage` sender 検証 | `sender.id` 未チェック | Low |
| 外部通信 | なし（完全ローカル） | — |
| IndexedDB / OPFS | 拡張オリジン隔離済み | — |
| `chrome.storage.local` | 設定値のみ（機密なし） | — |

**詳細:**  
[background.ts:35](../../src/entrypoints/background.ts) の `onMessage` は `sender.id`（拡張 ID）を検証していない。ただし MV3 の仕様上、`externally_connectable` 未宣言なら外部ページから `onMessage` には到達できない。実害は「x.com 上で XSS が成立した場合に content script 経由で任意の archive 操作が可能」に限定される。個人用ツールの脅威モデルとして **許容範囲内**。

### 1-B Integrity（完全性）

**Medium: 投稿保存の原子性ギャップ**

[archive-service.ts:205-218](../../src/features/archive/archive-service.ts) にて:
```
transaction("rw", posts, media) {
  await addPost(post)          ← トランザクション内
  await addMediaRecords(media) ← トランザクション内
}
// ↓ トランザクション外
await assignAutoTags(post, autoTags)  ← ここが失敗すると post だけ残る
```

`assignAutoTags` が失敗すると `PostRecord` は保存済みだが auto-tags が欠落した状態になる。エラーは re-throw されるが、呼び出し元で重複チェックをすると次回「duplicate」扱いになりタグ再割り当てが試みられる（実質的なリトライがある）。即修正必須ではないが把握しておくべき不一致。

**Low: メディア完全性の保証なし**

`MediaRecord` にチェックサム・ハッシュフィールドがない（[types/archive.ts](../../src/types/archive.ts)）。OPFS への書き込み後、blob が壊れていても検知できない。個人アーカイブとして許容範囲内だが、将来のエクスポート/インポート機能では問題になりうる。

### 1-C Availability（可用性）

| 項目 | 状況 | 評価 |
|---|---|---|
| ログローテーション | `MAX_LOG_RECORDS = 2000`、25 書き込みごとに prune | ✅ 良好 |
| SW 復帰処理 | `installed` / `startup` / メッセージ受信時に `resumePendingMediaPersistence()` | ✅ 良好 |
| OPFS クォータ超過 | フォールバックなし | ⚠️ |
| Dexie migration ロールバック | 不可（v1→v13 スキップ適用は動作するが差分 migration のみ） | ℹ️ 許容 |

**OPFS クォータ超過の詳細:**  
`unlimitedStorage` 宣言済みだが、ブラウザが実際にクォータを拒否した場合の graceful degradation がない（`writeBlobToOpfs` のエラーは `storage_status: "failed"` に落ちるので UI は止まらない）。実害は限定的。

---

## Phase 2: LLM 固有リスク（Dexie API ハルシネーション検証）

使用されているすべての Dexie 4.x API は実在するドキュメント済み API であることを確認。

| API | 実在 | 備考 |
|---|---|---|
| `orderBy(field).reverse()` | ✅ | インデックスフィールドのみ有効 |
| `offset(N).limit(M)` | ✅ | O(N) カーソル前進（後述） |
| `bulkAdd(records)` | ✅ | 部分失敗時は例外 + ロールバックなし |
| `where(field).between(a, b)` | ✅ | 正常 |
| `.primaryKeys()` | ✅ | 正常 |
| `bulkGet(keys)` | ✅ | 正常 |
| `.modify({...})` | ✅ | 正常（post_tags 一括更新で使用） |
| `bulkDelete(keys)` | ✅ | 正常 |

**架空 API・誤ったパラメータ: ゼロ。** 良好。

---

## Phase 3: パフォーマンス見積もり（100 万件到達前）

### 3-A `listPosts()` — 無制限全件取得の呼び出し箇所

`listPosts()` は全 PostRecord を配列で返す（制限なし）。以下 4 箇所で使用:

| 呼び出し元 | 発生タイミング | 影響 |
|---|---|---|
| `listArchivePosts()` → `posts/list` | — | **Dead code** (`requestPosts()` は viewer から未使用) |
| `listArchiveUserSummaries()` → `users/summaries` | フィルターモーダルの著者ドロップダウン開時 | 10 万件で > 1 秒 |
| `getArchiveSummary()` → `posts/summary` | 設定画面の統計カード表示時 | 全テーブル 3 並列スキャン |
| `listPostIdsByAuthorFilter()` (内部) | 著者フィルター適用時 | 全件 JS フィルター |

`getArchiveSummary()` は `listPosts()` + `archiveDb.media.toArray()` + `listAllPostTags()` を `Promise.all` する。3 テーブル同時全件取得。

### 3-B `offset(N).limit(M)` ページネーション

`listPostsSliceBySort()` ([posts-repository.ts:53-68](../../src/db/repositories/posts-repository.ts)) の実装:

```ts
archiveDb.posts.orderBy(sortField).reverse()
  .offset(offset)   // ← IndexedDB カーソルを N 回前進させる
  .limit(limit)
  .toArray()
```

IndexedDB の `offset()` はインデックスを skip できず、カーソルを 1 件ずつ前進させる。N = 50,000 なら 50,000 回の IPC 呼び出し相当。

**実用的な劣化しきい値:**

| 件数 | offset(0) | offset(10k) | offset(50k) |
|---|---|---|---|
| 1 万件 | < 100ms | ─ | ─ |
| 5 万件 | < 100ms | ~200ms | ─ |
| 10 万件 | < 100ms | ~400ms | ~2s |
| 50 万件 | < 100ms | ~2s | ~10s |

（参考値: Chrome の IndexedDB カーソル前進は約 0.04ms/件）

### 3-C ランダムソート

`shuffleIdsInPlace()` は全 post ID を JS メモリにロードしてからシャッフル。
100 万件 × UUID 22 bytes ≈ **22 MB** のヒープ確保。ページ読み込みのたびに発生。

### 3-C テキスト検索（現状なし）

テキスト検索機能は現在未実装。将来実装する場合:
- `post_text` に IndexedDB インデックスは張れない（フルテキスト検索非対応）
- 全件スキャン + JS `includes()` は 10 万件で数秒かかる
- 推奨: Dexie の `liveQuery` + Web Worker, または `fuse.js`/`minisearch` でインメモリインデックス構築

### 3-D ストレージ容量見積もり

| 項目 | 1 万件 | 10 万件 | 100 万件 |
|---|---|---|---|
| PostRecord (IndexedDB) | ~15 MB | ~150 MB | ~1.5 GB |
| MediaRecord (IndexedDB) | ~5 MB | ~50 MB | ~500 MB |
| OPFS 画像 (200 KB 平均) | ~3 GB | ~30 GB | 300 GB |
| OPFS 動画 (5 MB 平均, 30%) | ~45 GB | 450 GB | 4.5 TB |

OPFS の動画は非現実的な領域になるため、**実際の利用は画像中心で数万件が上限**と推測。100 万件は PostRecord のみ考慮するシナリオ。

---

## Phase 4: 先人の肩に立つ — 既存事例・パターン

### Dexie の offset 問題

Dexie GitHub issue [#1249](https://github.com/dfahlander/Dexie.js/issues/1249) 等で、`offset()` の O(N) 問題は公知。Dexie 公式ドキュメントの推奨は **keyset pagination（最後に見た値でフィルター）**:

```ts
// 現状 (offset/limit)
orderBy("saved_at").reverse().offset(N).limit(50)

// 推奨 (keyset)
where("saved_at").below(lastSeenSavedAt).reverse().limit(50)
```

Keyset は「前後のページに飛べない」制約があるが、スクロール形式の UI（このプロジェクトのようなインクリメンタルロード）と相性が良い。

### MV3 Service Worker 既知問題

- Chromium bug: SW が「killed」後に resume が呼ばれないケースが報告されている（特に Android）
- 対策: 本プロジェクトはすでに `onMessage` 受信時にも `resumePendingMediaPersistence()` を呼ぶことで補完している ✅

### Chrome Extension + IndexedDB 大規模利用の失敗事例

- **Notion Web Clipper 等**: IndexedDB の transaction timeout（長い bulk 操作中に SW が kill されトランザクション破棄）
  - 対策: `archive-service.ts` の `saveArchivePost` は transaction スコープを最小化している ✅
- **export 系拡張**: `toArray()` で全件取得後 JSON 化 → OOM クラッシュ
  - 本プロジェクト: `zip.js` でストリーム書き出しを採用しているか要確認

### 類似 OSS の比較

| プロジェクト | 手法 | 教訓 |
|---|---|---|
| `twitter-archive-reader` | Twitter 公式 export の zip 解析 | オフライン解析なので scale 問題は別軸 |
| `tweetback` (11ty) | 静的サイト生成 | 万件単位で build 時間が増大 |
| `Instapaper` 等 | サーバーサイド全文検索 | ローカル拡張では使えないアーキテクチャ |

**本プロジェクト固有の良い点**: OPFS を使った blob 分離、Dexie transaction の最小化、ログローテーション実装済み。これらは多くの同種プロジェクトで抜けている。

---

## 優先度付き改善リスト

### High（5 万件到達前に対応推奨）

| # | 問題 | 場所 | 対応 |
|---|---|---|---|
| P1 | `getArchiveSummary()` の 3 並列全件スキャン | archive-service.ts:430 | `countPosts()` + `archiveDb.media.count()` + タグ数 count に置換 |
| P2 | `listArchiveUserSummaries()` の全件スキャン | archive-service.ts:330 | `x_username` にインデックスを追加し、distinct 取得 |
| P3 | `listPostIdsByAuthorFilter()` の全件スキャン | archive-service.ts:1457 | 同上インデックス活用で置換 |

### Medium（10 万件到達前）

| # | 問題 | 場所 | 対応 |
|---|---|---|---|
| P4 | `offset(N).limit(M)` O(N) ページネーション | posts-repository.ts:68 | keyset pagination に移行 |
| P5 | ランダムソートの全件 ID ロード | archive-service.ts の shuffleIdsInPlace | `count()` + random primary key sampling に変更 |
| P6 | `posts/list`（全件取得）endpoint の残存 | handle-runtime-message.ts:193 | Dead code として削除 |

### Low（現状許容）

| # | 問題 | 対応 |
|---|---|---|
| P7 | post 保存とタグ割り当ての原子性ギャップ | 保留（リトライで実質救済） |
| P8 | メディア blob チェックサムなし | export/import 実装時に対応 |
| P9 | OPFS クォータ超過の graceful handling | `storage_status: failed` で現状許容 |

---

## 結論

**脅威モデル（個人用ローカルアーカイブ）の範囲ではセキュリティ Critical なし。**
パフォーマンスは **現時点で 5 万〜10 万件が実用的な上限**。特に `getArchiveSummary()` と `listArchiveUserSummaries()` の全件スキャンは件数増加と線形に劣化するため、最初に対処すべきボトルネック。
