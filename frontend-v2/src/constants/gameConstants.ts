/**
 * タイプ名から対応するGIF画像ファイル名へのマッピング
 */
export const TYPE_TO_IMAGE: Record<string, string> = {
  "ノーマル": "normal",
  "感情": "emote",
  "食べ物": "food",
  "植物": "plant",
  "社会": "society",
  "時間": "time",
  "工作": "work",
  "芸術": "art",
  "機械": "mech",
  "遊び": "play",
  "暴力": "violence",
  "服飾": "cloth",
  "動物": "animal",
  "地名": "place",
  "人物": "person",
  "人体": "body",
  "理科": "science",
  "暴言": "insult",
  "虫": "bug",
  "数学": "math",
  "医療": "health",
  "宗教": "religion",
  "スポーツ": "sports",
  "物語": "tale",
  "天気": "weather"
};

/**
 * APIエンドポイント
 */
export const API_BASE_URL = 'http://127.0.0.1:8000';
export const WS_BASE_URL = 'ws://127.0.0.1:8000/ws';
