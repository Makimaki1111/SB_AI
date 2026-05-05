export class SoundManager {
  private static instance: SoundManager;
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private isMuted: boolean = false;

  private constructor() {}

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  public play(name: string, volume: number = 0.5) {
    if (this.isMuted) return;

    let audio = this.sounds.get(name);
    if (!audio) {
      audio = new Audio(`/resource/${name}.mp3`);
      this.sounds.set(name, audio);
    }

    // クローンを作成して同時再生を可能にする
    const playAudio = audio.cloneNode() as HTMLAudioElement;
    playAudio.volume = volume;
    playAudio.play().catch(e => console.warn(`Sound playback failed for ${name}:`, e));
  }

  public playType(typeName: string) {
    const typeMap: Record<string, string> = {
      'ノーマル': 'normal',
      '動物': 'animal',
      '植物': 'plant',
      '食べ物': 'food',
      '地名': 'place',
      '人物': 'person',
      '人体': 'body',
      '服飾': 'cloth',
      '機械': 'mech',
      'スポーツ': 'sports',
      '芸術': 'art',
      '理科': 'science',
      '数学': 'math',
      '社会': 'society',
      '遊び': 'play',
      '物語': 'tale',
      '天気': 'weather',
      '感情': 'emote',
      '宗教': 'religion',
      '暴力': 'violence',
      '医療': 'health',
      '虫': 'bug',
      '暴言': 'insult',
      '工作': 'work',
      '時間': 'time'
    };

    const soundName = typeMap[typeName] || 'normal';
    this.play(soundName);
  }

  public stopAll() {
    this.sounds.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
  }
}
