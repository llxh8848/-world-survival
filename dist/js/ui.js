// UI管理：HUD更新、背包界面、合成界面

class UI {
    constructor(game) {
        this.game = game;
        this.inventory = game.inventory;
        this.survival = game.survival;
        this.world = game.world;
        this.player = game.player;
        this.currentCraftCat = 'all';
        this.selectedInvSlot = null;
        this.activeMiner = null;
        this.selectedMinerSlot = null;
        this.selectedMinerToolSlot = null;
        this.vd = { inited: false, tool: 'pen', color: '#222222', size: 4, fps: 6, frames: [], cur: 0, undo: [], playing: false, exporting: false, drawing: false, timer: 0, onion: false, textEl: null, textX: 0, textY: 0 }; // 玩玩视频状态(onion=Pf洋葱皮)
        this._bindEvents();
    }

    _bindEvents() {
        // 开始按钮
        document.getElementById('startBtn').addEventListener('click', () => {
            this.game.start();
        });

        // 登录按钮
        document.getElementById('loginBtn').addEventListener('click', () => {
            this._handleLogin();
        });
        document.getElementById('usernameInput').addEventListener('keydown', (e) => {
            if (e.code === 'Enter') this._handleLogin();
        });

        // 退出登录按钮
        document.getElementById('logoutBtn').addEventListener('click', () => {
            if (confirm('确定退出登录？存档将自动保存。')) {
                this.game.logout();
            }
        });

        // 主菜单按钮
        document.getElementById('btnWorldSurvival').addEventListener('click', () => {
            this.hideMainMenu();
            this.showWorldSurvival();
        });
        document.getElementById('btnPrivateGame').addEventListener('click', () => {
            this.hideWorldSurvival();
            this.showSaveSlots();
        });
        document.getElementById('btnMultiplayer').addEventListener('click', () => {
            this.hideWorldSurvival();
            this.showRoomList();
        });
        // 重置版界面：进入世界生存重置版存档菜单
        document.getElementById('btnRemake').addEventListener('click', () => {
            this.hideWorldSurvival();
            window.remake.showMenu();
        });
        document.getElementById('btnBackToGameBox').addEventListener('click', () => {
            this.hideWorldSurvival();
            this.showMainMenu(this.game.username);
        });
        // 植物大战僵尸
        document.getElementById('btnPvz').addEventListener('click', () => {
            this.hideMainMenu();
            this.showPvz();
        });
        // 火柴人大战僵尸（独立入口）
        document.getElementById('btnStickPvz').addEventListener('click', () => {
            this.hideMainMenu();
            this.showStickPvz();
        });
        document.getElementById('btnBackFromPvz').addEventListener('click', () => {
            this.hidePvz();
            this.showMainMenu(this.game.username);
        });
        // 小球对战
        document.getElementById('btnBallBattle').addEventListener('click', () => {
            this.hideMainMenu();
            this.showBallBattle();
        });
        document.getElementById('btnBackFromBallBattle').addEventListener('click', () => {
            this.hideBallBattle();
            this.showMainMenu(this.game.username);
        });
        // 衬彩稻田
        document.getElementById('btnFarm').addEventListener('click', () => {
            this.hideMainMenu();
            window.farm.enter();
        });
        document.getElementById('btnFarmBack').addEventListener('click', () => {
            window.farm.exit();
            this.showMainMenu(this.game.username);
        });
        // 我的世界 (Minecraft 3D沙盒)
        document.getElementById('btnLevelCiv').addEventListener('click', () => {
            this.hideMainMenu();
            if (window.minecraft) window.minecraft.enter();
            else if (window.levelciv) window.levelciv.enter();
        });
        // 林静球山
        document.getElementById('btnLinjing').addEventListener('click', () => {
            this.hideMainMenu();
            window.linjing.enter(() => this.showMainMenu(this.game.username));
        });
        // 玩玩视频（画画+逐帧动画）
        document.getElementById('btnVideo').addEventListener('click', () => {
            this.hideMainMenu();
            this.showVideo();
        });
        document.getElementById('btnBackFromVideo').addEventListener('click', () => {
            this.hideVideo();
            this.showMainMenu(this.game.username);
        });
        document.querySelectorAll('#vdToolbar [data-tool]').forEach(b => b.addEventListener('click', () => this._vdSetTool(b.dataset.tool)));
        document.querySelectorAll('#vdPalette [data-c]').forEach(b => b.addEventListener('click', () => this._vdSetColor(b.dataset.c)));
        document.getElementById('vdColor').addEventListener('input', e => this._vdSetColor(e.target.value));
        document.getElementById('vdSize').addEventListener('input', e => {
            this.vd.size = +e.target.value;
            document.getElementById('vdSizeVal').textContent = e.target.value;
        });
        document.getElementById('btnVdUndo').addEventListener('click', () => this._vdUndo());
        document.getElementById('btnVdClear').addEventListener('click', () => this._vdClear());
        document.getElementById('btnVdAddFrame').addEventListener('click', () => this._vdAddFrame());
        document.getElementById('btnVdDupFrame').addEventListener('click', () => this._vdDupFrame());
        document.getElementById('btnVdDelFrame').addEventListener('click', () => this._vdDelFrame());
        document.getElementById('btnVdPlay').addEventListener('click', () => this._vdTogglePlay());
        document.getElementById('vdFps').addEventListener('change', e => { this.vd.fps = +e.target.value; });
        document.getElementById('btnVdSave').addEventListener('click', () => this._vdSave(true));
        document.getElementById('btnVdExport').addEventListener('click', () => this._vdExport());
        document.getElementById('btnVdOnion').addEventListener('click', () => { // Pf洋葱皮开关
            this.vd.onion = !this.vd.onion;
            document.getElementById('btnVdOnion').classList.toggle('on', this.vd.onion);
            if (this.vd.inited) this._vdShow();
        });
        const vdCv = document.getElementById('vdCanvas');
        vdCv.addEventListener('pointerdown', e => this._vdDown(e));
        vdCv.addEventListener('pointermove', e => this._vdMove(e));
        window.addEventListener('pointerup', e => this._vdUp(e));
        vdCv.addEventListener('contextmenu', e => e.preventDefault());
        document.getElementById('btnBackToLogin').addEventListener('click', () => {
            this.hideMainMenu();
            this.showLogin();
        });

        // 开发者模式：切换账号（仅 devMode 时按钮可见）
        document.getElementById('btnDevSwitch').addEventListener('click', () => {
            this.hideMainMenu();
            this.showDevSwitch();
        });
        document.getElementById('btnDevSwitchBack').addEventListener('click', () => {
            this.hideDevSwitch();
            this.showMainMenu(this.game.username);
        });
        const devEnter = () => this.game.devSwitch(document.getElementById('devNameInput').value);
        document.getElementById('btnDevEnter').addEventListener('click', devEnter);
        document.getElementById('devNameInput').addEventListener('keydown', (e) => {
            if (e.code === 'Enter') devEnter();
        });
        // 设置按钮
        document.getElementById('btnSettings').addEventListener('click', () => {
            this.hideWorldSurvival();
            this.showSettings();
        });
        document.getElementById('btnBackFromSettings').addEventListener('click', () => {
            this.hideSettings();
            this.showWorldSurvival();
        });
        // 设置开关
        const renderOptCb = document.getElementById('settingRenderOpt');
        if (renderOptCb) {
            renderOptCb.addEventListener('change', () => {
                this.game.renderOptEnabled = renderOptCb.checked;
                if (!this.game.renderOptEnabled) {
                    // 恢复所有物体可见
                    for (const key in this.game.world.chunks) {
                        const chunk = this.game.world.chunks[key];
                        if (chunk.mesh) chunk.mesh.visible = true;
                    }
                    for (const res of this.game.world.resources) {
                        if (res.mesh) res.mesh.visible = true;
                    }
                    for (const b of this.game.world.buildings) {
                        if (b.mesh) b.mesh.visible = true;
                    }
                    if (this.game.enemies && this.game.enemies.enemies) {
                        for (const enemy of this.game.enemies.enemies) {
                            if (enemy.mesh) enemy.mesh.visible = true;
                        }
                    }
                }
            });
        }
        const retroCb = document.getElementById('settingRetroMaterial');
        if (retroCb) {
            retroCb.addEventListener('change', () => {
                this.game.setRetroMaterial(retroCb.checked);
            });
        }
        document.getElementById('btnBackToMenu').addEventListener('click', () => {
            this.hideRoomList();
            this.showWorldSurvival();
        });
        document.getElementById('btnBackToMenuFromSlots').addEventListener('click', () => {
            this.hideSaveSlots();
            this.showWorldSurvival();
        });
        document.getElementById('btnBackToRoomList').addEventListener('click', () => {
            this.hideCharacterScreen();
            this.showRoomList();
        });
        document.getElementById('btnCreateChar').addEventListener('click', () => {
            this._createCharacter();
        });
        document.getElementById('newCharName').addEventListener('keydown', (e) => {
            if (e.code === 'Enter') this._createCharacter();
        });

        // 页面关闭/刷新时自动保存并断开联机
        window.addEventListener('beforeunload', () => {
            if (this.game.username && this.game.running) {
                if (this.game.gameMode === 'private') {
                    SaveSystem.saveSlot(this.game.username, this.game.currentSlot || 1, this.game);
                } else if (this.game.gameMode === 'multiplayer') {
                    if (this.game.isArcade) {
                        SaveSystem.saveArcade(this.game.username, this.game);
                    } else {
                        SaveSystem.saveMultiplayer(this.game.characterName, this.game.multiplayer.roomId, this.game);
                    }
                }
            }
            if (this.game.multiplayer && this.game.multiplayer.connected) {
                this.game.multiplayer.disconnect();
            }
        });
        // 页面隐藏时保存（切标签页、最小化等）
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.game.username && this.game.running) {
                if (this.game.gameMode === 'private') {
                    SaveSystem.saveSlot(this.game.username, this.game.currentSlot || 1, this.game);
                } else if (this.game.gameMode === 'multiplayer') {
                    if (this.game.isArcade) {
                        SaveSystem.saveArcade(this.game.username, this.game);
                    } else {
                        SaveSystem.saveMultiplayer(this.game.characterName, this.game.multiplayer.roomId, this.game);
                    }
                }
            }
        });

        // 聊天：T键打开输入框
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyT' && this.game.running) {
                if (!this._anyPanelOpen() && document.getElementById('chatInput').style.display !== 'block') {
                    e.preventDefault();
                    this.openChatInput();
                }
            }
            if (e.code === 'Escape' && document.getElementById('chatInput').style.display === 'block') {
                this.closeChatInput();
            }
        });
        // 聊天输入框：Enter发送，Escape关闭
        const chatInput = document.getElementById('chatInput');
        chatInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.code === 'Enter') {
                this.closeChatInput();
            } else if (e.code === 'Escape') {
                chatInput.value = '';
                this.closeChatInput();
            }
        });

        // 关闭面板按钮
        document.querySelectorAll('.btn-close').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById(btn.dataset.close).style.display = 'none';
                this.player.lockMouse();
            });
        });

        // 传送石碑命名确认按钮
        document.getElementById('btnMonumentConfirm').addEventListener('click', () => {
            this._confirmMonumentName();
        });
        document.getElementById('monumentNameInput').addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.code === 'Enter') {
                this._confirmMonumentName();
            }
        });

        // 神秘盒充能按钮
        document.getElementById('btnMysteryBoxStart').addEventListener('click', () => {
            this._startCharging();
        });
        document.getElementById('btnMysteryBoxClose').addEventListener('click', () => {
            this._closeMysteryBox();
        });

        // 锻造台按钮
        document.getElementById('btnForgeStart').addEventListener('click', () => {
            this._startForging();
        });
        document.getElementById('btnForgeClose').addEventListener('click', () => {
            this._closeForge();
        });

        // 装备槽点击：已装备时卸下，空位时选择装备
        document.querySelectorAll('.equip-slot').forEach(slotEl => {
            slotEl.addEventListener('click', () => {
                const equipSlot = slotEl.dataset.equipSlot;
                if (this.inventory.equipment[equipSlot]) {
                    this.inventory.unequipItem(equipSlot);
                    this._syncArmor();
                    if (equipSlot.startsWith('talisman')) this._syncTalismans();
                    this._renderEquipment();
                    this._renderInventory();
                } else {
                    this._showEquipmentSelector(equipSlot);
                }
            });
        });

        // 合成分类
        document.querySelectorAll('.craft-cat').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.craft-cat').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentCraftCat = btn.dataset.cat;
                this._renderCrafting();
            });
        });

        // 建造选项
        document.querySelectorAll('.build-option').forEach(btn => {
            const handler = (e) => {
                if (e) e.preventDefault();
                document.querySelectorAll('.build-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.player.buildItem = btn.dataset.item;
            };
            btn.addEventListener('click', handler);
            btn.addEventListener('touchstart', handler, { passive: false });
        });

        // 浆果商店
        document.getElementById('btnBerryBuy')?.addEventListener('click', () => this._showBerryBuy());
        document.getElementById('btnBerryRefine')?.addEventListener('click', () => this._setBerryMsg('精修功能还没做完'));
        document.getElementById('btnBerryEff')?.addEventListener('click', () => this._setBerryMsg('效率功能还没做完'));
        document.getElementById('btnBerryAch')?.addEventListener('click', () => this._setBerryMsg('成就功能还没做完'));
        document.getElementById('btnBuyWoodSword')?.addEventListener('click', () => this._buyBerryItem('wood_sword', 10));
        document.getElementById('btnBuyWoodPick')?.addEventListener('click', () => this._buyBerryItem('wood_pickaxe', 20));
        document.getElementById('btnBuyBerryRandomizer')?.addEventListener('click', () => this._buyBerryRandomizer());

        // ESC释放鼠标
        document.addEventListener('keydown', (e) => {
            if (!this.game.running) return; // 其它游戏界面不响应世界生存快捷键
            if (e.code === 'KeyE') {
                if (this.game.isArcade && this.player.interactTarget && this.player.interactTarget.type === 'berry_bush') {
                    this._togglePanel('berryShopUI');
                } else {
                    this._togglePanel('inventoryUI');
                }
            }
            if (e.code === 'KeyC') this._togglePanel('craftingUI');
            if (e.code === 'KeyB') this._toggleBuildMode();
            if (e.code === 'KeyF') this.player.interact();
            if (e.code === 'KeyQ' && this._anyPanelOpen() && this.selectedInvSlot !== null) {
                // Q键删除选中物品
                this.inventory.items[this.selectedInvSlot] = null;
                this.selectedInvSlot = null;
                this._clearHighlight();
                this._renderInventory();
            }
            if (e.code === 'Escape') {
                if (this.player.mouseLocked) this.player.unlockMouse();
                this._togglePanel('achievementUI');
                if (document.getElementById('achievementUI').style.display === 'block') this._renderAchievements();
            }
        });

        // 点击锁定鼠标
        document.addEventListener('click', () => {
            if (!this.player.mouseLocked && this.game.running &&
                !this._anyPanelOpen() && !this.player.buildMode) {
                this.player.lockMouse();
            }
        });

        // 快捷栏点击（背包打开时用于交换，否则切换选中）
        document.querySelectorAll('.hotbar-slot').forEach(slot => {
            let touchHandled = false;
            const handler = (e) => {
                if (e.type === 'click' && touchHandled) { touchHandled = false; return; }
                if (e.type === 'touchstart') { touchHandled = true; }
                const slotIdx = parseInt(slot.dataset.slot);
                if (this._anyPanelOpen() && this.selectedInvSlot !== null) {
                    // 交换：背包格 -> 快捷栏格
                    this.inventory.moveItem(this.selectedInvSlot, slotIdx);
                    this.selectedInvSlot = null;
                    this._renderInventory();
                    this._clearHighlight();
                    if (e) e.stopPropagation();
                    if (e && e.preventDefault) e.preventDefault();
                } else if (this._anyPanelOpen()) {
                    // 选中快捷栏格
                    this.selectedInvSlot = slotIdx;
                    this._highlightSlot(slot);
                    if (e) e.stopPropagation();
                    if (e && e.preventDefault) e.preventDefault();
                } else {
                    this.inventory.selectSlot(slotIdx);
                }
            };
            slot.addEventListener('click', handler);
            slot.addEventListener('touchstart', handler, { passive: false });
        });
    }

    _handleLogin() {
        const username = document.getElementById('usernameInput').value.trim();
        const password = document.getElementById('passwordInput').value;
        if (!username) {
            document.getElementById('usernameInput').focus();
            return;
        }
        if (!password) {
            document.getElementById('passwordInput').focus();
            return;
        }
        this.game.login(username, password);
    }

    _togglePanel(id) {
        const panel = document.getElementById(id);
        if (panel.style.display === 'none') {
            panel.style.display = 'block';
            this.player.unlockMouse();
            if (id === 'inventoryUI') this._renderInventory();
            if (id === 'craftingUI') this._renderCrafting();
            if (id === 'minerUI') this._renderMiner();
            if (id === 'berryShopUI') this._renderBerryShop();
        } else {
            panel.style.display = 'none';
            this.player.lockMouse();
        }
    }

    _toggleBuildMode() {
        this.player.buildMode = !this.player.buildMode;
        document.getElementById('buildHint').style.display = this.player.buildMode ? 'block' : 'none';
        const btn = document.getElementById('btnBuild');
        if (btn) {
            if (this.player.buildMode) {
                btn.style.background = 'rgba(106, 156, 90, 0.5)';
                btn.style.borderColor = '#6a9c5a';
            } else {
                btn.style.background = '';
                btn.style.borderColor = '';
            }
        }
        this.game.onMessage(this.player.buildMode ? '建造模式开启' : '建造模式关闭');
    }

    _anyPanelOpen() {
        return document.getElementById('inventoryUI').style.display !== 'none' ||
               document.getElementById('craftingUI').style.display !== 'none' ||
               document.getElementById('minerUI').style.display !== 'none' ||
               document.getElementById('ultimateBookshelfUI').style.display !== 'none' ||
               document.getElementById('monumentUI').style.display !== 'none' ||
               document.getElementById('mysteryBoxUI').style.display !== 'none' ||
               document.getElementById('achievementUI').style.display !== 'none' ||
               document.getElementById('berryShopUI').style.display !== 'none';
    }

    _renderBerryShop() {
        const count = this.inventory.getItemCount('berry');
        const upg = this.game.berryUpgrades || {};
        const randomizer = upg.randomizerCount || 0;
        const progress = upg.collectCount || 0;
        const efficiency = upg.efficiency || 1;
        document.getElementById('berryShopCount').innerText = `浆果：${count} | 随机器：${randomizer} | 收集：${progress}/30 | 效率：${efficiency}x`;
        this._setBerryMsg('');
    }

    _showBerryBuy() {
        const buy = document.getElementById('berryShopBuy');
        buy.style.display = (buy.style.display === 'none' || !buy.style.display) ? 'block' : 'none';
        this._setBerryMsg('');
    }

    _setBerryMsg(text) {
        document.getElementById('berryShopMsg').innerText = text;
    }

    _buyBerryItem(itemId, cost) {
        if (!this.inventory.hasItem('berry', cost)) {
            this._setBerryMsg(`浆果不足，需要 ${cost} 个浆果`);
            return;
        }
        if (!this.game.berryUpgrades) {
            this.game.berryUpgrades = { wood_sword: 0, wood_pickaxe: 0 };
        }
        this.inventory.removeItem('berry', cost);
        this.game.berryUpgrades[itemId] = (this.game.berryUpgrades[itemId] || 0) + 1;
        const bonus = itemId === 'wood_pickaxe' ? 2 : 1;
        this._setBerryMsg(`兑换成功：每次采集浆果 +${bonus}`);
        this._renderBerryShop();
        this._renderInventory();
    }

    _buyBerryRandomizer() {
        const cost = 100;
        if (!this.inventory.hasItem('berry', cost)) {
            this._setBerryMsg(`浆果不足，需要 ${cost} 个浆果`);
            return;
        }
        if (!this.game.berryUpgrades) {
            this.game.berryUpgrades = { wood_sword: 0, wood_pickaxe: 0, efficiency: 1 };
        }
        this.inventory.removeItem('berry', cost);
        this.game.berryUpgrades.randomizerCount = (this.game.berryUpgrades.randomizerCount || 0) + 1;
        this._setBerryMsg('兑换成功：获得 1 个事件随机器');
        this._renderBerryShop();
        this._renderInventory();
    }

    _renderAchievements() {
        const container = document.getElementById('achievementList');
        if (!container) return;
        const achievements = this.game.achievements || {};
        const progress = this.game.achievementProgress || {};
        let unlockedCount = 0;
        let html = '';
        for (const id in ACHIEVEMENTS) {
            const def = ACHIEVEMENTS[id];
            const isUnlocked = !!achievements[id];
            if (isUnlocked) unlockedCount++;
            const currentProgress = progress[id] || 0;
            if (isUnlocked) {
                html += `<div style="background:linear-gradient(135deg,#2a4a2a,#1a3a1a);border:2px solid #ffd700;border-radius:8px;padding:10px 14px;margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:16px;color:#ffd700;font-weight:bold;">\ud83c\udfc6 ${def.name}</span>
                        <span style="font-size:12px;color:#6a9c5a;">\u2705 \u5df2\u89e3\u9501</span>
                    </div>
                    <div style="font-size:13px;color:#ccc;margin-top:4px;">${def.desc}</div>
                </div>`;
            } else {
                const pct = def.target > 1 ? Math.min(100, Math.floor(currentProgress / def.target * 100)) : 0;
                const progressText = def.target > 1 ? `${currentProgress}/${def.target} (${pct}%)` : '\u672a\u5f00\u59cb';
                html += `<div style="background:rgba(30,30,30,0.8);border:1px solid #555;border-radius:8px;padding:10px 14px;margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-size:16px;color:#999;font-weight:bold;">\ud83d\udd12 ${def.name}</span>
                        <span style="font-size:12px;color:#888;">${progressText}</span>
                    </div>
                    <div style="font-size:13px;color:#888;margin-top:4px;">${def.desc}</div>
                    ${def.target > 1 ? `<div style="margin-top:6px;height:6px;background:#333;border-radius:3px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:#6a9c5a;border-radius:3px;"></div></div>` : ''}
                </div>`;
            }
        }
        html = `<div style="text-align:center;margin-bottom:10px;color:#ffd700;font-size:14px;">\u5df2\u89e3\u9501 ${unlockedCount}/${Object.keys(ACHIEVEMENTS).length}</div>` + html;
        container.innerHTML = html;
    }

    updateZombieScore() {
        if (!this.game.isArcade) return;
        let el = document.getElementById('zombieScorePanel');
        if (!el) {
            el = document.createElement('div');
            el.id = 'zombieScorePanel';
            el.style.cssText = 'position:fixed;right:20px;top:80px;background:rgba(0,0,0,0.7);color:#fff;padding:12px;border-radius:8px;font-size:14px;z-index:1000;min-width:160px;';
            document.body.appendChild(el);
        }
        const lb = this.game.arcadeZombie.leaderboard || [];
        let html = `<div style="font-weight:bold;margin-bottom:8px;">打怪积分榜</div>`;
        html += `<div>当前积分: ${this.game.arcadeZombie.score}</div>`;
        html += `<div style="margin-top:8px;font-size:12px;color:#aaa;">前三名:</div>`;
        for (let i = 0; i < 3; i++) {
            const e = lb[i];
            html += `<div>${i + 1}. ${e ? e.name + ' - ' + e.score : '---'}</div>`;
        }
        html += `<div style="margin-top:8px;font-size:12px;color:#aaa;">输入 /换剑 木剑/石剑/铁剑 兑换</div>`;
        el.innerHTML = html;
        el.style.display = this.game.arcadeZombie.active ? 'block' : 'none';
    }

    updateHUD() {
        const s = this.survival;
        // 状态条
        document.getElementById('healthBar').style.width = `${s.health}%`;
        document.getElementById('healthText').textContent = Math.floor(s.health);
        document.getElementById('hungerBar').style.width = `${s.hunger}%`;
        document.getElementById('hungerText').textContent = Math.floor(s.hunger);
        document.getElementById('thirstBar').style.width = `${s.thirst}%`;
        document.getElementById('thirstText').textContent = Math.floor(s.thirst);
        const tempPct = ((s.temperature - 34) / 8) * 100;
        document.getElementById('tempBar').style.width = `${Math.max(0, Math.min(100, tempPct))}%`;
        document.getElementById('tempText').textContent = `${s.temperature.toFixed(1)}°C`;

        // 盔甲值
        const armorVal = this.inventory.getArmorValue();
        const armorMax = 5.5;
        document.getElementById('armorBar').style.width = `${Math.min(100, (armorVal / armorMax) * 100)}%`;
        document.getElementById('armorText').textContent = armorVal.toFixed(1);

        // 时间
        document.getElementById('dayCount').textContent = `第 ${this.world.dayCount} 天`;
        document.getElementById('timeDisplay').textContent = this.world.getTimeString();
        document.getElementById('dayIcon').textContent = this.world.isNight ? '🌙' : '☀️';

        // 快捷栏（槽位0-8）
        document.querySelectorAll('.hotbar-slot').forEach((slot, i) => {
            const item = this.inventory.items[i];
            const iconEl = slot.querySelector('.slot-icon');
            const countEl = slot.querySelector('.slot-count');
            let durEl = slot.querySelector('.slot-dur');
            if (!durEl) {
                durEl = document.createElement('div');
                durEl.className = 'slot-dur';
                slot.appendChild(durEl);
            }
            if (item) {
                iconEl.innerHTML = itemIconSVG(item.id);
                countEl.textContent = item.amount > 1 ? item.amount : '';
                const def = ITEMS[item.id] || {};
                if (def.maxUses) {
                    const uses = item.uses || 0;
                    const pct = Math.max(0, Math.min(100, 100 * (def.maxUses - uses) / def.maxUses));
                    durEl.style.display = 'block';
                    durEl.style.width = pct + '%';
                } else {
                    durEl.style.display = 'none';
                }
            } else {
                iconEl.innerHTML = ''; 
                countEl.textContent = '';
                if (durEl) durEl.style.display = 'none';
            }
            slot.classList.toggle('active', i === this.inventory.selectedSlot);
        });

        // 交互提示
        const hint = document.getElementById('interactHint');
        if (this.player.interactTarget && !this.player.interactTarget.depleted) {
            hint.style.display = 'block';
            const r = this.player.interactTarget;
            if (r.type === 'berry') {
                hint.innerHTML = '按 <kbd>E</kbd> 拾取浆果';
            } else if (r.type === 'berry_bush') {
                hint.innerHTML = '按 <kbd>E</kbd> 打开兑换界面';
            } else if (r.type === 'cave_entrance') {
                hint.innerHTML = '按 <kbd>F</kbd> 进入矿洞';
            } else if (r.type === 'cave_ladder') {
                hint.innerHTML = '按 <kbd>F</kbd> 顺着爬梯返回地表';
            } else if (r.type === 'cave_chest') {
                hint.innerHTML = '按 <kbd>F</kbd> 打开宝箱' + (r.needsKey ? '（需要洞穴钥匙）' : '');
            } else if (r.type === 'river_chest') {
                hint.innerHTML = '按 <kbd>F</kbd> 打开宝箱';
            } else {
                hint.innerHTML = '按 <kbd>左键</kbd> 采集';
            }
        } else {
            hint.style.display = 'none';
        }

        // 死亡
        if (s.dead) {
            document.getElementById('deathScreen').style.display = 'flex';
            document.getElementById('deathInfo').textContent = `你存活了 ${this.world.dayCount} 天`;
        } else {
            document.getElementById('deathScreen').style.display = 'none';
        }
    }

    openChest(chest) {
        this.activeChest = chest;
        const charge = chest.charge || 0;
        const slotCount = 10 + charge;
        if (!Array.isArray(this.activeChest.chestStorage) || this.activeChest.chestStorage.length < slotCount) {
            const old = this.activeChest.chestStorage || [];
            this.activeChest.chestStorage = [];
            for (let i = 0; i < slotCount; i++) this.activeChest.chestStorage.push(old[i] || null);
        }
        this.selectedChestSlot = null;
        this.selectedChestInvSlot = null;
        const panel = document.getElementById('chestUI');
        panel.style.display = 'block';
        this.player.unlockMouse();
        this._renderChest();
    }

    _renderChest() {
        if (!this.activeChest) return;
        const storageGrid = document.getElementById('chestStorageGrid');
        const inventoryGrid = document.getElementById('chestInventoryGrid');

        const charge = this.activeChest.charge || 0;
        const slotCount = 10 + charge;
        storageGrid.innerHTML = '';
        for (let i = 0; i < slotCount; i++) {
            const item = this.activeChest.chestStorage[i];
            const slot = document.createElement('div');
            slot.className = 'inv-slot' + (item ? '' : ' empty') + (this.selectedChestSlot === i ? ' selected' : '');
            if (item) {
                const info = ITEMS[item.id];
                slot.innerHTML = `<span class="slot-icon">${itemIconSVG(item.id)}</span><span class="slot-count">${item.amount > 1 ? item.amount : ''}</span>`;
                slot.title = `${info?.name || item.id} x${item.amount}`;
            }
            slot.addEventListener('click', () => {
                if (this.selectedChestInvSlot !== null) {
                    this._transferChestItem('to_chest', this.selectedChestInvSlot, i);
                } else if (this.selectedChestSlot === i) {
                    this.selectedChestSlot = null;
                } else {
                    this.selectedChestSlot = i;
                    this.selectedChestInvSlot = null;
                }
                this._renderChest();
            });
            storageGrid.appendChild(slot);
        }

        inventoryGrid.innerHTML = '';
        for (let i = 0; i < this.inventory.size; i++) {
            const item = this.inventory.items[i];
            const slot = document.createElement('div');
            slot.className = 'inv-slot' + (item ? '' : ' empty') + (this.selectedChestInvSlot === i ? ' selected' : '');
            if (item) {
                const info = ITEMS[item.id];
                slot.innerHTML = `<span class="slot-icon">${itemIconSVG(item.id)}</span><span class="slot-count">${item.amount > 1 ? item.amount : ''}</span>`;
                slot.title = `${info?.name || item.id} x${item.amount}`;
            }
            slot.addEventListener('click', () => {
                if (this.selectedChestSlot !== null) {
                    this._transferChestItem('to_inv', this.selectedChestSlot, i);
                } else if (this.selectedChestInvSlot === i) {
                    this.selectedChestInvSlot = null;
                } else {
                    this.selectedChestInvSlot = i;
                    this.selectedChestSlot = null;
                }
                this._renderChest();
            });
            inventoryGrid.appendChild(slot);
        }
    }

    _transferChestItem(direction, sourceIndex, targetIndex) {
        if (direction === 'to_chest') {
            const invItem = this.inventory.items[sourceIndex];
            if (!invItem) { this.selectedChestInvSlot = null; return; }
            const chestSlot = this.activeChest.chestStorage[targetIndex];
            if (chestSlot && chestSlot.id !== invItem.id) {
                this.selectedChestInvSlot = null;
                return;
            }
            const info = ITEMS[invItem.id];
            const maxStack = info?.maxStack || 99;
            if (chestSlot && chestSlot.amount >= maxStack) { this.selectedChestInvSlot = null; return; }
            const space = chestSlot ? maxStack - chestSlot.amount : maxStack;
            const amount = Math.min(space, invItem.amount);
            if (!chestSlot) {
                this.activeChest.chestStorage[targetIndex] = { id: invItem.id, amount };
            } else {
                chestSlot.amount += amount;
            }
            invItem.amount -= amount;
            if (invItem.amount <= 0) this.inventory.items[sourceIndex] = null;
            this.selectedChestInvSlot = null;
            this.inventory.notify();
        } else {
            const chestItem = this.activeChest.chestStorage[sourceIndex];
            if (!chestItem) { this.selectedChestSlot = null; return; }
            const invSlot = this.inventory.items[targetIndex];
            if (invSlot && invSlot.id !== chestItem.id) {
                this.selectedChestSlot = null;
                return;
            }
            const info = ITEMS[chestItem.id];
            const maxStack = info?.maxStack || 99;
            if (invSlot && invSlot.amount >= maxStack) { this.selectedChestSlot = null; return; }
            const space = invSlot ? maxStack - invSlot.amount : maxStack;
            const amount = Math.min(space, chestItem.amount);
            if (!invSlot) {
                this.inventory.items[targetIndex] = { id: chestItem.id, amount };
            } else {
                invSlot.amount += amount;
            }
            chestItem.amount -= amount;
            if (chestItem.amount <= 0) this.activeChest.chestStorage[sourceIndex] = null;
            this.selectedChestSlot = null;
            this.inventory.notify();
        }
    }

    openRareWoodPile(pile) {
        this.activeRareWoodPile = pile;
        if (!Array.isArray(pile.rareWoodPileStorage) || pile.rareWoodPileStorage.length < 1) {
            pile.rareWoodPileStorage = [null];
        }
        this.selectedPileSlot = null;
        this.selectedPileInvSlot = null;
        const panel = document.getElementById('rareWoodPileUI');
        panel.style.display = 'block';
        this.player.unlockMouse();
        this._renderRareWoodPile();
    }

    _renderRareWoodPile() {
        if (!this.activeRareWoodPile) return;
        const storageGrid = document.getElementById('rareWoodPileStorageGrid');
        const inventoryGrid = document.getElementById('rareWoodPileInventoryGrid');

        storageGrid.innerHTML = '';
        for (let i = 0; i < 1; i++) {
            const item = this.activeRareWoodPile.rareWoodPileStorage[i];
            const slot = document.createElement('div');
            slot.className = 'inv-slot' + (item ? '' : ' empty') + (this.selectedPileSlot === i ? ' selected' : '');
            if (item) {
                const info = ITEMS[item.id];
                slot.innerHTML = `<span class="slot-icon">${itemIconSVG(item.id)}</span><span class="slot-count">${item.amount > 1 ? item.amount : ''}</span>`;
                slot.title = `${info?.name || item.id} x${item.amount}`;
            }
            slot.addEventListener('click', () => {
                if (this.selectedPileInvSlot !== null) {
                    this._transferRareWoodPileItem('to_pile', this.selectedPileInvSlot, i);
                } else if (this.selectedPileSlot === i) {
                    this.selectedPileSlot = null;
                } else {
                    this.selectedPileSlot = i;
                    this.selectedPileInvSlot = null;
                }
                this._renderRareWoodPile();
            });
            storageGrid.appendChild(slot);
        }

        inventoryGrid.innerHTML = '';
        for (let i = 0; i < this.inventory.size; i++) {
            const item = this.inventory.items[i];
            const slot = document.createElement('div');
            slot.className = 'inv-slot' + (item ? '' : ' empty') + (this.selectedPileInvSlot === i ? ' selected' : '');
            if (item) {
                const info = ITEMS[item.id];
                slot.innerHTML = `<span class="slot-icon">${itemIconSVG(item.id)}</span><span class="slot-count">${item.amount > 1 ? item.amount : ''}</span>`;
                slot.title = `${info?.name || item.id} x${item.amount}`;
            }
            slot.addEventListener('click', () => {
                if (this.selectedPileSlot !== null) {
                    this._transferRareWoodPileItem('to_inv', this.selectedPileSlot, i);
                } else if (this.selectedPileInvSlot === i) {
                    this.selectedPileInvSlot = null;
                } else {
                    this.selectedPileInvSlot = i;
                    this.selectedPileSlot = null;
                }
                this._renderRareWoodPile();
            });
            inventoryGrid.appendChild(slot);
        }
    }

    _transferRareWoodPileItem(direction, sourceIndex, targetIndex) {
        const pile = this.activeRareWoodPile;
        if (!pile) return;
        if (direction === 'to_pile') {
            const invItem = this.inventory.items[sourceIndex];
            if (!invItem) { this.selectedPileInvSlot = null; return; }
            const pileSlot = pile.rareWoodPileStorage[targetIndex];
            if (pileSlot && pileSlot.id !== invItem.id) {
                this.selectedPileInvSlot = null;
                return;
            }
            const info = ITEMS[invItem.id];
            const maxStack = info?.maxStack || 99;
            if (pileSlot && pileSlot.amount >= maxStack) { this.selectedPileInvSlot = null; return; }
            const space = pileSlot ? maxStack - pileSlot.amount : maxStack;
            const amount = Math.min(space, invItem.amount);
            if (!pileSlot) {
                pile.rareWoodPileStorage[targetIndex] = { id: invItem.id, amount };
            } else {
                pileSlot.amount += amount;
            }
            invItem.amount -= amount;
            if (invItem.amount <= 0) this.inventory.items[sourceIndex] = null;
            this.selectedPileInvSlot = null;
            this.inventory.notify();
            this._checkRareWoodPileSummon(pile);
        } else {
            const pileItem = pile.rareWoodPileStorage[sourceIndex];
            if (!pileItem) { this.selectedPileSlot = null; return; }
            const invSlot = this.inventory.items[targetIndex];
            if (invSlot && invSlot.id !== pileItem.id) {
                this.selectedPileSlot = null;
                return;
            }
            const info = ITEMS[pileItem.id];
            const maxStack = info?.maxStack || 99;
            if (invSlot && invSlot.amount >= maxStack) { this.selectedPileSlot = null; return; }
            const space = invSlot ? maxStack - invSlot.amount : maxStack;
            const amount = Math.min(space, pileItem.amount);
            if (!invSlot) {
                this.inventory.items[targetIndex] = { id: pileItem.id, amount };
            } else {
                invSlot.amount += amount;
            }
            pileItem.amount -= amount;
            if (pileItem.amount <= 0) pile.rareWoodPileStorage[sourceIndex] = null;
            this.selectedPileSlot = null;
            this.inventory.notify();
        }
    }

    _checkRareWoodPileSummon(pile) {
        const slot = pile.rareWoodPileStorage[0];
        if (slot && slot.id === 'wood' && slot.amount >= 99) {
            // 召唤树精
            const pos = pile.mesh.position.clone();
            const summonX = pos.x + (Math.random() - 0.5) * 4;
            const summonZ = pos.z + (Math.random() - 0.5) * 4;
            const summonY = this.world.getHeight(summonX, summonZ);
            // 移除稀有木堆
            this.world.removeBuilding(pile);
            this.activeRareWoodPile = null;
            document.getElementById('rareWoodPileUI').style.display = 'none';
            this.player.lockMouse();
            // 召唤树精boss（在金维度为金树精）
            if (window.game && window.game.enemies) {
                if (this.world.worldType === 'gold' && window.game.enemies._spawnGoldTreeSpirit) {
                    window.game.enemies._spawnGoldTreeSpirit(summonX, summonY, summonZ);
                    if (window.game.multiplayer && window.game.multiplayer.connected) {
                        window.game.multiplayer.sendBossSpawn('gold_tree_spirit', summonX, summonY, summonZ);
                        window.game.multiplayer.sendBuildingRemoved(pos.x, pos.y, pos.z);
                    }
                } else {
                    window.game.enemies._spawnTreeSpirit(summonX, summonY, summonZ);
                    if (window.game.multiplayer && window.game.multiplayer.connected) {
                        window.game.multiplayer.sendBossSpawn('tree_spirit', summonX, summonY, summonZ);
                        window.game.multiplayer.sendBuildingRemoved(pos.x, pos.y, pos.z);
                    }
                }
            }
        }
    }

    openAltar(altar) {
        this.activeAltar = altar;
        if (!Array.isArray(altar.altarStorage) || altar.altarStorage.length < 1) {
            altar.altarStorage = [null];
        }
        this.selectedAltarSlot = null;
        this.selectedAltarInvSlot = null;
        const panel = document.getElementById('altarUI');
        panel.style.display = 'block';
        this.player.unlockMouse();
        this._renderAltar();
    }

    _renderAltar() {
        if (!this.activeAltar) return;
        const storageGrid = document.getElementById('altarStorageGrid');
        const inventoryGrid = document.getElementById('altarInventoryGrid');

        storageGrid.innerHTML = '';
        for (let i = 0; i < 1; i++) {
            const item = this.activeAltar.altarStorage[i];
            const slot = document.createElement('div');
            slot.className = 'inv-slot' + (item ? '' : ' empty') + (this.selectedAltarSlot === i ? ' selected' : '');
            if (item) {
                const info = ITEMS[item.id];
                slot.innerHTML = `<span class="slot-icon">${itemIconSVG(item.id)}</span><span class="slot-count">${item.amount > 1 ? item.amount : ''}</span>`;
                slot.title = `${info?.name || item.id} x${item.amount}`;
            }
            slot.addEventListener('click', () => {
                if (this.selectedAltarInvSlot !== null) {
                    this._transferAltarItem('to_altar', this.selectedAltarInvSlot, i);
                } else if (this.selectedAltarSlot === i) {
                    this.selectedAltarSlot = null;
                } else {
                    this.selectedAltarSlot = i;
                    this.selectedAltarInvSlot = null;
                }
                this._renderAltar();
            });
            storageGrid.appendChild(slot);
        }

        inventoryGrid.innerHTML = '';
        for (let i = 0; i < this.inventory.items.length; i++) {
            const item = this.inventory.items[i];
            const slot = document.createElement('div');
            slot.className = 'inv-slot' + (item ? '' : ' empty') + (this.selectedAltarInvSlot === i ? ' selected' : '');
            if (item) {
                const info = ITEMS[item.id];
                slot.innerHTML = `<span class="slot-icon">${itemIconSVG(item.id)}</span><span class="slot-count">${item.amount > 1 ? item.amount : ''}</span>`;
                slot.title = `${info?.name || item.id} x${item.amount}`;
            }
            slot.addEventListener('click', () => {
                if (this.selectedAltarSlot !== null) {
                    this._transferAltarItem('to_inv', this.selectedAltarSlot, i);
                } else if (this.selectedAltarInvSlot === i) {
                    this.selectedAltarInvSlot = null;
                } else {
                    this.selectedAltarInvSlot = i;
                    this.selectedAltarSlot = null;
                }
                this._renderAltar();
            });
            inventoryGrid.appendChild(slot);
        }
    }

    _transferAltarItem(direction, sourceIndex, targetIndex) {
        const altar = this.activeAltar;
        if (!altar) return;
        if (direction === 'to_altar') {
            const invItem = this.inventory.items[sourceIndex];
            if (!invItem) { this.selectedAltarInvSlot = null; return; }
            const altarSlot = altar.altarStorage[targetIndex];
            if (altarSlot && altarSlot.id !== invItem.id) {
                this.selectedAltarInvSlot = null;
                return;
            }
            const info = ITEMS[invItem.id];
            const maxStack = info?.maxStack || 99;
            const space = altarSlot ? maxStack - altarSlot.amount : maxStack;
            const amount = Math.min(space, invItem.amount);
            if (!altarSlot) {
                altar.altarStorage[targetIndex] = { id: invItem.id, amount };
            } else {
                altarSlot.amount += amount;
            }
            invItem.amount -= amount;
            if (invItem.amount <= 0) this.inventory.items[sourceIndex] = null;
            this.selectedAltarInvSlot = null;
            this.inventory.notify();
            this._checkAltarSummon(altar);
        } else {
            const altarItem = altar.altarStorage[sourceIndex];
            if (!altarItem) { this.selectedAltarSlot = null; return; }
            const invSlot = this.inventory.items[targetIndex];
            if (invSlot && invSlot.id !== altarItem.id) {
                this.selectedAltarSlot = null;
                return;
            }
            const info = ITEMS[altarItem.id];
            const maxStack = info?.maxStack || 99;
            const space = invSlot ? maxStack - invSlot.amount : maxStack;
            const amount = Math.min(space, altarItem.amount);
            if (!invSlot) {
                this.inventory.items[targetIndex] = { id: altarItem.id, amount };
            } else {
                invSlot.amount += amount;
            }
            altarItem.amount -= amount;
            if (altarItem.amount <= 0) altar.altarStorage[sourceIndex] = null;
            this.selectedAltarSlot = null;
            this.inventory.notify();
        }
    }

    _checkAltarSummon(altar) {
        const slot = altar.altarStorage[0];
        if (slot && slot.id === 'wood' && slot.amount >= 99) {
            // 检查是否已有树精
            if (window.game && window.game.enemies) {
                const existing = window.game.enemies.enemies.filter(e => !e.dead && e.enemyType === 'tree_spirit').length;
                if (existing > 0) {
                    if (window.game) window.game.onMessage('已有树精存在，无法再次召唤！');
                    return;
                }
            }
            // 消耗99个木材
            slot.amount -= 99;
            if (slot.amount <= 0) altar.altarStorage[0] = null;
            // 召唤树精（祭坛不消失）
            const pos = altar.mesh.position.clone();
            const summonX = pos.x + (Math.random() - 0.5) * 4;
            const summonZ = pos.z + (Math.random() - 0.5) * 4;
            const summonY = this.world.getHeight(summonX, summonZ);
            this.activeAltar = null;
            document.getElementById('altarUI').style.display = 'none';
            this.player.lockMouse();
            if (window.game && window.game.enemies) {
                window.game.enemies._spawnTreeSpirit(summonX, summonY, summonZ);
                if (window.game) window.game.onMessage('树精被召唤了！');
            }
        }
        if (slot && slot.id === 'rare_stone' && slot.amount >= 5) {
            // 检查是否已有石志怪
            if (window.game && window.game.enemies) {
                const existing = window.game.enemies.enemies.filter(e => !e.dead && e.enemyType === 'stone_monster_boss').length;
                if (existing > 0) {
                    if (window.game) window.game.onMessage('已有石志怪存在，无法再次召唤！');
                    return;
                }
            }
            // 消耗5个稀有石头
            slot.amount -= 5;
            if (slot.amount <= 0) altar.altarStorage[0] = null;
            // 召唤石志怪（祭坛不消失）
            const pos = altar.mesh.position.clone();
            const summonX = pos.x + (Math.random() - 0.5) * 4;
            const summonZ = pos.z + (Math.random() - 0.5) * 4;
            const summonY = this.world.getHeight(summonX, summonZ);
            this.activeAltar = null;
            document.getElementById('altarUI').style.display = 'none';
            this.player.lockMouse();
            if (window.game && window.game.enemies) {
                window.game.enemies._spawnStoneMonsterBoss(summonX, summonY, summonZ);
                if (window.game) window.game.onMessage('石志怪被召唤了！');
                // 同步Boss召唤到多人游戏
                if (window.game.multiplayer && window.game.multiplayer.connected) {
                    window.game.multiplayer.sendBossSpawn('stone_monster_boss', summonX, summonY, summonZ);
                }
            }
        }
        if (slot && slot.id === 'super_stone' && slot.amount >= 10) {
            // 检查是否已有巨石怪
            if (window.game && window.game.enemies) {
                const existing = window.game.enemies.enemies.filter(e => !e.dead && e.enemyType === 'giant_stone_boss').length;
                if (existing > 0) {
                    if (window.game) window.game.onMessage('已有巨石怪存在，无法再次召唤！');
                    return;
                }
            }
            // 消耗10个超级石头
            slot.amount -= 10;
            if (slot.amount <= 0) altar.altarStorage[0] = null;
            // 召唤巨石怪（祭坛不消失）
            const pos = altar.mesh.position.clone();
            const summonX = pos.x + (Math.random() - 0.5) * 4;
            const summonZ = pos.z + (Math.random() - 0.5) * 4;
            const summonY = this.world.getHeight(summonX, summonZ);
            this.activeAltar = null;
            document.getElementById('altarUI').style.display = 'none';
            this.player.lockMouse();
            if (window.game && window.game.enemies) {
                window.game.enemies._spawnGiantStoneBoss(summonX, summonY, summonZ);
                if (window.game) window.game.onMessage('巨石怪被召唤了！');
                // 同步Boss召唤到多人游戏
                if (window.game.multiplayer && window.game.multiplayer.connected) {
                    window.game.multiplayer.sendBossSpawn('giant_stone_boss', summonX, summonY, summonZ);
                }
            }
        }
        if (slot && slot.id === 'gold' && slot.amount >= 5) {
            // 检查是否已有金僵尸
            if (window.game && window.game.enemies) {
                const existing = window.game.enemies.enemies.filter(e => !e.dead && e.enemyType === 'gold_zombie').length;
                if (existing > 0) {
                    if (window.game) window.game.onMessage('已有金僵尸存在，无法再次召唤！');
                    return;
                }
            }
            // 消耗5个黄金
            slot.amount -= 5;
            if (slot.amount <= 0) altar.altarStorage[0] = null;
            // 召唤金僵尸（祭坛不消失）
            const pos = altar.mesh.position.clone();
            const summonX = pos.x + (Math.random() - 0.5) * 4;
            const summonZ = pos.z + (Math.random() - 0.5) * 4;
            const summonY = this.world.getHeight(summonX, summonZ);
            this.activeAltar = null;
            document.getElementById('altarUI').style.display = 'none';
            this.player.lockMouse();
            if (window.game && window.game.enemies) {
                window.game.enemies._spawnGoldZombie(summonX, summonY, summonZ);
                if (window.game) window.game.onMessage('金僵尸被召唤了！');
                // 同步Boss召唤到多人游戏
                if (window.game.multiplayer && window.game.multiplayer.connected) {
                    window.game.multiplayer.sendBossSpawn('gold_zombie', summonX, summonY, summonZ);
                }
            }
        }
    }

    openGoldAltar(altar) {
        this.activeGoldAltar = altar;
        if (!Array.isArray(altar.goldAltarStorage) || altar.goldAltarStorage.length < 5) {
            altar.goldAltarStorage = [null, null, null, null, null];
        }
        this.selectedGoldAltarSlot = null;
        this.selectedGoldAltarInvSlot = null;
        const panel = document.getElementById('goldAltarUI');
        panel.style.display = 'block';
        this.player.unlockMouse();
        this._renderGoldAltar();
    }

    _renderGoldAltar() {
        if (!this.activeGoldAltar) return;
        const teleportGrid = document.getElementById('goldAltarTeleportGrid');
        const bossGrid = document.getElementById('goldAltarBossGrid');
        const inventoryGrid = document.getElementById('goldAltarInventoryGrid');

        const makeSlot = (i) => {
            const item = this.activeGoldAltar.goldAltarStorage[i];
            const slot = document.createElement('div');
            slot.className = 'inv-slot' + (item ? '' : ' empty') + (this.selectedGoldAltarSlot === i ? ' selected' : '');
            if (item) {
                const info = ITEMS[item.id];
                slot.innerHTML = `<span class="slot-icon">${itemIconSVG(item.id)}</span><span class="slot-count">${item.amount > 1 ? item.amount : ''}</span>`;
                slot.title = `${info?.name || item.id} x${item.amount}`;
            }
            slot.addEventListener('click', () => {
                if (this.selectedGoldAltarInvSlot !== null) {
                    this._transferGoldAltarItem('to_altar', this.selectedGoldAltarInvSlot, i);
                } else if (this.selectedGoldAltarSlot === i) {
                    this.selectedGoldAltarSlot = null;
                } else {
                    this.selectedGoldAltarSlot = i;
                    this.selectedGoldAltarInvSlot = null;
                }
                this._renderGoldAltar();
            });
            return slot;
        };

        teleportGrid.innerHTML = '';
        for (let i = 0; i < 2; i++) teleportGrid.appendChild(makeSlot(i));

        bossGrid.innerHTML = '';
        for (let i = 2; i < 5; i++) bossGrid.appendChild(makeSlot(i));

        inventoryGrid.innerHTML = '';
        for (let i = 0; i < this.inventory.items.length; i++) {
            const item = this.inventory.items[i];
            const slot = document.createElement('div');
            slot.className = 'inv-slot' + (item ? '' : ' empty') + (this.selectedGoldAltarInvSlot === i ? ' selected' : '');
            if (item) {
                const info = ITEMS[item.id];
                slot.innerHTML = `<span class="slot-icon">${itemIconSVG(item.id)}</span><span class="slot-count">${item.amount > 1 ? item.amount : ''}</span>`;
                slot.title = `${info?.name || item.id} x${item.amount}`;
            }
            slot.addEventListener('click', () => {
                if (this.selectedGoldAltarSlot !== null) {
                    this._transferGoldAltarItem('to_inv', this.selectedGoldAltarSlot, i);
                } else if (this.selectedGoldAltarInvSlot === i) {
                    this.selectedGoldAltarInvSlot = null;
                } else {
                    this.selectedGoldAltarInvSlot = i;
                    this.selectedGoldAltarSlot = null;
                }
                this._renderGoldAltar();
            });
            inventoryGrid.appendChild(slot);
        }
    }

    _transferGoldAltarItem(direction, sourceIndex, targetIndex) {
        const altar = this.activeGoldAltar;
        if (!altar) return;
        if (direction === 'to_altar') {
            const invItem = this.inventory.items[sourceIndex];
            if (!invItem) { this.selectedGoldAltarInvSlot = null; return; }
            const altarSlot = altar.goldAltarStorage[targetIndex];
            if (altarSlot && altarSlot.id !== invItem.id) {
                this.selectedGoldAltarInvSlot = null;
                return;
            }
            const info = ITEMS[invItem.id];
            const maxStack = info?.maxStack || 99;
            const space = altarSlot ? maxStack - altarSlot.amount : maxStack;
            const amount = Math.min(space, invItem.amount);
            if (!altarSlot) {
                altar.goldAltarStorage[targetIndex] = { id: invItem.id, amount };
            } else {
                altarSlot.amount += amount;
            }
            invItem.amount -= amount;
            if (invItem.amount <= 0) this.inventory.items[sourceIndex] = null;
            this.selectedGoldAltarInvSlot = null;
            this.inventory.notify();
            this._checkGoldAltarSacrifice(altar);
        } else {
            const altarItem = altar.goldAltarStorage[sourceIndex];
            if (!altarItem) { this.selectedGoldAltarSlot = null; return; }
            const invSlot = this.inventory.items[targetIndex];
            if (invSlot && invSlot.id !== altarItem.id) {
                this.selectedGoldAltarSlot = null;
                return;
            }
            const info = ITEMS[altarItem.id];
            const maxStack = info?.maxStack || 99;
            const space = invSlot ? maxStack - invSlot.amount : maxStack;
            const amount = Math.min(space, altarItem.amount);
            if (!invSlot) {
                this.inventory.items[targetIndex] = { id: altarItem.id, amount };
            } else {
                invSlot.amount += amount;
            }
            altarItem.amount -= amount;
            if (altarItem.amount <= 0) altar.goldAltarStorage[sourceIndex] = null;
            this.selectedGoldAltarSlot = null;
            this.inventory.notify();
        }
    }

    _checkGoldAltarSacrifice(altar) {
        // 检查传送格子(0-1)：一个放黄金(gold)>=3，一个放金矿(gold_ore)>=1
        const s0 = altar.goldAltarStorage[0];
        const s1 = altar.goldAltarStorage[1];
        let goldSlot = null, oreSlot = null;
        if (s0 && s0.id === 'gold' && s0.amount >= 3) goldSlot = 0;
        if (s1 && s1.id === 'gold' && s1.amount >= 3) goldSlot = 1;
        if (s0 && s0.id === 'gold_ore' && s0.amount >= 1) oreSlot = 0;
        if (s1 && s1.id === 'gold_ore' && s1.amount >= 1) oreSlot = 1;
        if (goldSlot !== null && oreSlot !== null && goldSlot !== oreSlot) {
            // 消耗3个黄金和1个金矿
            altar.goldAltarStorage[goldSlot].amount -= 3;
            if (altar.goldAltarStorage[goldSlot].amount <= 0) altar.goldAltarStorage[goldSlot] = null;
            altar.goldAltarStorage[oreSlot].amount -= 1;
            if (altar.goldAltarStorage[oreSlot].amount <= 0) altar.goldAltarStorage[oreSlot] = null;
            // 关闭UI
            this.activeGoldAltar = null;
            document.getElementById('goldAltarUI').style.display = 'none';
            this.player.lockMouse();
            // 传送到金维度
            this.world.switchToWorld('gold', this.player.position);
            this.player.position.set(0, 5, 0);
            if (window.game) window.game.onMessage('🌟 献祭成功！传送到了金维度！');
            return;
        }

        // 检查Boss召唤格子(2-4)：高级木材+石之心+神木
        const b0 = altar.goldAltarStorage[2];
        const b1 = altar.goldAltarStorage[3];
        const b2 = altar.goldAltarStorage[4];
        let hasHighWood = false, hasHeartOfStone = false, hasDivineWood = false;
        if (b0 && b0.id === 'high_wood' && b0.amount >= 1) hasHighWood = true;
        if (b1 && b1.id === 'heart_of_stone' && b1.amount >= 1) hasHeartOfStone = true;
        if (b2 && b2.id === 'divine_wood' && b2.amount >= 1) hasDivineWood = true;
        // 也检查交叉放置
        const bossSlots = [b0, b1, b2];
        for (const s of bossSlots) {
            if (s && s.id === 'high_wood' && s.amount >= 1) hasHighWood = true;
            if (s && s.id === 'heart_of_stone' && s.amount >= 1) hasHeartOfStone = true;
            if (s && s.id === 'divine_wood' && s.amount >= 1) hasDivineWood = true;
        }
        if (hasHighWood && hasHeartOfStone && hasDivineWood) {
            // 检查是否已有元素王
            if (window.game && window.game.enemies) {
                const existing = window.game.enemies.enemies.filter(e => !e.dead && e.enemyType === 'element_king').length;
                if (existing > 0) {
                    if (window.game) window.game.onMessage('已有元素王存在，无法再次召唤！');
                    return;
                }
            }
            // 消耗材料
            for (let i = 2; i < 5; i++) {
                const s = altar.goldAltarStorage[i];
                if (s && (s.id === 'high_wood' || s.id === 'heart_of_stone' || s.id === 'divine_wood')) {
                    s.amount -= 1;
                    if (s.amount <= 0) altar.goldAltarStorage[i] = null;
                }
            }
            // 召唤元素王
            const pos = altar.mesh.position.clone();
            const summonX = pos.x + (Math.random() - 0.5) * 4;
            const summonZ = pos.z + (Math.random() - 0.5) * 4;
            const summonY = this.world.getHeight(summonX, summonZ);
            this.activeGoldAltar = null;
            document.getElementById('goldAltarUI').style.display = 'none';
            this.player.lockMouse();
            if (window.game && window.game.enemies) {
                window.game.enemies._spawnElementKing(summonX, summonY, summonZ);
                if (window.game) window.game.onMessage('👑 元素王被召唤了！');
                if (window.game.multiplayer && window.game.multiplayer.connected) {
                    window.game.multiplayer.sendBossSpawn('element_king', summonX, summonY, summonZ);
                }
            }
        }
    }

    openMiner(miner) {
        this.activeMiner = miner;
        if (!Array.isArray(this.activeMiner.minerTools)) {
            this.activeMiner.minerTools = [null, null, null];
        } else if (this.activeMiner.minerTools.length < 3) {
            this.activeMiner.minerTools.length = 3;
            while (this.activeMiner.minerTools.length < 3) this.activeMiner.minerTools.push(null);
        }
        this.selectedMinerSlot = null;
        const panel = document.getElementById('minerUI');
        panel.style.display = 'block';
        this.player.unlockMouse();
        this._renderMiner();
    }

    _renderMiner() {
        if (!this.activeMiner) return;
        const storageGrid = document.getElementById('minerStorageGrid');
        const inventoryGrid = document.getElementById('minerInventoryGrid');
        const status = document.getElementById('minerStatus');
        const cycleTime = this.world.getMinerCycleTime(this.activeMiner);
        const remaining = Math.max(0, cycleTime - this.activeMiner.minerTimer);
        status.textContent = `下次产出：${Math.ceil(remaining)}秒 | 当前周期：${cycleTime}秒 | 当前存储：${this.activeMiner.minerStorage.reduce((sum, item) => sum + item.amount, 0)}个`;

        const toolGrid = document.getElementById('minerToolGrid');
        toolGrid.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            const tool = (this.activeMiner.minerTools || [null, null, null])[i];
            const slot = document.createElement('div');
            slot.className = 'inv-slot miner-tool-slot' + (tool ? '' : ' empty') + (this.selectedMinerToolSlot === i ? ' selected' : '');
            if (tool) {
                const info = ITEMS[tool.id];
                slot.innerHTML = `<span class="slot-icon">${itemIconSVG(tool.id)}</span>`;
                slot.title = `${info?.name || tool.id}（点击取出）`;
            } else {
                slot.title = '放入木镐、石镐、铁镐、钻头或钢镐';
            }
            slot.addEventListener('click', () => {
                this.selectedMinerToolSlot = this.selectedMinerToolSlot === i ? null : i;
                this.selectedMinerSlot = null;
                this._renderMiner();
            });
            toolGrid.appendChild(slot);
        }

        storageGrid.innerHTML = '';
        for (let i = 0; i < 6; i++) {
            const item = this.activeMiner.minerStorage[i];
            const slot = document.createElement('div');
            slot.className = 'inv-slot' + (item ? '' : ' empty');
            if (item) {
                const info = ITEMS[item.id];
                slot.innerHTML = `<span class="slot-icon">${itemIconSVG(item.id)}</span><span class="slot-count">${item.amount}</span>`;
                slot.title = `${info?.name || item.id} x${item.amount}`;
                slot.addEventListener('click', () => {
                    this.selectedMinerSlot = i;
                    document.querySelectorAll('#minerStorageGrid .inv-slot').forEach(el => el.classList.remove('selected'));
                    slot.classList.add('selected');
                });
            }
            storageGrid.appendChild(slot);
        }

        inventoryGrid.innerHTML = '';
        for (let i = 0; i < this.inventory.size; i++) {
            const item = this.inventory.items[i];
            const slot = document.createElement('div');
            slot.className = 'inv-slot' + (item ? '' : ' empty');
            if (item) {
                const info = ITEMS[item.id];
                slot.innerHTML = `<span class="slot-icon">${itemIconSVG(item.id)}</span><span class="slot-count">${item.amount > 1 ? item.amount : ''}</span>`;
                slot.title = `${info?.name || item.id} x${item.amount}`;
            }
            slot.addEventListener('click', () => this._takeMinerOre(i));
            inventoryGrid.appendChild(slot);
        }
    }

    _takeMinerOre(inventorySlot) {
        if (!this.activeMiner) return;

        if (this.selectedMinerToolSlot !== null) {
            const selectedToolSlot = this.selectedMinerToolSlot;
            const currentTool = (this.activeMiner.minerTools || [null, null, null])[selectedToolSlot];
            const inventoryItem = this.inventory.items[inventorySlot];
            if (currentTool) {
                if (!this._putItemInInventory(currentTool)) return;
                this.activeMiner.minerTools[selectedToolSlot] = null;
            }
            if (inventoryItem && ['wood_pickaxe', 'stone_pickaxe', 'iron_pickaxe', 'drill', 'steel_pickaxe', 'ultimate_pickaxe', 'certain_one'].includes(inventoryItem.id)) {
                this.activeMiner.minerTools[selectedToolSlot] = { id: inventoryItem.id, amount: 1 };
                this.inventory.removeItem(inventoryItem.id, 1);
            }
            this.selectedMinerToolSlot = null;
            this.inventory.notify();
            this._renderMiner();
            return;
        }

        if (this.selectedMinerSlot === null) return;
        const source = this.activeMiner.minerStorage[this.selectedMinerSlot];
        if (!source) return;
        const target = this.inventory.items[inventorySlot];
        const info = ITEMS[source.id];
        const maxStack = info.maxStack || 99;
        if (target && target.id !== source.id) return;
        if (target && target.amount >= maxStack) return;
        const space = target ? maxStack - target.amount : maxStack;
        const amount = Math.min(space, source.amount);
        if (!target) this.inventory.items[inventorySlot] = { id: source.id, amount };
        else target.amount += amount;
        source.amount -= amount;
        if (source.amount <= 0) this.activeMiner.minerStorage.splice(this.selectedMinerSlot, 1);
        this.selectedMinerSlot = null;
        this.inventory.notify();
        this._renderMiner();
    }

    _renderInventory() {
        const grid = document.getElementById('inventoryGrid');
        const hotbar = document.getElementById('inventoryHotbar');
        grid.innerHTML = '';
        if (hotbar) hotbar.innerHTML = '';
        this.selectedInvSlot = null;
        for (let i = 0; i < this.inventory.size; i++) {
            const target = i < this.inventory.hotbarSize ? hotbar : grid; // 0-8物品栏，9-24背包
            if (target) target.appendChild(this._buildInvSlot(i));
        }
        this._renderEquipment();
    }

    // 背包/物品栏通用格子：点选-再点交换、拖拽交换、右键装备
    _buildInvSlot(i) {
        const item = this.inventory.items[i];
        const slot = document.createElement('div');
        slot.className = 'inv-slot' + (item ? '' : ' empty');
        slot.dataset.invIdx = i;
        if (item) {
            const info = ITEMS[item.id];
            slot.innerHTML = `<span class="slot-icon">${itemIconSVG(item.id)}</span><span class="slot-count">${item.amount > 1 ? item.amount : ''}</span>`;
            slot.title = `${info?.name || item.id} x${item.amount}`;
            slot.draggable = true;
        }
        const doEquip = (e) => {
            if (item && ITEMS[item.id] && ITEMS[item.id].equipable) {
                const equipSlot = ITEMS[item.id].equip_slot;
                this.inventory.equipItem(i);
                this._syncArmor();
                if (equipSlot === 'talisman') this._syncTalismans();
                this._renderEquipment();
                this._renderInventory();
            }
            if (e) { e.stopPropagation(); e.preventDefault(); }
        };
        const doSelectOrSwap = (e) => {
            if (this.selectedInvSlot === null) {
                if (!item) return; // 空格不可选中
                this.selectedInvSlot = i;
                this._highlightSlot(slot);
            } else if (this.selectedInvSlot === i) {
                this.selectedInvSlot = null;
                this._clearHighlight();
            } else {
                this.inventory.moveItem(this.selectedInvSlot, i); // 交换/堆叠
                this.selectedInvSlot = null;
                this._clearHighlight();
                this._renderInventory();
            }
            if (e) { e.stopPropagation(); e.preventDefault(); }
        };
        let touchHandled = false;
        slot.addEventListener('click', (e) => {
            if (touchHandled) { touchHandled = false; return; }
            doSelectOrSwap(e);
        });
        slot.addEventListener('touchstart', (e) => { touchHandled = true; doSelectOrSwap(e); }, { passive: false });
        slot.addEventListener('contextmenu', doEquip);
        // 拖拽：起点记录槽位，落点执行交换（空格也可作落点）
        slot.addEventListener('dragstart', (e) => {
            this.selectedInvSlot = i;
            e.dataTransfer.setData('text/plain', String(i));
            e.dataTransfer.effectAllowed = 'move';
            this._highlightSlot(slot);
        });
        slot.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
        slot.addEventListener('drop', (e) => {
            e.preventDefault(); e.stopPropagation();
            const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
            if (!isNaN(from) && from !== i) {
                this.inventory.moveItem(from, i);
                this.selectedInvSlot = null;
                this._clearHighlight();
                this._renderInventory();
            }
        });
        slot.addEventListener('dragend', () => {
            this.selectedInvSlot = null;
            this._clearHighlight();
        });
        return slot;
    }

    _renderEquipment() {
        const slots = document.querySelectorAll('.equip-slot');
        slots.forEach(slotEl => {
            const equipSlot = slotEl.dataset.equipSlot;
            const item = this.inventory.equipment[equipSlot];
            const iconEl = slotEl.querySelector('.slot-icon');
            if (item) {
                iconEl.innerHTML = itemIconSVG(item.id);
                slotEl.classList.remove('empty');
                const info = ITEMS[item.id];
                slotEl.title = `${info?.name || item.id}（点击卸下）`;
            } else {
                iconEl.innerHTML = '';
                slotEl.classList.add('empty');
                const labels = { head: '头盔', chest: '胸甲', legs: '护腿', feet: '靴子', talisman1: '护身符1', talisman2: '护身符2', talisman3: '护身符3', talisman4: '护身符4' };
                slotEl.title = labels[equipSlot] || equipSlot;
            }
        });
        const armorEl = document.getElementById('armorValue');
        if (armorEl) armorEl.textContent = this.inventory.getArmorValue();
    }

    _syncArmor() {
        if (this.survival) {
            this.survival.setArmor(this.inventory.getArmorValue());
        }
    }

    _syncTalismans() {
        if (this.survival) {
            const talismans = ['talisman1', 'talisman2', 'talisman3', 'talisman4']
                .map(s => this.inventory.equipment[s])
                .filter(Boolean);
            this.survival.setTalismans(talismans);
        }
    }

    _showEquipmentSelector(equipSlot) {
        const slotNames = { head: '头盔', chest: '胸甲', legs: '护腿', feet: '靴子', talisman1: '护身符1', talisman2: '护身符2', talisman3: '护身符3', talisman4: '护身符4' };
        const slotName = slotNames[equipSlot];
        
        const filterSlot = equipSlot.startsWith('talisman') ? 'talisman' : equipSlot;
        const candidates = [];
        for (let i = 0; i < this.inventory.size; i++) {
            const item = this.inventory.items[i];
            if (item && ITEMS[item.id] && ITEMS[item.id].equip_slot === filterSlot) {
                candidates.push({ index: i, id: item.id, amount: item.amount });
            }
        }
        
        if (candidates.length === 0) {
            window.game.onMessage(`背包中没有${slotName}`);
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'equip-selector-modal';
        modal.innerHTML = `
            <div class="equip-selector-content">
                <div class="selector-header">选择${slotName}</div>
                <div class="selector-items">
                    ${candidates.map(c => `
                        <div class="selector-item" data-index="${c.index}">
                            <span class="selector-icon">${itemIconSVG(c.id)}</span>
                            <span class="selector-name">${ITEMS[c.id].name}</span>
                        </div>
                    `).join('')}
                </div>
                <button class="selector-close">关闭</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelectorAll('.selector-item').forEach(item => {
            item.addEventListener('click', () => {
                const index = parseInt(item.dataset.index);
                const equipSlot = ITEMS[this.inventory.items[index].id].equip_slot;
                this.inventory.equipItem(index);
                this._syncArmor();
                if (equipSlot === 'talisman') this._syncTalismans();
                this._renderEquipment();
                this._renderInventory();
                modal.remove();
            });
        });
        
        modal.querySelector('.selector-close').addEventListener('click', () => {
            modal.remove();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
    }

    _putItemInInventory(item) {
        const existing = this.inventory.items.find(slot => slot && slot.id === item.id);
        const info = ITEMS[item.id];
        if (existing && existing.amount < (info.maxStack || 99)) {
            existing.amount += item.amount || 1;
            return true;
        }
        const emptyIndex = this.inventory.items.findIndex(slot => !slot);
        if (emptyIndex < 0) return false;
        this.inventory.items[emptyIndex] = { id: item.id, amount: item.amount || 1 };
        return true;
    }

    _highlightSlot(slotEl) {
        this._clearHighlight();
        if (slotEl) slotEl.classList.add('selected');
    }

    _clearHighlight() {
        document.querySelectorAll('.inv-slot.selected, .hotbar-slot.selected').forEach(s => s.classList.remove('selected'));
    }

    _renderCrafting() {
        const list = document.getElementById('craftingList');
        list.innerHTML = '';
        const nearCampfire = this.world.isNearCampfire(this.player.position);
        const nearBookshelf = this.world.isNearBookshelf(this.player.position);
        const nearForge = this.world.isNearForge(this.player.position);

        for (const [id, recipe] of Object.entries(RECIPES)) {
            if (this.currentCraftCat !== 'all' && recipe.cat !== this.currentCraftCat) continue;
            if (recipe.requires_ultimate_bookshelf) continue;
            // 不需要书架的配方（火把、知识书架）随时可合成
            // 需要书架的配方必须靠近书架
            if (recipe.requires_bookshelf && !nearBookshelf) continue;
            if (recipe.requires_forge && !nearForge) continue;

            const canCraft = this._canCraft(recipe, nearCampfire, nearBookshelf, nearForge);
            const div = document.createElement('div');
            div.className = 'recipe-item ' + (canCraft ? 'can-craft' : 'cant-craft');

            const outputInfo = ITEMS[recipe.output];
            const ingredientsHtml = Object.entries(recipe.ingredients).map(([k, v]) => {
                const have = this.inventory.getItemCount(k);
                const cls = have >= v ? 'has' : 'need';
                return `<span class="${cls}"><span class="ingredient-icon">${itemIconSVG(k)}</span>${ITEMS[k]?.name || k} ${have}/${v}</span>`;
            }).join('  ');

            let extra = '';
            if (recipe.requires_campfire) {
                extra += ` <span class="${nearCampfire ? 'has' : 'need'}">需要篝火 ${nearCampfire ? '✓' : '✗'}</span>`;
            }
            if (recipe.requires_forge) {
                extra += ` <span class="${nearForge ? 'has' : 'need'}">需要锻造台 ${nearForge ? '✓' : '✗'}</span>`;
            }

            div.innerHTML = `
                <div class="recipe-icon">${itemIconSVG(recipe.output)}</div>
                <div class="recipe-info">
                    <div class="recipe-name">${recipe.name} ${recipe.count > 1 ? `x${recipe.count}` : ''}</div>
                    <div class="recipe-ingredients">${ingredientsHtml}${extra}</div>
                </div>
                <button class="btn-craft" ${canCraft ? '' : 'disabled'}>合成</button>
            `;
            div.querySelector('.btn-craft').addEventListener('click', () => {
                this._craft(id, recipe);
            });
            list.appendChild(div);
        }
    }

    _canCraft(recipe, nearCampfire, nearBookshelf, nearForge) {
        if (recipe.requires_campfire && !nearCampfire) return false;
        if (recipe.requires_bookshelf && !nearBookshelf) return false;
        if (recipe.requires_forge && !nearForge) return false;
        for (const [k, v] of Object.entries(recipe.ingredients)) {
            if (!this.inventory.hasItem(k, v)) return false;
        }
        return true;
    }

    _craft(id, recipe) {
        const nearCampfire = this.world.isNearCampfire(this.player.position);
        const nearBookshelf = this.world.isNearBookshelf(this.player.position);
        const nearForge = this.world.isNearForge(this.player.position);
        if (!this._canCraft(recipe, nearCampfire, nearBookshelf, nearForge)) return;
        for (const [k, v] of Object.entries(recipe.ingredients)) {
            this.inventory.removeItem(k, v);
        }
        this.inventory.addItem(recipe.output, recipe.count);
        this.game.onMessage(`合成成功: ${ITEMS[recipe.output]?.name} x${recipe.count}`);
        // 成就：做出知识书架
        if (recipe.output === 'knowledge_bookshelf') {
            console.log('[成就] 知识书架合成, calling unlockAchievement');
            this.game.unlockAchievement('knowledge');
        }
        // 成就：合成自动挖矿器
        if (recipe.output === 'auto_miner') {
            this.game.unlockAchievement('auto_miner');
        }
        this._renderCrafting();
        this._renderInventory();
    }

    openUltimateBookshelf(bookshelf) {
        this.activeUltimateBookshelf = bookshelf;
        const panel = document.getElementById('ultimateBookshelfUI');
        panel.style.display = 'block';
        this.player.unlockMouse();
        this._renderUltimateBookshelf();
    }

    _renderUltimateBookshelf() {
        const list = document.getElementById('ultimateBookshelfList');
        list.innerHTML = '';
        for (const [id, recipe] of Object.entries(RECIPES)) {
            if (!recipe.requires_ultimate_bookshelf) continue;
            const canCraft = this._canUltimateCraft(recipe);
            const div = document.createElement('div');
            div.className = 'recipe-item ' + (canCraft ? 'can-craft' : 'cant-craft');
            const outputInfo = ITEMS[recipe.output];
            const ingredientsHtml = Object.entries(recipe.ingredients).map(([k, v]) => {
                const have = this.inventory.getItemCount(k);
                const cls = have >= v ? 'has' : 'need';
                return `<span class="${cls}"><span class="ingredient-icon">${itemIconSVG(k)}</span>${ITEMS[k]?.name || k} ${have}/${v}</span>`;
            }).join('  ');
            div.innerHTML = `
                <div class="recipe-icon">${itemIconSVG(recipe.output)}</div>
                <div class="recipe-info">
                    <div class="recipe-name">${recipe.name} ${recipe.count > 1 ? `x${recipe.count}` : ''}</div>
                    <div class="recipe-ingredients">${ingredientsHtml}</div>
                </div>
                <button class="btn-craft" ${canCraft ? '' : 'disabled'}>合成</button>
            `;
            div.querySelector('.btn-craft').addEventListener('click', () => {
                this._ultimateCraft(id, recipe);
            });
            list.appendChild(div);
        }
    }

    _canUltimateCraft(recipe) {
        for (const [k, v] of Object.entries(recipe.ingredients)) {
            if (!this.inventory.hasItem(k, v)) return false;
        }
        return true;
    }

    _ultimateCraft(id, recipe) {
        if (!this._canUltimateCraft(recipe)) return;
        for (const [k, v] of Object.entries(recipe.ingredients)) {
            this.inventory.removeItem(k, v);
        }
        this.inventory.addItem(recipe.output, recipe.count);
        this.game.onMessage(`合成成功: ${ITEMS[recipe.output]?.name} x${recipe.count}`);
        this._renderUltimateBookshelf();
        this._renderInventory();
    }

    openMonumentNaming(building) {
        this.activeMonument = building;
        const panel = document.getElementById('monumentUI');
        panel.style.display = 'block';
        this.player.unlockMouse();
        const input = document.getElementById('monumentNameInput');
        const current = document.getElementById('monumentCurrentName');
        if (building.monumentName) {
            input.value = building.monumentName;
            current.textContent = '当前名称: ' + building.monumentName;
        } else {
            input.value = '';
            current.textContent = '尚未命名';
        }
        input.focus();
    }

    _closeMonumentNaming() {
        document.getElementById('monumentUI').style.display = 'none';
        this.activeMonument = null;
        if (this.player && this.game.running) this.player.lockMouse();
    }

    _confirmMonumentName() {
        if (!this.activeMonument) return;
        const input = document.getElementById('monumentNameInput');
        const name = input.value.trim();
        if (!name) {
            this.showMessage('请输入石碑名称');
            return;
        }
        // 检查重名（排除自己）
        for (const b of this.game.world.buildings) {
            if (b !== this.activeMonument && b.type === 'teleport_monument' && b.monumentName === name) {
                this.showMessage('已存在同名石碑，请换一个名称');
                return;
            }
        }
        // 检查另一个维度的建筑
        const otherBldgs = this.game.world.worldType === 'normal'
            ? (this.game.world._stoneBuildings || [])
            : (this.game.world._normalBuildings || []);
        for (const b of otherBldgs) {
            if (b.type === 'teleport_monument' && b.monumentName === name) {
                this.showMessage('已存在同名石碑，请换一个名称');
                return;
            }
        }
        this.activeMonument.monumentName = name;
        this.game.onMessage('石碑已命名: ' + name);
        this._closeMonumentNaming();
    }

    _teleportToMonument(name) {
        // 在当前维度查找
        let target = null;
        let targetWorld = null;
        for (const b of this.game.world.buildings) {
            if (b.type === 'teleport_monument' && b.monumentName === name) {
                target = b;
                targetWorld = this.game.world.worldType;
                break;
            }
        }
        // 当前维度没找到，搜索其他维度的建筑
        if (!target) {
            const otherBuildingsLists = [
                { list: this.game.world._normalBuildings, world: 'normal' },
                { list: this.game.world._stoneBuildings, world: 'stone' },
                { list: this.game.world._goldBuildings, world: 'gold' },
            ];
            for (const entry of otherBuildingsLists) {
                if (!entry.list || entry.world === this.game.world.worldType) continue;
                for (const b of entry.list) {
                    if (b.type === 'teleport_monument' && b.monumentName === name) {
                        target = b;
                        targetWorld = entry.world;
                        break;
                    }
                }
                if (target) break;
            }
        }
        if (target) {
            if (targetWorld && targetWorld !== this.game.world.worldType) {
                // 跨维度传送
                this.game.world.switchToWorld(targetWorld, this.player.position);
                const pos = target.mesh.position;
                this.player.position.set(pos.x, pos.y + 3, pos.z);
                this.game.world.updateChunks(this.player.position);
                this.game.onMessage('已传送到石碑: ' + name);
            } else {
                // 同维度传送
                const pos = target.mesh.position;
                this.player.position.set(pos.x, pos.y + 3, pos.z);
                this.game.world.updateChunks(this.player.position);
                this.game.onMessage('已传送到石碑: ' + name);
            }
            return true;
        }
        return false;
    }

    openMysteryBox(building) {
        this.activeMysteryBox = building;
        if (!Array.isArray(building.mysteryBoxStorage) || building.mysteryBoxStorage.length < 2) {
            building.mysteryBoxStorage = [null, null];
        }
        const panel = document.getElementById('mysteryBoxUI');
        panel.style.display = 'block';
        this.player.unlockMouse();
        this._renderMysteryBox();
    }

    _closeMysteryBox() {
        document.getElementById('mysteryBoxUI').style.display = 'none';
        this.activeMysteryBox = null;
        if (this.player && this.game.running) this.player.lockMouse();
    }

    _renderMysteryBox() {
        if (!this.activeMysteryBox) return;
        const mb = this.activeMysteryBox;
        // 左侧：神木/元素木放置槽
        const divineSlot = document.getElementById('mysteryBoxDivineSlot');
        const divineItem = mb.mysteryBoxStorage[0];
        divineSlot.className = 'inv-slot' + (divineItem ? '' : ' empty');
        if (divineItem) {
            divineSlot.innerHTML = `<span class="slot-icon">${itemIconSVG(divineItem.id)}</span><span class="slot-count">${divineItem.amount > 1 ? divineItem.amount : ''}</span>`;
            divineSlot.title = `${ITEMS[divineItem.id]?.name || divineItem.id} x${divineItem.amount}`;
        } else {
            divineSlot.innerHTML = '';
            divineSlot.title = '放入神木/金平/元素木';
        }
        divineSlot.onclick = () => this._mysteryBoxTakeOut(0);

        // 右侧：木质装备/护身符放置槽
        const equipSlot = document.getElementById('mysteryBoxEquipSlot');
        const equipItem = mb.mysteryBoxStorage[1];
        equipSlot.className = 'inv-slot' + (equipItem ? '' : ' empty');
        if (equipItem) {
            const charge = equipItem.charge || 0;
            const durability = equipItem.durability !== undefined ? ` (耐久:${equipItem.durability})` : '';
            equipSlot.innerHTML = `<span class="slot-icon">${itemIconSVG(equipItem.id)}</span>${charge > 0 ? `<span class="slot-count" style="color:#ffd700">+${charge}</span>` : ''}`;
            equipSlot.title = `${ITEMS[equipItem.id]?.name || equipItem.id}${charge > 0 ? ' (充能+' + charge + ')' : ''}${durability}`;
        } else {
            equipSlot.innerHTML = '';
            equipSlot.title = '放入木质装备/护身符';
        }
        equipSlot.onclick = () => this._mysteryBoxTakeOut(1);

        // 库存列表：显示神木和可充能装备
        const invGrid = document.getElementById('mysteryBoxInventoryGrid');
        invGrid.innerHTML = '';
        for (let i = 0; i < this.inventory.size; i++) {
            const item = this.inventory.items[i];
            if (!item) continue;
            const isDivine = item.id === 'divine_wood' || item.id === 'gold_coin' || item.id === 'element_wood';
            const isChargeable = CHARGEABLE_WOOD_ITEMS.includes(item.id) || CHARGEABLE_GOLD_PAN_ITEMS.includes(item.id) || TALISMAN_ITEMS.includes(item.id);
            if (!isDivine && !isChargeable) continue;
            const slot = document.createElement('div');
            slot.className = 'inv-slot';
            const charge = item.charge || 0;
            slot.innerHTML = `<span class="slot-icon">${itemIconSVG(item.id)}</span><span class="slot-count">${item.amount > 1 ? item.amount : ''}</span>${charge > 0 ? `<span style="color:#ffd700;font-size:10px">+${charge}</span>` : ''}`;
            slot.title = `${ITEMS[item.id]?.name || item.id}${charge > 0 ? ' (充能+' + charge + ')' : ''}`;
            slot.addEventListener('click', () => this._mysteryBoxPutIn(i));
            invGrid.appendChild(slot);
        }

        // 开始按钮状态
        const btnStart = document.getElementById('btnMysteryBoxStart');
        const hasDivine = divineItem && divineItem.amount > 0;
        const hasEquip = equipItem && (CHARGEABLE_WOOD_ITEMS.includes(equipItem.id) || CHARGEABLE_GOLD_PAN_ITEMS.includes(equipItem.id) || TALISMAN_ITEMS.includes(equipItem.id));
        btnStart.disabled = !(hasDivine && hasEquip);
    }

    _mysteryBoxPutIn(invIndex) {
        if (!this.activeMysteryBox) return;
        const item = this.inventory.items[invIndex];
        if (!item) return;
        const mb = this.activeMysteryBox;
        if (item.id === 'divine_wood' || item.id === 'gold_coin' || item.id === 'element_wood') {
            if (mb.mysteryBoxStorage[0]) {
                if (mb.mysteryBoxStorage[0].id !== item.id) {
                    this.game.onMessage('槽位已有不同物品！');
                    return;
                }
                mb.mysteryBoxStorage[0].amount += item.amount;
            } else {
                mb.mysteryBoxStorage[0] = { id: item.id, amount: item.amount };
            }
            this.inventory.items[invIndex] = null;
        } else if (CHARGEABLE_WOOD_ITEMS.includes(item.id) || CHARGEABLE_GOLD_PAN_ITEMS.includes(item.id) || TALISMAN_ITEMS.includes(item.id)) {
            if (mb.mysteryBoxStorage[1]) {
                const emptyIdx = this.inventory.items.findIndex(s => !s);
                if (emptyIdx >= 0) {
                    this.inventory.items[emptyIdx] = mb.mysteryBoxStorage[1];
                } else {
                    this.game.onMessage('背包已满！');
                    return;
                }
            }
            mb.mysteryBoxStorage[1] = { id: item.id, amount: 1, charge: item.charge || 0 };
            if (item.amount > 1) {
                item.amount -= 1;
            } else {
                this.inventory.items[invIndex] = null;
            }
        }
        this.inventory.notify();
        this._renderMysteryBox();
    }

    _mysteryBoxTakeOut(slotIndex) {
        if (!this.activeMysteryBox) return;
        const mb = this.activeMysteryBox;
        const item = mb.mysteryBoxStorage[slotIndex];
        if (!item) return;
        const emptyIdx = this.inventory.items.findIndex(s => !s);
        if (emptyIdx < 0) {
            this.game.onMessage('背包已满！');
            return;
        }
        this.inventory.items[emptyIdx] = item;
        mb.mysteryBoxStorage[slotIndex] = null;
        this.inventory.notify();
        this._renderMysteryBox();
    }

    _startCharging() {
        if (!this.activeMysteryBox) return;
        const mb = this.activeMysteryBox;
        const divineItem = mb.mysteryBoxStorage[0];
        const equipItem = mb.mysteryBoxStorage[1];
        if (!divineItem || divineItem.amount <= 0 || !equipItem) {
            this.game.onMessage('需要放入充能材料和物品！');
            return;
        }
        const isWoodCharge = CHARGEABLE_WOOD_ITEMS.includes(equipItem.id);
        const isGoldPanCharge = CHARGEABLE_GOLD_PAN_ITEMS.includes(equipItem.id);
        if (!isWoodCharge && !isGoldPanCharge) {
            this.game.onMessage('该物品无法充能！');
            return;
        }
        // 神木充能木质装备，金平充能其它物品
        if (isWoodCharge && divineItem.id !== 'divine_wood') {
            this.game.onMessage('木质装备需要神木充能！');
            return;
        }
        if (isGoldPanCharge && divineItem.id !== 'gold_coin') {
            this.game.onMessage('该物品需要金平充能！');
            return;
        }
        // 元素木为护身符增加耐久
        if (divineItem.id === 'element_wood' && TALISMAN_ITEMS.includes(equipItem.id)) {
            const def = ITEMS[equipItem.id];
            if (!def.maxDurability) {
                this.game.onMessage('该物品无法增加耐久！');
                return;
            }
            if (equipItem.maxDurability === undefined) equipItem.maxDurability = def.maxDurability;
            equipItem.maxDurability += 20;
            equipItem.durability = equipItem.maxDurability;
            divineItem.amount -= 1;
            if (divineItem.amount <= 0) mb.mysteryBoxStorage[0] = null;
            this.game.onMessage(`耐久提升！${ITEMS[equipItem.id]?.name || equipItem.id} 最大耐久+20 (当前: ${equipItem.maxDurability})，已回满！`);
            this._renderMysteryBox();
            return;
        }
        // 元素木不能用于普通充能
        if (divineItem.id === 'element_wood') {
            this.game.onMessage('元素木只能用于护身符耐久提升！');
            return;
        }
        // 消耗1个充能材料，装备充能+1
        divineItem.amount -= 1;
        if (divineItem.amount <= 0) mb.mysteryBoxStorage[0] = null;
        equipItem.charge = (equipItem.charge || 0) + 1;
        this.game.onMessage(`充能成功！${ITEMS[equipItem.id]?.name || equipItem.id} 充能+1 (当前: +${equipItem.charge})`);
        this._renderMysteryBox();
    }

    // ========== 锻造台 ==========
    openForge(building) {
        this.activeForge = building;
        if (!Array.isArray(building.forgeStorage) || building.forgeStorage.length < 3) {
            building.forgeStorage = [null, null, null];
        }
        const panel = document.getElementById('forgeUI');
        panel.style.display = 'block';
        this.player.unlockMouse();
        this._renderForge();
    }

    _closeForge() {
        document.getElementById('forgeUI').style.display = 'none';
        this.activeForge = null;
        if (this.player && this.game.running) this.player.lockMouse();
    }

    _renderForge() {
        if (!this.activeForge) return;
        const fg = this.activeForge;
        // 左槽：木质装备
        const equipSlot = document.getElementById('forgeEquipSlot');
        const equipItem = fg.forgeStorage[0];
        equipSlot.className = 'inv-slot' + (equipItem ? '' : ' empty');
        if (equipItem) {
            const charge = equipItem.charge || 0;
            const uses = equipItem.uses !== undefined ? ` (耐久:${equipItem.uses})` : '';
            equipSlot.innerHTML = `<span class="slot-icon">${itemIconSVG(equipItem.id)}</span>${charge > 0 ? `<span class="slot-count" style="color:#ffd700">+${charge}</span>` : ''}`;
            equipSlot.title = `${ITEMS[equipItem.id]?.name || equipItem.id}${charge > 0 ? ' (充能+' + charge + ')' : ''}${uses}`;
        } else {
            equipSlot.innerHTML = '';
            equipSlot.title = '放入木质装备（不含护身符）';
        }
        equipSlot.onclick = () => this._forgeTakeOut(0);

        // 中槽：元素石
        const stoneSlot = document.getElementById('forgeStoneSlot');
        const stoneItem = fg.forgeStorage[1];
        stoneSlot.className = 'inv-slot' + (stoneItem ? '' : ' empty');
        if (stoneItem) {
            stoneSlot.innerHTML = `<span class="slot-icon">${itemIconSVG(stoneItem.id)}</span><span class="slot-count">${stoneItem.amount > 1 ? stoneItem.amount : ''}</span>`;
            stoneSlot.title = `${ITEMS[stoneItem.id]?.name || stoneItem.id} x${stoneItem.amount}`;
        } else {
            stoneSlot.innerHTML = '';
            stoneSlot.title = '放入元素石';
        }
        stoneSlot.onclick = () => this._forgeTakeOut(1);

        // 右槽：锻造产物
        const resultSlot = document.getElementById('forgeResultSlot');
        const resultItem = fg.forgeStorage[2];
        resultSlot.className = 'inv-slot' + (resultItem ? '' : ' empty');
        if (resultItem) {
            const charge = resultItem.charge || 0;
            const uses = resultItem.uses !== undefined ? ` (耐久:${resultItem.uses})` : '';
            resultSlot.innerHTML = `<span class="slot-icon">${itemIconSVG(resultItem.id)}</span>${charge > 0 ? `<span class="slot-count" style="color:#ffd700">+${charge}</span>` : ''}`;
            resultSlot.title = `${ITEMS[resultItem.id]?.name || resultItem.id}${charge > 0 ? ' (充能+' + charge + ')' : ''}${uses}`;
        } else {
            resultSlot.innerHTML = '';
            resultSlot.title = '锻造产物';
        }
        resultSlot.onclick = () => this._forgeTakeOut(2);

        // 库存列表
        const invGrid = document.getElementById('forgeInventoryGrid');
        invGrid.innerHTML = '';
        for (let i = 0; i < this.inventory.size; i++) {
            const item = this.inventory.items[i];
            if (!item) continue;
            const isForgeable = FORGEABLE_WOOD_ITEMS.includes(item.id);
            const isStone = item.id === 'element_stone';
            if (!isForgeable && !isStone) continue;
            const slot = document.createElement('div');
            slot.className = 'inv-slot';
            const charge = item.charge || 0;
            slot.innerHTML = `<span class="slot-icon">${itemIconSVG(item.id)}</span><span class="slot-count">${item.amount > 1 ? item.amount : ''}</span>${charge > 0 ? `<span style="color:#ffd700;font-size:10px">+${charge}</span>` : ''}`;
            slot.title = `${ITEMS[item.id]?.name || item.id}${charge > 0 ? ' (充能+' + charge + ')' : ''}`;
            slot.addEventListener('click', () => this._forgePutIn(i));
            invGrid.appendChild(slot);
        }

        // 开始按钮状态
        const btnStart = document.getElementById('btnForgeStart');
        const hasEquip = equipItem && FORGE_MAP[equipItem.id];
        const hasStone = stoneItem && stoneItem.amount > 0;
        const hasResultSpace = !resultItem;
        btnStart.disabled = !(hasEquip && hasStone && hasResultSpace);
    }

    _forgePutIn(invIndex) {
        if (!this.activeForge) return;
        const item = this.inventory.items[invIndex];
        if (!item) return;
        const fg = this.activeForge;
        if (item.id === 'element_stone') {
            if (fg.forgeStorage[1]) {
                if (fg.forgeStorage[1].id !== item.id) {
                    this.game.onMessage('槽位已有不同物品！');
                    return;
                }
                fg.forgeStorage[1].amount += item.amount;
            } else {
                fg.forgeStorage[1] = { id: item.id, amount: item.amount };
            }
            this.inventory.items[invIndex] = null;
        } else if (FORGEABLE_WOOD_ITEMS.includes(item.id)) {
            if (fg.forgeStorage[0]) {
                const emptyIdx = this.inventory.items.findIndex(s => !s);
                if (emptyIdx >= 0) {
                    this.inventory.items[emptyIdx] = fg.forgeStorage[0];
                } else {
                    this.game.onMessage('背包已满！');
                    return;
                }
            }
            fg.forgeStorage[0] = { id: item.id, amount: 1, charge: item.charge || 0, uses: item.uses };
            if (item.amount > 1) {
                item.amount -= 1;
            } else {
                this.inventory.items[invIndex] = null;
            }
        }
        this.inventory.notify();
        this._renderForge();
    }

    _forgeTakeOut(slotIndex) {
        if (!this.activeForge) return;
        const fg = this.activeForge;
        const item = fg.forgeStorage[slotIndex];
        if (!item) return;
        const emptyIdx = this.inventory.items.findIndex(s => !s);
        if (emptyIdx < 0) {
            this.game.onMessage('背包已满！');
            return;
        }
        this.inventory.items[emptyIdx] = item;
        fg.forgeStorage[slotIndex] = null;
        this.inventory.notify();
        this._renderForge();
    }

    _startForging() {
        if (!this.activeForge) return;
        const fg = this.activeForge;
        const equipItem = fg.forgeStorage[0];
        const stoneItem = fg.forgeStorage[1];
        if (!equipItem || !stoneItem || stoneItem.amount <= 0) {
            this.game.onMessage('需要放入木质装备和元素石！');
            return;
        }
        if (fg.forgeStorage[2]) {
            this.game.onMessage('请先取出锻造产物！');
            return;
        }
        const targetId = FORGE_MAP[equipItem.id];
        if (!targetId) {
            this.game.onMessage('该物品无法锻造！');
            return;
        }
        const targetDef = ITEMS[targetId];
        if (!targetDef) {
            this.game.onMessage('锻造目标物品不存在！');
            return;
        }
        // 消耗1个元素石
        stoneItem.amount -= 1;
        if (stoneItem.amount <= 0) fg.forgeStorage[1] = null;
        // 消耗木质装备
        fg.forgeStorage[0] = null;
        // 创建锻造后的物品，保留充能
        const forged = { id: targetId, amount: 1, charge: equipItem.charge || 0 };
        if (targetDef.maxUses) {
            forged.uses = targetDef.maxUses;
        }
        // 放入产物槽
        fg.forgeStorage[2] = forged;
        this.game.onMessage(`锻造成功！${ITEMS[equipItem.id]?.name || equipItem.id} → ${targetDef.name}${forged.charge > 0 ? ' (充能+' + forged.charge + ')' : ''}${forged.uses ? ' (耐久:' + forged.uses + ')' : ''}`);
        this._renderForge();
    }

    showMessage(text) {
        const toast = document.getElementById('messageToast');
        const msg = document.createElement('div');
        msg.className = 'toast-msg';
        msg.textContent = text;
        toast.appendChild(msg);
        setTimeout(() => msg.remove(), 3000);
    }

    showLoading(percent, text) {
        document.getElementById('loadingFill').style.width = percent + '%';
        document.getElementById('loadingText').textContent = text;
    }

    hideLoading() {
        document.getElementById('loadingScreen').style.display = 'none';
    }

    showStart() {
        document.getElementById('startScreen').style.display = 'flex';
    }

    hideStart() {
        document.getElementById('startScreen').style.display = 'none';
    }

    showHUD() {
        document.getElementById('gameHUD').style.display = 'block';
    }

    hideHUD() {
        document.getElementById('gameHUD').style.display = 'none';
    }

    showLogin() {
        document.getElementById('loginScreen').style.display = 'flex';
        this._renderUserList();
    }

    hideLogin() {
        document.getElementById('loginScreen').style.display = 'none';
    }

    _renderUserList() {
        const container = document.getElementById('existingUsers');
        const users = SaveSystem.getUserList();
        container.innerHTML = '';
        if (users.length === 0) return;
        const h3 = document.createElement('h3');
        h3.textContent = '已有存档';
        container.appendChild(h3);
        for (const username of users) {
            const info = SaveSystem.getSaveInfo(username);
            const item = document.createElement('div');
            item.className = 'user-item';
            const left = document.createElement('div');
            left.innerHTML = `<span class="user-name">👤 ${username}</span>` +
                (info ? `<br><span class="user-info">第${info.day}天 · ${new Date(info.timestamp).toLocaleDateString()}</span>` : '');
            item.appendChild(left);
            const delBtn = document.createElement('button');
            delBtn.className = 'btn-delete-user';
            delBtn.textContent = '🗑';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`确定删除用户"${username}"的存档吗？`)) {
                    SaveSystem.deleteUser(username);
                    this._renderUserList();
                }
            });
            item.appendChild(delBtn);
            item.addEventListener('click', () => {
                document.getElementById('usernameInput').value = username;
                document.getElementById('passwordInput').value = '';
                document.getElementById('passwordInput').focus();
            });
            container.appendChild(item);
        }
    }

    // ===== 主菜单 =====
    showMainMenu(username) {
        document.getElementById('welcomeText').textContent = '欢迎, ' + username;
        document.getElementById('btnDevSwitch').style.display = this.game.devMode ? '' : 'none'; // 开发者模式专属
        document.getElementById('mainMenuScreen').style.display = 'flex';
    }

    // ===== 开发者模式测试界面 =====
    showDevSwitch() {
        document.getElementById('devSwitchScreen').style.display = 'flex';
        document.getElementById('devNameInput').value = '';
        this._renderDevUsers();
    }

    hideDevSwitch() {
        document.getElementById('devSwitchScreen').style.display = 'none';
    }

    _renderDevUsers() {
        const container = document.getElementById('devUserList');
        const users = SaveSystem.getUserList();
        container.innerHTML = '';
        if (!users.length) return;
        const h3 = document.createElement('h3');
        h3.textContent = '已有账号（点击进入）';
        container.appendChild(h3);
        for (const u of users) {
            const item = document.createElement('div');
            item.className = 'user-item';
            item.innerHTML = '<span class="user-name">👤 ' + u + (u === this.game.username ? ' <span style="color:#69f0ae">(当前)</span>' : '') + '</span>';
            item.addEventListener('click', () => this.game.devSwitch(u));
            container.appendChild(item);
        }
    }

    hideMainMenu() {
        document.getElementById('mainMenuScreen').style.display = 'none';
    }

    showWorldSurvival() {
        document.getElementById('worldSurvivalScreen').style.display = 'flex';
    }

    hideWorldSurvival() {
        document.getElementById('worldSurvivalScreen').style.display = 'none';
    }

    // ===== 植物大战僵尸 =====
    showPvz() {
        document.getElementById('pvzScreen').style.display = 'block';
        if (!this.pvz) {
            this.pvz = new PvzGame();
        }
        this.pvz.start();
    }

    hidePvz() {
        if (this.pvz) {
            this.pvz.stop();
        }
        if (this.stickPvz) {
            this.stickPvz.stop();
        }
        document.getElementById('pvzScreen').style.display = 'none';
    }

    hideStickPvz() {
        this.hidePvz();
    }

    // ===== 火柴人大战僵尸：独立入口（共用pvzScreen画布） =====
    showStickPvz() {
        document.getElementById('pvzScreen').style.display = 'block';
        if (!this.stickPvz) {
            this.stickPvz = new StickPvzGame();
        }
        this.stickPvz.startStick();
    }

    // ===== 小球对战 =====
    showBallBattle() {
        document.getElementById('ballBattleScreen').style.display = 'block';
        if (!this.ballBattle) {
            this.ballBattle = new BallBattleGame();
        }
        this.ballBattle.start();
    }

    hideBallBattle() {
        if (this.ballBattle) {
            this.ballBattle.stop();
        }
        document.getElementById('ballBattleScreen').style.display = 'none';
    }

    // ===== 玩玩视频（画画+逐帧动画：顶部工具栏选图形，底部帧列表连播成视频） =====
    _vdName() { return this.game.username || 'guest'; }
    _vdKey() { return 'wvideo_' + this._vdName(); } // 按账号存帧（localStorage）

    showVideo() {
        document.getElementById('videoScreen').style.display = 'flex';
        document.getElementById('vdUser').textContent = '@' + this._vdName();
        this._vdInit();
    }

    hideVideo() {
        this._vdTextCommit();
        this._vdStop();
        this._vdSave(false);
        document.getElementById('videoScreen').style.display = 'none';
    }

    _vdInit() { // 首次进入：建ctx、读本账号存档；之后进来只刷新缩略图
        if (this.vd.inited) { this._vdRenderThumbs(); return; }
        this.vd.inited = true;
        const c = document.getElementById('vdCanvas');
        this.vd.cv = c; this.vd.cx = c.getContext('2d');
        this.vd.cx.lineCap = 'round'; this.vd.cx.lineJoin = 'round';
        const art = document.createElement('canvas'); // 离屏作画层：所有笔迹画这里，显示层负责合成洋葱皮
        art.width = c.width; art.height = c.height;
        this.vd.art = art; this.vd.acx = art.getContext('2d');
        this.vd.acx.lineCap = 'round'; this.vd.acx.lineJoin = 'round';
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(this._vdKey())); } catch (e) { }
        if (saved && saved.frames && saved.frames.length) {
            this.vd.frames = saved.frames.slice(0, 30);
            this.vd.fps = saved.fps || 6;
            document.getElementById('vdFps').value = this.vd.fps;
        } else this.vd.frames = [this._vdBlank()];
        this.vd.cur = 0; this.vd.undo = [];
        this._vdLoad(0);
        this._vdSetTool('pen');
        this._vdSetColor(this.vd.color);
    }

    _vdBlank() { // 白底空白帧dataURL
        const c = this.vd.art, x = this.vd.acx;
        x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
        return c.toDataURL();
    }

    _vdShow() { // 显示层合成：作画层 + 可选洋葱皮(上一帧30%透明;播放/导出不显示)
        const x = this.vd.cx;
        x.globalAlpha = 1;
        x.drawImage(this.vd.art, 0, 0);
        if (this.vd.onion && this.vd.cur > 0 && !this.vd.playing && !this.vd.exporting) {
            const img = new Image();
            img.onload = () => { x.globalAlpha = 0.3; x.drawImage(img, 0, 0); x.globalAlpha = 1; };
            img.src = this.vd.frames[this.vd.cur - 1];
        }
    }

    _vdLoad(i) { // 载入第i帧到作画层
        this._vdTextCommit();
        this.vd.cur = i;
        const img = new Image();
        img.onload = () => { this.vd.acx.drawImage(img, 0, 0); this._vdShow(); };
        img.src = this.vd.frames[i];
        this._vdRenderThumbs();
    }

    _vdCommit() { this.vd.frames[this.vd.cur] = this.vd.art.toDataURL(); } // 作画层→当前帧

    _vdRenderThumbs() { // 底部帧缩略图列表
        const box = document.getElementById('vdThumbs');
        box.innerHTML = '';
        this.vd.frames.forEach((f, i) => {
            const d = document.createElement('div');
            d.className = 'vd-thumb' + (i === this.vd.cur ? ' on' : '');
            const im = document.createElement('img'); im.src = f; d.appendChild(im);
            const n = document.createElement('span'); n.textContent = i + 1; d.appendChild(n);
            d.addEventListener('click', () => { if (i !== this.vd.cur) { this._vdCommit(); this._vdLoad(i); } });
            box.appendChild(d);
        });
        document.getElementById('vdFrameInfo').textContent = `第${this.vd.cur + 1}/${this.vd.frames.length}帧`;
    }

    _vdSetTool(t) {
        if (t !== 'text') this._vdTextCommit(); // 换工具先落字
        this.vd.tool = t;
        document.querySelectorAll('#vdToolbar [data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
        if (this.vd.cv) this.vd.cv.style.cursor = t === 'eraser' ? 'cell' : t === 'text' ? 'text' : 'crosshair';
    }

    _vdSetColor(c) {
        this.vd.color = c;
        document.querySelectorAll('#vdPalette [data-c]').forEach(b => b.classList.toggle('on', b.dataset.c === c));
        const inp = document.getElementById('vdColor');
        if (inp.value !== c) inp.value = c;
    }

    _vdPos(e) { // 指针坐标→画布坐标（CSS缩放换算）
        const r = this.vd.cv.getBoundingClientRect();
        return { x: (e.clientX - r.left) * this.vd.cv.width / r.width, y: (e.clientY - r.top) * this.vd.cv.height / r.height };
    }

    _vdDown(e) {
        if (!this.vd.inited || this.vd.playing || this.vd.exporting) return;
        e.preventDefault();
        if (this.vd.textEl) this._vdTextCommit(); // 上一个输入框先落字
        const p = this._vdPos(e);
        if (this.vd.tool === 'text') { this._vdTextOpen(p); return; } // 打字：点开输入框
        const x = this.vd.acx;
        this.vd.drawing = true; this.vd.x0 = p.x; this.vd.y0 = p.y; this.vd.lx = p.x; this.vd.ly = p.y;
        this._vdPushUndo();
        this.vd.snap = x.getImageData(0, 0, this.vd.cv.width, this.vd.cv.height); // 图形工具预览用快照
        if (this.vd.tool === 'pen' || this.vd.tool === 'eraser') { // 单击也能画出点
            x.strokeStyle = this.vd.tool === 'eraser' ? '#fff' : this.vd.color;
            x.lineWidth = this.vd.tool === 'eraser' ? this.vd.size * 2 : this.vd.size;
            x.beginPath(); x.moveTo(p.x, p.y); x.lineTo(p.x + 0.1, p.y + 0.1); x.stroke();
            this._vdShow();
        }
    }

    _vdMove(e) {
        if (!this.vd.drawing) return;
        const p = this._vdPos(e), x = this.vd.acx;
        if (this.vd.tool === 'pen' || this.vd.tool === 'eraser') { // 连续画线
            x.beginPath(); x.moveTo(this.vd.lx, this.vd.ly); x.lineTo(p.x, p.y); x.stroke();
            this.vd.lx = p.x; this.vd.ly = p.y;
        } else { // 图形：恢复快照→画预览
            x.putImageData(this.vd.snap, 0, 0);
            this._vdShape(this.vd.tool, this.vd.x0, this.vd.y0, p.x, p.y);
        }
        this._vdShow();
    }

    _vdTextOpen(p) { // 画布上点开输入框（屏幕字号随画布缩放）
        const cv = this.vd.cv, r = cv.getBoundingClientRect(), sc = r.width / cv.width;
        const fs = Math.max(14, this.vd.size * 7); // 粗细滑杆→字号
        const t = document.createElement('textarea');
        t.className = 'vd-textin';
        t.rows = 3; t.spellcheck = false; t.placeholder = '打字…';
        t.style.left = (cv.offsetLeft + p.x * sc) + 'px';
        t.style.top = (cv.offsetTop + p.y * sc) + 'px';
        t.style.fontSize = (fs * sc) + 'px';
        t.style.color = this.vd.color;
        t.style.width = Math.max(120, Math.min(340, (cv.width - p.x) * sc - 10)) + 'px';
        cv.parentElement.appendChild(t);
        this.vd.textEl = t; this.vd.textX = p.x; this.vd.textY = p.y;
        t.addEventListener('keydown', e => {
            e.stopPropagation(); // 防冒泡到游戏快捷键
            if (e.key === 'Escape') this._vdTextCancel();
        });
        t.addEventListener('blur', () => this._vdTextCommit());
        setTimeout(() => t.focus(), 0);
    }

    _vdTextCommit() { // 输入框文字落到当前帧
        const t = this.vd.textEl;
        if (!t) return;
        this.vd.textEl = null;
        const txt = t.value.replace(/\s+$/, '');
        t.remove();
        if (!txt.trim()) return;
        this._vdPushUndo();
        const x = this.vd.acx, fs = Math.max(14, this.vd.size * 7);
        x.fillStyle = this.vd.color;
        x.font = `bold ${fs}px sans-serif`; x.textBaseline = 'top';
        txt.split('\n').forEach((ln, i) => x.fillText(ln, this.vd.textX, this.vd.textY + i * fs * 1.25));
        this._vdShow(); this._vdCommit(); this._vdRenderThumbs(); this._vdSave(false);
    }

    _vdTextCancel() { // Esc取消输入
        const t = this.vd.textEl;
        if (!t) return;
        this.vd.textEl = null;
        t.remove();
    }

    _vdUp(e) {
        if (!this.vd.drawing) return;
        this.vd.drawing = false;
        this._vdCommit(); this._vdRenderThumbs(); this._vdSave(false); // 每笔自动存
    }

    _vdShape(tool, x0, y0, x1, y1) { // 拖出的图形：直线/矩形/椭圆/三角
        const x = this.vd.acx;
        x.strokeStyle = this.vd.color; x.lineWidth = this.vd.size;
        x.beginPath();
        if (tool === 'line') { x.moveTo(x0, y0); x.lineTo(x1, y1); }
        else if (tool === 'rect') x.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
        else if (tool === 'ellipse') x.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, 0, 0, 7);
        else if (tool === 'tri') {
            x.moveTo((x0 + x1) / 2, Math.min(y0, y1));
            x.lineTo(Math.min(x0, x1), Math.max(y0, y1));
            x.lineTo(Math.max(x0, x1), Math.max(y0, y1));
            x.closePath();
        }
        x.stroke();
    }

    _vdPushUndo() { // 当前作画层入撤销栈（≤30步）
        this.vd.undo.push(this.vd.art.toDataURL());
        if (this.vd.undo.length > 30) this.vd.undo.shift();
    }

    _vdUndo() {
        if (!this.vd.inited || this.vd.playing || !this.vd.undo.length) return;
        this._vdTextCommit();
        const img = new Image();
        img.onload = () => { this.vd.acx.drawImage(img, 0, 0); this._vdShow(); this._vdCommit(); this._vdRenderThumbs(); };
        img.src = this.vd.undo.pop();
    }

    _vdClear() {
        if (!this.vd.inited || this.vd.playing) return;
        this._vdTextCommit();
        this._vdPushUndo();
        this.vd.acx.fillStyle = '#fff';
        this.vd.acx.fillRect(0, 0, this.vd.cv.width, this.vd.cv.height);
        this._vdShow(); this._vdCommit(); this._vdRenderThumbs();
    }

    _vdAddFrame() {
        if (this.vd.frames.length >= 30) { alert('最多30帧'); return; }
        this._vdCommit();
        this.vd.frames.splice(this.vd.cur + 1, 0, this._vdBlank());
        this._vdLoad(this.vd.cur + 1); this._vdSave(false);
    }

    _vdDupFrame() {
        if (this.vd.frames.length >= 30) { alert('最多30帧'); return; }
        this._vdCommit();
        this.vd.frames.splice(this.vd.cur + 1, 0, this.vd.frames[this.vd.cur]);
        this._vdLoad(this.vd.cur + 1); this._vdSave(false);
    }

    _vdDelFrame() {
        if (this.vd.frames.length <= 1) { this._vdClear(); return; } // 最后一帧只清空
        this.vd.frames.splice(this.vd.cur, 1);
        this._vdLoad(Math.min(this.vd.cur, this.vd.frames.length - 1));
        this._vdSave(false);
    }

    _vdTogglePlay() { this.vd.playing ? this._vdStop() : this._vdPlay(); }

    _vdPlay() { // 循环连播全部帧=视频（播放时无洋葱皮）
        if (!this.vd.frames.length) return;
        this._vdTextCommit();
        this._vdCommit();
        this.vd.playing = true; this.vd.pi = 0;
        document.getElementById('btnVdPlay').textContent = '⏸ 停止';
        document.getElementById('vdCanvas').classList.add('vd-playing');
        this.vd.timer = setInterval(() => {
            const img = new Image();
            img.onload = () => this.vd.cx.drawImage(img, 0, 0);
            img.src = this.vd.frames[this.vd.pi];
            this.vd.pi = (this.vd.pi + 1) % this.vd.frames.length;
        }, 1000 / this.vd.fps);
    }

    _vdStop() {
        if (!this.vd.playing) return;
        this.vd.playing = false;
        clearInterval(this.vd.timer);
        document.getElementById('btnVdPlay').textContent = '▶ 播放';
        document.getElementById('vdCanvas').classList.remove('vd-playing');
        this._vdLoad(this.vd.cur); // 停回编辑帧
    }

    _vdSave(manual) { // 存本账号：帧dataURL数组+fps
        if (!this.vd.inited) return;
        try {
            localStorage.setItem(this._vdKey(), JSON.stringify({ frames: this.vd.frames, fps: this.vd.fps }));
            if (manual) {
                const b = document.getElementById('btnVdSave');
                b.textContent = '✓ 已保存';
                setTimeout(() => { b.textContent = '💾 保存'; }, 1200);
            }
        } catch (e) { if (manual) alert('保存失败：画作太大存不下，减少帧数试试'); }
    }

    _vdExport() { // 能录mp4就录视频；录不了就导GIF(到处能看)；导出后弹内置预览
        if (this.vd.exporting || !this.vd.frames.length) return;
        this._vdTextCommit();
        this._vdStop(); this._vdCommit();
        const mp4 = window.MediaRecorder && this.vd.cv.captureStream &&
            ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4']
                .find(m => MediaRecorder.isTypeSupported(m));
        if (!mp4) { this._vdExportGif(); return; } // 录不出mp4→GIF兜底，保证直接能看
        this.vd.exporting = true;
        const btn = document.getElementById('btnVdExport');
        btn.textContent = '⏺ 录制中…';
        const stream = this.vd.cv.captureStream(this.vd.fps);
        const rec = new MediaRecorder(stream, { mimeType: mp4, videoBitsPerSecond: 5000000 }), chunks = [];
        rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
        rec.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/mp4' });
            if (blob.size) this._vdShowExport(URL.createObjectURL(blob), '玩玩视频_' + this._vdName() + '.mp4', 'mp4');
            else alert('录制失败：没有录到数据，请重试');
            this.vd.exporting = false; btn.textContent = '⬇ 导出视频';
            this._vdLoad(this.vd.cur);
        };
        rec.start(250); // 定时吐片，防结束前数据未flush
        let i = 0;
        const step = () => { // 按fps逐帧画一遍
            const img = new Image();
            img.onload = () => {
                this.vd.cx.drawImage(img, 0, 0);
                if (++i >= this.vd.frames.length) setTimeout(() => rec.stop(), 400);
                else setTimeout(step, 1000 / this.vd.fps);
            };
            img.src = this.vd.frames[i];
        };
        step();
    }

    _vdExportGif() { // 无mp4录制能力时：自写GIF89a编码导出，任何播放器都能看
        this.vd.exporting = true;
        const btn = document.getElementById('btnVdExport');
        btn.textContent = '⏺ 生成GIF…';
        const w = this.vd.cv.width, h = this.vd.cv.height;
        const tc = document.createElement('canvas');
        tc.width = w; tc.height = h;
        const tx = tc.getContext('2d', { willReadFrequently: true });
        const datas = [];
        const load = i => new Promise(res => {
            const img = new Image();
            img.onload = () => { tx.drawImage(img, 0, 0); datas.push(tx.getImageData(0, 0, w, h)); res(); };
            img.onerror = res;
            img.src = this.vd.frames[i];
        });
        (async () => {
            for (let i = 0; i < this.vd.frames.length; i++) await load(i);
            const gif = this._vdGifEncode(datas, w, h, this.vd.fps);
            this._vdShowExport(URL.createObjectURL(new Blob([gif], { type: 'image/gif' })),
                '玩玩视频_' + this._vdName() + '.gif', 'gif');
            this.vd.exporting = false; btn.textContent = '⬇ 导出视频';
            this._vdLoad(this.vd.cur);
        })();
    }

    _vdGifEncode(datas, w, h, fps) { // GIF89a：调色板≤256色用精确色，否则3-3-2均匀量化
        const uniq = new Map();
        let exact = true;
        for (const d of datas) {
            const p = d.data;
            for (let i = 0; i < p.length; i += 4) {
                const c = (p[i] << 16) | (p[i + 1] << 8) | p[i + 2];
                if (!uniq.has(c)) {
                    if (uniq.size >= 256) { exact = false; break; }
                    uniq.set(c, uniq.size);
                }
            }
            if (!exact) break;
        }
        const pal = new Uint8Array(768);
        if (exact) for (const [c, i] of uniq) { pal[i * 3] = c >> 16; pal[i * 3 + 1] = c >> 8 & 255; pal[i * 3 + 2] = c & 255; }
        else for (let i = 0; i < 256; i++) {
            pal[i * 3] = Math.round((i >> 5) * 255 / 7);       // r:高3位
            pal[i * 3 + 1] = Math.round((i >> 2 & 7) * 255 / 7); // g:中3位
            pal[i * 3 + 2] = Math.round((i & 3) * 255 / 3);      // b:低2位
        }
        const toIndex = d => {
            const p = d.data, n = new Uint8Array(p.length / 4);
            if (exact) for (let i = 0, j = 0; i < p.length; i += 4, j++) n[j] = uniq.get((p[i] << 16) | (p[i + 1] << 8) | p[i + 2]);
            else for (let i = 0, j = 0; i < p.length; i += 4, j++) n[j] = (p[i] >> 5 << 5) | (p[i + 1] >> 5 << 2) | (p[i + 2] >> 6);
            return n;
        };
        const out = [];
        const str = s => { for (const c of s) out.push(c.charCodeAt(0)); };
        str('GIF89a');
        out.push(w & 255, w >> 8, h & 255, h >> 8, 0xF7, 0, 0); // 全局256色调色板
        for (const b of pal) out.push(b);
        out.push(0x21, 0xFF, 0x0B); str('NETSCAPE2.0'); out.push(3, 1, 0, 0, 0); // 无限循环
        const delay = Math.min(65535, Math.max(1, Math.round(100 / (fps || 6))));
        for (const d of datas) {
            out.push(0x21, 0xF9, 4, 0, delay & 255, delay >> 8, 0, 0); // 帧延时
            out.push(0x2C, 0, 0, 0, 0, w & 255, w >> 8, h & 255, h >> 8, 0); // 整帧图像
            const codes = this._vdLzw(8, toIndex(d));
            out.push(8); // 最小码长
            for (let i = 0; i < codes.length; i += 255) {
                const n = Math.min(255, codes.length - i);
                out.push(n);
                for (let j = 0; j < n; j++) out.push(codes[i + j]);
            }
            out.push(0); // 块终止
        }
        out.push(0x3B); // trailer
        return new Uint8Array(out);
    }

    _vdLzw(minCode, idx) { // GIF LZW压缩：LSB-first位打包
        const clear = 1 << minCode, eoi = clear + 1;
        let size = minCode + 1, next = eoi + 1;
        const table = new Int32Array(1 << 20).fill(-1); // key=(prefix<<8)|k → 码值
        const out = [];
        let acc = 0, bits = 0;
        const emit = c => {
            acc |= c << bits; bits += size;
            while (bits >= 8) { out.push(acc & 255); acc >>= 8; bits -= 8; }
        };
        emit(clear);
        let pre = idx[0];
        for (let i = 1; i < idx.length; i++) {
            const k = idx[i], j = (pre << 8) | k;
            if (table[j] >= 0) { pre = table[j]; continue; }
            emit(pre);
            table[j] = next++;
            if (next === 1 << size) size++;
            if (next === 4096) { emit(clear); table.fill(-1); size = minCode + 1; next = eoi + 1; }
            pre = k;
        }
        emit(pre); emit(eoi);
        if (bits) out.push(acc & 255);
        return out;
    }

    _vdShowExport(url, name, ext) { // 内置预览层：导出后直接能看，附保存按钮
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.85);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px';
        const el = ext === 'gif' ? new Image() : document.createElement('video');
        el.src = url;
        if (ext !== 'gif') { el.controls = true; el.autoplay = true; el.loop = true; el.muted = true; el.playsInline = true; }
        el.style.cssText = 'max-width:92vw;max-height:72vh;background:#000;border-radius:8px';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;gap:10px';
        const a = document.createElement('a');
        a.textContent = '⬇ 保存到文件'; a.href = url; a.download = name;
        a.style.cssText = 'padding:8px 18px;background:#42a5f5;color:#fff;border-radius:6px;text-decoration:none';
        const close = document.createElement('button');
        close.textContent = '✕ 关闭';
        close.style.cssText = 'padding:8px 18px;background:#555;color:#fff;border:0;border-radius:6px;cursor:pointer';
        close.onclick = () => { URL.revokeObjectURL(url); ov.remove(); };
        row.append(a, close);
        ov.append(el, row);
        document.body.appendChild(ov);
    }

    // ===== 设置 =====
    showSettings() {
        document.getElementById('settingsScreen').style.display = 'flex';
    }

    hideSettings() {
        document.getElementById('settingsScreen').style.display = 'none';
    }

    // ===== 房间列表 =====
    showRoomList() {
        document.getElementById('roomListScreen').style.display = 'flex';
        this._renderRoomList();
    }

    hideRoomList() {
        document.getElementById('roomListScreen').style.display = 'none';
    }

    // ===== 角色选择/创建 =====
    showCharacterScreen(roomId) {
        this._pendingRoomId = roomId;
        document.getElementById('characterScreen').style.display = 'flex';
        document.getElementById('charError').style.display = 'none';
        document.getElementById('newCharName').value = '';
        this._renderCharacterList();
    }

    hideCharacterScreen() {
        document.getElementById('characterScreen').style.display = 'none';
    }

    async _renderCharacterList() {
        const container = document.getElementById('characterList');
        container.innerHTML = '<div style="color:#888;text-align:center;padding:20px;">加载中...</div>';
        try {
            const res = await fetch('/api/characters?username=' + encodeURIComponent(this.game.username));
            const data = await res.json();
            container.innerHTML = '';
            if (!data.characters || data.characters.length === 0) {
                container.innerHTML = '<div style="color:#888;text-align:center;padding:20px;">还没有角色，在下方创建一个吧</div>';
                return;
            }
            for (const name of data.characters) {
                const item = document.createElement('div');
                item.className = 'room-item';
                item.innerHTML = `
                    <div>
                        <div class="room-name">${name}</div>
                        <div class="room-desc">点击进入游戏</div>
                    </div>
                    <div class="room-players">进入</div>
                `;
                item.addEventListener('click', () => {
                    this.hideCharacterScreen();
                    this.game.startMultiplayerGame(this._pendingRoomId, name);
                });
                container.appendChild(item);
            }
        } catch (e) {
            container.innerHTML = '<div style="color:#ff6666;text-align:center;padding:20px;">加载失败，请检查服务器是否运行</div>';
        }
    }

    async _createCharacter() {
        const name = document.getElementById('newCharName').value.trim();
        const errEl = document.getElementById('charError');
        errEl.style.display = 'none';
        if (!name) {
            errEl.textContent = '请输入角色名';
            errEl.style.display = 'block';
            return;
        }
        if (name.length > 12) {
            errEl.textContent = '角色名最多12个字符';
            errEl.style.display = 'block';
            return;
        }
        try {
            const res = await fetch('/api/characters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ characterName: name, username: this.game.username }),
            });
            const data = await res.json();
            if (res.ok) {
                this.hideCharacterScreen();
                this.game.startMultiplayerGame(this._pendingRoomId, name);
            } else {
                errEl.textContent = data.error || '创建失败';
                errEl.style.display = 'block';
            }
        } catch (e) {
            errEl.textContent = '无法连接服务器';
            errEl.style.display = 'block';
        }
    }

    // ===== 私人存档选择 =====
    showSaveSlots() {
        document.getElementById('saveSlotScreen').style.display = 'flex';
        this._renderSaveSlots();
    }

    hideSaveSlots() {
        document.getElementById('saveSlotScreen').style.display = 'none';
    }

    _renderSaveSlots() {
        const container = document.getElementById('saveSlotList');
        container.innerHTML = '';
        const username = this.game.username;
        const usedCount = SaveSystem.getUsedSlotCount(username);

        for (let slot = 1; slot <= SaveSystem.MAX_SLOTS; slot++) {
            const info = SaveSystem.getSlotInfo(username, slot);
            const item = document.createElement('div');
            item.className = 'save-slot-item ' + (info ? 'has-save' : 'empty');

            if (info) {
                const dateStr = new Date(info.timestamp).toLocaleString('zh-CN', {
                    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
                });
                item.innerHTML = `
                    <div class="save-slot-info">
                        <div class="save-slot-name">存档 ${slot}</div>
                        <div class="save-slot-detail">第${info.day}天 · <span class="hp-icon">❤</span>${Math.ceil(info.health)} · ${dateStr}</div>
                    </div>
                    <div class="save-slot-actions">
                        <button class="btn-slot-play" data-slot="${slot}">进入</button>
                        <button class="btn-slot-delete" data-slot="${slot}" title="删除存档">✖</button>
                    </div>
                `;
                item.querySelector('.btn-slot-play').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.hideSaveSlots();
                    this.game.startPrivateGame(slot);
                });
                item.querySelector('.btn-slot-delete').addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`确定删除存档${slot}？`)) {
                        SaveSystem.deleteSlotSave(username, slot);
                        this._renderSaveSlots();
                    }
                });
                item.addEventListener('click', () => {
                    this.hideSaveSlots();
                    this.game.startPrivateGame(slot);
                });
            } else {
                item.innerHTML = `
                    <div class="save-slot-info">
                        <div class="save-slot-name">存档 ${slot}</div>
                        <div class="save-slot-detail">空槽位</div>
                    </div>
                    <div class="save-slot-actions">
                        <button class="btn-slot-play" data-slot="${slot}">创建</button>
                    </div>
                `;
                item.querySelector('.btn-slot-play').addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.hideSaveSlots();
                    this.game.startPrivateGame(slot);
                });
            }
            container.appendChild(item);
        }

        // 如果5个槽位都满了，禁用创建按钮
        if (usedCount >= SaveSystem.MAX_SLOTS) {
            container.querySelectorAll('.btn-slot-play').forEach(btn => {
                if (btn.textContent === '创建') {
                    btn.disabled = true;
                    btn.textContent = '已满';
                }
            });
        }
    }

    _renderRoomList() {
        const container = document.getElementById('roomList');
        container.innerHTML = '';
        for (const room of OFFICIAL_ROOMS) {
            const item = document.createElement('div');
            item.className = 'room-item';
            item.innerHTML = `
                <div>
                    <div class="room-name">${room.name}</div>
                    <div class="room-desc">${room.desc}</div>
                </div>
                <div class="room-players">点击加入</div>
            `;
            item.addEventListener('click', () => {
                this.hideRoomList();
                this.showCharacterScreen(room.id);
            });
            container.appendChild(item);
        }
    }

    // ===== 多人玩家列表 =====
    showMpPlayerList() {
        document.getElementById('mpPlayerList').style.display = 'block';
    }

    hideMpPlayerList() {
        document.getElementById('mpPlayerList').style.display = 'none';
    }

    updateMpPlayerList() {
        if (!this.game.multiplayer) return;
        const list = this.game.multiplayer.getPlayerList();
        const container = document.getElementById('mpPlayerList');
        let html = '<div style="color:#888;margin-bottom:4px;">在线玩家</div>';
        html += `<div class="mp-player"><span class="mp-player-name">${this.game.characterName || this.game.username} (你)</span> <span class="mp-player-hp">${Math.floor(this.game.survival.health)}HP</span></div>`;
        for (const p of list) {
            html += `<div class="mp-player"><span class="mp-player-name">${p.username}</span> <span class="mp-player-hp">${Math.floor(p.health)}HP</span></div>`;
        }
        container.innerHTML = html;
        this.showMpPlayerList();
    }

    // ===== 聊天系统 =====
    showChat() {
        document.getElementById('chatBox').style.display = 'block';
    }

    hideChat() {
        document.getElementById('chatBox').style.display = 'none';
    }

    addChatMessage(author, text) {
        const container = document.getElementById('chatMessages');
        const msg = document.createElement('div');
        msg.className = 'chat-msg';
        msg.innerHTML = `<span class="chat-author">${author}:</span> ${text}`;
        container.insertBefore(msg, container.firstChild);
        setTimeout(() => msg.remove(), 8000);
    }

    openChatInput() {
        const input = document.getElementById('chatInput');
        input.style.display = 'block';
        input.value = '';
        input.focus();
        if (this.player) this.player.unlockMouse();
    }

    closeChatInput() {
        const input = document.getElementById('chatInput');
        const text = input.value.trim();
        input.style.display = 'none';
        input.value = '';
        if (this.player && this.game.running) this.player.lockMouse();
        if (!text) return;

        // 娱乐场中仅管理员 xy 可使用指令（包括石碑 *tp）
        if (this.game.isArcade && !this.game.isAdmin) {
            if (text.startsWith('/') || text.startsWith('*')) {
                this.addChatMessage('系统', '娱乐场中仅 xy 可使用指令');
                return;
            }
        }

        // 管理员指令处理
        if (text.startsWith('/in ') && (this.game.isAdmin || this.game.gameMode === 'private')) {
            const num = parseInt(text.substring(4).trim());
            const worldMap = { 0: 'normal', 1: 'stone', 2: 'gold' };
            const worldNames = { 0: '主世界', 1: '石维度', 2: '金维度' };
            if (num in worldMap) {
                this.world.switchToWorld(worldMap[num], this.player.position);
                this.player.position.set(0, 5, 0);
                this.addChatMessage('系统', `已传送到${worldNames[num]}`);
            } else {
                this.addChatMessage('系统', '无效维度: 0=主世界 1=石维度 2=金维度');
            }
            return;
        }

        if (text.startsWith('/give ') && (this.game.isAdmin || this.game.gameMode === 'private')) {
            const parts = text.split(' ');
            // /give 谁 物品中文名 [数量]
            if (parts.length >= 3) {
                const targetName = parts[1];
                // 最后一段如果是数字则为数量
                let count = 1;
                let itemNameParts = parts.slice(2);
                const lastPart = itemNameParts[itemNameParts.length - 1];
                if (/^\d+$/.test(lastPart)) {
                    count = parseInt(lastPart) || 1;
                    itemNameParts = itemNameParts.slice(0, -1);
                }
                const itemName = itemNameParts.join(' ');
                if (!itemName) {
                    this.addChatMessage('系统', '请输入物品名称');
                    return;
                }
                // 查找物品ID
                let itemId = null;
                for (const [id, info] of Object.entries(ITEMS)) {
                    if (info.name === itemName) {
                        itemId = id;
                        break;
                    }
                }
                if (!itemId) {
                    this.addChatMessage('系统', `未找到物品: ${itemName}`);
                    return;
                }
                if (targetName === this.game.username) {
                    this.game.inventory.addItem(itemId, count);
                    this.addChatMessage('系统', `获得 ${count}个 ${ITEMS[itemId].name}`);
                } else if (this.game.multiplayer && this.game.multiplayer.connected) {
                    this.game.multiplayer.sendGiveCommand(targetName, itemId, count);
                    this.addChatMessage('系统', `已发送 ${count}个 ${ITEMS[itemId].name} 给 ${targetName}`);
                } else {
                    this.addChatMessage('系统', '未连接到房间');
                }
            }
            return;
        }

        // /召唤 生物名称（管理员指令）
        if (text === '/结束打怪' && this.game.isArcade && this.game.arcadeZombie?.active) {
            this.game.endArcadeZombie();
            return;
        }
        if (text.startsWith('/换剑 ') && this.game.isArcade && this.game.arcadeZombie?.active) {
            const swordName = text.slice(4).trim();
            const swordMap = { '木剑': 'wood_sword', '石剑': 'stone_sword', '铁剑': 'iron_sword' };
            const swordId = swordMap[swordName];
            if (!swordId) {
                this.addChatMessage('系统', '可兑换的剑：木剑(10分)、石剑(30分)、铁剑(50分)');
                return;
            }
            const cost = { 'wood_sword': 10, 'stone_sword': 30, 'iron_sword': 50 }[swordId];
            if (this.game.arcadeZombie.score >= cost) {
                this.game.arcadeZombie.score -= cost;
                this.inventory.addItem(swordId, 1);
                this.addChatMessage('系统', `兑换成功：${swordName}，剩余积分：${this.game.arcadeZombie.score}`);
                if (this.updateZombieScore) this.updateZombieScore();
            } else {
                this.addChatMessage('系统', `积分不足！需要 ${cost} 分，当前 ${this.game.arcadeZombie.score} 分`);
            }
            return;
        }
        if (text.startsWith('/召唤 ') && (this.game.isAdmin || this.game.gameMode === 'private')) {
            const name = text.substring(4).trim();
            const summonMap = {
                '树精': '_spawnTreeSpirit',
                '树守卫': '_spawnTreeGuardian',
                '1_no': '_spawnEnhancedTreeGuardian',
                'no': '_spawnEnhancedTreeGuardian',
                '友好树守卫': '_spawnFriendlyTreeGuardian',
                '石之怪': '_spawnStoneMonster',
                '石化人': '_spawnPetrifiedHuman',
                '石守卫': '_spawnStoneGuardian',
                '石志怪': '_spawnStoneMonsterBoss',
                '巨石怪': '_spawnGiantStoneBoss',
                '僵尸': '_spawnZombie',
                '沙漠僵尸': '_spawnDesertZombie',
                '金僵尸': '_spawnGoldZombie',
                '金之怪': '_spawnGoldMonster',
                '金树精': '_spawnGoldTreeSpirit',
                '元素王': '_spawnElementKing',
                '假树': '_spawnFakeTree',
                '牛': '_spawnCow',
                '骆驼': '_spawnCamel',
                '骆驼_1': '_spawnTamedCamel',
                'no_1': '_spawnTamedCamel',
            };
            const methodName = summonMap[name];
            if (!methodName) {
                // 指令错误时不提示
                return;
            }
            const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.player.pitch, this.player.yaw, 0, 'YXZ'));
            const pos = this.player.position.clone().add(dir.multiplyScalar(5));
            pos.y = this.world.getHeight(pos.x, pos.z);
            if (window.game && window.game.enemies) {
                window.game.enemies[methodName](pos.x, pos.y, pos.z);
                this.addChatMessage('系统', `已召唤 ${name}`);
            }
            // 骆驼及已驯服骆驼需要同步给其他玩家
            const netType = { '骆驼': 'camel', '骆驼_1': 'tamed_camel', 'no_1': 'tamed_camel' }[name];
            if (netType && this.game.multiplayer && this.game.multiplayer.connected) {
                this.game.multiplayer.sendBossSpawn(netType, pos.x, pos.y, pos.z);
            }
            return;
        }

        // *tp 传送指令（所有人可用）
        if (text.startsWith('*tp ')) {
            const name = text.substring(4).trim();
            if (!name) {
                this.addChatMessage('系统', '请输入石碑名称: *tp 石碑名称');
                return;
            }
            if (this._teleportToMonument(name)) {
                this.addChatMessage('系统', `已传送到石碑: ${name}`);
            } else {
                this.addChatMessage('系统', `未找到名为"${name}"的石碑`);
            }
            return;
        }

        if (this.game.multiplayer) {
            this.game.multiplayer.sendChat(text);
            this.addChatMessage(this.game.username, text);
        }
    }
}
