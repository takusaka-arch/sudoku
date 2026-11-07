// アプリ本体と読み取り用ファイルを端末に保存し、ネットなしでも開けるようにする
const CACHE = "sudoku-v169";
const FILES = [
  "./", "./index.html", "./manifest.webmanifest",
  "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png",
  "./tesseract/tesseract.min.js", "./tesseract/worker.min.js",
  "./tesseract/tesseract-core-simd-lstm.wasm.js", "./tesseract/tesseract-core-lstm.wasm.js",
  "./tesseract/eng.traineddata.gz",
  "./opencv/opencv.js",
];
self.addEventListener("install", (e) => {
  // GitHubの配信サーバーに古いファイルが残っていても、毎回ちがうURL（?v=…）で取りに行って最新を保存する
  const bust = Date.now();
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(FILES.map((f) =>
    fetch(f + (f.includes("?") ? "&" : "?") + "v=" + bust, { cache: "no-store" }).then((res) => {
      if (!res.ok) throw new Error(f);
      return c.put(f, res);
    })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // Google など別のサイトへの通信はそのまま通す
  if (new URL(e.request.url).origin !== location.origin) return;
  // 新しい版があるかの確認（?check=…）は、保存分を使わずにそのままネットへ
  if (new URL(e.request.url).searchParams.has("check")) return;
  // アプリ本体はネットにつながっていれば（ブラウザや配信サーバーの一時保存も使わず）常に最新を取りに行き、つながらないときだけ保存分を使う
  const path = new URL(e.request.url).pathname;
  if (e.request.mode === "navigate" && (path.endsWith("/") || path.endsWith("/index.html"))) {
    // 配信サーバーの古い控えを使わないよう、毎回ちがうURLで取りに行く
    e.respondWith(fetch("./index.html?t=" + Date.now(), { cache: "no-store" }).then((res) => {
      if (!res.ok) throw new Error("index");
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put("./index.html", copy));
      return res;
    }).catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
