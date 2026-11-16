// node tools/test-contradiction.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const config = read('src/js/01a-levels.js');
const source = read('src/js/15-puzzle-maker.js');
const timingSource = read('src/js/03-solve-modes.js').match(/  function targetSeconds\(levels\) \{[\s\S]*?\n  \}/)[0];
const { rules, targetSeconds } = new Function(config + timingSource + '\nreturn {rules: GEN_RULES, targetSeconds};')();
// Track only the existing oracle fallback; assertions below inspect the production proof and timing paths.
let instrumented = source.replace('function grade(g, start, timing, trial = false) {',
  'function grade(g, start, timing, trial = false) { if(timing) grade.audit={oracle:0,proofs:[]};');
instrumented = instrumented.replace('if (best >= 0) { place(best, +timing[best]);',
  'if (best >= 0) { grade.audit.oracle++; place(best, +timing[best]);');
instrumented = instrumented.replace('if (proof) {\n            cand[proof.i]',
  'if (proof) { grade.audit.proofs.push({proof,offset:steps.length,state:{v:v.slice(),cand:cand.slice()}});\n            cand[proof.i]');
instrumented = instrumented.replace('if (v.every((x) => x)) return level;',
  'if (v.every((x) => x)) { if(timing)grade.audit.solved=v.join(""); return level; }');
const engine = new Function(instrumented + '\nreturn sudokuGen({postMessage(){}}, arguments[0]);')(rules);
const cases = JSON.parse(read('tools/fixtures/extreme-50.json'));
let referenceCases = 0, references = 0, proofs = 0, advancedProofs = 0;
const logicalLevels = new Set(rules.techniques.filter((t) => t.name !== '背理法').map((t) => t.lv));
let strongerProofs = 0, formerlyUnsolved = false;
for (const [index, item] of cases.entries()) {
  engine.grade([...item.givens].map(Number), null, [...item.solution].map(Number));
  const { audit, steps } = engine.grade;
  assert.equal(audit.oracle, item.oracleReferences, `oracle count, puzzle ${index + 1}`);
  assert.equal(audit.solved, item.solution, `complete solution, puzzle ${index + 1}`);
  assert.ok(steps.every((lv) => lv >= 1 && lv <= 6));
  const total = steps.reduce((sec, lv) => sec + ({1:5,2:90,3:180,4:300,5:420,6:600}[lv]), 0);
  assert.equal(targetSeconds(steps), total);
  if (audit.oracle) referenceCases++;
  references += audit.oracle;
  for (const { proof, state, offset } of audit.proofs) {
    assert.deepEqual(steps.slice(offset, offset + 1 + proof.steps.length), [6, ...proof.steps]);
    proofs++;
    assert.notEqual(proof.d, +item.solution[proof.i], `removed correct candidate, puzzle ${index + 1}`);
    assert.equal(proof.answer, +item.solution[proof.i]);
    assert.ok(proof.steps.every((lv) => logicalLevels.has(lv)), 'trial must use logical techniques without another hypothesis');
    assert.ok(proof.log.every((entry) => logicalLevels.has(entry.lv)));
    if (proof.steps.some((lv) => lv > 1)) advancedProofs++;
    if (proof.steps.some((lv) => lv > 3)) strongerProofs++;
    if (index === 9 && proof.steps.includes(5)) formerlyUnsolved = true;
    const before = JSON.stringify(state);
    const stepsBefore = engine.grade.steps;
    assert.deepEqual(engine.contradiction(state), proof, 'hint and grading must find the same proof');
    assert.equal(JSON.stringify(state), before, 'hypothesis must not change the actual board');
    assert.strictEqual(engine.grade.steps, stepsBefore, 'trial must not overwrite main timing');
  }
}
assert.equal(referenceCases, 0);
assert.equal(references, 0);
assert.ok(advancedProofs > 0);
assert.ok(strongerProofs > 0, 'proofs must be allowed to use level 4 and 5');
assert.ok(formerlyUnsolved, 'the previously unresolved puzzle must use level 5 without an oracle');
assert.equal(targetSeconds([6, 1, 2, 3]), 875);
assert.equal(targetSeconds([6, 6]), 1200, 'every new assumption costs 10 minutes');
assert.equal(targetSeconds([6, 1, 6, 2]), 1295);
assert.equal(targetSeconds([1, 2, 3, 4, 5]), 995);
assert.equal(targetSeconds([]), 0);
// A completed valid grid neither needs a hypothesis nor adds time.
const solved = [...cases[0].solution].map(Number);
assert.equal(engine.contradiction({v: solved, cand: Array(81).fill(0)}), null);
engine.grade(solved, null, solved);
assert.deepEqual(engine.grade.steps, []);
console.log(JSON.stringify({puzzles: cases.length, referenceCases, references, proofs, advancedProofs, strongerProofs}));
