  // ===== 16-generator.js：問題を自動で作る画面・最難関の作り置き・起動するときの設定 =====
  // （src/js/ の全ファイルで1つの (function () { … })(); になる。まとめ方は tools/build.py）
  // 問題を自動で作る: レベルを選ぶと裏で作り、一覧に保存して開く。最難関は時間がかかるので、アプリを開いている間に裏で作ってストックしておく
  const GEN_STOCK_KEY = "sudoku-gen-stock8", GEN_STOCK_MAX = 10;  // 背理法の手順が変わったので、新しい判定で作り置きする
  try { localStorage.removeItem("sudoku-gen-stock"); localStorage.removeItem("sudoku-gen-stock2"); localStorage.removeItem("sudoku-gen-stock3"); localStorage.removeItem("sudoku-gen-stock4"); localStorage.removeItem("sudoku-gen-stock5"); localStorage.removeItem("sudoku-gen-stock6"); localStorage.removeItem("sudoku-gen-stock7"); } catch (e) {}
  // 難易度の説明文は 01a-levels.js の DIFFICULTIES と TECHNIQUES から作る（レベルを変えると説明もそろって変わる）
  const genLevels = DIFFICULTIES.map((d, i) => {
    const lo = i ? DIFFICULTIES[i - 1].maxLv + 1 : 1;
    if (i === 0) return { label: d.label, desc: "「このマスにはこの数字しか入らない」を見つけるだけで解けます" };
    if (d.maxGivens) return { label: d.label, desc: `問題の数字は${d.maxGivens}個以下。背理法以外の解き方では${d.minLeft}マス以上が残り、仮に置いて矛盾したら消す、が必要です。★${d.highLv}つ以上の解き方を${d.minHighSteps}回以上使います` };
    const names = TECHNIQUES.filter((t) => t.lv >= lo && t.lv <= d.maxLv).map((t) => t.name).join("、");
    const stars = lo === d.maxLv ? `★${lo}つ` : `★${lo}〜${d.maxLv}つ`;
    const noContra = DIFFICULTIES[i + 1] && DIFFICULTIES[i + 1].maxGivens ? "（背理法はいりません）" : "";
    return { label: d.label, desc: `${stars}の解き方（${names}）が必要です${noContra}` };
  });
  const genBox = document.getElementById("gen-box"), genMsg = document.getElementById("gen-msg"), genLevelsEl = document.getElementById("gen-levels");
  // 初級・中級・難問は、問題の数字の数を選べる（17〜25個、はじめは22個）。最難関は DIFFICULTIES の maxGivens 個以下のまま
  const GEN_COUNT_KEY = "sudoku-gen-count", GEN_COUNT_MIN = 17, GEN_COUNT_MAX = 25, GEN_COUNT_DEFAULT = 22;
  const GEN_LOW_KEY = "sudoku-gen-low1", GEN_LOW_MAX = 20, GEN_LOW_PER = 10;  // 20個以下の作り置き（下の genLow）
  const genCountEl = document.getElementById("gen-count"), genCountNote = document.getElementById("gen-count-note"), genBestBtn = document.getElementById("gen-best");
  for (let n = GEN_COUNT_MIN; n <= GEN_COUNT_MAX; n++) {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = `${n}個`;
    genCountEl.appendChild(o);
  }
  const genCount = () => {
    let n = GEN_COUNT_DEFAULT;
    try { n = +localStorage.getItem(GEN_COUNT_KEY) || GEN_COUNT_DEFAULT; } catch (e) {}
    return Math.min(GEN_COUNT_MAX, Math.max(GEN_COUNT_MIN, n));
  };
  function drawGenCountNote() {
    const n = +genCountEl.value;
    const top = DIFFICULTIES[DIFFICULTIES.length - 1];
    const slow = n <= 19 ? "19個以下はとても少なく、何分もかかったり見つからなかったりします。いちばん近い問題で始めることもできます。"
      : n <= 21 ? "20〜21個は、作るのに数十秒〜数分かかることがあります。"
      : "";
    const stock = n <= GEN_LOW_MAX ? `アプリを開いている間、${GEN_LOW_MAX}個以下の問題を裏で作り置きしています。ちょうどの数があればすぐに開きます。` : "";
    genCountNote.textContent = `${slow}${stock}${top.label}はいつも${top.maxGivens}個以下です。`;
  }
  genCountEl.value = String(genCount());
  drawGenCountNote();
  genCountEl.addEventListener("change", () => {
    try { localStorage.setItem(GEN_COUNT_KEY, genCountEl.value); } catch (e) {}
    drawGenCountNote();
  });
  const genStock = (list) => {
    try {
      if (list) localStorage.setItem(GEN_STOCK_KEY, JSON.stringify(list.slice(0, GEN_STOCK_MAX)));
      const a = JSON.parse(localStorage.getItem(GEN_STOCK_KEY) || "[]");
      return Array.isArray(a) ? a.filter((g) => /^[0-9]{81}$/.test(g)) : [];
    } catch (e) { return []; }
  };
  // 裏の計算（Worker）。使えないときは画面側で少しずつ計算する
  let genWorker = null;
  const genHandlers = [];
  function onGen(m) { genHandlers.forEach((h) => h(m)); }
  const sent = [];  // Worker が途中で使えなくなったときに、画面側で同じ頼みごとをやり直すため
  function genOnPage() {
    const fake = { postMessage: (m) => setTimeout(() => onGen(m), 0), onmessage: null };
    sudokuGen(fake, GEN_RULES);
    genWorker = { postMessage: (m) => setTimeout(() => fake.onmessage({ data: m }), 0) };
    sent.forEach((m) => genWorker.postMessage(m));
  }
  try {
    const w = new Worker(URL.createObjectURL(new Blob([`(${sudokuGen})(self, ${JSON.stringify(GEN_RULES)})`], { type: "text/javascript" })));
    w.onmessage = (e) => onGen(e.data);
    w.onerror = () => { w.terminate(); genOnPage(); };
    genWorker = { postMessage: (m) => { sent.push(m); if (sent.length > 50) sent.shift(); w.postMessage(m); } };
  } catch (e) { genOnPage(); }
  const genHunt = () => genWorker.postMessage({ type: "hunt", on: genStock().length < GEN_STOCK_MAX });
  // 初級・中級・難問の、問題の数字が LOW_MAX 個以下の作り置き（作るのに時間がかかるので、最難関と同じく裏で作っておく）
  // [{ l: レベル, g: 81桁 }]。レベルごとに GEN_LOW_PER 問まで、数字の少ないものを残す
  const givensN = (g) => [...g].filter((c) => c !== "0").length;
  const genLow = (list) => {
    try {
      if (list) localStorage.setItem(GEN_LOW_KEY, JSON.stringify(list));
      const a = JSON.parse(localStorage.getItem(GEN_LOW_KEY) || "[]");
      return Array.isArray(a) ? a.filter((x) => x && x.l >= 1 && x.l < DIFFICULTIES.length && /^[0-9]{81}$/.test(x.g)) : [];
    } catch (e) { return []; }
  };
  const genLowOf = (level) => genLow().filter((x) => x.l === level);
  // 作り置きがまだ GEN_LOW_PER 問ないレベルだけ探す（たまったら止める。使うとまた探す）
  const genHuntLow = () => {
    const levels = [];
    for (let l = 1; l < DIFFICULTIES.length; l++) if (genLowOf(l).length < GEN_LOW_PER) levels.push(l);
    genWorker.postMessage({ type: "hunt-low", levels, max: GEN_LOW_MAX });
  };
  genHandlers.push((m) => {
    if (m.type !== "stock-low") return;
    const list = genLow();
    if (list.some((x) => x.g === m.givens)) return;
    const mine = [...list.filter((x) => x.l === m.level), { l: m.level, g: m.givens }].sort((a, b) => givensN(a.g) - givensN(b.g)).slice(0, GEN_LOW_PER);
    genLow([...list.filter((x) => x.l !== m.level), ...mine]);
    genHuntLow();
    if (!genBox.hidden && !genWaiting) drawGenLevels();
  });
  const lowSummary = (level) => {
    const by = {};
    genLowOf(level).forEach((x) => { const n = givensN(x.g); by[n] = (by[n] || 0) + 1; });
    const parts = Object.keys(by).sort((a, b) => a - b).map((n) => `${n}個×${by[n]}`);
    return `（${GEN_LOW_MAX}個以下の作り置き ${genLowOf(level).length}問${parts.length ? "：" + parts.join("・") : ""}）`;
  };
  genHandlers.push((m) => {
    if (m.type !== "stock") return;
    const list = genStock();
    if (list.length < GEN_STOCK_MAX && !list.includes(m.givens)) genStock([...list, m.givens]);
    genHunt();
    drawGenLevels();
  });
  let genWaiting = null, genSeq = 0;
  function drawGenLevels() {
    genLevelsEl.textContent = "";
    genLevels.forEach((lv, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = lv.label;
      const sm = document.createElement("small");
      sm.textContent = lv.desc + (i === DIFFICULTIES.length - 1 ? `（作り置き ${genStock().length}問）` : lowSummary(i + 1));
      b.appendChild(sm);
      b.disabled = !!genWaiting;
      if (genWaiting && genWaiting.level === i + 1) b.classList.add("busy");
      b.addEventListener("click", () => makeProblem(i + 1));
      genLevelsEl.appendChild(b);
    });
    genCountEl.disabled = !!genWaiting;
  }
  function finishGen(level, givens) {
    genWaiting = null;
    genBox.hidden = true;
    genBestBtn.hidden = true;
    const d = new Date(), p2 = (n) => String(n).padStart(2, "0");
    const n = [...givens].filter((c) => c !== "0").length;
    const base = `${genLevels[level - 1].label}（${n}個） ${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${p2(d.getMinutes())}`;
    const list = loadAll();
    let name = base;
    for (let i = 2; list.some((q) => q.name === name); i++) name = `${base} (${i})`;
    const p = { name, givens, saved: d.toISOString() };
    list.push(p);
    saveAll(list);
    openProblem(p);
  }
  function makeProblem(level) {
    if (level === 4) {
      const list = genStock();
      if (list.length) {
        genStock(list.slice(1));
        genHunt();
        return finishGen(4, list[0]);
      }
    }
    const target = level === 4 ? 0 : +genCountEl.value;
    // 20個以下を選んだときは、作り置きにちょうどの数があればそれを使う。なければ作りながら、作り置きのいちばん近いものも選べるようにする
    let fromStock = null;
    if (level < 4 && target <= GEN_LOW_MAX) {
      const mine = genLowOf(level);
      const exact = mine.find((x) => givensN(x.g) === target);
      if (exact) { takeLow(exact.g); genHuntLow(); return finishGen(level, exact.g); }
      fromStock = mine.filter((x) => givensN(x.g) > target).sort((a, b) => givensN(a.g) - givensN(b.g))[0] || null;
    }
    const id = ++genSeq;
    genWaiting = { id, level, target, start: Date.now(), best: null, bestN: 0, bestStock: false };
    genMsg.classList.remove("err");
    genBestBtn.hidden = true;
    if (fromStock) setGenBest(fromStock.g, givensN(fromStock.g), true);
    genMsg.textContent = level === 4
      ? "最難関の問題を作っています。見つかるまで時間がかかることがあります（この画面のままお待ちください）…"
      : `${genLevels[level - 1].label}・数字${target}個の問題を作っています…`;
    drawGenLevels();
    genWorker.postMessage(level === 4 ? { type: "hunt", on: true } : { type: "make", id, level, target });
  }
  // 数を指定して作っている間の様子（1秒ごと）。ちょうどの数が見つからないうちは、いちばん近い問題で始めるボタンを出す
  genHandlers.push((m) => {
    if (m.type !== "progress" || !genWaiting || m.id !== genWaiting.id) return;
    const w = genWaiting, sec = Math.round((Date.now() - w.start) / 1000);
    const time = sec >= 60 ? `${Math.floor(sec / 60)}分${sec % 60}秒` : `${sec}秒`;
    if (m.bestN && m.bestGivens && (!w.bestN || m.bestN < w.bestN)) setGenBest(m.bestGivens, m.bestN, false);
    genMsg.textContent = `${genLevels[w.level - 1].label}・数字${w.target}個の問題を作っています…（${time}・${m.tries}回試しました）`
      + (w.bestN ? `\nまだ${w.target}個のものは見つかっていません。いちばん近いのは${w.bestN}個の問題です。` : "");
  });
  function setGenBest(givens, n, stock) {
    const w = genWaiting;
    w.best = givens; w.bestN = n; w.bestStock = stock;
    genBestBtn.textContent = `${n}個の問題で始める${stock ? "（作り置き）" : ""}`;
    genBestBtn.hidden = false;
  }
  const takeLow = (g) => genLow(genLow().filter((x) => x.g !== g));
  genBestBtn.addEventListener("click", () => {
    const w = genWaiting;
    if (!w || !w.best) return;
    genWorker.postMessage({ type: "cancel", id: w.id });
    if (w.bestStock) { takeLow(w.best); genHuntLow(); }
    finishGen(w.level, w.best);
  });
  genHandlers.push((m) => {
    if (!genWaiting) return;
    if (m.type === "made" && m.id === genWaiting.id) return finishGen(m.level, m.givens);
    // 最難関を待っている間に見つかったら、ストックから取り出して開く
    if (m.type === "stock" && genWaiting.level === 4) {
      const list = genStock();
      if (list.length) { genStock(list.slice(1)); genHunt(); finishGen(4, list[0]); }
    }
  });
  function closeGen() {
    if (genWaiting && genWaiting.level !== 4) genWorker.postMessage({ type: "cancel", id: genWaiting.id });
    genWaiting = null;
    genMsg.textContent = "";
    genBestBtn.hidden = true;
    genBox.hidden = true;
  }
  // 1段目: 自分で入力するか自動で作成するか。自動を選ぶと2段目でレベルを選ぶ
  const genStep = (n) => {
    document.getElementById("gen-step1").hidden = n !== 1;
    document.getElementById("gen-step2").hidden = n !== 2;
    (n === 1 ? document.getElementById("gen-self") : genLevelsEl.querySelector("button")).focus();
  };
  document.getElementById("gen-self").addEventListener("click", () => { closeGen(); startRegister(); });
  document.getElementById("gen-auto").addEventListener("click", () => { drawGenLevels(); genStep(2); });
  document.getElementById("new").addEventListener("click", () => startRegister());
  document.getElementById("new-auto").addEventListener("click", () => {
    genMsg.textContent = "";
    drawGenLevels();
    genBox.hidden = false;
    genStep(2);
  });
  document.getElementById("gen-close").addEventListener("click", closeGen);
  // アプリを開いている間は、最難関の作り置きを続ける（10問たまったら止める）
  genHunt();
  genHuntLow();

  showStart("home");
  // 前回、解いている途中で閉じた場合は一時停止の状態で続きを開く（ガイドの写真のお試しから戻ったときも）
  function resumeSaved() {
    try {
      const cur = JSON.parse(localStorage.getItem(CUR_KEY) || "null");
      if (!cur) return;
      restoring = true;
      openProgressData(cur, "回答中");
      restoring = false;
      if (board.dataset.mode === "paused") { setPausedPrompt("（前回の続き）"); setPauseLock(true); }
      else { clearAutoSave(); showStart("home"); }
    } catch (e) { restoring = false; }
  }
  // 起動するときの設定: 一時停止中の問題を回答画面で開く（resume・はじめから）か、ホームメニューを出す（home）か
  const RESUME_KEY = "sudoku-start-resume";
  const startResume = () => { try { return localStorage.getItem(RESUME_KEY) !== "home"; } catch (e) { return true; } };
