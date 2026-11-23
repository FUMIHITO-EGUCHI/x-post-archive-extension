# AI 実行制御レイヤー

`docs/handoff/README.md` の上に乗る薄い層。**Issue 管理は SoT**のまま、Claude Code / Codex への仕事の振り方とコスト管理だけを扱う。

自作スクリプトは置かない。**GitHub / Anthropic 公式と既存ツールの組み合わせ**で成立させる。

---

## 1. 全体像

```
GitHub Issue / PR
   │
   ├─[@claude mention]─▶ claude-mention.yml       → 質問/調査/実装（track_progress）
   └─[pull_request]───▶ claude-pr-review.yml      → 5軸レビュー

ローカル CLI:
   Claude Code (Opus 4.7 主担当: 調査・要件整理・ブラウザデバッグ)
   Codex      (実装担当)
```

---

## 2. Workflows

### 2.1 `claude-mention.yml`

- 発火: コメント本文に `@claude` を含む / Issue が `claude` に assign された
- やること: 依頼内容に応じて応答（質問 / 調査 / 実装 / レビュー）
- 進捗管理: `track_progress: true` が自動でコメント1件を upsert する。**人間/他 AI はそのコメントを触らない**
- 完了時: 結果を短く 1 コメントで残す。ラベルは付けず、Issue は close しない
- 触らない: close / objective・scope・checklist 以外の本文編集 / `--no-verify` による hook 回避

### 2.2 `claude-pr-review.yml`

- 発火: `pull_request: opened / synchronize / ready_for_review`（draft は除外）
- やること: 5軸（correctness / readability / architecture / security / performance）で diff レビュー、重要箇所に inline comment、軽微指摘は summary 1件
- 触らない: merge / close / approve

---

## 3. Claude Code / Codex の役割分担

| 場面 | 担当 | 備考 |
|---|---|---|
| 要件整理 / 設計判断 / 根本原因調査 | Claude Code (Opus) | ローカル or @claude mention |
| ブラウザ / CDP デバッグ | Claude Code | DevTools MCP を持つ |
| 実装 | Codex | Issue 本文に `implement:` で明示 |
| 差分レビュー | Claude (Action) | claude-pr-review.yml |
| ドキュメント整理 / コミット整形 | Codex or Claude | どちらでも可 |

ルーティングを workflow 単位で固定化したくなったら **`github/gh-aw` (GitHub Agentic Workflows)** で engine を `codex` に切り替えた workflow を追加する。MVP では未導入。

---

## 4. モデル選択

作業の複雑さと利用可能な手段を踏まえ、人間が実行時に選ぶ。

---

## 5. コスト管理（任意）

### `claude-code-router` (CCR)

ローカル CLI のコスト上限管理プロキシ。Opus を本当に必要なときだけ呼び、それ以外は安いモデルへ振る。MVP では強制しない。導入時は CCR README を参照。

### `ccusage`

セッション単位の使用量集計。

```bash
npx ccusage@latest
```

必要に応じて使用量と手戻りの理由を振り返る。

---

## 6. やってはいけないこと

- Action から Issue を close する（対話中の AI はユーザーの明示指示があれば close を代行してよいが、Action にはその指示を受け取る経路がないため常に対象外）
- Action から PR を merge / approve する
- `track_progress` コメントを手書きで触る
- 自作の issue-pack / ai-state スクリプトを作る（公式 Action が代替）

---

## 7. セットアップ

1. `sh scripts/setup-hooks.sh` で hooks を設定する。
2. Claude Code CLI で `/install-github-app` 実行 → `CLAUDE_CODE_OAUTH_TOKEN` secret が自動登録
3. **副作用で生成される `claude-code-review.yml` は削除**（`claude-pr-review.yml` と重複）
4. 各 workflow の `with:` に `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}` が配線済みであること
5. claude-code-action を呼ぶ workflow ファイルは **default branch と PR branch で内容を一致させる**。
   一致しない PR では action が実行前に自分を止める（claude-code-action のセキュリティ仕様）

```
Skipping action due to workflow validation: Workflow validation failed. The workflow file must
exist and have identical content to the version on the repository default branch.
```

