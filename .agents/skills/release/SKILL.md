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

### 8. 配布物のローカル確認

```bash
npm run zip
```

`.output/x-post-archive-extension-<version>-chrome.zip` が生成されることを確認する。

これは事前確認であって、**配布される zip はこれではない**。GitHub Release に添付されるのは
`release.yml` が runner 上でビルドし直したものになる。ここで失敗するなら runner でも失敗するので、
push 前に気づくためのステップとして実行する。

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

### 10. release.yml の結果を確認する

**`gh release create` は実行しない。** tag の push で `.github/workflows/release.yml` が発火し、
lint / typecheck / test / build / zip を通したうえで GitHub Release を作成する。手で叩くと
tag 名が衝突して workflow 側が失敗する（Issue #135。v1.1.0 で実際に起きた）。

push 後、workflow の完了を確認する：

```bash
gh run list --workflow=release.yml --limit 1
gh release view vX.Y.Z
```

成功したら GitHub Release の URL をユーザーに報告する。
失敗していたらログを確認し、原因をユーザーに報告する。

---

## 注意事項

- `git push --force` は使わない
- push はユーザーの確認を得てから行う
- zip 生成失敗はブロッカーとして扱う（typecheck / build と同様）
- **GitHub Release の作成は `release.yml` が canonical**。この手順から `gh release create` を
  実行してはならない
- `release.yml` は tag 名と `package.json` の version が一致しない場合、
  `docs/release-notes/vX.Y.Z.md` が無い場合、version から導出した zip が無い場合に失敗する。
  ステップ 4〜8 を飛ばすとここで落ちる
- `release.yml` が失敗した場合はユーザーに報告して手動対応を促す
