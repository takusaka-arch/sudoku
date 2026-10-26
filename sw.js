// アプリ本体と読み取り用ファイルを端末に保存し、ネットなしでも開けるようにする
const CACHE = "sudoku-v27";
const FILES = [
  "./", "./index.html", "./manifest.webmanifest",
  "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png",
  "./tesseract/tesseract.min.js", "./tesseract/worker.min.js",
  "./tesseract/tesseract-core-simd-lstm.wasm.js", "./tesseract/tesseract-core-lstm.wasm.js",
  "./tesseract/eng.traineddata.gz",
  "./opencv/opencv.js",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  // アプリ本体はネットにつながっていれば（ブラウザの一時保存も使わず）常に最新を取りに行き、つながらないときだけ保存分を使う
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request.url, { cache: "no-cache" }).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put("./index.html", copy));
      return res;
    }).catch(() => caches.match("./index.html")));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
