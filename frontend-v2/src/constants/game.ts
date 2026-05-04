export const TYPE_TO_IMAGE: Record<string, string> = {
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

export const TYPE_SOUND_MAP: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(TYPE_TO_IMAGE).map(([type, file]) => [type, `resource/${file}.mp3`])
  )
};

export const EVENT_SOUND_MAP = {
  cure: "resource/heal.mp3",
  start: "resource/start.mp3",
  end: "resource/end.mp3",
  stat_down: "resource/down.mp3",
  drain: "resource/seed_damage.mp3",
  stat_up: "resource/up.mp3"
};

/**
 * APIエンドポイント
 */
export const API_BASE_URL = 'http://127.0.0.1:8000';
export const WS_BASE_URL = 'ws://127.0.0.1:8000/ws';
