import { UIObject } from './UIObject.js';
import { TYPE_TO_ICON, TYPE_SOUND_MAP, EVENT_SOUND_MAP, DAMAGE_MSG_MAP } from './Constants.js';

export class BaseUI {
    constructor() {
        this.titleScreen = new UIObject($('#title-screen'));
        this.battleScreen = new UIObject($('#battle-screen'));
        this.message = new UIObject($('#message'));
        this.input = new UIObject($('#input'));
        this.submitButton = new UIObject($('#submit'));
        
        // 予測・判定表示用
        this.includeImg = new UIObject($('#include-img'));
        this.includeImg1 = new UIObject($('#include-img-1'));
        this.includeImg2 = new UIObject($('#include-img-2'));
        this.predictionMessage = new UIObject($('#prediction-message'));

        // 共通モーダル
        this.abilityModal = new UIObject($('#ability-modal'));
        this.situationModal = new UIObject($('#situation-modal'));
    }

    render(state, info, allAbilities) {
        if (!state || !info) return;
        for (const [id, charData] of Object.entries(state.characters)) {
            const slot = info.id_to_ui_map[id];
            if (slot) this.updateCharacter(slot, charData, allAbilities);
        }
        this.updateTurnDisplay(state.is_my_turn);
    }

    updateCharacter(slot, data, allAbilities) {
        this.setHP(slot, data.hp, data.max_hp);
        this.setName(slot, data.name);
        this.updatePoison(slot, data.is_poison);
    }

    showTitleScreen() {
        this.battleScreen.hide();
        this.titleScreen.show();
    }

    showBattleScreen() {
        this.titleScreen.hide();
        this.battleScreen.selector.css('display', 'flex');
    }

    setHP(slot, hp, maxHp) {
        const percentage = Math.max(0, (hp / maxHp) * 100);
        const selector = this._getSlotSelector(slot, 'hp-bar');
        $(selector).css('width', percentage + '%');
    }

    setName(slot, name) {
        const selector = this._getSlotSelector(slot, 'name');
        $(selector).text(name);
    }

    updatePoison(slot, isPoison) {
        const selector = this._getSlotSelector(slot, 'name-container');
        if (isPoison) $(selector).addClass('poisoned');
        else $(selector).removeClass('poisoned');
    }

    updateTurnDisplay(isMyTurn) {
        if (isMyTurn) this.enableInput();
        else this.disableInput();
    }

    enableInput() {
        this.input.selector.prop('disabled', false);
        this.submitButton.selector.prop('disabled', false);
        this.input.selector.focus();
    }

    disableInput() {
        this.input.selector.prop('disabled', true);
        this.submitButton.selector.prop('disabled', true);
    }

    showMessage(msg) {
        this.message.text(msg);
    }

    clearInput() {
        this.input.val('');
    }

    showCheckResult(data) {
        this.hideCheckResult();
        if (!data.include) return;

        if (data.used) {
            this.includeImg.selector.attr('src', 'img/god.gif').show();
            return;
        }

        const types = [];
        if (data.type1) types.push(data.type1);
        if (data.type2) types.push(data.type2);

        if (types.length === 0) {
            this.includeImg.selector.attr('src', 'img/unaware.gif').show();
        } else if (types.length === 1) {
            const src = `img/${TYPE_TO_ICON[types[0]]}.gif`;
            this.includeImg.selector.attr('src', src).show();
        } else {
            const src1 = `img/${TYPE_TO_ICON[types[0]]}.gif`;
            const src2 = `img/${TYPE_TO_ICON[types[1]]}.gif`;
            this.includeImg1.selector.attr('src', src1).show();
            this.includeImg2.selector.attr('src', src2).show();
        }

        if (data.prediction) {
            this.predictionMessage.text(data.prediction).show();
        }
    }

    hideCheckResult() {
        this.includeImg.selector.hide().attr('src', '');
        this.includeImg1.selector.hide().attr('src', '');
        this.includeImg2.selector.hide().attr('src', '');
        this.predictionMessage.selector.hide().text('');
    }

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
            selector.animate({ opacity: 1 }, duration, () => {
                selector.css('opacity', '');
            });
        };
        img.src = src;
    }

    // --- 演出・音声関連 ---

    /**
     * イベントに応じたSE再生
     */
    playEventSound(type, message) {
        let path = EVENT_SOUND_MAP[type];
        if (DAMAGE_MSG_MAP[message]) {
            path = DAMAGE_MSG_MAP[message];
        }
        if (path && window.playSound) {
            window.playSound(path);
        }
    }

    /**
     * 属性に応じたSE再生
     */
    playIconSound(type) {
        const path = TYPE_SOUND_MAP[type];
        if (path && window.playSound) {
            window.playSound(path);
        }
    }

    /**
     * スロット名（ally/foe/p1a等）からHTML要素を特定するためのセレクタを生成
     * ID (#slot-type) を優先し、なければクラス (.slot-type) を探す
     */
    _getSlotSelector(slot, type) {
        const id = `#${slot}-${type}`;
        if ($(id).length > 0) return id;
        return `.${slot}-${type}`;
    }
}
