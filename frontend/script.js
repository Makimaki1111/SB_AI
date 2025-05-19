document.getElementById("submit").addEventListener("click", () => {
  const text = document.getElementById("input").value;

  fetch("/api/send-text", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: text })
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