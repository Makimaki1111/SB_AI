const modalStyles = `
<style id="ability-modal-styles">
#ability-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    z-index: 2000;
    display: none;
    justify-content: center;
    align-items: center;
}
.ability-modal-wrapper {
    width: 95%;
    max-width: 400px;
    background: rgba(255, 255, 255, 0.95);
    border-radius: 20px;
    padding: 15px 10px; /* パディングを少し減らす */
    display: flex;
    flex-direction: column;
    align-items: center;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    text-align: center;
    color: #333;
    font-family: "M PLUS Rounded 1c", sans-serif;
    position: relative;
    height: auto;
    max-height: 100vh;
    /* overflow-y: auto; */ /* スクロールさせない */
}
.current-ability-section {
    width: 100%;
    margin-bottom: 8px; /* マージン短縮 */
    padding-bottom: 8px; /* パディング短縮 */
    border-bottom: 2px dashed #ddd;
    flex-shrink: 0; /* 縮小しない */
    max-height: 30%; /* 高さを制限 */
    display: flex;
    flex-direction: column;
}
.section-label {
    font-size: 0.8rem;
    color: #888;
    margin-bottom: 4px;
    display: block;
}
.ability-name-display {
    font-size: 1.3rem;
    font-weight: bold;
    color: #333;
    margin: 0;
    height: 2.6rem; /* 高さを詰める */
    line-height: 1.2;
    display: flex;
    align-items: center;
    justify-content: center;
}
.ability-desc-display {
    font-size: 0.85rem;
    color: #666;
    margin-top: 4px;
    line-height: 1.4;
    height: 3.6rem; /* 高さを詰める */
    overflow-y: auto; /* 長い場合はスクロール */
    display: flex;
    flex-direction: column;
    justify-content: center;
}
.carousel-container {
    position: relative;
    width: 100%;
    height: 110px; /* カルーセル領域をコンパクトに */
    margin: 5px 0;
    /* perspective: 1000px; */
    touch-action: pan-y; /* 横スクロール操作をブラウザに任せない */
    user-select: none;
    overflow: hidden;
    flex-shrink: 0;
}
.carousel-track {
    position: absolute;
    top: 0;
    left: 50%;
    width: 0;
    height: 100%;
}
.carousel-item {
    position: absolute;
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: #fff;
    border: 4px solid #ddd;
    display: flex;
    justify-content: center;
    align-items: center;
    top: 50%;
    left: 50%;
    transform-origin: center center;
    transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), border-color 0.3s, background-color 0.3s, box-shadow 0.3s;
    cursor: pointer;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    z-index: 1;
}
.carousel-item.selected {
    border-color: #ff9800;
    background: #fff8e1;
    z-index: 10;
    box-shadow: 0 0 20px rgba(255, 152, 0, 0.6);
}
.carousel-item img {
    width: 60%;
    height: 60%;
    object-fit: contain;
}
.modal-actions {
    display: flex;
    gap: 15px;
    margin-top: 10px; /* マージン短縮 */
    width: 100%;
    justify-content: center;
    flex-shrink: 0;
    padding-bottom: 10px; /* 余白調整 */
}
.modal-btn {
    padding: 12px 24px;
    border-radius: 30px;
    border: none;
    font-weight: bold;
    cursor: pointer;
    font-size: 1rem;
    min-width: 110px;
    transition: transform 0.1s, opacity 0.2s;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
}
.modal-btn:active {
    transform: scale(0.95);
}
.btn-decide {
    background: linear-gradient(135deg, #ff9800, #ff5722);
    color: white;
}
.btn-decide:disabled {
    background: #ccc;
    cursor: not-allowed;
    box-shadow: none;
}
.btn-close {
    background: #f0f0f0;
    color: #555;
}
</style>
`;

