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
let instrumented = source.replace('function grade(g, start, timing, trialMaxLevel = 0) {',
  'function grade(g, start, timing, trialMaxLevel = 0) { if(timing) grade.audit={oracle:0,proofs:[]};');
instrumented = instrumented.replace('if (best >= 0) { place(best, +timing[best]);',
  'if (best >= 0) { grade.audit.oracle++; place(best, +timing[best]);');
instrumented = instrumented.replace('if (proof) {\n            cand[proof.i]',
  'if (proof) { grade.audit.proofs.push({proof,offset:steps.length,state:{v:v.slice(),cand:cand.slice()}});\n            cand[proof.i]');
const engine = new Function(instrumented + '\nreturn sudokuGen({postMessage(){}}, arguments[0]);')(rules);
const cases = JSON.parse(read('tools/fixtures/extreme-50.json'));
let referenceCases = 0, references = 0, proofs = 0, advancedProofs = 0;
for (const [index, item] of cases.entries()) {
  engine.grade([...item.givens].map(Number), null, [...item.solution].map(Number));
  const { audit, steps } = engine.grade;
  assert.equal(audit.oracle, item.oracleReferences, `oracle count, puzzle ${index + 1}`);
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
    assert.ok(proof.steps.every((lv) => lv >= 1 && lv <= 3), 'trial must use only level 1–3');
    assert.ok(proof.log.every((entry) => entry.lv <= 3));
    if (proof.steps.some((lv) => lv > 1)) advancedProofs++;
    const before = JSON.stringify(state);
    const stepsBefore = engine.grade.steps;
    assert.deepEqual(engine.contradiction(state), proof, 'hint and grading must find the same proof');
    assert.equal(JSON.stringify(state), before, 'hypothesis must not change the actual board');
    assert.strictEqual(engine.grade.steps, stepsBefore, 'trial must not overwrite main timing');
  }
}
assert.equal(referenceCases, 1);
assert.equal(references, 1);
assert.ok(advancedProofs > 0);
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
console.log(JSON.stringify({puzzles: cases.length, referenceCases, references, proofs, advancedProofs}));
