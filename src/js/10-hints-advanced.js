  // ===== 10-hints-advanced.js：上級のヒント（Xウイング・ソードフィッシュ・スカイスクレイパー・XY/XYZウイング・カラーリング・チェーン・唯一解の原則・背理法など） =====
  // （src/js/ の全ファイルで1つの (function () { … })(); になる。まとめ方は tools/build.py）
  // ===== 上級のヒント（3つ・4つの組、ソードフィッシュ、スカイスクレイパー、XY/XYZウイング、リモートペア、XYチェーン、背理法） =====
  // マスは i = 行*9+列 で表す。盤の DOM の並びは行順ではないので、必ず data-row / data-col から作る
  const DIGS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  const BOX_NAMES = ["左上", "上", "右上", "左", "真ん中", "右", "左下", "下", "右下"];
  const rowOf = (i) => Math.floor(i / 9), colOf = (i) => i % 9;
  const boxOf = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);
  const sees = (i, j) => i !== j && (rowOf(i) === rowOf(j) || colOf(i) === colOf(j) || boxOf(i) === boxOf(j));
  const UNITS = [];
  for (let k = 0; k < 9; k++) UNITS.push({ name: `${k + 1}行目`, ids: [...Array(9)].map((_, c) => k * 9 + c) });
  for (let k = 0; k < 9; k++) UNITS.push({ name: `${k + 1}列目`, ids: [...Array(9)].map((_, r) => r * 9 + k) });
  for (let k = 0; k < 9; k++) UNITS.push({ name: `${BOX_NAMES[k]}のブロック`, ids: [...Array(81).keys()].filter((i) => boxOf(i) === k) });
  const cellName = (i) => `${rowOf(i) + 1}行${colOf(i) + 1}列`;
  const combos = (arr, k) => {
    const out = [];
    const go = (s, ch) => { if (ch.length === k) { out.push(ch); return; } for (let i = s; i < arr.length; i++) go(i + 1, [...ch, arr[i]]); };
    go(0, []);
    return out;
  };
  // 今の盤の状態：確定している数字（問題の数字・確定候補）と、各マスに入れられる候補
  function hintState() {
    if (board.dataset.mode !== "solve") return null;
    markConflicts();
    const el = [];
    board.querySelectorAll(".cell").forEach((o) => { el[+o.dataset.row * 9 + +o.dataset.col] = o; });
    const fixed = el.map((o) => o.dataset.value || (o.classList.contains("tent") ? o.querySelector(".big").textContent : ""));
    const cand = el.map((o, i) => fixed[i] ? [] : DIGS.filter((d) => !o.querySelector(`.cand[data-n="${d}"]`).classList.contains("off")
      && !fixed.some((v, j) => v === d && sees(i, j))));
    return { el, fixed, cand };
  }
  // groups: [{ marks: [[i, d], ...] }] を組ごとの色で、gone: [[i, d], ...] を赤い枠で、order: 鎖の順番の番号
  function paintHint(st, groups, gone, msg, extra = {}) {
    countHint();
    groups.forEach((g, n) => {
      const color = g.color || PAIR_COLORS[n % PAIR_COLORS.length];
      for (const [i, d] of g.marks) {
        const c = st.el[i].querySelector(`.cand[data-n="${d}"]`);
        if (c.classList.contains("pgrp")) { c.classList.add("pgrp2"); c.style.setProperty("--pg2", color); continue; }
        c.classList.add("pgrp");
        c.style.setProperty("--pg", color);
      }
    });
    for (const [i, d] of gone) st.el[i].querySelector(`.cand[data-n="${d}"]`).classList.add("hint");
    (extra.order || []).forEach((i, n) => { st.el[i].dataset.chainNo = n + 1; });
    (extra.cells || []).forEach((i) => st.el[i].classList.add("hint-cell"));
    renderPad();
    workMsg.classList.remove("err");
    workMsg.textContent = "ヒント：" + msg;
  }
  const noHint = (name) => { workMsg.classList.remove("err"); workMsg.textContent = `ヒント：今は${name}で消せる候補はありません。`; };
  const KNUM = { 3: "3つ", 4: "4つ" };

  // 3つ・4つの数字の組（隠れた組とネイキッドの組）。消せる候補があるものだけを出す
  function showSubsets(k) {
    const st = hintState();
    if (!st) return;
    const { cand } = st;
    const found = [], seen = new Set();
    for (const u of UNITS) {
      const empt = u.ids.filter((i) => cand[i].length);
      // 隠れた組：k個の数字が、この単位でちょうどk マスにしか入らない → そのk マスのほかの候補は消せる
      const spots = {};
      for (const d of DIGS) spots[d] = empt.filter((i) => cand[i].includes(d));
      const ds = DIGS.filter((d) => spots[d].length >= 2 && spots[d].length <= k);
      for (const ch of combos(ds, k)) {
        const where = [...new Set(ch.flatMap((d) => spots[d]))];
        if (where.length !== k) continue;
        let smaller = false;
        for (let m = 2; m < k && !smaller; m++) for (const sub of combos(ch, m)) if (new Set(sub.flatMap((d) => spots[d])).size === m) { smaller = true; break; }
        if (smaller) continue;
        const gone = where.flatMap((i) => cand[i].filter((d) => !ch.includes(d)).map((d) => [i, d]));
        if (!gone.length) continue;
        const key = "H" + ch.join("") + where.sort((a, b) => a - b).join(",");
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({ hidden: true, marks: where.flatMap((i) => ch.filter((d) => cand[i].includes(d)).map((d) => [i, d])), gone });
      }
      // ネイキッドの組：k マスの候補を合わせると、ちょうどk個の数字 → その数字は、この単位のほかのマスから消せる
      const small = empt.filter((i) => cand[i].length <= k);
      for (const ch of combos(small, k)) {
        const uni = [...new Set(ch.flatMap((i) => cand[i]))].sort();
        if (uni.length !== k) continue;
        let smaller = false;
        for (let m = 2; m < k && !smaller; m++) for (const sub of combos(ch, m)) if (new Set(sub.flatMap((i) => cand[i])).size === m) { smaller = true; break; }
        if (smaller) continue;
        const gone = empt.filter((i) => !ch.includes(i)).flatMap((i) => cand[i].filter((d) => uni.includes(d)).map((d) => [i, d]));
        if (!gone.length) continue;
        const key = "N" + uni.join("") + ch.join(",");
        const old = found.find((f) => f.key === key);
        if (old) { old.gone.push(...gone); continue; }
        found.push({ hidden: false, key, marks: ch.flatMap((i) => cand[i].map((d) => [i, d])), gone });
      }
    }
    if (!found.length) return noHint(`${KNUM[k]}の数字の組`);
    const nh = found.filter((f) => f.hidden).length, nn = found.length - nh;
    const parts = [];
    if (nh) parts.push(`隠れた${KNUM[k]}の組（${nh}組）：同じ色の${k}つの数字は、その行・列・ブロックで色の付いた${k}マスにしか入りません。その${k}マスのほかの候補（赤い枠）は消せます。`);
    if (nn) parts.push(`ネイキッド${KNUM[k]}の組（${nn}組）：同じ色の${k}マスには、色の付いた${k}つの数字しか入りません。同じ行・列・ブロックのほかのマスにある同じ数字（赤い枠）は消せます。`);
    paintHint(st, found, found.flatMap((f) => f.gone), parts.join("　"));
  }

  // ソードフィッシュ：ある数字が、3つの行でどれも同じ3列（の中）にしか入らない → その3列のほかの行の同じ数字は消せる（行と列を入れ替えても同じ）
  function showSwordfish() {
    const st = hintState();
    if (!st) return;
    const { cand } = st;
    const found = [];
    for (const d of DIGS) for (const byRow of [true, false]) {
      const at = (line, k) => (byRow ? line * 9 + k : k * 9 + line);
      const lines = [];
      for (let line = 0; line < 9; line++) {
        const ks = [...Array(9).keys()].filter((k) => cand[at(line, k)].includes(d));
        if (ks.length >= 2 && ks.length <= 3) lines.push({ line, ks });
      }
      for (const ch of combos(lines, 3)) {
        const ks = [...new Set(ch.flatMap((x) => x.ks))];
        if (ks.length !== 3) continue;
        if (combos(ch, 2).some((p) => new Set(p.flatMap((x) => x.ks)).size === 2)) continue; // Xウイングで分かるもの
        const ls = ch.map((x) => x.line);
        const gone = [];
        for (let line = 0; line < 9; line++) if (!ls.includes(line)) for (const k of ks) if (cand[at(line, k)].includes(d)) gone.push([at(line, k), d]);
        if (gone.length) found.push({ marks: ch.flatMap((x) => x.ks.map((k) => [at(x.line, k), d])), gone, d, byRow });
      }
    }
    if (!found.length) return noHint("ソードフィッシュ");
    const ds = [...new Set(found.map((x) => `「${x.d}」`))].join("");
    paintHint(st, found, found.flatMap((f) => f.gone), `同じ色の${ds}がソードフィッシュです（${found.length}組）。3つの行（または列）で、その数字は色の付いた3列（または3行）の中にしか入りません。なので、その3列（3行）のほかのマスにある同じ数字（赤い枠）は消せます。`);
  }

  // スカイスクレイパー：ある数字が2か所にしか入らない行が2本あり、片方の端が同じ列にそろう → もう片方の端どうしの両方から見えるマスの同じ数字は消せる
  function showSkyscraper() {
    const st = hintState();
    if (!st) return;
    const { cand } = st;
    const found = [];
    for (const d of DIGS) for (const byRow of [true, false]) {
      const at = (line, k) => (byRow ? line * 9 + k : k * 9 + line);
      const two = [];
      for (let line = 0; line < 9; line++) {
        const ks = [...Array(9).keys()].filter((k) => cand[at(line, k)].includes(d));
        if (ks.length === 2) two.push({ line, ks });
      }
      for (const [a, b] of combos(two, 2)) {
        const base = a.ks.filter((k) => b.ks.includes(k));
        if (base.length !== 1) continue;
        const ta = at(a.line, a.ks.find((k) => k !== base[0])), tb = at(b.line, b.ks.find((k) => k !== base[0]));
        const four = [at(a.line, base[0]), at(b.line, base[0]), ta, tb];
        const gone = [...Array(81).keys()].filter((i) => !four.includes(i) && sees(i, ta) && sees(i, tb) && cand[i].includes(d)).map((i) => [i, d]);
        if (gone.length) found.push({ marks: four.map((i) => [i, d]), gone, d });
      }
    }
    if (!found.length) return noHint("スカイスクレイパー");
    const ds = [...new Set(found.map((x) => `「${x.d}」`))].join("");
    paintHint(st, found, found.flatMap((f) => f.gone), `同じ色の4マスの${ds}がスカイスクレイパーです（${found.length}組）。2つの行（または列）で、その数字は2か所にしか入らず、片方の端が同じ列（行）にそろっています。そろっていない側の2マスのどちらかには必ずその数字が入るので、その両方から見えるマスの同じ数字（赤い枠）は消せます。`);
  }

  // シンプルカラーリング：ある数字が2か所にしか入らない行・列・ブロックをたどって、交互に2色で塗る。どちらか一方の色が正解
  // ・同じ色の2マスが同じ行・列・ブロックにある → その色は正解ではないので、その色の数字は全部消せる
  // ・両方の色から見えるマス → どちらかの色が正解なので、そのマスの同じ数字は消せる
  function showColoring() {
    const st = hintState();
    if (!st) return;
    const { cand } = st;
    for (const d of DIGS) {
      const has = (i) => cand[i].includes(d);
      const link = [...Array(81)].map(() => []);
      for (const u of UNITS) {
        const w = u.ids.filter(has);
        if (w.length === 2) { link[w[0]].push(w[1]); link[w[1]].push(w[0]); }
      }
      const color = new Array(81).fill(-1);
      for (let s0 = 0; s0 < 81; s0++) {
        if (color[s0] >= 0 || !link[s0].length) continue;
        const comp = [s0];
        color[s0] = 0;
        for (let q = 0; q < comp.length; q++) for (const n of link[comp[q]]) if (color[n] < 0) { color[n] = 1 - color[comp[q]]; comp.push(n); }
        if (comp.length < 3) continue;
        const side = [comp.filter((i) => color[i] === 0), comp.filter((i) => color[i] === 1)];
        const marks = side.map((cs, k) => ({ marks: cs.map((i) => [i, d]), color: PAIR_COLORS[k] }));
        const names = ["1色目", "2色目"];
        // 同じ色どうしが見えている
        for (const k of [0, 1]) {
          if (!combos(side[k], 2).some(([a, b]) => sees(a, b))) continue;
          return paintHint(st, marks, side[k].map((i) => [i, d]),
            `「${d}」のシンプルカラーリングです。「${d}」が2か所にしか入らない行・列・ブロックをたどって、交互に2色で塗りました（どちらか一方の色が正解）。${names[k]}のマスどうしが同じ行・列・ブロックにあるので、${names[k]}は正解ではありません。${names[k]}の「${d}」（赤い枠）は消せます。`);
        }
        // 両方の色から見えるマス
        const gone = [...Array(81).keys()].filter((i) => has(i) && color[i] < 0 && side[0].some((a) => sees(a, i)) && side[1].some((b) => sees(b, i))).map((i) => [i, d]);
        if (gone.length) return paintHint(st, marks, gone,
          `「${d}」のシンプルカラーリングです。「${d}」が2か所にしか入らない行・列・ブロックをたどって、交互に2色で塗りました。どちらか一方の色が必ず正解なので、両方の色から見えるマスの「${d}」（赤い枠）は消せます。`);
      }
    }
    noHint("シンプルカラーリング");
  }

  // XYウイング（Y-Wing）：軸のマスが候補AB、それが見える2マスがAC・BC → その2マスの両方から見えるマスのCは消せる
  // XYZウイング：軸のマスが候補ABC、それが見える2マスがAC・BC → 3マスすべてから見えるマスのCは消せる
  function showWing(xyz) {
    const st = hintState();
    if (!st) return;
    const { cand } = st;
    const found = [], seen = new Set();
    const bi = [...Array(81).keys()].filter((i) => cand[i].length === 2);
    for (let p = 0; p < 81; p++) {
      if (cand[p].length !== (xyz ? 3 : 2)) continue;
      const wings = bi.filter((i) => sees(i, p) && cand[i].every((d) => xyz ? cand[p].includes(d) : true));
      for (const [x, y] of combos(wings, 2)) {
        let z;
        if (xyz) {
          const c = cand[x].filter((d) => cand[y].includes(d));
          if (c.length !== 1 || new Set([...cand[x], ...cand[y]]).size !== 3) continue;
          z = c[0];
        } else {
          const [a, b] = cand[p];
          const xa = cand[x].includes(a) && !cand[x].includes(b), yb = cand[y].includes(b) && !cand[y].includes(a);
          const xb = cand[x].includes(b) && !cand[x].includes(a), ya = cand[y].includes(a) && !cand[y].includes(b);
          if (!((xa && yb) || (xb && ya))) continue;
          const zx = cand[x].find((d) => d !== a && d !== b), zy = cand[y].find((d) => d !== a && d !== b);
          if (!zx || zx !== zy) continue;
          z = zx;
        }
        const gone = [...Array(81).keys()].filter((i) => i !== p && i !== x && i !== y && sees(i, x) && sees(i, y) && (!xyz || sees(i, p)) && cand[i].includes(z)).map((i) => [i, z]);
        const key = [p, x, y].sort((m, n) => m - n).join(",") + z;
        if (!gone.length || seen.has(key)) continue;
        seen.add(key);
        found.push({ marks: [p, x, y].flatMap((i) => cand[i].map((d) => [i, d])), gone, z, p });
      }
    }
    const name = xyz ? "XYZウイング" : "XYウイング";
    if (!found.length) return noHint(name);
    const f = found[0];
    paintHint(st, [f], f.gone, xyz
      ? `色の付いた3マスがXYZウイングです。番号①の軸のマス（候補3つ）と、それが見える2マス（候補2つ）を合わせると、どれかに必ず「${f.z}」が入ります。なので、3マスすべてから見えるマスの「${f.z}」（赤い枠）は消せます。${found.length > 1 ? `（ほかにも${found.length - 1}組あります）` : ""}`
      : `色の付いた3マスがXYウイングです。番号①の軸のマスがどちらの数字になっても、両端のどちらかが「${f.z}」になります。なので、両端の2マスの両方から見えるマスの「${f.z}」（赤い枠）は消せます。${found.length > 1 ? `（ほかにも${found.length - 1}組あります）` : ""}`,
      { order: [f.p] });
  }

  // リモートペア：候補が同じ2つ（AB）のマスが、互いに見える形で4つ以上つながる。つながりの順に交互にA・Bになるので、
  // 交互の反対側どうしの両方から見えるマスのA・Bは消せる
  // 唯一解の原則（ユニークレクタングル）：2つのブロックにまたがる長方形の4マスが、どれも同じ2つの候補 a・b だけになると、
  // a と b を入れ替えても成り立ち、答えが2通りになってしまう。問題の答えは1通りなので、そうならないように候補を消せる
  // タイプ1：3マスが a・b だけ → 残る1マスの a・b は消せる
  // タイプ2：2マスが a・b だけ、残る2マスが a・b・x（同じ x 1つ） → x はその2マスのどちらかに入るので、両方から見えるマスの x は消せる
  // タイプ4：2マスが a・b だけ、残る2マス（同じ行か列）では、その行（列）で a がこの2マスにしか入らない → この2マスの b は消せる
  function showUR() {
    const st = hintState();
    if (!st) return;
    const { cand } = st;
    const same = (i, a, b) => cand[i].length === 2 && cand[i].includes(a) && cand[i].includes(b);
    for (const [r1, r2] of combos([...Array(9).keys()], 2)) for (const [c1, c2] of combos([...Array(9).keys()], 2)) {
      const four = [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2];
      if (new Set(four.map(boxOf)).size !== 2 || four.some((i) => !cand[i].length)) continue;
      for (const [a, b] of combos(DIGS, 2)) {
        if (!four.every((i) => cand[i].includes(a) && cand[i].includes(b))) continue;
        const bi = four.filter((i) => same(i, a, b)), rest = four.filter((i) => !bi.includes(i));
        const where = four.map(cellName).join("・");
        const base = `${where}の4マスは、2つのブロックにまたがる長方形で、どれにも「${a}」と「${b}」の候補があります。もし4マスとも「${a}」「${b}」だけになると、入れ替えても成り立ち答えが2通りになってしまいます。問題の答えは1通りなので、そうはなりません。`;
        const marks = [{ marks: four.flatMap((i) => [[i, a], [i, b]]) }];
        if (bi.length === 3) {
          const t = rest[0];
          return paintHint(st, marks, [[t, a], [t, b]], `唯一解の原則（タイプ1）です。${base}3マスは「${a}」「${b}」だけなので、残る${cellName(t)}は「${a}」「${b}」以外の数字になります。${cellName(t)}の「${a}」「${b}」（赤い枠）は消せます。`, { cells: [t] });
        }
        if (bi.length !== 2) continue;
        const [p, q] = rest;
        if (rowOf(p) !== rowOf(q) && colOf(p) !== colOf(q)) continue; // 対角の2マスは対象外
        const xp = cand[p].filter((d) => d !== a && d !== b), xq = cand[q].filter((d) => d !== a && d !== b);
        if (xp.length === 1 && xq.length === 1 && xp[0] === xq[0]) {
          const x = xp[0];
          const gone = [...Array(81).keys()].filter((i) => i !== p && i !== q && cand[i].includes(x) && sees(i, p) && sees(i, q)).map((i) => [i, x]);
          if (gone.length) return paintHint(st, [...marks, { marks: [[p, x], [q, x]] }], gone, `唯一解の原則（タイプ2）です。${base}${cellName(p)}と${cellName(q)}のどちらかには必ず「${x}」が入ります。なので、この2マスの両方から見えるマスの「${x}」（赤い枠）は消せます。`);
        }
        const unit = UNITS.filter((u) => u.ids.includes(p) && u.ids.includes(q));
        for (const [d, e] of [[a, b], [b, a]]) {
          const u = unit.find((u) => u.ids.every((i) => i === p || i === q || !cand[i].includes(d)));
          if (!u) continue;
          return paintHint(st, [{ marks: four.flatMap((i) => [[i, a], [i, b]]) }, { marks: [[p, d], [q, d]] }], [[p, e], [q, e]], `唯一解の原則（タイプ4）です。${base}${u.name}では「${d}」が${cellName(p)}と${cellName(q)}にしか入らないので、どちらかが「${d}」になります。このとき、もう一方が「${e}」だと4マスが「${a}」「${b}」だけで埋まってしまいます。なので、この2マスの「${e}」（赤い枠）は消せます。`);
        }
      }
    }
    noHint("唯一解の原則");
  }
  function showRemotePair() {
    const st = hintState();
    if (!st) return;
    const { cand } = st;
    const done = new Set();
    for (let s = 0; s < 81; s++) {
      if (cand[s].length !== 2 || done.has(s)) continue;
      const pair = cand[s].join("");
      const color = new Map([[s, 0]]);
      const order = [s];
      let ok = true;
      for (let q = 0; q < order.length; q++) {
        const i = order[q];
        for (let j = 0; j < 81; j++) {
          if (cand[j].join("") !== pair || !sees(i, j)) continue;
          if (!color.has(j)) { color.set(j, 1 - color.get(i)); order.push(j); } else if (color.get(j) === color.get(i)) ok = false;
        }
      }
      order.forEach((i) => done.add(i));
      if (!ok || order.length < 4) continue;
      const c0 = order.filter((i) => color.get(i) === 0), c1 = order.filter((i) => color.get(i) === 1);
      const gone = [];
      for (let i = 0; i < 81; i++) {
        if (color.has(i) || !c0.some((j) => sees(i, j)) || !c1.some((j) => sees(i, j))) continue;
        for (const d of cand[s]) if (cand[i].includes(d)) gone.push([i, d]);
      }
      if (!gone.length) continue;
      const [a, b] = cand[s];
      return paintHint(st, [{ marks: c0.flatMap((i) => [[i, a], [i, b]]), color: PAIR_COLORS[0] }, { marks: c1.flatMap((i) => [[i, a], [i, b]]), color: PAIR_COLORS[1] }], gone,
        `候補が「${a}」「${b}」だけのマスが${order.length}つつながっています（リモートペア）。つながりに沿って「${a}」と「${b}」が交互に入るので、青のマスとオレンジのマスは必ず別の数字です。なので、青とオレンジの両方から見えるマスの「${a}」「${b}」（赤い枠）は消せます。`);
    }
    noHint("リモートペア");
  }

  // XYチェーン：候補が2つのマスを、同じ数字でつないでいく。最初のマスがZでないと、つないだ先の最後のマスがZになる
  // → 最初か最後のどちらかは必ずZなので、両方から見えるマスのZは消せる（4マス以上のもの。3マスはXYウイング）
  function showXYChain() {
    const st = hintState();
    if (!st) return;
    const { cand } = st;
    const bi = [...Array(81).keys()].filter((i) => cand[i].length === 2);
    const other = (i, d) => cand[i].find((x) => x !== d);
    let best = null;
    for (const s of bi) for (const z of cand[s]) {
      // 状態 = [マス, そのマスに入る数字]。最初のマスは z でない、つまり other(s, z)
      const start = [s, other(s, z)];
      const prev = new Map([[s + ":" + start[1], null]]);
      const queue = [start];
      for (let q = 0; q < queue.length; q++) {
        const [i, v] = queue[q];
        const path = [];
        for (let k = i + ":" + v; k; k = prev.get(k)) path.unshift(+k.split(":")[0]);
        if (best && path.length >= best.path.length) break;
        if (path.length > 12) break;
        for (const j of bi) {
          if (!sees(i, j) || !cand[j].includes(v) || path.includes(j)) continue;
          const w = other(j, v); // j は v ではないので、もう一方の数字
          const key = j + ":" + w;
          if (prev.has(key)) continue;
          prev.set(key, i + ":" + v);
          const np = [...path, j];
          if (w === z && np.length >= 4) {
            const gone = [...Array(81).keys()].filter((x) => !np.includes(x) && sees(x, s) && sees(x, j) && cand[x].includes(z)).map((x) => [x, z]);
            if (gone.length && (!best || np.length < best.path.length)) best = { path: np, z, gone };
          }
          queue.push([j, w]);
        }
      }
    }
    if (!best) return noHint("XYチェーン");
    const { path, z, gone } = best;
    const marks = path.flatMap((i) => cand[i].map((d) => [i, d]));
    paintHint(st, [{ marks }], gone,
      `番号の順に、候補が2つのマスが${path.length}つつながっています（XYチェーン）。①のマスが「${z}」でないとすると、隣どうしで同じ数字は入らないので順に決まっていき、最後のマスが「${z}」になります。つまり①か最後のマスのどちらかは必ず「${z}」なので、その両方から見えるマスの「${z}」（赤い枠）は消せます。`,
      { order: path });
  }

  // チェーン：「2か所にしか入らない数字」「候補が2つのマス」（片方が違えばもう片方が正しい）と
  // 「同じ行・列・ブロックの同じ数字」「同じマスのほかの数字」（片方が正しければもう片方は違う）を交互にたどる
  function showChain() {
    const st = hintState();
    if (!st) return;
    const { cand } = st;
    const strong = new Map();
    const link = (a, b) => { if (!strong.has(a)) strong.set(a, []); strong.get(a).push(b); };
    for (let i = 0; i < 81; i++) if (cand[i].length === 2) { const [a, b] = cand[i]; link(i * 10 + +a, i * 10 + +b); link(i * 10 + +b, i * 10 + +a); }
    for (const u of UNITS) for (const d of DIGS) { const w = u.ids.filter((i) => cand[i].includes(d)); if (w.length === 2) { link(w[0] * 10 + +d, w[1] * 10 + +d); link(w[1] * 10 + +d, w[0] * 10 + +d); } }
    const weak = (n) => {
      const i = Math.floor(n / 10), d = String(n % 10), r = [];
      for (let j = 0; j < 81; j++) if (sees(i, j) && cand[j].includes(d)) r.push(j * 10 + +d);
      for (const e of cand[i]) if (e !== d) r.push(i * 10 + +e);
      return r;
    };
    let best = null;
    for (let s0 = 0; s0 < 81; s0++) for (const sdS of cand[s0]) {
      const sd = +sdS, sn = s0 * 10 + sd;
      // 状態 = 候補*2 + (1: 正しい, 0: 違う)。始めの候補は「違う」とする
      const prev = new Map([[sn * 2, -1]]);
      let q = [sn * 2];
      for (let len = 1; len <= 12 && q.length && (!best || len < best.len); len++) {
        const nq = [];
        for (const stt of q) {
          const n = stt >> 1, on = stt & 1;
          for (const m of on ? [...weak(n), ...(strong.get(n) || [])] : strong.get(n) || []) {
            const ns = m * 2 + (on ? 0 : 1);
            if (prev.has(ns)) continue;
            prev.set(ns, stt);
            nq.push(ns);
            if (on || len < 3) continue;
            const m0 = Math.floor(m / 10), md = m % 10;
            let gone = [];
            if (sd === md && s0 !== m0) gone = [...Array(81).keys()].filter((i) => i !== s0 && i !== m0 && sees(i, s0) && sees(i, m0) && cand[i].includes(String(sd))).map((i) => [i, String(sd)]);
            else if (s0 === m0 && sd !== md) gone = cand[s0].filter((e) => +e !== sd && +e !== md).map((e) => [s0, e]);
            else if (sd !== md && sees(s0, m0)) gone = [[s0, String(md)], [m0, String(sd)]].filter(([i, e]) => cand[i].includes(e));
            if (!gone.length) continue;
            const chain = [];
            for (let k = ns; k !== -1; k = prev.get(k)) chain.unshift(k);
            best = { len, chain, gone, sd, md, s0, m0 };
            break;
          }
          if (best && best.len === len) break;
        }
        q = nq;
      }
    }
    if (!best) return noHint("チェーン");
    const { chain, gone, sd, md, s0, m0 } = best;
    const offs = chain.filter((k) => !(k & 1)).map((k) => [Math.floor(k / 20), String((k >> 1) % 10)]);
    const ons = chain.filter((k) => k & 1).map((k) => [Math.floor(k / 20), String((k >> 1) % 10)]);
    const order = [];
    for (const k of chain) { const i = Math.floor(k / 20); if (!order.includes(i)) order.push(i); }
    paintHint(st, [{ marks: offs, color: PAIR_COLORS[1] }, { marks: ons, color: PAIR_COLORS[0] }], gone,
      `番号の順にたどるチェーンです。①の「${sd}」が違うとすると、オレンジの数字は違う・青の数字は正しい、と交互に決まっていき、最後の${cellName(m0)}の「${md}」が正しくなります。つまり${cellName(s0)}の「${sd}」と${cellName(m0)}の「${md}」のどちらかは必ず正しいので、赤い枠の候補は消せます。`,
      { order });
  }

  // 背理法：候補が2つのマスで片方を入れたと仮定し、確実に決まる数字をたどる。どこかで矛盾したら、その仮定は誤りなので、もう一方が答え
  function showContradiction() {
    const st = hintState();
    if (!st) return;
    const { fixed, cand } = st;
    const test = (s, v) => {
      const c = cand.map((a, i) => (fixed[i] ? [fixed[i]] : a.slice()));
      c[s] = [v];
      const placed = new Set();
      for (let guard = 0; guard < 200; guard++) {
        let changed = false;
        for (let i = 0; i < 81; i++) {
          if (c[i].length === 0) return `${cellName(i)}のマスに入る数字がなくなり`;
          if (c[i].length !== 1 || placed.has(i)) continue;
          placed.add(i);
          changed = true;
          for (let j = 0; j < 81; j++) if (sees(i, j)) {
            c[j] = c[j].filter((d) => d !== c[i][0]);
            if (c[j].length === 0) return `${cellName(j)}のマスに入る数字がなくなり`;
          }
        }
        for (const u of UNITS) for (const d of DIGS) {
          const sp = u.ids.filter((i) => c[i].includes(d));
          if (sp.length === 0) return `${u.name}に「${d}」を入れる場所がなくなり`;
          if (sp.length === 1 && c[sp[0]].length > 1) { c[sp[0]] = [d]; changed = true; }
        }
        if (!changed) return null;
      }
      return null;
    };
    for (let s = 0; s < 81; s++) {
      if (cand[s].length !== 2) continue;
      for (const v of cand[s]) {
        const why = test(s, v);
        if (!why) continue;
        const w = cand[s].find((d) => d !== v);
        return paintHint(st, [{ marks: [[s, w]] }], [[s, v]],
          `薄い赤のマスに「${v}」を入れたと仮定して、確実に決まる数字をたどっていくと、${why}、矛盾します。なので「${v}」（赤い枠）は入らず、このマスは「${w}」（色の付いた数字）です。`,
          { cells: [s] });
      }
    }
    workMsg.classList.remove("err");
    workMsg.textContent = "ヒント：今は、候補が2つのマスで仮定を1つ置くだけでは矛盾が見つかりません。";
  }
  // Xウイング: ある数字が、2つの行でどちらも同じ2列にしか入らないとき、その2列のほかの行の同じ数字は消せる（行と列を入れ替えても同じ）
  // 消せる候補があるものだけを、4つの角を組ごとの色、消せる候補を赤い枠で示す
  function showXWing() {
    if (board.dataset.mode !== "solve") return;
    markConflicts();
    const cells = [...board.querySelectorAll(".cell")];
    const val = (o) => o.dataset.value || (o.classList.contains("tent") ? o.querySelector(".big").textContent : "");
    const peers = (a, b) => a.dataset.row === b.dataset.row || a.dataset.col === b.dataset.col
      || (Math.floor(a.dataset.row / 3) === Math.floor(b.dataset.row / 3) && Math.floor(a.dataset.col / 3) === Math.floor(b.dataset.col / 3));
    const can = (o, n) => !val(o) && !o.querySelector(`.cand[data-n="${n}"]`).classList.contains("off")
      && !cells.some((x) => x !== o && val(x) === n && peers(x, o));
    const at = (r, c) => cells.find((o) => +o.dataset.row === r && +o.dataset.col === c);
    const found = [];
    for (const d of ["1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
      // byRow=true: 行で探して列から消す、false: 列で探して行から消す
      for (const byRow of [true, false]) {
        const cell = (line, k) => (byRow ? at(line, k) : at(k, line));
        const two = [];
        for (let line = 0; line < 9; line++) {
          const ks = [];
          for (let k = 0; k < 9; k++) if (can(cell(line, k), d)) ks.push(k);
          if (ks.length === 2) two.push({ line, ks });
        }
        for (let i = 0; i < two.length; i++) for (let j = i + 1; j < two.length; j++) {
          const a = two[i], b = two[j];
          if (a.ks[0] !== b.ks[0] || a.ks[1] !== b.ks[1]) continue;
          const gone = [];
          for (let line = 0; line < 9; line++) {
            if (line === a.line || line === b.line) continue;
            for (const k of a.ks) if (can(cell(line, k), d)) gone.push(cell(line, k));
          }
          if (gone.length) found.push({ d, corners: [cell(a.line, a.ks[0]), cell(a.line, a.ks[1]), cell(b.line, b.ks[0]), cell(b.line, b.ks[1])], gone });
        }
      }
    }
    workMsg.classList.remove("err");
    if (!found.length) {
      workMsg.textContent = "ヒント：今はXウイングで消せる候補はありません。";
      return;
    }
    countHint();
    found.forEach((x, i) => {
      const color = PAIR_COLORS[i % PAIR_COLORS.length];
      for (const o of x.corners) {
        const c = o.querySelector(`.cand[data-n="${x.d}"]`);
        if (c.classList.contains("pgrp")) { c.classList.add("pgrp2"); c.style.setProperty("--pg2", color); continue; }
        c.classList.add("pgrp");
        c.style.setProperty("--pg", color);
      }
      for (const o of x.gone) o.querySelector(`.cand[data-n="${x.d}"]`).classList.add("hint");
    });
    renderPad();
    const ds = [...new Set(found.map((x) => `「${x.d}」`))].join("");
    workMsg.textContent = `ヒント：同じ色の4マスの${ds}がXウイングです（${found.length}組）。長方形の角の2行（または2列）で、その数字は角のマスにしか入らないので、赤い枠の同じ数字は消せます。`;
  }
  function runHint(full) {
    if (board.dataset.mode !== "solve") return;
    markConflicts();
    const cells = [...board.querySelectorAll(".cell")];
    const val = (o) => o.dataset.value || (o.classList.contains("tent") ? o.querySelector(".big").textContent : "");
    const peers = (a, b) => a.dataset.row === b.dataset.row || a.dataset.col === b.dataset.col
      || (Math.floor(a.dataset.row / 3) === Math.floor(b.dataset.row / 3) && Math.floor(a.dataset.col / 3) === Math.floor(b.dataset.col / 3));
    const can = (o, n) => !val(o) && !o.querySelector(`.cand[data-n="${n}"]`).classList.contains("off")
      && !cells.some((x) => x !== o && val(x) === n && peers(x, o));
    // 「次に注目するマス」: 盤が同じあいだは、前に示した所を飛ばして次を探す
    const sig = focusSig();
    if (full || sig !== focusState.sig) { focusState.sig = sig; focusState.seen = new Set(); }
    const seen = full ? new Set() : focusState.seen;
    const show = (cand, text) => {
      const key = cand.closest(".cell").dataset.row + "-" + cand.closest(".cell").dataset.col;
      if (seen.has(key)) return false;
      if (!hintGate(1, () => runHint(full))) return true;
      seen.add(key);
      countHint(true, full ? 2 : 1, full ? "" : key);
      if (full) cand.classList.add("hint");
      else cand.closest(".cell").classList.add("hint-cell");
      renderPad();
      workMsg.classList.remove("err");
      workMsg.textContent = full ? text : "ヒント：薄い赤のマスに注目してください。（ヒントの「答えと理由」で、数字と理由を表示します）";
    };
    // まず、入れられる数字が1つしかないマス
    for (const o of cells) {
      if (val(o)) continue;
      const ok = ["1", "2", "3", "4", "5", "6", "7", "8", "9"].filter((d) => can(o, d));
      if (ok.length === 1 && show(o.querySelector(`.cand[data-n="${ok[0]}"]`), `ヒント：薄い赤のマスに入れられる数字は「${ok[0]}」だけです。`) !== false) return;
    }
    // 次に、行・列・ブロックの中で、ある数字を入れられるマスが1つしかない所
    const units = [];
    for (let i = 0; i < 9; i++) units.push({ name: "ブロック", has: (o) => Math.floor(o.dataset.row / 3) * 3 + Math.floor(o.dataset.col / 3) === i });
    for (let i = 0; i < 9; i++) units.push({ name: `${i + 1}行目`, has: (o) => +o.dataset.row === i });
    for (let i = 0; i < 9; i++) units.push({ name: `${i + 1}列目`, has: (o) => +o.dataset.col === i });
    for (const u of units) {
      const inUnit = cells.filter(u.has);
      for (let n = 1; n <= 9; n++) {
        const d = String(n);
        if (inUnit.some((o) => val(o) === d)) continue;
        const spots = inUnit.filter((o) => can(o, d));
        if (spots.length !== 1) continue;
        if (show(spots[0].querySelector(`.cand[data-n="${d}"]`), `ヒント：この${u.name}で「${d}」を入れられるのは、薄い赤のマスだけです。`) !== false) return;
      }
    }
    // その次に、行・列・ブロックの中で2つの数字が同じ2マスにしか入らない組（ペア）を紫で示す
    // （そのペアでほかの候補を消せる場合だけ）
    const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
    const showPair = (two, a, b, text) => {
      const key = "p" + two.map((o) => o.dataset.row + o.dataset.col).join("") + a + b;
      if (seen.has(key)) return false;
      if (!hintGate(2, () => runHint(full))) return true;
      seen.add(key);
      countHint(true, undefined, key);
      for (const o of two) {
        if (full) for (const d of [a, b]) o.querySelector(`.cand[data-n="${d}"]`).classList.add("pair");
        else o.classList.add("pair-cell");
      }
      renderPad();
      workMsg.classList.remove("err");
      workMsg.textContent = full ? text : "ヒント：紫の2マスに注目してください。（ヒントの「答えと理由」で、数字と理由を表示します）";
    };
    // （「答えと理由」では、ペアも含めて下の上級の解き方でまとめて探し、答えまで示す）
    if (!full) for (const u of units) {
      const inUnit = cells.filter(u.has);
      const spots = {};
      for (const d of digits) spots[d] = inUnit.filter((o) => can(o, d));
      for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) {
        const a = digits[i], b = digits[j];
        // どちらの数字も入れられるのが同じ2マスだけ
        if (spots[a].length === 2 && spots[b].length === 2 && spots[a].every((o) => spots[b].includes(o))
          && spots[a].some((o) => digits.some((d) => d !== a && d !== b && can(o, d)))) {
          if (showPair(spots[a], a, b, `ヒント：この${u.name}で「${a}」と「${b}」は、紫の2マスにしか入りません。この2マスのほかの候補は消せます。`) !== false) return;
        }
        // 入れられる数字が「a と b」だけのマスが2つある
        const two = inUnit.filter((o) => !val(o) && digits.filter((d) => can(o, d)).join("") === a + b);
        if (two.length === 2 && inUnit.some((o) => !two.includes(o) && (can(o, a) || can(o, b)))) {
          if (showPair(two, a, b, `ヒント：この${u.name}の紫の2マスには「${a}」と「${b}」しか入りません。この${u.name}のほかのマスの「${a}」「${b}」は消せます。`) !== false) return;
        }
      }
    }
    // ここまでで見つからなければ、上級の解き方を順に使って候補を消し、答えの決まるマスを探す
    // 「答えと理由」は答えと理由まで、「注目するマス」はそのマスだけを示す
    {
      const at = (i) => cells.find((o) => +o.dataset.row * 9 + +o.dataset.col === i);
      const v = [], cand = [];
      for (let i = 0; i < 81; i++) {
        const o = at(i), x = val(o);
        v.push(x ? +x : 0);
        let m = 0;
        if (!x) for (let d = 1; d <= 9; d++) if (can(o, String(d))) m |= 1 << d;
        cand.push(m);
      }
      if (!hintEngine) hintEngine = sudokuGen({ postMessage() {} });
      const r = hintEngine.grade(null, { v, cand });
      const name = (i) => `${Math.floor(i / 9) + 1}行${(i % 9) + 1}列`;
      const mark = (i, d) => {
        const o = at(i);
        o.classList.add("hint-cell");
        o.querySelector(`.cand[data-n="${d}"]`).classList.add("pair");
      };
      if (r.i !== undefined && r.log.length) {
        // 理由のレベル = 使った解き方のレベルの一番高いもの（レベルは 15-puzzle-maker.js の TECHS で決まる）
        const rlv = Math.max(1, ...r.log.map((e) => e.lv));
        const ekey = "e" + r.i;
        if (!full && seen.has(ekey)) return focusDone();
        if (!hintGate(rlv, () => runHint(full))) return;
        if (!full) {
          seen.add(ekey);
          countHint(true, 1, ekey);
          at(r.i).classList.add("hint-cell");
          renderPad();
          workMsg.classList.remove("err");
          workMsg.textContent = `ヒント：薄い赤のマスに注目してください。（${"★".repeat(rlv)} の解き方を使います。「答えと理由」で、数字と理由を表示します）`;
          return;
        }
        countHint(true, 2 * rlv);
        for (const e of r.log) for (let d = 1; d <= 9; d++) if (e.m & (1 << d)) at(e.i).querySelector(`.cand[data-n="${d}"]`).classList.add("hint");
        mark(r.i, r.d);
        renderPad();
        const techs = [...new Set(r.log.map((e) => e.tech))].join("→");
        const UN = ["行目", "列目", "ブロック"];
        const where = r.how === "cell" ? `${name(r.i)}に入れられる数字は「${r.d}」だけ`
          : `${UN[r.unit % 3] === "ブロック" ? "このブロック" : Math.floor(r.unit / 3) + 1 + UN[r.unit % 3]}で「${r.d}」を入れられるのは${name(r.i)}だけ`;
        workMsg.classList.remove("err");
        workMsg.textContent = `ヒント：${techs}で赤い枠の候補を消すと、${where}になります（紫の数字）。`;
        return;
      }
      if (r.stuck && solution && solution.n) {
        // 背理法が要る所まで来た。候補の一番少ないマスの答えを、正解から教える
        let best = -1;
        for (let i = 0; i < 81; i++) if (!v[i] && (best < 0 || bitCount(cand[i]) < bitCount(cand[best]))) best = i;
        if (best >= 0) {
          const skey = "s" + best;
          if (!full && seen.has(skey)) return focusDone();
          if (!hintGate(6, () => runHint(full))) return;
          if (!full) {
            seen.add(skey);
            countHint(true, 1, skey);
            at(best).classList.add("hint-cell");
            renderPad();
            workMsg.classList.remove("err");
            workMsg.textContent = "ヒント：薄い赤のマスに注目してください。（ここから先は背理法が必要です）";
            return;
          }
          countHint(true, 12);
          mark(best, solution.sol[best]);
          renderPad();
          workMsg.classList.remove("err");
          workMsg.textContent = `ヒント：ここから先は、ヒントの解き方だけでは進めず、背理法が必要です。${name(best)}の答えは「${solution.sol[best]}」です（紫の数字。「背理法」のヒントで確かめられます）。`;
          return;
        }
      }
    }
    workMsg.classList.remove("err");
    if (!full && seen.size) return focusDone();
    function focusDone() {
      // 全部見せ終わった: 次に押したときは最初から
      focusState.seen = new Set();
      workMsg.classList.remove("err");
      workMsg.textContent = "ヒント：ほかに注目するマスはありません。もう一度押すと、最初のマスから示します。";
    }
    workMsg.textContent = "ヒント：見つかりませんでした。消せる候補を消してから、もう一度押してみてください。";
  }
  // 注目するマスを示した盤の状態と、示した所（盤が変わったら最初から）
  const focusState = { sig: "", seen: new Set() };
  function focusSig() {
    return [...board.querySelectorAll(".cell")].map((o) =>
      (o.dataset.value || (o.classList.contains("tent") ? o.querySelector(".big").textContent : "")) + [...o.querySelectorAll(".cand.off")].map((c) => c.dataset.n).join("")).join(",");
  }
  let hintEngine = null;
  const bitCount = (m) => { let n = 0; for (; m; m &= m - 1) n++; return n; };
