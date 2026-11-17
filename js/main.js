// 游戏主入口

class Game {
    constructor() {
        this.items = ITEMS;
        this.recipes = RECIPES;
        this.running = false;
        this.username = null;
        this.autoSaveTimer = 0;
        this.multiplayer = null;
        this.gameMode = 'private'; // 'private' or 'multiplayer'
        this.renderOptEnabled = true;
        this.achievements = {}; // { achievementId: true }
        this.achievementProgress = {}; // { achievementId: number }
        window.game = this;
        this._init();
    }

    async _init() {
        this.ui = new UI(this);
        this.ui.showLoading(10, '初始化引擎...');

        // Three.js 场景
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false, stencil: false, depth: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.VSMShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.renderer.physicallyCorrectLights = true;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        document.body.appendChild(this.renderer.domElement);

        this.ui.showLoading(30, '生成世界...');

        // 系统初始化
        this.inventory = new Inventory();
        this.survival = new SurvivalSystem();
        this.world = new World(this.scene);

        this.ui.showLoading(50, '放置资源...');

        this.player = new Player(this.camera, this.world, this.survival, this.inventory);
        this.enemies = new EnemySystem(this.scene, this.world, this.player);

        this.ui.showLoading(70, '连接系统...');

        // 重新初始化UI（现在依赖的系统已就绪）
        this.ui.inventory = this.inventory;
        this.ui.survival = this.survival;
        this.ui.world = this.world;
        this.ui.player = this.player;

        // 手机触控
        this.mobile = new MobileControls(this.player, this.ui);

        // 监听变化
        this.survival.onChange(() => this.ui.updateHUD());
        this.inventory.onChange(() => {
            this.survival.setArmor(this.inventory.getArmorValue());
            this.ui.updateHUD();
        });

        this.ui.showLoading(90, '准备就绪...');

        // 窗口大小调整
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });

        // 渲染优化开关
        const renderOptCb = document.getElementById('renderOptCheckbox');
        if (renderOptCb) {
            renderOptCb.addEventListener('change', () => {
                this.renderOptEnabled = renderOptCb.checked;
                if (!this.renderOptEnabled) {
                    // 关闭时恢复所有物体可见
                    for (const key in this.world.chunks) {
                        const chunk = this.world.chunks[key];
                        if (chunk.mesh) chunk.mesh.visible = true;
                    }
                    for (const res of this.world.resources) {
                        if (res.mesh) res.mesh.visible = true;
                    }
                    for (const b of this.world.buildings) {
                        if (b.mesh) b.mesh.visible = true;
                    }
                    if (this.enemies && this.enemies.enemies) {
                        for (const enemy of this.enemies.enemies) {
                            if (enemy.mesh) enemy.mesh.visible = true;
                        }
                    }
                }
            });
        }

        this.ui.showLoading(100, '完成!');
        setTimeout(() => {
            this.ui.hideLoading();
            this.ui.showLogin();
        }, 500);

        // 开始渲染循环（即使未开始游戏也渲染场景）
        this._animate();

        // 标签隐藏时用setInterval保持游戏运行（requestAnimationFrame在后台会被节流）
        this._bgInterval = null;
        this._bgLastTime = 0;
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // 标签隐藏：启动setInterval后备循环
                if (this._bgInterval) clearInterval(this._bgInterval);
                this._bgLastTime = performance.now();
                this._bgInterval = setInterval(() => {
                    if (!this.running) return;
                    const now = performance.now();
                    const dt = Math.min((now - this._bgLastTime) / 1000, 0.1);
                    this._bgLastTime = now;
                    this._gameUpdate(dt);
                }, 100); // 10fps in background
            } else {
                // 标签恢复：停止后备循环
                if (this._bgInterval) {
                    clearInterval(this._bgInterval);
                    this._bgInterval = null;
                }
                // 重置clock避免大跳帧
                if (this.clock) this.clock.getDelta();
            }
        });
    }

    login(username, password) {
        if (!password) {
            this.ui.showMessage('请输入密码');
            return;
        }
        this._completeLogin(username, password);
    }

    _completeLogin(username, password) {
        if (SaveSystem.userExists(username)) {
            if (!SaveSystem.checkPassword(username, password)) {
                this.ui.showMessage('密码错误');
                return;
            }
        } else {
            SaveSystem.createUser(username, password);
        }
        this.username = username;
        this.isAdmin = (username === 'xy');
        this.ui.hideLogin();
        this.ui.showMainMenu(username);
    }

    startPrivateGame(slot) {
        this.gameMode = 'private';
        this.currentSlot = slot || 1;
        if (SaveSystem.hasSlotSave(this.username, this.currentSlot)) {
            SaveSystem.applySlotSave(this.username, this.currentSlot, this);
            this.ui.showMessage('存档' + this.currentSlot + '已加载');
        } else {
            this.inventory.addItem('berry', 5);
            this.ui.showMessage('新存档' + this.currentSlot + '已创建');
        }
        this.ui.hideMainMenu();
        this.ui.showStart();
    }

    startMultiplayerGame(roomId) {
        this.gameMode = 'multiplayer';
        // 多人模式加载多人存档
        if (SaveSystem.hasMpSave(this.username)) {
            SaveSystem.applyMpSave(this.username, this);
            this.ui.showMessage('多人存档已加载');
        } else {
            this.inventory.addItem('berry', 5);
        }
        this.multiplayer = new MultiplayerSystem(this);
        this.multiplayer.connect(roomId);
        this.ui.hideRoomList();
        this.ui.showStart();
    }

    start() {
        this.running = true;
        this.ui.hideStart();
        this.ui.showHUD();
        this.player.lockMouse();
        this.ui.updateHUD();
        this.ui.showChat();
    }

    onMessage(text) {
        // 提示已禁用
    }

    // ========== 成就系统 ==========
    unlockAchievement(achievementId) {
        console.log('[成就] unlockAchievement called:', achievementId, 'already:', this.achievements[achievementId]);
        if (this.achievements[achievementId]) return;
        const def = ACHIEVEMENTS[achievementId];
        console.log('[成就] def:', def);
        if (!def) return;
        this.achievements[achievementId] = true;
        // 右上角通知（仅自己可见）
        this._showAchievementNotify(def);
        // 聊天栏公共公告
        const playerName = this.username || '玩家';
        const chatText = `🏆 ${playerName} 达成了成就「${def.name}」！`;
        if (this.ui) this.ui.addChatMessage('系统', chatText);
        // 多人广播
        if (this.multiplayer && this.multiplayer.connected) {
            this.multiplayer.sendChat(chatText);
        }
    }

    updateAchievementProgress(achievementId, increment = 1) {
        if (this.achievements[achievementId]) return;
        const def = ACHIEVEMENTS[achievementId];
        if (!def) return;
        this.achievementProgress[achievementId] = (this.achievementProgress[achievementId] || 0) + increment;
        if (this.achievementProgress[achievementId] >= def.target) {
            this.unlockAchievement(achievementId);
        }
    }

    _showAchievementNotify(def) {
        const container = document.getElementById('achievementNotify');
        if (!container) return;
        container.style.display = 'block';
        const notif = document.createElement('div');
        notif.style.cssText = 'background:linear-gradient(135deg,#2a4a2a,#1a3a1a);border:2px solid #ffd700;border-radius:10px;padding:12px 20px;margin-bottom:8px;box-shadow:0 4px 15px rgba(255,215,0,0.3);animation:achSlideIn 0.5s ease;';
        notif.innerHTML = `
            <div style="font-size:12px;color:#ffd700;margin-bottom:4px;">🏆 成就解锁</div>
            <div style="font-size:16px;color:#fff;font-weight:bold;">${def.name}</div>
            <div style="font-size:12px;color:#aaa;margin-top:2px;">${def.desc}</div>
        `;
        container.appendChild(notif);
        setTimeout(() => {
            notif.style.transition = 'opacity 0.5s,transform 0.5s';
            notif.style.opacity = '0';
            notif.style.transform = 'translateX(50px)';
            setTimeout(() => {
                notif.remove();
                if (container.children.length === 0) container.style.display = 'none';
            }, 500);
        }, 5000);
    }

    logout() {
        if (this.multiplayer) {
            if (this.username) SaveSystem.saveMultiplayer(this.username, this);
            this.multiplayer.disconnect();
            this.multiplayer = null;
        }
        if (this.username && this.gameMode === 'private') {
            SaveSystem.saveSlot(this.username, this.currentSlot || 1, this);
        }
        this.running = false;
        this.player.unlockMouse();
        this.ui.hideHUD();
        this.ui.hideMpPlayerList();
        this.ui.hideChat();
        this.ui.showLogin();
        this.username = null;
        this.gameMode = 'private';
    }

    backToMainMenu() {
        if (this.multiplayer) {
            if (this.username) SaveSystem.saveMultiplayer(this.username, this);
            this.multiplayer.disconnect();
            this.multiplayer = null;
        }
        if (this.username && this.gameMode === 'private') {
            SaveSystem.saveSlot(this.username, this.currentSlot || 1, this);
        }
        this.running = false;
        this.player.unlockMouse();
        this.ui.hideHUD();
        this.ui.hideMpPlayerList();
        this.ui.hideChat();
        this.ui.showMainMenu(this.username);
    }

    _animate() {
        requestAnimationFrame(() => this._animate());
        const dt = Math.min(this.clock?.getDelta() || 0.016, 0.1);
        if (!this.clock) this.clock = new THREE.Clock();

        if (this.running) {
            this._gameUpdate(dt);
        }

        // 渲染优化：视锥体剔除，看不见的物体不渲染
        if (this.renderOptEnabled) {
            this._frustumCull();
        }

        this.renderer.render(this.scene, this.camera);
    }

    _frustumCull() {
        if (!this._frustum) this._frustum = new THREE.Frustum();
        if (!this._projScreenMatrix) this._projScreenMatrix = new THREE.Matrix4();
        this._projScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
        this._frustum.setFromProjectionMatrix(this._projScreenMatrix);

        const safeIntersect = (mesh) => {
            if (!mesh || !mesh.geometry) return true;
            try { return this._frustum.intersectsObject(mesh); } catch (e) { return true; }
        };

        // 剔除区块地形
        for (const key in this.world.chunks) {
            const chunk = this.world.chunks[key];
            if (chunk.mesh) {
                chunk.mesh.visible = safeIntersect(chunk.mesh);
            }
        }

        // 剔除资源（树、石头、浆果等）
        for (const res of this.world.resources) {
            if (res.mesh) {
                res.mesh.visible = safeIntersect(res.mesh);
            }
        }

        // 剔除建筑
        for (const b of this.world.buildings) {
            if (b.mesh) {
                b.mesh.visible = safeIntersect(b.mesh);
            }
        }

        // 剔除敌人
        if (this.enemies && this.enemies.enemies) {
            for (const enemy of this.enemies.enemies) {
                if (enemy.mesh) {
                    enemy.mesh.visible = safeIntersect(enemy.mesh);
                }
            }
        }
    }

    _gameUpdate(dt) {
        // 更新世界
        const dayEvent = this.world.updateDayNight(dt);
        this.world.updateSun();
        this.world.updateChunks(this.player.position);
        this.world.updateResources(dt);
        this.world.updateMiners(dt);

        // 更新玩家
        this.mobile.update();
        this.player.update(dt);

        // 更新生存系统
        const nearCampfire = this.world.isNearCampfire(this.player.position);
        this.survival.update(dt, this.world.isNight, nearCampfire);

        // 更新敌人
        this.enemies.update(dt);

        // 更新多人游戏
        if (this.multiplayer) {
            this.multiplayer.update(dt);
            this.ui.updateMpPlayerList();
        }

        // 白天让敌人燃烧，直到生命值耗尽
        if (dayEvent === 'day' && this.world.worldType !== 'stone') {
            this.onMessage('天亮了！怪物开始燃烧');
            this.enemies.resetTreeChopCount();
        } else if (dayEvent === 'night' && this.world.worldType !== 'stone') {
            this.onMessage('天黑了！小心怪物出没');
        }

        // 死亡处理
        if (this.survival.dead) {
            if (this.multiplayer) this.multiplayer.sendDeath();
            this.player.canMove = false;
            this.player.unlockMouse();
            setTimeout(() => {
                this.survival.respawn();
                // 在金维度死亡时返回之前的世界
                if (this.world.worldType === 'gold') {
                    const returnWorld = this.world._goldReturnWorld || 'normal';
                    const returnPos = this.world._goldReturnPosition;
                    this.world.switchToWorld(returnWorld, this.player.position);
                    if (returnPos) {
                        this.player.position.set(returnPos.x, returnPos.y + 5, returnPos.z);
                    } else {
                        this.player.position.set(0, 5, 0);
                    }
                    this.onMessage('死亡后回到了原来的世界');
                } else {
                    this.player.position.set(0, 5, 0);
                }
                this.player.canMove = true;
                this.player.lockMouse();
            }, 3000);
        }

        // 更新UI
        this.ui.updateHUD();

        // 自动存档（每10秒）
        this.autoSaveTimer += dt;
        if (this.autoSaveTimer >= 10 && this.username) {
            this.autoSaveTimer = 0;
            if (this.gameMode === 'private') {
                SaveSystem.saveSlot(this.username, this.currentSlot || 1, this);
            } else if (this.gameMode === 'multiplayer') {
                SaveSystem.saveMultiplayer(this.username, this);
            }
        }
    }
}

// 启动游戏
new Game();
