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
      const includeImg = document.getElementById("include-img");
      if (data.image) {
        includeImg.src = `img/${data.image}.gif`;
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
  })
  .catch(error => {
    console.error("エラー:", error);
  });
});