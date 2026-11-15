// ===== 01-board.js：盤を作る・数字の表示・同じ数字の色付け・重複（赤）の確認・盤を空にする・問題作成／回答モードの基本 =====
// （src/js/ の全ファイルで1つの (function () { … })(); になる。まとめ方は tools/build.py）
(function () {
  const board = document.getElementById("board");
  // 小マスの表示順（行ごと）: 1 2 3 / 4 5 6 / 7 8 9
  const order = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let b = 0; b < 9; b++) {
    const box = document.createElement("div");
    box.className = "box";
    for (let c = 0; c < 9; c++) {
      const row = Math.floor(b / 3) * 3 + Math.floor(c / 3);
      const col = (b % 3) * 3 + (c % 3);
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = row;
      cell.dataset.col = col;
      cell.setAttribute("role", "gridcell");
      for (const n of order) {
        const s = document.createElement("span");
        s.className = "cand";
        s.dataset.n = n;
        s.textContent = n;
        s.tabIndex = 0;
        cell.appendChild(s);
      }
      const big = document.createElement("span");
      big.className = "big";
      big.tabIndex = 0;
      cell.appendChild(big);
      box.appendChild(cell);
    }
    board.appendChild(box);
  }

  // 盤の下で選んだ数字を、候補として残っているマスで点滅させる
  // （消しておらず、同じ行・列・ブロックに問題の数字や確定候補として同じ数字が無いマス）
  // 問題の数字・確定候補を1回押すと、同じ数字の問題の数字・確定候補に色を付ける（もう一度押すと消す）
  let sameNum = "";
  function applySame() {
    board.querySelectorAll(".cell.same-num").forEach((x) => x.classList.remove("same-num"));
    if (!sameNum) return;
    board.querySelectorAll(".cell").forEach((o) => {
      if ((o.dataset.value || (o.classList.contains("tent") ? o.querySelector(".big").textContent : "")) === sameNum) o.classList.add("same-num");
    });
  }
  function applyHighlight() {
    applySame();
    const HLC = ["hlc0", "hlc1", "hlc2", "hlc3"];
    board.querySelectorAll(".cand.hl-on").forEach((x) => x.classList.remove("hl-on", ...HLC));
    board.querySelectorAll(".cell.hl-big").forEach((x) => x.classList.remove("hl-big", ...HLC));
    // 盤に9つそろった数字は、ハイライトのボタンを押せなくする（ハイライト中なら止める。他の数字の色はそのまま）
    {
      const cnt = {};
      board.querySelectorAll(".cell").forEach((o) => {
        const v = o.dataset.value || (o.classList.contains("tent") ? o.querySelector(".big").textContent : "");
        if (v) cnt[v] = (cnt[v] || 0) + 1;
      });
      const slots = (board.dataset.hl || "").split(",");
      let changed = false;
      document.querySelectorAll("#num-hl .nh-keys button").forEach((b) => {
        const full = (cnt[b.textContent] || 0) >= 9;
        b.disabled = full;
        b.classList.toggle("nh-done", full);
        const k = slots.indexOf(b.textContent);
        if (full && k >= 0) {
          slots[k] = ""; changed = true;
          b.setAttribute("aria-pressed", "false");
          b.classList.remove(...HLC);
        }
      });
      if (changed) {
        if (slots.some(Boolean)) board.dataset.hl = slots.join(",");
        else delete board.dataset.hl;
      }
    }
    const list = (board.dataset.hl || "").split(",");
    if (!list.some(Boolean) || board.dataset.mode !== "solve") return;
    const cells = [...board.querySelectorAll(".cell")];
    const val = (o) => o.dataset.value || (o.classList.contains("tent") ? o.querySelector(".big").textContent : "");
    // 選んだ順に色を変える（1つ目は黄、2つ目は青、3つ目は緑、4つ目はピンク）
    list.forEach((n, k) => {
      if (!n) return;
      const has = cells.filter((o) => val(o) === n);
      has.forEach((o) => o.classList.add("hl-big", HLC[k]));
      for (const o of cells) {
        if (val(o)) continue;
        if (has.some((x) => x.dataset.row === o.dataset.row || x.dataset.col === o.dataset.col
          || (Math.floor(x.dataset.row / 3) === Math.floor(o.dataset.row / 3) && Math.floor(x.dataset.col / 3) === Math.floor(o.dataset.col / 3)))) continue;
        const c = o.querySelector(`.cand[data-n="${n}"]`);
        if (!c.classList.contains("off")) c.classList.add("hl-on", HLC[k]);
      }
    });
  }
  // 確定候補にした順番（戻したり消したりしたマスは記録から外し、もう一度確定したときの順番にする）
  let sureOrder = new Array(81).fill(null), sureSeq = 0;
  function trackSure() {
    board.querySelectorAll(".cell").forEach((c) => {
      const i = c.dataset.row * 9 + +c.dataset.col;
      const d = c.querySelector(".cand.sure")?.dataset.n || "";
      if (!d) sureOrder[i] = null;
      else if (!sureOrder[i] || sureOrder[i].d !== d) sureOrder[i] = { d, seq: ++sureSeq };
    });
  }
  // ヒントの色とメッセージを消す（「ヒントを消す」ボタンからも呼ぶ）
  function clearHints() {
    const msg = document.getElementById("work-msg");
    if (msg.textContent.startsWith("ヒント")) msg.textContent = "";
    board.querySelectorAll(".cand.hint, .cand.pair, .cell.hint-cell, .cell.pair-cell, .cell.two-cell").forEach((s) => s.classList.remove("hint", "pair", "hint-cell", "pair-cell", "two-cell"));
    board.querySelectorAll(".cand.pgrp").forEach((s) => { s.classList.remove("pgrp", "pgrp2"); s.style.removeProperty("--pg"); s.style.removeProperty("--pg2"); });
    board.querySelectorAll(".cell[data-chain-no]").forEach((s) => { delete s.dataset.chainNo; });
    if (typeof renderPad === "function") renderPad();
  }
  // 同じ行・列・3x3ブロックに同じ数字があるマスを赤くする
  // 正解の表示：確定していないマスに正解の数字を置き、違う確定候補に赤い背景を付ける
  function drawAnswer() {
    if (!board.hasAttribute("data-view-answer") || !solution || !solution.sol) return;
    board.querySelectorAll(".cell").forEach((c) => {
      const d = solution.sol[c.dataset.row * 9 + +c.dataset.col];
      let a = c.querySelector(".ans");
      if (!a) { a = document.createElement("span"); a.className = "ans"; a.setAttribute("aria-hidden", "true"); c.appendChild(a); }
      a.textContent = d;
      if (c.classList.contains("tent") && c.querySelector(".big").textContent !== d) c.classList.add("check-wrong");
    });
  }
  function markConflicts() {
    board.querySelectorAll(".cell.check-wrong").forEach((c) => c.classList.remove("check-wrong"));
    if (board.hasAttribute("data-view-answer")) drawAnswer();
    if (typeof autoSave === "function") setTimeout(autoSave, 0);
    if (typeof markAssume === "function") setTimeout(markAssume, 0);
    // 盤が変わったらヒントの表示を消す
    clearHints();
    if (typeof drawLeft === "function") drawLeft();
    const cells = [...board.querySelectorAll(".cell")];
    const fixed = cells.filter((c) => c.dataset.value);
    cells.forEach((c) => c.classList.remove("conflict"));
    for (const a of fixed) {
      const ar = +a.dataset.row, ac = +a.dataset.col;
      for (const b of fixed) {
        if (a === b || a.dataset.value !== b.dataset.value) continue;
        const br = +b.dataset.row, bc = +b.dataset.col;
        const sameBox = Math.floor(ar / 3) === Math.floor(br / 3) && Math.floor(ac / 3) === Math.floor(bc / 3);
        if (ar === br || ac === bc || sameBox) { a.classList.add("conflict"); break; }
      }
    }
    // 候補に選んだ数字が同じ行・列・ブロックで確定済みなら赤くする
    board.querySelectorAll(".cand.pick").forEach((s) => {
      const cell = s.closest(".cell");
      const r = +cell.dataset.row, c = +cell.dataset.col;
      const bad = fixed.some((f) => {
        if (f === cell || f.dataset.value !== s.dataset.n) return false;
        const fr = +f.dataset.row, fc = +f.dataset.col;
        return fr === r || fc === c || (Math.floor(fr / 3) === Math.floor(r / 3) && Math.floor(fc / 3) === Math.floor(c / 3));
      });
      s.classList.toggle("bad", bad);
      if (s.classList.contains("sure")) cell.classList.toggle("tent-bad", bad);
    });
    // 確定候補と同じ数字が同じ行・列・ブロックの候補にあれば茶色にする
    const tents = !["register", "start"].includes(board.dataset.mode) ? cells.filter((c) => c.classList.contains("tent")) : [];
    board.querySelectorAll(".cand").forEach((s) => {
      const cell = s.closest(".cell");
      const r = +cell.dataset.row, c = +cell.dataset.col;
      const hit = tents.some((t) => {
        if (t === cell || t.querySelector(".big").textContent !== s.dataset.n) return false;
        const tr = +t.dataset.row, tc = +t.dataset.col;
        return tr === r || tc === c || (Math.floor(tr / 3) === Math.floor(r / 3) && Math.floor(tc / 3) === Math.floor(c / 3));
      });
      s.classList.toggle("shadow", hit);
    });
    // 確定候補どうしが同じ行・列・ブロックで重なっていたら両方赤くする
    for (const a of tents) {
      const ar = +a.dataset.row, ac = +a.dataset.col, av = a.querySelector(".big").textContent;
      const dup = tents.some((b) => {
        if (a === b || b.querySelector(".big").textContent !== av) return false;
        const br = +b.dataset.row, bc = +b.dataset.col;
        return ar === br || ac === bc || (Math.floor(ar / 3) === Math.floor(br / 3) && Math.floor(ac / 3) === Math.floor(bc / 3));
      });
      if (dup) a.classList.add("tent-bad");
    }
    trackSure();
    if (typeof renderPad === "function") renderPad();
    if (typeof checkComplete === "function") checkComplete();
    applyHighlight();
  }

  // 保存した問題（このブラウザに保存）: [{name, givens: 81文字(0=空き), saved}]
  const KEY = "sudoku-problems";
  function loadAll() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function saveAll(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
  }
  const cellAt = (r, c) => board.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);

  // 盤面を空にする
  function clearBoard() {
    if (typeof clearUndo === "function") clearUndo();
    if (typeof selectCell === "function") selectCell(null);
    board.querySelectorAll(".cand").forEach((s) => s.classList.remove("pick", "sure", "bad", "shadow", "off", "hint", "pair"));
    board.querySelectorAll(".cell").forEach((c) => {
      c.className = "cell";
      delete c.dataset.value;
      const big = c.querySelector(".big");
      big.textContent = "";
      big.tabIndex = 0;
    });
  }

  // 問題作成モード: 小さな数字で確定（大きく表示）、大きな数字で元に戻す
  // 回答モード: 小さな数字をそのマスの候補として選ぶ（青字）、もう一度クリックで解除
  function act(target, fromPad) {
    const cell = target.closest(".cell");
    if (!cell || !["register", "solve"].includes(board.dataset.mode)) return;
    if (board.dataset.mode === "solve") {
      // 確定候補はシングルクリックでは変えない（ダブルクリックで戻す）
      if (target.classList.contains("cand") && !target.classList.contains("sure")) {
        target.classList.toggle("pick");
        target.classList.remove("bad");
        markConflicts();
      }
      return;
    }
    cell.classList.remove("ocr-unsure");
    if (target.classList.contains("cand")) {
      cell.querySelector(".big").textContent = target.dataset.n;
      cell.dataset.value = target.dataset.n;
      cell.classList.add("fixed");
      if (!fromPad) cell.querySelector(".big").focus();
    } else if (target.classList.contains("big")) {
      cell.classList.remove("fixed");
      delete cell.dataset.value;
    }
    markConflicts();
  }
