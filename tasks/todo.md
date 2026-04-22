# TODO: AI 間タスク管理の GitHub Issues 化

Source: `tasks/plan.md`

## Phase A — GitHub 側準備

- [ ] **A1** ラベル 17 種を作成（human, 10 分）
- [ ] **A2** Projects v2 ボード「X Archive Handoff」作成（human, 15 分, deps: A1）
- [ ] **A3** `.github/ISSUE_TEMPLATE/` に task.yml / investigation.yml / bug.yml / config.yml を配置（AI, 30 分, deps: A1）

## Phase B — MCP 接続

- [ ] **B1** github-mcp-server を Claude と Codex 両方で接続し、test issue で疎通確認（human, 30 分）

## Phase C — pre-commit 改修

- [ ] **C1** `#<issue>` 必須の commit-msg hook を導入、`handoff:check` を `precommit:check` から除去（AI, 60 分）

## Phase D — 最小移行

- [ ] **D1** active/waiting の 1 packet を Issue 化し、原本を `ai-handoff/archive/migrated/` へ移動（AI, 30 分, deps: A1, A3, B1）

### ✅ Checkpoint α — 人間承認（新運用への切替）

## Phase E — ドキュメント差替

- [ ] **E1** `docs/handoff/README.md` を新規作成（handoff 雛形含む）（AI, 45 分, deps: Checkpoint α）
- [ ] **E2** `CLAUDE.md` と `.claude/rules/handoff.md` を Issue 運用に更新（AI, 30 分, deps: E1）

## Phase F — 運用試験

- [ ] **F1** 試験 #1 正常完走（typo 修正など）（AI + human close, 60 分, deps: E2）
- [ ] **F2** 試験 #2 blocked → handoff → close（AI×2 + human close, 60 分, deps: F1）

### ✅ Checkpoint β — 人間承認（旧資産撤去）

## Phase G — 旧資産撤去

- [ ] **G1** 旧 scripts と `ai-handoff/` 下のタスクファイル削除、`package.json` から handoff:* 撤去（AI, 30 分, deps: Checkpoint β）

---

## 合計見積

約 **6 時間**（人間作業 55 分 + AI 作業 5 時間）

## 即着手できるもの（並列）

- A1, A2（human）
- B1（human）
- A3, C1（AI: Claude or Codex）
