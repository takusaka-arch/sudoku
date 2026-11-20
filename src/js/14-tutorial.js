  // ===== 14-tutorial.js：使い方ガイド（初級編・中級編・上級編）と、見本の写真でのお試し =====
  // （src/js/ の全ファイルで1つの (function () { … })(); になる。まとめ方は tools/build.py）
  // ---- 使い方ガイド: 小さな盤で実際にタップを試しながら、1つずつ説明する ----
  const TUT_KEY = "sudoku-tutorial-hide";
  const tutEl = document.getElementById("tut");
  const tutDemo = document.getElementById("tut-demo");
  const tutStatus = document.getElementById("tut-status");
  const tutHide = document.getElementById("tut-hide");
  // パソコン（マウス）ではクリック、スマホ・タブレットではタップと表示する
  const isMouse = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const TAP = isMouse ? "クリック" : "タップ";
  const TAP1 = isMouse ? "1回クリック" : "1回タップ";
  const TAP2 = isMouse ? "ダブルクリック" : "ダブルタップ";
  const TAP3 = isMouse ? "トリプルクリック" : "トリプルタップ";
  const MENU = isMouse ? "右クリック" : "長押し";
  // cells: 小さな盤のマス（数字 = 問題の数字）、target: 試してほしい候補 [マス, 数字]、goal: できたかの判定
  const tutSteps = [
    { part: 0, title: "使い方ガイド", text: "使い方を、実際に試しながら説明します。どこから見ますか？", pick: true },
    { title: "1. 問題を登録する", text: `初級編（7ステップ）です。\n\n最初の画面の「問題を作る・登録する」から、次のどれかで問題を入れます。\n・自分で作る：数字を手で入力する（写真から読み取ることもできます）\n・自動で作る：レベルと問題の数字の数（17〜25個）を選ぶと新しい問題ができます。20個以下の問題は、アプリを開いている間に裏で作り置きします\n・問題ファイルを読み込む\n\n手で入力するときは、小さな数字を${TAP}すると問題の数字になります。全部入れたら「問題登録完了」→「回答スタート」です。`, part: 1,
      cells: [0], register: true, target: [0, "3"], ask: `下のマスの「3」を${TAP}して、問題の数字として入れてみてください。`,
      goal: (d) => d.cell(0).dataset.value === "3", ok: "できました！ 問題の数字が入りました。" },
    { part: 1, title: `2. まずは数字を${MENU}`, text: `解くときは、小さな数字を${MENU}します。メニューが出るので、行いたい操作を選んでください。\nメニューの「○ と仮定する」（仮定モード）は、上級編で説明します。`, pressDemo: true },
    { part: 1, title: "3. 候補を選ぶ・確定候補にする", text: `メニューの「候補（青）にする」で青くなります（候補の印）。紙で解くときの「メモ」と同じ働きで、入りそうな数字に印を付けておけます。\n「確定候補にする」で大きな青い数字になります（確定候補）。大きな数字を${MENU}して「確定候補から外す」を選ぶと戻ります。`,
      cells: [0], target: [0, "7"], menu: true, ask: `「5」を${MENU}して候補（青）にしてから、「7」を${MENU}して確定候補にしてください。`,
      goal: (d) => d.cand(0, "5").classList.contains("pick") && d.cell(0).classList.contains("tent"), ok: "できました！ 青い数字が候補、大きな青い数字が確定候補です。" },
    { part: 1, title: "4. 候補を消す", text: `小さな数字を${MENU}して「候補から消す」を選ぶと、その数字が消えます。同じ行・列・ブロックに同じ数字が確定していれば、まとめて消えます。\n確定している大きな数字を${MENU}すると「行・列・ブロックの○の候補を消す・戻す」が出て、同じ行・列・ブロックの同じ数字の候補をまとめて消せます。\nどちらも、もう一度選ぶと戻ります。`,
      cells: ["5", 0, 0], target: [1, "5"], menu: true, ask: `左に「5」が確定しています。真ん中のマスの小さな「5」を${MENU}して「5 を候補から消す」を選ぶか、左の大きな「5」を${MENU}して「行・列・ブロックの 5 の候補を消す・戻す」を選んでください。`,
      goal: (d) => d.cand(1, "5").classList.contains("off") && d.cand(2, "5").classList.contains("off"), ok: "できました！ この行の「5」がまとめて消えました。" },
    { part: 1, title: "5. 「1手戻す」で取り消す", text: "まちがえたときは「1手戻す」ボタンを押すと、1つ前の操作に戻ります。何回でも戻れます。\n\n間違って消した候補は、マスを選んで「候補を復活」（またはメニューの「このマスの消した候補を復活」）でも戻せます。",
      cells: [0], target: [0, "4"], menu: true, undo: true, ask: `「4」を${MENU}して「4 を候補から消す」を選んでから、下の「1手戻す」を押して元に戻してください。`,
      goal: (d) => d.undone && !d.cand(0, "4").classList.contains("off"), ok: "できました！ 「1手戻す」で1つ前に戻りました。" },
    { part: 1, title: "6. 数字をハイライトする", text: `盤の下の1〜9を${TAP}すると、その数字が入る可能性のある候補が点滅し、確定している同じ数字に色が付きます。\n続けて別の数字を${TAP}すると、別の色で4つまで同時に表示できます。もう一度${TAP}でその数字だけ止まります。\n盤に9つそろった数字は、押せなくなります。` },
    { part: 1, title: "7. 自動保存と、解き始め", text: "解いている途中の状態は、この端末に自動で保存されます。アプリを閉じても、次に開くと続きから始まります。\n「一時停止」でタイマーを止められます。\n\nこれで解き始められます。速く解く操作や、ヒント・保存などは中級編で説明します（アプリ名の右の「？」ボタンからいつでも見られます）。", fork: true },
    { part: 2, title: "ようこそ（中級編）", text: `慣れてきたら、${MENU}でメニューから選ぶより、${TAP}の回数で操作するほうが速くて効率的です。\n\n・${TAP1}：候補を選ぶ\n・${TAP2}：確定候補にする\n・${TAP3}：候補を消す\n\n次のページから、実際に試してみましょう。${MENU}のメニューも、これまでどおり使えます。` },
    { part: 2, title: `${TAP1}：候補を選ぶ`, text: `小さな数字を${TAP1}すると青くなります（候補の印）。もう${TAP1}で戻ります。`,
      cells: [0], target: [0, "5"], ask: `下のマスの「5」を${TAP1}してみてください。`,
      goal: (d) => d.cand(0, "5").classList.contains("pick") && !d.cell(0).classList.contains("tent"), ok: "できました！ 青い数字が候補です。" },
    { part: 2, title: `${TAP2}：確定候補にする`, text: `小さな数字を${TAP2}すると、大きな青い数字になります（確定候補）。もう一度${TAP2}で戻ります。`,
      cells: [0], target: [0, "7"], ask: `「7」を${TAP2}してみてください。`,
      goal: (d) => d.cell(0).classList.contains("tent"), ok: "できました！ 大きな青い数字が確定候補です。" },
    { part: 2, title: `${TAP3}：候補を消す`, text: `小さな数字を${TAP3}すると、その数字が消えます。\n同じ行・列・ブロックに同じ数字が確定していれば、まとめて消えます。もう一度${TAP3}で戻ります。`,
      cells: ["5", 0, 0], target: [1, "5"], ask: `左に「5」が確定しています。真ん中のマスの「5」を${TAP3}してみてください。`,
      goal: (d) => d.cand(1, "5").classList.contains("off") && d.cand(2, "5").classList.contains("off"), ok: "できました！ この行の「5」がまとめて消えました。" },
    { part: 2, title: `大きな数字を${TAP3}`, text: `大きな数字を${TAP3}すると、同じ行・列・ブロックにある同じ数字の候補がまとめて消えます。`,
      cells: ["8", 0, 0], target: [0, "8"], ask: `左の大きな「8」を${TAP3}してみてください。`,
      goal: (d) => d.cand(1, "8").classList.contains("off") && d.cand(2, "8").classList.contains("off"), ok: "できました！ ほかのマスの「8」が消えました。" },
    { part: 2, title: "問題を作る：写真から読み取る", text: `「写真から問題を読み取る」で、撮影・画像ファイル・貼り付けのどれかを選びます。\n四隅のオレンジの丸を盤の角に合わせて「読み取る」を押します。\n読み取った数字は写真と見比べて、まちがいを直してください。自信のない数字には「?」が付きます。\n\nコツ：真上から明るい場所で撮る`,
      tryPhoto: true },
    { part: 2, title: "ヒント", text: "「ヒント」で、解き方を選べます。右の★の数がレベルです。\n各行の「？」を押すと、その解き方の説明が出ます。\n「答えと理由」で入る数字と理由が分かり、「ヒントを消す」で表示を消せます。\n\n使った回数はタイマーの右に出ます。" },
    { part: 2, title: "ファイルとGoogleドライブに保存", text: "別の日や別の端末で続きを解くときは、端末の外に保存します。\n・ファイルに保存：「この状態を保存」→「ファイルに保存」（保存先がGoogleドライブを優先のときは「Googleドライブに保存」）。開くときは「問題を解く」→「回答中のファイルを開く」\n・Googleドライブ：🏠→「設定」で「Googleドライブに接続」し、保存先を選びます（Googleドライブを優先／保存のたびに選ぶ／この端末）。Googleドライブには「Sudoku」フォルダに保存されます。PCとスマホで同じ問題の続きを解けます\n・開くときは「問題を解く」→「Googleドライブから開く」（接続しているときだけ出ます）。問題ごとに、問題・回答の途中・完成形が並びます\n\nGoogleドライブはアプリ版・Web版で使えます。" },
    { part: 2, title: "完成したら", text: "全マスが大きな数字で埋まり、赤がなければ完成です。\n・答え合わせ：途中でも、確定したマスを正解と比べ、違うマスを赤い背景で示します\n・再生：確定した順に数字を再生します（解いている途中でも使えます）\n・完成形を保存：完成した盤をファイルやGoogleドライブに残します\n・一覧の「完成を見る」：あとから完成した盤を開けます" },
    { part: 2, title: "色の意味", text: "数字の色の意味です。", colors: [
      ["blue", "5", "青", "選んだ候補"],
      ["red", "3", "赤", "数字の重複"],
      ["brown", "6", "茶", "入らない候補"],
    ] },
    { part: 2, title: "ボタン", text: "【よく使う操作】\n1手戻す：1つ前の操作に戻す（パソコンは Ctrl+Z でも可）\nヒント：次に使える解き方を示す\n答え合わせ：確定したマスを正解と比べる\n\n【状態の管理】\nこの状態を保存：その時点を残す\n保存した状態に戻す：残した時点に戻る\n再生：確定した順に数字を再生する\n\n【その他の操作】\n表示方法変更：未確定のマスを空白／候補を表示／正解を表示\nリセット：問題だけの最初の状態に戻す\n問題一覧へ：問題の一覧に戻る\n\n一時停止：タイマーを止める。一時停止中は保存とその他の操作（表示方法変更を除く）だけ使えます\n\n" + (matchMedia("(hover: hover) and (pointer: fine)").matches ? "ボタンにマウスを乗せると" : "ボタンを長押しすると") + "、説明が出ます" },
    { part: 2, title: "準備ができました", text: "難しい問題で使う「仮定モード」や、81桁の盤面データ・LINEなどで送る方法は、上級編で説明します。\nこのガイドは、アプリ名の右の「？」ボタンからいつでも見られます。", last: true, toAdv: true },
    { part: 3, title: "ようこそ（上級編）", text: "上級編では、仮定モードと、問題のやりとり（81桁の盤面データ・LINEなどで送る）を説明します。\n\n難しい問題で、ヒントの解き方だけでは先に進めないときは「仮定モード」が使えます。\n\nあるマスに数字を仮に入れて先を試し、矛盾が出たら「その数字は入らない」と分かります（背理法）。紙で解くときに、鉛筆で薄く書いて試すのと同じです。" },
    { part: 3, title: "1. 仮定を始める", text: `小さな数字を${MENU}して、メニューの「○ と仮定する」（紫の文字）を選びます。\n\n盤の外枠が紫になり、仮定したマスは紫の数字になります。そのあとに入れた確定候補は紫の数字、変えた候補は紫の枠で表示されます。`, asmDemo: true },
    { part: 3, title: "2. 仮定しているあいだ", text: "・仮定できるのは1つだけです（仮定の中でさらに仮定はできません）\n・「1手戻す」で戻れるのは、仮定した直後までです\n・ヒント・答え合わせ・保存・リセットなどは使えません。タイマーは動き続けます\n・同じ数字が重なる、入る数字がないマスができる、入る場所がない数字ができる、のどれかになると、赤い字で「矛盾が見つかりました」と出ます" },
    { part: 3, title: "3. 仮定を終える", text: "盤の右（スマホは下）の「仮定モード」の枠で選びます。\n・仮定を採用する：今の盤のまま続けます。全部埋まっていれば完成になります\n・仮定前に戻る：仮定する前の盤に戻します\n・仮定前に戻り、この数字を除外：仮定前に戻し、仮定した数字をそのマスの候補から消します。矛盾が出たときに使います\n\n矛盾が出ても、仮定のあとの入力にまちがいがないか確かめてから使ってください。\n仮定中にホームへ移ったりアプリを閉じたりすると、仮定前の盤が保存されます。" },
    { part: 3, title: "4. 81桁の盤面データ", text: "問題を、上の行から順に81個の数字（空きマスは0）で表したものです。ほかの数独アプリやWebサイトとの問題のやりとりに使えます。\n\n【書き出す】\n「その他の操作」の「問題を書き出す」→「🔢 81桁の盤面データ」を選び、「コピーする」を押します。解いている途中でも使えます。書き出すのは最初の問題の数字だけです。\n\n【読み込む】\n最初の画面の「問題を作る・登録する」→「自分で作る」で、盤の下の「81桁の盤面データを読み込む」の欄に貼り付けて「読み込む」を押します。空きマスは 0 か . で、空白や改行は無視されます。数字を確かめてから「問題登録完了」を押してください。" },
    { part: 3, title: "5. LINEなどで送る", text: "問題を、LINEなどで友だちに送れます。\n\n【送り方】\n・解いている途中：「問題を書き出す」→「💬 LINEなどに送る」\n・完成したとき：完成のお知らせの画面か、「問題図を送る」ボタン\n\nスマホは共有メニューが開くので、LINEを選んで相手を選びます。パソコンは「画像をコピー」「文をコピー」を押して、LINEのトークにそれぞれ貼り付けます。\n\n【送られる内容】\n最初の数字だけの問題図と、標準回答時間・81桁の盤面データ・問題を開くリンクです。完成したときは、かかった時間とヒントの回数も入ります。途中まで解いた内容は送られません。\n\n【受け取った人】\nリンクを開くと、このアプリにその問題が入り、すぐ解き始められます。LINEから開くと、ふだん使っているブラウザで開きます。", last: true },
  ];
  let tutIdx = 0, tutTap = { el: null, n: 0, t: null };
  let tutBeforeTap = null;
  function demoApi(cells) {
    return { cell: (i) => cells[i], cand: (i, n) => cells[i].querySelector(`.cand[data-n="${n}"]`) };
  }
  // 正しい操作ができたら「できました！ 次の操作へ進みましょう。」と、その操作で起きたことを表示する
  function showTutOk(st) {
    tutStatus.classList.add("ok");
    tutStatus.textContent = "";
    const head = document.createElement("span");
    head.className = "tut-done";
    head.textContent = "できました！ 次の操作へ進みましょう。";
    const why = document.createElement("span");
    why.className = "tut-why";
    why.textContent = st.ok.replace(/^できました！\s*/, "");
    tutStatus.append(head, why);
  }
  function renderTut() {
    const st = tutSteps[tutIdx];
    // 初級編・中級編ごとに「何ページ目か」を出す
    const same = tutSteps.filter((x) => x.part === st.part);
    document.getElementById("tut-step").textContent = st.part === 0 ? "" : `${["", "初級編", "中級編", "上級編"][st.part]}　${same.indexOf(st) + 1} / ${same.length}`;
    closeTutMenu();
    document.getElementById("tut-title").textContent = st.title;
    document.getElementById("tut-text").textContent = st.text;
    document.getElementById("tut-prev").disabled = tutIdx === 0;
    document.getElementById("tut-next").textContent = st.last ? "はじめる" : "次へ";
    document.getElementById("tut-next").hidden = !!st.fork;
    document.getElementById("tut-skip").hidden = !!(st.last || st.fork);
    document.getElementById("tut-hide-wrap").hidden = !(st.last || st.fork);
    tutStatus.classList.remove("ok");
    tutStatus.textContent = st.ask || "";
    tutDemo.innerHTML = "";
    tutBeforeTap = null;
    // 初級編の終わり: 中級編に進むか、使ってみるかを選ぶ
    if (st.fork) {
      const box = document.createElement("div");
      box.className = "row tut-fork";
      const go2 = document.createElement("button");
      go2.type = "button";
      go2.className = "btn";
      go2.textContent = "中級編に進む";
      go2.addEventListener("click", () => { tutIdx = tutSteps.findIndex((x) => x.part === 2); renderTut(); });
      const use = document.createElement("button");
      use.type = "button";
      use.className = "btn sub";
      use.textContent = "使ってみる";
      use.addEventListener("click", closeTutorial);
      box.append(go2, use);
      tutDemo.appendChild(box);
    }
    // 最初のページ: 初級編・中級編・上級編から選ぶ
    if (st.pick) {
      const box = document.createElement("div");
      box.className = "gen-levels tut-pick";
      for (const [part, name, desc] of [[1, "初級編", "メニューで操作する基本（7ステップ）"], [2, "中級編", "タップの回数で速く操作する・ヒント・保存など"], [3, "上級編", "仮定モード・81桁の盤面データ・LINEなどで送る"]]) {
        const b = document.createElement("button");
        b.type = "button";
        b.innerHTML = `${name}<small>${desc}</small>`;
        b.addEventListener("click", () => { tutIdx = tutSteps.findIndex((x) => x.part === part); renderTut(); });
        box.appendChild(b);
      }
      tutDemo.appendChild(box);
    }
    if (st.toAdv) {
      const j = document.createElement("button");
      j.type = "button";
      j.className = "btn sub small";
      j.textContent = "上級編に進む";
      j.addEventListener("click", () => { tutIdx = tutSteps.findIndex((x) => x.part === 3); renderTut(); });
      tutDemo.appendChild(j);
    }
    // 上級編: 仮定モードの見本（メニューの紫の項目と、仮定中の盤の見え方）
    if (st.asmDemo) {
      const wrap = document.createElement("div");
      wrap.className = "tut-press";
      const r3 = document.createElement("div");
      r3.className = "row3 tut-asm";
      const mk = (big, cls) => {
        const c = document.createElement("div");
        c.className = "cell " + cls;
        if (big) { const b = document.createElement("span"); b.className = "big"; b.textContent = big; c.appendChild(b); c.classList.add("tent"); }
        else for (const n of "123456789") { const sp = document.createElement("span"); sp.className = "cand" + (n === "2" ? " pick" : n === "7" ? " off as-c" : ""); sp.textContent = n; sp.dataset.n = n; c.appendChild(sp); }
        r3.appendChild(c);
      };
      mk("5", "as-root");
      mk("3", "as-t");
      mk("", "");
      const m = document.createElement("div");
      m.className = "tut-pm still";
      m.innerHTML = `<p>1行1列</p><span>5 を候補（青）にする</span><span>5 を確定候補にする</span><span>5 を候補から消す</span><span class="asm on2">5 と仮定する</span>`;
      wrap.append(m, r3);
      tutDemo.appendChild(wrap);
    }
    if (st.tryPhoto) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn";
      b.textContent = "見本の写真で試してみる";
      b.addEventListener("click", trySamplePhoto);
      tutDemo.appendChild(b);
      tutStatus.textContent = "ボタンを押すと、見本の写真で読み取りの流れを実際に試せます。";
    }
    if (st.colors) {
      const box = document.createElement("div");
      box.className = "tut-colors";
      for (const [k, n, name, mean] of st.colors) {
        const t = document.createElement("div");
        t.className = `tut-color c-${k}`;
        t.innerHTML = `<span class="tc-num">${n}</span><span class="tc-name">${name}</span><span class="tc-mean">${mean}</span>`;
        box.appendChild(t);
      }
      tutDemo.appendChild(box);
    }
    // 長押し（右クリック）すると、どんなメニューが出るかを見せる（動きのある見本。操作はできない）
    if (st.pressDemo) {
      const wrap = document.createElement("div");
      wrap.className = "tut-press";
      const r3 = document.createElement("div");
      r3.className = "row3";
      r3.style.gridTemplateColumns = "96px";
      const c = document.createElement("div");
      c.className = "cell";
      for (const n of order) {
        const sp = document.createElement("span");
        sp.className = "cand" + (n === "5" ? " tp-key" : "");
        sp.textContent = n;
        c.appendChild(sp);
      }
      r3.appendChild(c);
      const ring = document.createElement("span");
      ring.className = "tp-ring";
      ring.setAttribute("aria-hidden", "true");
      c.appendChild(ring);
      const m = document.createElement("div");
      m.className = "tut-pm";
      m.setAttribute("aria-label", "メニューの見本");
      m.innerHTML = `<p>1行1列</p><span class="on">5 を候補（青）にする</span><span>5 を確定候補にする</span><span>5 を候補から消す</span><span class="asm">5 と仮定する</span>`;
      wrap.append(r3, m);
      const more = document.createElement("div");
      more.className = "tut-more";
      more.innerHTML = `<b>操作に慣れてきたら</b><span>${TAP1}・${TAP2}・${TAP3}でも、すばやく操作できます（中級編で説明します）。</span>`;
      tutDemo.append(wrap, more);
      tutStatus.textContent = "次のページから、実際に試してみましょう。";
    }
    if (!st.cells) return;
    const row = document.createElement("div");
    row.className = "row3";
    row.style.gridTemplateColumns = `repeat(${st.cells.length}, 96px)`;
    const cells = st.cells.map((g) => {
      const c = document.createElement("div");
      c.className = "cell";
      for (const n of order) {
        const sp = document.createElement("span");
        sp.className = "cand";
        sp.dataset.n = n;
        sp.textContent = n;
        c.appendChild(sp);
      }
      const big = document.createElement("span");
      big.className = "big";
      c.appendChild(big);
      if (g) { c.classList.add("fixed", "given"); c.dataset.value = g; big.textContent = g; }
      row.appendChild(c);
      return c;
    });
    tutDemo.appendChild(row);
    if (st.menu) row.classList.add("tut-menu-row");
    const [ti, tn] = st.target;
    (cells[ti].classList.contains("fixed") ? cells[ti].querySelector(".big") : cells[ti].querySelector(`.cand[data-n="${tn}"]`)).classList.add("target");
    const d = demoApi(cells);
    // 「戻る」の練習：操作の前の小さな盤の状態を積んでおき、「戻る」で1つ前に戻す
    const hist = [];
    const snap = () => cells.map((c) => ({ cls: c.className, v: c.dataset.value, big: c.querySelector(".big").textContent, cands: [...c.querySelectorAll(".cand")].map((x) => x.className) }));
    let undoBtn2 = null;
    tutBeforeTap = st.undo ? () => { hist.push(snap()); undoBtn2.disabled = false; } : null;
    if (st.undo) {
      undoBtn2 = document.createElement("button");
      undoBtn2.type = "button";
      undoBtn2.className = "btn sub tut-undo";
      undoBtn2.textContent = "1手戻す";
      undoBtn2.disabled = true;
      undoBtn2.addEventListener("click", () => {
        const sn = hist.pop();
        if (!sn) return;
        cells.forEach((c, i) => {
          c.className = sn[i].cls;
          if (sn[i].v === undefined) delete c.dataset.value; else c.dataset.value = sn[i].v;
          c.querySelector(".big").textContent = sn[i].big;
          c.querySelectorAll(".cand").forEach((x, k) => { x.className = sn[i].cands[k]; });
        });
        undoBtn2.disabled = !hist.length;
        d.undone = true;
        if (st.goal(d)) showTutOk(st); else { tutStatus.classList.remove("ok"); tutStatus.textContent = st.ask; }
      });
      const ur = document.createElement("div");
      ur.className = "tut-undo-row";
      ur.appendChild(undoBtn2);
      tutDemo.appendChild(ur);
    }
    row.addEventListener("click", (e) => {
      const el = e.target.closest(".cand, .big");
      if (!el) return;
      if (st.register) {
        // 問題の入力：小さな数字で数字を入れ、大きな数字で消す
        const c = el.closest(".cell");
        if (el.classList.contains("cand")) { c.classList.add("fixed"); c.dataset.value = el.dataset.n; c.querySelector(".big").textContent = el.dataset.n; }
        else { c.classList.remove("fixed"); delete c.dataset.value; }
        if (st.goal(d)) showTutOk(st);
        else { tutStatus.classList.remove("ok"); tutStatus.textContent = st.ask; }
        return;
      }
      if (tutTap.el !== el) { clearTimeout(tutTap.t); tutTap = { el, n: 0, t: null }; }
      tutTap.n++;
      clearTimeout(tutTap.t);
      tutTap.t = setTimeout(() => {
        tutBeforeTap?.();
        demoTap(cells, el, Math.min(tutTap.n, 3));
        tutTap = { el: null, n: 0, t: null };
        if (st.goal(d)) showTutOk(st);
        else { tutStatus.classList.remove("ok"); tutStatus.textContent = st.ask; }
      }, 350);
    });
    if (st.menu) bindTutMenu(row, cells, () => { if (st.goal(d)) showTutOk(st); else { tutStatus.classList.remove("ok"); tutStatus.textContent = st.ask; } });
  }
  // ガイドの小さな盤での右クリック・長押しメニュー（本番のメニューと同じ項目）
  const tutMenu = document.createElement("div");
  tutMenu.className = "ctx";
  tutMenu.setAttribute("role", "menu");
  tutMenu.hidden = true;
  document.body.appendChild(tutMenu);
  let tutMenuAt = 0;
  function closeTutMenu() { tutMenu.hidden = true; }
  function openTutMenu(cells, el, x, y, after) {
    const cell = el.closest(".cell");
    const big = cell.classList.contains("fixed") || cell.classList.contains("tent");
    if (!big && !el.classList.contains("cand")) return;
    const n = big ? cell.dataset.value || cell.querySelector(".big").textContent : el.dataset.n;
    const t = big ? cell.querySelector(".big") : el;
    const items = cell.classList.contains("fixed") ? [[`行・列・ブロックの ${n} の候補を消す・戻す`, 3]]
      : cell.classList.contains("tent") ? [[`${n} を確定候補から外す`, 2], [`行・列・ブロックの ${n} の候補を消す・戻す`, 3]]
      : el.classList.contains("off") ? [[`消した ${n} を戻す`, 3]]
      : [[el.classList.contains("pick") ? `候補 ${n} を外す` : `${n} を候補（青）にする`, 1], [`${n} を確定候補にする`, 2], [`${n} を候補から消す`, 3]];
    tutMenu.textContent = "";
    for (const [label, k] of items) {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("role", "menuitem");
      b.textContent = label;
      b.addEventListener("click", () => { closeTutMenu(); tutBeforeTap?.(); demoTap(cells, t, k); after(); });
      tutMenu.appendChild(b);
    }
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "cancel";
    cancel.textContent = "キャンセル";
    cancel.addEventListener("click", closeTutMenu);
    tutMenu.appendChild(cancel);
    tutMenu.hidden = false;
    tutMenuAt = Date.now();
    const w = tutMenu.offsetWidth, h = tutMenu.offsetHeight;
    tutMenu.style.left = `${Math.max(8, Math.min(x, innerWidth - w - 8))}px`;
    tutMenu.style.top = `${Math.max(8, Math.min(y, innerHeight - h - 8))}px`;
  }
  document.addEventListener("pointerdown", (e) => {
    if (!tutMenu.hidden && !tutMenu.contains(e.target) && Date.now() - tutMenuAt > 600) closeTutMenu();
  });
  // 右クリック・長押しの受け付け（メニューの練習のページだけ）
  function bindTutMenu(row, cells, after) {
    let press = null, longAt = 0;
    row.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (Date.now() - longAt < 1000) return;
      const el = e.target.closest(".cand, .big");
      if (el) openTutMenu(cells, el, e.clientX, e.clientY, after);
    });
    row.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      const el = e.target.closest(".cand, .big"), x = e.clientX, y = e.clientY;
      if (!el) return;
      clearTimeout(press?.timer);
      press = { x, y, timer: setTimeout(() => { press = null; longAt = Date.now(); openTutMenu(cells, el, x, y, after); navigator.vibrate?.(15); }, 500) };
    });
    const cancelPress = (e) => {
      if (!press) return;
      if (e.type === "pointermove" && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 10) return;
      clearTimeout(press.timer);
      press = null;
    };
    for (const ev of ["pointerup", "pointercancel", "pointermove"]) row.addEventListener(ev, cancelPress);
    row.addEventListener("click", (e) => { if (Date.now() - longAt < 1000) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  }
  // 小さな盤での動き（本番の回答モードと同じ決まり）
  function demoTap(cells, el, n) {
    const cell = el.closest(".cell");
    const val = (c) => c.dataset.value || (c.classList.contains("tent") ? c.querySelector(".big").textContent : "");
    const grayOthers = (num) => {
      const t = cells.filter((c) => c !== cell && !val(c)).map((c) => c.querySelector(`.cand[data-n="${num}"]`));
      const back = t.length && t.every((x) => x.classList.contains("off"));
      t.forEach((x) => { x.classList.toggle("off", !back); if (!back) x.classList.remove("pick"); });
    };
    if (cell.classList.contains("fixed") || cell.classList.contains("tent")) {
      if (n === 3) grayOthers(val(cell));
      else if (n === 2 && cell.classList.contains("tent")) {
        cell.classList.remove("tent");
        cell.querySelectorAll(".sure").forEach((x) => x.classList.remove("sure"));
        cell.querySelector(".big").textContent = "";
      }
      return;
    }
    if (!el.classList.contains("cand")) return;
    if (n === 3) {
      const num = el.dataset.n;
      if (el.classList.contains("off") || !cells.some((c) => c !== cell && val(c) === num)) { el.classList.toggle("off"); el.classList.remove("pick"); return; }
      [cell, ...cells.filter((c) => c !== cell && !val(c))].forEach((c) => { const x = c.querySelector(`.cand[data-n="${num}"]`); x.classList.add("off"); x.classList.remove("pick"); });
    } else if (el.classList.contains("off")) {
      return;
    } else if (n === 1) {
      el.classList.toggle("pick");
    } else {
      el.classList.add("pick", "sure");
      cell.classList.add("tent");
      cell.querySelector(".big").textContent = el.dataset.n;
    }
  }
  // 見本の写真で、本物の読み取りの流れを試す（回答中は問題が消えないよう試さない）
  const SAMPLE_PHOTO = "data:image/jpeg;base64,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";
  function trySamplePhoto() {
    // 解いている途中でも試せる（途中の状態は自動保存してあり、お試しを終えると一時停止の状態で戻る）
    if (board.dataset.mode === "solve") pause.click();
    autoSave();
    tutEl.hidden = true;
    if (board.dataset.mode !== "register") startRegister();
    pname.value = "見本の問題";
    trialBox.hidden = false;
    const bin = atob(SAMPLE_PHOTO.split(",")[1]);
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
    readImage(new File([bytes], "sample.jpg", { type: "image/jpeg" }));
  }
  // お試しを終えてガイドに戻る（見本の問題は保存しない）
  const trialBox = document.getElementById("trial");
  document.getElementById("trial-back").addEventListener("click", () => {
    trialBox.hidden = true;
    cropEl.hidden = true;
    showStart("home");
    resumeSaved();
    openTutorial();
    tutIdx = tutSteps.findIndex((st) => st.tryPhoto);
    renderTut();
  });
  function openTutorial() {
    if (board.dataset.mode === "solve") pause.click();
    tutIdx = 0;
    let hidden = false;
    try { hidden = localStorage.getItem(TUT_KEY) === "1"; } catch (e) { /* 使えない環境 */ }
    tutHide.checked = hidden;
    tutEl.hidden = false;
    renderTut();
    document.getElementById("tut-next").focus();
  }
  function closeTutorial() {
    tutEl.hidden = true;
    try {
      if (tutHide.checked) localStorage.setItem(TUT_KEY, "1");
      else localStorage.removeItem(TUT_KEY);
    } catch (e) { /* 使えない環境 */ }
  }
  document.getElementById("tut-next").addEventListener("click", () => {
    if (tutSteps[tutIdx].last) return closeTutorial();
    tutIdx++;
    renderTut();
  });
  document.getElementById("tut-prev").addEventListener("click", () => {
    if (tutIdx <= 0) return;
    // 各編の1ページ目で「前へ」を押したら、選ぶ画面に戻る
    const cur = tutSteps[tutIdx];
    tutIdx = tutSteps.findIndex((x) => x.part === cur.part) === tutIdx ? 0 : tutIdx - 1;
    renderTut();
  });
  document.getElementById("tut-skip").addEventListener("click", () => { tutEl.hidden = true; });
  document.getElementById("tut-open").addEventListener("click", openTutorial);

