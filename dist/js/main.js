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
        this.arcadeZombie = { active: false, score: 0, leaderboard: [] };
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

        // 渲染优化和怀旧材质设置在主菜单设置界面中绑定

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
        // 账号名严格为xy → 开发者模式：可拥有多个账号，不受设备绑定限制
        const dev = (username === 'xy');
        // 一台电脑只能登录一个账号：已绑定且与本次账号不同则拒绝（开发者账号除外）
        const bound = SaveSystem.getDeviceUser();
        if (!dev && bound && bound !== username) {
            this.ui.showMessage('本电脑已绑定账号「' + bound + '」，请使用该账号登录');
            return;
        }
        if (SaveSystem.userExists(username)) {
            if (!SaveSystem.checkPassword(username, password)) {
                this.ui.showMessage('密码错误');
                return;
            }
        } else {
            SaveSystem.createUser(username, password);
        }
        if (!bound) SaveSystem.bindDeviceUser(username);
        this.username = username;
        this.devMode = dev;
        this.isAdmin = (username === 'xy');
        this.ui.hideLogin();
        this.ui.showMainMenu(username);
    }

    // 开发者模式：无视登录直接切换/进入账号（测试界面用）
    devSwitch(username) {
        username = (username || '').trim();
        if (!username) { this.ui.showMessage('请输入账号名'); return; }
        if (!SaveSystem.userExists(username)) SaveSystem.createUser(username, ''); // 测试账号无密码
        this.username = username;
        this.devMode = (username === 'xy');
        this.isAdmin = (username === 'xy');
        this.ui.hideDevSwitch();
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

    startMultiplayerGame(roomId, characterName) {
        this.gameMode = 'multiplayer';
        this.characterName = characterName;
        this.isArcade = (roomId === 'room_arcade');
        // 娱乐场不加载生存存档，直接进大厅
        if (this.isArcade) {
            if (SaveSystem.hasArcadeSave(this.username)) {
                SaveSystem.applyArcadeSave(this.username, this);
                this.ui.showMessage('娱乐场存档已加载');
            } else {
                this.inventory.addItem('berry', 5);
                this.berryUpgrades = { wood_sword: 0, wood_pickaxe: 0, efficiency: 1, collectCount: 0, randomizerCount: 0 };
                this.ui.showMessage('新娱乐场大厅已创建');
            }
            this.world.lobbyMode = true;
            this.world.lobbyBounds = { minX: -55, maxX: 55, minZ: -55, maxZ: 55 };
            this.world.switchToWorld('stone', new THREE.Vector3(0, 5, 0));
            this.player.position.set(0, 5, 0);
            this.player.camera.position.set(0, 5, 0);
            this.world.updateChunks(this.player.position);
        } else if (SaveSystem.hasMpSave(characterName, roomId)) {
            SaveSystem.applyMpSave(characterName, roomId, this);
            this.ui.showMessage('角色「' + characterName + '」存档已加载');
        } else {
            this.inventory.addItem('berry', 5);
            this.ui.showMessage('新角色「' + characterName + '」已创建');
        }
        this.multiplayer = new MultiplayerSystem(this);
        this.multiplayer.connect(roomId);
        this.ui.hideRoomList();
        this.ui.showStart();
    }

    startArcadeZombie() {
        if (!this.isArcade) return;
        this.arcadeZombie.active = true;
        this.arcadeZombie.score = 0;
        this.ui.showMessage('打怪小游戏开始！击杀僵尸获得积分');
        if (this.ui && this.ui.updateZombieScore) this.ui.updateZombieScore();
    }

    endArcadeZombie() {
        if (!this.arcadeZombie.active) return;
        this.arcadeZombie.active = false;
        const entry = { name: this.username || '玩家', score: this.arcadeZombie.score, time: Date.now() };
        this.arcadeZombie.leaderboard.push(entry);
        this.arcadeZombie.leaderboard.sort((a, b) => b.score - a.score);
        this.arcadeZombie.leaderboard = this.arcadeZombie.leaderboard.slice(0, 3);
        this.ui.showMessage(`打怪小游戏结束！本局积分：${this.arcadeZombie.score}`);
        if (this.ui && this.ui.updateZombieScore) this.ui.updateZombieScore();
    }

    start() {
        this.running = true;
        this.ui.hideStart();
        this.ui.showHUD();
        this.player.lockMouse();
        this.ui.updateHUD();
        this.ui.showChat();
    }

    setRetroMaterial(enabled) {
        this.retroMaterial = enabled;
        if (enabled) {
            // 怀旧模式：关闭阴影、关闭高级光照
            this.renderer.shadowMap.enabled = false;
            this.renderer.toneMapping = THREE.NoToneMapping;
            this.renderer.physicallyCorrectLights = false;
            this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
            this.renderer.setPixelRatio(1);
            // 降低光照
            if (this.world.sun) this.world.sun.intensity = 1.5;
            if (this.world.ambient) this.world.ambient.intensity = 1.2;
            if (this.world.hemi) this.world.hemi.intensity = 0.3;
            // 水面简化
            if (this.world.waterMesh) {
                this.world.waterMesh.material.roughness = 1.0;
                this.world.waterMesh.material.metalness = 0.0;
                this.world.waterMesh.material.transparent = true;
                this.world.waterMesh.material.opacity = 0.8;
                this.world.waterMesh.material.needsUpdate = true;
            }
            // 遍历所有Mesh：改为平面着色 + 替换为Lambert材质 + 降低几何体分段
            this._applyRetroToScene();
            // 关闭太阳阴影
            if (this.world.sun) this.world.sun.castShadow = false;
        } else {
            // 恢复高画质
            this.renderer.shadowMap.enabled = true;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.2;
            this.renderer.physicallyCorrectLights = true;
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
            // 恢复光照
            if (this.world.sun) { this.world.sun.intensity = 3.2; this.world.sun.castShadow = true; }
            if (this.world.ambient) this.world.ambient.intensity = 0.8;
            if (this.world.hemi) this.world.hemi.intensity = 0.7;
            // 水面恢复
            if (this.world.waterMesh) {
                this.world.waterMesh.material.roughness = 0.08;
                this.world.waterMesh.material.metalness = 0.45;
                this.world.waterMesh.material.opacity = 0.75;
                this.world.waterMesh.material.needsUpdate = true;
            }
            // 恢复平滑着色 + Standard材质
            this._applyHighQualityToScene();
            // 恢复阴影标记
            for (const res of this.world.resources) {
                if (res.mesh) {
                    res.mesh.traverse(c => {
                        if (c.castShadow !== undefined) c.castShadow = true;
                        if (c.receiveShadow !== undefined) c.receiveShadow = true;
                    });
                }
            }
            for (const b of this.world.buildings) {
                if (b.mesh) {
                    b.mesh.traverse(c => {
                        if (c.castShadow !== undefined) c.castShadow = true;
                        if (c.receiveShadow !== undefined) c.receiveShadow = true;
                    });
                }
            }
            if (this.world.playerModel) {
                this.world.playerModel.traverse(c => {
                    if (c.castShadow !== undefined) c.castShadow = true;
                });
            }
        }
    }

    _applyRetroToScene() {
        this.scene.traverse(obj => {
            if (obj.isMesh && obj.geometry && obj.material) {
                // 平面着色
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                for (const m of mats) {
                    if (m.flatShading !== undefined) m.flatShading = true;
                    m.needsUpdate = true;
                }
                // 关闭阴影
                if (obj.castShadow !== undefined) obj.castShadow = false;
                if (obj.receiveShadow !== undefined) obj.receiveShadow = false;
            }
        });
        // 重建地形区块为低多边形
        for (const key in this.world.chunks) {
            const chunk = this.world.chunks[key];
            if (chunk.mesh && chunk.mesh.geometry) {
                chunk.mesh.material.flatShading = true;
                chunk.mesh.material.needsUpdate = true;
            }
        }
        // 敌人模型也应用怀旧
        if (this.enemies && this.enemies.enemies) {
            for (const enemy of this.enemies.enemies) {
                if (enemy.mesh) {
                    enemy.mesh.traverse(c => {
                        if (c.isMesh && c.material) {
                            const mats = Array.isArray(c.material) ? c.material : [c.material];
                            for (const m of mats) {
                                if (m.flatShading !== undefined) m.flatShading = true;
                                m.needsUpdate = true;
                            }
                            if (c.castShadow !== undefined) c.castShadow = false;
                            if (c.receiveShadow !== undefined) c.receiveShadow = false;
                        }
                    });
                }
            }
        }
    }

    _applyHighQualityToScene() {
        this.scene.traverse(obj => {
            if (obj.isMesh && obj.material) {
                const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                for (const m of mats) {
                    if (m.flatShading !== undefined) m.flatShading = false;
                    m.needsUpdate = true;
                }
            }
        });
        // 重建地形区块为高多边形
        for (const key in this.world.chunks) {
            const chunk = this.world.chunks[key];
            if (chunk.mesh && chunk.mesh.geometry) {
                chunk.mesh.material.flatShading = false;
                chunk.mesh.material.needsUpdate = true;
            }
        }
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
        const playerName = (this.gameMode === 'multiplayer' && this.characterName) ? this.characterName : (this.username || '玩家');
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
            if (this.characterName) SaveSystem.saveMultiplayer(this.characterName, this.multiplayer.roomId, this);
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
            if (this.characterName) SaveSystem.saveMultiplayer(this.characterName, this);
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
            if (res.mesh && !res.depleted) {
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
        // 小宇币：每在线20s+5，按账号存localStorage（与小球战争皮肤商店共用）
        this._xyCoinT = (this._xyCoinT || 0) + dt;
        if (this._xyCoinT >= 20) {
            this._xyCoinT -= 20;
            try {
                const ck = 'xyCoin_' + (this.username || 'guest');
                localStorage.setItem(ck, String((parseInt(localStorage.getItem(ck)) || 0) + 5));
            } catch (e) { /* ignore */ }
        }
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
                SaveSystem.saveMultiplayer(this.characterName, this);
            }
        }
    }
}

// 启动游戏
new Game();
