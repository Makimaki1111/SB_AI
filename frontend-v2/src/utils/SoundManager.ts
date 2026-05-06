export class SoundManager {
  private static instance: SoundManager;
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private bgm: HTMLAudioElement | null = null;
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
      // 拡張子が含まれていない場合は .mp3 を付加
      const src = name.includes('.') ? name : `${name}.mp3`;
      audio = new Audio(src.startsWith('/') ? src : `/resource/${src}`);
      this.sounds.set(name, audio);
    }

    const playAudio = audio.cloneNode() as HTMLAudioElement;
    playAudio.volume = volume;
    playAudio.play().catch(e => console.warn(`Sound playback failed for ${name}:`, e));
  }

  public playBGM(url: string, volume: number = 0.3) {
    if (this.bgm) {
      this.bgm.pause();
      this.bgm = null;
    }

    const fullUrl = url.startsWith('/') ? url : `/${url}`;
    this.bgm = new Audio(fullUrl);
    this.bgm.volume = volume;
    this.bgm.loop = true;
    this.bgm.play().catch(e => console.warn(`BGM playback failed for ${url}:`, e));
  }

  public stopBGM() {
    if (this.bgm) {
      this.bgm.pause();
      this.bgm = null;
    }
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
    this.stopBGM();
    this.sounds.forEach(audio => {
      audio.pause();
      audio.currentTime = 0;
    });
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.bgm) {
      this.bgm.muted = muted;
    }
  }
}
