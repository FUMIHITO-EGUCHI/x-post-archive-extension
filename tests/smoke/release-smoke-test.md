# リリース前スモークテスト手順書

## セットアップ

```
1. npm run build
Shared Profile rule: Manual browser verification must use the configured Shared Profile. Do not switch to Playwright Chromium, a temporary Chrome profile, or another isolated profile unless the user explicitly permits it for that run. If Shared Profile cannot execute a check, record the blocker instead of substituting another profile.
2. chrome://extensions/ → パッケージ化されていない拡張を読み込む → .output/chrome-mv3
3. 拡張 ID を記録 → 以降 <EXT_ID> と表記
4. ビューア URL: chrome-extension://<EXT_ID>/viewer.html
```

---

## グループ 1: 投稿保存

### TC-SAVE-01: テキストのみ投稿

**前提:** x.com ログイン済み。タイムラインにテキストのみの投稿が表示されている。

| # | 操作 | CDP ツール | 備考 |
|---|------|-----------|------|
| 1 | https://x.com/home を開く | navigate_page | |
| 2 | 拡張が注入した保存ボタンが出るまで待つ | wait_for | タイムライン読み込み完了後 |
| 3 | テキストのみ投稿の保存ボタンをクリック | click | |
| 4 | 完了フィードバックを待つ | wait_for | トースト or ボタン状態変化 |
| 5 | ビューアを開く | navigate_page | chrome-extension://\<EXT_ID\>/viewer.html |
| 6 | 投稿カードが存在するか確認 | evaluate_script | `document.querySelectorAll('[data-testid="post-card"]').length > 0` |

**判定:** step 4 でフィードバックあり。step 6 が `true`。

---

### TC-SAVE-02: 画像付き投稿

**前提:** タイムラインに画像付き投稿がある。

| # | 操作 | CDP ツール | 備考 |
|---|------|-----------|------|
| 1 | https://x.com/home を開く | navigate_page | |
| 2 | 画像付き投稿の保存ボタンをクリック | click | |
| 3 | 完了フィードバックを待つ | wait_for | |
| 4 | ビューアを開く | navigate_page | |
| 5 | 投稿カード内に画像が表示されているか確認 | evaluate_script | `document.querySelector('[data-testid="post-card"] img') !== null` |

**判定:** step 5 が `true`（blob: URL or OPFS 経由）。

---

### TC-SAVE-03: 動画付き投稿

**前提:** タイムラインに動画付き投稿がある。

| # | 操作 | CDP ツール | 備考 |
|---|------|-----------|------|
| 1 | https://x.com/home を開く | navigate_page | |
| 2 | 動画付き投稿の保存ボタンをクリック | click | |
| 3 | 完了フィードバックを待つ | wait_for | |
| 4 | ビューアを開く | navigate_page | |
| 5 | 動画サムネイルをクリックしてライトボックスを開く | click | |
| 6 | ライトボックスが開くまで待つ | wait_for | `<video>` 要素 |
| 7 | video[loop] を確認 | evaluate_script | `document.querySelector('video')?.loop === true` |
| 8 | 動画が自動再生されているか確認 | evaluate_script | `!document.querySelector('video')?.paused` |

**判定:** step 7, 8 ともに `true`。

---

### TC-SAVE-04: 引用投稿

**前提:** タイムラインに引用投稿がある（別投稿を引用したツイート）。

| # | 操作 | CDP ツール | 備考 |
|---|------|-----------|------|
| 1 | https://x.com/home を開く | navigate_page | |
| 2 | 引用投稿の保存ボタンをクリック | click | |
| 3 | 完了フィードバックを待つ | wait_for | |
| 4 | ビューアを開く | navigate_page | |
| 5 | 引用元ブロックが投稿カード内に存在するか確認 | evaluate_script | `document.querySelector('[data-testid="quoted-post"]') !== null` |

**判定:** step 5 が `true`。引用元テキストが入れ子で表示される。

---

## グループ 2: ビューア表示

### TC-VIEW-01: 投稿一覧表示

**前提:** 1 件以上保存済み。

| # | 操作 | CDP ツール | 備考 |
|---|------|-----------|------|
| 1 | ビューアを開く | navigate_page | |
| 2 | 投稿カード数を取得 | evaluate_script | `document.querySelectorAll('[data-testid="post-card"]').length` |

**判定:** step 2 が 1 以上。

---

### TC-VIEW-02: 絞り込みモーダルが開く

**前提:** ビューアが表示されている。

| # | 操作 | CDP ツール | 備考 |
|---|------|-----------|------|
| 1 | ツールバーの「絞り込み」ボタンをクリック | click | `.viewer-filter-open-button` |
| 2 | モーダルが表示されるまで待つ | wait_for | |
| 3 | タブが「ユーザー」「タグ」「日付」の 3 つ存在するか確認 | evaluate_script | モーダル内タブ数 |

**判定:** モーダルが開き 3 タブが表示される。

---

## グループ 3: タグ操作

### TC-TAG-01: タグ追加・即時反映

**前提:** 投稿が 1 件以上ある。フィルタなし状態。

| # | 操作 | CDP ツール | 備考 |
|---|------|-----------|------|
| 1 | 任意の投稿カードのタグ追加ボタンをクリック | click | |
| 2 | "smoketest" を入力して確定 | fill + press_key | Enter で確定 |
| 3 | ローディングインジケーターがないことを確認 | evaluate_script | 全件再ロードスピナーが出ていないこと |
| 4 | 投稿カードに "smoketest" タグが表示されているか確認 | evaluate_script | タグ欄に対象テキスト存在 |

**判定:** スピナーなしで即時反映される。step 4 が `true`。

---

### TC-TAG-02: タグフィルタ

