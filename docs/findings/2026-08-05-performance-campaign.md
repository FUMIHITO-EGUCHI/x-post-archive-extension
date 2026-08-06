---
date: 2026-08-05
related-issue: 126
status: open
---

# パフォーマンス計測キャンペーン（実データ 20GB / 19,295 posts）

環境: shared CDP profile / Chrome 150 / AdGuard 無効化済み / A = master + #126 計装、B = master + PR #122〜#127 統合。
計測 script: `scripts/perf-campaign-*.mjs`、raw 結果: `scripts/results/perf-*.json`。

## 1. Restore（B 方式・忠実）

- 20GB ZIP → **11 分 0 秒**（19,295 posts / 19,137 media / 1,633 tags / 37,688 post_tags）
- 進捗はほぼ全編 media OPFS 書込（スループット ~30MB/s）
- 障害 1 件: Playwright 接続下では `window.confirm` が自動 dismiss され restore が無反応に見える（計測側 dialog handler で解決。実運用には無関係）

## 2. v19 migration + 同一性（#120 acceptance）

- migration: **初回メッセージ 16.3 秒**（一回限り。backfill 19,295 件 + `[x_post_id+thread_root_id]` 索引構築 + summary 込み）
- 同一性: totalCount / 先頭 100 id / author 上位 5 件数 / tag 件数 / thread 構成 — **最終 B ビルドまで全比較で完全一致**

## 3. SW クエリ A/B（詳細は issue #120 コメント）

- 最終結果: **B は A と同等〜微改善**（list 初回 339→301ms、tag filter 756→727ms、keyword 555→528ms）
- 過程で B 初版の 2 倍悪化（list 601ms）を検出し 3 段階で修正（PR #125: getAllKeys 化 → count ガード除去 → thread count 配管）
- 教訓: IDB は **per-entry cursor IPC が支配コスト**（19k 全走査実測 256ms、index.count 98ms、getAllKeys 36-118ms）。「索引化 = 速い」は成立しない。実測なき merge は 2 倍悪化を本番投入していた
- **真のボトルネック**: `users/summaries` N+1（authors 12,145 → **p50 13〜45 秒**、実行中 SW 専有で後続 30 秒級巻き込み）→ #121 M3 を priority: high 化。viewer 初回カード表示 ~10.5 秒の支配要因もこれ（両ビルド同等のため描画側ではない）

## 4. viewer 描画 A/B（詳細は issue #119 コメント）

300 カード表示、60 秒窓、CDP Performance.getMetrics:

- idle scripting **677ms → 4ms（-99%）**、総 main-thread 9,673→752ms。A は無操作でも main thread の 16% を常時消費していた
- refetch 待機中（1s tick）scripting 2,752→65ms（-98%）
- 削除: A は 250 件表示から削除しても件数が減らない（切り詰め reload）、B は 250→249 正常
- 新規観測: **reload 系経路（refetch 完了・tag rename 等）の 250 件 cap は未対応で残存**（M1 は削除経路のみ）

## 5. X 保存フロー（#126 計装の実働確認込み）

click→Saved（各カテゴリ 5 件、20/20 成功）:

| カテゴリ | p50 | max |
|---|---|---|
| text | 47ms | 170ms |
| image | 132ms | 155ms |
| video | 51ms | 88ms |
| quote | 41ms | 54ms |

- 内訳（stage_timings）: extraction p50 **6ms** / save RTT p50 **16ms** / media fetch+hash+OPFS p50 **51ms**（max 293ms）/ preamble slow **0 件**
- **「保存が遅い」は健全 SW + pending media なしでは再現せず**。容疑（media warmup 直列 decode、preamble の 24 並列 fetch 誘発）は「pending media が積み上がった状態」でのみ発症する条件付き問題と判断。bulk import 中の再計測は今後の課題

## 6. like/bookmark 連動（ユーザー報告の本命）

- **12 秒待ちで 35% が no_signal**（20 like 中 fired 13）— ただし miss ログも一切なし = リクエスト自体が飛んでいない
- **20 秒待ち + ゆっくり操作では 6/6 全発火 + FavoriteTweet リクエスト全観測**
- 結論: **拡張の interceptor はリクエストが飛べば 100% 検知**（計 26 like で miss 0 件、8 容疑はいずれも現行 X client では発生せず。lightbox 文脈でも article_not_found 起きず）
- **取りこぼしの正体は X client 側のリクエスト遅延/デバウンス**: like 直後に unlike・ページ遷移・タブ閉じが挟まると FavoriteTweet が送信されないままになる（その場合 X 上の like 自体も確定していない可能性が高い）。拡張はネットワークに乗らないものは観測不能
- 対応案: 拡張側での根治は不可。緩和するなら「like UI イベント（DOM）でも予約し、interceptor 確認で確定する」二段方式だが、X 側で like が確定しない場合に保存だけ残る不整合を生む。現状の挙動（ネットワーク確定ベース）は正確性優先として妥当 → ユーザー向けには「like 直後の即離脱で保存されないことがある」という説明が正解
- bookmark 同条件テスト（20 秒待ち・N=5）: **5/5 全発火**、CreateBookmark リクエスト全観測、miss 0 件、全件解除済み。like と同結論

### 追補（2026-08-06）: lightbox 経路の訂正 → #128

上記「interceptor はリクエストが飛べば 100% 検知」は **timeline / detail ページに限る**。ユーザー指摘を受けた狙い撃ち再試験（timeline から画像クリックで開いた実フローの lightbox、N=5、20 秒待ち）で:

- **0/5 発火**。うち **3/5 は FavoriteTweet リクエストがネットワーク上に実在**するのに stage_timings も miss ログも皆無 = MAIN world パッチを通らない経路
- 裏取り: x.com は自前 SW（`x.com/sw.js`）がページ制御中。拡張パッチは有効（fetch/XHR とも patched 確認）→ lightbox の action は X の SW/worker コンテキスト発行で構造的に不可視
- 前回 lightbox テスト（3/5 発火）は `/photo/1` へ**直接遷移**しており DOM/コード経路が実フローと異なっていた
- 対応: **#128 起票**（webRequest 観測 fallback を推奨修正として記載）。12 秒窓での timeline no_signal 35% も一部はこの SW キュー遅延で説明がつく可能性がある

## 成果物・環境

- 計測 script 一式: `scripts/perf-campaign-{setup-restore,restore,snapshot,queries,migrate,render,save,likes,likes-net}.mjs`
- A/B ビルド退避: `.perf-builds/{a-baseline,b-integration}`
- 実行済み like/bookmark は全件解除確認済み（`failedUnlikes: []`）
