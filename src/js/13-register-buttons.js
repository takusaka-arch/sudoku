  // ===== 13-register-buttons.js：新しい問題を自分で作る・登録のキャンセル・ボタンの並び =====
  // （src/js/ の全ファイルで1つの (function () { … })(); になる。まとめ方は tools/build.py）
  // 「新しい問題を自分で作る」: 手で入力するか、写真から読み取る
  function startRegister() {
    clearBoard();
    currentName = "";
    board.dataset.mode = "register";
    startPanel.hidden = true;
    workPanel.hidden = false;
    timerEl.hidden = true;
    hintsEl.hidden = true;
    leftEl.hidden = true;
    targetEl.hidden = true;
    go.hidden = true;
    pause.hidden = true;
    showRegister();
    pname.focus();
  }
  document.getElementById("back").addEventListener("click", showStart);
  // 問題登録のキャンセル：登録せずに最初の画面へ戻る
  regCancel.addEventListener("click", () => showStart("home"));
  // 「問題一覧へ」はパソコンもスマホも「問題の管理」のまとまり（リセットの右）に置く
  document.querySelector(".grp-prob .grp-btns").appendChild(document.getElementById("back"));
  document.querySelector(".grp-prob .grp-btns").appendChild(regCancel);
