  // ===== 12-gdrive.js：Googleドライブへの保存・Googleドライブから開く =====
  // （src/js/ の全ファイルで1つの (function () { … })(); になる。まとめ方は tools/build.py）
  // Googleドライブ: 直下の「Sudoku」フォルダに保存・そこから開く（GitHub版で使える。2回目からは前のアカウントで自動接続）
  const gd = (() => {
    const CLIENT = window.GDRIVE_CLIENT_ID || "";
    const SCOPE = "https://www.googleapis.com/auth/drive.file";
    const EMAIL_KEY = "sudoku-gdrive-email", SAVE_KEY = "sudoku-gdrive-save";
    const API = "https://www.googleapis.com/drive/v3", UP = "https://www.googleapis.com/upload/drive/v3";
    const destSet = document.getElementById("gd-dest"), openRow = document.getElementById("gd-open-row");
    const connectBtn = document.getElementById("gd-connect");
    const account = document.getElementById("gd-account"), signout = document.getElementById("gd-signout");
    const ok = !!CLIENT && location.protocol === "https:";
    let tokenClient = null, token = null, tokenExp = 0, waiting = null, folder = null;
    const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } };
    function drawAccount() {
      const email = ls(EMAIL_KEY);
      account.textContent = !ok ? "" : email ? `（${email}）` : "（まだ接続していません）";
      signout.hidden = !email;
      connectBtn.hidden = !!email;
      destSet.disabled = !email;
      // 接続しているときだけ「問題を解く」に「Googleドライブから開く」を出す
      openRow.hidden = !(ok && email);
    }
    function loadGis() {
      if (window.google?.accounts?.oauth2) return Promise.resolve();
      return new Promise((done, fail) => {
        const sc = document.createElement("script");
        sc.src = "https://accounts.google.com/gsi/client";
        sc.onload = done;
        sc.onerror = fail;
        document.head.appendChild(sc);
      });
    }
    // トークンを得る（ボタンを押した流れの中で呼ぶこと。初回はアカウントを選ぶ画面、次回からは前のアカウントで自動）
    function getToken() {
      if (token && Date.now() < tokenExp - 60000) return Promise.resolve(token);
      if (!window.google?.accounts?.oauth2) return Promise.reject(new Error("Googleの読み込みが終わっていません。少し待ってからもう一度押してください"));
      if (!tokenClient) tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT,
        scope: SCOPE,
        callback: (r) => {
          const w = waiting; waiting = null;
          if (!w) return;
          if (r.error) return w.ng(new Error("Googleドライブに接続できませんでした"));
          token = r.access_token;
          tokenExp = Date.now() + (Number(r.expires_in) || 3600) * 1000;
          w.ok(token);
        },
        error_callback: () => { const w = waiting; waiting = null; w?.ng(new Error("Googleへのログインが取り消されました")); },
      });
      const email = ls(EMAIL_KEY);
      return new Promise((ok2, ng) => {
        waiting = { ok: ok2, ng };
        tokenClient.requestAccessToken(email ? { prompt: "", login_hint: email } : { prompt: "select_account" });
      });
    }
    async function api(url, opt = {}, retry = true) {
      const t = await getToken();
      const res = await fetch(url, { ...opt, headers: { ...(opt.headers || {}), Authorization: `Bearer ${t}` } });
      if (res.status === 401 && retry) { token = null; return api(url, opt, false); }
      if (!res.ok) throw new Error(`Googleドライブとのやり取りに失敗しました（${res.status}）`);
      return res;
    }
    async function rememberAccount() {
      if (ls(EMAIL_KEY)) return;
      const me = await (await api(`${API}/about?fields=user(emailAddress)`)).json();
      if (me.user?.emailAddress) ls(EMAIL_KEY, me.user.emailAddress);
      drawAccount();
    }
    async function folderId() {
      if (folder) return folder;
      const q = encodeURIComponent("name = 'Sudoku' and mimeType = 'application/vnd.google-apps.folder' and 'root' in parents and trashed = false");
      const found = await (await api(`${API}/files?q=${q}&fields=files(id)&spaces=drive`)).json();
      if (found.files?.length) return (folder = found.files[0].id);
      const made = await (await api(`${API}/files?fields=id`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Sudoku", mimeType: "application/vnd.google-apps.folder", parents: ["root"] }),
      })).json();
      return (folder = made.id);
    }
    async function saveFile(filename, data, okText) {
      const first = getToken();  // ボタンを押した流れのうちにログイン画面を出す
      say("Googleドライブに保存しています…");
      try {
        await first;
        await rememberAccount();
        const dir = await folderId();
        const q = encodeURIComponent(`name = '${filename.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}' and '${dir}' in parents and trashed = false`);
        const same = (await (await api(`${API}/files?q=${q}&fields=files(id)`)).json()).files || [];
        if (same.length) {
          // 同じ名前のファイルがあれば上書きする
          await api(`${UP}/files/${same[0].id}?uploadType=media`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: data });
        } else {
          const b = "sudoku" + Math.random().toString(36).slice(2);
          const body = `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: filename, parents: [dir], mimeType: "application/json" })}\r\n`
            + `--${b}\r\nContent-Type: application/json\r\n\r\n${data}\r\n--${b}--`;
          await api(`${UP}/files?uploadType=multipart&fields=id`, { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${b}` }, body });
        }
        say(`${okText}（Googleドライブの「Sudoku」フォルダ）`);
      } catch (e) {
        say(e.message || "Googleドライブに保存できませんでした", true);
      }
    }
    // 一覧から選んで開く
    const dlg = document.getElementById("gd-box"), filesEl = document.getElementById("gd-files"), dlgMsg = document.getElementById("gd-box-msg");
    let shown = [];
    async function openList() {
      const first = getToken();
      filesEl.textContent = "";
      dlgMsg.classList.remove("err");
      dlgMsg.textContent = "読み込んでいます…";
      dlg.hidden = false;
      try {
        await first;
        await rememberAccount();
        const dir = await folderId();
        const q = encodeURIComponent(`'${dir}' in parents and trashed = false`);
        const files = (await (await api(`${API}/files?q=${q}&orderBy=modifiedTime desc&pageSize=100&fields=files(id,name,modifiedTime)`)).json()).files || [];
        // 中身を読んで、問題ごとに「問題」と「回答の途中」をまとめる
        let k = 0;
        const read = async () => {
          while (k < files.length) {
            const f = files[k++];
            try { f.obj = JSON.parse(await (await api(`${API}/files/${f.id}?alt=media`)).text()); } catch (e) { f.obj = null; }
          }
        };
        if (files.length) dlgMsg.textContent = "読み込んでいます…";
        await Promise.all([1, 2, 3, 4, 5, 6].map(read));
        dlgMsg.textContent = "";
        shown = files;
        drawGroups(files);
      } catch (e) {
        dlgMsg.classList.add("err");
        dlgMsg.textContent = e.message || "Googleドライブを開けませんでした";
      }
    }
    const when = (t) => new Date(t).toLocaleString("ja-JP", { dateStyle: "short", timeStyle: "short" });
    function drawGroups(files) {
      filesEl.textContent = "";
      const groups = new Map();
      for (const f of files) {
        const g = f.obj && /^[0-9.]{81}$/.test(f.obj.givens || "") ? f.obj.givens.replace(/\./g, "0") : "?" + f.id;
        if (!groups.has(g)) groups.set(g, { givens: g, prob: [], prog: [], other: [] });
        const grp = groups.get(g);
        (g.startsWith("?") ? grp.other : f.obj.kind === "progress" ? (/^[0-9]{81}$/.test(f.obj.sure || "") ? grp.prog : grp.other) : grp.prob).push(f);
      }
      if (!groups.size) { if (!dlgMsg.textContent) dlgMsg.textContent = "「Sudoku」フォルダにはまだファイルがありません。"; return; }
      for (const grp of groups.values()) {
        const all = [...grp.prob, ...grp.prog, ...grp.other];
        const name = (grp.prob[0] || grp.prog[0])?.obj?.name || all[0].name.replace(/^数独_/, "").replace(/\.json$/i, "");
        const head = document.createElement("li");
        head.className = "gd-group";
        const h = document.createElement("p");
        h.textContent = name;
        const sm = document.createElement("small");
        sm.textContent = grp.givens.startsWith("?") ? "読めないファイル" : `問題 ${grp.givens.replace(/0/g, "").length} マス`;
        h.appendChild(sm);
        if (!grp.givens.startsWith("?")) head.appendChild(miniBoard(grp.givens));
        head.appendChild(h);
        if (all.length > 1) head.appendChild(delButton(all, "まとめて削除", `${name} のファイルを全部削除`));
        filesEl.appendChild(head);
        for (const f of grp.prob) filesEl.appendChild(fileRow(f, "問題", `問題だけ（最初から解く）・${when(f.modifiedTime)}`));
        for (const f of grp.prog) {
          const o = f.obj;
          const empty = (o.givens.match(/[0.]/g) || []).length;
          const sure = (o.sure.match(/[1-9]/g) || []).length;
          const label = f.name.replace(/^数独_/, "").replace(/\.json$/i, "").replace(safeName(String(o.name || "")) + "_", "");
          if (o.solved) filesEl.appendChild(fileRow(f, "完成形", `かかった時間 ${fmt(Number(o.elapsed) || 0)}・ヒント ${Number(o.hints) || 0}回・${when(f.modifiedTime)}`));
          else filesEl.appendChild(fileRow(f, `回答の途中：${label}`, `確定 ${sure}/${empty} マス・経過 ${fmt(Number(o.elapsed) || 0)}・${when(f.modifiedTime)}`));
        }
        for (const f of grp.other) filesEl.appendChild(fileRow(f, f.name, `開けないファイル・${when(f.modifiedTime)}`, true));
      }
    }
    function fileRow(f, title, meta, noOpen) {
      const li = document.createElement("li");
      li.className = "gd-item";
      const b = document.createElement("button");
      b.type = "button";
      b.className = "open";
      b.textContent = title;
      const sm = document.createElement("small");
      sm.textContent = meta;
      b.appendChild(sm);
      if (noOpen) b.disabled = true;
      else b.addEventListener("click", () => openFile(f));
      li.append(b, delButton([f], "削除", `${title} を削除`));
      return li;
    }
    // 1回目で「削除する」に変わり、2回目でGoogleドライブのゴミ箱に移す
    function delButton(targets, text, aria) {
      const del = document.createElement("button");
      del.type = "button";
      del.className = "del";
      del.textContent = text;
      del.setAttribute("aria-label", aria);
      del.addEventListener("click", async () => {
        if (!del.classList.contains("armed")) {
          del.classList.add("armed");
          del.textContent = text === "削除" ? "削除する" : "全部削除する";
          setTimeout(() => { if (del.isConnected) { del.classList.remove("armed"); del.textContent = text; } }, 3000);
          return;
        }
        del.disabled = true;
        dlgMsg.classList.remove("err");
        dlgMsg.textContent = "削除しています…";
        try {
          for (const f of targets) {
            await api(`${API}/files/${f.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ trashed: true }) });
            f.gone = true;
          }
          dlgMsg.textContent = `${targets.length}個のファイルをGoogleドライブのゴミ箱に移しました。`;
        } catch (e) {
          dlgMsg.classList.add("err");
          dlgMsg.textContent = e.message || "削除できませんでした";
        }
        drawGroups(shown.filter((f) => !f.gone));
      });
      return del;
    }
    async function openFile(f) {
      dlgMsg.classList.remove("err");
      dlgMsg.textContent = "開いています…";
      let obj = null;
      try { obj = f.obj || JSON.parse(await (await api(`${API}/files/${f.id}?alt=media`)).text()); } catch (e) { obj = null; }
      dlg.hidden = true;
      if (obj && obj.kind === "progress") openProgressData(obj, f.name);
      else importProblemData(obj, f.name);
    }
    document.getElementById("gd-na").hidden = ok;
    document.getElementById("gd-on").hidden = !ok;
    if (ok) {
      connectBtn.addEventListener("click", async () => {
        const first = getToken();  // ボタンを押した流れのうちにログイン画面を出す
        say("Googleドライブに接続しています…");
        try {
          await first;
          await rememberAccount();
          say("Googleドライブに接続しました");
        } catch (e) {
          say(e.message || "Googleドライブに接続できませんでした", true);
        }
      });
      destSet.querySelector(`input[value="${dest()}"]`).checked = true;
      destSet.addEventListener("change", (e) => ls(SAVE_KEY, e.target.value));
      drawAccount();
      loadGis().catch(() => {});
      document.getElementById("gd-open").addEventListener("click", openList);
      document.getElementById("gd-close").addEventListener("click", () => { dlg.hidden = true; });
      signout.addEventListener("click", () => {
        if (token && window.google?.accounts?.oauth2) google.accounts.oauth2.revoke(token, () => {});
        token = null; folder = null;
        ls(EMAIL_KEY, null);
        drawAccount();
        say("Googleドライブとの接続を解除しました");
      });
    }
    // 保存先: drive（Googleドライブを優先）/ ask（保存のたびに選ぶ）/ local（この端末）。前の版のチェック "1" はドライブ優先
    function dest() {
      const v = ls(SAVE_KEY);
      return v === "1" || v === "drive" ? "drive" : v === "ask" ? "ask" : "local";
    }
    return { mode: () => (ok && ls(EMAIL_KEY) ? dest() : "local"), saveFile };
  })();

  function openProblem(p) {
    clearBoard();
    [...p.givens].forEach((v, i) => {
      if (v === "0") return;
      const c = cellAt(Math.floor(i / 9), i % 9);
      c.dataset.value = v;
      c.querySelector(".big").textContent = v;
      c.querySelector(".big").tabIndex = -1;
      c.classList.add("fixed", "given");
    });
    currentName = p.name;
    startPanel.hidden = true;
    workPanel.hidden = false;
    showReady(p.givens.replace(/0/g, "").length);
    markConflicts();
  }
