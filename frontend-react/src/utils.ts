export const TYPE_IMAGE_MAP: Record<string, string> = {
  "ノーマル": "normal",
  "動物": "animal",
  "植物": "plant",
  "地名": "place",
  "感情": "emote",
  "芸術": "art",
  "食べ物": "food",
  "暴力": "violence",
  "医療": "health",
  "人体": "body",
  "機械": "mech",
  "理科": "science",
  "時間": "time",
  "人物": "person",
  "工作": "work",
  "服飾": "cloth",
  "社会": "society",
  "遊び": "play",
  "虫": "bug",
  "数学": "math",
  "暴言": "insult",
  "宗教": "religion",
  "スポーツ": "sports",
  "天気": "weather",
  "物語": "tale"
};

export const getTypeImagePath = (type: string) => {
  const name = TYPE_IMAGE_MAP[type] || 'normal';
  // 開発環境でも本番ビルドでも正しく解像されるように相対パスで返す
  // (Viteなどのビルドツールがアセットを適切に処理できるように)
  return new URL(`./assets/img/${name}.gif`, import.meta.url).href;
};
