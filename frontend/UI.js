class UI{
    constructor() {
        this.titleScreen = new UIObject($('#title-screen'));
        this.battleScreen = new UIObject($('#battle-screen'));
        this.vsPlayerBtn = new UIObject($('#vs-player-btn'));
        this.vsCpuBtn = new UIObject($('#vs-cpu-btn'));
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
        this.includeImg = new UIObject($('#include-img'));

        this.backToTitleBtn = new UIObject($('#back-to-title-btn'));
        this.cancelBtn = new UIObject($('#cancel-battle-btn'));
    }

    _setImageWithReplaceAndFade(selector, src, duration = 100) {
        if (!selector || selector.length === 0) return;

        selector.stop(true, true);

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

    // ---------- 画面切り替え等 ----------
    showTitleScreen() {
        this.titleScreen.show();
        this.battleScreen.hide();
    }

    showBattleScreen() {
        this.titleScreen.hide();
        this.battleScreen.show();
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

    showPreImg(){
        this.includeImg.selector.attr('src', "img/unaware.gif");
        this.includeImg.selector.css('display', 'block');
    }

    hidePreImg(){
        this.includeImg.selector.css('display', 'none');
        this.includeImg.selector.attr('src', "");
    }

    showUsedWord(data){
        this.includeImg.selector.attr('src', "img/god.gif");
        this.includeImg.selector.css('display', 'block');
    }

    enableSubmitBtn(){
        this.submitButton.selector.prop('disabled', false);
    }

    disableSubmitBtn(){
        this.submitButton.selector.prop('disabled', true);
    }    

    showAllyWord(word){
        this.allyWord.selector.text(word);
        this.allyWord.selector.show();
        shrinkTooWideWord(this.allyWord.selector);
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
        this.foeWord.selector.show();
        shrinkTooWideWord(this.foeWord.selector);
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
        if(time > 0){
          setTimeout(() => {
            this.hideWaitMessage();
          }, 2000);
        }
    }

    hideWaitMessage() {
        this.waitMessage.selector.hide();
    }


    setAllyName(name) {
        $('.ally-name').text(name).show();
    }

    setFoeName(name) {
        $('.foe-name').text(name).show();
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

    initializeMessage(){
        this.message.selector.removeAttr('style');
        this.message.selector.text("");
    }

    showMessage(text) {
        this.initializeMessage();
        this.message.selector.removeAttr('style');
        this.message.selector.text(text);
    }

    hideMessage() {
        this.message.selector.css('display', 'none');
    }

    setInputText(text){
        this.input.selector.attr('placeholder', text);
    }

    alertWrongChar(){
        
    }

    alertNN() {
        
    }

    showBackToTitleBtn() {
        const el = this.backToTitleBtn.selector;
        // display のみ切り替え、見た目は CSS の初期スタイルに任せる
        el.removeClass('bt-visible');
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
}

// shrinkTooWideWord はそのまま利用
function shrinkTooWideWord(element) {
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
