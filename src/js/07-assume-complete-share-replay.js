  // ===== 07-assume-complete-share-replay.js：仮定モード・完成・完成形を保存・LINEなどで送る・再生 =====
  // （src/js/ の全ファイルで1つの (function () { … })(); になる。まとめ方は tools/build.py）
  // ===== 仮定モード =====
  const assumeBox = document.getElementById("assume-box"), assumeWarnEl = document.getElementById("assume-warn");
  function assumeWarn(t, err) { assumeWarnEl.textContent = t; assumeWarnEl.classList.toggle("err", !!err); }
  function startAssume(cell, cand) {
    if (assume || board.dataset.mode !== "solve" || !cand || !cand.classList.contains("cand")) return;
    flushTap();
    const cells = [...board.querySelectorAll(".cell")], i = cells.indexOf(cell);
    assume = { snap: snapshot(), undoLen: undoStack.length, base: 0, i, r: +cell.dataset.row, c: +cell.dataset.col, n: cand.dataset.n };
    runTap(cand, cell, 2);
    if (!cell.classList.contains("tent")) { assume = null; return; }
    assume.base = undoStack.length;
    for (const id of ["hint-menu", "view-menu", "snap-menu"]) document.getElementById(id).hidden = true;
    document.getElementById("assume-msg").textContent = `${assume.r + 1}行${assume.c + 1}列を「${assume.n}」と仮定しています`;
    assumeWarn("ここから入れた数字や候補の変化は紫で表示します。矛盾が出たら「仮定前に戻り、この数字を除外」を押してください。");
    assumeBox.hidden = false;
    assumeLock(true);
    markAssume();
  }
  // 仮定前と比べて変わったところに印を付け、矛盾があれば知らせる
  function markAssume() {
    board.classList.toggle("assuming", !!assume);
    board.querySelectorAll(".cell.as-root, .cell.as-t").forEach((c) => c.classList.remove("as-root", "as-t"));
    board.querySelectorAll(".cand.as-c").forEach((x) => x.classList.remove("as-c"));
    if (!assume) return;
    const cells = [...board.querySelectorAll(".cell")], now = snapshot();
    cells.forEach((c, i) => {
      const a = assume.snap[i], b = now[i];
      if (b.sure) { if (b.sure !== a.sure) c.classList.add(i === assume.i ? "as-root" : "as-t"); return; }
      if (b.value !== null && b.value) return;
      c.querySelectorAll(".cand").forEach((x) => {
        const n = x.dataset.n;
        if (a.pick.includes(n) !== b.pick.includes(n) || a.off.includes(n) !== b.off.includes(n) || (a.sure === n)) x.classList.add("as-c");
      });
    });
    const dup = cells.some((c) => c.classList.contains("conflict") || c.classList.contains("tent-bad"));
    const none = cells.find((c) => !c.dataset.value && !c.classList.contains("tent") && c.querySelectorAll(".cand.off").length === 9);
    // 行・列・ブロックの中に、ある数字を入れられる場所が1つもない
    const val = (o) => o.dataset.value || (o.classList.contains("tent") ? o.querySelector(".big").textContent : "");
    const sees = (a, b) => a.dataset.row === b.dataset.row || a.dataset.col === b.dataset.col
      || (Math.floor(a.dataset.row / 3) === Math.floor(b.dataset.row / 3) && Math.floor(a.dataset.col / 3) === Math.floor(b.dataset.col / 3));
    let gap = "";
    if (!dup && !none) {
      const units = [];
      for (let k = 0; k < 9; k++) {
        units.push([`${k + 1}行目`, cells.filter((o) => +o.dataset.row === k)]);
        units.push([`${k + 1}列目`, cells.filter((o) => +o.dataset.col === k)]);
        units.push([`${Math.floor(k / 3) * 3 + 1}〜${Math.floor(k / 3) * 3 + 3}行・${(k % 3) * 3 + 1}〜${(k % 3) * 3 + 3}列のブロック`, cells.filter((o) => Math.floor(o.dataset.row / 3) * 3 + Math.floor(o.dataset.col / 3) === k)]);
      }
      outer: for (const [name, us] of units) for (let n = 1; n <= 9; n++) {
        const d = String(n);
        if (us.some((o) => val(o) === d)) continue;
        if (us.some((o) => !val(o) && !o.querySelector(`.cand[data-n="${d}"]`).classList.contains("off") && !cells.some((x) => x !== o && val(x) === d && sees(x, o)))) continue;
        gap = `${name}に「${d}」を入れられる場所がありません`;
        break outer;
      }
    }
    if (dup || none || gap) {
      const why = dup ? "同じ行・列・ブロックに同じ数字があります" : none ? `${+none.dataset.row + 1}行${+none.dataset.col + 1}列に入る数字がありません` : gap;
      assumeWarn(`矛盾が見つかりました：${why}。仮定がまちがっているか、仮定のあとの入力にまちがいがあります。仮定のあとの入力に誤りがなければ、「仮定前に戻り、この数字を除外」を押してください。`, true);
    } else if (cells.every((c) => c.dataset.value || c.classList.contains("tent"))) {
      assumeWarn("すべてのマスが埋まりました。「仮定を採用する」を押すと完成になります。");
    } else if (assumeWarnEl.classList.contains("err")) {
      assumeWarn("ここから入れた数字や候補の変化は紫で表示します。矛盾が出たら「仮定前に戻り、この数字を除外」を押してください。");
    }
  }
  function endAssume(how) {
    if (!assume) return;
    flushTap();
    const a = assume;
    if (how !== "adopt") {
      restore(a.snap);
      undoStack.length = Math.min(undoStack.length, a.undoLen);
      if (how === "drop") {
        // 仮定した数字を、そのマスの候補から消す（「戻る」で消す前に戻せる）
        undoStack.push(snapshot());
        const x = board.querySelectorAll(".cell")[a.i].querySelector(`.cand[data-n="${a.n}"]`);
        x.classList.remove("pick", "bad");
        x.classList.add("off");
      }
      undoBtn.disabled = undoStack.length === 0;
    }
    assume = null;
    assumeBox.hidden = true;
    assumeLock(false);
    markConflicts();
    markAssume();
    if (typeof renderPad === "function") renderPad();
    workMsg.classList.remove("err");
    workMsg.textContent = how === "adopt" ? `${a.r + 1}行${a.c + 1}列の「${a.n}」の仮定を採用しました。`
      : how === "drop" ? `仮定前に戻り、${a.r + 1}行${a.c + 1}列の候補から「${a.n}」を消しました。（「1手戻す」で消す前に戻せます）`
      : "仮定前の盤に戻しました。";
    if (how === "adopt") checkComplete();
  }
  document.getElementById("as-adopt").addEventListener("click", () => endAssume("adopt"));
  document.getElementById("as-back").addEventListener("click", () => endAssume("back"));
  document.getElementById("as-drop").addEventListener("click", () => endAssume("drop"));
  // ホームなどへ移るときは、仮定前の盤のまま閉じる（自動保存も仮定前の盤で行う）
  function dropAssumeQuiet() {
    if (!assume) return;
    assume = null;
    assumeBox.hidden = true;
    assumeLock(false);
    markAssume();
  }
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z" && e.target.tagName !== "INPUT") {
      e.preventDefault();
      undo();
    }
  });

  // 完成: 全マスが大きな数字（問題の数字か確定候補）で埋まり、赤字が無ければタイマーを止めて知らせる
  const clearBox = document.getElementById("clear");
  const SOLVED_KEY = "sudoku-solved";
  let viewingSolved = false;
  function solvedRecord(givens) {
    try { return JSON.parse(localStorage.getItem(SOLVED_KEY) || "{}")[givens] || null; } catch (e) { return null; }
  }
  function checkComplete() {
    if (board.dataset.mode !== "solve" || assume) return;
    const cells = [...board.querySelectorAll(".cell")];
    if (!cells.every((c) => c.classList.contains("fixed") || c.classList.contains("tent"))) return;
    if (cells.some((c) => c.classList.contains("conflict") || c.classList.contains("tent-bad"))) return;
    flushTap();
    timerStop();
    board.dataset.mode = "complete";
    if (!viewingSolved) {
      clearAutoSave();
      // 完成した盤と解いた順番を残し、一覧の「完成を見る」からあとで開けるようにする
      try {
        const rec = progressObj();
        const all = JSON.parse(localStorage.getItem(SOLVED_KEY) || "{}");
        all[rec.givens] = rec;
        localStorage.setItem(SOLVED_KEY, JSON.stringify(all));
        // 回答中のファイルやGoogleドライブから開いた問題は一覧に無いので、一覧に加えて「完成を見る」を出せるようにする
        const list = loadAll();
        if (!list.some((q) => q.givens === rec.givens)) {
          let name = currentName || "完成した問題";
          for (let i = 2; list.some((q) => q.name === name); i++) name = `${currentName || "完成した問題"} (${i})`;
          list.push({ name, givens: rec.givens, saved: new Date().toISOString() });
          saveAll(list);
        }
      } catch (e) {}
    }
    selectCell(null);
    prompt.textContent = `完成：${currentName}（${timerEl.textContent}）`;
    note.textContent = "「リセット」で最初から解き直せます。";
    pause.hidden = true;
    hintBtn.hidden = true;
    document.getElementById("check").hidden = true;
    document.getElementById("hint-menu").hidden = true;
    viewBtn.hidden = true;
    document.getElementById("view-menu").hidden = true;
    undoBtn.hidden = true;
    saveProgress.hidden = true;
    snapOpen.hidden = true;
    closeSnapUI();
    confirmBox.hidden = true;
    document.getElementById("clear-time").textContent = `かかった時間 ${timerEl.textContent}`;
    document.getElementById("clear-hints").textContent = `使ったヒント ${hintsUsed}回・${hintPts}ポイント`;
    replayBtn.hidden = false;
    saveSolvedBtn.hidden = false; document.getElementById("share-solved").hidden = false;
    clearBox.hidden = false;
    document.getElementById("clear-replay").focus();
  }
  document.getElementById("clear-ok").addEventListener("click", () => { clearBox.hidden = true; });
  // 完成形を保存: 完成した盤・解いた順番・時間をファイル（チェックがあればGoogleドライブ）に保存する。開くと完成の画面になる
  const saveSolvedBtn = document.getElementById("save-solved");
  async function saveSolved() {
    clearBox.hidden = true;
    const obj = { ...progressObj(), solved: true };
    msgTarget = workMsg;
    try {
      await saveFile(`数独_${safeName(currentName)}_完成.json`, JSON.stringify(obj, null, 2), `完成形を保存しました（${fmt(obj.elapsed)}）`);
    } finally { msgTarget = null; }
  }
  saveSolvedBtn.addEventListener("click", saveSolved);
  document.getElementById("clear-save").addEventListener("click", saveSolved);
  // 問題図を送る: 最初の数字だけの盤の画像と、かかった時間・81桁の盤面データの文を、共有メニュー（スマホ）かコピー（PC）で渡す
  const APP_URL = "https://takusaka-arch.github.io/sudoku/";
  const shareBox = document.getElementById("share-box");
  let shareData = null;
  function jtime(ms) {
    const t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, sec = t % 60;
    return (h ? h + "時間" : "") + (h || m ? m + "分" : "") + sec + "秒";
  }
  function makeShare() {
    const o = progressObj(), g = o.givens, time = jtime(o.elapsed);
    // 完成したときは時間とヒント数、まだのときは「解いてみてください」を載せる
    const done = board.dataset.mode === "complete", std = targetText();
    const W = 720, P = 30, B = W - P * 2, cs = B / 9, top = 86;
    const cv = document.createElement("canvas");
    cv.width = W; cv.height = top + B + 214 + (std ? 40 : 0);
    const x = cv.getContext("2d");
    const sans = '"Hiragino Sans", "Noto Sans JP", "Yu Gothic", "Meiryo", sans-serif';
    x.fillStyle = "#fff"; x.fillRect(0, 0, W, cv.height);
    x.fillStyle = "#1c2433"; x.textAlign = "center"; x.textBaseline = "middle";
    x.font = "700 32px " + sans;
    x.fillText(`数独「${currentName || "問題"}」`, W / 2, 46, B);
    x.font = "700 46px " + sans;
    for (let i = 0; i < 81; i++) {
      const d = g[i];
      if (d !== "0") x.fillText(d, P + (i % 9 + 0.5) * cs, top + (Math.floor(i / 9) + 0.5) * cs + 2);
    }
    for (let k = 0; k <= 9; k++) {
      x.strokeStyle = "#1c2433"; x.lineWidth = k % 3 ? 1 : 3.5;
      x.beginPath(); x.moveTo(P + k * cs, top); x.lineTo(P + k * cs, top + B); x.stroke();
      x.beginPath(); x.moveTo(P, top + k * cs); x.lineTo(P + B, top + k * cs); x.stroke();
    }
    let y = top + B + 44;
    x.font = "700 30px " + sans;
    x.fillText(done ? `かかった時間 ${time}・ヒント ${hintsUsed}回` : "この問題を解いてみてください！", W / 2, y, B);
    if (std) { y += 42; x.font = "500 25px " + sans; x.fillStyle = "#2f6fb5"; x.fillText(`標準回答時間 ${std}`, W / 2, y, B); x.fillStyle = "#1c2433"; }
    x.font = '500 21px "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace';
    x.fillStyle = "#4a5568";
    for (let r = 0; r < 3; r++) x.fillText(g.slice(r * 27, r * 27 + 27), W / 2, y + 48 + r * 30, B);
    x.font = "500 18px " + sans; x.fillStyle = "#7a869a";
    x.fillText(`数独回答支援アプリ  ${APP_URL}`, W / 2, cv.height - 24, B);
    const url = cv.toDataURL("image/png"), bin = atob(url.split(",")[1]), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const blob = new Blob([u8], { type: "image/png" });
    const text = `${done ? `数独「${currentName || "問題"}」を ${time} で解きました！（ヒント${hintsUsed}回）` : `数独「${currentName || "問題"}」の問題です。解いてみてください！`}${std ? `\n標準回答時間：${std}` : ""}\n問題（81桁の盤面データ）：\n${g}\n数独回答支援アプリで開く：\n${shareUrl(g)}`;
    shareData = { url, blob, text, file: new File([blob], `数独_${safeName(currentName || "問題")}.png`, { type: "image/png" }) };
    return shareData;
  }
  // 押すとアプリでこの問題が開くURL（LINEの中ではなく普段のブラウザで開くよう openExternalBrowser を付ける）
  const shareUrl = (g) => `${APP_URL}?p=${g}&n=${encodeURIComponent(currentName || "問題")}&openExternalBrowser=1`;
  const canShareFile = (d) => { try { return !!(navigator.share && navigator.canShare && navigator.canShare({ files: [d.file], text: d.text })); } catch (e) { return false; } };
  async function nativeShare(d) {
    try { await navigator.share({ files: [d.file], text: d.text }); return true; }
    catch (e) { return e && e.name === "AbortError"; }
  }
  function openShareBox(d) {
    document.getElementById("share-img").src = d.url;
    document.getElementById("share-text").value = d.text;
    document.getElementById("share-native").hidden = !canShareFile(d);
    shareBox.hidden = false;
    document.getElementById("share-img-copy").focus({ preventScroll: true });
  }
  async function shareSolved() {
    clearBox.hidden = true;
    const d = makeShare();
    // スマホは共有メニューからLINEを選ぶ。PCや共有メニューが使えないときはコピー用の画面を出す
    if (matchMedia("(pointer: coarse)").matches && canShareFile(d) && await nativeShare(d)) return;
    openShareBox(d);
  }
  document.getElementById("share-solved").addEventListener("click", shareSolved);
  document.getElementById("clear-share").addEventListener("click", shareSolved);
  document.getElementById("exp-share").addEventListener("click", () => { expBox.hidden = true; shareSolved(); });
  const shareMsg = document.getElementById("share-msg");
  const closeShare = () => { shareBox.hidden = true; };
  document.getElementById("share-cancel").addEventListener("click", closeShare);
  shareBox.addEventListener("click", (e) => { if (e.target === shareBox) closeShare(); });
  shareBox.addEventListener("keydown", (e) => { if (e.key === "Escape") closeShare(); });
  document.getElementById("share-native").addEventListener("click", () => { if (shareData) nativeShare(shareData); });
  document.getElementById("share-img-copy").addEventListener("click", async () => {
    try { await navigator.clipboard.write([new ClipboardItem({ "image/png": shareData.blob })]); shareMsg.textContent = "画像をコピーしました。LINEのトークに貼り付けてください。"; }
    catch (e) { shareMsg.textContent = "画像をコピーできませんでした。「画像を保存」してから送ってください。"; }
  });
  document.getElementById("share-text-copy").addEventListener("click", async () => {
    const ta = document.getElementById("share-text");
    try { await navigator.clipboard.writeText(ta.value); shareMsg.textContent = "文をコピーしました。"; }
    catch (e) { ta.focus(); ta.select(); try { document.execCommand("copy"); shareMsg.textContent = "文をコピーしました。"; } catch (e2) { shareMsg.textContent = "コピーできませんでした。文字を選んでコピーしてください。"; } }
  });
  document.getElementById("share-img-save").addEventListener("click", () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(shareData.blob); a.download = shareData.file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  });
  // 再生: 確定候補を、最後に確定した順に1マスずつ出していく
  const replayBtn = document.getElementById("replay");
  let replayTimer = null;
  let replayFrom = "", replayPrompt = "";
  function stopReplay() {
    clearInterval(replayTimer);
    replayTimer = null;
    board.querySelectorAll(".cell.rp-wait, .cell.rp-now").forEach((c) => c.classList.remove("rp-wait", "rp-now"));
    replayBtn.textContent = "再生";
    if (board.dataset.mode === "replay") {
      board.dataset.mode = replayFrom;
      prompt.textContent = replayPrompt;
      renderPad();
    }
  }
  // 解いている途中でも再生できる（再生のあいだは一時停止にし、終わったら一時停止のまま戻る）
  function startReplay() {
    stopReplay();
    clearBox.hidden = true;
    if (board.dataset.mode === "solve") pause.click();
    if (!["paused", "complete"].includes(board.dataset.mode)) return;
    const cells = [...board.querySelectorAll(".cell")];
    const steps = cells.map((c) => ({ c, o: sureOrder[c.dataset.row * 9 + +c.dataset.col] })).filter((x) => x.o && x.c.classList.contains("tent")).sort((a, b) => a.o.seq - b.o.seq).map((x) => x.c);
    if (!steps.length) { workMsg.textContent = "まだ確定候補がないので、再生するものがありません。"; return; }
    replayFrom = board.dataset.mode;
    replayPrompt = prompt.textContent;
    selectCell(null);
    board.dataset.mode = "replay";
    renderPad();
    steps.forEach((c) => c.classList.add("rp-wait"));
    replayBtn.textContent = "再生を止める";
    let k = 0;
    prompt.textContent = `再生中：0 / ${steps.length}`;
    replayTimer = setInterval(() => {
      if (board.dataset.mode !== "replay") return stopReplay();
      board.querySelectorAll(".cell.rp-now").forEach((c) => c.classList.remove("rp-now"));
      if (k >= steps.length) return stopReplay();
      steps[k].classList.remove("rp-wait");
      steps[k].classList.add("rp-now");
      k++;
      prompt.textContent = `再生中：${k} / ${steps.length}`;
    }, 800);
  }
  replayBtn.addEventListener("click", () => {
    if (replayTimer) stopReplay();
    else startReplay();
  });
  document.getElementById("clear-replay").addEventListener("click", startReplay);

