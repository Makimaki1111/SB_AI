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
        
        //this.player1Name = new UIObject($('#player1-name'));
        this.allyWord = new UIObject($('.ally-word'));
        this.allyType1Img = new UIObject($('#ally-type1-img'));
        this.allyType2Img = new UIObject($('#ally-type2-img'));
        this.allyOnlyTypeImg = new UIObject($('#ally-only-type-img'));
        
        //this.player2Name = new UIObject($('#player2-name'));
        this.waitMessage = new UIObject($('#wait-message'));
        this.includeImg = new UIObject($('#include-img'));
    }

    showTitleScreen() {
        this.titleScreen.show();
        this.battleScreen.hide();
    }

    showBattleScreen() {
        this.titleScreen.hide();
        this.battleScreen.show();
    }

    ClickSubmitBtn(){
        this.submitButton.selector.click();
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

    showPreImg(){
        this.includeImg.selector.attr('src', "img/unaware.gif");
        this.includeImg.selector.css('display', 'block');
    }

    hidePreImg(){
        this.includeImg.selector.css('display', 'none');
        this.includeImg.selector.attr('src', "");
    }

    showUsedWord(data){
        this.includeImg.selector.attr('src', "img/god.gif");
        this.includeImg.selector.css('display', 'block');
    }

    enableSubmitBtn(){
        this.submitButton.selector.prop('disabled', false);
    }

    disableSubmitBtn(){
        this.submitButton.selector.prop('disabled', true);
    }    

    showAllyWord(word){
        this.allyWord.selector.text(word);
        this.allyWord.selector.show();
        shrinkTooWideWord(this.allyWord.selector);
    }

    showAllyImage(data){

      if(data.state && data.state.image2 !== ""){ // 複合タイプの場合
        this.allyType1Img.selector.attr('src', `img/${data.state.image1}.gif`);
        this.allyType2Img.selector.attr('src', `img/${data.state.image2}.gif`);
        this.allyOnlyTypeImg.selector.attr('src', ``);
        this.allyOnlyTypeImg.selector.hide();
        this.allyType1Img.selector.show();
        this.allyType2Img.selector.show();
      } else { // 単タイプの場合
        this.allyOnlyTypeImg.selector.attr('src', `img/${data.state.image1}.gif`);
        this.allyType1Img.selector.attr('src', ``);
        this.allyType2Img.selector.attr('src', ``);
        this.allyType1Img.selector.hide();
        this.allyType2Img.selector.hide();
        this.allyOnlyTypeImg.selector.show();
      }

    }

    showFoeWord(word){
        // ここでは敵の単語表示の処理を追加することができます
        // 現在は実装されていないため、必要に応じて実装してください
        console.log("Foe word:", word);
    }

    setWaitMessage(message, time) {
        this.waitMessage.selector.text(message);
        this.waitMessage.selector.show();
        if(time > 0){
          setTimeout(() => {
            this.waitMessage.hide()
          }, 2000);
        }
    }

    hideWaitMessage() {
        this.waitMessage.selector.hide();
    }
}

function shrinkTooWideWord(element) {
  const maxWidth = 180;
  const domElement = element.get ? element.get(0) : element;

  if (domElement && domElement.scrollWidth > maxWidth) {
    const scale = maxWidth / domElement.scrollWidth;
    domElement.style.transform = `translateX(-50%) scaleX(${scale})`;
  } else if (domElement) {
    domElement.style.transform = `translateX(-50%) scaleX(1)`;
  }
}

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