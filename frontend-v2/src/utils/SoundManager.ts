/**
 * SoundManager.ts
 * 
 * しりとりバトルの音響管理クラス。
 * Web Audio APIを使用して低遅延な再生と音量制御を実現します。
 */

type SoundCategory = 'bgm' | 'se';

class SoundManager {
    private static instance: SoundManager;
    private audioCtx: AudioContext | null = null;
    private bgmGain: GainNode | null = null;
    private seGain: GainNode | null = null;
    
    private audioCache: Map<string, AudioBuffer> = new Map();
    private lastPlayTime: Map<string, number> = new Map();
    
    private currentBgmSource: AudioBufferSourceNode | null = null;
    private currentBgmPath: string | null = null;
    
    private bgmVolume: number = 0.3;
    private seVolume: number = 0.5;
    
    private isUnlocked: boolean = false;

    private constructor() {
        // localStorageから設定を復元
        const savedBgm = localStorage.getItem('sb_bgm_volume');
        const savedSe = localStorage.getItem('sb_se_volume');
        if (savedBgm !== null) this.bgmVolume = parseFloat(savedBgm);
        if (savedSe !== null) this.seVolume = parseFloat(savedSe);
    }

    public static getInstance(): SoundManager {
        if (!SoundManager.instance) {
            SoundManager.instance = new SoundManager();
        }
        return SoundManager.instance;
    }

