# Finding: 絵文字入り投稿のテキストが保存時に欠落する

## 結論

`normalizePostText` が `element.innerText` を優先しているが、Chrome の `innerText` は X.com の Twemoji `<img alt="😀">` の alt テキストを含まない。テキスト+絵文字の投稿では innerText が空でないためフォールバックが起動せず、絵文字だけが落ちて保存される。

## 調査手順

- X.com の検索結果（`?q=😀`）でタイムラインの全投稿を走査
- `tweetText.innerText` / `tweetText.textContent` / `extractTextWithEmoji(tweetText)` を比較
- `img.innerText`・`img.alt`・`display`・`visibility` を検証

## 確認した DOM 構造

```html
<img alt="😀" draggable="false"
     src="https://abs-0.twimg.com/emoji/v2/svg/1f600.svg"
     class="r-4qtqp9 r-dflpy8 r-k4bwe5 r-1kpi4qh r-pp5qcn r-h9hxbl">
```

- `display: inline-block`, `visibility: visible`, `aria-hidden: null`
- `img.alt = "😀"` (正しくセット)
- `img.innerText = ""` ← Chrome は img の alt を innerText に含めない

## ケース別挙動

| ケース | innerText | extractTextWithEmoji | 現在の採用値 | 結果 |
|---|---|---|---|---|
| 絵文字のみ「😀」 | `""` | `"😀"` | extractTextWithEmoji | 正常 |
| テキスト+絵文字「Geweldig 😀」 | `"Geweldig"` | `"Geweldig😀"` | innerText | **絵文字欠落** |
| テキストのみ | `"text"` | `"text"` | innerText | 正常 |

## 影響範囲

- テキスト+絵文字の投稿すべて（単体保存・likes インポート両方）
- 保存自体は成功するが `post_text` から絵文字が落ちる
- 一覧では投稿カードが表示されるが絵文字が抜けた状態で表示される

## 未解決点

なし。修正方針も確定。
