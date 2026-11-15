  // ===== 09-hints-basic.js：ヒント：ペア・3つの組・ポインティング・クレーミング =====
  // （src/js/ の全ファイルで1つの (function () { … })(); になる。まとめ方は tools/build.py）
  // ②③ 行・列・ブロックの中で、2つ（3つ）の数字が同じ2マス（3マス）にしか入らない組を、組ごとの色で示す
  // 青い候補かどうかは関係なく、入れられる数字（消した候補・確定済みの数字を除く）で調べる
  const PAIR_COLORS = ["#2f7de1", "#e07b00", "#2e9d4f", "#d6408f", "#0f9a92", "#8a5cd1", "#b8860b", "#c0392b"];
  // k=2: 同じ2マスにしか入らない2つの数字の組、k=3: 同じ3マスにしか入らない3つの数字の組
  function showPairs(k = 2) {
    if (board.dataset.mode !== "solve") return;
    markConflicts();
    const cells = [...board.querySelectorAll(".cell")];
    const val = (o) => o.dataset.value || (o.classList.contains("tent") ? o.querySelector(".big").textContent : "");
    const peers = (a, b) => a.dataset.row === b.dataset.row || a.dataset.col === b.dataset.col
      || (Math.floor(a.dataset.row / 3) === Math.floor(b.dataset.row / 3) && Math.floor(a.dataset.col / 3) === Math.floor(b.dataset.col / 3));
    const can = (o, n) => !val(o) && !o.querySelector(`.cand[data-n="${n}"]`).classList.contains("off")
      && !cells.some((x) => x !== o && val(x) === n && peers(x, o));
    const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
    const units = [];
    for (let i = 0; i < 9; i++) units.push((o) => +o.dataset.row === i);
    for (let i = 0; i < 9; i++) units.push((o) => +o.dataset.col === i);
    for (let i = 0; i < 9; i++) units.push((o) => Math.floor(o.dataset.row / 3) * 3 + Math.floor(o.dataset.col / 3) === i);
    const found = [], seen = new Set();
    for (const has of units) {
      const inUnit = cells.filter(has);
      const spots = {};
      for (const d of digits) spots[d] = inUnit.filter((o) => can(o, d));
      // その単位で2〜k マスに入れられる数字から k 個を選び、入れられるマスを合わせて k マスになる組
      const ds = digits.filter((d) => spots[d].length >= 2 && spots[d].length <= k);
      const pick = (start, chosen) => {
        if (chosen.length === k) {
          const where = [...new Set(chosen.flatMap((d) => spots[d]))];
          if (where.length !== k) return;
          // 3つの組の中に2つの組が含まれるときは、2つの組のほうで分かるので出さない
          if (k === 3 && chosen.some((a, i) => chosen.some((b, j) => j > i && spots[a].length === 2 && spots[b].length === 2 && spots[a].every((o) => spots[b].includes(o))))) return;
          // 行とブロックで同じ組が見つかったときは1つにまとめる
          const key = chosen.join("") + where.map((o) => cells.indexOf(o)).sort((x, y) => x - y).join(",");
          if (seen.has(key)) return;
          seen.add(key);
          found.push({ ds: chosen, where });
          return;
        }
        for (let i = start; i < ds.length; i++) pick(i + 1, [...chosen, ds[i]]);
      };
      pick(0, []);
      // ネイキッドペア: 候補が同じ2つだけのマスが、この単位に2つある。その2つの数字は、単位のほかのマスから消せる
      if (k === 2) {
        const two = inUnit.filter((o) => !val(o)).map((o) => ({ o, ds: digits.filter((d) => can(o, d)) })).filter((x) => x.ds.length === 2);
        for (let i = 0; i < two.length; i++) for (let j = i + 1; j < two.length; j++) {
          const a = two[i], b = two[j];
          if (a.ds.join("") !== b.ds.join("")) continue;
          const where = [a.o, b.o];
          const gone = inUnit.filter((o) => !where.includes(o)).flatMap((o) => a.ds.filter((d) => can(o, d)).map((d) => o.querySelector(`.cand[data-n="${d}"]`)));
          const key = "N" + a.ds.join("") + where.map((o) => cells.indexOf(o)).sort((x, y) => x - y).join(",");
          if (seen.has(key.slice(1))) continue; // 隠れペアとしても見つかっているときは、そちらだけ出す
          const old = found.find((f) => f.key === key);
          if (old) { old.gone.push(...gone); continue; }
          found.push({ ds: a.ds, where, naked: true, key, gone });
        }
      }
    }
    workMsg.classList.remove("err");
    const kk = k === 3 ? "3" : "2";
    if (!found.length) {
      workMsg.textContent = k === 2 ? "ヒント：隠れペアもネイキッドペアも、今はありません。" : `ヒント：同じ${kk}マスにしか入らない${kk}つの数字の組は、今はありません。`;
      return;
    }
    // その組で新しく消せる候補があるときだけ、ヒントを使った回数に数える
    countHint(found.some((p) => (p.gone || []).length || (!p.naked && p.where.some((o) => digits.some((d) => !p.ds.includes(d) && can(o, d))))));
    found.forEach((p, i) => {
      const color = PAIR_COLORS[i % PAIR_COLORS.length];
      for (const o of p.where) for (const d of p.ds) {
        if (!can(o, d)) continue;
        const c = o.querySelector(`.cand[data-n="${d}"]`);
        if (c.classList.contains("pgrp")) { c.classList.add("pgrp2"); c.style.setProperty("--pg2", color); continue; }
        c.classList.add("pgrp");
        c.style.setProperty("--pg", color);
      }
      for (const c of p.gone || []) c.classList.add("hint");
    });
    renderPad();
    if (k === 2) {
      const nh = found.filter((p) => !p.naked).length, nn = found.length - nh;
      const parts = [];
      if (nh) parts.push(`隠れペア（${nh}組）：同じ色の2つの数字は、その行・列・ブロックで色の付いた2マスにしか入りません。その2マスのほかの候補は消せます。`);
      if (nn) parts.push(`ネイキッドペア（${nn}組）：同じ色の2マスには、その2つの数字しか入りません。同じ行・列・ブロックのほかのマスにある同じ数字（赤い枠）は消せます。`);
      workMsg.textContent = "ヒント：" + parts.join("　");
      return;
    }
    workMsg.textContent = `ヒント：同じ色の${kk}つの数字（${found.length}組）は、その行・列・ブロックで、色の付いた${kk}マスにしか入りません。その${kk}マスのほかの候補は消せます。`;
  }
  // ブロックと行・列の関係を使うヒント（2種類）。見つけ方だけが違い、表示のしかたは同じ
  // ・ポインティング（レベル2）: ブロックの中で、ある数字が1つの行（列）にしか入らない
  //     → その行（列）の、ブロックの外の同じ数字は消せる
  // ・クレーミング（レベル2）: 行（列）の中で、ある数字が1つのブロックにしか入らない
  //     → そのブロックの、その行（列）以外の同じ数字は消せる
  const BOX_LINE = {
    pointing: {
      name: "ポインティング",
      why: "同じ色の数字は、そのブロックの中では1つの行（列）にしか入りません。なので、その行（列）のブロックの外にある同じ数字（赤い枠）は消せます。",
    },
    claiming: {
      name: "クレーミング",
      why: "同じ色の数字は、その行（列）の中では1つのブロックにしか入りません。なので、そのブロックの中の、その行（列）以外にある同じ数字（赤い枠）は消せます。",
    },
  };
  function showBoxLine(kind) {
    if (board.dataset.mode !== "solve") return;
    markConflicts();
    const cells = [...board.querySelectorAll(".cell")];
    const val = (o) => o.dataset.value || (o.classList.contains("tent") ? o.querySelector(".big").textContent : "");
    const peers = (a, b) => a.dataset.row === b.dataset.row || a.dataset.col === b.dataset.col
      || (Math.floor(a.dataset.row / 3) === Math.floor(b.dataset.row / 3) && Math.floor(a.dataset.col / 3) === Math.floor(b.dataset.col / 3));
    const can = (o, n) => !val(o) && !o.querySelector(`.cand[data-n="${n}"]`).classList.contains("off")
      && !cells.some((x) => x !== o && val(x) === n && peers(x, o));
    const box = (o) => Math.floor(o.dataset.row / 3) * 3 + Math.floor(o.dataset.col / 3);
    const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
    // found: [{ d: 数字, spots: 色を付けるマス, gone: 消せる候補のマス }]
    const found = [];
    if (kind === "pointing") {
      for (let b = 0; b < 9; b++) {
        const inBox = cells.filter((o) => box(o) === b);
        for (const d of DIGITS) {
          if (inBox.some((o) => val(o) === d)) continue;
          const spots = inBox.filter((o) => can(o, d));
          if (spots.length < 2) continue;
          for (const key of ["row", "col"]) {
            if (!spots.every((o) => o.dataset[key] === spots[0].dataset[key])) continue;
            const gone = cells.filter((o) => box(o) !== b && o.dataset[key] === spots[0].dataset[key] && can(o, d));
            if (gone.length) found.push({ d, spots, gone });
          }
        }
      }
    } else {
      for (const key of ["row", "col"]) for (let n = 0; n < 9; n++) {
        const line = cells.filter((o) => +o.dataset[key] === n);
        for (const d of DIGITS) {
          if (line.some((o) => val(o) === d)) continue;
          const spots = line.filter((o) => can(o, d));
          if (spots.length < 2 || !spots.every((o) => box(o) === box(spots[0]))) continue;
          const gone = cells.filter((o) => box(o) === box(spots[0]) && +o.dataset[key] !== n && can(o, d));
          if (gone.length) found.push({ d, spots, gone });
        }
      }
    }
    const { name, why } = BOX_LINE[kind];
    workMsg.classList.remove("err");
    if (!found.length) {
      workMsg.textContent = `ヒント：今は${name}で消せる候補はありません。`;
      return;
    }
    countHint();
    found.forEach((x, i) => {
      const color = PAIR_COLORS[i % PAIR_COLORS.length];
      for (const o of x.spots) {
        const c = o.querySelector(`.cand[data-n="${x.d}"]`);
        if (c.classList.contains("pgrp")) { c.classList.add("pgrp2"); c.style.setProperty("--pg2", color); continue; }
        c.classList.add("pgrp");
        c.style.setProperty("--pg", color);
      }
      for (const o of x.gone) o.querySelector(`.cand[data-n="${x.d}"]`).classList.add("hint");
    });
    renderPad();
    workMsg.textContent = `ヒント：${name}（${found.length}組）：${why}`;
  }

