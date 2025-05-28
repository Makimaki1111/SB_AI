class UIObject{
    constructor(selector) {
        this.selector = selector;
    }

    show(){
        this.selector.show();
    }

    hide(){
        this.selector.hide();
    }

    onClick(func){
        this.selector.on('click', e => func(e))
    }
}

class UI{
    constructor() {
        this.titleScreen = new UIObject($('#title-screen'));
        this.battleScreen = new UIObject($('#battle-screen'));
        this.vsPlayerBtn = new UIObject($('#vs-player-btn'));
        this.vsCpuBtn = new UIObject($('#vs-cpu-btn'));
        this.input = new UIObject($('#input'));
        this.submitButton = new UIObject($('#submit'));
    }

    showTitleScreen() {
        this.titleScreen.show();
        this.battleScreen.hide();
    }

    showBattleScreen() {
        this.titleScreen.hide();
        this.battleScreen.show();
    }

    enableInput(){
        this.input.selector.prop('disabled', false);
        this.submitButton.selector.prop('disabled', false);
    }

    disableInput(){
        this.input.selector.prop('disabled', true);
        this.submitButton.selector.prop('disabled', true);
    }

    clearInput(){
        this.input.selector.val('');
    }

    enableSubmitBtn(){
        this.submitButton.selector.prop('disabled', false);
    }

    disableSubmitBtn(){
        this.submitButton.selector.prop('disabled', true);
    }
}

let room_id = null;
let player1_id = "your_player1_id";
let player2_id = "your_player2_id";
let cpu_id = "cpu";
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
      ui.submitButton.selector.click();
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

      if (data.image) {
        includeImg.src = `img/${data.image}.gif`;
        includeImg.style.display = "block";
      } else if (data.image1) {
        includeImg.src = `img/${data.image1}.gif`;
        includeImg.style.display = "block";
      } else {
        includeImg.style.display = "none";
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
    document.getElementById("include-img").style.display = "none";

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
        document.getElementById("wait-message").textContent = "使用済みの単語です。";
        document.getElementById("wait-message").style.display = "block";
        setTimeout(() => {
          document.getElementById("wait-message").style.display = "none";
        }, 2000);
        return;
      }

      // 未登録単語
      if (data.turn_info && !data.turn_info.include) {
        document.getElementById("wait-message").textContent = "辞書にない単語です。";
        document.getElementById("wait-message").style.display = "block";
        setTimeout(() => {
          document.getElementById("wait-message").style.display = "none";
        }, 2000);
        return;
      }

      // 画像表示
      const ally_type1_img = document.getElementById("ally-type1-img");
      const ally_type2_img = document.getElementById("ally-type2-img");
      const ally_only_type_img = document.getElementById("ally-only-type-img");

      if (data.state && data.state.image2 !== "") {
        ally_type1_img.src = `img/${data.state.image1}.gif`;
        ally_type2_img.src = `img/${data.state.image2}.gif`;
        ally_only_type_img.style.display = "none";
        ally_type1_img.style.display = "block";
        ally_type2_img.style.display = "block";
      } else if (data.state) {
        ally_only_type_img.src = `img/${data.state.image1}.gif`;
        ally_type1_img.style.display = "none";
        ally_type2_img.style.display = "none";
        ally_only_type_img.style.display = "block";
      }
      document.getElementsByClassName("ally-word")[0].textContent = text;
      shrinkIfTooWideAlly();
    })
    .catch(error => {
      console.error("エラー:", error);
    });
  });
});

// 文字列圧縮
function shrinkIfTooWideAlly() {
  const element = document.querySelector(".ally-word");
  const maxWidth = 180;

  if (element.scrollWidth > maxWidth) {
    const scale = maxWidth / element.scrollWidth;
    element.style.transform = `translateX(-50%) scaleX(${scale})`;
  } else {
    element.style.transform = `translateX(-50%) scaleX(1)`;
  }
}