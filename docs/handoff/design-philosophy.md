# Design Philosophy: "Quiet Confidence" — Offline X Archive CWS Visuals

> 本ドキュメントは Anthropic `canvas-design` スキル流の2フェーズワークフロー
> （Philosophy → Canvas）の第1フェーズ。SC1-4 final 4枚の合成は、本文書の
> 原則を内面化したうえで `scripts/compose-sc-v2.py` で実装する。

## 1. The Aesthetic Movement

**Quiet Confidence** — 静謐な自信。

派手さで売らない。Tweetsmash や Linear が示したように、SaaS 訴求は「機能を
叫ぶ」のではなく「使われている瞬間そのものを美しく見せる」ことで信頼を
獲得する。CWS の 4 枚は広告バナーではなく、**短編の写真集**である。

「これは個人の手元で動くアーカイブだ」という小さくて誠実なメッセージを、
過剰な装飾なしに伝える。

## 2. Form, Space, Color, Composition

### Form
- スクショは矩形のまま尊重する。ベゼル風モックや 3D 回転は禁止
- 唯一の補助形状: 上端のブラウザ chrome（macOS 風信号機 3 ドット + 細い URL バー）
- 装飾は「弱い線、強い余白」。線は 1px、影は柔らかく拡散

### Space
- 1280x800 を **40 : 60** で割る（左 caption / 右 screenshot）ではなく
  **60 : 40**（左 screenshot / 右 caption）に固定。視線は左から右へ流れる
- caption ブロック上下に **160px 以上の呼吸**
- screenshot とキャンバス端の余白は最低 56px

### Color
- 背景: `#0a1428` → `#1a2347` の深紺ナイトグラデ（左上 → 右下）
- 左上 micro-glow: `#2563eb` alpha 12%、半径 380px
- 4 枚で hue を 0° / 8° / 16° / 24° シフト（連続性のある呼吸）
- accent: `#3b82f6` を caption の縦バー（4px 幅）と spotlight ring に限定使用
- text primary: `#f5f8ff`、secondary: `#aac3e6`、tertiary: `#6b7a99`

### Composition
- 1 枚 1 焦点。視線が彷徨わない
- focal spotlight: SC ごとに 1 つだけ要素を 1.04x で拡大 + 青リング 2px + glow
  - SC1: トップの投稿カード（Kotaro VSCode Tip）
  - SC2: Save ボタン
  - SC3: スレッド連結線
  - SC4: 検索 hit 行
- screenshot 下に幅 60px の reflection（α 0.10、blur 14px）— 「机に置かれた板」感

## 3. Typography (sparse and essential)

- JP heading: Yu Gothic Bold 48px、行高 1.15、letter-spacing -0.02em
- JP heading 左に **4px × heading高さ** の青グラデ縦バー（`#3b82f6` → `#60a5fa`）
- EN subline: Segoe UI Semibold 20px、letter-spacing 0.04em（uppercase 化はしない）
- progress indicator: 右下に `01 / 04` を Segoe UI Regular 14px、α 0.5
- 文字数は caption 以外に追加しない。装飾コピーは置かない

## 4. The Niche Reference

「Tweetsmash の LP」を直接模倣せず、その背後にある **Dieter Rams + 90s
コンピュータ雑誌の写真ページ** の感覚を引用する。Apple keynote の slide
よりもう一段静かな、編集デザインの呼吸を意識する。

## 5. What This Is NOT

- 派手な背景イラスト、3D アイソメ、blob shape、gradient mesh はすべて禁止
- 「機能の説明文」「→ arrow」「Get it now!」のような訴求文言禁止
- 投稿カード本文（demo データ）の改変禁止
- X 公式ロゴ追加禁止（CWS 規約）

## 6. Verification Hooks

実装後、以下の `visual-critique` 風セルフレビューを必ず通す:

1. **Hierarchy**: 視線は 1 秒以内に focal spotlight に着地するか
2. **Brand consistency**: 4 枚で背景・余白・タイポが series として読めるか
3. **Composition**: 焦点以外の要素がノイズになっていないか
4. **Typography**: heading / EN / progress の 3 階層が静かに成立しているか

各項目「pass / minor / fail」で記録し、fail があれば実装に戻る。
