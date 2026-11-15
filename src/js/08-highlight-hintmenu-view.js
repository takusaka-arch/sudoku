  // ===== 08-highlight-hintmenu-view.js：盤の下の1〜9のハイライト・ヒントメニュー・ヒントを控える設定・表示方法変更・確認の画面 =====
  // （src/js/ の全ファイルで1つの (function () { … })(); になる。まとめ方は tools/build.py）
  const hintBtn = document.getElementById("hint");
  const viewBtn = document.getElementById("view");
  // 盤の下の 1〜9：押すとその数字を点滅させる（もう一度押すと止める）
  const hlKeys = document.querySelector("#num-hl .nh-keys");
  for (let n = 1; n <= 9; n++) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = n;
    b.setAttribute("aria-pressed", "false");
    b.setAttribute("aria-label", `${n}をハイライト`);
    b.addEventListener("click", () => toggleHighlight(String(n)));
    hlKeys.appendChild(b);
  }
  // 押すたびに足していく（もう一度押すとその数字だけ止める）。同時に4つまで
  const hlAlert = document.querySelector("#num-hl .nh-alert");
  let hlAlertTimer = 0;
  // 色は「枠」ごとに決まっていて、1つ止めても他の数字の色は変わらない。空いた枠に次の数字が入る
  const hlSlots = () => { const a = (board.dataset.hl || "").split(","); while (a.length < 4) a.push(""); return a.slice(0, 4); };
  function toggleHighlight(n) {
    const list = hlSlots();
    if (list.includes(n)) { list[list.indexOf(n)] = ""; return setHighlight(list.some(Boolean) ? list.join(",") : ""); }
    const free = list.indexOf("");
    if (free < 0) {
      hlAlert.hidden = false;
      clearTimeout(hlAlertTimer);
      hlAlertTimer = setTimeout(() => { hlAlert.hidden = true; }, 2500);
      return;
    }
    list[free] = n;
    setHighlight(list.join(","));
  }
  function setHighlight(v) {
    if (v) board.dataset.hl = v;
    else delete board.dataset.hl;
    const list = (v || "").split(",");
    hlKeys.querySelectorAll("button").forEach((b) => {
      const k = list.indexOf(b.textContent);
      b.setAttribute("aria-pressed", String(k >= 0));
      b.classList.remove("hlc0", "hlc1", "hlc2", "hlc3");
      if (k >= 0) b.classList.add("hlc" + k);
    });
    if (list.filter(Boolean).length < 4) hlAlert.hidden = true;
    applyHighlight();
  }
  // ヒントボタンでヒントの種類を選ぶメニューを開く（種類はこの一覧に足せば増やせる）
  const hintKinds = [
    // lv: ヒントのレベル（右の★の数・ポイント）。1 = 次に注目するマス、2 中級、3 上級、4 達人、5 超上級、6 背理法
    { label: "ヒントを消す", desc: "表示しているヒントの色と説明を消します", run: () => {} },
    { lv: 1, label: "注目するマス", desc: "次に考えるとよいマスに色を付けます。盤を変えずにもう一度選ぶと「次に注目するマス」になり、別のマスを示します", run: () => runHint(false) },
    { lv: 2, label: "ポインティング", desc: "ブロックの中で1つの行（列）にしか入らない数字と、それでブロックの外から消せる候補を示します", run: () => showBoxLine("pointing") },
    { lv: 2, label: "2つの数字のペア", desc: "隠れペア（2つの数字が同じ2マスにしか入らない）と、ネイキッドペア（候補が同じ2つだけのマスが2つある）を、組ごとに色分けします", run: () => showPairs(2) },
    { lv: 3, label: "クレーミング", desc: "行（列）の中で1つのブロックにしか入らない数字と、それでそのブロックの中から消せる候補を示します", run: () => showBoxLine("claiming") },
    { lv: 3, label: "3つの数字の組", desc: "隠れた3つの組と、ネイキッド3つの組（3マスの候補を合わせると3つの数字だけ）を、消せる候補と一緒に示します", run: () => showSubsets(3) },
    { lv: 3, label: "Xウイング", desc: "2つの行（列）で長方形の角にしか入らない数字と、それで消せる候補を示します", run: () => showXWing() },
    { lv: 4, label: "4つの数字の組", desc: "3つの組と同じ考え方を、4つの数字と4マスで使います", run: () => showSubsets(4) },
    { lv: 4, label: "ソードフィッシュ", desc: "Xウイングを3つの行（列）に広げたものです", run: () => showSwordfish() },
    { lv: 4, label: "XYウイング", desc: "候補が2つのマス3つ（AB・AC・BC）を使い、両端から見えるマスのCを消します。Y-Wingとも呼びます", run: () => showWing(false) },
    { lv: 4, label: "XYZウイング", desc: "軸のマスの候補が3つ（ABC）のXYウイングです。3マスすべてから見えるマスのCを消します", run: () => showWing(true) },
    { lv: 4, label: "スカイスクレイパー", desc: "2か所にしか入らない行（列）を2本使い、端どうしの両方から見えるマスの候補を消します", run: () => showSkyscraper() },
    { lv: 4, label: "唯一解の原則", desc: "ユニークレクタングル。2つのブロックにまたがる長方形の4マスが同じ2つの候補だけになると答えが2通りになってしまうので、そうならないように候補を消します", run: () => showUR() },
    { lv: 5, label: "シンプルカラーリング", desc: "ある数字が2か所にしか入らない所をたどって2色で塗り、どちらかの色が正解になることを使って候補を消します", run: () => showColoring() },
    { lv: 5, label: "リモートペア", desc: "候補が同じ2つのマスが4つ以上つながるとき、交互に入る数字を使って候補を消します", run: () => showRemotePair() },
    { lv: 5, label: "XYチェーン", desc: "候補が2つのマスを鎖のようにつなぎ、鎖の両端から見えるマスの候補を消します。順番を番号で示します", run: () => showXYChain() },
    { lv: 5, label: "チェーン", desc: "「2か所にしか入らない数字」と「候補が2つのマス」を交互につなぎ、両端のどちらかが正しいことを使って候補を消します", run: () => showChain() },
    { lv: 6, label: "背理法", desc: "候補が2つのマスに片方を仮に入れ、矛盾が出たらもう一方が答えだと分かります", run: () => showContradiction() },
    { label: "答えと理由", desc: "入る数字と、その理由を教えます。すぐ決まるマスがなければ、上級の解き方で候補を消してから答えを示します（背理法が必要なら答えだけ示します）", run: () => runHint(true) },
  ];
  const hintMenu = document.getElementById("hint-menu");
  // ヒントを控える設定: 控えるレベル以下のヒントは「もう少しがんばりましょう」を出し、「それでもヒントを見る」で表示する
  // 見せてよければ true を返す。控えるときは go を覚えておき、「それでもヒントを見る」で go を呼ぶ
  const hintGateBox = document.getElementById("hint-gate");
  let hintGateGo = null, hintForce = false;
  function hintGate(lv, go) {
    const lim = hintLimit();
    if (hintForce || !lim || lv > lim) return true;
    hintGateGo = go;
    document.getElementById("hint-gate-msg").textContent = `もう少しがんばりましょう。（レベル${lim}までのヒントは控える設定です）`;
    hintGateBox.hidden = false;
    return false;
  }
  document.getElementById("gate-no").addEventListener("click", () => { hintGateBox.hidden = true; hintGateGo = null; });
  document.getElementById("gate-show").addEventListener("click", () => {
    hintGateBox.hidden = true;
    const go = hintGateGo;
    hintGateGo = null;
    if (!go || board.dataset.mode !== "solve") return;
    hintForce = true;
    try { go(); } finally { hintForce = false; }
  });
  // 1行に「番号とタイトル」と「？」。「？」を押すと、その下に説明が開く（もう一度で閉じる。開くのは1つだけ）
  let hintNo = 0;
  hintKinds.forEach((k) => {
    if (k.head) {
      const h = document.createElement("div");
      h.className = "hm-head";
      h.textContent = k.head;
      hintMenu.appendChild(h);
      return;
    }
    const i = hintNo++;
    const item = document.createElement("div");
    item.className = "hm-item";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "hm-go";
    b.setAttribute("role", "menuitem");
    b.innerHTML = `<span class="hm-no">${"①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳"[i]}</span><span class="hm-label"></span>`;
    b.querySelector(".hm-label").textContent = k.label;
    b.dataset.kind = k.label;
    if (k.lv) {
      const st = document.createElement("span");
      st.className = "hm-lv";
      st.textContent = "★".repeat(k.lv);
      st.setAttribute("aria-label", `レベル${k.lv}`);
      b.appendChild(st);
    }
    const q = document.createElement("button");
    q.type = "button";
    q.className = "hm-q";
    q.textContent = "？";
    q.setAttribute("aria-label", `${k.label}の説明`);
    q.setAttribute("aria-expanded", "false");
    const desc = document.createElement("p");
    desc.className = "hm-desc";
    desc.textContent = k.desc;
    desc.hidden = true;
    q.addEventListener("click", () => {
      const open = desc.hidden;
      hintMenu.querySelectorAll(".hm-desc").forEach((x) => { x.hidden = true; });
      hintMenu.querySelectorAll(".hm-q").forEach((x) => x.setAttribute("aria-expanded", "false"));
      desc.hidden = !open;
      q.setAttribute("aria-expanded", String(open));
    });
    item.append(b, q, desc);
    b.addEventListener("click", () => {
      closeHintMenu();
      clearHints();
      hintKindNow = k.label;
      // 消しまちがえた候補や、正解と違う確定候補があると、ヒントがまちがった前提で計算されるので先に知らせる
      if (k.label !== "ヒントを消す" && hintMistake()) return;
      // 注目するマスは、示すマスに要る解き方のレベルで判断する（runHint の中）
      if (!k.lv || k.label === "注目するマス" || hintGate(k.lv, () => k.run())) k.run();
    });
    hintMenu.appendChild(item);
  });
  function hintMistake() {
    if (board.dataset.mode !== "solve" || !solution || solution.n !== 1 || !solution.sol) return false;
    const bad = [];
    board.querySelectorAll(".cell").forEach((c) => {
      if (c.classList.contains("given")) return;
      const d = solution.sol[c.dataset.row * 9 + +c.dataset.col];
      if (c.classList.contains("tent") ? c.querySelector(".big").textContent !== d : c.querySelector(`.cand[data-n="${d}"]`).classList.contains("off")) bad.push(c);
    });
    if (!bad.length) return false;
    bad.forEach((c) => c.classList.add("check-wrong"));
    workMsg.classList.add("err");
    workMsg.textContent = `ヒントを出す前に：赤いマス（${bad.length}マス）に、正解の数字を消してしまった候補か、正解と違う確定候補があります。このままだとヒントがまちがった前提で計算されるので、先に直してください。（消した候補は、マスのメニューの「このマスの消した候補を復活」で戻せます）`;
    return true;
  }
  function closeHintMenu() {
    hintMenu.hidden = true;
    hintMenu.querySelectorAll(".hm-desc").forEach((x) => { x.hidden = true; });
    hintMenu.querySelectorAll(".hm-q").forEach((x) => x.setAttribute("aria-expanded", "false"));
    hintBtn.setAttribute("aria-expanded", "false");
  }
  hintBtn.addEventListener("click", () => {
    if (!hintMenu.hidden) return closeHintMenu();
    closeViewMenu();
    closeSnapUI();
    // 注目するマスを示した後、盤が同じなら「次に注目するマス」にする
    const fl = hintMenu.querySelector(".hm-go[data-kind=\"注目するマス\"] .hm-label");
    if (fl) fl.textContent = focusState.seen.size && focusState.sig === focusSig() ? "次に注目するマス" : "注目するマス";
    hintMenu.hidden = false;
    hintBtn.setAttribute("aria-expanded", "true");
    placeHintMenu();
    hintMenu.querySelector("button").focus({ preventScroll: true });
    if (!isPcMenu()) hintMenu.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
  // パソコン（横幅761px以上）では、一覧を「ヒント」ボタンのすぐ下に出す
  const isPcMenu = () => window.matchMedia("(min-width: 761px)").matches;
  function placeHintMenu() {
    if (hintMenu.hidden) return;
    if (!isPcMenu()) { hintMenu.style.left = hintMenu.style.top = hintMenu.style.maxHeight = ""; return; }
    const r = hintBtn.getBoundingClientRect(), vw = document.documentElement.clientWidth;
    const w = Math.min(360, vw - 16);
    hintMenu.style.left = Math.max(8, Math.min(r.left, vw - w - 8)) + "px";
    hintMenu.style.top = (r.bottom + 4) + "px";
    hintMenu.style.maxHeight = Math.max(160, window.innerHeight - r.bottom - 12) + "px";
  }
  window.addEventListener("resize", placeHintMenu);
  window.addEventListener("scroll", placeHintMenu, { passive: true });
  document.addEventListener("click", (e) => {
    if (!hintMenu.hidden && !hintMenu.contains(e.target) && e.target !== hintBtn) closeHintMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !hintMenu.hidden) { closeHintMenu(); hintBtn.focus(); }
  });
  // 表示方法変更: 未確定のマスを空白にするか、候補を表示するかの2択（選んだ表示は次回も使う）
  const VIEW_KEY = "sudoku-view";
  const viewMenu = document.getElementById("view-menu");
  const viewKinds = [
    { key: "blank", label: "未確定のマスを空白にする", desc: "大きな数字が入っていないマスの小さな数字を、すべて隠します" },
    { key: "", label: "未確定のマスの候補を表示する", desc: "小さな数字を表示する、いつもの表示です" },
    { key: "answer", label: "正解を表示する", desc: "確定していないマスに正解を緑で表示します。違う確定候補は赤い背景になります。ほかの表示を選ぶと元に戻ります" },
  ];
  function applyView(v) {
    board.toggleAttribute("data-view-blank", !!v.blank);
    // 正解の表示は、選んだときだけ（次回には持ち越さない）
    const was = board.hasAttribute("data-view-answer");
    board.toggleAttribute("data-view-answer", !!v.answer);
    if (v.answer) drawAnswer(); else if (was) board.querySelectorAll(".cell.check-wrong").forEach((c) => c.classList.remove("check-wrong"));
    try { localStorage.setItem(VIEW_KEY, JSON.stringify({ blank: !!v.blank })); } catch {}
    viewMenu.querySelectorAll("button").forEach((b) => {
      const on = b.dataset.key === "answer" ? !!v.answer : b.dataset.key ? !!v.blank && !v.answer : !v.blank && !v.answer;
      b.setAttribute("aria-checked", String(on));
      b.querySelector(".hm-check").textContent = on ? "✓" : "";
    });
    viewBtn.classList.toggle("on", !!v.blank || !!v.answer);
  }
  const curView = () => ({ blank: board.hasAttribute("data-view-blank"), answer: board.hasAttribute("data-view-answer") });
  viewKinds.forEach((k) => {
    const b = document.createElement("button");
    b.type = "button";
    b.setAttribute("role", "menuitemradio");
    b.dataset.key = k.key;
    b.innerHTML = `<span class="hm-check"></span><span class="hm-label"></span><span class="hm-desc"></span>`;
    b.querySelector(".hm-label").textContent = k.label;
    b.querySelector(".hm-desc").textContent = k.desc;
    b.addEventListener("click", () => {
      closeViewMenu();
      if (k.key === "answer") {
        if (board.hasAttribute("data-view-answer")) return;
        if (!solution || !solution.n) { workMsg.classList.remove("err"); workMsg.textContent = "この問題は答えがないため、正解を表示できません。"; return; }
        ansConfirm.hidden = false;
        document.getElementById("ans-no").focus();
        return;
      }
      applyView({ blank: k.key === "blank" });
    });
    viewMenu.appendChild(b);
  });
  const ansConfirm = document.getElementById("ans-confirm");
  // 確認（リセット・正解を表示・自動で消した候補）は、盤の真ん中にポップアップで出す
  function placeConfirm(el) {
    const r = board.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    const x = Math.min(Math.max(r.left + r.width / 2, w / 2 + 8), vw - w / 2 - 8);
    const y = Math.min(Math.max(r.top + r.height / 2, h / 2 + 8), vh - h / 2 - 8);
    el.style.left = x + "px";
    el.style.top = y + "px";
  }
  document.querySelectorAll(".confirm").forEach((el) => {
    new MutationObserver(() => {
      if (el.hidden) return;
      placeConfirm(el);
      [...el.querySelectorAll("button")].pop()?.focus({ preventScroll: true });
    }).observe(el, { attributes: true, attributeFilter: ["hidden"] });
  });
  const replaceConfirms = () => document.querySelectorAll(".confirm:not([hidden])").forEach(placeConfirm);
  window.addEventListener("resize", replaceConfirms);
  window.addEventListener("scroll", replaceConfirms, { passive: true });
  document.getElementById("ans-no").addEventListener("click", () => { ansConfirm.hidden = true; viewBtn.focus(); });
  document.getElementById("ans-yes").addEventListener("click", () => {
    ansConfirm.hidden = true;
    applyView({ blank: board.hasAttribute("data-view-blank"), answer: true });
    workMsg.classList.remove("err");
    workMsg.textContent = "正解を緑で表示しています。" + (solution && solution.n > 1 ? "（答えが1つに決まらない問題なので、答えの1つです）" : "") + "元に戻すときは「表示方法変更」でほかの表示を選んでください。";
  });
  try { applyView({ blank: !!(JSON.parse(localStorage.getItem(VIEW_KEY)) || {}).blank }); } catch { applyView({}); }
  function closeViewMenu() {
    viewMenu.hidden = true;
    viewBtn.setAttribute("aria-expanded", "false");
  }
  viewBtn.addEventListener("click", () => {
    if (!viewMenu.hidden) return closeViewMenu();
    closeHintMenu();
    closeSnapUI();
    applyView(curView());
    viewMenu.hidden = false;
    viewBtn.setAttribute("aria-expanded", "true");
    viewMenu.querySelector("button").focus({ preventScroll: true });
    viewMenu.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
  document.addEventListener("click", (e) => {
    if (!viewMenu.hidden && !viewMenu.contains(e.target) && !viewBtn.contains(e.target)) closeViewMenu();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !viewMenu.hidden) { closeViewMenu(); viewBtn.focus(); }
  });
