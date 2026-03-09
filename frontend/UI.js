class UI{
    constructor() {
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
        this.closeAbilityModalBtn = new UIObject($('#ability-modal .close-modal')); // "とじる" ボタン
        this.skillsList = new UIObject($('#skills')); // 選択可能な特性アイコンのコンテナ

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
        this.abilityModal.selector.fadeOut('fast');
    }

    populateAbilityModal(allAbilities, currentAbilityId, onSelectCallback) {
        const listElement = this.skillsList.selector;
        listElement.empty(); // 以前のリストをクリア

        const canChange = battleState.ally.abilityChangeCount > 0;

        for (const [id, abilityInfo] of Object.entries(allAbilities)) {
            if (id === 'secret') continue;

            const container = $('<div>').attr('id', id).addClass('skill-item'); // 各特性のコンテナ

            // アイコン画像
            const iconType = abilityInfo.icon_type || 'ノーマル'; // Default to 'ノーマル'
            const iconName = type_to_image[iconType] || 'normal'; // Default to 'normal' image
            const iconSrc = `img/${iconName}.gif`;
            const iconImg = $('<img>').addClass('skill-icon').attr('src', iconSrc);
            iconImg.attr('alt', abilityInfo.name); // アクセシビリティのためalt属性を追加

            // 特性名
            const abilityNameSpan = $('<span>').text(abilityInfo.name);

            container.append(iconImg, $('<br>'), abilityNameSpan); // <br>を追加して改行

            // 現在の特性、または変更回数が0の場合は選択不可
            if (id === currentAbilityId) {
                container.addClass('selected');
            }

            if (id !== currentAbilityId && canChange) {
                container.on('click', () => onSelectCallback(id));
            } else {
                container.addClass('disabled');
            }
            listElement.append(container);
        }
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
