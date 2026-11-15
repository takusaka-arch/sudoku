  // ===== 06-hint-single-undo.js：ヒント（シングル・次に注目するマス）・候補の復活・1手戻す =====
  // （src/js/ の全ファイルで1つの (function () { … })(); になる。まとめ方は tools/build.py）
  // ヒント: 入れられる数字が1つだけのマス、または行・列・ブロックで1か所にしか入らない数字を、1つだけ薄い赤で示す
  // どちらも無ければ、2つの数字が同じ2マスにしか入らないペアを紫で示す
  // 入れられる = 問題の数字・確定候補で埋まっておらず、消しておらず、同じ行・列・ブロックにその数字が確定していない
  // 戻る: 操作の前の盤の状態を積んでおき、押すたびに1つ前に戻す（Ctrl+Z / ⌘Z でも可）
  const undoBtn = document.getElementById("undo");
  let undoStack = [];
  function snapshot() {
    return [...board.querySelectorAll(".cell")].map((c) => ({
      value: c.classList.contains("given") ? null : c.dataset.value || "",
      pick: [...c.querySelectorAll(".cand.pick")].map((x) => x.dataset.n).join(""),
      sure: c.querySelector(".cand.sure")?.dataset.n || "",
      off: [...c.querySelectorAll(".cand.off")].map((x) => x.dataset.n).join(""),
    }));
  }
  function restore(snap) {
    [...board.querySelectorAll(".cell")].forEach((c, i) => {
      const st = snap[i];
      c.querySelectorAll(".cand").forEach((x) => {
        x.classList.toggle("pick", st.pick.includes(x.dataset.n));
        x.classList.toggle("off", st.off.includes(x.dataset.n));
        x.classList.toggle("sure", st.sure === x.dataset.n);
        x.classList.remove("bad");
      });
      const big = c.querySelector(".big");
      if (st.value !== null) {
        c.classList.toggle("fixed", !!st.value);
        if (st.value) { c.dataset.value = st.value; big.textContent = st.value; }
        else delete c.dataset.value;
      }
      if (!c.classList.contains("fixed")) {
        c.classList.toggle("tent", !!st.sure);
        c.classList.remove("tent-bad");
        big.textContent = st.sure;
      }
    });
    markConflicts();
  }
  function clearUndo() {
    undoStack = [];
    undoBtn.disabled = true;
  }
  // 盤を変える操作を包み、変化があったときだけ前の状態を記録する
  const recorded = (fn) => function (...args) {
    const before = snapshot();
    const res = fn.apply(this, args);
    if (JSON.stringify(before) !== JSON.stringify(snapshot())) {
      undoStack.push(before);
      if (undoStack.length > 500) undoStack.shift();
      undoBtn.disabled = false;
    }
    return res;
  };
  // 盤を操作したら、出ている「自動で消した候補を戻しますか？」は「戻さない」として閉じる
  const act0 = act;
  act = recorded(function (...a) {
    if (autoPending) { autoConfirm.hidden = true; autoPending = null; }
    return act0.apply(this, a);
  });
  // 確定候補をやめたとき: 確定したときに自動で消した候補を戻すかどうかを聞く
  const autoConfirm = document.getElementById("auto-confirm");
  let autoPending = null;
  function askAutoRestore(cell, list, all) {
    autoPending = { cell, list, all };
    document.getElementById("auto-confirm-msg").textContent = `確定をやめた「${list[0].s.dataset.n}」について、自動で消した候補（${list.length}個）を戻しますか？`;
    autoConfirm.hidden = false;
  }
  document.getElementById("auto-no").addEventListener("click", () => { autoConfirm.hidden = true; autoPending = null; });
  // キャンセル: 確定をやめる操作そのものを取り消し、確定候補に戻す
  document.getElementById("auto-cancel").addEventListener("click", () => {
    autoConfirm.hidden = true;
    const p = autoPending;
    autoPending = null;
    if (!p || !undoStack.length) return;
    restore(undoStack.pop());
    undoBtn.disabled = undoStack.length === 0;
    p.cell._auto = p.all;
  });
  document.getElementById("auto-yes").addEventListener("click", recorded(() => {
    autoConfirm.hidden = true;
    const p = autoPending;
    autoPending = null;
    if (!p || board.dataset.mode !== "solve") return;
    for (const e of p.list) {
      const o = e.s.closest(".cell");
      // まだ消えていて、そのマスが確定していないものだけ、確定する前の状態（候補の青も含めて）に戻す
      if (!e.s.classList.contains("off") || o.dataset.value || o.classList.contains("tent")) continue;
      e.s.classList.remove("off");
      if (e.pick) e.s.classList.add("pick");
    }
    markConflicts();
  }));
  // 選んだマスで消した候補のうち、同じ行・列・ブロックに問題の数字・確定候補として入っていない数字を戻す
  const reviveCell = recorded(function (cell) {
    if (!cell || board.dataset.mode !== "solve" || cell.classList.contains("fixed") || cell.classList.contains("tent")) return;
    flushTap();
    const r = +cell.dataset.row, c = +cell.dataset.col;
    const used = new Set();
    board.querySelectorAll(".cell").forEach((o) => {
      if (o === cell) return;
      const orr = +o.dataset.row, oc = +o.dataset.col;
      if (orr !== r && oc !== c && !(Math.floor(orr / 3) === Math.floor(r / 3) && Math.floor(oc / 3) === Math.floor(c / 3))) return;
      const v = o.dataset.value || (o.classList.contains("tent") ? o.querySelector(".big").textContent : "");
      if (v) used.add(v);
    });
    const back = [...cell.querySelectorAll(".cand.off")].filter((x) => !used.has(x.dataset.n));
    back.forEach((x) => x.classList.remove("off"));
    markConflicts();
    renderPad();
    workMsg.classList.remove("err");
    workMsg.textContent = back.length ? `${r + 1}行${c + 1}列の消した候補 ${back.map((x) => x.dataset.n).join("・")} を復活しました。（「1手戻す」で元に戻せます）`
      : `${r + 1}行${c + 1}列には、復活できる候補はありません。`;
  });
  document.getElementById("pad-revive").addEventListener("click", () => reviveCell(sel));
  runTap = recorded(runTap);
  // 隠し機能: Ctrl+Shift+Alt+Delete（Backspace でも可）で、問題の数字と確定候補をすべてトリプルクリックしたのと同じ消し込みを一度に行う
  // （消すだけで、戻すことはしない。「戻る」1回で元に戻せる）
  const eliminateAll = recorded(() => {
    if (board.dataset.mode !== "solve") return;
    flushTap();
    const cells = [...board.querySelectorAll(".cell")];
    const big = (o) => o.classList.contains("fixed") || o.classList.contains("tent");
    const num = (o) => o.dataset.value || o.querySelector(".big").textContent;
    for (const a of cells.filter(big)) {
      const n = num(a), r = +a.dataset.row, c = +a.dataset.col;
      for (const o of cells) {
        if (o === a || big(o)) continue;
        if (+o.dataset.row !== r && +o.dataset.col !== c && (Math.floor(o.dataset.row / 3) !== Math.floor(r / 3) || Math.floor(o.dataset.col / 3) !== Math.floor(c / 3))) continue;
        const s = o.querySelector(`.cand[data-n="${n}"]`);
        s.classList.remove("pick", "bad");
        s.classList.add("off");
      }
    }
    markConflicts();
  });
  document.addEventListener("keydown", (e) => {
    if (!(e.ctrlKey && e.shiftKey && e.altKey && (e.key === "Delete" || e.key === "Backspace" || e.code === "Delete" || e.code === "Backspace"))) return;
    if (board.dataset.mode !== "solve") return;
    e.preventDefault();
    eliminateAll();
  });
  // 同じ隠し機能: タイトル横の「ver.」を5回続けて押す（スマホ・PC共通）
  let verTaps = 0, verTimer = null;
  document.querySelector("h1 .ver").addEventListener("click", () => {
    clearTimeout(verTimer);
    verTimer = setTimeout(() => { verTaps = 0; }, 700);
    if (++verTaps < 5) return;
    verTaps = 0;
    eliminateAll();
  });
  function undo() {
    if (!["register", "solve"].includes(board.dataset.mode) || !undoStack.length) return;
    flushTap();
    if (assume && undoStack.length <= assume.base) {
      assumeWarn("仮定より前には「1手戻す」で戻れません。「仮定前に戻る」を使ってください。", true);
      return;
    }
    restore(undoStack.pop());
    undoBtn.disabled = undoStack.length === 0;
  }
  undoBtn.addEventListener("click", undo);
