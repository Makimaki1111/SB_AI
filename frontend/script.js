// エンターでボタンクリック
const submitButton = document.getElementById("submit");
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    submitButton.click(); // ボタンクリックと同じ動作
  }
});

// 登録されてるかどうか
document.addEventListener("DOMContentLoaded", () => {
  const inputField = document.getElementById("input");

    inputField.addEventListener("input", () => {
    const text = inputField.value;
    const includeImg = document.getElementById("include-img");

    if (!text.trim()) {
      includeImg.style.display = "none";  // 空文字なら非表示
      return;
    }

    fetch("http://localhost:8000/include_check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text: text })
    })
    .then(response => {
      if (!response.ok) throw new Error("送信に失敗しました");
      return response.json();
    })
    .then(data => {
      console.log("include_check 応答:", data);
      
      // "image"キーが存在する場合に画像を表示
      if (data.image) {
        includeImg.src = `img/${data.image}.gif`;
        includeImg.style.display = "block";
      }else if(data.image1){
        includeImg.src = `img/${data.image1}.gif`;
        includeImg.style.display = "block";
      } else {
        includeImg.style.display = "none";  // imageがなければ非表示
      }
    })
    .catch(error => {
      console.error("include_check エラー:", error);
      includeImg.style.display = "none";  // エラー時も非表示に
    });
  });
});


// タイプチェック
document.getElementById("submit").addEventListener("click", () => {

　const text = document.getElementById("input").value;
　if(!text.trim()) return;
  document.getElementById("input").value = ""; // 入力欄を初期化
  const includeImg = document.getElementById("include-img");
  includeImg.style.display = "none"; 

  fetch("http://localhost:8000/typecheck", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text: text })  // keyは"text"に
  })
  .then(response => {
    if (!response.ok) throw new Error("送信に失敗しました");
    return response.json();
  })
  .then(data => {
    console.log("サーバーの応答:", data);

    if(data.used){
      console.log("使用済み単語です")
      return;
    }
  
    const ally_type1_img = document.getElementById("ally-type1-img");
    const ally_type2_img = document.getElementById("ally-type2-img");
    const ally_only_type_img = document.getElementById("ally-only-type-img");

    if(!data.include){
      // 登録されていませんでした
      console.log("辞書にない単語です")
    }else{
      if(data.image2 !== ""){
        ally_only_type_img.style.display = "none";
        ally_type1_img.src = `img/${data.image1}.gif`;
        ally_type1_img.style.display = "block";
        ally_type2_img.src = `img/${data.image2}.gif`;
        ally_type2_img.style.display = "block";
      } else {
        console.log(data.image1)
        ally_type1_img.style.display = "none";
        ally_type2_img.style.display = "none";
        ally_only_type_img.src = `img/${data.image1}.gif`;
        ally_only_type_img.style.display = "block";
      }
      console.log(text)
      document.getElementsByClassName("ally-word")[0].textContent = text;
      shrinkIfTooWideAlly();
    }
  })
  .catch(error => {
    console.error("エラー:", error);
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
