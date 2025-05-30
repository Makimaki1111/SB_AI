class UIObject{
    constructor(selector) {
        this.selector = selector;
    }

    show(){
        this.selector.show();
    }

    hide(){
        this.selector.hide();
    }

    onClick(func){
        this.selector.on('click', e => func(e))
    }
}
