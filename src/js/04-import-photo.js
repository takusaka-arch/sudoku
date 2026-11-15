  // ===== 04-import-photo.js：81桁の盤面データの読み込み・写真／クリップボードからの読み取り（Tesseract.js・OpenCV.js） =====
  // （src/js/ の全ファイルで1つの (function () { … })(); になる。まとめ方は tools/build.py）
  // 81桁の盤面データを読み込む（問題を自分で作る画面）
  const digitsIn = document.getElementById("digits-in"), digitsStatus = document.getElementById("digits-status"), digitsHelp = digitsStatus.textContent;
  function loadDigits() {
    const raw = digitsIn.value.replace(/\s/g, "");
    digitsStatus.classList.remove("err");
    if (!raw) { digitsStatus.textContent = digitsHelp; return; }
    if (/[^0-9.]/.test(raw) || raw.length !== 81) {
      digitsStatus.classList.add("err");
      digitsStatus.textContent = /[^0-9.]/.test(raw) ? "数字（0〜9）と . 以外の文字が入っています。" : `数字が ${raw.length} 個あります。81 個にしてください。`;
      return;
    }
    if (board.dataset.mode !== "register") return;
    clearBoard();
    let n = 0;
    [...raw.replace(/\./g, "0")].forEach((v, i) => {
      if (v === "0") return;
      const c = cellAt(Math.floor(i / 9), i % 9);
      c.dataset.value = v;
      c.querySelector(".big").textContent = v;
      c.classList.add("fixed");
      n++;
    });
    markConflicts();
    digitsStatus.textContent = `${n} マスを読み込みました。間違いがなければ「問題登録完了」を押してください。`;
  }
  document.getElementById("digits-go").addEventListener("click", loadDigits);
  digitsIn.addEventListener("keydown", (e) => { if (e.key === "Enter") loadDigits(); });
  // 写真から問題を読み取る（Claude が写真を読む。使えない環境ではボタンを出さない）
  const photoBox = document.getElementById("photo-box");
  const photoInput = document.getElementById("photo-input");
  const photoFile = document.getElementById("photo-file");
  const photoStatus = document.getElementById("photo-status");
  const photoHint = photoStatus.textContent;
  let sampleFn = null;
  function updatePhoto() {
    document.getElementById("digits-box").hidden = board.dataset.mode !== "register";
    photoBox.hidden = board.dataset.mode !== "register";
    renderPad();
  }
  (async () => {
    try {
      const s = await window.claude?.use?.("sample");
      if (!s) return;
      const lim = await s.limits().catch(() => null);
      if (!lim?.images) return;
      sampleFn = s;
      photoInput.accept = photoFile.accept = lim.images.mediaTypes.join(",");
      updatePhoto();
    } catch (e) { /* 使えない環境 */ }
  })();
  const PHOTO_PROMPT = "この写真には数独（9x9）の問題が写っています。最初から印刷されている数字を、上の行から順に読み取ってください。書き込みや小さなメモ数字は無視します。"
    + "空きマスは 0 にします。JSON だけを返してください。形式: {\"grid\": [\"530070000\", \"600195000\", ...]}（9文字の文字列を9行分）。"
    + "数独の盤面が見つからなければ {\"grid\": null} を返してください。";
  const PHOTO_ERRORS = {
    not_granted: "Claude の利用が許可されていないため読み取れません。数字は手で入れてください。",
    rate_limited: "利用が混み合っています。少し待ってからもう一度試してください。",
    image_rejected: "この画像は使えません。JPEG や PNG の写真を選んでください。",
    session_expired: "サインインの有効期限が切れました。サインインし直してから試してください。",
  };
  // カメラ撮影でも画像ファイルでも同じように読み取る
  photoInput.addEventListener("change", () => readPhoto(photoInput));
  photoFile.addEventListener("change", () => readPhoto(photoFile));
  // クリップボードの画像を読み取る（ボタン、または Ctrl+V / ⌘V）
  document.getElementById("photo-paste").addEventListener("click", async () => {
    photoStatus.classList.remove("err", "warn");
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (type) return readImage(new File([await item.getType(type)], "clipboard." + type.split("/")[1], { type }));
      }
      photoStatus.classList.add("err");
      photoStatus.textContent = "クリップボードに画像がありません。画像をコピーしてからもう一度押してください。";
    } catch (e) {
      photoStatus.classList.add("err");
      photoStatus.textContent = "クリップボードを読めませんでした。画像をコピーしたあと、この画面で Ctrl+V（Mac は ⌘V）を押して貼り付けてください。";
    }
  });
  document.addEventListener("paste", (e) => {
    if (board.dataset.mode !== "register" || photoBox.classList.contains("busy") || !cropEl.hidden) return;
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith("image/"));
    if (!file) return;
    e.preventDefault();
    readImage(file);
  });
  function readPhoto(input) {
    const file = input.files[0];
    input.value = "";
    if (file) readImage(file);
  }
  async function readImage(file) {
    if (photoBox.hidden || photoBox.classList.contains("busy")) return;
    // Claude が使えないところ（ダウンロードしたファイルなど）では、端末の中で読み取る
    if (!sampleFn) return startCrop(file);
    photoBox.classList.add("busy");
    photoStatus.classList.remove("err", "warn");
    photoStatus.textContent = "読み取り中です…（数十秒かかることがあります）";
    try {
      const res = await sampleFn.json(PHOTO_PROMPT, { images: file });
      const rows = res && Array.isArray(res.grid) ? res.grid.map((r) => String(r).replace(/[^0-9]/g, "")) : null;
      if (!rows || rows.length !== 9 || rows.some((r) => r.length !== 9)) {
        throw { code: "no_grid" };
      }
      if (board.dataset.mode !== "register") return;
      clearBoard();
      let n = 0;
      rows.forEach((r, ri) => [...r].forEach((v, ci) => {
        if (v === "0") return;
        const c = cellAt(ri, ci);
        c.dataset.value = v;
        c.querySelector(".big").textContent = v;
        c.classList.add("fixed");
        n++;
      }));
      markConflicts();
      photoStatus.textContent = `${n} マスを読み取りました。写真と見比べて、間違いがあれば直してから「問題登録完了」を押してください。`;
    } catch (e) {
      photoStatus.classList.add("err");
      if (e && e.code === "cancelled") photoStatus.textContent = photoHint;
      else if (e && e.code === "no_grid") photoStatus.textContent = "数独の盤面を読み取れませんでした。盤面全体がまっすぐ写るように撮り直してください。";
      else photoStatus.textContent = PHOTO_ERRORS[e && e.code] || "読み取りに失敗しました。もう一度試してください。";
    } finally {
      photoBox.classList.remove("busy");
    }
  }

  // ---- 端末の中での読み取り（登録不要・無料。Tesseract.js を使うため初回はインターネット接続が必要）----
  // アプリ版（PWA）では window.TESS_BASE に同梱の読み取りファイルの場所が入り、ネットなしで動く
  const TESS_BASE = window.TESS_BASE ? new URL(window.TESS_BASE, location.href).href : null;
  const TESS_URL = TESS_BASE ? TESS_BASE + "tesseract.min.js" : "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
  const TESS_OPTS = TESS_BASE ? { workerPath: TESS_BASE + "worker.min.js", corePath: TESS_BASE, langPath: TESS_BASE } : {};
  const cropEl = document.getElementById("crop");
  const cropCanvas = document.getElementById("crop-canvas");
  const cropCtx = cropCanvas.getContext("2d");
  let ocrImg = null, corners = null, cropScale = 1, dragIdx = -1, ocrWorker = null, cornersMoved = false;
  const cropMsg = document.getElementById("crop-msg");
  const cropHint = cropMsg.textContent;

  // 単位正方形の四隅 → 写真上の四隅 への射影変換
  function homography(dst) {
    const src = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const A = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
    }
    for (let c = 0; c < 8; c++) {
      let p = c;
      for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]];
      for (let r = 0; r < 8; r++) {
        if (r === c) continue;
        const f = A[r][c] / A[c][c];
        for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
      }
    }
    const h = A.map((row, i) => row[8] / row[i]);
    return (x, y) => {
      const w = h[6] * x + h[7] * y + 1;
      return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w];
    };
  }

  async function startCrop(file) {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    try { await img.decode(); } catch (e) { /* 下で判定 */ }
    if (!img.naturalWidth) {
      photoStatus.classList.add("err");
      photoStatus.textContent = "この画像は開けませんでした。JPEG や PNG の画像を選んでください。";
      return;
    }
    ocrImg = img;
    const w = img.naturalWidth, h = img.naturalHeight;
    corners = [[w * 0.08, h * 0.08], [w * 0.92, h * 0.08], [w * 0.92, h * 0.92], [w * 0.08, h * 0.92]];
    cropEl.hidden = false;
    const maxW = Math.min(window.innerWidth - 64, 900), maxH = window.innerHeight * 0.68;
    cropScale = Math.min(maxW / w, maxH / h, 1);
    cropCanvas.width = Math.round(w * cropScale);
    cropCanvas.height = Math.round(h * cropScale);
    cornersMoved = false;
    drawCrop();
    // 盤面の外枠を自動で探し、見つかれば四隅の丸をそこへ動かす（手で動かしたあとは上書きしない）
    cropMsg.textContent = "盤面の外枠を探しています…";
    const found = await detectCorners(img).catch(() => null);
    if (ocrImg !== img || cropEl.hidden) return;
    if (found && !cornersMoved) {
      corners = found;
      drawCrop();
      cropMsg.textContent = "盤面の四隅を自動で合わせました。ずれていたらオレンジの丸をドラッグして直してください。";
    } else {
      cropMsg.textContent = cropHint;
    }
  }

  // OpenCV.js で写真の中のいちばん大きな四角形（盤面の外枠）を探し、四隅を 左上・右上・右下・左下 の順で返す
  const CV_URL = window.CV_URL || "https://cdn.jsdelivr.net/npm/@techstark/opencv-js@4.10.0-release.1/dist/opencv.js";
  let cvReady = null;
  function loadCV() {
    if (!cvReady) cvReady = new Promise((ok, ng) => {
      const sc = document.createElement("script");
      sc.src = CV_URL;
      sc.onload = async () => {
        try {
          let c = window.cv;
          if (c && typeof c.then === "function" && !c.Mat) c = await new Promise((r) => c.then((m) => { delete m.then; r(m); }));
          if (c && !c.Mat) await new Promise((r) => { c.onRuntimeInitialized = r; });
          ok(c);
        } catch (e) { ng(e); }
      };
      sc.onerror = ng;
      document.head.appendChild(sc);
    }).catch((e) => { cvReady = null; throw e; });
    return cvReady;
  }
  async function detectCorners(img) {
    const cv = await loadCV();
    const k = Math.min(1, 800 / Math.max(img.naturalWidth, img.naturalHeight));
    const cw = Math.round(img.naturalWidth * k), ch = Math.round(img.naturalHeight * k);
    const can = document.createElement("canvas");
    can.width = cw; can.height = ch;
    can.getContext("2d").drawImage(img, 0, 0, cw, ch);
    const src = cv.imread(can), gray = new cv.Mat(), bin = new cv.Mat();
    const contours = new cv.MatVector(), hier = new cv.Mat();
    try {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
      cv.adaptiveThreshold(gray, bin, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);
      cv.findContours(bin, contours, hier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      let best = null, bestArea = cw * ch * 0.12;
      for (let i = 0; i < contours.size(); i++) {
        const c = contours.get(i);
        const area = cv.contourArea(c);
        if (area > bestArea) {
          const approx = new cv.Mat();
          cv.approxPolyDP(c, approx, 0.02 * cv.arcLength(c, true), true);
          if (approx.rows === 4 && cv.isContourConvex(approx)) {
            best && best.delete();
            best = approx;
            bestArea = area;
          } else approx.delete();
        }
        c.delete();
      }
      if (!best) return null;
      const pts = [];
      for (let i = 0; i < 4; i++) pts.push([best.data32S[i * 2] / k, best.data32S[i * 2 + 1] / k]);
      best.delete();
      // 左上 = x+y 最小、右下 = x+y 最大、右上 = x-y 最大、左下 = x-y 最小
      const by = (f) => pts.reduce((a, b) => (f(b) > f(a) ? b : a));
      return [by((p) => -(p[0] + p[1])), by((p) => p[0] - p[1]), by((p) => p[0] + p[1]), by((p) => p[1] - p[0])];
    } finally {
      src.delete(); gray.delete(); bin.delete(); contours.delete(); hier.delete();
    }
  }
  function drawCrop() {
    const s = cropScale;
    cropCtx.drawImage(ocrImg, 0, 0, cropCanvas.width, cropCanvas.height);
    const H = homography(corners);
    const line = (a, b, wide) => {
      const p = H(...a), q = H(...b);
      cropCtx.beginPath();
      cropCtx.moveTo(p[0] * s, p[1] * s);
      cropCtx.lineTo(q[0] * s, q[1] * s);
      cropCtx.lineWidth = wide ? 2.5 : 1;
      cropCtx.strokeStyle = "rgba(224,120,0,0.9)";
      cropCtx.stroke();
    };
    for (let i = 0; i <= 9; i++) {
      line([i / 9, 0], [i / 9, 1], i % 3 === 0);
      line([0, i / 9], [1, i / 9], i % 3 === 0);
    }
    for (const [x, y] of corners) {
      cropCtx.beginPath();
      cropCtx.arc(x * s, y * s, 11, 0, Math.PI * 2);
      cropCtx.fillStyle = "rgba(255,170,0,0.55)";
      cropCtx.fill();
      cropCtx.lineWidth = 2.5;
      cropCtx.strokeStyle = "#c26a00";
      cropCtx.stroke();
    }
  }
  function canvasPos(e) {
    const r = cropCanvas.getBoundingClientRect();
    return [(e.clientX - r.left) * (cropCanvas.width / r.width), (e.clientY - r.top) * (cropCanvas.height / r.height)];
  }
  cropCanvas.addEventListener("pointerdown", (e) => {
    const [x, y] = canvasPos(e);
    let best = -1, bd = 45 * (cropCanvas.width / cropCanvas.getBoundingClientRect().width);
    corners.forEach(([cx, cy], i) => {
      const d = Math.hypot(cx * cropScale - x, cy * cropScale - y);
      if (d < bd) { bd = d; best = i; }
    });
    dragIdx = best;
    if (best >= 0) {
      cornersMoved = true;
      cropCanvas.setPointerCapture(e.pointerId);
    }
  });
  cropCanvas.addEventListener("pointermove", (e) => {
    if (dragIdx < 0) return;
    const [x, y] = canvasPos(e);
    corners[dragIdx] = [
      Math.max(0, Math.min(ocrImg.naturalWidth, x / cropScale)),
      Math.max(0, Math.min(ocrImg.naturalHeight, y / cropScale)),
    ];
    drawCrop();
  });
  cropCanvas.addEventListener("pointerup", () => { dragIdx = -1; });
  document.getElementById("crop-cancel").addEventListener("click", () => {
    cropEl.hidden = true;
    photoStatus.classList.remove("err", "warn");
    photoStatus.textContent = photoHint;
  });

  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve();
    return new Promise((ok, ng) => {
      const s = document.createElement("script");
      s.src = TESS_URL;
      s.onload = ok;
      s.onerror = ng;
      document.head.appendChild(s);
    });
  }

  document.getElementById("crop-ok").addEventListener("click", async () => {
    cropEl.hidden = true;
    photoBox.classList.add("busy");
    photoStatus.classList.remove("err", "warn");
    photoStatus.textContent = "読み取りの準備中です…（初回は少し時間がかかります）";
    try {
      // 写真をまっすぐな正方形に変換して、グレーの濃さにする
      const k = Math.min(1, 2000 / Math.max(ocrImg.naturalWidth, ocrImg.naturalHeight));
      const src = document.createElement("canvas");
      src.width = Math.round(ocrImg.naturalWidth * k);
      src.height = Math.round(ocrImg.naturalHeight * k);
      const sctx = src.getContext("2d", { willReadFrequently: true });
      sctx.drawImage(ocrImg, 0, 0, src.width, src.height);
      const px = sctx.getImageData(0, 0, src.width, src.height).data;
      const H = homography(corners.map(([x, y]) => [x * k, y * k]));
      const N = 900, CS = N / 9;
      const gray = new Uint8Array(N * N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const [sx, sy] = H((i + 0.5) / N, (j + 0.5) / N);
        const xi = Math.min(src.width - 1, Math.max(0, Math.round(sx)));
        const yi = Math.min(src.height - 1, Math.max(0, Math.round(sy)));
        const o = (yi * src.width + xi) * 4;
        gray[j * N + i] = 0.299 * px[o] + 0.587 * px[o + 1] + 0.114 * px[o + 2];
      }
      // 大津の方法で「文字」と「紙」の境を決める
      const hist = new Array(256).fill(0);
      for (const g of gray) hist[g]++;
      let sum = 0;
      for (let t = 0; t < 256; t++) sum += t * hist[t];
      let sB = 0, wB = 0, best = 0, thr = 128;
      for (let t = 0; t < 256; t++) {
        wB += hist[t];
        if (!wB || wB === gray.length) continue;
        sB += t * hist[t];
        const mB = sB / wB, mF = (sum - sB) / (gray.length - wB);
        const v = wB * (gray.length - wB) * (mB - mF) ** 2;
        if (v > best) { best = v; thr = t; }
      }
      // 各マスの中央に文字があるか調べ、あれば数字だけを切り出す
      const jobs = [];
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
        const x0 = Math.round(c * CS + CS * 0.15), x1 = Math.round(c * CS + CS * 0.85);
        const y0 = Math.round(r * CS + CS * 0.15), y1 = Math.round(r * CS + CS * 0.85);
        let n = 0, bx0 = 1e9, by0 = 1e9, bx1 = -1, by1 = -1;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          if (gray[y * N + x] < thr) {
            n++;
            if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
            if (y < by0) by0 = y; if (y > by1) by1 = y;
          }
        }
        if (n < (x1 - x0) * (y1 - y0) * 0.04 || by1 - by0 < CS * 0.25) continue;
        const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
        const dig = document.createElement("canvas");
        dig.width = bw; dig.height = bh;
        const dctx = dig.getContext("2d");
        const im = dctx.createImageData(bw, bh);
        for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
          const v = gray[(by0 + y) * N + bx0 + x] < thr ? 0 : 255;
          const o = (y * bw + x) * 4;
          im.data[o] = im.data[o + 1] = im.data[o + 2] = v;
          im.data[o + 3] = 255;
        }
        dctx.putImageData(im, 0, 0);
        jobs.push({ r, c, dig, bw, bh });
      }
      // 数字を白い余白の中に指定の高さで置いた画像を作る
      const render = (job, h) => {
        const W = h * 2;
        const out = document.createElement("canvas");
        out.width = out.height = W;
        const octx = out.getContext("2d");
        octx.fillStyle = "#fff";
        octx.fillRect(0, 0, W, W);
        const sc = h / job.bh;
        octx.drawImage(job.dig, (W - job.bw * sc) / 2, (W - h) / 2, job.bw * sc, h);
        return out;
      };
      await loadTesseract();
      if (!ocrWorker) ocrWorker = await Tesseract.createWorker("eng", 1, TESS_OPTS);
      const result = new Array(81).fill("0");
      // 大きさと読み方を変えて読み、自信のある読みが2回同じ数字になったら決める（読み間違いを減らす）
      // 自信の低い読み（confidence < 50）は票に数えず、点数（確かさの合計）だけに足す
      let todo = jobs;
      const votes = new Map(jobs.map((j) => [j, []]));
      const sure = new Set();
      const tries = [{ h: 56, psm: "10" }, { h: 40, psm: "8" }, { h: 72, psm: "7" }, { h: 32, psm: "10" }];
      for (let t = 0; t < tries.length && todo.length; t++) {
        await ocrWorker.setParameters({ tessedit_char_whitelist: "123456789", tessedit_pageseg_mode: tries[t].psm });
        const left = [];
        for (let i = 0; i < todo.length; i++) {
          photoStatus.textContent = t === 0
            ? `読み取り中です…（${i + 1} / ${todo.length}）`
            : `確かめながら読み直しています…（${i + 1} / ${todo.length}）`;
          const { data } = await ocrWorker.recognize(render(todo[i], tries[t].h));
          const d = (data.text || "").replace(/[^1-9]/g, "")[0];
          const v = votes.get(todo[i]);
          if (d) v.push({ d, conf: data.confidence || 0 });
          const good = v.filter((x) => x.conf >= 50);
          if (d && good.filter((x) => x.d === d).length >= 2 && good.every((x) => x.d === d)) {
            result[todo[i].r * 9 + todo[i].c] = d;
            sure.add(todo[i]);
          } else left.push(todo[i]);
        }
        todo = left;
      }
      // そろわなかったマスは、確かさの合計がいちばん大きい数字を使い、「要確認」の印を付ける
      const unsure = [];
      todo = todo.filter((j) => {
        const v = votes.get(j);
        if (!v.length) return true;
        const score = {};
        for (const x of v) score[x.d] = (score[x.d] || 0) + x.conf + 1;
        result[j.r * 9 + j.c] = Object.keys(score).sort((a, b) => score[b] - score[a])[0];
        unsure.push(j);
        return false;
      });
      const miss = todo.length;
      if (board.dataset.mode !== "register") return;
      clearBoard();
      let n = 0;
      result.forEach((v, i) => {
        if (v === "0") return;
        const c = cellAt(Math.floor(i / 9), i % 9);
        c.dataset.value = v;
        c.querySelector(".big").textContent = v;
        c.classList.add("fixed");
        n++;
      });
      for (const j of unsure) cellAt(j.r, j.c).classList.add("ocr-unsure");
      markConflicts();
      photoStatus.textContent = `${n} マスを読み取りました` + (miss ? `（読めなかったマスが ${miss} か所あります）` : "") + "。"
        + (unsure.length ? `オレンジの枠の ${unsure.length} マスは読み取りに自信がありません。特に写真とよく見比べてください。` : "")
        + "間違いがあれば直してから「問題登録完了」を押してください。";
      if (unsure.length) photoStatus.classList.add("warn");
    } catch (e) {
      photoStatus.classList.add("err");
      photoStatus.textContent = "読み取りの準備ができませんでした。インターネットにつながっているか確かめて、もう一度試してください。";
    } finally {
      photoBox.classList.remove("busy");
    }
  });

  function showRegister() {
    setPauseLock(false);
    clearUndo();
    undoBtn.hidden = false;
    photoStatus.classList.remove("err", "warn");
    photoStatus.textContent = photoHint;
    prompt.textContent = "問題を登録してください";
    note.textContent = registerNote;
    nameField.hidden = false;
    pname.value = currentName;
    edit.hidden = true;
    reset.hidden = true;
    replayBtn.hidden = true;
    saveSolvedBtn.hidden = true; document.getElementById("share-solved").hidden = true;
    stopReplay();
    confirmBox.hidden = true;
    done.hidden = false;
    regCancel.hidden = false;
    exportCur.hidden = true;
    saveProgress.hidden = true;
    snapOpen.hidden = true;
    closeSnapUI();
    hintBtn.hidden = true;
    document.getElementById("check").hidden = true;
    document.getElementById("hint-menu").hidden = true;
    viewBtn.hidden = true;
    document.getElementById("view-menu").hidden = true;
    workMsg.textContent = "";
    updatePhoto();
  }

