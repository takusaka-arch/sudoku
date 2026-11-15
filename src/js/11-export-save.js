  // ===== 11-export-save.js：問題の書き出し・この状態を保存・ファイルに保存・自動保存・回答中のファイルを開く =====
  // （src/js/ の全ファイルで1つの (function () { … })(); になる。まとめ方は tools/build.py）
  // 問題を書き出す: 問題ファイル（.json）か、81桁の盤面データ（コピー用）を選ぶ
  const expBox = document.getElementById("exp-box"), expOut = document.getElementById("exp-out"), expText = document.getElementById("exp-text"), expMsg = document.getElementById("exp-msg");
  const expGivens = () => { let g = ""; for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) g += cellAt(r, c).dataset.value || "0"; return g; };
  const closeExp = () => { expBox.hidden = true; exportCur.focus({ preventScroll: true }); };
  exportCur.addEventListener("click", () => {
    document.getElementById("exp-choice").hidden = false;
    document.getElementById("exp-title").textContent = "どの形で書き出しますか？";
    expOut.hidden = true;
    expBox.hidden = false;
    document.getElementById("exp-file").focus({ preventScroll: true });
  });
  document.getElementById("exp-cancel").addEventListener("click", closeExp);
  expBox.addEventListener("click", (e) => { if (e.target === expBox) closeExp(); });
  expBox.addEventListener("keydown", (e) => { if (e.key === "Escape") closeExp(); });
  document.getElementById("exp-file").addEventListener("click", async () => {
    expBox.hidden = true;
    msgTarget = workMsg;
    try { await exportProblem({ name: currentName, givens: expGivens() }); } finally { msgTarget = null; }
  });
  document.getElementById("exp-digits").addEventListener("click", () => {
    document.getElementById("exp-choice").hidden = true;
    document.getElementById("exp-title").textContent = "81桁の盤面データ";
    expText.value = expGivens();
    expMsg.textContent = "「コピーする」を押すか、文字を選んでコピーしてください。";
    expOut.hidden = false;
    expText.focus({ preventScroll: true });
    expText.select();
  });
  document.getElementById("exp-copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(expText.value); expMsg.textContent = "コピーしました。"; }
    catch (e) { expText.focus(); expText.select(); try { document.execCommand("copy"); expMsg.textContent = "コピーしました。"; } catch (e2) { expMsg.textContent = "コピーできませんでした。文字を選んでコピーしてください。"; } }
  });
  const safeName = (s) => s.replace(/[\\/:*?"<>|]/g, "_");
  function exportProblem(p) {
    const data = JSON.stringify({ app: "sudoku-board", version: 1, name: p.name, givens: p.givens }, null, 2);
    return saveFile(`数独_${safeName(p.name)}.json`, data, `「${p.name}」をファイルに書き出しました`);
  }
  // 保存先を選ぶ画面（設定が「保存のたびに選ぶ」のとき）。ボタンを押した流れの中で保存する
  const destBox = document.getElementById("dest-box");
  let destPick = null;
  for (const [id, v] of [["dest-drive", "drive"], ["dest-local", "local"], ["dest-cancel", null]]) {
    document.getElementById(id).addEventListener("click", () => {
      destBox.hidden = true;
      const f = destPick; destPick = null;
      if (f) f(v);
    });
  }
  function saveFile(filename, data, okText) {
    const m = gd.mode();
    if (m === "drive") return gd.saveFile(filename, data, okText);
    if (m === "ask") {
      return new Promise((done) => {
        destPick = (v) => {
          if (v === "drive") done(gd.saveFile(filename, data, okText));
          else if (v === "local") done(saveLocal(filename, data, okText));
          else { say(""); done(); }
        };
        destBox.hidden = false;
        document.getElementById("dest-drive").focus();
      });
    }
    return saveLocal(filename, data, okText);
  }
  async function saveLocal(filename, data, okText) {
    // claude.ai 上では保存の確認を出して保存、単体のファイルでは普通にダウンロード
    const dl = await window.claude?.use?.("downloads").catch(() => null);
    if (dl) {
      try {
        await dl.save({ filename, data });
        say(okText);
      } catch (e) {
        if (e && e.code === "cancelled") say("");
        else say("書き出せませんでした。もう一度試してください", true);
      }
      return;
    }
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    say(okText);
  }

  // この状態を保存: 名前（最初は保存する日時「27日18時47分」、自由に書き足し・変更できる）を付けてこの端末に保存し、あとで「保存した状態に戻す」でその時点に戻れる
  // 「ファイルに保存」を選ぶと、今までどおり問題・候補・確定候補・経過時間をファイル（またはGoogleドライブ）に保存する
  const SNAP_KEY = "sudoku-snapshots";
  const saveProgress = document.getElementById("save-progress");
  const snapOpen = document.getElementById("snap-open");
  const snapMenu = document.getElementById("snap-menu");
  const saveBox = document.getElementById("save-box");
  const snapName = document.getElementById("snap-name");
  const curGivens = () => [...board.querySelectorAll(".cell")].map((c) => (c.classList.contains("given") && c.dataset.value) || "0").join("");
  function loadSnaps() {
    try { return JSON.parse(localStorage.getItem(SNAP_KEY)) || {}; } catch { return {}; }
  }
  function snapsFor() { return loadSnaps()[curGivens()] || []; }
  function storeSnaps(list) {
    const all = loadSnaps();
    if (list.length) all[curGivens()] = list.slice(-30); else delete all[curGivens()];
    try { localStorage.setItem(SNAP_KEY, JSON.stringify(all)); return true; } catch { return false; }
  }
  function closeSnapUI() {
    saveBox.hidden = true;
    snapMenu.hidden = true;
    snapOpen.setAttribute("aria-expanded", "false");
  }
  saveProgress.addEventListener("click", () => {
    if (!saveBox.hidden) return closeSnapUI();
    closeSnapUI();
    snapName.value = snapName.dataset.stamp = stamp(new Date());
    // 「ファイルに保存」の名前と説明は、設定の保存先に合わせる
    const m = gd.mode(), fileBtn = document.getElementById("snap-file");
    fileBtn.textContent = m === "drive" ? "Googleドライブに保存" : "ファイルに保存";
    document.getElementById("snap-help").textContent = "「アプリ内に保存」は、このアプリの中に残し、あとで「保存した状態に戻す」でその時点に戻れます。「"
      + fileBtn.textContent + "」は、" + (m === "drive" ? "Googleドライブの「Sudoku」フォルダに残し、" : m === "ask" ? "保存先を選んで残し、" : "ファイルとして残し、") + "別の日や別の端末で続きを解くときに使います。";
    saveBox.hidden = false;
    saveBox.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // 書き足しやすいよう、カーソルは末尾に置く
    snapName.focus();
    snapName.setSelectionRange(snapName.value.length, snapName.value.length);
  });
  document.getElementById("snap-cancel").addEventListener("click", closeSnapUI);
  function saveSnap() {
    const base = snapName.value.trim() || snapName.dataset.stamp;
    // 同じ名前があれば「(2)」のように番号を付けて、前の保存を残す
    const list = snapsFor();
    let name = base, k = 2;
    while (list.some((x) => x.name === name)) name = `${base} (${k++})`;
    list.push({ name, at: Date.now(), snap: snapshot(), elapsed: elapsed + (startedAt ? Date.now() - startedAt : 0) });
    closeSnapUI();
    workMsg.classList.remove("err");
    if (!storeSnaps(list)) { workMsg.classList.add("err"); workMsg.textContent = "保存できませんでした。ブラウザの保存領域がいっぱいかもしれません。"; return; }
    workMsg.textContent = `「${name}」として保存しました。「保存した状態に戻す」で、いつでもこの時点に戻れます。`;
  }
  document.getElementById("snap-save").addEventListener("click", saveSnap);
  snapName.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); saveSnap(); }
    if (e.key === "Escape") closeSnapUI();
  });
  const two = (n) => String(n).padStart(2, "0");
  const stamp = (d) => `${d.getDate()}日${two(d.getHours())}時${two(d.getMinutes())}分`;
  function drawSnapMenu() {
    snapMenu.textContent = "";
    const list = snapsFor();
    if (!list.length) {
      const p = document.createElement("p");
      p.className = "snap-empty";
      p.textContent = "保存した状態はまだありません。「この状態を保存」で保存できます。";
      snapMenu.appendChild(p);
      return;
    }
    list.slice().reverse().forEach((x) => {
      const row = document.createElement("div");
      row.className = "snap-item";
      const go = document.createElement("button");
      go.type = "button";
      go.className = "snap-go";
      go.setAttribute("role", "menuitem");
      const d = new Date(x.at);
      go.innerHTML = `<span class="hm-check">↺</span><span class="hm-label"></span><span class="hm-desc"></span>`;
      go.querySelector(".hm-label").textContent = x.name;
      go.querySelector(".hm-desc").textContent = `${d.getMonth() + 1}/${d.getDate()} ${two(d.getHours())}:${two(d.getMinutes())} に保存`;
      go.addEventListener("click", () => {
        closeSnapUI();
        flushTap();
        // 戻す前の状態は「戻る」で取り戻せるようにしておく
        undoStack.push(snapshot());
        undoBtn.disabled = false;
        restore(x.snap);
        // 設定が「保存した時点の時間に戻す」のときだけ、タイマーを保存した時点に戻す（動いていれば動いたまま）
        if (snapTimerBack() && x.elapsed != null) {
          elapsed = Math.max(0, Number(x.elapsed) || 0);
          if (startedAt) startedAt = Date.now();
          drawTimer();
        }
        workMsg.classList.remove("err");
        workMsg.textContent = `「${x.name}」の時点に戻しました。（「1手戻す」で戻す前に戻れます）`;
      });
      const del = document.createElement("button");
      del.type = "button";
      del.className = "snap-del";
      del.textContent = "削除";
      del.setAttribute("aria-label", `${x.name} を削除`);
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        if (del.dataset.armed) {
          storeSnaps(snapsFor().filter((y) => !(y.name === x.name && y.at === x.at)));
          drawSnapMenu();
        } else {
          del.dataset.armed = "1";
          del.textContent = "本当に削除";
        }
      });
      row.append(go, del);
      snapMenu.appendChild(row);
    });
  }
  snapOpen.addEventListener("click", () => {
    if (!snapMenu.hidden) return closeSnapUI();
    closeSnapUI();
    closeHintMenu();
    closeViewMenu();
    drawSnapMenu();
    snapMenu.hidden = false;
    snapOpen.setAttribute("aria-expanded", "true");
    snapMenu.querySelector("button")?.focus({ preventScroll: true });
    snapMenu.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
  document.addEventListener("click", (e) => {
    if (!snapMenu.hidden && !snapMenu.contains(e.target) && !snapOpen.contains(e.target)) closeSnapUI();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !snapMenu.hidden) { closeSnapUI(); snapOpen.focus(); }
  });
  // 回答途中の状態（問題・候補・確定候補・経過時間）
  function progressObj() {
    let givens = "", sure = "";
    const picks = [], offs = [];
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      const cell = cellAt(r, c);
      givens += cell.dataset.value || "0";
      picks.push([...cell.querySelectorAll(".cand.pick")].map((s) => s.dataset.n).sort().join(""));
      sure += cell.querySelector(".cand.sure")?.dataset.n || "0";
      offs.push([...cell.querySelectorAll(".cand.off")].map((s) => s.dataset.n).sort().join(""));
    }
    const ms = elapsed + (startedAt ? Date.now() - startedAt : 0);
    return { app: "sudoku-board", kind: "progress", version: 1, name: currentName, givens, picks, sure, off: offs, elapsed: ms, hints: hintsUsed, hintPts, order: sureOrder.map((o) => (o ? o.seq : 0)), saved: new Date().toISOString() };
  }
  // 解いている途中は端末に自動保存し、画面ロックやアプリの終了のあとも続きから再開できるようにする
  const CUR_KEY = "sudoku-current";
  let restoring = false;
  function autoSave() {
    if (restoring || !["solve", "paused"].includes(board.dataset.mode) || !document.getElementById("trial").hidden) return;
    try {
      const o = progressObj();
      // 仮定中は、仮定前の盤を保存する
      if (assume) {
        o.picks = assume.snap.map((s) => s.pick); o.sure = assume.snap.map((s) => s.sure || "0").join(""); o.off = assume.snap.map((s) => s.off);
        // 解いた順番も、仮定のあとに確定したマスを除く（再生に仮定中の手が混ざらないように）
        o.order = o.order.map((q, i) => (assume.snap[i].sure ? q : 0));
      }
      localStorage.setItem(CUR_KEY, JSON.stringify(o));
    } catch (e) {}
  }
  function clearAutoSave() {
    try { localStorage.removeItem(CUR_KEY); } catch (e) {}
  }
  // 画面を離れたら（ロック・アプリ切り替え）一時停止して保存する
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    if (board.dataset.mode === "solve") pause.click();
    autoSave();
  });
  addEventListener("pagehide", autoSave);
  // ファイルに保存
  document.getElementById("snap-file").addEventListener("click", async () => {
    const label = snapName.value.trim();
    closeSnapUI();
    const obj = progressObj(), ms = obj.elapsed;
    const data = JSON.stringify(obj, null, 2);
    msgTarget = workMsg;
    try {
      await saveFile(`数独_${safeName(currentName)}_${safeName(label || snapName.dataset.stamp || "回答中")}.json`, data, `この状態を保存しました（経過時間 ${fmt(ms)}）`);
    } finally { msgTarget = null; }
  });

  // 回答中のファイルを開く: 問題と回答を復元し、一時停止の状態で再開を待つ
  const progressFile = document.getElementById("progress-file");
  progressFile.addEventListener("change", async () => {
    const file = progressFile.files[0];
    progressFile.value = "";
    if (!file) return;
    let obj;
    try { obj = JSON.parse(await file.text()); } catch (e) { obj = null; }
    openProgressData(obj, file.name);
  });
  function openProgressData(obj, fileName, solved) {
    if (obj && obj.solved) solved = true;
    const ok = obj && obj.kind === "progress" && /^[0-9]{81}$/.test(obj.givens || "") && Array.isArray(obj.picks) && obj.picks.length === 81 && /^[0-9]{81}$/.test(obj.sure || "");
    if (!ok) {
      say(obj && /^[0-9]{81}$/.test(obj.givens || "")
        ? "これは問題だけのファイルです。「問題を作る・登録する」→「問題ファイルを読み込む」から開いてください"
        : "このファイルは回答中のファイルではありません。「この状態を保存」→「ファイルに保存」で作ったファイルを選んでください", true);
      return;
    }
    say("");
    // 設定が「今のタイマーのまま続ける」で、今解いている問題と同じなら、タイマーとヒントの数はそのまま続ける
    const keepNow = !solved && !snapTimerBack() && (board.dataset.mode === "solve" || board.dataset.mode === "paused")
      && [...board.querySelectorAll(".cell")].map((c) => (c.classList.contains("given") && c.dataset.value) || "0").join("") === obj.givens;
    const nowMs = elapsed + (startedAt ? Date.now() - startedAt : 0), nowHints = hintsUsed, nowPts = hintPts;
    openProblem({ name: String(obj.name || "").trim().slice(0, 40) || fileName.replace(/\.json$/i, ""), givens: obj.givens });
    obj.picks.forEach((p, i) => {
      const cell = cellAt(Math.floor(i / 9), i % 9);
      if (cell.classList.contains("fixed")) return;
      for (const n of String(p)) cell.querySelector(`.cand[data-n="${n}"]`)?.classList.add("pick");
      if (Array.isArray(obj.off)) for (const n of String(obj.off[i] || "")) cell.querySelector(`.cand[data-n="${n}"]`)?.classList.add("off");
      const s = obj.sure[i];
      const cand = s !== "0" && cell.querySelector(`.cand[data-n="${s}"]`);
      if (cand) {
        cand.classList.add("pick", "sure");
        cell.querySelector(".big").textContent = s;
        cell.classList.add("tent");
      }
    });
    // 確定した順番を戻す
    if (Array.isArray(obj.order) && obj.order.length === 81) {
      sureOrder = obj.order.map((q, i) => (q > 0 && obj.sure[i] !== "0" ? { d: obj.sure[i], seq: +q } : null));
      sureSeq = Math.max(0, ...sureOrder.map((o) => (o ? o.seq : 0)));
    }
    // 経過時間を戻して回答モードに入り、すぐ一時停止にする（完成の記録はそのまま完成の画面になる）
    elapsed = keepNow ? nowMs : Math.max(0, Number(obj.elapsed) || 0);
    hintsUsed = keepNow ? nowHints : Math.max(0, Math.floor(Number(obj.hints) || 0));
    hintPts = keepNow ? nowPts : Math.max(0, Math.floor(Number(obj.hintPts) || 0));
    drawHints();
    viewingSolved = !!solved;
    showSolve();
    viewingSolved = false;
    if (solved) return;
    timerStop();
    elapsed = keepNow ? nowMs : Math.max(0, Number(obj.elapsed) || 0);
    drawTimer();
    pause.click();
    prompt.textContent = `一時停止中：${currentName}（保存した続きから）`;
  }
  const importFile = document.getElementById("import-file");
  importFile.addEventListener("change", async () => {
    const file = importFile.files[0];
    importFile.value = "";
    if (!file) return;
    let obj;
    try { obj = JSON.parse(await file.text()); } catch (e) { obj = null; }
    importProblemData(obj, file.name);
  });
  function importProblemData(obj, fileName) {
    const givens = obj && typeof obj.givens === "string" ? obj.givens.replace(/\./g, "0") : "";
    if (!/^[0-9]{81}$/.test(givens) || !/[1-9]/.test(givens)) {
      say("このファイルは問題のファイルではありません。「書き出し」で作ったファイルを選んでください", true);
      return;
    }
    const base = String(obj.name || "").trim().slice(0, 40) || fileName.replace(/\.json$/i, "");
    const list = loadAll();
    // 同じ問題があればそれを開く。名前だけ同じなら番号を付けて追加
    let p = list.find((q) => q.name === base && q.givens === givens);
    if (!p) {
      let name = base;
      for (let i = 2; list.some((q) => q.name === name); i++) name = `${base} (${i})`;
      p = { name, givens, saved: new Date().toISOString() };
      list.push(p);
      saveAll(list);
    }
    say("");
    openProblem(p);
  }

