import { TYPE_TO_IMAGE, TYPE_SOUND_MAP, EVENT_SOUND_MAP, DAMAGE_MSG_MAP } from './Constants.js';

/**
 * BaseUI クラス
 * すべてのバトル画面に共通するUI操作（HPバー、メッセージ、入力等）を定義します
 */
export class BaseUI {
    constructor() {
        this.input = $('#word-input');
        this.submitBtn = $('#submit-btn');
        this.messageArea = $('#message');
        this.waitMessage = $('#wait-message');
        this.timerBar = $('#timer-bar');
        this.timerContainer = $('#timer-container');
        
        // 画面全体
        this.lobbyScreen = $('#title-screen');
        this.battleScreen = $('#battle-screen');

        // 共通モーダル
        this.abilityModal = $('#ability-modal');
        this.situationModal = $('#situation-modal');
    }

    // --- 画面遷移 ---
    
    showBattleScreen() {
        this.lobbyScreen.hide();
        this.battleScreen.css('display', 'flex'); // Flexレイアウトを維持
    }

    showLobbyScreen() {
        this.battleScreen.hide();
        this.lobbyScreen.show();
    }

    // --- 基本操作 ---
    
    showMessage(msg = "", duration = 0) {
        if (!msg) {
            this.messageArea.hide();
        } else {
            this.messageArea.text(msg).show();
            if (duration > 0) {
                setTimeout(() => this.messageArea.hide(), duration);
            }
        }
    }

    setWaitMessage(msg, duration = 0) {
        if (!msg) {
            this.waitMessage.hide();
        } else {
            this.waitMessage.text(msg).show();
            if (duration > 0) {
                setTimeout(() => this.waitMessage.hide(), duration);
            }
        }
    }

    // --- 入力制御 ---

    enableInput() { this.input.prop('disabled', false); }
    disableInput() { this.input.prop('disabled', true); }
    focusInput() { this.input.focus(); }
    clearInput() { this.input.val(''); }
    
    showInputArea() {
        this.input.show();
        this.submitBtn.show();
    }
    
    hideInputArea() {
        this.input.hide();
        this.submitBtn.hide();
    }

    // --- タイマー制御 ---

    startTimer(remaining, total) {
        this.timerContainer.show();
        const percent = (remaining / total) * 100;
        this.timerBar.css('width', percent + '%');
        
        // 旧来のCSSアニメーションによる減少（もしCSSで制御している場合）
        this.timerBar.stop().css('width', percent + '%').animate(
            { width: '0%' }, 
            remaining * 1000, 
            'linear'
        );
    }

    stopTimer() {
        this.timerBar.stop();
        this.timerContainer.hide();
    }

    // --- キャラクターUI更新 (抽象化されたスロットIDを使用) ---

    setHP(slotId, hp, maxHp) {
        const percent = Math.max(0, (hp / maxHp) * 100);
        const hpBar = $(`#${slotId}-hp-bar`);
        const hpText = $(`#${slotId}-hp-text`);
        
        if (hpBar.length) {
            hpBar.stop().animate({ width: percent + '%' }, 500);
            // 色の変化
            if (percent < 20) hpBar.css('background-color', '#ff4d4d');
            else if (percent < 50) hpBar.css('background-color', '#ffd11a');
            else hpBar.css('background-color', '#4CAF50');
        }
        
        if (hpText.length) {
            hpText.text(`${Math.ceil(hp)} / ${maxHp}`);
        }
    }

    setName(slotId, name, isPoison = false) {
        const nameElem = $(`#${slotId}-name`);
        if (nameElem.length) {
            let displayName = name;
            if (isPoison) displayName += " [毒]";
            nameElem.text(displayName);
        }
    }

    // --- 演出・エフェクト (職人技の移植) ---

    _setImageWithReplaceAndFade(selector, src, duration = 300) {
        if (!selector || selector.length === 0) return;
        if (src && selector.attr('src') === src && selector.css('display') !== 'none') return;

        selector.stop(true, false);
        if (!src) {
            selector.hide().attr('src', '').css('opacity', '');
            return;
        }

        selector.hide().attr('src', '').css('opacity', '');
        const img = new Image();
        img.onload = () => {
            selector.css({ opacity: 0, display: 'block' }).attr('src', src);
            selector.animate({ opacity: 1 }, duration, () => selector.css('opacity', ''));
        };
        img.src = src;
    }

    _adjustWordScale(element) {
        const maxWidth = 180;
        const domElement = element.get ? element.get(0) : element;
        if (!domElement) return;

        if (domElement.scrollWidth > maxWidth) {
            const scale = maxWidth / domElement.scrollWidth;
            const isFoe = domElement.classList.contains('foe-word');
            domElement.style.transform = `translateX(${isFoe ? '50%' : '-50%'}) scaleX(${scale})`;
        } else {
            const isFoe = domElement.classList.contains('foe-word');
            domElement.style.transform = `translateX(${isFoe ? '50%' : '-50%'}) scaleX(1)`;
        }
    }

    playEffect(slotId, type) {
        // スロット名からラッパーを取得
        const wrapper = $(`#${slotId}-wrapper`);
        if (!wrapper.length) return;

        if (type === 'damage') {
            wrapper.addClass('damage-shake');
            setTimeout(() => wrapper.removeClass('damage-shake'), 500);
        } else if (type === 'heal') {
            wrapper.addClass('heal-flash');
            setTimeout(() => wrapper.removeClass('heal-flash'), 500);
        }
    }

    // --- 音声再生 ---

    playIconSound(typeName) {
        const soundPath = TYPE_SOUND_MAP[typeName];
        if (soundPath && typeof window.playSound === 'function') {
            window.playSound(soundPath);
        }
    }

    playEventSound(type, message) {
        let path = EVENT_SOUND_MAP[type];
        if (DAMAGE_MSG_MAP[message]) {
            path = DAMAGE_MSG_MAP[message];
        }
        if (path && typeof window.playSound === 'function') {
            window.playSound(path);
        }
    }
}

