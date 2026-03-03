// double_UI.js - ダブルバトル用UI管理クラス

class DoubleUI {
    constructor() {
        this.lobbyScreen = new UIObject($('#double-lobby-screen'));
        this.battleScreen = new UIObject($('#double-battle-screen'));

        this.input = new UIObject($('#input'));
        this.submitButton = new UIObject($('#submit'));
        this.includeImg = new UIObject($('#include-img'));

        this.message = new UIObject($('#message'));
        this.waitMessage = new UIObject($('#wait-message'));

        this.backToTitleBtn = new UIObject($('#back-to-title-btn'));
        this.cancelBtn = new UIObject($('#cancel-battle-btn'));

        this.timerBar = $('#timer-bar');
        this.timerContainer = $('#timer-container');
        this.timerInterval = null;

        // キャラコンテナとUI群
        this.chars = {
            p1a: this.initCharUI('p1a'),
            p1b: this.initCharUI('p1b'),
            p2a: this.initCharUI('p2a'),
            p2b: this.initCharUI('p2b')
        };

        this.targetSelectionUi = new UIObject($('#target-selection-ui'));
        this.situationButton = new UIObject($('#situation-button'));
        this.abilityInfoContainer = new UIObject($('#ability-info-container'));

        this.situationModal = new UIObject($('#situation-modal'));
        this.closeSituationModalBtn = new UIObject($('#close-situation-modal-btn'));
        this.abilityModal = new UIObject($('#ability-modal'));
        this.closeAbilityModalBtn = new UIObject($('#close-ability-modal-btn'));

        // Events binding
        this.submitButton.selector.on('click', () => {
            const word = this.input.selector.val();
            sendDoubleSubmitWord(word); // Defined in double_script.js
        });

        this.input.selector.on('keypress', (e) => {
            if (e.which === 13) {
                this.submitButton.selector.click();
            }
        });
    }

    initCharUI(id) {
        return {
            wrapper: new UIObject($(`#char-${id}-wrapper`)),
            img1: new UIObject($(`#${id}-img-1`)),
            img2: new UIObject($(`#${id}-img-2`)),
            word: new UIObject($(`#${id}-word`)),
            effect: new UIObject($(`#${id}-effect-container`)),
            nameEl: new UIObject($(`#${id}-name`)),
            hpBar: new UIObject($(`#${id}-hp-bar`)),
            hpText: new UIObject($(`#${id}-hp-text`))
        };
    }

    resetAll() {
        this.hideMessage();
        this.hideWaitMessage();
        this.hideBackBtn();
        this.stopTimer();
        this.clearInput();
        this.hideInputArea();

        for (const id in this.chars) {
            this.setCharVisibility(id, true);
            this.setWord(id, "");
            this.setHP(id, 1, 1); // Full width visual reset
        }
    }

    setCharVisibility(id, visible) {
        if (visible) {
            this.chars[id].wrapper.show();
            this.chars[id].img1.selector.css('opacity', 1).removeClass('damage-blink');
            this.chars[id].img2.selector.css('opacity', 1).removeClass('damage-blink');
        } else {
            // slightly transparent or hidden based on preference
            this.chars[id].img1.selector.css('opacity', 0.3);
            this.chars[id].img2.selector.css('opacity', 0.3);
            this.setWord(id, "");
        }
    }

    setName(id, nameText) {
        this.chars[id].nameEl.selector.text(nameText);
    }

    setHP(id, hp, max_hp) {
        const dom = this.chars[id].hpBar.selector;
        let new_bar_vw = (hp / max_hp) * 100;
        if (new_bar_vw < 0) new_bar_vw = 0;

        let color = "#00FF00";
        if (new_bar_vw <= 50 && new_bar_vw > 20) color = "#FFFF00";
        else if (new_bar_vw <= 20) color = "#FF0000";

        dom.animate({ width: `${new_bar_vw}%` }, {
            duration: "slow",
            complete: () => { dom.css({ backgroundColor: color }); }
        });

        if (this.chars[id].hpText) {
            this.chars[id].hpText.selector.text(`${hp}/${max_hp}`);
        }
    }

    setWord(id, wordText) {
        const dom = this.chars[id].word.selector;
        if (wordText) {
            dom.text(wordText);
            dom.stop(true, false).css('opacity', 0).show();
            dom.animate({ opacity: 1 }, 300);
        } else {
            dom.hide();
        }
    }

    setCharImage(id, types) {
        if (!this.chars[id] || typeof type_to_image === "undefined" || !types || types.length === 0) return;

        if (types.length === 2) {
            const newImg1 = type_to_image[types[0]];
            const newImg2 = type_to_image[types[1]];
            if (newImg1) {
                this.chars[id].img1.selector.attr('src', "img/" + newImg1 + ".gif").show();
                this.chars[id].img2.selector.hide();
                if (newImg2) {
                    setTimeout(() => {
                        if (this.chars[id]) this.chars[id].img2.selector.attr('src', "img/" + newImg2 + ".gif").show();
                    }, 80);
                }
            }
        } else {
            const newImg = type_to_image[types[0]];
            if (newImg) {
                this.chars[id].img1.selector.attr('src', "img/" + newImg + ".gif").show();
                this.chars[id].img2.selector.hide();
            }
        }
    }

