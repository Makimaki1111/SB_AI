import { BaseUI } from '../core/BaseUI.js';
import { TYPE_SOUND_MAP, DAMAGE_MSG_MAP, EVENT_SOUND_MAP } from '../core/Constants.js';

export class SingleUI extends BaseUI {
    constructor() {
        super();
        this.allyWrapper = $('#ally-wrapper');
        this.foeWrapper = $('#foe-wrapper');
        this.allyImage = $('#ally-image');
        this.foeImage = $('#foe-image');
        this.allyWord = $('#ally-word');
        this.foeWord = $('#foe-word');
    }

    /**
     * バトル画面の初期化 (リセット)
     */
    reset() {
        this.showBattleScreen();
        this.showMessage("");
        this.setWaitMessage("");
        
        // 画像と単語のクリア
        this.allyImage.hide().attr('src', '');
        this.foeImage.hide().attr('src', '');
        $('#ally-type1-img, #ally-type2-img, #ally-only-type-img').hide().attr('src', '');
        $('#foe-type1-img, #foe-type2-img, #foe-only-type-img').hide().attr('src', '');
        this.allyWord.hide().text("");
        this.foeWord.hide().text("");
        
        // 名前のクリア
        $('.ally-name, .foe-name').text("").hide();
        
        // 特性情報の非表示
        $('#ability-info-container, #situation-button').hide();
        
        this.stopTimer();
        this.clearInput();
    }

    /**
     * バトル開始時の初期描画
     */
    render(state, info) {
        this.updateAll(state, info.id_to_ui_map);
        
        // 特性ボタン・状況ボタンを表示
        $('#ability-info-container').css('display', 'flex');
        $('#situation-button').show();
        
        // 自分の特性情報を表示 (info.all_abilities を使用)
        const myId = Object.entries(info.id_to_ui_map).find(([id, slot]) => slot === 'ally')?.[0];
        if (myId && state.characters[myId]) {
            const char = state.characters[myId];
            const abilityName = info.all_abilities[char.ability]?.name || char.ability;
            $('#ally-current-ability-name').text(abilityName);
            $('#remain').text(char.ability_change_count);
        }
    }

    /**
     * 状態に基づき全要素を更新
     */
    updateAll(state, idToUiMap) {
        for (const [id, char] of Object.entries(state.characters)) {
            const uiSlot = idToUiMap[id]; // "ally" or "foe"
            this.setHP(uiSlot, char.hp, char.max_hp);
            this.renderName(uiSlot, char.name, char.is_poison);
            this.updateLives(uiSlot === 'ally', char.lives, uiSlot === 'ally' ? state.ally_max_lives : state.foe_max_lives);
        }
    }

    updateLives(isAlly, current, max) {
        const container = isAlly ? $('.ally-lives-container') : $('.foe-lives-container');
        if (!container.length) return;
        container.empty();
        for (let i = 0; i < max; i++) {
            const star = $('<span>').addClass('live-star').text(i < current ? '★' : '☆');
            if (i >= current) star.addClass('lost');
            container.append(star);
        }
    }


    renderName(uiSlot, name, isPoison) {
        const el = uiSlot === 'ally' ? $('.ally-name') : $('.foe-name');
        el.text(name || "");
        if (isPoison) el.append('<span class="poison">どく</span>');
        el.show();
    }

    setHP(uiSlot, hp, maxHp) {
        const percent = Math.max(0, (hp / maxHp) * 100);
        const hpBar = uiSlot === 'ally' ? $('.ally-hp-bar') : $('.foe-hp-bar');
        const hpText = uiSlot === 'ally' ? $('.balloon.right .hp') : $('.balloon.left .hp');
        
        if (hpBar.length) {
            hpBar.stop(true, true).animate({ width: percent + '%' }, "slow", () => {
                hpBar.css('background-color', this.getHPBarColor(hp / maxHp));
            });
        }
        
        if (hpText.length) {
            hpText.text(`${Math.ceil(hp)} / ${maxHp}`);
        }
    }

    getHPBarColor(ratio) {
        if (ratio > 0.5) return "#00FF00";
        if (ratio > 0.2) return "#FFFF00";
        return "#FF0000";
    }

    showWord(uiSlot, word) {
        const wordElem = uiSlot === 'ally' ? this.allyWord : this.foeWord;
        wordElem.text(word).stop(true, false).css('opacity', 0).show();
        this._adjustWordScale(wordElem);
        wordElem.animate({ opacity: 1 }, 300);
        setTimeout(() => wordElem.fadeOut(500), 2000);
    }