**前提:** TC-TAG-01 完了済み（"smoketest" タグ付き投稿がある）。

| # | 操作 | CDP ツール | 備考 |
|---|------|-----------|------|
| 1 | 「絞り込み」ボタンをクリック | click | `.viewer-filter-open-button` |
| 2 | タグタブを開く | click | |
| 3 | "smoketest" を選択して適用 | click | |
| 4 | 表示件数を取得 | evaluate_script | `document.querySelectorAll('[data-testid="post-card"]').length` |
| 5 | 表示中の投稿すべてに "smoketest" タグがあるか確認 | evaluate_script | |

**判定:** step 4 が全件より少ない（または同数でも全件に smoketest タグがある）。step 5 が `true`。

---

### TC-TAG-03: タグ削除（フィルタ適用中）

**前提:** TC-TAG-02 のフィルタ状態（"smoketest" フィルタ中）。

| # | 操作 | CDP ツール | 備考 |
|---|------|-----------|------|
| 1 | フィルタ中の任意の投稿から "smoketest" タグを削除 | click | タグの削除ボタン |
| 2 | 削除した投稿が一覧から消えるまで待つ | wait_for | |
| 3 | 全件再ロードスピナーが出ていないことを確認 | evaluate_script | |

**判定:** 投稿がリストから即座に消える。スピナーなし。

---

## グループ 4: メディア

### TC-MEDIA-01: 画像ライトボックス

**前提:** 画像付き投稿が保存済み。

| # | 操作 | CDP ツール | 備考 |
|---|------|-----------|------|
| 1 | ビューアを開く | navigate_page | |
| 2 | 画像付き投稿のサムネイルをクリック | click | |
| 3 | ライトボックスが開くまで待つ | wait_for | `<dialog>` or モーダル要素 |
| 4 | 画像が表示されているか確認 | evaluate_script | `document.querySelector('dialog img') !== null` |
| 5 | Esc キーでライトボックスを閉じる | press_key | Escape |
| 6 | ライトボックスが閉じたことを確認 | evaluate_script | dialog が閉じている |

**判定:** step 4 が `true`。step 6 が `true`。

---

### TC-MEDIA-02: 動画ループ再生

**前提:** 動画付き投稿が保存済み（TC-SAVE-03 完了でも可）。

| # | 操作 | CDP ツール | 備考 |
|---|------|-----------|------|
| 1 | 動画付き投稿のサムネイルをクリック | click | |
| 2 | `<video>` 要素が出るまで待つ | wait_for | |
| 3 | loop 属性を確認 | evaluate_script | `document.querySelector('video')?.loop === true` |
| 4 | 動画が自動再生されているか確認 | evaluate_script | `!document.querySelector('video')?.paused` |

**判定:** step 3, 4 ともに `true`。

---

## グループ 5: バックアップ

> ⚠️ `showSaveFilePicker` / `showOpenFilePicker` はネイティブ File Picker ダイアログ。  
> CDP で操作するには `Page.setInterceptFileChooserDialog` を有効にして  
> `Page.fileChooserOpened` イベントをインターセプトし、`Page.handleFileChooser` で  
> ファイルパスを渡す必要がある。実行環境に合わせて補完すること。

### TC-BACKUP-01: バックアップ書き出し

**前提:** 1 件以上保存済み。書き出し先パスが確定している。

| # | 操作 | CDP ツール | 備考 |
|---|------|-----------|------|
| 1 | ビューア → 設定（歯車）を開く | click | `[aria-label="設定を開く"]` |
| 2 | 「バックアップ ZIP を保存」ボタンをクリック | click | |
| 3 | File Picker をインターセプトして保存先を指定 | Page.handleFileChooser | |
| 4 | 成功メッセージを待つ | wait_for | `.viewer-message-success` |
| 5 | メッセージテキストを確認 | evaluate_script | "バックアップを書き出しました" を含む |

**判定:** step 4 が表示され、step 5 が `true`。

---

### TC-RESTORE-01: 置き換え復元

**前提:** TC-BACKUP-01 の ZIP がある。アーカイブに追加の投稿がある（ZIP より件数が多い状態）。

| # | 操作 | CDP ツール | 備考 |
|---|------|-----------|------|
| 1 | 設定 → バックアップから復元セクション | — | |
| 2 | 「置き換え」モードが選択されていることを確認 | evaluate_script | `aria-checked="true"` の radio |
| 3 | 「バックアップ ZIP を選択」をクリック | click | |
| 4 | File Picker に ZIP パスを渡す | Page.handleFileChooser | |
| 5 | ファイル名が表示されるまで待つ | wait_for | |
| 6 | 「バックアップ ZIP から復元」をクリック | click | |
| 7 | confirm ダイアログを承認 | handle_dialog | |
| 8 | 成功メッセージを待つ | wait_for | `.viewer-message-success` |
| 9 | 投稿件数が ZIP 内の件数と一致するか確認 | evaluate_script | |

**判定:** step 8 に "アーカイブを復元しました" が表示される。step 9 が一致。

---

## グループ 6: 設定

### TC-SETTINGS-01: 設定変更の永続化

**前提:** ビューアが開いている。

| # | 操作 | CDP ツール | 備考 |
|---|------|-----------|------|
| 1 | 設定（歯車）を開く | click | |
| 2 | 基本設定タブを開く | click | |
| 3 | 言語を変更する（ja ↔ en） | click | |
| 4 | 設定を閉じる | click or press_key | Esc |
| 5 | ビューアをリロード | navigate_page | 同じ URL を再ナビ |
| 6 | UI テキストが変更後の言語で表示されているか確認 | evaluate_script | ツールバーのラベル等 |

**判定:** step 6 でリロード後も変更が保持されている。
