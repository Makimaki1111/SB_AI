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
 * API/WebSocketエンドポイントの解決
 * ブラウザ環境では、window.location.hostnameを使用してバックエンドに接続する
 */
const getBaseUrl = () => {
  if (typeof window === 'undefined') return '127.0.0.1:8000';
  const hostname = window.location.hostname;
  
  // localhostや空の場合は127.0.0.1を明示的に使用（IPv6/IPv4の解決問題を回避）
  if (!hostname || hostname === 'localhost' || hostname === '127.0.0.1') {
    return '127.0.0.1:8000';
  }
  
  // それ以外（Render.comなどの本番環境やLAN内他PCからのアクセス）は同じホストの8000ポート（または適宜調整）
  // 注意: 本番環境では通常ポート80/443になるため、環境変数等での制御が望ましいが、一旦開発優先
  return `${hostname}:8000`;
};

const baseUrl = getBaseUrl();
const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'https' : 'http';
const wsProtocol = protocol === 'https' ? 'wss' : 'ws';

export const API_BASE_URL = `${protocol}://${baseUrl}`;
export const WS_BASE_URL = `${wsProtocol}://${baseUrl}/ws`;
export const WS_DOUBLE_BASE_URL = `${wsProtocol}://${baseUrl}/ws/double`;
