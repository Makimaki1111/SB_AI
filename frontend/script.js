document.getElementById("submit").addEventListener("click", () => {
  const text = document.getElementById("input").value;
  console.log("押されました")
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
    // ここに受け取ったdataを画面に表示する処理を追加しても良いです
  })
  .catch(error => {
    console.error("エラー:", error);
  });
});