class UI{
    constructor() {
        // スタイルを注入
        if (!$('#ability-modal-styles').length) {
            $('head').append(modalStyles);
        }

        this.titleScreen = new UIObject($('#title-screen'));
        this.battleScreen = new UIObject($('#battle-screen'));
        this.vsPlayerBtn = new UIObject($('#vs-player-btn'));
        this.vsCpuBtn = new UIObject($('#vs-cpu-btn'));
        this.createRoomBtn = new UIObject($('#create-room-btn'));
        this.input = new UIObject($('#input'));
        this.submitButton = new UIObject($('#submit'));
        
        this.allyWord = new UIObject($('.ally-word'));
        this.allyType1Img = new UIObject($('#ally-type1-img'));
        this.allyType2Img = new UIObject($('#ally-type2-img'));
        this.allyOnlyTypeImg = new UIObject($('#ally-only-type-img'));

        this.foeWord = new UIObject($('.foe-word'));
        this.foeType1Img = new UIObject($('#foe-type1-img'));
        this.foeType2Img = new UIObject($('#foe-type2-img'));
        this.foeOnlyTypeImg = new UIObject($('#foe-only-type-img'));
        
        this.message = new UIObject($('#message'));
        this.waitMessage = new UIObject($('#wait-message'));
        this.modalMessage = new UIObject($('#modal-message'));
        this.includeImg = new UIObject($('#include-img'));
        this.includeImg1 = new UIObject($('#include-img-1'));
        this.includeImg2 = new UIObject($('#include-img-2'));
        this.predictionMessage = new UIObject($('#prediction-message'));

        this.backToTitleBtn = new UIObject($('#back-to-title-btn'));
        this.cancelBtn = new UIObject($('#cancel-battle-btn'));

        this.timerBar = $('#timer-bar');
        this.timerContainer = $('#timer-container');
        this.timerInterval = null;

        // --- 特性関連 ---
        this.abilityInfoContainer = new UIObject($('#ability-info-container'));
        this.situationButton = new UIObject($('#situation-button'));
        this.allyCurrentAbilityName = new UIObject($('#ally-current-ability-name'));
        this.allyCurrentAbilityDesc = new UIObject($('#ally-current-ability-desc'));
        this.foeCurrentAbilityName = new UIObject($('#foe-current-ability-name'));
        this.foeCurrentAbilityDesc = new UIObject($('#foe-current-ability-desc'));
        this.abilityChangeCounterDisplay = new UIObject($('#counter'));
        this.abilityChangeRemainDisplay = new UIObject($('#remain'));
        
        this.abilityModal = new UIObject($('#ability-modal'));
        // DOM再構築のため、初期のセレクタは使わず動的にバインドするが、
        // 既存コードとの互換性のため残す（ただしイベントは script.js で削除する）
        this.closeAbilityModalBtn = new UIObject($()); 
        this.skillsList = new UIObject($()); 

        // --- 状況モーダル関連 ---
        this.situationModal = new UIObject($('#situation-modal'));
        this.situationFoeA = new UIObject($('#foe-A'));
        this.situationFoeB = new UIObject($('#foe-B'));
        this.situationAllyA = new UIObject($('#ally-A'));
        this.situationAllyB = new UIObject($('#ally-B'));
        this.closeSituationModalBtn = new UIObject($('#situation-modal .close-modal'));

        // --- エフェクト関連 ---
        this.allyEffectContainer = new UIObject($('#ally-effect-container'));
        this.foeEffectContainer = new UIObject($('#foe-effect-container'));

        this.allyNameText = "";
        this.foeNameText = "";
        this.isAllyPoison = false;
        this.isFoePoison = false;

        // モーダルのイベントリスナー解除用関数を保持する変数
        this.abilityModalCleanup = null;
    }

    showTitleScreen() {
        this.battleScreen.hide();
        this.titleScreen.show();
    }

    showBattleScreen() {
        this.titleScreen.hide();
        this.battleScreen.selector.css('display', 'flex'); // Flexboxレイアウトを維持
    }

    _setImageWithReplaceAndFade(selector, src, duration = 300) {
        if (!selector || selector.length === 0) return;

        // 同じ画像が表示されている場合は更新しない（点滅防止）
        if (src && selector.attr('src') === src && selector.css('display') !== 'none') {
            return;
        }

        // アニメーション停止（ジャンプさせないことでフラッシュを防止）
        selector.stop(true, false);

        // 消す（src falsy）は一瞬で消す（フェードなし）
        if (!src) {
            selector.hide();
            selector.attr('src', '');
            selector.css('opacity', '');
            return;
        }

        // --- 表示する場合（同じ src でも必ず一度消してから表示） ---
        // 即座に消す（display:none）して src をクリア
        selector.hide();
        selector.attr('src', '');
        selector.css('opacity', '');

        // プリロード
        const img = new Image();
        img.onload = () => {
            // 読み込み成功 → src をセットしてフェードイン
            selector.css({ opacity: 0, display: 'block' });
            selector.attr('src', src);
            selector.animate({ opacity: 1 }, duration, () => {
                // アニメ後にインライン opacity をクリア（CSS に任せる）
                selector.css('opacity', '');
            });
        };
        img.onerror = () => {
            // 読み込み失敗なら隠したまま src をクリア
            selector.hide();
            selector.attr('src', '');
            selector.css('opacity', '');
        };
        img.src = src;
    }

    ClickSubmitBtn(){
        this.submitButton.selector.click();
    }

