import { BaseUI } from '../core/BaseUI.js';
import { TYPE_TO_ICON } from '../core/Constants.js';

export class SingleUI extends BaseUI {
    constructor() {
        super();
        this.abilityInfoContainer = $('#ability-info-container');
        this.remainCount = $('#remain');
    }

    /**
     * キャラクター更新のシングル用拡張
     */
    updateCharacter(slot, data, allAbilities) {
        super.updateCharacter(slot, data, allAbilities);
        this.updateTypes(slot, data.types);
        this.updateWord(slot, data.word);
        
        if (slot === 'ally') {
            this.updateAllyAbilityInfo(data, allAbilities);
        }
    }

    updateTypes(slot, types) {
        const type1Img = $(this._getSlotSelector(slot, 'type1-img'));
        const type2Img = $(this._getSlotSelector(slot, 'type2-img'));
        const onlyTypeImg = $(this._getSlotSelector(slot, 'only-type-img'));

        if (!types || types.length === 0 || (types.length === 1 && types[0] === "")) {
            this._setImageWithReplaceAndFade(type1Img, '');
            this._setImageWithReplaceAndFade(type2Img, '');
            this._setImageWithReplaceAndFade(onlyTypeImg, '');
            return;
        }

        if (types.length === 2) {
            const src1 = `img/${TYPE_TO_ICON[types[0]]}.gif`;
            const src2 = `img/${TYPE_TO_ICON[types[1]]}.gif`;
            this._setImageWithReplaceAndFade(onlyTypeImg, '');
            this._setImageWithReplaceAndFade(type1Img, src1);
            setTimeout(() => this._setImageWithReplaceAndFade(type2Img, src2), 80);
        } else {
            const src = `img/${TYPE_TO_ICON[types[0]]}.gif`;
            this._setImageWithReplaceAndFade(type1Img, '');
            this._setImageWithReplaceAndFade(type2Img, '');
            this._setImageWithReplaceAndFade(onlyTypeImg, src);
        }
    }

    updateWord(slot, word) {
        if (!word) return;
        const selector = this._getSlotSelector(slot, 'word');
        const $word = $(selector);
        
        if ($word.text() !== word) {
            $word.text(word).stop(true, false).css('opacity', 0).show().animate({ opacity: 1 }, 300);
        }
    }

    updateAllyAbilityInfo(data, allAbilities) {
        this.abilityInfoContainer.show();
        this.remainCount.text(data.ability_change_count);

        if (allAbilities && data.ability) {
            const abilityInfo = allAbilities[data.ability];
            if (abilityInfo) {
                $('#ally-current-ability-name').text(abilityInfo.name);
                $('#ally-current-ability-desc').text(abilityInfo.description);
            }
        }
    }
}
