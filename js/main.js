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
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
        if (this.multiplayer) {
            this.ui.showChat();
        }
    }

    onMessage(text) {
        // 提示已禁用
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

        this.renderer.render(this.scene, this.camera);
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
                this.player.position.set(0, 5, 0);
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
