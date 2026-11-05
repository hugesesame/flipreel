# Flipbook

[English](README.md) | **日本語**

静止画から、スライド動画をブラウザだけで作れるアプリです。

Flipbook は HTML ファイル 1 つでできています。開いて写真を追加し、7 つの短い質問に答えるだけで、MP4 か WebM の動画を保存できます。インターネットにつながっていなくても動き、写真がパソコンの外に送られることはありません。

> 「Flipbook」は仮の名前です。

## できること

- **7 つのかんたんなステップ**：写真 → アスペクト比 → ファイル形式 → 表示時間 → トランジション → 黒み → 書き出し
- どのステップにも**最初からちょうどよい設定**が入っているので、「次へ」を押していくだけでも完成します
- **アスペクト比**：16:9・4:3・1:1・9:16。写真の収め方は「フィット」（全体を表示・余白は黒）か「フィル」（画面いっぱい・端を切る）
- **ファイル形式**：MP4（H.264）か WebM（VP9）。フル HD（短い辺 1080 px）、30 fps
- **トランジション**：カットかフェード。フェードの長さも変えられます
- 最初と最後の**黒み**
- 書き出す前の**プレビュー**
- **保存先を選べる**（Chrome / Edge）
- 各ステップをやさしい言葉で説明する**ヘルプ**
- **英語 / 日本語**の切り替え、**ライト / ダーク**の切り替え
- **オフライン・プライバシー**：すべての処理がブラウザの中だけで行われます

## 使い方

1. `flipbook.html` を用意します（下の「[ビルド](#ビルド)」を参照）。
2. ファイルをダブルクリックして、**Google Chrome** か **Microsoft Edge** で開きます。
3. 画面の案内に沿って進めます。わからないときは **ヘルプ** を押してください。

### 対応ブラウザ

| ブラウザ | 動画づくり | 保存先の選択 |
| --- | --- | --- |
| Chrome / Edge（最新版） | ✅ | ✅ |
| Safari 17 以降 | ✅ | —「ダウンロード」フォルダに保存 |
| Firefox 130 以降 | ✅ | —「ダウンロード」フォルダに保存 |

動作確認は Chrome で行っています。Safari と Firefox は WebCodecs に対応しているので動く見込みですが、まだ確認していません。

Safari や Firefox で毎回保存先を聞いてもらう設定方法は、アプリのヘルプで案内しています。

iPhone の HEIC 形式の写真は Safari でだけ開けます。ほかのブラウザでは、先に JPEG に変換してください。

## ビルド

[Node.js](https://nodejs.org/) 20 以降が必要です。

```sh
npm install
npm run build      # → dist/flipbook.html（1 ファイルで完結）
```

開発するとき：

```sh
npm run dev        # http://localhost:5173/flipbook.html を開く
npm run typecheck
```

## しくみ

- 写真を `createImageBitmap` で読み込み、1 コマずつ canvas に描きます。
- 描いたコマをブラウザの [WebCodecs](https://developer.mozilla.org/ja/docs/Web/API/WebCodecs_API) で動画に変換し、[Mediabunny](https://mediabunny.dev/) で MP4 / WebM ファイルにまとめます。
- Chrome / Edge では、[File System Access API](https://developer.mozilla.org/ja/docs/Web/API/Window/showSaveFilePicker) で選んだファイルへ直接書き込みます。ほかのブラウザでは、メモリ上で作ってからダウンロードします。
- [Vite](https://vite.dev/) と [vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile) で JavaScript と CSS をすべて 1 つの HTML に埋め込んでいるため、ネットワークへの接続は不要です。

### ファイル構成

```
flipbook.html      入口の HTML
src/main.ts        画面・ステップ・プレビュー・操作
src/timeline.ts    タイムラインの計算とコマの描画（プレビューと書き出しで共通）
src/exporter.ts    動画への変換と保存
src/photos.ts      写真とサムネイルの読み込み
src/i18n.ts        画面の文言（英語 / 日本語）
src/help.ts        ヘルプの本文（英語 / 日本語）
src/style.css      スタイル（ライト / ダーク）
```

## 今後の予定

- BGM（1 曲を選び、最後にフェードアウト）
