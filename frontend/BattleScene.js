class BattleScene {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.allyGroup = null;
        this.foeGroup = null;
        this.isAnimating = false;
        this.allyCircle = null;
        this.foeCircle = null;
        this.textureLoader = new THREE.TextureLoader();
        this.allyWordEl = null;
        this.foeWordEl = null;
        this.tempVector = new THREE.Vector3();
        this.starPoints = null;
        this.speedLines = null;
        this.starsCount = 2000;
        this.lineCount = 400;
        this.lineSpeed = 1.2;

        this.baseCameraPos = new THREE.Vector3(-10.0, 4.5, 7.5); 
        this.cameraTarget = new THREE.Vector3(0.0, 2.0, -0.5);  
    }

    init(container) {
        this.container = container;
        const width = container.clientWidth;
        const height = container.clientHeight;

        // シーンの作成
        this.scene = new THREE.Scene();

        // 背景色とフォグの設定
        const backgroundColor = 0x0a0a22;
        this.scene.background = new THREE.Color(backgroundColor);
        this.scene.fog = new THREE.Fog(backgroundColor, 50, 300);

        // カメラの作成
        this.camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
        this.camera.position.copy(this.baseCameraPos); 
        this.camera.lookAt(this.cameraTarget);

        // レンダラーの作成
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(width, height); 
        this.renderer.shadowMap.enabled = true;
        
        // スタイル調整
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        
        // コンテナに追加
        container.appendChild(this.renderer.domElement);

        // --- ライティング ---
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
        dirLight.position.set(5, 15, 10);
        dirLight.castShadow = false; 
        this.scene.add(dirLight);

        this._createStars();
        this._createSpeedLines();

        // --- キャラクター (Group化して複数Spriteに対応) ---
        const createSprite = () => {
            const mat = new THREE.SpriteMaterial({ 
                color: 0xffffff, 
                transparent: true, 
                opacity: 0,
                alphaTest: 0.5
            });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(4, 4, 1);
            return sprite;
        };

        // 自分 (手前左)
        this.allyGroup = new THREE.Group();
        this.allyGroup.position.set(-5.07, 2.0, 0.88);
        this.allySprite1 = createSprite();
        this.allySprite2 = createSprite();
        this.allyGroup.add(this.allySprite1);
        this.allyGroup.add(this.allySprite2);
        this.scene.add(this.allyGroup);

        // 相手 (奥右)
        this.foeGroup = new THREE.Group();
        this.foeGroup.position.set(7.29, 2.0, -0.78);
        this.foeSprite1 = createSprite();
        this.foeSprite2 = createSprite();
        this.foeGroup.add(this.foeSprite1);
        this.foeGroup.add(this.foeSprite2);
        this.scene.add(this.foeGroup);

        // 初期状態はSprite2を非表示
        this.allySprite2.visible = false;
        this.foeSprite2.visible = false;

        // --- 足場 (円) ---
        const circleGeometry = new THREE.CircleGeometry(2.5, 32);
        const circleMaterial = new THREE.MeshStandardMaterial({
            color: 0x9090ff, 
            transparent: true,
            opacity: 0.25,
            emissive: 0x303070, 
            emissiveIntensity: 0.4,
            side: THREE.DoubleSide,
            depthWrite: true 
        });

        this.allyCircle = new THREE.Mesh(circleGeometry, circleMaterial);
        this.allyCircle.rotation.x = -Math.PI / 2;
        this.allyCircle.position.set(this.allyGroup.position.x, 0.02, this.allyGroup.position.z);
        this.scene.add(this.allyCircle);

        // 相手用足場
        this.foeCircle = new THREE.Mesh(circleGeometry, circleMaterial);
        this.foeCircle.rotation.x = -Math.PI / 2;
        this.foeCircle.position.set(this.foeGroup.position.x, 0.02, this.foeGroup.position.z);
        this.scene.add(this.foeCircle);

        // アニメーション開始
        this.isAnimating = true;
        this.animate();

        // リサイズ対応
        window.addEventListener('resize', () => this.onWindowResize());

        // デバッグ用エディタの作成
        this.createEditor();
    }

    setWordElements(allyEl, foeEl) {
        this.allyWordEl = allyEl;
        this.foeWordEl = foeEl;
    }

    onWindowResize() {
        if (!this.container || !this.camera || !this.renderer) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    animate() {
        if (!this.isAnimating) return;
        requestAnimationFrame(() => this.animate());

        const time = Date.now() * 0.002;

        // ★修正：動く速度（timeに掛ける値）を小さくしてゆっくりにし、振幅（最後に掛ける値）を大きくして広く動くように変更
        if (this.camera && this.baseCameraPos && this.cameraTarget) {
            this.camera.position.x = this.baseCameraPos.x + Math.sin(time * 0.15) * 1.5;
            this.camera.position.y = this.baseCameraPos.y + Math.cos(time * 0.11) * 0.8;
            this.camera.position.z = this.baseCameraPos.z + Math.sin(time * 0.13) * 1.5;
            
            this.camera.lookAt(this.cameraTarget);
        }

        // 待機モーション (ふわふわ上下) 
        if (this.allyGroup) {
            this.allyGroup.position.y = 2.0 + Math.sin(time) * 0.1;
        }
        if (this.foeGroup) {
            this.foeGroup.position.y = 2.0 + Math.sin(time + 2) * 0.1;
        }

        if (this.starPoints) {
            this.starPoints.rotation.y += 0.0002;
            this.starPoints.rotation.z += 0.0001;
        }

        if (this.speedLines) {
            const positions = this.speedLines.geometry.attributes.position.array;
            const lineCount = this.lineCount;

            for(let i = 0; i < lineCount; i++) {
                const speed = this.lineSpeed;
                positions[i * 6 + 2] += speed; 
                positions[i * 6 + 5] += speed;

                if (positions[i * 6 + 2] > 30) {
                    const resetZ = -300 - Math.random() * 100; 
                    const length = positions[i * 6 + 2] - positions[i * 6 + 5]; 
                    
                    const newX = (Math.random() - 0.5) * 200;
                    const newY = (Math.random() - 0.5) * 200;

                    positions[i * 6]     = newX;
                    positions[i * 6 + 1] = newY;
                    positions[i * 6 + 2] = resetZ;
                    positions[i * 6 + 3] = newX;
                    positions[i * 6 + 4] = newY;
                    positions[i * 6 + 5] = resetZ - length;
                }
            }
            this.speedLines.geometry.attributes.position.needsUpdate = true;
        }

        this.updateWordPositions();
        this.renderer.render(this.scene, this.camera);
    }

    _createStars() {
        let oldRotation = null;
        if (this.starPoints) {
            oldRotation = this.starPoints.rotation.clone();
            this.scene.remove(this.starPoints);
            this.starPoints.geometry.dispose();
            this.starPoints.material.dispose();
            this.starPoints = null;
        }

        const createStarTexture = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 32;
            canvas.height = 32;
            const context = canvas.getContext('2d');
            
            const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
            gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
            gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.2)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            context.fillStyle = gradient;
            context.fillRect(0, 0, 32, 32);
            return new THREE.CanvasTexture(canvas);
        };

        const starsGeometry = new THREE.BufferGeometry();
        const starsCount = this.starsCount;
        const posArray = new Float32Array(starsCount * 3);
        const colorArray = new Float32Array(starsCount * 3);
        const sizeArray = new Float32Array(starsCount);

        for (let i = 0; i < starsCount; i++) {
            const radius = 250 * Math.random() + 50;
            const theta = 2 * Math.PI * Math.random();
            const phi = Math.acos(2 * Math.random() - 1);
            
            posArray[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            posArray[i * 3 + 1] = radius * Math.cos(phi);
            posArray[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

            const starType = Math.random();
            let r = 1, g = 1, b = 1;
            if (starType > 0.8) { b = 0.8; g = 0.9; } 
            else if (starType > 0.6) { r = 0.8; g = 0.9; } 
            
            const brightness = Math.random() * 0.5 + 0.5;
            colorArray[i * 3] = r * brightness;
            colorArray[i * 3 + 1] = g * brightness;
            colorArray[i * 3 + 2] = b * brightness;

            sizeArray[i] = Math.random() * 2 + 0.5;
        }

        starsGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        starsGeometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
        starsGeometry.setAttribute('size', new THREE.BufferAttribute(sizeArray, 1));

        const starsMaterial = new THREE.ShaderMaterial({
            uniforms: { pointTexture: { value: createStarTexture() } },
            vertexShader: `
                attribute float size;
                varying vec3 vColor;
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D pointTexture;
                varying vec3 vColor;
                void main() {
                    gl_FragColor = vec4(vColor, 1.0) * texture2D(pointTexture, gl_PointCoord);
                }
            `,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            vertexColors: true
        });

        this.starPoints = new THREE.Points(starsGeometry, starsMaterial);
        if (oldRotation) {
            this.starPoints.rotation.copy(oldRotation);
        } else {
            this.starPoints.rotation.set(0, 0.2818000000000016, 0.1409000000000008);
        }
        this.scene.add(this.starPoints);
    }

    _createSpeedLines() {
        let oldRotation = null;
        if (this.speedLines) {
            oldRotation = this.speedLines.rotation.clone();
            this.scene.remove(this.speedLines);
            this.speedLines.geometry.dispose();
            this.speedLines.material.dispose();
            this.speedLines = null;
        }

        const lineCount = this.lineCount;
        const linesGeometry = new THREE.BufferGeometry();
        const linePositions = new Float32Array(lineCount * 6);

        for(let i = 0; i < lineCount; i++) {
            const x = (Math.random() - 0.5) * 200;
            const y = (Math.random() - 0.5) * 200;
            const z = - (Math.random() * 500 + 300); 
            const length = Math.random() * 15 + 10;

            linePositions[i * 6]     = x;
            linePositions[i * 6 + 1] = y;
            linePositions[i * 6 + 2] = z;
            linePositions[i * 6 + 3] = x;
            linePositions[i * 6 + 4] = y;
            linePositions[i * 6 + 5] = z - length;
        }

        linesGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

        const linesMaterial = new THREE.LineBasicMaterial({
            color: 0x88ccff, 
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false, 
            depthTest: true    
        });

        this.speedLines = new THREE.LineSegments(linesGeometry, linesMaterial);
        this.speedLines.renderOrder = 1; 

        if (oldRotation) {
            this.speedLines.rotation.copy(oldRotation);
        } else {
            this.speedLines.rotation.set(0.2, -1.2, -0.7853981633974483);
        }
        this.scene.add(this.speedLines);
    }

    updateWordPositions() {
        if (!this.camera || !this.renderer || !this.container) return;

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        if (this.allyGroup && this.allyWordEl) {
            this.updateElementPosition(this.allyGroup, this.allyWordEl, width, height, true);
        }
        if (this.foeGroup && this.foeWordEl) {
            this.updateElementPosition(this.foeGroup, this.foeWordEl, width, height, false);
        }
    }

    updateElementPosition(group, element, width, height, isAlly) {
        // メッシュの位置をコピー
        this.tempVector.copy(group.position);
        
        if (isAlly) {
            this.tempVector.y -= 2.5; 
            this.tempVector.x += 1.5; 
        } else {
            this.tempVector.y += 3.5; 
            this.tempVector.x -= 1.5; 
        }

        // 3D座標をスクリーン座標に変換
        this.tempVector.project(this.camera);

        // -1〜1 の範囲を 0〜width/height (ピクセル) に変換
        const x = (this.tempVector.x * .5 + .5) * width;
        const y = (-(this.tempVector.y * .5) + .5) * height;

        // DOM要素の位置を更新
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
        element.style.right = 'auto'; 
    }

    updateTexture(isAlly, types) {
        const group = isAlly ? this.allyGroup : this.foeGroup;
        const sprite1 = isAlly ? this.allySprite1 : this.foeSprite1;
        const sprite2 = isAlly ? this.allySprite2 : this.foeSprite2;
        
        if (!group) return;

        let typeList = [];
        if (Array.isArray(types)) {
            typeList = types.filter(t => t && t !== "");
        } else if (types && types !== "") {
            typeList = [types];
        }

        if (typeList.length === 0) {
            sprite1.material.opacity = 0;
            sprite2.visible = false;
            return;
        }

        const loadTextureForSprite = (sprite, typeName) => {
            let imageName = 'normal';
            if (typeof type_to_image !== 'undefined' && type_to_image[typeName]) {
                imageName = type_to_image[typeName];
            }
            const path = `img/${imageName}.gif`;
            
            this.textureLoader.load(
                path,
                (texture) => {
                    sprite.material.map = texture;
                    sprite.material.opacity = 1;
                    sprite.material.needsUpdate = true;
                    sprite.visible = true;
                },
                undefined,
                (err) => console.error("Failed to load texture:", path, err)
            );
        };

        if (typeList.length === 1) {
            sprite1.position.set(0, 0, 0);
            loadTextureForSprite(sprite1, typeList[0]);
            sprite2.visible = false;
        } else {
            const offset = 1.5;
            sprite1.position.set(-offset, 0, 0.5);
            loadTextureForSprite(sprite1, typeList[0]);
            
            sprite2.position.set(offset, 0, -0.5);
            loadTextureForSprite(sprite2, typeList[1]);
            
            sprite2.visible = true;
        }
    }

    // ★修正部分：位置の移動を完全に止め、代わりに「その場で一瞬だけ少し大きくなる」アニメーションに変更
    playAttackAnimation(isAlly) {
        const sprite1 = isAlly ? this.allySprite1 : this.foeSprite1;
        const sprite2 = isAlly ? this.allySprite2 : this.foeSprite2;
        
        const sprites = [sprite1];
        if (sprite2 && sprite2.visible) sprites.push(sprite2);

        const startTime = Date.now();
        const duration = 250; // 少しだけスピーディな強調表現
        
        // 現在のスケールを保存
        const originalScales = sprites.map(s => s.scale.clone());

        const animateAttack = () => {
            const now = Date.now();
            const progress = Math.min((now - startTime) / duration, 1);
            
            let p = progress;
            if (p < 0.5) {
                p = p * 2;
            } else {
                p = (1 - p) * 2;
            }

            // 移動させず、スケールだけを15%ほど大きくして強調する
            sprites.forEach((sprite, index) => {
                const orig = originalScales[index];
                sprite.scale.set(orig.x * (1 + p * 0.15), orig.y * (1 + p * 0.15), 1);
            });

            if (progress < 1) {
                requestAnimationFrame(animateAttack);
            } else {
                // アニメーション完了後に元のスケールへ確実にリセット
                sprites.forEach((sprite, index) => {
                    sprite.scale.copy(originalScales[index]);
                });
            }
        };
        animateAttack();
    }

    playDamageAnimation(isAlly) {
        const sprite1 = isAlly ? this.allySprite1 : this.foeSprite1;
        const sprite2 = isAlly ? this.allySprite2 : this.foeSprite2;
        
        const sprites = [sprite1];
        if (sprite2 && sprite2.visible) sprites.push(sprite2);

        const originalColor = new THREE.Color(0xffffff);
        const startTime = Date.now();
        const duration = 500;

        const animateDamage = () => {
            const now = Date.now();
            const progress = Math.min((now - startTime) / duration, 1);

            sprites.forEach(sprite => {
                if (!sprite.material || !sprite.material.color) return;
                if (Math.floor(progress * 10) % 2 === 0) {
                    sprite.material.color.setHex(0xff8888);
                } else {
                    sprite.material.color.copy(originalColor);
                }
            });

            if (progress < 1) {
                requestAnimationFrame(animateDamage);
            } else {
                sprites.forEach(s => {
                    if (s.material && s.material.color) s.material.color.copy(originalColor);
                });
            }
        };
        animateDamage();
    }

    createEditor() {
        if (typeof lil === 'undefined') return;
        const gui = new lil.GUI({ title: '3D Editor' });

        const camFolder = gui.addFolder('Camera');
        camFolder.add(this.baseCameraPos, 'x', -20, 20).name('Base Pos X').step(0.1);
        camFolder.add(this.baseCameraPos, 'y', -20, 20).name('Base Pos Y').step(0.1);
        camFolder.add(this.baseCameraPos, 'z', -20, 20).name('Base Pos Z').step(0.1);
        
        camFolder.add(this.cameraTarget, 'x', -10, 10).name('Target X').step(0.1);
        camFolder.add(this.cameraTarget, 'y', -10, 10).name('Target Y').step(0.1);
        camFolder.add(this.cameraTarget, 'z', -10, 10).name('Target Z').step(0.1);

        const allyFolder = gui.addFolder('Ally (Left)');
        if (this.allyGroup) {
            allyFolder.add(this.allyGroup.position, 'x', -10, 10).name('Pos X').step(0.1).onChange(v => { if (this.allyCircle) this.allyCircle.position.x = v; });
            allyFolder.add(this.allyGroup.position, 'y', 0, 10).name('Pos Y').step(0.1);
            allyFolder.add(this.allyGroup.position, 'z', -10, 10).name('Pos Z').step(0.1).onChange(v => { if (this.allyCircle) this.allyCircle.position.z = v; });
            allyFolder.add(this.allySprite1.scale, 'x', 0.1, 10).name('Scale').onChange(v => {
                this.allySprite1.scale.set(v, v, 1);
                this.allySprite2.scale.set(v, v, 1);
            }).step(0.1);
        }

        const foeFolder = gui.addFolder('Foe (Right)');
        if (this.foeGroup) {
            foeFolder.add(this.foeGroup.position, 'x', -10, 10).name('Pos X').step(0.1).onChange(v => { if (this.foeCircle) this.foeCircle.position.x = v; });
            foeFolder.add(this.foeGroup.position, 'y', 0, 10).name('Pos Y').step(0.1);
            foeFolder.add(this.foeGroup.position, 'z', -10, 10).name('Pos Z').step(0.1).onChange(v => { if (this.foeCircle) this.foeCircle.position.z = v; });
            foeFolder.add(this.foeSprite1.scale, 'x', 0.1, 10).name('Scale').onChange(v => {
                this.foeSprite1.scale.set(v, v, 1);
                this.foeSprite2.scale.set(v, v, 1);
            }).step(0.1);
        }

        const backgroundFolder = gui.addFolder('Background');
        const skyParams = { color: this.scene.background.getHex() };
        backgroundFolder.addColor(skyParams, 'color').name('Color').onChange(v => this.scene.background.set(v));

        if (this.starPoints) {
            const starsFolder = backgroundFolder.addFolder('Stars');
            starsFolder.add(this.starPoints.rotation, 'x', -Math.PI, Math.PI).name('Rotation X').step(0.01);
            starsFolder.add(this.starPoints.rotation, 'y', -Math.PI, Math.PI).name('Rotation Y').step(0.01);
            starsFolder.add(this.starPoints.rotation, 'z', -Math.PI, Math.PI).name('Rotation Z').step(0.01);
        }

        if (this.speedLines) {
            const linesFolder = backgroundFolder.addFolder('Speed Lines');
            linesFolder.add(this.speedLines.rotation, 'x', -Math.PI, Math.PI).name('Rotation X').step(0.01);
            linesFolder.add(this.speedLines.rotation, 'y', -Math.PI, Math.PI).name('Rotation Y').step(0.01);
            linesFolder.add(this.speedLines.rotation, 'z', -Math.PI, Math.PI).name('Rotation Z').step(0.01);
        }

        const exportParams = {
            logValues: () => {
                const values = { 
                    camera: { basePosition: this.baseCameraPos.toArray(), target: this.cameraTarget.toArray() }, 
                    ally: { position: this.allyGroup.position.toArray(), scale: this.allySprite1.scale.x }, 
                    foe: { position: this.foeGroup.position.toArray(), scale: this.foeSprite1.scale.x }, 
                    background: { 
                        color: '#' + this.scene.background.getHexString(),
                        stars_rotation: this.starPoints ? this.starPoints.rotation.toArray().slice(0, 3) : [0,0,0],
                        lines_rotation: this.speedLines ? this.speedLines.rotation.toArray().slice(0, 3) : [0,0,0]
                    } 
                };
                console.log("--- Adjusted 3D Parameters ---");
                console.log(JSON.stringify(values, null, 2));
                alert('調整後の値をコンソールに出力しました。\n(F12キーで開発者ツールを開いて確認してください)');
            }
        };
        gui.add(exportParams, 'logValues').name('設定値をコンソールに出力');
    }
}