  // ===== 01a-levels.js：ヒントのレベル・目標完成時間・自動作成の難易度の決まり =====
  // （src/js/ の全ファイルで1つの (function () { … })(); になる。まとめ方は tools/build.py）
  //
  // ★ レベルや時間の調整は、このファイルだけを書きかえればよい ★
  //   ここで決めたことは、次のすべてにそのまま使われる。
  //   ・ヒントメニューの★の数と並び順（08-highlight-hintmenu-view.js）
  //   ・ヒントポイント、「ヒントを控える」の判定、「答えと理由」の理由のレベル（10-hints-advanced.js）
  //   ・目標完成時間（03-solve-modes.js）
  //   ・自動作成の難易度分けと、難易度の説明文（15-puzzle-maker.js・16-generator.js）
  //
  // 問題を作る計算は裏の Worker でも動くので、ここの値は JSON にして渡す（関数は書かない）。

  // 解き方とヒントのレベル。name はヒントメニューの名前と同じにする。
  // 自動作成と目標時間の計算では、1手ごとにレベルの低いものから順に試す（同じレベルの中はこの並び順）。
  // 新しい解き方を足すときは、ここに1行足し、15-puzzle-maker.js の SOLVERS に同じ名前の計算を足す。
  const TECHNIQUES = [
    { name: "注目するマス", lv: 1 },  // シングル（そのマスに入る数字が1つだけ／そこにしか入らない）
    { name: "ポインティング", lv: 2 },
    { name: "クレーミング", lv: 2 },
    { name: "2つの数字のペア", lv: 2 },
    { name: "3つの数字の組", lv: 3 },
    { name: "Xウイング", lv: 3 },
    { name: "スカイスクレイパー", lv: 3 },
    { name: "4つの数字の組", lv: 4 },
    { name: "ソードフィッシュ", lv: 4 },
    { name: "XYウイング", lv: 4 },
    { name: "XYZウイング", lv: 4 },
    { name: "唯一解の原則", lv: 4 },
    { name: "シンプルカラーリング", lv: 5 },
    { name: "リモートペア", lv: 5 },
    { name: "XYチェーン", lv: 5 },
    { name: "チェーン", lv: 5 },
    { name: "背理法", lv: 6 },
  ];
  const TECH_LV = Object.fromEntries(TECHNIQUES.map((t) => [t.name, t.lv]));

  // 目標完成時間：1手ごとに、その手のレベルの秒数を足す
  const TARGET_SEC = { 1: 5, 2: 90, 3: 180, 4: 300, 5: 420, 6: 600 };

  // 自動作成の難易度。maxLv = 使ってよい一番高いレベル（その1つ下の難易度の maxLv より上のレベルが、少なくとも1手は必要）
  // minGivens = 問題の数字をこれより少なくはしない
  const DIFFICULTIES = [
    { label: "初級", maxLv: 1, minGivens: 36 },
    { label: "中級", maxLv: 3, minGivens: 26 },
    { label: "難問", maxLv: 5, minGivens: 22 },
    // 最難関 = 背理法が必要。問題の数字は maxGivens 個以下、背理法以外で解き進めて minLeft マス以上残り、
    // レベル highLv 以上の手を minHighSteps 回以上使うもの
    { label: "最難関", maxLv: 6, minGivens: 17, maxGivens: 21, minLeft: 15, highLv: 4, minHighSteps: 4 },
  ];

  // 問題を作る計算（sudokuGen）に渡す決まり
  const GEN_RULES = { techniques: TECHNIQUES, difficulties: DIFFICULTIES };
