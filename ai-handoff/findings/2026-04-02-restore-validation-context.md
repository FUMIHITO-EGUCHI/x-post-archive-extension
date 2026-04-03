# Finding Note

## Summary

`fix/archive-review-findings` では restore の破壊性を下げる修正と `quoted_post_id` 復元対応が入っている。Claude はブラウザ手動確認に集中してよい。

## Compressed Findings

- 以前の restore は current archive を先に削除してから ZIP 展開していたため、途中失敗で archive 全損のリスクがあった
- 現在は backup file を staging path (`/media/restore-imports/<uuid>/...`) に書いてから DB を入れ替える
- DB 入れ替え後に旧 media file を best-effort cleanup するため、失敗時は「ゴミが残る」方向に倒れるが「既存 archive が消える」より安全
- backup import parser は `quoted_post_id` を復元するよう修正済み
- このブランチの `src/features/x/extract-post-from-article.ts` と related save flow には quoted-post 抽出実装自体が入っていない
- したがって、レビュー時に問題視した `history.pushState` / synthetic click fallback はこのブランチでは存在しない

## Recommended Manual Checks

- 正常な backup ZIP を export して restore し、一覧件数と主要 post の本文/画像が見えるか
- restore 前に別データを入れておき、restore で置換されるか
- 壊した ZIP か manifest 不整合 ZIP を読み込ませ、restore 失敗後に元データが残るか
- 可能なら backup ZIP の `manifest.json` に `quoted_post_id` を含むレコードを作り、restore がその項目で落ちないか

## Relevant Files

- `src/features/archive/archive-maintenance-service.ts`
- `src/types/archive.ts`
- `src/types/archive-backup.ts`
