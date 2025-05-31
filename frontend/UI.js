class UI{
    constructor() {
        this.titleScreen = new UIObject($('#title-screen'));
        this.battleScreen = new UIObject($('#battle-screen'));
        this.vsPlayerBtn = new UIObject($('#vs-player-btn'));
        this.vsCpuBtn = new UIObject($('#vs-cpu-btn'));
        this.input = new UIObject($('#input'));
        this.submitButton = new UIObject($('#submit'));
        
        //this.player1Name = new UIObject($('#player1-name'));
        this.allyWord = new UIObject($('.ally-word'));
        this.allyType1Img = new UIObject($('#ally-type1-img'));
        this.allyType2Img = new UIObject($('#ally-type2-img'));
        this.allyOnlyTypeImg = new UIObject($('#ally-only-type-img'));
        
        //this.player2Name = new UIObject($('#player2-name'));
        this.waitMessage = new UIObject($('#wait-message'));
        this.includeImg = new UIObject($('#include-img'));
    }

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

    showAllyImage(data){
        if(data.state){
            if(data.state.ally_type.length == 2){ // 複合タイプの場合
                this.allyType1Img.selector.attr('src', `img/${type_to_image[data.state.ally_type[0]]}.gif`);
                this.allyType2Img.selector.attr('src', `img/${type_to_image[data.state.ally_type[1]]}.gif`);
                this.allyOnlyTypeImg.selector.attr('src', ``);
                this.allyOnlyTypeImg.selector.hide();
                this.allyType1Img.selector.show();
                this.allyType2Img.selector.show();
            } else { // 単タイプの場合
                this.allyOnlyTypeImg.selector.attr('src', `img/${type_to_image[data.state.ally_type[0]]}.gif`);
                this.allyType1Img.selector.attr('src', ``);
                this.allyType2Img.selector.attr('src', ``);
                this.allyType1Img.selector.hide();
                this.allyType2Img.selector.hide();
                this.allyOnlyTypeImg.selector.show();
            }
        }
    }

    showFoeWord(word){
        // ここでは敵の単語表示の処理を追加することができます
        // 現在は実装されていないため、必要に応じて実装してください
        console.log("Foe word:", word);
    }

    setWaitMessage(message, time) {
        this.waitMessage.selector.text(message);
        this.waitMessage.selector.show();
        if(time > 0){
          setTimeout(() => {
            this.waitMessage.hide()
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
        // 右下ふきだし内のHPテキスト
        $('.balloon.right .hp').text(hp + '/' + max_hp);
    }

    setFoeHP(hp, max_hp) {
        this.updateHPBar(hp, max_hp, $('.foe-hp-bar'));
        // 左上ふきだし内のHPテキスト
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
        console.log(`Updating HP bar: ${hp}/${max_hp}`);
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
}

function shrinkTooWideWord(element) {
  const maxWidth = 180;
  const domElement = element.get ? element.get(0) : element;

  if (domElement && domElement.scrollWidth > maxWidth) {
    const scale = maxWidth / domElement.scrollWidth;
    domElement.style.transform = `translateX(-50%) scaleX(${scale})`;
  } else if (domElement) {
    domElement.style.transform = `translateX(-50%) scaleX(1)`;
  }
}