    showAllyImage(data) {
        if (!data || !data.state || !data.state.ally_type) return;
        const types = data.state.ally_type;

        // 複合タイプ
        if (types.length >= 2 && types[1] !== "") {
            const src1 = `img/${TYPE_TO_IMAGE[types[0]]}.gif`;
            const src2 = `img/${TYPE_TO_IMAGE[types[1]]}.gif`;
            this._setImageWithReplaceAndFade($('#ally-only-type-img'), '');
            this._setImageWithReplaceAndFade($('#ally-type1-img'), src1);
            setTimeout(() => {
                this._setImageWithReplaceAndFade($('#ally-type2-img'), src2);
            }, 80);
        } else { // 単タイプ
            const src = `img/${TYPE_TO_IMAGE[types[0]]}.gif`;
            this._setImageWithReplaceAndFade($('#ally-type1-img'), '');
            this._setImageWithReplaceAndFade($('#ally-type2-img'), '');
            this._setImageWithReplaceAndFade($('#ally-only-type-img'), src);
        }
    }

    showFoeImage(data) {
        if (!data || !data.state || !data.state.foe_type) return;
        const types = data.state.foe_type;

        if (types.length >= 2 && types[1] !== "") {
            const src1 = `img/${TYPE_TO_IMAGE[types[0]]}.gif`;
            const src2 = `img/${TYPE_TO_IMAGE[types[1]]}.gif`;
            this._setImageWithReplaceAndFade($('#foe-only-type-img'), '');
            this._setImageWithReplaceAndFade($('#foe-type1-img'), src1);
            setTimeout(() => {
                this._setImageWithReplaceAndFade($('#foe-type2-img'), src2);
            }, 80);
        } else {
            const src = `img/${TYPE_TO_IMAGE[types[0]]}.gif`;
            this._setImageWithReplaceAndFade($('#foe-type1-img'), '');
            this._setImageWithReplaceAndFade($('#foe-type2-img'), '');
            this._setImageWithReplaceAndFade($('#foe-only-type-img'), src);
        }
    }

    async processTurnResult(data) {
        const state = data.state;
        const info = data.info;
        const idToUiMap = info.id_to_ui_map;

        // 1. ターンの初期化
        this.hideInputArea();
        this.stopTimer();

        // 2. 出した単語と画像の表示 (タイムアウトでない場合)
        const isTimeout = data.events && data.events.some(e => e.message && e.message.includes("時間切れ"));
        if (!isTimeout && state.word && state.last_actor_id) {
            const uiSlot = idToUiMap[state.last_actor_id];
            this.showWord(uiSlot, state.word);
            
            if (uiSlot === 'ally') {
                this.showAllyImage(data);
                this.playIconSound(state.ally_type[0]);
            } else {
                this.showFoeImage(data);
                this.playIconSound(state.foe_type[0]);
            }
            
            // 1秒「間」を作る (仕様書通り)
            await new Promise(r => setTimeout(r, 1000));
        }

        // 3. イベントを順番に処理 (仕様書通り)
        for (const event of data.events) {
            if (event.type !== 'ability_changed') {
                this.showMessage(event.message);
            }
            this.playEventSound(event.type, event.message);
            
            // 各種ステータス更新
            if (event.type === 'damage') {
                const uiSlot = idToUiMap[event.target];
                const char = state.characters[event.target];
                this.setHP(uiSlot, char.hp, char.max_hp);
                if (event.message !== "毒のダメージを受けた！") {
                    this.playEffect(uiSlot, 'damage');
                }
            } else if (event.type === 'cure') {
                const uiSlot = idToUiMap[event.target];
                const char = state.characters[event.target];
                this.setHP(uiSlot, char.hp, char.max_hp);
                this.playEffect(uiSlot, 'heal');
            }
            // ... 他のイベントも必要に応じて追加

            const waitTime = event.type === 'ability_changed' ? 100 : 1000;
            await new Promise(r => setTimeout(r, waitTime));
        }

        // 4. 最終同期
        this.updateAll(state, idToUiMap);

        // 5. 次のターンの準備
        if (state.winner_team === null) {
            this.prepareNextTurn(state);
        } else {
            this.showGameEnd(state.ally_win);
        }
    }

    showGameEnd(isAllyWin) {
        this.stopTimer();
        this.disableInput();
        if (isAllyWin) {
            this.showMessage("あいてとの勝負に勝った！");
        } else {
            this.showMessage("あいてとの勝負に負けた…");
        }
        $('#back-to-title-btn').show();
    }

    prepareNextTurn(state) {
        if (state.is_my_turn) {
            this.setWaitMessage("あなたのターンです。");
            this.enableInput();
            this.showInputArea();
            this.focusInput();
        } else {
            this.setWaitMessage("相手のターンです。");
            this.disableInput();
            this.hideInputArea();
        }
    }
}


