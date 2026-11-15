  // ===== 15-puzzle-maker.js：問題を作る計算（裏の Worker でも画面側でも動く） =====
  // （src/js/ の全ファイルで1つの (function () { … })(); になる。まとめ方は tools/build.py）
  // 問題を作る処理（裏の計算用 Worker でも、使えないときは画面側でも動く）
  // self: postMessage / onmessage を持つもの。レベル 1=初級 2=中級 3=難問 4=最難関
  // rules: 解き方のレベルと難易度の決まり（01a-levels.js の GEN_RULES）。Worker でも使うので、外の変数は見ずに引数でもらう
  function sudokuGen(self, rules) {
    const TOP = rules.difficulties.length;  // 一番上の難易度（最難関）
    const EXTREME = rules.difficulties[TOP - 1];
    const lvOf = (name) => (rules.techniques.find((t) => t.name === name) || {}).lv;
    const CONTRA_LV = lvOf("背理法");
    // 1手のレベル → その手が必要になる難易度（1 = 初級 …）
    const diffOf = (k) => rules.difficulties.findIndex((d) => k <= d.maxLv) + 1;
    const units = [];
    for (let i = 0; i < 9; i++) {
      units.push([...Array(9)].map((_, k) => i * 9 + k));
      units.push([...Array(9)].map((_, k) => k * 9 + i));
      units.push([...Array(9)].map((_, k) => (Math.floor(i / 3) * 3 + Math.floor(k / 3)) * 9 + (i % 3) * 3 + (k % 3)));
    }
    const rowOf = (i) => Math.floor(i / 9), colOf = (i) => i % 9, boxOf = (i) => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3);
    const peers = [...Array(81)].map((_, i) => [...Array(81).keys()].filter((j) => j !== i && (rowOf(j) === rowOf(i) || colOf(j) === colOf(i) || boxOf(j) === boxOf(i))));
    const ALL = 0x3fe;
    const bits = (m) => { const r = []; for (let d = 1; d <= 9; d++) if (m & (1 << d)) r.push(d); return r; };
    const pop = (m) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

    // 答えの数を数える（limit 個見つけたら止める）
    function count(g, limit) {
      const row = new Array(9).fill(0), col = new Array(9).fill(0), box = new Array(9).fill(0);
      const a = g.slice();
      for (let i = 0; i < 81; i++) if (a[i]) {
        const b = 1 << a[i];
        if ((row[rowOf(i)] | col[colOf(i)] | box[boxOf(i)]) & b) return 0;
        row[rowOf(i)] |= b; col[colOf(i)] |= b; box[boxOf(i)] |= b;
      }
      let n = 0;
      (function rec() {
        let best = -1, bm = 0, bc = 10;
        for (let i = 0; i < 81; i++) if (!a[i]) {
          const m = ALL & ~(row[rowOf(i)] | col[colOf(i)] | box[boxOf(i)]);
          const c = pop(m);
          if (c < bc) { bc = c; best = i; bm = m; if (c <= 1) break; }
        }
        if (best < 0) { n++; return; }
        for (const d of bits(bm)) {
          const b = 1 << d;
          a[best] = d; row[rowOf(best)] |= b; col[colOf(best)] |= b; box[boxOf(best)] |= b;
          rec();
          a[best] = 0; row[rowOf(best)] &= ~b; col[colOf(best)] &= ~b; box[boxOf(best)] &= ~b;
          if (n >= limit) return;
        }
      })();
      return n;
    }
    // ランダムに埋まった正しい盤
    function full() {
      const a = new Array(81).fill(0);
      (function rec(i) {
        if (i === 81) return true;
        const used = new Set(peers[i].map((p) => a[p]));
        for (const d of shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
          if (used.has(d)) continue;
          a[i] = d;
          if (rec(i + 1)) return true;
        }
        a[i] = 0;
        return false;
      })(0);
      return a;
    }
    // 人の解き方で解いて、必要だった一番難しい解き方のレベルを返す（解き切れなければ 4）
    // start を渡すと「答えと理由」用: 今の盤の候補から始め、答えの決まるマスが出るまでに使った解き方と消した候補を返す
    function grade(g, start, timing) {
      const v = start ? start.v.slice() : g.slice(), cand = start ? start.cand.slice() : new Array(81).fill(ALL);
      const place = (i, d) => { v[i] = d; cand[i] = 0; for (const p of peers[i]) cand[p] &= ~(1 << d); };
      if (!start) for (let i = 0; i < 81; i++) if (v[i]) { const d = v[i]; v[i] = 0; place(i, d); }
      let tech = "", techLv = 0;
      const log = [];
      const elim = (i, m) => { if (!v[i] && (cand[i] & m)) { if (start) log.push({ i, m: cand[i] & m, tech, lv: techLv }); cand[i] &= ~m; return true; } return false; };
      const where = (u, d) => u.filter((i) => !v[i] && (cand[i] & (1 << d)));
      // 初級: そのマスに入る数字が1つだけ／その行・列・ブロックでその数字が入るマスが1つだけ
      function singles() {
        for (let i = 0; i < 81; i++) if (!v[i] && pop(cand[i]) === 1) { place(i, bits(cand[i])[0]); return true; }
        for (const u of units) for (let d = 1; d <= 9; d++) {
          if (u.some((i) => v[i] === d)) continue;
          const w = where(u, d);
          if (w.length === 1) { place(w[0], d); return true; }
        }
        return false;
      }
      const sees = (a, b) => a !== b && peers[a].includes(b);
      const biCells = () => [...Array(81).keys()].filter((i) => !v[i] && pop(cand[i]) === 2);
      // 2つの数字のペア（2マスに同じ2つの候補だけ／2つの数字が同じ2マスにしか入らない）
      function pairs() {
        let ch = false;
        for (const u of units) {
          const e = u.filter((i) => !v[i]);
          for (const a of e) if (pop(cand[a]) === 2) for (const b of e) if (b > a && cand[b] === cand[a]) {
            for (const i of e) if (i !== a && i !== b) ch = elim(i, cand[a]) || ch;
          }
          if (ch) return true;
          for (let d1 = 1; d1 <= 9; d1++) for (let d2 = d1 + 1; d2 <= 9; d2++) {
            const w1 = where(u, d1), w2 = where(u, d2);
            if (w1.length === 2 && w2.length === 2 && w1[0] === w2[0] && w1[1] === w2[1]) {
              const keep = (1 << d1) | (1 << d2);
              for (const i of w1) ch = elim(i, ALL & ~keep) || ch;
            }
          }
          if (ch) return true;
        }
        return false;
      }
      // ポインティング: ブロックの中で、ある数字が1つの行（列）にしか入らないとき、その行（列）のブロックの外から消す
      function pointing() {
        let ch = false;
        for (let b = 0; b < 9; b++) {
          const box = units[b * 3 + 2];
          for (let d = 1; d <= 9; d++) {
            const w = where(box, d);
            if (w.length < 2) continue;
            for (const [f, k] of [[rowOf, 0], [colOf, 1]]) {
              if (!w.every((i) => f(i) === f(w[0]))) continue;
              const line = units[f(w[0]) * 3 + k];
              for (const i of line) if (!box.includes(i)) ch = elim(i, 1 << d) || ch;
            }
          }
        }
        return ch;
      }
      // クレーミング: 行（列）の中で、ある数字が1つのブロックにしか入らないとき、そのブロックのほかのマスから消す
      function claiming() {
        let ch = false;
        for (let L = 0; L < 9; L++) for (const k of [0, 1]) {
          const line = units[L * 3 + k];
          for (let d = 1; d <= 9; d++) {
            const w = where(line, d);
            if (w.length < 2 || !w.every((i) => boxOf(i) === boxOf(w[0]))) continue;
            for (const i of units[boxOf(w[0]) * 3 + 2]) if (!line.includes(i)) ch = elim(i, 1 << d) || ch;
          }
        }
        return ch;
      }
      // 3つの数字の組（ネイキッド・隠れ）
      function triples() {
        let ch = false;
        for (const u of units) {
          const e = u.filter((i) => !v[i] && pop(cand[i]) <= 3);
          for (let x = 0; x < e.length; x++) for (let y = x + 1; y < e.length; y++) for (let z = y + 1; z < e.length; z++) {
            const m = cand[e[x]] | cand[e[y]] | cand[e[z]];
            if (pop(m) !== 3) continue;
            for (const i of u) if (i !== e[x] && i !== e[y] && i !== e[z]) ch = elim(i, m) || ch;
          }
          if (ch) return true;
          const ds = [];
          for (let d = 1; d <= 9; d++) { const w = where(u, d); if (w.length >= 2 && w.length <= 3) ds.push([d, w]); }
          for (let x = 0; x < ds.length; x++) for (let y = x + 1; y < ds.length; y++) for (let z = y + 1; z < ds.length; z++) {
            const cells = new Set([...ds[x][1], ...ds[y][1], ...ds[z][1]]);
            if (cells.size !== 3) continue;
            const keep = (1 << ds[x][0]) | (1 << ds[y][0]) | (1 << ds[z][0]);
            for (const i of cells) ch = elim(i, ALL & ~keep) || ch;
          }
          if (ch) return true;
        }
        return false;
      }
      // Xウイング（行で見つけて列から消す／列で見つけて行から消す）
      function xWing() {
        let ch = false;
        for (let d = 1; d <= 9; d++) for (const k of [0, 1]) {
          const lines = [];
          for (let L = 0; L < 9; L++) {
            const w = where(units[L * 3 + k], d);
            if (w.length === 2) lines.push({ L, at: w.map(k ? rowOf : colOf) });
          }
          for (let x = 0; x < lines.length; x++) for (let y = x + 1; y < lines.length; y++) {
            const A = lines[x], B = lines[y];
            if (A.at[0] !== B.at[0] || A.at[1] !== B.at[1]) continue;
            for (const o of A.at) for (const i of units[o * 3 + (k ? 0 : 1)]) {
              const L = k ? colOf(i) : rowOf(i);
              if (L !== A.L && L !== B.L) ch = elim(i, 1 << d) || ch;
            }
          }
          if (ch) return true;
        }
        return false;
      }
      // ソードフィッシュ（Xウイングの3行・3列版）
      function swordfish() {
        let ch = false;
        for (let d = 1; d <= 9; d++) for (const k of [0, 1]) {
          const lines = [];
          for (let L = 0; L < 9; L++) {
            const w = where(units[L * 3 + k], d);
            if (w.length >= 2 && w.length <= 3) lines.push({ L, at: w.map(k ? rowOf : colOf) });
          }
          for (let x = 0; x < lines.length; x++) for (let y = x + 1; y < lines.length; y++) for (let z = y + 1; z < lines.length; z++) {
            const at = new Set([...lines[x].at, ...lines[y].at, ...lines[z].at]);
            if (at.size !== 3) continue;
            const own = [lines[x].L, lines[y].L, lines[z].L];
            for (const o of at) for (const i of units[o * 3 + (k ? 0 : 1)]) {
              if (!own.includes(k ? colOf(i) : rowOf(i))) ch = elim(i, 1 << d) || ch;
            }
          }
          if (ch) return true;
        }
        return false;
      }
      // XYウイング: 候補が2つのマス3つ（XY・XZ・YZ）で、XYが両方と同じ単位にあれば、XZとYZの両方から見えるマスのZを消せる
      function xyWing() {
        let ch = false;
        const bi = biCells();
        for (const p of bi) {
          const [x, y] = bits(cand[p]);
          const wa = bi.filter((q) => q !== p && sees(p, q) && (cand[q] & (1 << x)) && !(cand[q] & (1 << y)));
          const wb = bi.filter((q) => q !== p && sees(p, q) && (cand[q] & (1 << y)) && !(cand[q] & (1 << x)));
          for (const a of wa) for (const b of wb) {
            const zm = cand[a] & ~(1 << x);
            if (zm !== (cand[b] & ~(1 << y))) continue;
            for (let i = 0; i < 81; i++) if (i !== a && i !== b && i !== p && sees(i, a) && sees(i, b)) ch = elim(i, zm) || ch;
            if (ch) return true;
          }
        }
        return false;
      }
      // 4つの数字の組（ネイキッド・隠れ）
      function quads() {
        let ch = false;
        for (const u of units) {
          const e = u.filter((i) => !v[i] && pop(cand[i]) <= 4);
          const n = e.length;
          for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) {
            const m = cand[e[a]] | cand[e[b]] | cand[e[c]] | cand[e[d]];
            if (pop(m) !== 4) continue;
            const set = [e[a], e[b], e[c], e[d]];
            for (const i of u) if (!set.includes(i)) ch = elim(i, m) || ch;
          }
          if (ch) return true;
          const ds = [];
          for (let d = 1; d <= 9; d++) { const w = where(u, d); if (w.length >= 2 && w.length <= 4) ds.push([d, w]); }
          const k = ds.length;
          for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) for (let c = b + 1; c < k; c++) for (let d = c + 1; d < k; d++) {
            const cells = new Set([...ds[a][1], ...ds[b][1], ...ds[c][1], ...ds[d][1]]);
            if (cells.size !== 4) continue;
            const keep = (1 << ds[a][0]) | (1 << ds[b][0]) | (1 << ds[c][0]) | (1 << ds[d][0]);
            for (const i of cells) ch = elim(i, ALL & ~keep) || ch;
          }
          if (ch) return true;
        }
        return false;
      }
      // XYZウイング
      function xyzWing() {
        let ch = false;
        const bi = biCells();
        for (let p = 0; p < 81; p++) {
          if (v[p] || pop(cand[p]) !== 3) continue;
          const w = bi.filter((q) => sees(p, q) && (cand[q] & ~cand[p]) === 0);
          for (let x = 0; x < w.length; x++) for (let y = x + 1; y < w.length; y++) {
            const a = w[x], b = w[y];
            if (cand[a] === cand[b]) continue;
            const z = cand[a] & cand[b];
            if (pop(z) !== 1) continue;
            for (let i = 0; i < 81; i++) if (i !== p && i !== a && i !== b && sees(i, p) && sees(i, a) && sees(i, b)) ch = elim(i, z) || ch;
            if (ch) return true;
          }
        }
        return false;
      }
      // スカイスクレイパー
      function skyscraper() {
        let ch = false;
        for (let d = 1; d <= 9; d++) for (const k of [0, 1]) {
          const lines = [];
          for (let L = 0; L < 9; L++) { const w = where(units[L * 3 + k], d); if (w.length === 2) lines.push(w); }
          const pos = k ? rowOf : colOf;
          for (let x = 0; x < lines.length; x++) for (let y = x + 1; y < lines.length; y++) {
            const A = lines[x], B = lines[y];
            for (const [ab, ae] of [[0, 1], [1, 0]]) for (const [bb, be] of [[0, 1], [1, 0]]) {
              if (pos(A[ab]) !== pos(B[bb]) || pos(A[ae]) === pos(B[be])) continue;
              for (let i = 0; i < 81; i++) if (sees(i, A[ae]) && sees(i, B[be])) ch = elim(i, 1 << d) || ch;
              if (ch) return true;
            }
          }
        }
        return false;
      }
      // シンプルカラーリング
      function coloring() {
        let ch = false;
        for (let d = 1; d <= 9; d++) {
          const link = [...Array(81)].map(() => []);
          for (const u of units) { const w = where(u, d); if (w.length === 2) { link[w[0]].push(w[1]); link[w[1]].push(w[0]); } }
          const color = new Array(81).fill(-1);
          for (let s0 = 0; s0 < 81; s0++) {
            if (color[s0] >= 0 || !link[s0].length) continue;
            const comp = [s0];
            color[s0] = 0;
            for (let q = 0; q < comp.length; q++) for (const n of link[comp[q]]) if (color[n] < 0) { color[n] = 1 - color[comp[q]]; comp.push(n); }
            if (comp.length < 3) continue;
            for (const k of [0, 1]) {
              const side = comp.filter((i) => color[i] === k);
              if (side.some((a) => side.some((b) => sees(a, b)))) { for (const i of side) ch = elim(i, 1 << d) || ch; return true; }
            }
            for (let i = 0; i < 81; i++) {
              if (v[i] || color[i] >= 0 || !(cand[i] & (1 << d))) continue;
              if (comp.some((a) => color[a] === 0 && sees(a, i)) && comp.some((b) => color[b] === 1 && sees(b, i))) ch = elim(i, 1 << d) || ch;
            }
            if (ch) return true;
          }
        }
        return false;
      }
      // XYチェーン（リモートペアを含む）: 候補が2つのマスをつなぎ、両端で同じ数字 z が出てくれば、両端から見えるマスの z を消せる
      function xyChain() {
        let ch = false;
        const bi = biCells();
        for (const s0 of bi) for (const z of bits(cand[s0])) {
          const start = { c: s0, out: bits(cand[s0] & ~(1 << z))[0] };
          const seen = new Set([s0 * 10 + start.out]);
          const q = [start];
          while (q.length) {
            const cur = q.shift();
            for (const n of bi) {
              if (n === cur.c || !sees(cur.c, n) || !(cand[n] & (1 << cur.out))) continue;
              const out = bits(cand[n] & ~(1 << cur.out))[0];
              if (out === z && n !== s0) {
                for (let i = 0; i < 81; i++) if (i !== s0 && i !== n && sees(i, s0) && sees(i, n)) ch = elim(i, 1 << z) || ch;
                if (ch) return true;
              }
              const key = n * 10 + out;
              if (!seen.has(key)) { seen.add(key); q.push({ c: n, out }); }
            }
          }
        }
        return false;
      }
      // チェーン（AIC）: 「2か所にしか入らない数字」と「候補が2つのマス」を交互につなぐ。
      // 始めの候補が違うなら終わりの候補が正しい、が言えるので、両方と同時には成り立たない候補を消せる
      function chain() {
        let ch = false;
        const strong = [];
        for (let i = 0; i < 81; i++) if (!v[i] && pop(cand[i]) === 2) { const [a, b] = bits(cand[i]); (strong[i * 10 + a] ||= []).push(i * 10 + b); (strong[i * 10 + b] ||= []).push(i * 10 + a); }
        for (const u of units) for (let d = 1; d <= 9; d++) { const w = where(u, d); if (w.length === 2) { (strong[w[0] * 10 + d] ||= []).push(w[1] * 10 + d); (strong[w[1] * 10 + d] ||= []).push(w[0] * 10 + d); } }
        const weak = (n) => {
          const i = Math.floor(n / 10), d = n % 10, r = [];
          for (const p of peers[i]) if (!v[p] && (cand[p] & (1 << d))) r.push(p * 10 + d);
          for (const e of bits(cand[i])) if (e !== d) r.push(i * 10 + e);
          return r;
        };
        for (let s0 = 0; s0 < 81; s0++) for (const sd of bits(v[s0] ? 0 : cand[s0])) {
          const s = s0 * 10 + sd;
          // 状態 = 候補*2 + (1: 正しい, 0: 違う)。始めの候補は「違う」とする
          const seen = new Set([s * 2]);
          let q = [s * 2];
          for (let len = 1; len <= 14 && q.length; len++) {
            const nq = [];
            for (const st of q) {
              const n = st >> 1, on = st & 1;
              for (const m of on ? [...weak(n), ...(strong[n] || [])] : strong[n] || []) {
                const ns = m * 2 + (on ? 0 : 1);
                if (seen.has(ns)) continue;
                seen.add(ns);
                nq.push(ns);
                if (on || len < 3) continue;
                const m0 = Math.floor(m / 10), md = m % 10;
                if (sd === md && s0 !== m0) {
                  for (let i = 0; i < 81; i++) if (i !== s0 && i !== m0 && sees(i, s0) && sees(i, m0)) ch = elim(i, 1 << sd) || ch;
                } else if (s0 === m0 && sd !== md) {
                  ch = elim(s0, ALL & ~((1 << sd) | (1 << md))) || ch;
                } else if (sd !== md && sees(s0, m0)) {
                  ch = elim(s0, 1 << md) || ch;
                  ch = elim(m0, 1 << sd) || ch;
                }
                if (ch) return true;
              }
            }
            q = nq;
          }
        }
        return false;
      }
      // 唯一解の原則（ユニークレクタングル）：2つのブロックにまたがる長方形の4マスが同じ2つの候補 a・b だけになると答えが2通りになるので、そうならないように消す
      // タイプ1：3マスが a・b だけ → 残る1マスの a・b を消す
      // タイプ2：2マスが a・b だけ、残る2マス（同じ行か列）が a・b・x → 2マスの両方から見えるマスの x を消す
      // タイプ4：2マスが a・b だけ、残る2マス（同じ行か列）で、その行（列）の a がこの2マスにしか入らない → この2マスの b を消す
      function uniqueRect() {
        for (let r1 = 0; r1 < 9; r1++) for (let r2 = r1 + 1; r2 < 9; r2++) for (let c1 = 0; c1 < 9; c1++) for (let c2 = c1 + 1; c2 < 9; c2++) {
          const four = [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2];
          if (new Set(four.map(boxOf)).size !== 2 || four.some((i) => v[i])) continue;
          const ds = bits(four.reduce((m, i) => m & cand[i], ALL));
          for (let x = 0; x < ds.length; x++) for (let y = x + 1; y < ds.length; y++) {
            const a = ds[x], b = ds[y], ab = (1 << a) | (1 << b);
            const two = four.filter((i) => cand[i] === ab), rest = four.filter((i) => cand[i] !== ab);
            if (two.length === 3) { if (elim(rest[0], ab)) return true; continue; }
            if (two.length !== 2) continue;
            const [p, q] = rest;
            if (rowOf(p) !== rowOf(q) && colOf(p) !== colOf(q)) continue;  // 対角の2マスは対象外
            let ch = false;
            const xp = cand[p] & ~ab;
            if (xp === (cand[q] & ~ab) && pop(xp) === 1) {
              for (let i = 0; i < 81; i++) if (i !== p && i !== q && sees(i, p) && sees(i, q)) ch = elim(i, xp) || ch;
              if (ch) return true;
            }
            const us = units.filter((u) => u.includes(p) && u.includes(q));
            for (const [d, e] of [[a, b], [b, a]]) {
              if (!us.some((u) => u.every((i) => i === p || i === q || !(cand[i] & (1 << d))))) continue;
              ch = elim(p, 1 << e) || ch;
              ch = elim(q, 1 << e) || ch;
              if (ch) return true;
            }
          }
        }
        return false;
      }
      // リモートペア：候補が同じ2つ（a・b）のマスが4つ以上つながるとき、交互に a・b が入るので、
      // 違う側のマスの両方から見えるマスの a・b を消す
      function remotePair() {
        const bi = biCells(), done = new Set();
        for (const s0 of bi) {
          if (done.has(s0)) continue;
          const color = new Map([[s0, 0]]), order = [s0];
          let ok = true;
          for (let q = 0; q < order.length; q++) for (const j of bi) {
            const i = order[q];
            if (cand[j] !== cand[s0] || !sees(i, j)) continue;
            if (!color.has(j)) { color.set(j, 1 - color.get(i)); order.push(j); } else if (color.get(j) === color.get(i)) ok = false;
          }
          order.forEach((i) => done.add(i));
          if (!ok || order.length < 4) continue;
          let ch = false;
          for (let i = 0; i < 81; i++) {
            if (color.has(i)) continue;
            if (order.some((j) => color.get(j) === 0 && sees(i, j)) && order.some((j) => color.get(j) === 1 && sees(i, j))) ch = elim(i, cand[s0]) || ch;
          }
          if (ch) return true;
        }
        return false;
      }
      // 解き方の名前 → 候補を消す計算（消せたら true）。名前は 01a-levels.js の TECHNIQUES と同じにする
      // （「注目するマス」= singles() と「背理法」= contra() は別に扱う）
      const SOLVERS = {
        "ポインティング": pointing, "クレーミング": claiming, "2つの数字のペア": pairs,
        "3つの数字の組": triples, "Xウイング": xWing, "スカイスクレイパー": skyscraper,
        "4つの数字の組": quads, "ソードフィッシュ": swordfish, "XYウイング": xyWing, "XYZウイング": xyzWing, "唯一解の原則": uniqueRect,
        "シンプルカラーリング": coloring, "リモートペア": remotePair, "XYチェーン": xyChain, "チェーン": chain,
      };
      // レベルの低い順に並べる（同じレベルの中は TECHNIQUES の並び順のまま）
      const TECHS = rules.techniques.filter((t) => SOLVERS[t.name]).map((t) => ({ ...t, run: SOLVERS[t.name] })).sort((x, y) => x.lv - y.lv);
      // 1つの解き方で候補を消せたら、そのレベルを返す（どれも使えなければ 0）
      function advance() {
        for (const t of TECHS) {
          tech = t.name; techLv = t.lv;
          if (t.run()) return t.lv;
        }
        return 0;
      }
      if (start) {
        // 答えの決まるマスが出るまで、やさしい解き方から順に候補を消していく（マスに数字は入れない）
        for (let step = 0; step < 200; step++) {
          for (let i = 0; i < 81; i++) if (!v[i] && pop(cand[i]) === 1) return { log, i, d: bits(cand[i])[0], how: "cell" };
          for (let k = 0; k < units.length; k++) for (let d = 1; d <= 9; d++) {
            const u = units[k];
            if (u.some((i) => v[i] === d)) continue;
            const w = where(u, d);
            if (w.length === 1) return { log, i: w[0], d, how: "unit", unit: k };
          }
          if (!advance()) break;
        }
        return { log, stuck: true };
      }
      // grade.steps（timing のとき）: 1手ごとのヒントレベル。目標完成時間の計算に使う
      // 難易度: 初級 = シングル（レベル1）だけ、中級 = レベル2〜3、難問 = レベル4〜5 の解き方が必要。最難関 = 背理法（レベル6）が必要
      const steps = [];
      grade.steps = steps;
      // 背理法: 候補が2つのマスに片方を仮に入れ、シングルだけで進めて矛盾が出たら、その候補を消す
      function contra() {
        for (let i = 0; i < 81; i++) {
          if (v[i] || pop(cand[i]) !== 2) continue;
          for (const d of bits(cand[i])) {
            const v2 = v.slice(), c2 = cand.slice();
            const put = (j, x) => { v2[j] = x; c2[j] = 0; for (const p of peers[j]) c2[p] &= ~(1 << x); };
            put(i, d);
            let bad = false, ch = true;
            while (ch && !bad) {
              ch = false;
              for (let j = 0; j < 81 && !bad; j++) if (!v2[j]) { if (!c2[j]) bad = true; else if (pop(c2[j]) === 1) { put(j, bits(c2[j])[0]); ch = true; } }
              for (const u of units) for (let x = 1; x <= 9 && !bad; x++) {
                if (u.some((j) => v2[j] === x)) continue;
                const w = u.filter((j) => !v2[j] && (c2[j] & (1 << x)));
                if (!w.length) bad = true; else if (w.length === 1) { put(w[0], x); ch = true; }
              }
            }
            if (bad) { cand[i] &= ~(1 << d); return true; }
          }
        }
        return false;
      }
      let level = 1;
      for (;;) {
        if (v.every((x) => x)) return level;
        for (let i = 0; i < 81; i++) if (!v[i] && !cand[i]) { steps.length = 0; return TOP; }
        if (singles()) { steps.push(1); continue; }
        const k = advance();
        if (k) { level = Math.max(level, diffOf(k)); steps.push(k); continue; }
        if (timing) {
          if (contra()) { steps.push(CONTRA_LV); continue; }
          // 仮に置いてシングルだけでは矛盾が見つからないとき: 正解が分かっていれば、候補の一番少ないマスを背理法1手で決める
          if (timing.length === 81) {
            let best = -1;
            for (let i = 0; i < 81; i++) if (!v[i] && (cand[i] & (1 << +timing[i])) && (best < 0 || pop(cand[i]) < pop(cand[best]))) best = i;
            if (best >= 0) { place(best, +timing[best]); steps.push(CONTRA_LV); continue; }
          }
          for (let k = v.filter((x) => !x).length; k > 0; k--) steps.push(CONTRA_LV);
        }
        // 背理法を使わずに進めなくなった。最難関は、このとき minLeft マス以上残っているものだけ（少なければ TOP - 0.5 = どのレベルにもしない）
        return v.filter((x) => !x).length >= EXTREME.minLeft ? TOP : TOP - 0.5;
      }
    }
    // 1回だけ作ってみる。レベルが合えば問題（81桁の文字列）、合わなければ null
    function attempt(level) {
      const g = full();
      const sol = g.slice();
      let left = 81;
      for (const i of shuffle([...Array(81).keys()])) {
        if (left <= rules.difficulties[level - 1].minGivens) break;
        const keep = g[i];
        g[i] = 0;
        if (count(g, 2) !== 1 || (level < TOP && grade(g) > level)) g[i] = keep;
        else left--;
      }
      if (grade(g) !== level) return null;
      // 最難関は問題の数字を maxGivens 個以下にする。1つ足して、ほかを消せるだけ消し、最難関のまま数が減れば採り入れる
      if (level === TOP) {
        if (left > EXTREME.maxGivens + 2) return null;
        for (let step = 0; step < 200 && left > EXTREME.maxGivens; step++) {
          const blank = [...Array(81).keys()].filter((i) => !g[i]);
          const a = blank[Math.floor(Math.random() * blank.length)];
          const h = g.slice();
          h[a] = sol[a];
          for (const b of shuffle([...Array(81).keys()].filter((i) => h[i] && i !== a))) {
            const x = h[b];
            h[b] = 0;
            if (count(h, 2) !== 1) h[b] = x;
          }
          const hl = h.filter((x) => x).length;
          if (hl <= left && grade(h) === TOP) { g.splice(0, 81, ...h); left = hl; }
        }
        if (left > EXTREME.maxGivens) return null;
        // レベル highLv 以上の手（背理法も数える）が minHighSteps 回より少ない問題は、最難関にしない
        grade(g, null, sol);
        if (grade.steps.filter((k) => k >= EXTREME.highLv).length < EXTREME.minHighSteps) return null;
      }
      return g.join("");
    }
    // 頼まれた問題を先に作り、手が空いたら最難関を探してストックに回す
    const jobs = [];
    let hunt = false, busy = false;
    function tick() {
      busy = false;
      const job = jobs[0];
      if (job) {
        const p = attempt(job.level);
        if (p) { jobs.shift(); self.postMessage({ type: "made", id: job.id, level: job.level, givens: p }); }
      } else if (hunt) {
        const p = attempt(TOP);
        if (p) self.postMessage({ type: "stock", givens: p });
      } else return;
      busy = true;
      setTimeout(tick, 0);
    }
    const kick = () => { if (!busy) { busy = true; setTimeout(tick, 0); } };
    self.onmessage = (e) => {
      const m = e.data || {};
      if (m.type === "make") jobs.push({ id: m.id, level: m.level });
      else if (m.type === "cancel") { const k = jobs.findIndex((j) => j.id === m.id); if (k >= 0) jobs.splice(k, 1); }
      else if (m.type === "hunt") hunt = !!m.on;
      kick();
    };
    return { grade, count, attempt };
  }