    enableInput(){
        this.input.selector.prop('disabled', false);
        this.submitButton.selector.prop('disabled', false);
    }

    disableInput(){
        this.input.selector.prop('disabled', true);
        this.submitButton.selector.prop('disabled', true);
    }

    clearInput(){
        this.input.selector.val('');
    }

    showCheckResult(data) {
        const imgOnly = this.includeImg.selector;
        const img1 = this.includeImg1.selector;
        const img2 = this.includeImg2.selector;
        const msg = this.predictionMessage.selector;

        imgOnly.hide().attr('src', '');
        img1.hide().attr('src', '');
        img2.hide().attr('src', '');
        msg.hide().text('');

        if (!data.include) {
            return;
        }

        if (data.used) {
            imgOnly.attr('src', 'img/god.gif').show();
            return;
        }

        const types = [];
        if (data.type1) types.push(data.type1);
        if (data.type2) types.push(data.type2);

        if (types.length === 0) {
            imgOnly.attr('src', 'img/unaware.gif').show();
        } else if (types.length === 1) {
            const src = `img/${type_to_image[types[0]]}.gif`;
            imgOnly.attr('src', src).show();
        } else { // length is 2
            const src1 = `img/${type_to_image[types[0]]}.gif`;
            const src2 = `img/${type_to_image[types[1]]}.gif`;
            img1.attr('src', src1).show();
            img2.attr('src', src2).show();
        }

        if (data.prediction) {
            msg.text(data.prediction).show();
        }
    }

    hideCheckResult() {
        this.includeImg.selector.hide().attr('src', '');
        this.includeImg1.selector.hide().attr('src', '');
        this.includeImg2.selector.hide().attr('src', '');
        this.predictionMessage.selector.hide().text('');
    }
    
    enableSubmitBtn(){
        this.submitButton.selector.prop('disabled', false);
    }

    disableSubmitBtn(){
        this.submitButton.selector.prop('disabled', true);
    }    

    showAllyWord(word){
        this.allyWord.selector.text(word);
        this.allyWord.selector.stop(true, false).css('opacity', 0).show();
        this._adjustWordScale(this.allyWord.selector);
        this.allyWord.selector.animate({ opacity: 1 }, 300);
    }

    // ---------- 置換: showAllyImage ----------
    showAllyImage(data){
        if (!data || !data.state) return;
        const d = data.state;

        // 未設定（[""]）
        if (d.ally_type.length === 1 && d.ally_type[0] === "") {
            this._setImageWithReplaceAndFade(this.allyType1Img.selector, '');
            this._setImageWithReplaceAndFade(this.allyType2Img.selector, '');
            this._setImageWithReplaceAndFade(this.allyOnlyTypeImg.selector, '');
            return;
        }

        // 複合タイプ
        if (d.ally_type.length === 2) {
            const src1 = `img/${type_to_image[d.ally_type[0]]}.gif`;
            const src2 = `img/${type_to_image[d.ally_type[1]]}.gif`;
            // 単タイプを即座に消す
            this._setImageWithReplaceAndFade(this.allyOnlyTypeImg.selector, '');
            // 1枚目を即座に消してからプリロード→フェードイン
            this._setImageWithReplaceAndFade(this.allyType1Img.selector, src1);
            // 少し遅らせて 2 枚目を入れる（演出）
            setTimeout(() => {
                this._setImageWithReplaceAndFade(this.allyType2Img.selector, src2);
            }, 80);
            // 2枚目も表示
            this._setImageWithReplaceAndFade(this.allyType2Img.selector, src2);
            return;
        }

        // 単タイプ
        {
            const src = `img/${type_to_image[d.ally_type[0]]}.gif`;
            // 複合の画像を即座に消してから単タイプを表示
            this._setImageWithReplaceAndFade(this.allyType1Img.selector, '');
            this._setImageWithReplaceAndFade(this.allyType2Img.selector, '');
            this._setImageWithReplaceAndFade(this.allyOnlyTypeImg.selector, src);
        }
    }

    hideAllyImage() {
        // 消すときは一瞬で消す（フェードなし）
        this._setImageWithReplaceAndFade(this.allyType1Img.selector, '');
        this._setImageWithReplaceAndFade(this.allyType2Img.selector, '');
        this._setImageWithReplaceAndFade(this.allyOnlyTypeImg.selector, '');
    }

    showFoeWord(word){
        this.foeWord.selector.text(word);
        this.foeWord.selector.stop(true, false).css('opacity', 0).show();
        this._adjustWordScale(this.foeWord.selector);
        this.foeWord.selector.animate({ opacity: 1 }, 300);
    }

