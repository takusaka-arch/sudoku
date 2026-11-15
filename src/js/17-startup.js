  // ===== 17-startup.js：起動時の処理：URLで届いた問題・折りたたみスマホの表示・アプリの更新・スプラッシュ画面・ボタンの説明 =====
  // （src/js/ の全ファイルで1つの (function () { … })(); になる。まとめ方は tools/build.py）
  // URLに問題（?p=81桁&n=問題名）が付いていれば、その問題を一覧に加えて開く（LINEなどで送られたリンクから）
  const urlProblem = (() => {
    try {
      const q = new URLSearchParams(location.search), g = (q.get("p") || "").replace(/\./g, "0");
      if (!/^[0-9]{81}$/.test(g)) return null;
      return { name: (q.get("n") || "").trim().slice(0, 40) || "届いた問題", givens: g };
    } catch (e) { return null; }
  })();
  if (urlProblem) {
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {}
    importProblemData(urlProblem, urlProblem.name);
  } else if (startResume()) resumeSaved();

  // ===== 折りたたみスマホを開いたとき =====
  // 開いた画面（タッチ操作・幅600px以上・ほぼ正方形）では、部品を左右2列に並べ替えて body に fold を付ける。
  // 閉じたら（画面の形が変わったら）元の場所に戻す。CSS は body.fold だけを見る
  (function () {
    // 左の列に移す部品（上から順）。状態表示と一時停止は横に並べるため .fold-status にまとめる
    const LEFT = [document.querySelector(".board-wrap"), document.querySelector(".timer-row")];
    const STATUS = [document.getElementById("prompt"), document.getElementById("pause")];
    // 右の列（.side）で、アプリ名のすぐ下に移す部品（マスを選んだときの操作パネル）
    const UNDER_HEAD = [document.getElementById("pad")];
    const mainEl = document.querySelector("main"), headEl = document.querySelector(".head");
    const left = Object.assign(document.createElement("div"), { className: "fold-left" });
    const status = Object.assign(document.createElement("div"), { className: "fold-status" });
    const marks = new Map(); // 部品 → 元の場所の目印
    const enter = () => {
      for (const el of [...LEFT, ...STATUS, ...UNDER_HEAD]) { const m = document.createComment("fold"); el.before(m); marks.set(el, m); }
      status.append(...STATUS);
      left.append(...LEFT, status);
      mainEl.prepend(left);
      headEl.after(...UNDER_HEAD);
    };
    const leave = () => {
      for (const [el, m] of marks) m.replaceWith(el);
      marks.clear();
      left.remove();
    };
    const apply = () => {
      const on = foldMQ.matches;
      if (on === isFold()) return;
      on ? enter() : leave();
      document.body.classList.toggle("fold", on);
      refreshSolveNote();
    };
    foldMQ.addEventListener("change", apply);
    apply();
  })();
  // ===== アプリの更新（GitHub版） =====
  // 古い保存分（キャッシュ）が残って新しい版が出ないときのために、
  // 起動時と画面に戻ったときに新しい版を確かめ、あればお知らせを出す。設定からも手動で更新できる
  (function () {
    const sw = navigator.serviceWorker;
    if (!sw || !/^https?:$/.test(location.protocol) || !sw.controller) return;
    const myVer = Number((document.querySelector(".ver")?.textContent.match(/\d+/) || [0])[0]);
    document.getElementById("app-update").hidden = false;
    document.getElementById("app-ver-now").textContent = `（今の版：ver.${myVer}）`;
    async function refreshApp() {
      try { if (typeof autoSave === "function") autoSave(); } catch (e) {}
      try { for (const r of await sw.getRegistrations()) await r.unregister(); } catch (e) {}
      try { for (const k of await caches.keys()) await caches.delete(k); } catch (e) {}
      location.replace(location.pathname + "?v=" + Date.now());
    }
    document.getElementById("app-refresh").addEventListener("click", refreshApp);
    document.getElementById("upd-go").addEventListener("click", refreshApp);
    const banner = document.getElementById("upd-banner");
    let dismissed = 0;
    document.getElementById("upd-later").addEventListener("click", () => { banner.hidden = true; dismissed = Date.now(); });
    let checking = false;
    async function checkNew() {
      if (checking || !navigator.onLine || Date.now() - dismissed < 30 * 60 * 1000) return;
      checking = true;
      try {
        sw.getRegistration().then((r) => r && r.update()).catch(() => {});
        const txt = await (await fetch("./index.html?check=" + Date.now(), { cache: "no-store" })).text();
        const v = Number((txt.match(/class="ver">ver\.(\d+)</) || [0, 0])[1]);
        if (v > myVer) {
          document.getElementById("upd-text").textContent = `新しい版（ver.${v}）があります。`;
          banner.hidden = false;
        }
      } catch (e) {}
      checking = false;
    }
    setTimeout(checkNew, 3000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkNew(); });
  })();
  {
    const setTut = document.getElementById("set-tut");
    const drawStartupSet = () => {
      try { setTut.checked = localStorage.getItem(TUT_KEY) === "1"; } catch (e) {}
      document.querySelector(`input[name="set-resume"][value="${startResume() ? "resume" : "home"}"]`).checked = true;
    };
    drawStartupSet();
    document.getElementById("go-settings").addEventListener("click", drawStartupSet);
    setTut.addEventListener("change", () => {
      try {
        if (setTut.checked) localStorage.setItem(TUT_KEY, "1");
        else localStorage.removeItem(TUT_KEY);
      } catch (e) {}
    });
    // 回答の方式（消し込み方式／書き込み方式）。選んだ方式は次回も使う
    const STYLE_KEY = "sudoku-style";
    const getStyle = () => { try { return localStorage.getItem(STYLE_KEY) === "write" ? "write" : "erase"; } catch (e) { return "erase"; } };
    const applyStyle = () => board.toggleAttribute("data-style-write", getStyle() === "write");
    applyStyle();
    document.getElementById("go-settings").addEventListener("click", () => {
      document.querySelector(`input[name="set-style"][value="${getStyle()}"]`).checked = true;
    });
    // 「詳細説明」を押すと、2つの方式を表で比べるポップアップを出す（「この方式にする」で選んで閉じる）
    const styleBox = document.getElementById("style-box");
    const closeStyleBox = () => { styleBox.hidden = true; document.getElementById("style-more").focus(); };
    document.getElementById("style-more").addEventListener("click", () => { styleBox.hidden = false; styleBox.querySelector(".style-inner").scrollTop = 0; document.getElementById("style-close").focus({ preventScroll: true }); });
    document.getElementById("style-close").addEventListener("click", closeStyleBox);
    styleBox.addEventListener("click", (e) => {
      if (e.target === styleBox) return closeStyleBox();
      const b = e.target.closest("button[data-style]");
      if (!b) return;
      const r = document.querySelector(`input[name="set-style"][value="${b.dataset.style}"]`);
      r.checked = true;
      r.dispatchEvent(new Event("change", { bubbles: true }));
      closeStyleBox();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !styleBox.hidden) closeStyleBox(); });
    const setLimit = document.getElementById("set-hintlimit");
    const drawPlaySet = () => {
      setLimit.value = String(hintLimit());
    };
    drawPlaySet();
    document.getElementById("go-settings").addEventListener("click", drawPlaySet);
    document.getElementById("play-set").addEventListener("change", (e) => {
      try {
        if (e.target === setLimit) localStorage.setItem(HINTLIMIT_KEY, setLimit.value);
      } catch (err) {}
    });
    const setAuto = document.getElementById("set-autoerase");
    setAuto.checked = autoErase();
    document.getElementById("go-settings").addEventListener("click", () => { setAuto.checked = autoErase(); });
    setAuto.addEventListener("change", () => {
      try { if (setAuto.checked) localStorage.setItem(AUTOERASE_KEY, "1"); else localStorage.removeItem(AUTOERASE_KEY); } catch (e) {}
    });
    document.getElementById("style-set").addEventListener("change", (e) => {
      if (e.target.name !== "set-style") return;
      try { localStorage.setItem(STYLE_KEY, e.target.value); } catch (err) {}
      applyStyle();
    });
    document.getElementById("startup-set").addEventListener("change", (e) => {
      if (e.target.name !== "set-resume") return;
      try { localStorage.setItem(RESUME_KEY, e.target.value); } catch (err) {}
    });
  }
  // 起動時のスプラッシュ画面: 少し見せてから消し、そのあと使い方ガイドを出す（タップですぐ閉じる）
  const splash = document.getElementById("splash");
  let splashDone = false;
  // タイトルを1文字ずつ打ち出す
  const splashText = splash.querySelector(".splash-text");
  // アプリ名の下にバージョン（画面右上の表示と同じもの）
  document.getElementById("splash-ver").textContent = document.querySelector(".head .ver").textContent;
  const splashChars = [...splashText.textContent];
  const splashCalm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (matchMedia("(hover: hover) and (pointer: fine)").matches) splash.querySelector(".splash-tap").textContent = "クリックでスキップ";
  const typed = new Promise((done) => {
    if (splashCalm) { splash.classList.add("typed"); return done(); }
    // 文字は最初から全部置いて透明にしておき、CSSアニメーションで順に浮かび上がらせる（位置がずれないのでなめらか）
    splashText.textContent = "";
    const spans = splashChars.map((c, i) => {
      const ch = document.createElement("span");
      ch.className = "ch";
      ch.textContent = c;
      ch.style.setProperty("--i", i);
      splashText.appendChild(ch);
      return ch;
    });
    // 出ている文字だけが常に中央に来るよう、タイトル全体を右から左へすべらせる。カーソルは今出ている文字の右へ
    const title = splash.querySelector(".splash-title");
    const caret = splash.querySelector(".splash-caret");
    const x0 = spans[0].offsetLeft;
    const right = (i) => spans[i].offsetLeft + spans[i].offsetWidth - x0;
    const full = right(spans.length - 1);
    const moveTo = (w, caretX, last) => {
      title.style.transition = `transform ${last ? "0.5s cubic-bezier(.22, .61, .36, 1)" : "0.24s linear"}`;
      title.style.transform = `translateX(${(full - w) / 2}px)`;
      caret.style.transform = `translateX(${caretX}px)`;
    };
    title.style.transform = `translateX(${full / 2}px)`;
    caret.style.transform = `translateX(${x0 - 6}px)`;
    spans.forEach((ch, i) => ch.addEventListener("animationstart", () => moveTo(right(i), x0 + right(i) + 3, i === spans.length - 1)));
    spans[spans.length - 1].addEventListener("animationend", () => { splash.classList.add("typed"); done(); });
  });
  function endSplash() {
    if (splashDone) return;
    splashDone = true;
    splash.classList.add("fade");
    setTimeout(() => { splash.hidden = true; }, 500);
    // URLで届いた問題を開いたときは、使い方ガイドを出さずにすぐ問題を見せる
    if (urlProblem) return;
    try { if (localStorage.getItem(TUT_KEY) !== "1") openTutorial(); } catch (e) { openTutorial(); }
  }
  splash.addEventListener("click", endSplash);
  // 読み込みとタイトルの打ち出しが両方終わってから約3秒見せる
  const loaded = document.readyState === "complete" ? Promise.resolve() : new Promise((r) => addEventListener("load", r, { once: true }));
  Promise.all([loaded, typed]).then(() => setTimeout(endSplash, 3000));
  board.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(e.target); }
  });
})();