**このとき check は失敗せず、warning 付きで success になる。** レビューが一度も走っていないのに
PR 上では緑に見える。以前ここには「401 になる」と書いてあったが誤りで、赤い × を探しても出てこない。
PR #138（Issue #137）で実測した挙動。

したがって `claude-*.yml` 自身を変更する PR は **AI レビューを受けられない**。人間が差分を読むか、
merge して default branch を揃えたあとに追随の PR でレビューさせる。merge 後は内容が一致するので
次の PR から通常どおり動く。

workflow 側に `anthropic_api_key:` は **書かない**（OAuth 経由で認証）。

### 将来検討：Anthropic API キー導入

CI 利用がサブスク枠を圧迫する／コスト予測を独立させたいときは、従量課金の API キーに切替検討する。

判断基準（どれかに該当したら検討）:
- claude-code-action 起動でローカル Claude Code が頻繁にレートリミットに当たる
- 月次の使用量振り返り（`ccusage`）で CI 起動の比重が高い
- サブスクと CI のコストを会計上分離したい

切替手順:
1. <https://console.anthropic.com/> で API キー発行 → クレジット購入
2. リポジトリ Settings → Secrets → `ANTHROPIC_API_KEY` を登録
3. 各 workflow の `with:` に `anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}` を追記

---

## 8. Human acceptance（ADR-0003 3点ゲート）

人間がコードを読まずに accept できる前提で運用する。3点ゲート全部通過で完了：

1. **AI review OK** — `claude-pr-review.yml` の 5軸レビュー（correctness / readability / architecture / security / performance）通過
2. **CI green** — typecheck / build / test pass
3. **Human evidence verification** — Issue Template の "Evidence of acceptance" 手順を AI が実機で実行し、出力／スクショ／ログを Issue に貼った状態を、人間が確認

人間がやること：

- Issue 作成時に「コードを読まずに accept できる手順」を Evidence 欄に記入する
- AI が共有した evidence を見る
- 期待挙動と一致すれば close を判断する
- 不一致なら理由をコメントし、必要な修正を依頼する

人間がやらないこと：

- コードの正しさを読んで判定する（review agent と CI に任せる）
- アーキテクチャ妥当性を読んで判定する（review agent に任せる）

---

## 9. Learning loop（ADR-0003）

### 9.1 PR ごとの Learning notes

`claude-pr-review.yml` が PR レビュー末尾に "## Learning notes for the human" セクションを自動生成する。最大3概念 + 公式ドキュメントリンク + 1分で試せる小実験。Hallucination 抑制のため「リンク提供不可なら出さない」が prompt に明記してある。

### 9.2 月次学習ログ

`docs/learning/YYYY-MM.md` を月1ファイルで作成。月末に AI に集約を依頼：

```
@claude この月（YYYY-MM）の closed Issue / merged PR から、Learning notes に出てきた概念を集約して docs/learning/YYYY-MM.md に追記して
```

人間は「自分で説明できるか」チェックボックスを埋める。埋まらなければその月の理解が浅い証拠。

### 9.3 `@claude explain` 質問テンプレ

理解が浅いコードを読みたいときは、`claude-mention.yml` 経由で以下の形式で質問する：

```
@claude explain
- file: <path>
- what I think it does: <自分の理解を先に書く>
- where I'm stuck: <分からない部分>
- learning level: 言語は分かるが <stack> は初見
```

「自分の理解を先に書く」のがコツ。書けない時点で読めていないと自覚できる。

### 9.4 並行する読書

AI 説明だけでは抽象的な体系が抜けるため、PJ で使う主要ライブラリ・言語の入門書を1冊だけ並行で進める。AI の説明はその索引として機能する。

---

## 10. 参考

- claude-code-action: <https://github.com/anthropics/claude-code-action>
- solutions guide: <https://github.com/anthropics/claude-code-action/blob/main/docs/solutions.md>
- gh-aw (GitHub Agentic Workflows): <https://github.github.com/gh-aw/>
- model picker changelog: <https://github.blog/changelog/2026-04-14-model-selection-for-claude-and-codex-agents-on-github-com/>

