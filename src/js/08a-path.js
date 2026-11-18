  // ===== 08a-path.js：正解への道筋（表示方法変更のメニューから）=====
  // （src/js/ の全ファイルで1つの (function () { … })(); になる。まとめ方は tools/build.py）
  // 正解までの解き方を1ページずつ見せる。盤と解説だけの画面で、「前へ」「次へ」「閉じる」で動かす。
  // ページの中身（どの解き方で、どのマスが決まり、どの候補が消えるか）は 15-puzzle-maker.js の solvePath() が作る。
  // ここは見せるだけ。回答中の盤・ヒントの回数・目標時間には何も触らない（タイマーは見ている間だけ止める）。
  const pathView = document.getElementById("path-view"), pathBoard = document.getElementById("path-board");
  const pathHead = document.getElementById("path-head"), pathText = document.getElementById("path-text");
  const pathPrev = document.getElementById("path-prev"), pathNext = document.getElementById("path-next");
  const pathConfirm = document.getElementById("path-confirm");
  // 組ごとの色（PAIR_COLORS と同じ並び）の呼び名。赤は消す候補に使うので、組の色には使わない
  const PATH_COLOR_NAMES = ["青", "オレンジ", "緑", "ピンク", "青緑", "紫", "金色"];
  // ブロックの呼び名 BOX_NAMES は 10-hints-advanced.js のものを使う
  const cellNm = (i) => `${Math.floor(i / 9) + 1}行${(i % 9) + 1}列`;
  const unitNm = (k, n) => (k === 0 ? `${n + 1}行目` : k === 1 ? `${n + 1}列目` : `${BOX_NAMES[n]}のブロック`);
  const digitsOf = (m) => [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => m & (1 << d));
  let path = null, pathAt = 0, pathWasRunning = false;
  const pathAllowAnswers = document.getElementById("path-allow-answers");
  let pathProofActive = null;

  // 盤の確定している数字（問題の数字・確定候補）。0 = 空き
  function boardFixed() {
    const v = new Array(81).fill(0);
    board.querySelectorAll(".cell").forEach((o) => {
      const i = +o.dataset.row * 9 + +o.dataset.col;
      v[i] = Number(o.dataset.value || (o.classList.contains("tent") ? o.querySelector(".big").textContent : 0)) || 0;
    });
    return v;
  }
  // 現在の盤で利用者が明示的に除外した候補。未選択（書き込み方式）は除外扱いにしない。
  function boardOff() {
    const off = new Array(81).fill(0);
    board.querySelectorAll(".cell").forEach((o) => {
      const i = +o.dataset.row * 9 + +o.dataset.col;
      if (o.dataset.value || o.classList.contains("tent")) return;
      o.querySelectorAll(".cand.off").forEach((c) => { off[i] |= 1 << Number(c.dataset.n); });
    });
    return off;
  }
  function boardGivens() {
    const v = new Array(81).fill(0);
    board.querySelectorAll(".cell.given").forEach((o) => { v[+o.dataset.row * 9 + +o.dataset.col] = Number(o.dataset.value) || 0; });
    return v;
  }

  // メニューで選んだとき: どこから見るかを聞く
  function openPathChoice() {
    workMsg.classList.remove("err");
    if (!solution || solution.n !== 1) {
      workMsg.textContent = solution && solution.n > 1 ? "答えが1つに決まらない問題なので、正解への道筋は出せません。" : "この問題は答えがないため、正解への道筋は出せません。";
      return;
    }
    pathConfirm.hidden = false;
  }
  document.getElementById("path-cancel").addEventListener("click", () => { pathConfirm.hidden = true; viewBtn.focus(); });
  document.getElementById("path-from-start").addEventListener("click", () => startPath(boardGivens(), false, null));
  document.getElementById("path-from-now").addEventListener("click", () => {
    const v = boardFixed();
    const wrong = v.findIndex((d, i) => d && String(d) !== solution.sol[i]);
    if (wrong >= 0) {
      pathConfirm.hidden = true;
      workMsg.classList.add("err");
      workMsg.textContent = `今の盤に正解と違う数字があります（${cellNm(wrong)}など）。直してから選ぶか、「問題の最初から」を選んでください。`;
      return;
    }
    const off = boardOff();
    const falseOff = off.findIndex((mask, i) => !v[i] && (mask & (1 << Number(solution.sol[i]))));
    if (falseOff >= 0) {
      pathConfirm.hidden = true;
      workMsg.classList.add("err");
      workMsg.textContent = `${cellNm(falseOff)}で正解の候補が除外されています。候補を戻してから選ぶか、「問題の最初から」を選んでください。`;
      return;
    }
    startPath(v, true, off);
  });

  function startPath(v, fromNow, off) {
    pathConfirm.hidden = true;
    workMsg.classList.remove("err");
    workMsg.textContent = "正解への道筋を計算しています…";
    // 文字を出してから計算する（難しい問題は少し時間がかかる）
    setTimeout(() => {
      if (!hintEngine) hintEngine = sudokuGen({ postMessage() {} }, GEN_RULES);
      path = hintEngine.solvePath(v, solution.sol, { off, allowAnswers: pathAllowAnswers.checked });
      path.fromNow = fromNow;
      path.given = boardGivens();
      pathAt = 0;
      pathProofActive = null;
      workMsg.textContent = "";
      pathWasRunning = board.dataset.mode === "solve" && !!startedAt;
      if (board.dataset.mode === "solve") pause.click();
      pathView.hidden = false;
      document.body.classList.add("path-open");
      drawPath();
      pathNext.focus({ preventScroll: true });
    }, 30);
  }
  function closePath() {
    pathView.hidden = true;
    document.body.classList.remove("path-open");
    path = null;
    if (pathWasRunning && board.dataset.mode === "paused") pause.click();
    viewBtn.focus({ preventScroll: true });
  }
  document.getElementById("path-close").addEventListener("click", closePath);
  pathPrev.addEventListener("click", () => { if (path && pathAt > 0) { pathAt--; pathProofActive = null; drawPath(); } });
  pathNext.addEventListener("click", () => { if (!path) return; if (pathAt >= path.pages.length && path.solved) pathAt = 0; else if (pathAt < path.pages.length) pathAt++; else return; pathProofActive = null; drawPath(); });
  document.addEventListener("keydown", (e) => {
    if (pathView.hidden) return;
    if (e.key === "Escape") closePath();
    else if (e.key === "ArrowRight") pathNext.click();
    else if (e.key === "ArrowLeft") pathPrev.click();
  });

  // 背理法の途中手順を選ぶと、閲覧用の盤だけをその時点へ切り替える。
  pathText.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-proof-branch]");
    if (!btn || !path || pathAt >= path.pages.length) return;
    const pg = path.pages[pathAt];
    if (pg.kind !== "contra") return;
    const branch = btn.dataset.proofBranch, index = Number(btn.dataset.proofStep);
    const series = branch === "main" ? pg.trace : branch === "outer" ? pg.outerTrace : branch === "a" ? pg.traceA : pg.traceB;
    if (!series || !series[index]) return;
    pathProofActive = { branch, index };
    drawPath();
  });

  // 盤を描く。cand の数字を小さく出し、gone（[{i, m, g}]）は赤い線で消し、placed（[{i, d, g}]）は大きな数字を組の色で、
  // basis（[{cells, g}]）はマスの背景を組の色にする。g = 組の番号（色）
  function drawPathBoard(state, { gone = [], placed = [], basis = [], given }) {
    pathBoard.textContent = "";
    const goneAt = new Map(), placedAt = new Map(), basisAt = new Map();
    for (const x of gone) goneAt.set(x.i, { m: (goneAt.get(x.i) || { m: 0 }).m | x.m, g: x.g });
    for (const x of placed) placedAt.set(x.i, x);
    for (const b of basis) for (const i of b.cells) basisAt.set(i, b.g);
    for (let i = 0; i < 81; i++) {
      const c = document.createElement("div");
      c.className = "pv-cell";
      if (Math.floor(i / 9) % 3 === 2 && i < 72) c.classList.add("pv-b");
      if (i % 9 % 3 === 2 && i % 9 < 8) c.classList.add("pv-r");
      if (basisAt.has(i)) { c.classList.add("pv-basis"); c.style.setProperty("--pc", PAIR_COLORS[basisAt.get(i) % 7]); }
      const p = placedAt.get(i);
      if (state.v[i] || p) {
        const big = document.createElement("span");
        big.className = "pv-big";
        big.textContent = state.v[i] || p.d;
        if (given[i]) c.classList.add("pv-given");
        else if (p) { c.classList.add("pv-new"); c.style.setProperty("--pc", PAIR_COLORS[(p.g || 0) % 7]); }
        c.appendChild(big);
      } else {
        const gm = goneAt.has(i) ? goneAt.get(i).m : 0;
        for (let d = 1; d <= 9; d++) {
          const s = document.createElement("span");
          s.className = "pv-cand";
          if (state.cand[i] & (1 << d)) {
            s.textContent = d;
            if (gm & (1 << d)) s.classList.add("pv-gone");
          }
          c.appendChild(s);
        }
      }
      pathBoard.appendChild(c);
    }
  }

  // 解き方の説明（ヒントメニューの説明と同じ文）
  const techDesc = (name) => (hintKinds.find((k) => k.label === name) || {}).desc || "";
  const goneText = (list) => list.map((x) => `${cellNm(x.i)}の「${digitsOf(x.m).join("・")}」`).join("、");
  // ヒントメニューと同じ情報の順序で、盤面の説明を整理する。ボタンの寸法・配置は変えない。
  const pathSection = (label, html) => {
    const block = document.createElement("div");
    block.className = "path-explain-section";
    const title = document.createElement("p");
    title.className = "path-explain-label";
    title.textContent = label;
    const body = document.createElement("p");
    body.innerHTML = html;
    block.append(title, body);
    pathText.appendChild(block);
  };

  function drawPath() {
    const pages = path.pages, total = pages.length;
    const given = path.given;
    pathPrev.disabled = pathAt === 0;
    // 完成したときだけ「次へ」を「最初から見る」に切り替え、ボタン数を増やさない。
    const complete = pathAt >= total && path.solved;
    pathNext.textContent = complete ? "最初から見る" : "次へ ▶";
    pathNext.disabled = pathAt >= total && !complete;
    pathText.textContent = "";
    const say = (html) => { const p = document.createElement("p"); p.innerHTML = html; pathText.appendChild(p); };
    const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const sw = (g) => `<span class="pv-sw" style="--pc:${PAIR_COLORS[g % 7]}"></span>${PATH_COLOR_NAMES[g % 7]}`;
    if (pathAt >= total) {
      // 最後のページ: できあがった盤
      const last = pages[total - 1];
      drawPathBoard(last.after, { given });
      pathHead.textContent = `${total}／${total}　${path.solved ? "完成" : "ここまで"}`;
      say(path.solved ? "これですべてのマスが埋まりました。「最初から見る」で、正解への道筋を初めから確認できます。" : (path.logicalOnly ? "ここから先は、利用できる論理手順では進められませんでした。必要なら最初の画面で「正解データも使う」を選んでください。" : "ここから先は、この道筋では進められませんでした。"));
      return;
    }
    const pg = pages[pathAt];
    const no = `${pathAt + 1}／${total}`;
    if (pg.kind === "start") {
      drawPathBoard(pg.before, { gone: pg.gone, given });
      pathHead.textContent = `${no}　問題の数字で候補を消す`;
      pathSection("解法", "確定済みの数字から、同じ行・列・ブロックに入れられない候補を除外します。");
      pathSection("注目する場所", path.fromNow ? "今の盤の確定数字と、除外済み候補を確認します。" : "問題の最初から入っている数字に注目します。");
      pathSection("実行する操作", "赤い丸の候補を除外します。残った小さな数字が候補です。");
    } else if (pg.kind === "single") {
      const placed = pg.placed.map((x) => ({ ...x, g: 0 }));
      drawPathBoard(pg.before, { placed, given });
      const K = { row: [0, "行に注目", "行の中で、ある数字を入れられるマスが1つしかなければ、その数字はそのマスに決まります。"],
        col: [1, "列に注目", "列の中で、ある数字を入れられるマスが1つしかなければ、その数字はそのマスに決まります。"],
        box: [2, "ブロックに注目", "ブロックの中で、ある数字を入れられるマスが1つしかなければ、その数字はそのマスに決まります。"],
        cell: [-1, "マスに注目", "候補が1つしか残っていないマスは、その数字に決まります。"] }[pg.key];
      pathHead.textContent = `${no}　${K[1]}（シングル ★）`;
      pathSection("解法", esc(K[2]));
      pathSection("注目する場所", pg.placed.map((x) => esc(K[0] < 0 ? cellNm(x.i) : `${unitNm(K[0], x.unit)} → ${cellNm(x.i)}`)).join("、"));
      pathSection("実行する操作", pg.placed.map((x) => esc(`${cellNm(x.i)}を「${x.d}」に確定`)).join("、") + `。${sw(0)}の数字で表示しています。確定した数字は同じ行・列・ブロックの候補から除外されます。`);
    } else if (pg.kind === "tech") {
      const gone = pg.groups.flatMap((g, n) => g.gone.map((x) => ({ ...x, g: n })));
      const basis = pg.groups.map((g, n) => ({ cells: g.basis, g: n }));
      drawPathBoard(pg.before, { gone, basis, given });
      pathHead.textContent = `${no}　${pg.tech}（${"★".repeat(pg.lv)}）`;
      pathSection("解法", "シングルでは進めないため、次の解法を使います。" + esc(techDesc(pg.tech)));
      pathSection("注目する場所", pg.groups.map((g, n) => g.basis.length ? `${sw(n)}のマス（${esc(g.basis.map(cellNm).join("・"))}）` : "候補の配置").join("、"));
      pathSection("実行する操作", pg.groups.map((g, n) => `${sw(n)}：${esc(goneText(g.gone))}を除外します。`).join("<br>") + "赤い丸が除外する候補です。確定するマスは次のページで表示します。");
      if (pg.groups.length > 1) say("同じ解法を使う複数の組は、色を分けて表示しています。");
    } else if (pg.kind === "contra") {
      // 背理法。depth 1 = 1回の仮定、depth 2 = 仮定の中でもう1回仮定する（2段の仮定）
      const whatOf = (w) => !w ? "矛盾が出ます"
        : w.kind === "cell" ? `${cellNm(w.i)}に入る数字がなくなります`
        : `${unitNm(w.unit % 3, Math.floor(w.unit / 3))}に「${w.d}」を入れるマスがなくなります`;
      const cellOf = (w) => (w && w.kind === "cell" ? [w.i] : []);
      const deep = pg.depth === 2;
      const basis = [{ cells: [pg.i], g: 0 }, ...(deep ? [{ cells: [pg.j], g: 1 }] : [{ cells: cellOf(pg.why), g: 1 }])];
      drawPathBoard(pg.before, { gone: pg.gone.map((x) => ({ ...x, g: 0 })), basis, given });
      pathHead.textContent = `${no}　背理法${deep ? "（2段の仮定）" : ""}（${"★".repeat(TECH_LV["背理法"])}）`;
      const all = digitsOf(pg.before.cand[pg.i]);
      pathSection("解法", "ほかの解法で進めないため、仮に数字を置いて矛盾が起こるか調べる背理法を使います。");
      pathSection("注目する場所", esc(`${cellNm(pg.i)}の候補「${all.join("・")}」を調べます。`));
      let proofExplanation;
      if (!deep) {
        proofExplanation = `もし${esc(cellNm(pg.i))}（${sw(0)}）が「${pg.d}」なら、推論を進めると${esc(whatOf(pg.why))}${cellOf(pg.why).length ? `（${sw(1)}）` : ""}。`;
      } else {
        proofExplanation = `もし${esc(cellNm(pg.i))}（${sw(0)}）が「${pg.d}」なら、推論後に${esc(cellNm(pg.j))}（${sw(1)}）は「${pg.a}」か「${pg.b}」になります。` +
          esc(`さらに仮定すると「${pg.a}」なら${whatOf(pg.whyA)}、「${pg.b}」なら${whatOf(pg.whyB)}。両方で矛盾します。`);
      }
      const rest = pg.left || [];
      const result = esc(`このため、${cellNm(pg.i)}の「${pg.d}」を候補から除外します` + (rest.length === 1 ? `。残る「${rest[0]}」に確定します。` : `（残りは「${rest.join("・")}」）。`));
      pathSection("実行する操作", proofExplanation + " " + result);
      // 仮定後の実際の推論手順。各ボタンでその直後の盤面を確認できる。
      const branches = deep
        ? [{ key: "outer", title: "最初の仮定からの推論", steps: pg.outerTrace || [] },
           { key: "a", title: `2段目「${pg.a}」の場合`, steps: pg.traceA || [] },
           { key: "b", title: `2段目「${pg.b}」の場合`, steps: pg.traceB || [] }]
        : [{ key: "main", title: "仮定から矛盾までの推論", steps: pg.trace || [] }];
      const detail = document.createElement("details");
      detail.className = "path-proof";
      detail.open = !!pathProofActive;
      const caption = document.createElement("summary");
      caption.textContent = "矛盾に至る途中の手順を表示";
      detail.appendChild(caption);
      for (const branch of branches) {
        const h = document.createElement("p");
        h.className = "path-proof-label";
        h.textContent = branch.title;
        detail.appendChild(h);
        if (!branch.steps.length) {
          const empty = document.createElement("p");
          empty.textContent = "仮定直後に矛盾が見つかりました。";
          detail.appendChild(empty);
        }
        branch.steps.forEach((step, i) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "path-proof-step";
          btn.dataset.proofBranch = branch.key;
          btn.dataset.proofStep = String(i);
          btn.textContent = `${i + 1}. ${step.kind === "single" ? `${cellNm(step.i)}を「${step.d}」に確定` : `${step.tech || "候補除外"}：${cellNm(step.i)}の「${digitsOf(step.m).join("・")}」を除外`}`;
          btn.setAttribute("aria-pressed", String(!!pathProofActive && pathProofActive.branch === branch.key && pathProofActive.index === i));
          detail.appendChild(btn);
        });
      }
      pathText.appendChild(detail);
      if (pathProofActive) {
        const active = branches.find((x) => x.key === pathProofActive.branch);
        const step = active && active.steps[pathProofActive.index];
        if (step) drawPathBoard(step.before, {
          given,
          placed: step.kind === "single" ? [{ i: step.i, d: step.d, g: 0 }] : [],
          gone: step.kind === "elim" ? [{ i: step.i, m: step.m, g: 0 }] : [],
          basis: [{ cells: step.kind === "elim" ? step.basis || [] : [step.i], g: 0 }]
        });
      }

    } else if (pg.kind === "answer") {
      drawPathBoard(pg.before, { placed: [{ i: pg.i, d: pg.d, g: 0 }], given });
      pathHead.textContent = `${no}　正解から決める`;
      pathSection("解法", "正解データからの補完です。論理的に導いた手順ではありません。");
      pathSection("注目する場所", esc(cellNm(pg.i)));
      pathSection("実行する操作", esc(`${cellNm(pg.i)}を「${pg.d}」に確定します。`));
    }
  }