// ボタンの説明：PCはマウスを乗せると、スマホは長押しすると出す（長押しのときはボタンを押したことにしない）
(() => {
  const mouse = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const tips = {
    "tut-open": "使い方ガイドを開きます", "home-btn": "最初の画面に戻ります", "set-btn": "設定を開きます",
    "go-make": "新しい問題を作るか、問題ファイルを読み込みます", "go-solve": "保存した問題を選んで解きます",
    "go-settings": "起動するときの動き、回答の方式（消し込み・書き込み）、Googleドライブの接続などを設定します",
    "new": "空の盤に問題の数字を入力して登録します", "new-auto": "レベルを選ぶと、問題を自動で作ります",
    "edit-saved": "保存した問題を選んで直します", "gd-open": "Googleドライブに保存した問題を開きます",
    "app-refresh": "最新の版を読み込み直します", "photo-paste": "コピーした画像を貼り付けて、問題を読み取ります",
    "done": "入力した数字を問題として登録します", "reg-cancel": "問題を登録せずに、最初の画面に戻ります", "go": "タイマーを動かして回答を始めます",
    "pause": "タイマーを止めて盤を隠します。「再開」で続きから解けます",
    "undo": "1つ前の操作に戻します（Ctrl+Z、Macは⌘Zでも戻れます）",
    "hint": "次に使える解き方を教えます。★の数がレベルです",
    "check": "確定したマスが正解かどうかを調べます",
    "view": "未確定のマスを空白にする・候補を表示する・正解を表示する、を切り替えます",
    "save-progress": "今の状態を保存します。あとで「保存した状態に戻す」で戻れます",
    "snap-open": "保存した状態を選んで、その時点に戻ります",
    "replay": "確定候補を入れた順に、盤の上で再生します", "clear-replay": "確定候補を入れた順に、盤の上で再生します",
    "save-solved": "完成した盤を保存します", "clear-save": "完成した盤を保存します", "share-solved": "最初の数字だけの問題図と、かかった時間・81桁の盤面データを送ります", "clear-share": "最初の数字だけの問題図と、かかった時間・81桁の盤面データを送ります",
    "edit": "問題の数字を直します", "export-cur": "この問題をファイルに書き出します",
    "reset": "回答を消して最初からやり直します（問題の数字は残ります）", "back": "問題一覧に戻ります",
    "pad-revive": "行・列・ブロックに無い数字のうち、消した候補を元に戻します",
  };
  const tip = document.createElement("div");
  tip.className = "btn-tip"; tip.setAttribute("role", "tooltip");
  document.body.appendChild(tip);
  let cur = null, timer = null;
  const hide = () => { clearTimeout(timer); cur = null; tip.classList.remove("show"); };
  const textOf = (b) => {
    if (b.id === "replay" && b.textContent.includes("止める")) return "再生を止めます";
    if (b.id === "pause" && b.textContent.includes("再開")) return "タイマーを動かして、続きから解きます";
    if (b.closest(".nh-keys")) return `${b.textContent.trim()} が入れる候補を点滅させます。もう一度押すと消えます`;
    return tips[b.id];
  };
  const show = (b, above) => {
    if (cur !== b || !b.isConnected || b.offsetParent === null) return;
    tip.textContent = textOf(b);
    const r = b.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    const x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8);
    let y = above ? r.top - h - 10 : r.bottom + 8; // 指で隠れないよう、スマホはボタンの上に出す
    if (above ? y < 8 : y + h > innerHeight - 8) y = above ? r.bottom + 10 : r.top - h - 8;
    tip.style.left = x + "px"; tip.style.top = y + "px";
    tip.classList.add("show");
  };
  if (mouse) {
    document.addEventListener("mouseover", (e) => {
      const b = e.target.closest && e.target.closest("button");
      if (b === cur) return;
      hide();
      if (!b || !textOf(b)) return;
      cur = b;
      timer = setTimeout(() => show(b, false), 450);
    });
    document.addEventListener("mousedown", hide, true);
    document.addEventListener("keydown", hide, true);
  } else {
    let sx = 0, sy = 0, shown = null;
    document.addEventListener("touchstart", (e) => {
      hide(); shown = null;
      const b = e.target.closest && e.target.closest("button");
      if (!b || e.touches.length > 1 || !textOf(b)) return;
      cur = b; sx = e.touches[0].clientX; sy = e.touches[0].clientY;
      timer = setTimeout(() => { show(b, true); if (cur === b) shown = b; }, 500);
    }, { passive: true });
    document.addEventListener("touchmove", (e) => {
      if (cur && Math.hypot(e.touches[0].clientX - sx, e.touches[0].clientY - sy) > 10) hide();
    }, { passive: true });
    const end = (e) => {
      if (shown && e.cancelable) e.preventDefault(); // 説明を出したときは、ボタンを押したことにしない
      hide();
    };
    document.addEventListener("touchend", end, true);
    document.addEventListener("touchcancel", end, true);
    // 長押し後に遅れて届くクリックも無視する
    document.addEventListener("click", (e) => { if (shown && e.target.closest && e.target.closest("button") === shown) { e.preventDefault(); e.stopPropagation(); } shown = null; }, true);
    document.addEventListener("contextmenu", (e) => { if (e.target.closest && e.target.closest("button")) e.preventDefault(); }, true);
  }
  addEventListener("scroll", hide, true);
})();
