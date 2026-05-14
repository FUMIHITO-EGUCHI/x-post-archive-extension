# Chrome Web Store Screenshots — Capture Workflow

CWS 提出用スクリーンショットを再現可能に撮影する手順。実機キャプチャ → 必要なら GPT Images で額装 / プロモ素材生成、という 2 段階を想定する。

---

## SC 構成（4 枚）

| # | 答える質問 | 構図 | 必要な状態 |
|---|---|---|---|
| 1 (hero) | これ何？ | viewer 一覧、ソート可視化、複数アカウント | demo archive 取り込み済み |
| 2 | どう使う？ | x.com 投稿に注入された保存ボタン（hover 状態） | x.com にサインイン、公開アカウントの投稿を開く |
| 3 | 他と何が違う？ | OP self-reply chain がインライン展開 | demo archive 内のスレッドを開く |
| 4 | 探せるの？ | キーワード検索 / フィルター適用後の絞り込み結果 | demo archive 取り込み済み |

サイズ：**1280 x 800 PNG**（CWS 推奨）

ロケール：**JP UI + 日本語投稿**（demo archive は JP）

---

## 準備

### 1. 拡張をビルド

```bash
npm run build
```

成果物：`.output/chrome-mv3/`

### 2. デモアーカイブ zip を生成

```bash
node scripts/build-demo-archive.mjs
```

成果物：`samples/demo-archive-backup.zip`（gitignore 配下）

- 投稿件数：~26 件（短文 12、中文 7、長文 3、OP self-reply スレッド 1 本 = 4 投稿）
- メディアなし
- 投稿日時：過去 6 ヶ月以内に散布

### 3. CDP 用 Chrome をクリーン起動

Windows 環境。既存 Chrome を一旦落として `.shared-cdp-profile/` でリモートデバッグポート 9222 を有効化して起動：

```powershell
$RepoRoot = "C:\path\to\x-post-archive-extension"  # ← 自分のリポジトリパスに書き換える
taskkill /F /IM chrome.exe
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir="$RepoRoot\.shared-cdp-profile" `
  --load-extension="$RepoRoot\.output\chrome-mv3"
```

> `.shared-cdp-profile/` は gitignore 配下。X セッション cookie が残っているのでサインイン状態のまま再開できる（SC 2 用）。

### 4. デモ archive を取り込み

1. ツールバーの拡張アイコンをクリック → viewer を開く
2. Settings → Archive maintenance → Restore archive backup
3. `samples/demo-archive-backup.zip` を選択、**Merge** モードで取り込み
4. 一覧画面に投稿が表示されることを確認

---

## キャプチャ手順

### 共通

- viewer の window サイズを 1280 x 800 に固定（DevTools の **Device toolbar → Responsive → 1280 x 800** で揃える）
- ブラウザ chrome（タブ・URL バー・ブックマーク）は **写さない**。
  - viewer はフルページ HTML なので chrome-devtools の `take_screenshot` を `fullPage: false` で取れば viewport のみ保存される
  - もしくは Chrome 自体を全画面化 (F11) + Chrome タブ非表示モード
- 設定パネル / モーダルは閉じた状態に揃える（SC 4 を除く）

### SC 1（hero）— viewer 一覧

1. viewer のソートを「保存日 降順」、フィルタなしの初期状態
2. ヘッダの件数バッジが見える位置にスクロール
3. 1 画面に投稿 4〜6 件が入る密度で
4. キャプチャ：`screenshots/sc-1-viewer-list.png`

### SC 2 — x.com 上の保存ボタン

1. x.com にサインイン済みの状態で、公開アカウントの投稿を 1 件開く（@X 公式・@TwitterDev 等、商標含むがロゴ流用ではない範囲）
2. 投稿の下部に拡張が注入した保存ボタンが表示されるのを確認
3. マウスを保存ボタン付近にホバー（hover 状態を取りたい場合は CDP `Input.dispatchMouseEvent` 等で）
4. 保存ボタン + 投稿本文がフレームに収まる構図でキャプチャ：`screenshots/sc-2-save-button.png`

> 公開アカウントの投稿を例示するのは CWS 規約上 OK（X 商標・ロゴそのものは使わないこと）。

### SC 3 — スレッド展開

1. viewer 一覧で、demo archive のスレッド根（display: ゆきの "今日のコミケ戦利品まとめ。…"）を探す
2. クリックでインライン展開、4 投稿全部が見える状態に
3. キャプチャ：`screenshots/sc-3-thread.png`

### SC 4 — フィルター / キーワード検索

1. viewer のキーワード検索バーに「本」「コーヒー」「散歩」など demo archive にヒットする語を入力
2. 件数が絞り込まれた状態で
3. フィルターモーダルをわざと開かない（1 メッセージ原則）
4. キャプチャ：`screenshots/sc-4-search.png`

---

## 出力先

```
samples/screenshots/
├── sc-1-viewer-list.png
├── sc-2-save-button.png
├── sc-3-thread.png
└── sc-4-search.png
```

`samples/` は gitignore 配下。CWS にアップロードする際はローカルから直接送る。

---

## 次フェーズ：GPT Images による加工（任意）

実機 SC が確定したあとに、必要に応じて以下に GPT Images を活用：

| 用途 | GPT Images の使い方 | 工数 |
|---|---|---|
| SC 額装（外枠 + キャプション）| アイコンと同じ色 / モチーフの抽象背景を生成 → SC を中央に composite。文字は自前で乗せる | 小 |
| Promotional tile（440x280, CWS optional）| ブランド抽象アート | 小 |
| Marquee promo（1400x560, Featured 用）| 同上、横長 | 小 |
| README hero / GitHub social preview | コンセプトアート | 小 |
| Twitter / Bluesky 告知カード | 同上 | 小 |

詳細指針：

- **拡張 UI を GPT に描かせない**（CWS 規約 + 実機との乖離リスク）
- **文字は GPT 不使用**（崩れる）。後付けで Figma / PIL 等で composite
- **アイコン（Codex 製）のビジュアル要素**をプロンプトに固定（同色・同モチーフ）

---

## 出戻り時の再生成

archive 内容を変えて撮り直したい場合：

1. `scripts/build-demo-archive.mjs` の post 配列を編集して再実行
2. viewer Settings → Clear all data → 既存 archive を消去
3. 再度 Restore で新しい zip を取り込み

---

## 参考

- CWS 推奨サイズ：1280x800（最大 1280x800 / 640x400 のどちらか、5 枚まで）
- Promo tile：440x280
- Marquee：1400x560
- アイコン規約：[Branding guidelines](https://developer.chrome.com/docs/webstore/branding) — 公式 X ロゴ・Twitter 鳥は使わない
