  // ===== 02-input.js：マスの選択（スマホ）・タップ回数の判定・数字パッド・右クリック／長押しメニュー・問題登録完了・タイマー =====
  // （src/js/ の全ファイルで1つの (function () { … })(); になる。まとめ方は tools/build.py）
  // スマホではマスのタップでマスを選び、数字は下のパッドで操作する
  const phoneMQ = window.matchMedia("(max-width: 760px)");
  const isPhone = () => phoneMQ.matches;
  // 折りたたみスマホを開いた画面の判定（ここだけで決める。並べ替えは「折りたたみスマホを開いたとき」の処理）
  const FOLD_QUERY = "(pointer: coarse) and (min-width: 600px) and (min-aspect-ratio: 3/4) and (max-aspect-ratio: 4/3)";
  const foldMQ = matchMedia(FOLD_QUERY);
  const isFold = () => document.body.classList.contains("fold");
  board.addEventListener("click", (e) => {
    const cell = e.target.closest(".cell");
    // スマホでは、選んでいないマスをタップしたときはマスを選ぶだけにする（数字は変えない）
    // 選んでいるマスをもう一度タップしたときだけ、パソコンと同じように盤の数字を操作できる
    // （問題の数字・確定候補のマスは、1回目のタップで数字が変わらないので、そのまま数えてトリプルタップの消し込みができるようにする）
    const bigCell = cell && board.dataset.mode === "solve" && (cell.classList.contains("fixed") || cell.classList.contains("tent"));
    if (isPhone() && cell && ["register", "solve"].includes(board.dataset.mode) && cell !== sel && !bigCell) {
      if (board.dataset.mode === "solve") flushTap();
      selectCell(cell);
      return;
    }
    if (isPhone() && bigCell && cell !== sel) selectCell(cell);
    if (board.dataset.mode === "solve" && cell) return countTap(e.target, cell);
    act(e.target);
  });

  // 回答モードのタップ回数: 1回=候補の選択/解除、2回=確定候補、3回=候補を消す
  // （同じ数字への連続タップを少し待って数えてから実行する）
  let tap = { target: null, cell: null, n: 0, timer: null };
  function countTap(target, cell) {
    if (tap.target !== target) flushTap();
    tap.target = target;
    tap.cell = cell;
    tap.n++;
    clearTimeout(tap.timer);
    tap.timer = setTimeout(flushTap, 350);
  }
  function flushTap() {
    clearTimeout(tap.timer);
    const { target, cell, n } = tap;
    tap = { target: null, cell: null, n: 0, timer: null };
    if (target && board.dataset.mode === "solve") runTap(target, cell, Math.min(n, 3));
  }
  function runTap(target, cell, n) {
    // 問題の数字・確定候補を3回: その行・列・ブロックにある同じ数字の候補をすべて消す（全部消えていれば元に戻す）
    if (n === 1 && (cell.classList.contains("given") || cell.classList.contains("tent"))) {
      const num = cell.dataset.value || cell.querySelector(".big").textContent;
      sameNum = sameNum === num ? "" : num;
      applySame();
      return;
    }
    if (cell.classList.contains("given") || (cell.classList.contains("tent") && n === 3)) {
      if (n !== 3) return;
      const num = cell.dataset.value || cell.querySelector(".big").textContent, r = +cell.dataset.row, c = +cell.dataset.col;
      const cands = [...board.querySelectorAll(".cell")].filter((o) => o !== cell && !o.classList.contains("fixed") && !o.classList.contains("tent")
        && (+o.dataset.row === r || +o.dataset.col === c || (Math.floor(o.dataset.row / 3) === Math.floor(r / 3) && Math.floor(o.dataset.col / 3) === Math.floor(c / 3))))
        .map((o) => o.querySelector(`.cand[data-n="${num}"]`));
      const restore = cands.length > 0 && cands.every((s) => s.classList.contains("off"));
      cands.forEach((s) => {
        if (restore) s.classList.remove("off");
        else { s.classList.remove("pick", "bad"); s.classList.add("off"); }
      });
      markConflicts();
      return;
    }
    if (cell.classList.contains("tent")) {
      if (n === 2) toggleSure(cell, target);
      return;
    }
    if (!target.classList.contains("cand")) return;
    if (n === 3) {
      // そのマスの行・列・ブロックのうち、同じ数字が確定している（問題の数字か確定候補）ものについて、
      // その中の同じ数字をすべて消す。どこにも無ければそのマスの数字だけ。消えている数字なら元に戻す
      const restore = target.classList.contains("off");
      const num = target.dataset.n;
      const r = +cell.dataset.row, c = +cell.dataset.col;
      const units = [
        (o) => +o.dataset.row === r,
        (o) => +o.dataset.col === c,
        (o) => Math.floor(o.dataset.row / 3) === Math.floor(r / 3) && Math.floor(o.dataset.col / 3) === Math.floor(c / 3),
      ];
      const cells = [...board.querySelectorAll(".cell")];
      const has = (o) => o !== cell && (o.dataset.value === num || (o.classList.contains("tent") && o.querySelector(".big").textContent === num));
      const hit = units.filter((u) => cells.some((o) => u(o) && has(o)));
      const targets = hit.length ? cells.filter((o) => hit.some((u) => u(o)) && !o.classList.contains("fixed") && !o.classList.contains("tent"))
        .map((o) => o.querySelector(`.cand[data-n="${num}"]`)) : [target];
      targets.forEach((s) => {
        if (restore) s.classList.remove("off");
        else { s.classList.remove("pick", "bad"); s.classList.add("off"); }
      });
    } else if (target.classList.contains("off")) {
      return;
    } else if (n === 1) {
      target.classList.toggle("pick");
      target.classList.remove("bad");
    } else {
      target.classList.add("pick");
      toggleSure(cell, target);
    }
    markConflicts();
  }

  // 回答モード: 選んだ候補をダブルクリックで確定候補にする（大きく表示）、もう一度で元に戻す
  const AUTOERASE_KEY = "sudoku-autoerase";
  // 保存した状態に戻しても、タイマーは戻さず今のまま続ける（設定はなし）。ヒントを控えるレベル
  const HINTLIMIT_KEY = "sudoku-hintlimit";
  const snapTimerBack = () => false;
  try { localStorage.removeItem("sudoku-snaptimer"); } catch (e) {}
  const hintLimit = () => { try { return Math.max(0, Math.min(6, +localStorage.getItem(HINTLIMIT_KEY) || 0)); } catch (e) { return 0; } };
  const autoErase = () => { try { return localStorage.getItem(AUTOERASE_KEY) === "1"; } catch (e) { return false; } };
  function toggleSure(cell, target) {
    if (board.dataset.mode !== "solve" || cell.classList.contains("fixed")) return;
    if (cell.classList.contains("tent")) {
      // 大きな確定候補をダブルクリック: 元の3x3の候補表示に戻す
      cell.querySelectorAll(".cand.sure").forEach((o) => o.classList.remove("sure"));
      cell.classList.remove("tent", "tent-bad");
      cell.querySelector(".big").textContent = "";
      // 確定したときに自動で消した候補があれば、戻すかどうかを確認する
      const all = cell._auto || [], auto = all.filter((e) => e.s.classList.contains("off"));
      cell._auto = null;
      if (auto.length) askAutoRestore(cell, auto, all);
    } else if (target.classList.contains("pick")) {
      target.classList.add("sure");
      cell.querySelector(".big").textContent = target.dataset.n;
      cell.classList.add("tent");
      // 設定でオンのとき: 確定候補にした数字を、その行・列・ブロックの候補から消す（トリプルクリックの消す動きと同じ。戻しはしない）
      if (autoErase()) {
        const num = target.dataset.n, r = +cell.dataset.row, c = +cell.dataset.col;
        cell._auto = [];
        board.querySelectorAll(".cell").forEach((o) => {
          if (o === cell || o.classList.contains("fixed") || o.classList.contains("tent")) return;
          if (+o.dataset.row !== r && +o.dataset.col !== c && !(Math.floor(o.dataset.row / 3) === Math.floor(r / 3) && Math.floor(o.dataset.col / 3) === Math.floor(c / 3))) return;
          const s = o.querySelector(`.cand[data-n="${num}"]`);
          if (!s.classList.contains("off")) cell._auto.push({ s, pick: s.classList.contains("pick") });
          s.classList.remove("pick", "bad"); s.classList.add("off");
        });
      }
    }
    markConflicts();
  }

  // 数字パッド（スマホ）: 選んだマスの候補を同じ色で大きく表示する
  const pad = document.getElementById("pad");
  const padTitle = document.getElementById("pad-title");
  document.getElementById("pad-close").addEventListener("click", () => selectCell(null));
  const padNote = document.getElementById("pad-note");
  const keys = order.map((n) => {
    const k = document.createElement("button");
    k.type = "button";
    k.className = "key";
    k.dataset.n = n;
    k.textContent = n;
    document.getElementById("keys").appendChild(k);
    return k;
  });
  // パソコン（マウス）用: 乗せたマスの行・列・ブロックを薄い黄色にする
  const canHover = matchMedia("(hover: hover) and (pointer: fine)");
  let hlCell = null;
  function hoverCell(cell) {
    if (cell === hlCell) return;
    hlCell = cell;
    const on = !!cell && canHover.matches && !isPhone() && ["register", "ready", "solve"].includes(board.dataset.mode);
    board.querySelectorAll(".cell").forEach((c) => {
      c.classList.toggle("hl", on && (c.dataset.row === cell.dataset.row || c.dataset.col === cell.dataset.col
        || (Math.floor(c.dataset.row / 3) === Math.floor(cell.dataset.row / 3) && Math.floor(c.dataset.col / 3) === Math.floor(cell.dataset.col / 3))));
    });
  }
  board.addEventListener("mouseover", (e) => hoverCell(e.target.closest(".cell")));
  board.addEventListener("mouseleave", () => hoverCell(null));
  let sel = null;
  function selectCell(cell) {
    if (sel) sel.classList.remove("sel");
    sel = cell;
    if (!cell) {
      pad.hidden = true;
      board.querySelectorAll(".cell.peer").forEach((c) => c.classList.remove("peer"));
      return;
    }
    renderPad();
  }
  function renderPad() {
    const mode = board.dataset.mode;
    const show = !!sel && isPhone() && (mode === "register" || mode === "solve");
    pad.hidden = !show;
    if (sel) sel.classList.toggle("sel", show);
    // 選んだマスと同じ行・列・ブロックを薄く色付けする
    board.querySelectorAll(".cell").forEach((c) => {
      const peer = show && c !== sel && (c.dataset.row === sel.dataset.row || c.dataset.col === sel.dataset.col
        || (Math.floor(c.dataset.row / 3) === Math.floor(sel.dataset.row / 3) && Math.floor(c.dataset.col / 3) === Math.floor(sel.dataset.col / 3)));
      c.classList.toggle("peer", peer);
    });
    if (!show) return;
    const given = mode === "solve" && sel.classList.contains("fixed");
    document.getElementById("pad-revive").hidden = mode !== "solve" || given || sel.classList.contains("tent");
    // スマホでは右側に「選択中」「○行○列」「（確定候補）」を1行ずつ並べる
    const tag = given ? "（問題の数字）" : sel.classList.contains("tent") ? "（確定候補）" : "";
    padTitle.textContent = matchMedia("(max-width: 760px)").matches
      ? `選択中\n${+sel.dataset.row + 1}行${+sel.dataset.col + 1}列` + (tag ? "\n" + tag : "")
      : `選択中：${+sel.dataset.row + 1}行${+sel.dataset.col + 1}列` + tag;
    for (const k of keys) {
      const cand = sel.querySelector(`.cand[data-n="${k.dataset.n}"]`);
      k.className = "key";
      for (const c of ["pick", "sure", "bad", "shadow", "off", "hint", "pair"]) if (cand.classList.contains(c)) k.classList.add(c);
      k.classList.toggle("val", sel.dataset.value === k.dataset.n);
      // 問題の数字のマスでは、その数字のボタンだけ押せる（トリプルタップで消し込みをする）
      k.disabled = given && k.dataset.n !== sel.dataset.value;
    }
    // スマホでは説明を短くして、拡大表示が画面に収まるようにする
    const narrow = matchMedia("(max-width: 760px)").matches;
    if (narrow && mode !== "register") {
      padNote.textContent = given ? "問題の数字は変えられません。\nトリプルタップ：同じ行・列・ブロックの同じ数字の候補を消す・戻す\n長押し：メニュー"
        : "1回タップ：候補（青）\n2回：確定候補にする・戻す\n3回：同じ数字を行・列・ブロックから消す・戻す\n長押し：メニュー";
      return;
    }
    padNote.textContent = mode === "register"
      ? "数字をタップすると問題の数字になります。同じ数字をもう一度タップすると消えます。"
      : given ? "問題の数字は変えられません。この数字をトリプルタップ（または長押しでメニュー）すると、同じ行・列・ブロックの同じ数字の候補を消す・戻すができます。"
      : "1回タップ：候補（青）の選択・解除\nダブルタップ：確定候補にする・戻す\nトリプルタップ：その数字が確定している行・列・ブロックの中の同じ数字を消す・戻す\n長押し：メニューから選ぶ";
  }
  pad.addEventListener("click", (e) => {
    const k = e.target.closest(".key");
    if (!k || !sel || k.disabled) return;
    if (board.dataset.mode === "solve" && sel.classList.contains("given")) return countTap(sel.querySelector(".big"), sel);
    const cand = sel.querySelector(`.cand[data-n="${k.dataset.n}"]`);
    if (board.dataset.mode === "register") {
      act(sel.dataset.value === k.dataset.n ? sel.querySelector(".big") : cand, true);
      return;
    }
    countTap(cand, sel);
  });
  phoneMQ.addEventListener?.("change", renderPad);
  phoneMQ.addEventListener?.("change", refreshSolveNote);

  // 右クリック（スマホは長押し）: ダブル・トリプルが難しいときに、動作をメニューから選ぶ
  const ctx = document.getElementById("ctx");
  function closeCtx() { ctx.hidden = true; }
  function openCtx(target, cell, x, y) {
    if (board.dataset.mode !== "solve" || !cell) return false;
    flushTap();
    const big = cell.classList.contains("given") || cell.classList.contains("tent");
    if (!big && !target.classList.contains("cand")) return false;
    const n = big ? cell.dataset.value || cell.querySelector(".big").textContent : target.dataset.n;
    const t = big ? cell.querySelector(".big") : target;
    const items = cell.classList.contains("given") ? [[`行・列・ブロックの ${n} の候補を消す・戻す`, 3]]
      : cell.classList.contains("tent") ? [[`${n} を確定候補から外す`, 2], [`行・列・ブロックの ${n} の候補を消す・戻す`, 3]]
      : target.classList.contains("off") ? [[`消した ${n} を戻す`, 3]]
      : [[target.classList.contains("pick") ? `候補 ${n} を外す` : `${n} を候補（青）にする`, 1], [`${n} を確定候補にする`, 2], [`${n} を候補から消す`, 3]];
    if (!big && !assume && !target.classList.contains("off")) items.push([`${n} と仮定する`, "asm"]);
    if (!big) items.push(["このマスの消した候補を復活", "rev"]);
    ctx.textContent = "";
    const head = document.createElement("p");
    head.textContent = `${+cell.dataset.row + 1}行${+cell.dataset.col + 1}列`;
    ctx.appendChild(head);
    for (const [label, k] of items) {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "menuitem");
      b.textContent = label;
      if (k === "asm") b.className = "ctx-asm";
      b.addEventListener("click", () => { closeCtx(); if (board.dataset.mode !== "solve") return; if (k === "rev") reviveCell(cell); else if (k === "asm") startAssume(cell, t); else runTap(t, cell, k); });
      ctx.appendChild(b);
    }
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "cancel";
    cancel.textContent = "キャンセル";
    cancel.addEventListener("click", closeCtx);
    ctx.appendChild(cancel);
    ctx.hidden = false;
    const w = ctx.offsetWidth, h = ctx.offsetHeight;
    ctx.style.left = `${Math.max(8, Math.min(x, innerWidth - w - 8))}px`;
    ctx.style.top = `${Math.max(8, Math.min(y, innerHeight - h - 8))}px`;
    ctx.querySelector("button").focus({ preventScroll: true });
    return true;
  }
  // 盤・パッドで押した場所から、対象の数字とマスを決める
  function ctxTarget(el) {
    const k = el.closest("#pad .key");
    if (k) return sel && !k.disabled ? [sel.classList.contains("given") ? sel.querySelector(".big") : sel.querySelector(`.cand[data-n="${k.dataset.n}"]`), sel] : null;
    const cell = el.closest("#board .cell");
    return cell ? [el.closest(".cand, .big") || el, cell] : null;
  }
  let longPressed = 0;
  for (const area of [board, pad]) {
    area.addEventListener("contextmenu", (e) => {
      if (board.dataset.mode !== "solve") return;
      e.preventDefault();
      if (Date.now() - longPressed < 1000) return;  // 長押しですでに開いている
      const tg = ctxTarget(e.target);
      if (tg) openCtx(tg[0], tg[1], e.clientX, e.clientY);
    });
    let press = null;
    area.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" || board.dataset.mode !== "solve") return;
      const x = e.clientX, y = e.clientY, el = e.target;
      clearTimeout(press?.timer);
      press = { x, y, timer: setTimeout(() => {
        press = null;
        const tg = ctxTarget(el);
        if (!tg) return;
        if (area === board && isPhone() && tg[1] !== sel) selectCell(tg[1]);
        if (openCtx(tg[0], tg[1], x, y)) { longPressed = Date.now(); navigator.vibrate?.(15); }
      }, 500) };
    });
    const cancelPress = (e) => {
      if (!press) return;
      if (e.type === "pointermove" && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 10) return;
      clearTimeout(press.timer);
      press = null;
    };
    for (const ev of ["pointerup", "pointercancel", "pointermove"]) area.addEventListener(ev, cancelPress);
    // 長押しのあとに来るタップは数えない
    area.addEventListener("click", (e) => {
      if (Date.now() - longPressed < 1000) { e.stopImmediatePropagation(); e.preventDefault(); }
    }, true);
  }
  document.addEventListener("pointerdown", (e) => {
    if (!ctx.hidden && !ctx.contains(e.target) && Date.now() - longPressed > 600) closeCtx();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !ctx.hidden) closeCtx(); });
  addEventListener("scroll", () => { if (Date.now() - longPressed > 600) closeCtx(); }, { passive: true });

  // 問題登録完了: この時点で入っている数字を問題（変更不可）として確定する
  const done = document.getElementById("done");
  const prompt = document.getElementById("prompt");
  const note = document.getElementById("note");
  const registerNote = note.textContent;
  const pname = document.getElementById("pname");
  const nameField = document.getElementById("name-field");
  let currentName = "";
  done.addEventListener("click", () => {
    const givens = board.querySelectorAll(".cell.fixed");
    if (givens.length === 0) {
      prompt.textContent = "数字が1つも登録されていません。問題の数字を入れてから押してください";
      return;
    }
    board.querySelectorAll(".cell.ocr-unsure").forEach((c) => c.classList.remove("ocr-unsure"));
    // 名前を付けて保存（同じ名前なら上書き、未入力なら日時で名前を付ける）
    let name = pname.value.trim();
    if (!name) {
      const d = new Date(), p2 = (n) => String(n).padStart(2, "0");
      name = `問題 ${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
      pname.value = name;
    }
    let digits = "";
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) digits += cellAt(r, c).dataset.value || "0";
    const list = loadAll().filter((p) => p.name !== name && p.name !== currentName);
    list.push({ name, givens: digits, saved: new Date().toISOString() });
    const ok = saveAll(list);
    currentName = name;
    givens.forEach((c) => {
      c.classList.add("given");
      c.querySelector(".big").tabIndex = -1;
    });
    board.querySelectorAll(".cell.tent-off").forEach((c) => {
      c.classList.remove("tent-off");
      const sure = c.querySelector(".cand.sure");
      if (!c.classList.contains("fixed") && sure) {
        c.querySelector(".big").textContent = sure.dataset.n;
        c.classList.add("tent");
      }
    });
    markConflicts();
    showReady(givens.length);
    if (!ok) prompt.textContent += "。このブラウザでは保存できませんでした";
  });

  // 経過時間タイマー
  const timerEl = document.getElementById("timer");
  let elapsed = 0, startedAt = null, tick = null;
  function fmt(ms) {
    const s = Math.floor(ms / 1000), p2 = (n) => String(n).padStart(2, "0");
    const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60;
    return (h ? h + ":" + p2(m) : p2(m)) + ":" + p2(s % 60);
  }
  function drawTimer() {
    timerEl.textContent = fmt(elapsed + (startedAt ? Date.now() - startedAt : 0));
  }
  function timerStart() {
    if (startedAt) return;
    startedAt = Date.now();
    tick = setInterval(drawTimer, 250);
    timerEl.classList.remove("paused");
    drawTimer();
  }
  function timerStop() {
    if (startedAt) elapsed += Date.now() - startedAt;
    startedAt = null;
    clearInterval(tick);
    timerEl.classList.add("paused");
    drawTimer();
  }
  function timerReset() {
    timerStop();
    elapsed = 0;
    drawTimer();
    hintsUsed = 0;
    hintPts = 0;
    drawHints();
  }
