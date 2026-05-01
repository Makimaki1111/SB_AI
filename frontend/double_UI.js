// double_UI.js - ダブルバトル用UI管理クラス

class DoubleUI {
    constructor() {
        this.lobbyScreen = new UIObject($('#double-lobby-screen'));
        this.battleScreen = new UIObject($('#double-battle-screen'));

        this.input = new UIObject($('#input'));
        this.submitButton = new UIObject($('#submit'));
        this.includeImg = new UIObject($('#include-img'));
        this.includeImg1 = new UIObject($('#include-img-1'));
        this.includeImg2 = new UIObject($('#include-img-2'));
        this.predictionMessage = new UIObject($('#prediction-message'));

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
        this.modalMessage = new UIObject($('#double-modal-message'));

        this.lastPredictions = {}; // ターゲットごとの予測メッセージを保持

        // Events binding
        this.submitButton.selector.off('click').on('click', () => {
            const word = this.input.selector.val();
            sendDoubleSubmitWord(word); // Defined in double_script.js
        });

        this.input.selector.off('keydown keypress').on('keypress', (e) => {
            if (e.which === 13) {
                this.submitButton.selector.click();
            }
        });

        // モーダルのイベントリスナー解除用関数
        this.abilityModalCleanup = null;
        this.activeCharTab = 'p1a'; // 初期タブ
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

    setName(id, nameText, isPoison = false) {
        this.chars[id].nameEl.selector.text(nameText);
        if (isPoison) {
            this.chars[id].nameEl.selector.append('<span class="poison">どく</span>');
        }
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
        this.lastPredictions = {};

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

        if (data.predictions) {
            this.lastPredictions = data.predictions;
        }
    }

    updatePredictionMessage(targetId) {
        // targetId: p2a, p2b などのUI上のID (サーバーIDと一致している前提)
        const msg = this.lastPredictions[targetId];
        if (msg) {
            this.predictionMessage.selector.text(msg).show();
        } else {
            this.predictionMessage.selector.hide();
        }
    }

    hideCheckResult() {
        this.includeImg.selector.hide().attr('src', '');
        this.includeImg1.selector.hide().attr('src', '');
        this.includeImg2.selector.hide().attr('src', '');
        this.predictionMessage.selector.hide().text('');
        this.lastPredictions = {};
    }
    
    updatePoisonStatus(charId, isPoison) {
        // charIdはサーバー上のID (p1a, p1b, p2a, p2b)
        const uiId = getUIId(charId);
        if (this.chars[uiId]) {
            const nameEl = this.chars[uiId].nameEl.selector;
            nameEl.find('.poison').remove();
            if (isPoison) {
                nameEl.append('<span class="poison">どく</span>');
            }
        }
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

    _adjustWordScale(element) {
        const maxWidth = 125; // ダブルバトル用に短めに設定
        const domElement = element.get ? element.get(0) : element;

        if (!domElement) return;

        // 一旦スケールをリセットして本来の幅を取得
        domElement.style.transform = 'translateX(-50%) scaleX(1)';

        if (domElement.scrollWidth > maxWidth) {
            const scale = maxWidth / domElement.scrollWidth;
            domElement.style.transform = `translateX(-50%) scaleX(${scale})`;
        } else {
            domElement.style.transform = `translateX(-50%) scaleX(1)`;
        }
    }

    setWord(id, wordText) {
        const dom = this.chars[id].word.selector;
        if (wordText) {
            dom.text(wordText);
            // dispaly:noneだと幅が0になるため、いったん見えない状態(opacity:0)でshowしてから幅を量る
            dom.stop(true, false).css('opacity', 0).show();
            this._adjustWordScale(dom);
            dom.animate({ opacity: 1 }, 300);
        } else {
            dom.hide();
        }
    }

    setCharImage(id, types) {
        if (!this.chars[id] || typeof type_to_image === "undefined") return;

        if (!types || types.length === 0) {
            this.chars[id].img1.selector.hide().attr('src', '').css('opacity', '');
            this.chars[id].img2.selector.hide().attr('src', '').css('opacity', '');
            return;
        }

        const fadeInImage = (selector, src) => {
            selector.stop(true, false);
            selector.hide().attr('src', '').css('opacity', '');
            const img = new Image();
            img.onload = () => {
                selector.css({ opacity: 0, display: 'block' });
                selector.attr('src', src);
                selector.animate({ opacity: 1 }, 300, () => {
                    selector.css('opacity', '');
                });
            };
            img.src = src;
        };

        if (types.length === 2) {
            const newImg1 = type_to_image[types[0]];
            const newImg2 = type_to_image[types[1]];
            if (newImg1) {
                fadeInImage(this.chars[id].img1.selector, "img/" + newImg1 + ".gif");
                this.chars[id].img2.selector.hide();
                if (newImg2) {
                    setTimeout(() => {
                        if (this.chars[id]) fadeInImage(this.chars[id].img2.selector, "img/" + newImg2 + ".gif");
                    }, 80);
                }
            }
        } else {
            const newImg = type_to_image[types[0]];
            if (newImg) {
                fadeInImage(this.chars[id].img1.selector, "img/" + newImg + ".gif");
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
        else if (type === "stat_up") {
            for (let i = 0; i < 10; i++) {
                setTimeout(() => {
                    const particle = $('<div class="stat-up-particle"></div>');
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
                }, i * 100);
            }
        }
        else if (type === "stat_down") {
            for (let i = 0; i < 10; i++) {
                setTimeout(() => {
                    const particle = $('<div class="stat-down-particle"></div>');
                    const left = Math.random() * 80;
                    const size = Math.random() * 0.8 + 0.5;
                    particle.css({
                        left: `${left}px`,
                        top: '0px',
                        transform: `scale(${size})`,
                        animation: `floatDown 1.5s ease-out forwards`
                    });
                    container.append(particle);
                    setTimeout(() => { particle.remove(); }, 1500);
                }, i * 100);
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
    showTimerContainer() {
        this.timerContainer.show();
    }

    hideTimerContainer() {
        this.timerContainer.hide();
    }

    showInput() {
        this.input.selector.show();
    }

    hideInput() {
        this.input.selector.hide();
    }

    showSubmitBtn() {
        this.submitButton.selector.show();
    }

    hideSubmitBtn() {
        this.submitButton.selector.hide();
    }

    showBackToTitleBtn() {
        this.backToTitleBtn.selector.css('display', 'block');
        setTimeout(() => {
            this.backToTitleBtn.selector.addClass('bt-visible');
        }, 20);
    }

    hideBackToTitleBtn() {
        this.backToTitleBtn.selector.removeClass('bt-visible');
        setTimeout(() => {
            this.backToTitleBtn.selector.hide();
        }, 360);
    }

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

    showSituationModal() { 
        this.situationModal.selector.css('display', 'flex').hide().fadeIn('fast'); 
    }
    hideSituationModal() { this.situationModal.selector.fadeOut('fast'); }
    showAbilityModal() { 
        this.abilityModal.selector.css({
            display: 'flex',
            opacity: 0
        }).animate({ opacity: 1 }, 'fast');
    }
    hideAbilityModal() { 
        if (this.abilityModalCleanup) {
            this.abilityModalCleanup();
            this.abilityModalCleanup = null;
        }
        this.abilityModal.selector.fadeOut('fast'); 
    }

    updateSituationInfo(state) {
        const chars = state.chars;
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

    showModalMessage(message, time = 2000) {
        this.modalMessage.selector.text(message);
        this.modalMessage.selector.show();
        if (isFinite(time) && time > 0) {
            setTimeout(() => {
                this.modalMessage.selector.fadeOut('fast');
            }, time);
        }
    }

    updateAbilityInfo(chars, allAbilities) {
        // 自分チーム (p1a, p1b) の画面表示のみ更新（モーダルはpopulateAbilityModalで制御）
        for (let id of ['p1a', 'p1b']) {
            if (!chars[id]) continue;
            $(`#a-${id}-name`).text(chars[id].name);

            const currentAbility = chars[id].ability;
            const abilityObj = allAbilities[currentAbility];
            
            // メイン画面の小さな情報ボックス更新
            if (abilityObj) {
                $(`#a-${id}-ability-name`).text(abilityObj.name);
                $(`#a-${id}-ability-desc`).text(abilityObj.description);
            } else {
                $(`#a-${id}-ability-name`).text(currentAbility || "---");
                $(`#a-${id}-ability-desc`).text("");
            }

            const changeCount = chars[id].ability_change_count || 0;
            $(`#a-${id}-remain`).text(`(あと${changeCount}回)`);
        }
    }

    populateAbilityModal(chars, allAbilities, onDecideCallback, onCloseCallback) {
        if (this.abilityModalCleanup) {
            this.abilityModalCleanup();
            this.abilityModalCleanup = null;
        }

        const modal = this.abilityModal.selector;
        modal.empty();

        // タブの選択状態チェック
        if (!chars[this.activeCharTab]) {
            this.activeCharTab = chars['p1a'] ? 'p1a' : 'p1b';
        }
        const activeId = this.activeCharTab;
        const charData = chars[activeId];

        const isP1aActive = activeId === 'p1a';
        // グラデーションはtransition非対応なため、滑らかな色変化用として単色（少し不透明な白ベースに色を混ぜたもの）を使用
        const bgColor = isP1aActive 
            ? 'rgba(255, 220, 220, 0.95)' // 薄い赤
            : 'rgba(220, 235, 255, 0.95)'; // 薄い青
            
        // 構造作成
        const wrapper = $(`<div class="ability-modal-wrapper" style="background: ${bgColor};"></div>`);

        // --- タブ表示 (ダブルバトル特有) ---
        const tabsContainer = $('<div class="modal-tabs"></div>');
        ['p1a', 'p1b'].forEach(id => {
            if(!chars[id]) return;
            const isActive = id === activeId;
            const name = chars[id].name;
            const tabBtn = $(`<button class="modal-btn tab-btn ${isActive ? 'active' : ''}">${name}</button>`);
            
            tabBtn.on('click', () => {
                this.activeCharTab = id;
                // タブ切り替え時は再描画
                this.populateAbilityModal(chars, allAbilities, onDecideCallback, onCloseCallback);
            });
            tabsContainer.append(tabBtn);
        });
        tabsContainer.css({ 'margin-bottom': '2px', 'gap': '10px' });
        wrapper.append(tabsContainer);

        if (!charData) {
            wrapper.append('<div>データがありません</div>');
            modal.append(wrapper);
            return;
        }

        const currentAbilityId = charData.ability;
        const canChange = (charData.ability_change_count || 0) > 0;

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
            <div class="current-ability-section preview">
                <span class="section-label preview">変更後のとくせい</span>
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
            const selectedAbilityId = abilities[currentIndex].id;
            if (selectedAbilityId === currentAbilityId) {
                onCloseCallback();
            } else {
                // コールバックには キャラID も渡す
                onDecideCallback(activeId, selectedAbilityId);
                onCloseCallback();
            }
        });

        closeBtn.on('click', () => {
            onCloseCallback();
        });

        actions.append(closeBtn, decideBtn);
        wrapper.append(actions);
        modal.append(wrapper);

        // --- カルーセル制御ロジック (UI.jsと同等) ---
        let currentFloatIndex = initialIndex;
        let currentIndex = initialIndex;
        const N = abilities.length;
        let animationFrameId = null;
        
        const updateCarousel = (floatIdx) => {
            const roundedIndex = Math.round(floatIdx);
            currentIndex = ((roundedIndex % N) + N) % N;
            
            const ab = abilities[currentIndex];
            $('#new-ability-name').text(ab.name);
            $('#new-ability-desc').text(ab.description);

            if (canChange) {
                if (ab.id === currentAbilityId) {
                    decideBtn.text('そのまま').css('background', '#aaa');
                } else {
                    decideBtn.text('決定').css('background', '');
                }
            }

            const spacing = 85; 
            items.forEach((item, i) => {
                let diff = i - floatIdx;
                diff = diff - Math.round(diff / N) * N;
                const absDiff = Math.abs(diff);
                const x = diff * spacing; 
                const y = absDiff * absDiff * 2; 
                const scale = Math.max(0.6, 1 - absDiff * 0.15);
                const z = 100 - Math.round(absDiff);
                let opacity = Math.max(0, 1 - absDiff * 0.2); 
                if (absDiff > 4.5) opacity = 0;
                
                item.css({
                    transform: `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`,
                    zIndex: z,
                    opacity: opacity,
                    pointerEvents: opacity > 0.1 ? 'auto' : 'none'
                });
                if (absDiff < 0.5) item.addClass('selected');
                else item.removeClass('selected');
            });
        };

        const animateTo = (target) => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            const animate = () => {
                const diff = target - currentFloatIndex;
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

        setTimeout(() => updateCarousel(initialIndex), 0);

        items.forEach((item, i) => {
            item.off('click').on('click', () => {
                if (isDragMove) return; // ドラッグ移動していたらクリック処理しない
                
                // 最短距離で移動するためのターゲット計算
                let diff = i - currentFloatIndex;
                diff = diff - Math.round(diff / N) * N;
                animateTo(currentFloatIndex + diff);
            });
        });

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
            e.preventDefault();
            const pageX = e.pageX || (e.originalEvent.touches ? e.originalEvent.touches[0].pageX : 0);
            const deltaX = pageX - lastX;
            lastX = pageX;

            // 微小な動きはクリックとみなすために無視するが、一定以上動いたらドラッグとする
            if (Math.abs(pageX - startX) > 5) {
                isDragMove = true;
            }

            // 移動量に応じてインデックスを動かす（感度調整: 動きをダイレクトにするため値を小さく）
            currentFloatIndex -= deltaX / 70; 
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
}
