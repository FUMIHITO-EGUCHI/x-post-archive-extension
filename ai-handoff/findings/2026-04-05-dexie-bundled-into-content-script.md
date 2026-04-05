# Findings: DexieがContent Scriptにバンドルされた原因調査

**日時**: 2026-04-05  
**調査者**: Claude  
**ブランチ**: feat/archive-viewer-followups

---

## 症状

Chrome拡張を読み込もうとすると以下のエラーが表示された:

> コンテンツ スクリプトのファイル「content-scripts/x.js」を読み込むことができませんでした。UTF-8 でエンコードされていません。  
> マニフェストを読み込めませんでした。

## 根本原因

`x.js`（isolated world content script）に Dexie が混入し、Dexie が内部的に使う U+FFFF (`\xef\xbf\xbf`) が content script ファイルに含まれた。Chrome の extension loader はこの Unicode 非文字を不正な UTF-8 として拒否する。

### import チェーン

```
src/entrypoints/x.content.ts
  └─ src/features/x/bootstrap-x-content-script.ts
       └─ src/features/logging/logger.ts          ← 未コミット作業で追加
            └─ src/db/repositories/logs-repository.ts
                 └─ Dexie                         ← U+FFFF を含む
```

### 混入タイミング

`createLogger` の import は HEAD コミット (`70ad5d2 feat: add bookmarks import`) には存在しない。  
**未コミットの作業ツリー**で `bootstrap-x-content-script.ts` に追加された。

具体的には、auto-archive トリガー機能（`LIKE_BOOKMARK_ACTION_EVENT` 受信 → `autoArchivePost`）の実装時に `createLogger("auto-archive")` が追加され、これが Dexie を引き込んだ。

`git diff HEAD -- src/features/x/bootstrap-x-content-script.ts` で未コミット変更を確認できる。

## 修正内容（適用済み）

`src/features/x/bootstrap-x-content-script.ts` から `createLogger` import を削除し、3か所の `autoArchiveLogger.*()` 呼び出しを `console.error` / `console.warn` に置き換えた。

- x.js サイズ: 151 kB → 48 kB
- Dexie・U+FFFF が x.js から消えたことを確認済み

## Codex への調査依頼

### 調査してほしいこと

1. **過去の git log で同様の問題が起きていたか**  
   `git log --all --oneline` と `git show <commit> -- src/features/x/bootstrap-x-content-script.ts` で、`createLogger` や他の Dexie 依存モジュールが content script に混入したことがあったか確認する。

2. **再発防止策の検討**  
   content script（`x.content.ts`, `x-main.content.ts`）のバンドルに Dexie が含まれないことを保証する仕組みを検討する。例えば:
   - ビルド後に `content-scripts/x.js` に `dexie` や `\uFFFF` が含まれないことを検証するスクリプト
   - `logger.ts` のアーキテクチャ変更（content script 向けには console のみ、background 向けには DB 書き込み）

3. **`logger.ts` の設計見直し**  
   `src/features/logging/logger.ts` が直接 `logs-repository`（Dexie）を import しているため、content script から誤って import されると必ず問題になる。  
   background 専用であることを明示する命名やディレクトリ配置（例: `src/features/logging/background-logger.ts`）に変更すべきか検討する。

## 関連ファイル

- `src/entrypoints/x.content.ts` — content script エントリポイント
- `src/features/x/bootstrap-x-content-script.ts` — 修正済み
- `src/features/logging/logger.ts` — Dexie 依存あり。content script から import 禁止
- `src/db/repositories/logs-repository.ts` — Dexie 直接依存
