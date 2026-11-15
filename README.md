# 数独回答支援アプリ（PWA 版）

このフォルダの中身を、そのまま GitHub Pages などの https のサーバーに置くとアプリとして使えます。

- Windows（Chrome / Edge）：ページを開き、アドレスバーの「インストール」ボタンを押す
- iPhone（Safari）：共有ボタン →「ホーム画面に追加」
- Android（Chrome）：メニュー →「アプリをインストール」または「ホーム画面に追加」

一度開けば、ネットにつながっていなくても動きます（写真からの読み取りも含む）。

写真の読み取りには Tesseract.js（Apache License 2.0）を、盤面の外枠の自動検出には OpenCV.js（@techstark/opencv-js、Apache License 2.0）を使っています。

## 開発のしかた（ファイルの分け方とまとめ方）

プログラムは作業しやすいように `src/` に分けてあり、配るときに1つの HTML にまとめます。
**直すのは `src/` の中だけ**です。`index.html` は `tools/build.py` が作るので、直接は書き換えません。

```
src/
  head.html            … ページの先頭（タイトル・フォント）
  style.css            … 見た目（CSS）
  body.html            … 画面の部品（HTML）。アプリの版数 ver.N もここ
  js/01-board.js 〜 17-startup.js … プログラム（番号順につなぐと1つの (function () { … })(); になる）
  tail.html            … ページの末尾
  pwa-head.html        … GitHub版（index.html）だけの先頭部分（アイコン・Googleドライブ・オフライン用の設定）
  standalone-head.html … 1ファイル版（sudoku.html）だけの先頭部分
tools/build.py         … まとめる仕組み
```

JS の各ファイルの1行目に、そのファイルに入っている機能を書いています。

### 版を出す手順

1. `src/` を直す。版数は `src/body.html` の `ver.N` を1つ上げる
2. `python3 tools/build.py` を実行する
   - `index.html`（GitHub版）、`dist/sudoku.html`（1ファイル版）、`dist/artifact.html`（Claude 上のアプリ用）ができる
   - `sw.js` のキャッシュ名 `sudoku-vN` も自動で版数に合わせる
3. `index.html` と `sw.js` と `src/` をコミットする（`dist/` はコミットしない）