    // ---------- 置換: showFoeImage ----------
    showFoeImage(data){
        if (!data || !data.state) return;
        const d = data.state;

        if (d.foe_type.length === 2) {
            const src1 = `img/${type_to_image[d.foe_type[0]]}.gif`;
            const src2 = `img/${type_to_image[d.foe_type[1]]}.gif`;
            // 単タイプを即座に消す
            this._setImageWithReplaceAndFade(this.foeOnlyTypeImg.selector, '');
            // 1枚目を差し替え（必ず一度消して入れる）
            this._setImageWithReplaceAndFade(this.foeType1Img.selector, src1);
            // 2枚目は少し遅らせて入れる
            setTimeout(() => {
                this._setImageWithReplaceAndFade(this.foeType2Img.selector, src2);
            }, 80);
            // 2枚目も表示
            this._setImageWithReplaceAndFade(this.foeType2Img.selector, src2);
            return;
        }

        // 単タイプ
        {
            const src = `img/${type_to_image[d.foe_type[0]]}.gif`;
            this._setImageWithReplaceAndFade(this.foeType1Img.selector, '');
            this._setImageWithReplaceAndFade(this.foeType2Img.selector, '');
            this._setImageWithReplaceAndFade(this.foeOnlyTypeImg.selector, src);
        }
    }

    hideFoeImage() {
        this._setImageWithReplaceAndFade(this.foeType1Img.selector, '');
        this._setImageWithReplaceAndFade(this.foeType2Img.selector, '');
        this._setImageWithReplaceAndFade(this.foeOnlyTypeImg.selector, '');
    }

    setWaitMessage(message, time=Infinity) {
        this.waitMessage.selector.text(message);
        this.waitMessage.selector.show();
        if(isFinite(time) && time > 0){
          setTimeout(() => {
            this.hideWaitMessage();
          }, time);
        }
    }

    hideWaitMessage() {
        this.waitMessage.selector.hide();
    }

    showModalMessage(message, time = 2000) {
        this.modalMessage.selector.text(message);
        this.modalMessage.selector.show();
        if (isFinite(time) && time > 0) {
            setTimeout(() => {
                this.hideModalMessage();
            }, time);
        }
    }

    hideModalMessage() {
        this.modalMessage.selector.fadeOut('fast');
    }

    setAllyName(name) {
        this.allyNameText = name;
        this._renderAllyName();
    }

    setFoeName(name) {
        this.foeNameText = name;
        this._renderFoeName();
    }

    updatePoisonStatus(isAllyPoison, isFoePoison) {
        this.isAllyPoison = isAllyPoison;
        this.isFoePoison = isFoePoison;
        this._renderAllyName();
        this._renderFoeName();
    }

    _renderAllyName() {
        const el = $('.ally-name');
        el.text(this.allyNameText || "");
        if (this.isAllyPoison) el.append('<span class="poison">どく</span>');
        el.show();
    }

    _renderFoeName() {
        const el = $('.foe-name');
        el.text(this.foeNameText || "");
        if (this.isFoePoison) el.append('<span class="poison">どく</span>');
        el.show();
    }

    setAllyHP(hp, max_hp) {
        this.updateHPBar(hp, max_hp, $('.ally-hp-bar'));
        $('.balloon.right .hp').text(hp + '/' + max_hp);
    }

    setFoeHP(hp, max_hp) {
        this.updateHPBar(hp, max_hp, $('.foe-hp-bar'));
        $('.balloon.left .hp').text(hp + '/' + max_hp);
    }

    getHPBarColor(ratio) {
        if (ratio > 0.5) {
            return "#00FF00"; // 緑色
        } else if (ratio > 0.2) {
            return "#FFFF00"; // 黄色
        } else {
            return "#FF0000"; // 赤色
        }
    }

    updateHPBar(hp, max_hp, dom) {
        const new_bar_vw = hp / max_hp * 100;
        dom.animate({
            width: `${new_bar_vw}%`
        }, {
            duration: "slow",
            complete: () => {
                dom.css({
                    backgroundColor: this.getHPBarColor(hp / max_hp)
                });
            }
        });
    }

    updateHPs(ally_HP, ally_max_HP, foe_HP, foe_max_HP) {
        this.setAllyHP(ally_HP, ally_max_HP);
        this.updateHPBar(ally_HP, ally_max_HP, $('#ally-hp-bar'));
        this.setFoeHP(foe_HP, foe_max_HP);
        this.updateHPBar(foe_HP, foe_max_HP, $('#foe-hp-bar'));
    }