    playEffect(id, type) {
        if (!this.chars[id]) return;

        const container = this.chars[id].effect.selector;

        if (type === "damage") {
            this.chars[id].img1.selector.addClass('damage-blink');
            this.chars[id].img2.selector.addClass('damage-blink');
            setTimeout(() => {
                if (this.chars[id]) {
                    this.chars[id].img1.selector.removeClass('damage-blink');
                    this.chars[id].img2.selector.removeClass('damage-blink');
                }
            }, 1000);
        }
        else if (type === "heal") {
            for (let i = 0; i < 15; i++) {
                setTimeout(() => {
                    const particle = $('<div class="heal-particle"></div>');
                    // 位置はコンテナ相対
                    const left = Math.random() * 80;
                    const size = Math.random() * 0.8 + 0.5;
                    particle.css({
                        left: `${left}px`,
                        bottom: '0px',
                        transform: `scale(${size})`,
                        animation: `floatUp 1.5s ease-out forwards`
                    });
                    container.append(particle);
                    setTimeout(() => { particle.remove(); }, 1500);
                }, i * 80);
            }
        }
    }

    showMessage(text) {
        if (text) {
            this.message.selector.text(text).show();
            this.hideInputArea();
            this.setTargetSelectionVisible(false);
            this.hideWaitMessage();
        } else {
            this.message.selector.hide();
        }
    }

    hideMessage() {
        this.message.selector.hide();
    }

    setWaitMessage(msg, timeout = 0) {
        this.waitMessage.selector.text(msg).show();
        this.disableInput();

        if (timeout > 0) {
            setTimeout(() => {
                this.hideWaitMessage();
                this.enableInput();
            }, timeout);
        }
    }

    hideWaitMessage() {
        this.waitMessage.selector.hide();
    }

    showInputArea() {
        this.message.selector.hide();
        this.input.selector.show();
        this.submitButton.selector.show();
    }

    hideInputArea() {
        this.input.selector.hide();
        this.submitButton.selector.hide();
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

    clearInput() {
        this.input.selector.val('');
    }

    setInputText(text) {
        this.input.selector.attr('placeholder', text);
    }

    setTargetSelectionVisible(visible) {
        const dom = this.targetSelectionUi.selector;
        if (visible) {
            dom.css('display', 'flex');
        } else {
            dom.hide();
        }
    }

    showBackBtn() {
        this.backToTitleBtn.selector.css('display', 'block');
        this.cancelBtn.hide();
    }

    hideBackBtn() {
        this.backToTitleBtn.selector.hide();
        this.cancelBtn.show();
    }

    // タイマー関連 (既存ロジック流用)
    startTimer(remaining, total = remaining) {
        this.stopTimer();
        const endTime = Date.now() + remaining * 1000;

        const update = () => {
            const currentRemaining = (endTime - Date.now()) / 1000;
            const percentage = (currentRemaining / total) * 100;
            this.timerBar.css('width', `${Math.max(0, percentage)}%`);

            if (percentage < 30) {
                this.timerBar.css('background-color', '#FF0000');
            } else if (percentage < 60) {
                this.timerBar.css('background-color', '#FFFF00');
            } else {
                this.timerBar.css('background-color', '#00FF00');
            }

            if (currentRemaining <= 0) {
                this.stopTimer();
            }
        };

        update();
        this.timerInterval = setInterval(update, 100);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    showSituationModal() { this.situationModal.selector.fadeIn('fast'); }
    hideSituationModal() { this.situationModal.selector.fadeOut('fast'); }
    showAbilityModal() { this.abilityModal.selector.fadeIn('fast'); }
    hideAbilityModal() { this.abilityModal.selector.fadeOut('fast'); }

    updateSituationInfo(chars) {
        const rankToPower = (rank) => {
            const mapping = {
                "-6": 0.25, "-5": 0.28, "-4": 0.33, "-3": 0.4, "-2": 0.5, "-1": 0.66, "0": 1.0,
                "1": 1.5, "2": 2.0, "3": 2.5, "4": 3.0, "5": 3.5, "6": 4.0
            };
            return mapping[rank] || 1.0;
        };

        const formatMultiplier = (num) => {
            if (num % 1 === 0) return num.toFixed(1) + "倍";
            return num.toString() + "倍";
        };

        for (let id of ['p1a', 'p1b', 'p2a', 'p2b']) {
            if (chars[id]) {
                $(`#s-${id}-name`).text(chars[id].name);
                $(`#s-${id}-atk`).text(formatMultiplier(rankToPower(chars[id].attack_rank)));
                $(`#s-${id}-def`).text(formatMultiplier(rankToPower(chars[id].defense_rank)));
            }
        }
    }

    updateAbilityInfo(chars, allAbilities) {
        for (let id of ['p1a', 'p1b', 'p2a', 'p2b']) {
            if (chars[id]) {
                $(`#a-${id}-name`).text(chars[id].name);
                const abilityObj = allAbilities[chars[id].ability];
                if (abilityObj) {
                    $(`#a-${id}-ability-name`).text(abilityObj.name);
                    $(`#a-${id}-ability-desc`).text(abilityObj.description);
                } else {
                    $(`#a-${id}-ability-name`).text(chars[id].ability || "---");
                    $(`#a-${id}-ability-desc`).text("");
                }
            }
        }
    }
}
