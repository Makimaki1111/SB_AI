document.addEventListener("DOMContentLoaded", () => {
  const inputField = document.getElementById("input");

  inputField.addEventListener("input", () => {
    const text = inputField.value;

    // 入力が空ならスキップ（お好みで）
    if (!text.trim()) return;

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
      // 必要に応じて data を画面に反映する処理を書く
    })
    .catch(error => {
      console.error("include_check エラー:", error);
    });
  });
});

document.getElementById("submit").addEventListener("click", () => {

　const text = document.getElementById("input").value;
　if(!text.trim()) return;

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