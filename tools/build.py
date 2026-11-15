#!/usr/bin/env python3
"""数独回答支援アプリ：分けたファイル（src/）を1つの HTML にまとめる。

使い方（リポジトリの一番上で）:
    python3 tools/build.py

作るもの:
    index.html          … GitHub版（PWA）。src/pwa-head.html を先頭に付ける
    dist/sudoku.html    … 1ファイル版。src/standalone-head.html を先頭に付ける
    dist/artifact.html  … Claude 上のアプリ（アーティファクト）用
    sw.js               … キャッシュ名 sudoku-vN を、アプリの版数 ver.N に合わせる

まとめる順番:
    src/head.html → src/style.css → src/body.html → src/js/*.js（ファイル名の番号順）→ src/tail.html
    JS は全体で1つの (function () { … })(); なので、01 の先頭と 14 の末尾がその始まりと終わり。
    ファイルを足すときは、番号でまとめる位置を決める（例：08 と 09 のあいだなら 08a-xxx.js）。
"""
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")
# アーティファクト専用の行（1ファイル版・GitHub版では外す）
ARTIFACT_ONLY = "claude:viewport"


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(text)


def parts():
    js = sorted(glob.glob(os.path.join(SRC, "js", "*.js")))
    if not js:
        sys.exit("src/js/*.js がありません")
    return [os.path.join(SRC, "head.html"), os.path.join(SRC, "style.css"), os.path.join(SRC, "body.html"), *js, os.path.join(SRC, "tail.html")]


def main():
    app = "".join(read(p) for p in parts())
    m = re.findall(r'<small class="ver">ver\.(\d+)</small>', app)
    if len(m) != 1:
        sys.exit("アプリの版数（ver.N）が見つからないか、2つ以上あります")
    ver = m[0]
    plain = "".join(line for line in app.splitlines(keepends=True) if ARTIFACT_ONLY not in line)

    write(os.path.join(ROOT, "dist", "artifact.html"), app)
    write(os.path.join(ROOT, "dist", "sudoku.html"), read(os.path.join(SRC, "standalone-head.html")) + plain)
    write(os.path.join(ROOT, "index.html"), read(os.path.join(SRC, "pwa-head.html")) + plain)

    # オフライン用の保存（sw.js）は、版が変わるたびに名前を変えないと新しい版が届かない
    sw_path = os.path.join(ROOT, "sw.js")
    sw = read(sw_path)
    sw_new = re.sub(r'const CACHE = "sudoku-v\d+";', f'const CACHE = "sudoku-v{ver}";', sw, count=1)
    if sw_new == sw and f'"sudoku-v{ver}"' not in sw:
        sys.exit("sw.js の CACHE の行が見つかりません")
    write(sw_path, sw_new)

    print(f"ver.{ver}: index.html, dist/sudoku.html, dist/artifact.html, sw.js（sudoku-v{ver}）を作りました")


if __name__ == "__main__":
    main()
