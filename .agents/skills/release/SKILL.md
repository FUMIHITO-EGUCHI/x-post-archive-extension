---
name: release
description: リリース手順を実行する（バージョニング、リリースノート作成、zip生成など）
disable-model-invocation: true
argument-hint: "[version]"
---

# /release — リリース手順

引数としてバージョン番号を受け取る（例: `/release 0.17.0`）。
引数がない場合は現在の package.json のバージョンを確認してから、次のバージョンをユーザーに確認する。

以下の手順を順番に実行すること。各ステップを完了したら次へ進む。

---

## 手順

### 1. 事前確認

- `git status` でワーキングツリーが clean か確認する
- 未コミットの変更があればユーザーに通知して停止する
- 現在のブランチ名を確認する（master でないことを想定）

### 2. ビルド検証（現在のブランチで）

```bash
npm run typecheck
npm run build
```

エラーがあれば停止してユーザーに報告する。

### 3. master へのマージ

```bash
git checkout master
git merge --no-ff <feature-branch> -m "Merge branch '<feature-branch>' for release vX.Y.Z"
```

### 4. package.json のバージョン更新

`package.json` の `"version"` フィールドを新しいバージョン番号に書き換える。
`wxt.config.ts` にはバージョン記載がないため変更不要。

### 5. リリースノートの作成

`docs/release-notes/vX.Y.Z.md` を新規作成する。

既存リリースノートのフォーマット（v0.16.2.md 参照）に従うこと：

```markdown
# vX.Y.Z

## ユーザーにとって良くなったこと

- （ユーザー視点での改善点を箇条書き）

## 修正内容

- （技術的な変更点を箇条書き）

## 詳細

（背景・経緯・確認方法などの説明文）

## 含まれる変更

- （git log を参照して含まれるコミットを要約）
```

`git log master...<feature-branch>` または merge 前の diff からコミット一覧を確認してリリースノートを作成する。

### 6. バージョン更新をコミット

```bash
git add package.json docs/release-notes/vX.Y.Z.md
git commit -m "chore: release vX.Y.Z"
```

### 7. バージョンタグの付与

```bash
git tag vX.Y.Z
```

### 8. 配布物の生成

```bash
npm run zip
```

成功したら `.output/` 配下に zip ファイルが生成されることを確認する。

### 9. push 確認と実行

以下を報告してユーザーに push 可否を確認する：
- マージ元ブランチ名
- 新バージョン
- タグ名
- zip ファイルのパス

ユーザーが承認したら実行する：

```bash
git push
git push --tags
```

### 10. GitHub Release の作成

push 完了後、`gh release create` で GitHub Release を作成する。
リリースノート本文は `docs/release-notes/vX.Y.Z.md` の内容を使用する。

```bash
gh release create vX.Y.Z \
  --title "vX.Y.Z" \
  --notes-file docs/release-notes/vX.Y.Z.md \
  .output/<zip-filename>
```

`.output/` 配下の zip ファイルをリリースアセットとして添付する。
成功したら GitHub Release の URL をユーザーに報告する。

---

## 注意事項

- `git push --force` は使わない
- push はユーザーの確認を得てから行う
- zip 生成失敗はブロッカーとして扱う（typecheck / build と同様）
- `gh release create` 失敗時はユーザーに報告して手動対応を促す
