  // ===== 05-screens-list.js：ホーム・作る・解く・設定の画面切り替え・問題一覧・プレビュー・回答画面からの書き出し =====
  // （src/js/ の全ファイルで1つの (function () { … })(); になる。まとめ方は tools/build.py）
  // 起動画面: 保存した問題の一覧から選ぶか、新しい問題を作る
  const startPanel = document.getElementById("start");
  const workPanel = document.getElementById("work");
  const listEl = document.getElementById("list");
  // ホーム（最初の画面）／作る／解く の切り替え。🏠はホーム以外で出す
  const homeBtn = document.getElementById("home-btn");
  // 設定のページを開く前の画面（「元のページに戻る」で使う）
  let settingsReturn = null;
  function setPage(page) {
    if (page !== "settings") settingsReturn = null;
    startPanel.dataset.page = page;
    document.getElementById("edit-box").hidden = true;
    document.getElementById("edit-saved").setAttribute("aria-expanded", "false");
    say("");
    updateHomeBtn();
  }
  const setBtn = document.getElementById("set-btn");
  function updateHomeBtn() {
    homeBtn.hidden = !startPanel.hidden && startPanel.dataset.page === "home";
    // ⚙️（設定）は🏠の右。ホームと設定のページでは出さない
    setBtn.hidden = !startPanel.hidden && ["home", "settings"].includes(startPanel.dataset.page);
  }
  new MutationObserver(updateHomeBtn).observe(startPanel, { attributes: true, attributeFilter: ["hidden", "data-page"] });
  document.getElementById("go-make").addEventListener("click", () => setPage("make"));
  document.getElementById("go-solve").addEventListener("click", () => setPage("solve"));
  document.getElementById("go-settings").addEventListener("click", () => setPage("settings"));
  homeBtn.addEventListener("click", () => {
    // 回答中から設定を開いていたときは、盤をしまって（一時停止中に保存して）ホームへ
    const fromWork = settingsReturn && settingsReturn.work;
    settingsReturn = null;
    if (startPanel.hidden || fromWork) showStart("home");
    else setPage("home");
  });
  // ⚙️: 設定のページへ。回答中・登録中の盤はそのまま残し（回答中は一時停止）、「元のページに戻る」でその画面に戻る
  setBtn.addEventListener("click", () => {
    if (startPanel.hidden) {
      const wasRunning = board.dataset.mode === "solve" && !!startedAt;
      if (board.dataset.mode === "solve") pause.click();
      settingsReturn = { work: true, wasRunning };
      workPanel.hidden = true;
      startPanel.hidden = false;
    } else settingsReturn = { page: startPanel.dataset.page };
    document.getElementById("go-settings").click();
  });
  // ホームの「設定」から来たときは、ホームに戻る
  document.getElementById("go-settings").addEventListener("click", () => {
    if (!settingsReturn) settingsReturn = { page: startPanel.dataset.page };
  }, true);
  document.getElementById("settings-back").addEventListener("click", () => {
    const r = settingsReturn || { page: "home" };
    settingsReturn = null;
    if (r.work) {
      startPanel.hidden = true;
      workPanel.hidden = false;
      updateHomeBtn();
      if (r.wasRunning && board.dataset.mode === "paused") pause.click();
      return;
    }
    setPage(r.page && r.page !== "settings" ? r.page : "home");
  });
  // 解いている途中で一覧やホームに戻るときは、その時点を保存してから戻る（「問題を解く」の「一時停止中」から続きを開ける）
  function showStart(page) {
    sameNum = ""; applySame();
    setPauseLock(false);
    if (["solve", "paused"].includes(board.dataset.mode) && typeof autoSave === "function") autoSave();
    if (typeof dropAssumeQuiet === "function") dropAssumeQuiet();
    // 「問題一覧へ」から来たときは、保存した問題の一覧（解くページ）
    startPanel.dataset.page = typeof page === "string" ? page : "solve";
    if (typeof setHighlight === "function" && document.querySelector("#num-hl button")) setHighlight("");
    document.getElementById("trial").hidden = true;
    timerReset();
    clearBoard();
    board.dataset.mode = "start";
    currentName = "";
    workPanel.hidden = true;
    startPanel.hidden = false;
    say("");
    renderList();
    updatePhoto();
  }
  // 完成の記録があるのに一覧に無い問題（ver.103 より前に、回答中のファイルやドライブから開いて完成させたもの）を一覧に加える
  function addSolvedToList() {
    let solved = {};
    try { solved = JSON.parse(localStorage.getItem("sudoku-solved") || "{}"); } catch (e) {}
    const list = loadAll();
    let added = false;
    for (const [givens, rec] of Object.entries(solved)) {
      if (!/^[0-9]{81}$/.test(givens) || list.some((q) => q.givens === givens)) continue;
      const base = String(rec.name || "").trim().slice(0, 40) || "完成した問題";
      let name = base;
      for (let i = 2; list.some((q) => q.name === name); i++) name = `${base} (${i})`;
      list.push({ name, givens, saved: rec.saved || new Date().toISOString() });
      added = true;
    }
    if (added) saveAll(list);
  }
  // 問題の数字だけを小さな盤で見せる（プレビュー）
  function miniBoard(givens) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 90 90");
    svg.setAttribute("class", "gd-mini");
    svg.setAttribute("aria-hidden", "true");
    let inner = '<rect x="0.5" y="0.5" width="89" height="89" class="bg"/>';
    for (let k = 1; k < 9; k++) {
      const cls = k % 3 ? "thin" : "thick";
      inner += `<line x1="${k * 10}" y1="0" x2="${k * 10}" y2="90" class="${cls}"/><line x1="0" y1="${k * 10}" x2="90" y2="${k * 10}" class="${cls}"/>`;
    }
    for (let i = 0; i < 81; i++) {
      const d = givens[i];
      if (d !== "0") inner += `<text x="${(i % 9) * 10 + 5}" y="${Math.floor(i / 9) * 10 + 8.3}">${d}</text>`;
    }
    inner += '<rect x="0.5" y="0.5" width="89" height="89" class="frame"/>';
    svg.innerHTML = inner;
    return svg;
  }
  // 「問題を解く」の一番上に、一時停止中（解いている途中）の問題を出す
  function renderPaused() {
    const box = document.getElementById("paused-box"), ul = document.getElementById("paused-list");
    ul.textContent = "";
    let cur = null;
    try { cur = JSON.parse(localStorage.getItem("sudoku-current") || "null"); } catch (e) {}
    if (!cur || !/^[0-9]{81}$/.test(cur.givens || "")) { box.hidden = true; return; }
    box.hidden = false;
    const li = document.createElement("li");
    const open = document.createElement("button");
    open.type = "button";
    open.className = "open has-mini";
    const txt = document.createElement("span");
    txt.className = "open-text";
    txt.textContent = `${cur.name || "名前のない問題"}（続きから解く）`;
    const meta = document.createElement("small");
    const empty = (cur.givens.match(/0/g) || []).length;
    const sure = (String(cur.sure || "").match(/[1-9]/g) || []).length;
    const d = new Date(cur.saved);
    meta.textContent = `確定 ${sure}/${empty} マス・経過 ${fmt(Number(cur.elapsed) || 0)}${isNaN(d) ? "" : "・" + d.toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" })}`;
    txt.appendChild(meta);
    open.append(miniBoard(cur.givens), txt);
    open.addEventListener("click", () => resumeSaved());
    const del = document.createElement("button");
    del.type = "button";
    del.className = "del";
    del.textContent = "やめる";
    del.setAttribute("aria-label", "一時停止中の問題をやめる（途中の状態を消す）");
    del.addEventListener("click", () => {
      if (!del.classList.contains("armed")) {
        del.classList.add("armed");
        del.textContent = "途中の状態を消す";
        setTimeout(() => { del.classList.remove("armed"); del.textContent = "やめる"; }, 3000);
        return;
      }
      clearAutoSave();
      renderPaused();
    });
    li.append(open, del);
    ul.appendChild(li);
  }
  function renderList() {
    renderPaused();
    addSolvedToList();
    const list = loadAll().sort((a, b) => (b.saved || "").localeCompare(a.saved || ""));
    listEl.innerHTML = "";
    document.getElementById("empty").hidden = list.length > 0;
    for (const p of list) {
      const li = document.createElement("li");
      const open = document.createElement("button");
      open.type = "button";
      open.className = "open has-mini";
      const txt = document.createElement("span");
      txt.className = "open-text";
      txt.textContent = p.name;
      const meta = document.createElement("small");
      const d = new Date(p.saved);
      meta.textContent = `問題 ${p.givens.replace(/0/g, "").length} マス・${isNaN(d) ? "" : d.toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" })}`;
      txt.appendChild(meta);
      if (/^[0-9]{81}$/.test(p.givens || "")) open.appendChild(miniBoard(p.givens));
      open.appendChild(txt);
      open.addEventListener("click", () => openProblem(p));
      const del = document.createElement("button");
      del.type = "button";
      del.className = "del";
      del.textContent = "削除";
      del.setAttribute("aria-label", `${p.name} を削除`);
      // 1回目で「削除する」に変わり、2回目で削除
      del.addEventListener("click", () => {
        if (!del.classList.contains("armed")) {
          del.classList.add("armed");
          del.textContent = "削除する";
          setTimeout(() => { del.classList.remove("armed"); del.textContent = "削除"; }, 3000);
          return;
        }
        const rest = loadAll().filter((q) => q.name !== p.name);
        saveAll(rest);
        // 完成の記録も消す（残っていると一覧に戻ってしまうため）
        if (!rest.some((q) => q.givens === p.givens)) {
          try {
            const solved = JSON.parse(localStorage.getItem("sudoku-solved") || "{}");
            delete solved[p.givens];
            localStorage.setItem("sudoku-solved", JSON.stringify(solved));
          } catch (e) {}
        }
        renderList();
      });
      const share = document.createElement("button");
      share.type = "button";
      share.className = "share";
      share.textContent = "書き出し";
      share.setAttribute("aria-label", `${p.name} をファイルに書き出し`);
      share.addEventListener("click", () => exportProblem(p));
      const rec = solvedRecord(p.givens);
      if (rec) {
        const view = document.createElement("button");
        view.type = "button";
        view.className = "share";
        view.textContent = "完成を見る";
        view.setAttribute("aria-label", `${p.name} の完成した盤を見る`);
        view.addEventListener("click", () => openProgressData(rec, p.name, true));
        li.append(open, view, share, del);
      } else li.append(open, share, del);
      listEl.appendChild(li);
    }
  }
  // 問題ファイル: {app, version, name, givens(81桁, 0=空き)} の JSON
  const fileMsg = document.getElementById("file-msg");
  let msgTarget = null;
  function say(text, isErr) {
    const el = msgTarget || fileMsg;
    el.textContent = text;
    el.classList.toggle("err", !!isErr);
  }
  // 登録済みの問題を、回答画面からそのまま書き出す
  const exportCur = document.getElementById("export-cur");
  const workMsg = document.getElementById("work-msg");

