let room_id = null;
let player1_id = "your_player1_id";
let player2_id = "your_player1_id";
let cpu_id = "your_player1_id";
let is_vs_cpu = false;

let ui = new UI();

document.addEventListener("DOMContentLoaded", () => {

  // ボタンイベント
  ui.vsPlayerBtn.onClick(() => {
    is_vs_cpu = false;
    ui.showBattleScreen();
    fetch("http://localhost:8000/make_new_battle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        player1_id: player1_id,
        player2_id: player2_id
      })
    })
    .then(response => response.json())
    .then(data => {
      console.log("make_new_battle 応答:", data);
      room_id = data.room_id;
      ui.enableInput();
      ui.clearInput();
    })
    .catch(error => {
      console.error("make_new_battle エラー:", error);
    });
  });

  ui.vsCpuBtn.onClick(() => {
    is_vs_cpu = true;
    ui.showBattleScreen();
    fetch("http://localhost:8000/make_new_battle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        player1_id: player1_id,
        player2_id: cpu_id
      })
    })
    .then(response => response.json())
    .then(data => {
      console.log("make_new_battle 応答:", data);
      room_id = data.room_id;
      ui.enableInput();
      ui.clearInput();
    })
    .catch(error => {
      console.error("make_new_battle エラー:", error);
    });
  });

  // エンターで送信
  ui.input.selector.on("keydown", (e) => {
    if (e.key === "Enter") {
      ui.ClickSubmitBtn();
      e.preventDefault(); // デフォルトのEnterキーの動作を防ぐ
    }
  });

  // 入力欄の変化で単語チェック
  ui.input.selector.on("input", () => {
    const text = ui.input.selector.val();
    const includeImg = document.getElementById("include-img");

    if (!text.trim() || !room_id) {
      includeImg.style.display = "none";
      return;
    }

    fetch("http://localhost:8000/include_check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ room_id: room_id, word: text })
    })
    .then(response => {
      if (!response.ok) throw new Error("送信に失敗しました");
      return response.json();
    })
    .then(data => {
      console.log("include_check 応答:", data);

      if (data.include === true) {

        if(data.used === true) {
          ui.showUsedWord(data);
        } else {
          ui.showPreImg();
        }
      } else {
        ui.hidePreImg();
      }
    })
    .catch(error => {
      console.error("include_check エラー:", error);
      includeImg.style.display = "none";
    });
  });

  // 送信ボタン
  ui.submitButton.onClick(() => {
    const text = ui.input.selector.val();
    if (!text.trim() || !room_id) return;
    ui.clearInput();
    ui.hidePreImg();
    // ui.disableInput();
    // ui.disableSubmitBtn();

    fetch("http://localhost:8000/submit_word", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ room_id: room_id, player_id: player1_id, word: text })
    })
    .then(response => {
      if (!response.ok) throw new Error("送信に失敗しました");
      return response.json();
    })
    .then(data => {
      console.log("サーバーの応答:", data);

      // 使用済み単語
      if (data.turn_info && data.turn_info.used) {
        ui.setWaitMessage("その単語はすでに使用されています。", 2000);
        return;
      }

      // 未登録単語
      if (data.turn_info && !data.turn_info.include) {
        ui.setWaitMessage("辞書にない単語です。", 2000);
        return;
      }

      // 画像表示
      ui.showAllyImage(data);
      ui.showAllyWord(text);
    })
    .catch(error => {
      console.error("エラー:", error);
    });
  });
});