    resetHP() {
        $('.ally-hp-bar').stop(true, true).css({ width: '100%', backgroundColor: '#00FF00' });
        $('.foe-hp-bar').stop(true, true).css({ width: '100%', backgroundColor: '#00FF00' });
        $('.balloon.right .hp').text('');
        $('.balloon.left .hp').text('');
    }

    showMessage(text) {
        if (text) {
            this.message.selector.text(text).show();
        } else {
            if  (!this.isMessageVisible()) {
                this.message.selector.text("").show();
            }
        }
    }

    hideMessage() {
        this.message.selector.hide();
    }

    isMessageVisible() {
        return this.message.selector.is(':visible');
    }

    setInputText(text){
        this.input.selector.attr('placeholder', text);
    }

    showBackToTitleBtn() {
        const el = this.backToTitleBtn.selector;
        // display のみ切り替え、見た目は CSS の初期スタイルに任せる
        el.removeClass('bt-visible');
        el.css('display', 'inline-block'); // show()だとblockになる可能性があるため
        el.show();
        // 少し遅延してクラスを付与（トランジション発火）
        setTimeout(() => {
            el.addClass('bt-visible');
        }, 20);
    }

    hideBackToTitleBtn() {
        const el = this.backToTitleBtn.selector;
        el.removeClass('bt-visible');
        // トランジション終了後に display:none にする
        setTimeout(() => {
            // ensure any inline styles cleared
            el.hide();
            el.css({ opacity: '', transform: '' });
        }, 360);
    }

    hideInput() {
        if (this.input && this.input.selector) {
            this.input.selector.hide();
        }
    }

    showInput() {
        if (this.input && this.input.selector) {
            this.input.selector.show();
        }
    }

    focusInput() {
        if (this.input && this.input.selector) {
            this.input.selector.focus();
        }
    }

    hideSubmitBtn() {
        if (this.submitButton && this.submitButton.selector) {
            this.submitButton.selector.hide();
        }
    }

    showSubmitBtn() {
        if (this.submitButton && this.submitButton.selector) {
            this.submitButton.selector.show();
        }
    }

    showCancelBtn() {
        this.cancelBtn.show();
    }

    // ★追加: 中断ボタンの非表示
    hideCancelBtn() {
        this.cancelBtn.hide();
    }

    _adjustWordScale(element) {
        const maxWidth = 180;
        const domElement = element.get ? element.get(0) : element;

        if (domElement && domElement.scrollWidth > maxWidth) {
            const scale = maxWidth / domElement.scrollWidth;
            if (domElement.classList.contains('foe-word')) {
                domElement.style.transform = `translateX(50%) scaleX(${scale})`;
            } else {
                domElement.style.transform = `translateX(-50%) scaleX(${scale})`;
            }
        } else if (domElement) {
            if (domElement.classList.contains('foe-word')) {
                domElement.style.transform = `translateX(50%) scaleX(1)`;
            } else {
                domElement.style.transform = `translateX(-50%) scaleX(1)`;
            }
        }
    }