    /**
     * AudioContextを初期化し、ブラウザの制限を解除します。
     * ユーザー操作イベント内で呼び出す必要があります。
     */
    public async unlock(): Promise<void> {
        if (this.isUnlocked) return;
        
        try {
            const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
            this.audioCtx = new AudioContextClass();
            
            this.bgmGain = this.audioCtx!.createGain();
            this.bgmGain.gain.value = this.bgmVolume;
            this.bgmGain.connect(this.audioCtx!.destination);
            
            this.seGain = this.audioCtx!.createGain();
            this.seGain.gain.value = this.seVolume;
            this.seGain.connect(this.audioCtx!.destination);
            
            if (this.audioCtx!.state === 'suspended') {
                await this.audioCtx!.resume();
            }
            
            // 無音を再生して確実にアンロック
            const buffer = this.audioCtx!.createBuffer(1, 1, 22050);
            const source = this.audioCtx!.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioCtx!.destination);
            source.start(0);
            
            this.isUnlocked = true;
            console.log("AudioContext unlocked");
        } catch (e) {
            console.error("Failed to unlock AudioContext", e);
        }
    }

    /**
     * 音声ファイルを読み込み、AudioBufferとしてキャッシュします。
     */
    public async loadAudio(path: string): Promise<AudioBuffer | null> {
        if (this.audioCache.has(path)) return this.audioCache.get(path)!;
        
        if (!this.audioCtx) await this.unlock();
        if (!this.audioCtx) return null;

        try {
            const response = await fetch(path);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
            this.audioCache.set(path, audioBuffer);
            return audioBuffer;
        } catch (e) {
            console.error(`Failed to load audio: ${path}`, e);
            return null;
        }
    }

    /**
     * SEを再生します。
     * @param path 音声ファイルパス
     * @param volumeScale 個別の音量倍率 (pera.mp3などで使用)
     */
    public async playSE(path: string, volumeScale: number = 1.0): Promise<void> {
        if (!this.isUnlocked) await this.unlock();
        if (!this.audioCtx || !this.seGain) return;

        // 短時間での重複再生を防止 (80ms)
        const now = Date.now();
        const lastPlay = this.lastPlayTime.get(path) || 0;
        if (now - lastPlay < 80) return;
        this.lastPlayTime.set(path, now);

        try {
            const buffer = await this.loadAudio(path);
            if (!buffer) return;

            if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();

            const source = this.audioCtx.createBufferSource();
            source.buffer = buffer;

            // 個別音量調整用のGainNode
            const localGain = this.audioCtx.createGain();
            localGain.gain.value = volumeScale;

            source.connect(localGain);
            localGain.connect(this.seGain);
            source.start(0);
        } catch (e) {
            console.error(`Failed to play SE: ${path}`, e);
        }
    }

    /**
     * BGMを開始します。ループ再生されます。
     */
    public async startBGM(path: string): Promise<void> {
        if (this.currentBgmPath === path && this.currentBgmSource) return;
        
        if (!this.isUnlocked) await this.unlock();
        if (!this.audioCtx || !this.bgmGain) return;

        try {
            const buffer = await this.loadAudio(path);
            if (!buffer) return;

            this.stopBGM();

            if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();

            const source = this.audioCtx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.connect(this.bgmGain);
            source.start(0);

            this.currentBgmSource = source;
            this.currentBgmPath = path;
        } catch (e) {
            console.error(`Failed to start BGM: ${path}`, e);
        }
    }

    /**
     * BGMを停止します。
     */
    private soundMap: Record<string, string> = {
        'start': '/resource/start.mp3',
        'end': '/resource/end.mp3',
        'heal': '/resource/heal.mp3',
        'up': '/resource/up.mp3',
        'down': '/resource/down.mp3',
        'effective': '/resource/effective.mp3',
        'noneffective': '/resource/noneffective.mp3',
        'middmg': '/resource/middmg.mp3',
        'poison': '/resource/poison.mp3',
        'seeded': '/resource/seeded.mp3',
        'seed_damage': '/resource/seed_damage.mp3',
        'pera': '/resource/pera.mp3',
        'concent': '/resource/concent.mp3'
    };

    private typeSoundMap: Record<string, string> = {
        "ノーマル": "/resource/normal.mp3",
        "動物": "/resource/animal.mp3",
        "植物": "/resource/plant.mp3",
        "地名": "/resource/place.mp3",
        "感情": "/resource/emote.mp3",
        "芸術": "/resource/art.mp3",
        "食べ物": "/resource/food.mp3",
        "暴力": "/resource/violence.mp3",
        "医療": "/resource/health.mp3",
        "人体": "/resource/body.mp3",
        "機械": "/resource/mech.mp3",
        "理科": "/resource/science.mp3",
        "時間": "/resource/time.mp3",
        "人物": "/resource/person.mp3",
        "工作": "/resource/work.mp3",
        "服飾": "/resource/cloth.mp3",
        "社会": "/resource/society.mp3",
        "遊び": "/resource/play.mp3",
        "虫": "/resource/bug.mp3",
        "数学": "/resource/math.mp3",
        "暴言": "/resource/insult.mp3",
        "宗教": "/resource/religion.mp3",
        "スポーツ": "/resource/sports.mp3",
        "天気": "/resource/weather.mp3",
        "物語": "/resource/tale.mp3"
    };

    /**
     * キーを指定してSEを再生します (互換性用)
     */
    public play(key: string): void {
        const path = this.soundMap[key];
        if (path) {
            const volume = (key === 'pera') ? 0.3 : 1.0;
            this.playSE(path, volume);
        }
    }

    /**
     * タイプを指定してSEを再生します (互換性用)
     */
    public playType(type: string): void {
        const path = this.typeSoundMap[type];
        if (path) {
            this.playSE(path);
        }
    }

    /**
     * BGMを開始します (互換性用)
     */
    public playBGM(path: string): void {
        this.startBGM(path);
    }

    public stopBGM(): void {

        if (this.currentBgmSource) {
            try {
                this.currentBgmSource.stop();
                this.currentBgmSource.disconnect();
            } catch (e) { /* ignore */ }
            this.currentBgmSource = null;
            this.currentBgmPath = null;
        }
    }

    /**
     * 音量を設定します。
     */
    public setVolume(category: SoundCategory, value: number): void {
        const val = Math.max(0, Math.min(1, value));
        if (category === 'bgm') {
            this.bgmVolume = val;
            if (this.bgmGain && this.audioCtx) {
                this.bgmGain.gain.setTargetAtTime(val, this.audioCtx.currentTime, 0.1);
            }
            localStorage.setItem('sb_bgm_volume', val.toString());
        } else {
            this.seVolume = val;
            if (this.seGain && this.audioCtx) {
                this.seGain.gain.setTargetAtTime(val, this.audioCtx.currentTime, 0.1);
            }
            localStorage.setItem('sb_se_volume', val.toString());
        }
    }

    public getVolume(category: SoundCategory): number {
        return category === 'bgm' ? this.bgmVolume : this.seVolume;
    }

    public preload(paths: string[]): void {
        paths.forEach(p => this.loadAudio(p));
    }
}

export { SoundManager };
export default SoundManager.getInstance();
