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
        document.getElementById('btnPrivateGame').addEventListener('click', () => {
            this.hideMainMenu();
            this.showSaveSlots();
        });
        document.getElementById('btnMultiplayer').addEventListener('click', () => {
            this.hideMainMenu();
            this.showRoomList();
        });
        document.getElementById('btnBackToLogin').addEventListener('click', () => {
            this.hideMainMenu();
            this.showLogin();
        });
        document.getElementById('btnBackToMenu').addEventListener('click', () => {
            this.hideRoomList();
            this.showMainMenu(this.game.username);
        });
        document.getElementById('btnBackToMenuFromSlots').addEventListener('click', () => {
            this.hideSaveSlots();
            this.showMainMenu(this.game.username);
        });

        // 页面关闭/刷新时自动保存
        window.addEventListener('beforeunload', () => {
            if (this.game.username && this.game.running) {
                if (this.game.gameMode === 'private') {
                    SaveSystem.saveSlot(this.game.username, this.game.currentSlot || 1, this.game);
                } else if (this.game.gameMode === 'multiplayer') {
                    SaveSystem.saveMultiplayer(this.game.username, this.game);
                }
            }
        });
        // 页面隐藏时保存（切标签页、最小化等）
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.game.username && this.game.running) {
                if (this.game.gameMode === 'private') {
                    SaveSystem.saveSlot(this.game.username, this.game.currentSlot || 1, this.game);
                } else if (this.game.gameMode === 'multiplayer') {
                    SaveSystem.saveMultiplayer(this.game.username, this.game);
                }
            }
        });

        // 聊天：T键打开输入框
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyT' && this.game.running && this.game.multiplayer && this.game.multiplayer.connected) {
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

        // ESC释放鼠标
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyI') this._togglePanel('inventoryUI');
            if (e.code === 'KeyC') this._togglePanel('craftingUI');
            if (e.code === 'KeyB') this._toggleBuildMode();
            if (e.code === 'KeyE') this.player.interact();
            if (e.code === 'KeyL' && this._anyPanelOpen() && this.selectedInvSlot !== null) {
                // L键删除选中物品
                this.inventory.items[this.selectedInvSlot] = null;
                this.selectedInvSlot = null;
                this._clearHighlight();
                this._renderInventory();
            }
            if (e.code === 'Escape') {
                if (this.player.mouseLocked) this.player.unlockMouse();
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
               document.getElementById('mysteryBoxUI').style.display !== 'none';
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
        if (!Array.isArray(altar.goldAltarStorage) || altar.goldAltarStorage.length < 2) {
            altar.goldAltarStorage = [null, null];
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
        const storageGrid = document.getElementById('goldAltarStorageGrid');
        const inventoryGrid = document.getElementById('goldAltarInventoryGrid');

        storageGrid.innerHTML = '';
        for (let i = 0; i < 2; i++) {
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
            storageGrid.appendChild(slot);
        }

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
        // 检查2个格子：一个放穿越器(portal)>=1，一个放石头(stone)>=5
        const s0 = altar.goldAltarStorage[0];
        const s1 = altar.goldAltarStorage[1];
        let portalSlot = null, stoneSlot = null;
        if (s0 && s0.id === 'portal' && s0.amount >= 1) portalSlot = 0;
        if (s1 && s1.id === 'portal' && s1.amount >= 1) portalSlot = 1;
        if (s0 && s0.id === 'stone' && s0.amount >= 5) stoneSlot = 0;
        if (s1 && s1.id === 'stone' && s1.amount >= 5) stoneSlot = 1;
        if (portalSlot !== null && stoneSlot !== null && portalSlot !== stoneSlot) {
            // 消耗1个穿越器和5个石头
            altar.goldAltarStorage[portalSlot].amount -= 1;
            if (altar.goldAltarStorage[portalSlot].amount <= 0) altar.goldAltarStorage[portalSlot] = null;
            altar.goldAltarStorage[stoneSlot].amount -= 5;
            if (altar.goldAltarStorage[stoneSlot].amount <= 0) altar.goldAltarStorage[stoneSlot] = null;
            // 关闭UI
            this.activeGoldAltar = null;
            document.getElementById('goldAltarUI').style.display = 'none';
            this.player.lockMouse();
            // 传送到金维度
            this.world.switchToWorld('gold', this.player.position);
            this.player.position.set(0, 5, 0);
            if (window.game) window.game.onMessage('🌟 献祭成功！传送到了金维度！');
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
        grid.innerHTML = '';
        this.selectedInvSlot = null;
        // 只显示背包部分（槽位5-24）
        for (let i = this.inventory.hotbarSize; i < this.inventory.size; i++) {
            const item = this.inventory.items[i];
            const slot = document.createElement('div');
            slot.className = 'inv-slot' + (item ? '' : ' empty');
            if (item) {
                const info = ITEMS[item.id];
                slot.innerHTML = `<span class="slot-icon">${itemIconSVG(item.id)}</span><span class="slot-count">${item.amount > 1 ? item.amount : ''}</span>`;
                slot.title = `${info?.name || item.id} x${item.amount}`;
            }
            let touchHandled2 = false;
            const slotHandler = (e) => {
                if (e.type === 'click' && touchHandled2) { touchHandled2 = false; return; }
                if (e.type === 'touchstart') { touchHandled2 = true; }
                // 右键装备盔甲/护身符
                if (e.type === 'contextmenu' || (e.button === 2)) {
                    if (item && ITEMS[item.id] && ITEMS[item.id].equipable) {
                        const equipSlot = ITEMS[item.id].equip_slot;
                        this.inventory.equipItem(i);
                        this._syncArmor();
                        if (equipSlot === 'talisman') this._syncTalismans();
                        this._renderEquipment();
                        this._renderInventory();
                    }
                    if (e) { e.stopPropagation(); e.preventDefault(); }
                    return;
                }
                if (this.selectedInvSlot === null) {
                    // 第一次点击：选中
                    this.selectedInvSlot = i;
                    this._highlightSlot(slot);
                } else if (this.selectedInvSlot === i) {
                    // 再次点击同一个：取消选中
                    this.selectedInvSlot = null;
                    this._clearHighlight();
                } else {
                    // 第二次点击：交换
                    this.inventory.moveItem(this.selectedInvSlot, i);
                    this.selectedInvSlot = null;
                    this._clearHighlight();
                    this._renderInventory();
                }
                if (e) { e.stopPropagation(); e.preventDefault(); }
            };
            slot.addEventListener('click', slotHandler);
            slot.addEventListener('touchstart', slotHandler, { passive: false });
            slot.addEventListener('contextmenu', (e) => {
                if (item && ITEMS[item.id] && ITEMS[item.id].equipable) {
                    this.inventory.equipItem(i);
                    this._syncArmor();
                    this._renderEquipment();
                    this._renderInventory();
                }
                e.stopPropagation(); e.preventDefault();
            });
            grid.appendChild(slot);
        }
        this._renderEquipment();
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
        for (const b of this.game.world.buildings) {
            if (b.type === 'teleport_monument' && b.monumentName === name) {
                target = b;
                break;
            }
        }
        if (target) {
            const pos = target.mesh.position;
            this.player.position.set(pos.x, pos.y + 3, pos.z);
            this.game.world.updateChunks(this.player.position);
            this.game.onMessage('已传送到石碑: ' + name);
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
        // 左侧：神木放置槽
        const divineSlot = document.getElementById('mysteryBoxDivineSlot');
        const divineItem = mb.mysteryBoxStorage[0];
        divineSlot.className = 'inv-slot' + (divineItem ? '' : ' empty');
        if (divineItem) {
            divineSlot.innerHTML = `<span class="slot-icon">${itemIconSVG(divineItem.id)}</span><span class="slot-count">${divineItem.amount > 1 ? divineItem.amount : ''}</span>`;
            divineSlot.title = `${ITEMS[divineItem.id]?.name || divineItem.id} x${divineItem.amount}`;
        } else {
            divineSlot.innerHTML = '';
            divineSlot.title = '放入神木';
        }
        divineSlot.onclick = () => this._mysteryBoxTakeOut(0);

        // 右侧：木质装备放置槽
        const equipSlot = document.getElementById('mysteryBoxEquipSlot');
        const equipItem = mb.mysteryBoxStorage[1];
        equipSlot.className = 'inv-slot' + (equipItem ? '' : ' empty');
        if (equipItem) {
            const charge = equipItem.charge || 0;
            equipSlot.innerHTML = `<span class="slot-icon">${itemIconSVG(equipItem.id)}</span>${charge > 0 ? `<span class="slot-count" style="color:#ffd700">+${charge}</span>` : ''}`;
            equipSlot.title = `${ITEMS[equipItem.id]?.name || equipItem.id}${charge > 0 ? ' (充能+' + charge + ')' : ''}`;
        } else {
            equipSlot.innerHTML = '';
            equipSlot.title = '放入木质装备';
        }
        equipSlot.onclick = () => this._mysteryBoxTakeOut(1);

        // 库存列表：显示神木和可充能装备
        const invGrid = document.getElementById('mysteryBoxInventoryGrid');
        invGrid.innerHTML = '';
        for (let i = 0; i < this.inventory.size; i++) {
            const item = this.inventory.items[i];
            if (!item) continue;
            const isDivine = item.id === 'divine_wood' || item.id === 'gold_coin';
            const isChargeable = CHARGEABLE_WOOD_ITEMS.includes(item.id) || CHARGEABLE_GOLD_PAN_ITEMS.includes(item.id);
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
        const hasEquip = equipItem && (CHARGEABLE_WOOD_ITEMS.includes(equipItem.id) || CHARGEABLE_GOLD_PAN_ITEMS.includes(equipItem.id));
        btnStart.disabled = !(hasDivine && hasEquip);
    }

    _mysteryBoxPutIn(invIndex) {
        if (!this.activeMysteryBox) return;
        const item = this.inventory.items[invIndex];
        if (!item) return;
        const mb = this.activeMysteryBox;
        if (item.id === 'divine_wood' || item.id === 'gold_coin') {
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
        } else if (CHARGEABLE_WOOD_ITEMS.includes(item.id) || CHARGEABLE_GOLD_PAN_ITEMS.includes(item.id)) {
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
        // 消耗1个充能材料，装备充能+1
        divineItem.amount -= 1;
        if (divineItem.amount <= 0) mb.mysteryBoxStorage[0] = null;
        equipItem.charge = (equipItem.charge || 0) + 1;
        this.game.onMessage(`充能成功！${ITEMS[equipItem.id]?.name || equipItem.id} 充能+1 (当前: +${equipItem.charge})`);
        this._renderMysteryBox();
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
        document.getElementById('mainMenuScreen').style.display = 'flex';
    }

    hideMainMenu() {
        document.getElementById('mainMenuScreen').style.display = 'none';
    }

    // ===== 房间列表 =====
    showRoomList() {
        document.getElementById('roomListScreen').style.display = 'flex';
        this._renderRoomList();
    }

    hideRoomList() {
        document.getElementById('roomListScreen').style.display = 'none';
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
                this.game.startMultiplayerGame(room.id);
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
        html += `<div class="mp-player"><span class="mp-player-name">${this.game.username} (你)</span> <span class="mp-player-hp">${Math.floor(this.game.survival.health)}HP</span></div>`;
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

        // 管理员指令处理
        if (text.startsWith('/give ') && this.game.isAdmin) {
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

        // /k 传送指令
        if (text.startsWith('/k ')) {
            const name = text.substring(3).trim();
            if (!name) {
                this.addChatMessage('系统', '请输入石碑名称: /k 石碑名称');
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