    startTimer(remaining, total = remaining) {
        this.stopTimer();
        const endTime = Date.now() + remaining * 1000;
        
        const update = () => {
            const currentRemaining = (endTime - Date.now()) / 1000;
            const percentage = (currentRemaining / total) * 100;
            this.timerBar.css('width', `${Math.max(0, percentage)}%`);
            
            if (percentage < 30) {
                this.timerBar.css('background-color', '#FF0000'); // 赤
            } else if (percentage < 60) {
                this.timerBar.css('background-color', '#FFFF00'); // 黄
            } else {
                this.timerBar.css('background-color', '#00FF00'); // 緑
            }

            if (currentRemaining <= 0) {
                this.stopTimer();
            }
        };

        update(); // 初回実行
        this.timerInterval = setInterval(update, 100);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    showTimerContainer() {
        this.timerContainer.show();
    }

    hideTimerContainer() {
        this.timerContainer.hide();
    }

    // --- 特性関連メソッド ---
    updateAbilityInfo(name, count) {
        // モーダル内の残り回数表示を更新。「あと0回」も表示する
        this.abilityChangeCounterDisplay.selector.show();
        this.abilityChangeRemainDisplay.selector.text(count);
    }

    showAbilityModal() {
        this.abilityModal.selector.css({
            display: 'flex',
            opacity: 0
        }).animate({ opacity: 1 }, 'fast');
    }

    hideAbilityModal() {
        // モーダルを閉じるときに確実にイベントリスナーを解除する
        if (this.abilityModalCleanup) {
            this.abilityModalCleanup();
            this.abilityModalCleanup = null;
        }
        this.abilityModal.selector.fadeOut('fast');
    }

    populateAbilityModal(allAbilities, currentAbilityId, canChange, onDecideCallback, onCloseCallback) {
        // 再描画の前に、既存のイベントリスナーがあれば解除する（重複防止）
        if (this.abilityModalCleanup) {
            this.abilityModalCleanup();
            this.abilityModalCleanup = null;
        }

        const modal = this.abilityModal.selector;
        modal.empty();

        // データ準備
        const abilities = [];
        let initialIndex = 0;
        let index = 0;
        
        for (const [id, info] of Object.entries(allAbilities)) {
            if (id === 'secret') continue;
            abilities.push({ id, ...info });
            if (id === currentAbilityId) initialIndex = index;
            index++;
        }

        // 構造作成
        const wrapper = $('<div class="ability-modal-wrapper"></div>');

        // 1. 現在の特性
        const currentInfo = allAbilities[currentAbilityId] || { name: '---', description: '' };
        const currentSection = $(`
            <div class="current-ability-section">
                <span class="section-label">現在のとくせい</span>
                <h3 class="ability-name-display">${currentInfo.name}</h3>
                <p class="ability-desc-display">${currentInfo.description}</p>
            </div>
        `);
        wrapper.append(currentSection);

        // 2. カルーセル (特性変更欄)
        const carouselContainer = $('<div class="carousel-container"></div>');
        const carouselTrack = $('<div class="carousel-track"></div>');
        const items = [];

        abilities.forEach((ab, i) => {
            const iconType = ab.icon_type || 'ノーマル';
            const iconName = type_to_image[iconType] || 'normal';
            const item = $(`
                <div class="carousel-item" data-index="${i}">
                    <img src="img/${iconName}.gif" alt="${ab.name}">
                </div>
            `);

            items.push(item);
            carouselTrack.append(item);
        });
        carouselContainer.append(carouselTrack);
        wrapper.append(carouselContainer);

        // 3. 新しい特性の情報
        const newInfoSection = $(`
            <div class="current-ability-section" style="border-bottom: none; margin-bottom: 0;">
                <span class="section-label" style="color: #ff9800;">変更後のとくせい</span>
                <h3 class="ability-name-display" id="new-ability-name"></h3>
                <p class="ability-desc-display" id="new-ability-desc"></p>
            </div>
        `);
        wrapper.append(newInfoSection);

        // 4. アクションボタン
        const actions = $('<div class="modal-actions"></div>');
        const decideBtn = $('<button class="modal-btn btn-decide">決定</button>');
        const closeBtn = $('<button class="modal-btn btn-close">とじる</button>');

        if (!canChange) {
            decideBtn.prop('disabled', true).text('変更不可');
        }

        decideBtn.on('click', () => {
            const selectedId = abilities[currentIndex].id;
            // 同じ特性なら何もしないか閉じる
            if (selectedId === currentAbilityId) {
                onCloseCallback();
            } else {
                onDecideCallback(selectedId);
                onCloseCallback();
            }
        });

        closeBtn.on('click', () => {
            onCloseCallback();
        });

        actions.append(closeBtn, decideBtn);
        wrapper.append(actions);
        modal.append(wrapper);

        // --- カルーセル制御ロジック ---
        // 滑らかな動きのために浮動小数点でインデックスを管理
        let currentFloatIndex = initialIndex;
        let currentIndex = initialIndex; // 決定ボタンなどで使う整数値
        const N = abilities.length;
        let animationFrameId = null;
        
        // 画面描画更新関数
        const updateCarousel = (floatIdx) => {
            // 表示用の正規化インデックス（浮動小数点）は計算上使わないが、
            // UI更新用の整数インデックスを計算する
            const roundedIndex = Math.round(floatIdx);
            // ループ対応の正規化（0 ～ N-1）
            currentIndex = ((roundedIndex % N) + N) % N;
            
            const ab = abilities[currentIndex];

            // 情報更新
            $('#new-ability-name').text(ab.name);
            $('#new-ability-desc').text(ab.description);

            // 決定ボタン状態更新
            if (canChange) {
                if (ab.id === currentAbilityId) {
                    decideBtn.text('そのまま').css('background', '#aaa');
                } else {
                    decideBtn.text('決定').css('background', '');
                }
            }

            // 配置計算 (アーチ状)
            const spacing = 80; // アイコン間の横幅を少し広げる

            items.forEach((item, i) => {
                // 現在位置からの最短距離を計算（ループ対応）
                // floatIdx と i の差分を取る
                let diff = i - floatIdx;
                // diff を -N/2 ～ N/2 の範囲に正規化（計算式で一発変換）
                diff = diff - Math.round(diff / N) * N;

                const absDiff = Math.abs(diff);
                
                // 横位置
                const x = diff * spacing; 
                // 縦位置 (放物線: y = a * x^2) - 中央が一番上(0)、端が下がる(+) 
                // 係数を5->2に減らして、下から湧き上がる感を軽減
                const y = absDiff * absDiff * 2; 
                
                // スケール
                const scale = Math.max(0.6, 1 - absDiff * 0.15);
                
                // z-index
                const z = 100 - Math.round(absDiff);
                
                // 透明度（もっと端まで表示するように減衰を緩やかにし、表示範囲を広げる）
                let opacity = Math.max(0, 1 - absDiff * 0.2); 
                if (absDiff > 4.5) opacity = 0; // 閾値を広げる
                
                // スタイル適用
                item.css({
                    transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`,
                    zIndex: z,
                    opacity: opacity,
                    pointerEvents: opacity > 0.1 ? 'auto' : 'none' // 可視範囲ならクリック可能にする
                });

                if (absDiff < 0.5) {
                    item.addClass('selected');
                } else {
                    item.removeClass('selected');
                }
            });
        };

        // 目標位置へアニメーションする関数
        const animateTo = (target) => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            
            const animate = () => {
                // 現在地と目標の差分
                const diff = target - currentFloatIndex;
                
                // 十分近ければ終了
                if (Math.abs(diff) < 0.005) {
                    currentFloatIndex = target;
                    updateCarousel(currentFloatIndex);
                    return;
                }
                
                // 慣性スクロール（係数を上げてキビキビ動かす）
                currentFloatIndex += diff * 0.35; 
                updateCarousel(currentFloatIndex);
                animationFrameId = requestAnimationFrame(animate);
            };
            animate();
        };

        // 初回反映
        // レイアウト確定後に計算するため少し待つ
        setTimeout(() => updateCarousel(initialIndex), 0);

        // タップ選択時の挙動上書き（updateCarouselを使う形に）
        items.forEach((item, i) => {
            item.off('click').on('click', () => {
                if (isDragMove) return; // ドラッグ移動していたらクリック処理しない
                
                // 最短距離で移動するためのターゲット計算
                let diff = i - currentFloatIndex;
                diff = diff - Math.round(diff / N) * N;
                
                animateTo(currentFloatIndex + diff);
            });
        });

        // ドラッグ/スワイプ操作
        let startX = 0;
        let lastX = 0;
        let isDragging = false;
        let isDragMove = false; // クリックとドラッグを区別するためのフラグ

        const onDragStart = (e) => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            isDragging = true;
            isDragMove = false;
            const pageX = e.pageX || (e.originalEvent.touches ? e.originalEvent.touches[0].pageX : 0);
            startX = pageX;
            lastX = pageX;
        };
        
        const onDragMove = (e) => {
            if (!isDragging) return;
            e.preventDefault(); // スクロール防止
            
            const pageX = e.pageX || (e.originalEvent.touches ? e.originalEvent.touches[0].pageX : 0);
            const deltaX = pageX - lastX;
            lastX = pageX;

            // 微小な動きはクリックとみなすために無視するが、一定以上動いたらドラッグとする
            if (Math.abs(pageX - startX) > 5) {
                isDragMove = true;
            }

            // 移動量に応じてインデックスを動かす（感度調整: 動きをダイレクトにするため値を小さく）
            currentFloatIndex -= deltaX / 65; 
            updateCarousel(currentFloatIndex);
        };

        const onDragEnd = (e) => {
            if (!isDragging) return;
            isDragging = false;
            
            // ドラッグ操作だった場合のみスナップさせる（クリックの場合はクリックハンドラに任せる）
            if (isDragMove) {
                // 最寄りの整数インデックスへ吸着させる
                const target = Math.round(currentFloatIndex);
                animateTo(target);
            }
            
            // クリック判定のために isDragMove のリセットは遅延させる
            setTimeout(() => { isDragMove = false; }, 0);
        };

        carouselContainer.on('mousedown touchstart', onDragStart);
        $(document).on('mousemove touchmove', onDragMove); // 画面外に出ても追従するようにdocumentで受ける
        $(document).on('mouseup touchend', onDragEnd);

        // 解除用関数をクラスプロパティに保存
        this.abilityModalCleanup = () => {
            $(document).off('mousemove touchmove', onDragMove);
            $(document).off('mouseup touchend', onDragEnd);
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }

    // --- 状況モーダル関連メソッド ---
    showSituationModal() {
        this.situationModal.selector.fadeIn('fast');
    }

    hideSituationModal() {
        this.situationModal.selector.fadeOut('fast');
    }

    resetSituationInfo() {
        this.situationAllyA.selector.text("1.0倍");
        this.situationAllyB.selector.text("1.0倍");
        this.situationFoeA.selector.text("1.0倍");
        this.situationFoeB.selector.text("1.0倍");
    }

    updateSituationInfo(allyAtk, allyDef, foeAtk, foeDef) {
        // ランクから倍率への変換マップ (backend/SB_info.py と同期)
        const rankToPower = (rank) => {
             const mapping = {
                "-6": 0.25, "-5": 0.28, "-4": 0.33, "-3": 0.4, "-2": 0.5, "-1": 0.66, "0": 1.0,
                "1": 1.5, "2": 2.0, "3": 2.5, "4": 3.0, "5": 3.5, "6": 4.0
            };
            return mapping[rank] || 1.0;
        };

        const formatMultiplier = (num) => {
            // 整数（1.0, 2.0など）の場合は小数点以下1桁で表示
            if (num % 1 === 0) {
                return num.toFixed(1);
            }
            // 小数（1.5, 0.66など）の場合はそのまま表示
            return num.toString();
        };

        this.situationAllyA.selector.text(formatMultiplier(rankToPower(allyAtk)) + "倍");
        this.situationAllyB.selector.text(formatMultiplier(rankToPower(allyDef)) + "倍");
        this.situationFoeA.selector.text(formatMultiplier(rankToPower(foeAtk)) + "倍");
        this.situationFoeB.selector.text(formatMultiplier(rankToPower(foeDef)) + "倍");
    }

    // --- エフェクト再生メソッド ---
    playHealEffect(isAlly) {
        const container = isAlly ? this.allyEffectContainer.selector : this.foeEffectContainer.selector;
        
        // パーティクルを数個生成してふわふわさせる
        for (let i = 0; i < 15; i++) {
            setTimeout(() => {
                const particle = $('<div class="heal-particle"></div>');
                // ランダムな位置とサイズ
                const left = Math.random() * 180 + 20;
                const size = Math.random() * 0.8 + 0.5;
                
                particle.css({
                    left: `${left}px`,
                    bottom: '10px',
                    transform: `scale(${size})`,
                    animation: `floatUp 1.5s ease-out forwards`
                });
                
                container.append(particle);
                
                // アニメーション終了後に削除
                setTimeout(() => { particle.remove(); }, 1500);
            }, i * 80); // 少しずつずらして出現させる
        }
    }

    playStatUpEffect(isAlly) {
        const container = isAlly ? this.allyEffectContainer.selector : this.foeEffectContainer.selector;
        
        for (let i = 0; i < 10; i++) {
            setTimeout(() => {
                const particle = $(`<div class="stat-up-particle"></div>`);
                // ランダムな位置とサイズ
                const left = Math.random() * 180 + 20;
                const size = Math.random() * 0.8 + 0.5;
                
                particle.css({
                    left: `${left}px`,
                    bottom: '40px', // 開始位置を少し上に調整
                    transform: `scale(${size})`,
                    animation: `floatUp 1.5s ease-out forwards`
                });
                
                container.append(particle);
                setTimeout(() => { particle.remove(); }, 1500);
            }, i * 100);
        }
    }

    playStatDownEffect(isAlly) {
        const container = isAlly ? this.allyEffectContainer.selector : this.foeEffectContainer.selector;
        
        for (let i = 0; i < 10; i++) {
            setTimeout(() => {
                const particle = $(`<div class="stat-down-particle"></div>`);
                // ランダムな位置とサイズ
                const left = Math.random() * 180 + 20;
                const size = Math.random() * 0.8 + 0.5;
                
                particle.css({
                    left: `${left}px`,
                    top: '50px', // 開始位置を少し下に調整
                    transform: `scale(${size})`,
                    animation: `floatDown 1.5s ease-out forwards`
                });
                
                container.append(particle);
                setTimeout(() => { particle.remove(); }, 1500);
            }, i * 100);
        }
    }

    playDamageEffect(isAlly) {
        const elements = isAlly ?
            [this.allyType1Img, this.allyType2Img, this.allyOnlyTypeImg, this.allyWord] :
            [this.foeType1Img, this.foeType2Img, this.foeOnlyTypeImg, this.foeWord];

        elements.forEach(el => {
            el.selector.addClass('damage-blink');
        });

        // 1秒後にクラスを削除（次のアニメーションのため）
        setTimeout(() => {
            elements.forEach(el => el.selector.removeClass('damage-blink'));
        }, 1000);
    }
}
