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
    
    private bgmVolume: number = 0.1;
    private seVolume: number = 0.5;
    
    private isUnlocked: boolean = false;

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
            
            const buffer = this.audioCtx!.createBuffer(1, 1, 22050);
            const source = this.audioCtx!.createBufferSource();
            source.buffer = buffer;
            source.connect(this.audioCtx!.destination);
            source.start(0);
            
            this.isUnlocked = true;
        } catch (e) {
            console.error("Failed to unlock AudioContext", e);
        }
    }

    private async loadAudio(path: string): Promise<AudioBuffer | null> {
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
            return null;
        }
    }

    /**
     * キーまたはパスを指定してSEを再生します。
     * 80msのクールダウンと pera.mp3 の 30% 音量抑制を自動で行います。
     */
    public async play(keyOrPath: string): Promise<void> {
        const path = this.soundMap[keyOrPath] || this.typeSoundMap[keyOrPath] || keyOrPath;
        
        const now = Date.now();
        const lastPlay = this.lastPlayTime.get(path) || 0;
        if (now - lastPlay < 80) return;
        this.lastPlayTime.set(path, now);

        if (!this.isUnlocked) await this.unlock();
        if (!this.audioCtx || !this.seGain) return;

        try {
            const buffer = await this.loadAudio(path);
            if (!buffer) return;

            if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();

            const source = this.audioCtx.createBufferSource();
            source.buffer = buffer;

            const gainNode = this.audioCtx.createGain();
            let volumeScale = 1.0;
            if (path.includes('pera.mp3')) {
                volumeScale = 0.3;
            }
            gainNode.gain.value = volumeScale;

            source.connect(gainNode);
            gainNode.connect(this.seGain);
            source.start(0);
        } catch (e) {
            console.warn(`Failed to play sound: ${path}`, e);
        }
    }

    // 互換性用の別名メソッド
    public playSE(path: string, volumeScale: number = 1.0): void { this.play(path); }
    public playSE_legacy(key: string): void { this.play(key); }
    public playType(type: string): void { this.play(type); }
    public playBGM(path: string): void { this.startBGM(path); }

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

    public stopBGM(): void {
        if (this.currentBgmSource) {
            try {
                this.currentBgmSource.stop();
                this.currentBgmSource.disconnect();
            } catch (e) { }
            this.currentBgmSource = null;
            this.currentBgmPath = null;
        }
    }

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
