  // ===== 03-solve-modes.js：ヒントの回数とポイント・目標時間・正解を求める・答え合わせ・画面の状態（登録・回答・一時停止）の切り替え =====
  // （src/js/ の全ファイルで1つの (function () { … })(); になる。まとめ方は tools/build.py）
  // 使ったヒントの回数（ヒントを示せたときだけ数える）
  const hintsEl = document.getElementById("hints-used");
  let hintsUsed = 0, hintPts = 0;
  // ヒントのポイント = そのヒントのレベル（次に注目するマスは1）。「答えと理由」は、理由に使った解き方のレベルの2倍
  function hintLevel(label) {
    const k = hintKinds.find((x) => x.label === label);
    return (k && k.lv) || 0;
  }
  // 残りのマス数（問題の数字も確定候補も入っていないマス）
  const leftEl = document.getElementById("left-cells");
  // 目標完成時間 = 解き終わるまでの1手ごとに、使うヒントのレベルの秒数を足したもの
  // 1手ごとにヒントレベルの秒数を足す（ver.240-241）: レベル1 8秒・レベル2 1分30秒・レベル3 3分・レベル4 5分・レベル5 7分・レベル6（背理法） 10分
  const targetEl = document.getElementById("target-time");
  const TARGET_SEC = { 1: 8, 2: 90, 3: 180, 4: 300, 5: 420, 6: 600 };
  // 1手ずつのレベルの並びから、目標の秒数を出す。
  // 背理法（レベル6）は、仮定するマスを10分、その仮定に続けて決まるマス（すぐあとに続くレベル6の手）をレベル3と同じ時間にする。
  // 別のマスで仮定し直すとき（あいだに別の手が入ったとき）は、また10分から数える
  function targetSeconds(levels) {
    let sec = 0, prev = 0;
    for (const k of levels) {
      sec += k === 6 && prev === 6 ? TARGET_SEC[3] : (TARGET_SEC[k] || 0);
      prev = k;
    }
    return sec;
  }
  function drawTarget() {
    targetEl.hidden = true;
    const t = targetText();
    if (!t) return;
    targetEl.textContent = "目標：" + t;
    targetEl.hidden = false;
  }
  // 目標（標準回答）時間の文字列。求められないときは ""
  function targetText() {
    if (!solution) return "";
    const g = [...board.querySelectorAll(".cell")].sort((a, b) => (a.dataset.row * 9 + +a.dataset.col) - (b.dataset.row * 9 + +b.dataset.col)).map((c) => +((c.classList.contains("given") && c.dataset.value) || 0));
    try {
      if (!hintEngine) hintEngine = sudokuGen({ postMessage() {} });
      hintEngine.grade(g, null, solution.sol || true);
      const rec = hintEngine.grade.steps || [];
      let sec = targetSeconds(rec);
      if (!sec) return "";
      sec = sec < 600 ? Math.round(sec / 30) * 30 : Math.round(sec / 60) * 60;
      const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, ss = sec % 60;
      return h ? h + "時間" + (m ? m + "分" : "") : m + "分" + (ss ? ss + "秒" : "");
    } catch (e) { return ""; }
  }
  function drawLeft() {
    const n = [...board.querySelectorAll(".cell")].filter((c) => !c.dataset.value && !c.classList.contains("tent")).length;
    leftEl.textContent = `残り：${n}マス`;
  }
  // ヒントを使った回数を数える。進まないヒント（消せる候補がない）と、盤が同じまま同じヒントを続けて押したときは数えない
  let hintKindNow = "", lastHint = "";
  function countHint(progress = true, pts, key = "") {
    const sig = hintKindNow + key + "|" + [...board.querySelectorAll(".cell")].map((o) =>
      (o.dataset.value || (o.classList.contains("tent") ? o.querySelector(".big").textContent : "")) + [...o.querySelectorAll(".cand.off")].map((c) => c.dataset.n).join("")).join(",");
    if (!progress || sig === lastHint) return;
    lastHint = sig;
    hintsUsed++;
    hintPts += pts === undefined ? hintLevel(hintKindNow) : pts;
    drawHints();
  }
  function drawHints() {
    hintsEl.textContent = `使ったヒント：${hintsUsed}回・${hintPts}ポイント`;
  }

  // 登録済み（回答前）: 「回答スタート」を待つ
  let currentCount = 0;
  const go = document.getElementById("go");
  const pause = document.getElementById("pause");
  // 正解を求める（仮に入れて矛盾したら戻る、をくり返す）。答えが無いときは {n:0}、2つ以上あるときは {n:2, sol: 1つ目}
  let solution = null;
  const regCancel = document.getElementById("reg-cancel");
  function solveGivens(g) {
    const a = [...g].map(Number), row = new Array(9).fill(0), col = new Array(9).fill(0), box = new Array(9).fill(0);
    const bx = (i) => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3);
    for (let i = 0; i < 81; i++) if (a[i]) {
      const b = 1 << a[i], r = Math.floor(i / 9), c = i % 9;
      if ((row[r] | col[c] | box[bx(i)]) & b) return { n: 0 };
      row[r] |= b; col[c] |= b; box[bx(i)] |= b;
    }
    let n = 0, first = null;
    (function rec() {
      if (n > 1) return;
      let best = -1, bm = 0, bc = 10;
      for (let i = 0; i < 81; i++) if (!a[i]) {
        const m = 0x3fe & ~(row[Math.floor(i / 9)] | col[i % 9] | box[bx(i)]);
        let k = 0; for (let x = m; x; x &= x - 1) k++;
        if (k < bc) { bc = k; best = i; bm = m; if (k <= 1) break; }
      }
      if (best < 0) { n++; if (!first) first = a.join(""); return; }
      const r = Math.floor(best / 9), c = best % 9, q = bx(best);
      for (let d = 1; d <= 9; d++) if (bm & (1 << d)) {
        const b = 1 << d;
        a[best] = d; row[r] |= b; col[c] |= b; box[q] |= b;
        rec();
        a[best] = 0; row[r] &= ~b; col[c] &= ~b; box[q] &= ~b;
        if (n > 1) return;
      }
    })();
    return { n, sol: first };
  }
  // 検証: 確定候補を正解と比べ、違うマスを赤い背景で示す（盤を変えると消える）
  document.getElementById("check").addEventListener("click", () => {
    if (board.dataset.mode !== "solve") return;
    board.querySelectorAll(".cell.check-wrong").forEach((c) => c.classList.remove("check-wrong"));
    if (!solution || !solution.n) { workMsg.textContent = "この問題には答えがありません。問題の数字を確認してください。"; return; }
    let total = 0, wrong = 0;
    board.querySelectorAll(".cell.tent").forEach((c) => {
      const v = c.querySelector(".big").textContent;
      if (!v) return;
      total++;
      if (solution.sol[c.dataset.row * 9 + +c.dataset.col] !== v) { wrong++; c.classList.add("check-wrong"); }
    });
    const multi = solution.n > 1 ? "（この問題は答えが1つに決まらないため、答えの1つと比べています）" : "";
    workMsg.textContent = !total ? "答え合わせ：まだ確定したマスがありません。" + multi
      : wrong ? `答え合わせ：確定した${total}マスのうち、${wrong}マスが正解と違います（赤いマス）。` + multi
      : `答え合わせ：確定した${total}マスは、すべて正解です。` + multi;
  });
  function showReady(count) {
    sameNum = ""; applySame();
    setPauseLock(false);
    // 問題を登録した（開いた）時点で、裏で正解を計算して持っておく（検証ボタンで使う）
    board.removeAttribute("data-view-answer");
    document.getElementById("ans-confirm").hidden = true;
    document.getElementById("auto-confirm").hidden = true;
    document.getElementById("hint-gate").hidden = true;
    solution = solveGivens([...board.querySelectorAll(".cell")].sort((a, b) => (a.dataset.row * 9 + +a.dataset.col) - (b.dataset.row * 9 + +b.dataset.col)).map((c) => (c.classList.contains("given") && c.dataset.value) || "0").join(""));
    document.getElementById("trial").hidden = true;
    clearUndo();
    undoBtn.hidden = true;
    currentCount = count;
    board.dataset.mode = "ready";
    timerReset();
    timerEl.hidden = false;
    hintsEl.hidden = false;
    leftEl.hidden = false;
    drawLeft();
    drawTarget();
    prompt.textContent = `問題を登録しました：${currentName}（問題 ${count} マス）`;
    nameField.hidden = true;
    note.textContent = "「回答スタート」を押すと回答モードになり、タイマーが動き始めます。";
    done.hidden = true;
    regCancel.hidden = true;
    go.hidden = false;
    pause.hidden = true;
    edit.hidden = true;
    reset.hidden = true;
    replayBtn.hidden = true;
    saveSolvedBtn.hidden = true; document.getElementById("share-solved").hidden = true;
    stopReplay();
    exportCur.hidden = false;
    saveProgress.hidden = true;
    snapOpen.hidden = true;
    closeSnapUI();
    hintBtn.hidden = true;
    document.getElementById("check").hidden = true;
    document.getElementById("hint-menu").hidden = true;
    viewBtn.hidden = true;
    document.getElementById("view-menu").hidden = true;
    workMsg.textContent = "";
    confirmBox.hidden = true;
    updatePhoto();
  }
  // 回答中の説明文（操作の名前に下線を引き、説明と見分けやすくする）。
  // 端末・画面の向き（スマホ／折りたたみ／パソコン）で中身が変わるので、向きが変わったときにも作り直す
  function solveNoteHtml() {
    const [t1, t2, t3] = matchMedia("(hover: hover) and (pointer: fine)").matches ? ["1回クリック", "ダブルクリック", "トリプルクリック"] : ["1回タップ", "ダブルタップ", "トリプルタップ"];
    return (isPhone() ? "<u>盤のマスを1回タップ</u>：そのマスを選んで操作できるようにする。" + (isFold() ? "右上" : "盤の下") + "に、マスの中の操作メニューが出る<br>" : "") + `<u>小さな数字を ${t1}</u>：候補（青）の選択・解除<br><u>${t2}</u>：確定候補にする（大きな数字を${t2}で戻す）<br><u>${t3}</u>：その数字が確定している行・列・ブロックの中の同じ数字を消す・戻す<br><u>問題の数字・確定候補を${t1}</u>：同じ数字の問題の数字・確定候補に色を付ける・消す<br><u>問題の数字・確定候補を${t3}</u>：その行・列・ブロックの同じ数字を消す・戻す<br><u>${t1 === "1回クリック" ? "右クリック" : "長押し"}</u>：メニューから選ぶ` + (board.hasAttribute("data-style-write") ? (t1 === "1回クリック" ? "<br><u>書き込み方式</u>：空白のマスにマウスを乗せると、選べる数字が薄く出ます" : "<br><u>書き込み方式</u>：空白のマスをタップして、下の数字から選びます") : "");
  }
  function refreshSolveNote() { if (board.dataset.mode === "solve") note.innerHTML = solveNoteHtml(); }
  function showSolve() {
    board.dataset.mode = "solve";
    setPauseLock(false);
    prompt.textContent = `回答モード：${currentName}（問題 ${currentCount} マス）`;
    note.innerHTML = solveNoteHtml();
    go.hidden = true;
    pause.hidden = false;
    pause.textContent = "一時停止";
    reset.hidden = false;
    replayBtn.hidden = false;
    saveSolvedBtn.hidden = true; document.getElementById("share-solved").hidden = true;
    stopReplay();
    // 解いている途中でも、問題を書き出したりLINEなどで送ったりできるようにする
    exportCur.hidden = false;
    saveProgress.hidden = false;
    snapOpen.hidden = false;
    hintBtn.hidden = false;
    document.getElementById("check").hidden = false;
    viewBtn.hidden = false;
    undoBtn.hidden = false;
    timerStart();
    markConflicts();
  }
  go.addEventListener("click", showSolve);
  // 一時停止中の表示。「再開」の説明は一時停止中の表示のすぐ下に小さく出す
  // 一時停止中は、盤を見たり動かしたりするボタン（戻る・ヒント・検証・表示方法変更・再生）を押せなくする。
  // 保存・リセット・問題一覧へは一時停止中でも使える
  // 仮定モード（1段階だけ）: { snap: 仮定前の盤, undoLen: 仮定前の「戻る」の数, base: 仮定した直後の「戻る」の数, i, r, c, n }
  let assume = null;
  function setPauseLock(on) {
    for (const id of ["hint", "check", "view", "replay"]) document.getElementById(id).disabled = on;
    document.getElementById("undo").disabled = on || undoStack.length === 0;
    if (!on && assume) assumeLock(true);
  }
  // 仮定中は、盤を確かめたり保存したりするボタンを押せなくする（タイマーは動いたまま）
  const ASSUME_LOCK = ["hint", "check", "view", "replay", "pause", "save-progress", "snap-open", "edit", "export-cur", "reset", "back"];
  function assumeLock(on) {
    for (const id of ASSUME_LOCK) document.getElementById(id).disabled = on;
  }
  function setPausedPrompt(extra) {
    prompt.textContent = `一時停止中：${currentName}${extra}`;
    const sub = document.createElement("span");
    sub.className = "prompt-sub";
    sub.textContent = "「再開」を押すと回答を続けられます。";
    prompt.appendChild(sub);
  }
  // 一時停止中はタイマーを止め、盤を薄くして操作できなくする
  pause.addEventListener("click", () => {
    if (board.dataset.mode === "solve") {
      board.dataset.mode = "paused";
      timerStop();
      pause.textContent = "再開";
      renderPad();
      setPausedPrompt("");
      setPauseLock(true);
      note.textContent = "";
      confirmBox.hidden = true;
      autoSave();
    } else {
      showSolve();
    }
  });

  // リセット: 問題は残し、回答（候補・確定候補）をすべて消す
  const reset = document.getElementById("reset");
  const confirmBox = document.getElementById("confirm");
  reset.addEventListener("click", () => {
    confirmBox.hidden = false;
    document.getElementById("reset-no").focus();
  });
  document.getElementById("reset-no").addEventListener("click", () => {
    confirmBox.hidden = true;
    reset.focus();
  });
  document.getElementById("reset-yes").addEventListener("click", () => {
    confirmBox.hidden = true;
    showReady(currentCount);
    board.querySelectorAll(".cand").forEach((s) => s.classList.remove("pick", "sure", "bad", "shadow", "off", "hint", "pair"));
    board.querySelectorAll(".cell").forEach((c) => {
      c.classList.remove("tent", "tent-bad", "tent-off");
      if (!c.classList.contains("fixed")) c.querySelector(".big").textContent = "";
    });
    markConflicts();
  });

  // 問題修正: 問題作成モードに戻す（選んだ候補はそのまま残す）
  const edit = document.getElementById("edit");
  edit.addEventListener("click", () => {
    timerReset();
    timerEl.hidden = true;
    hintsEl.hidden = true;
    leftEl.hidden = true;
    targetEl.hidden = true;
    go.hidden = true;
    pause.hidden = true;
    board.querySelectorAll(".cell.given").forEach((c) => {
      c.classList.remove("given");
      c.querySelector(".big").tabIndex = 0;
    });
    // 確定候補の大きな表示は問題作成中は隠し、回答モードに戻ったら復元する
    board.querySelectorAll(".cell.tent").forEach((c) => c.classList.replace("tent", "tent-off"));
    board.dataset.mode = "register";
    markConflicts();
    showRegister();
  });
  // 作るページの「保存した問題を修正する」: 一覧から選ぶと、その問題を作成モードで開く（同じ名前で登録すると上書き）
  const editBox = document.getElementById("edit-box"), editSaved = document.getElementById("edit-saved");
  function renderEditList() {
    const list = loadAll().sort((a, b) => (b.saved || "").localeCompare(a.saved || ""));
    const ul = document.getElementById("edit-list");
    ul.innerHTML = "";
    document.getElementById("edit-empty").hidden = list.length > 0;
    for (const p of list) {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "open has-mini";
      if (/^[0-9]{81}$/.test(p.givens || "")) b.appendChild(miniBoard(p.givens));
      const txt = document.createElement("span");
      txt.className = "open-text";
      txt.textContent = p.name;
      const meta = document.createElement("small");
      meta.textContent = `問題 ${p.givens.replace(/0/g, "").length} マス`;
      txt.appendChild(meta);
      b.appendChild(txt);
      b.addEventListener("click", () => { openProblem(p); edit.click(); });
      li.appendChild(b);
      ul.appendChild(li);
    }
  }
  editSaved.addEventListener("click", () => {
    const open = editBox.hidden;
    if (open) renderEditList();
    editBox.hidden = !open;
    editSaved.setAttribute("aria-expanded", String(open));
  });

