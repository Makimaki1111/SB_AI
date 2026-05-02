export class UIObject {
    constructor(selector) {
        this.selector = selector;
    }

    show() {
        this.selector.show();
    }

    hide() {
        this.selector.hide();
    }

    onClick(func) {
        this.selector.on('click', e => func(e));
    }

    text(val) {
        if (val !== undefined) {
            this.selector.text(val);
            return this;
        }
        return this.selector.text();
    }

    val(val) {
        if (val !== undefined) {
            this.selector.val(val);
            return this;
        }
        return this.selector.val();
    }
}
