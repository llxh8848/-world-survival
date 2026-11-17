// 存档系统：每个用户一个存档，使用 localStorage

class SaveSystem {
    static getUserList() {
        try {
            return JSON.parse(localStorage.getItem('ws_users') || '[]');
        } catch { return []; }
    }

    static _saveUserList(list) {
        localStorage.setItem('ws_users', JSON.stringify(list));
    }

    static userExists(username) {
        return this.getUserList().includes(username);
    }

    static _getPasswordKey(username) {
        return 'ws_pass_' + username;
    }

    static setPassword(username, password) {
        localStorage.setItem(this._getPasswordKey(username), password);
    }

    static checkPassword(username, password) {
        const stored = localStorage.getItem(this._getPasswordKey(username));
        return stored === password;
    }

    static hasPassword(username) {
        return localStorage.getItem(this._getPasswordKey(username)) !== null;
    }

    static createUser(username, password) {
        const list = this.getUserList();
        if (!list.includes(username)) {
            list.push(username);
            this._saveUserList(list);
        }
        if (password) this.setPassword(username, password);
    }

    // ===== 设备绑定：一台电脑只能登录一个账号 =====
    static getDeviceUser() {
        return localStorage.getItem('ws_device_user');
    }

    static bindDeviceUser(username) {
        localStorage.setItem('ws_device_user', username);
    }

    static deleteUser(username) {
        const list = this.getUserList().filter(u => u !== username);
        this._saveUserList(list);
        localStorage.removeItem('ws_save_' + username);
        for (let i = 1; i <= this.MAX_SLOTS; i++) {
            localStorage.removeItem(this.getSlotSaveKey(username, i));
        }
        localStorage.removeItem(this._getPasswordKey(username));
        // 删除的是本机绑定账号时解除绑定，避免机器被锁死
        if (this.getDeviceUser() === username) {
            localStorage.removeItem('ws_device_user');
        }
    }

    static getSaveKey(username) {
        return 'ws_save_' + username;
    }

    // ===== 多存档槽位系统（最多5个） =====
    static MAX_SLOTS = 5;

    static getSlotSaveKey(username, slot) {
        return 'ws_save_' + username + '_slot' + slot;
    }

    static saveSlot(username, slot, game) {
        if (!username || !game) return;
        const normalBldgs = game.world.worldType === 'normal' ? game.world.buildings : (game.world._normalBuildings || []);
        const stoneBldgs = game.world.worldType === 'stone' ? game.world.buildings : (game.world._stoneBuildings || []);
        const goldBldgs = game.world.worldType === 'gold' ? game.world.buildings : (game.world._goldBuildings || []);
        const data = {
            version: 1,
            timestamp: Date.now(),
            player: {
                x: game.player.position.x,
                y: game.player.position.y,
                z: game.player.position.z,
                yaw: game.player.yaw,
                pitch: game.player.pitch,
            },
            inventory: game.inventory.items.map(item => item ? { id: item.id, amount: item.amount, charge: item.charge || 0, uses: item.uses || 0 } : null),
            equipment: { ...game.inventory.equipment },
            survival: {
                health: game.survival.health,
                hunger: game.survival.hunger,
                thirst: game.survival.thirst,
                temperature: game.survival.temperature,
            },
            world: {
                dayCount: game.world.dayCount,
                currentHour: game.world.currentHour,
                worldType: game.world.worldType || 'normal',
                returnPosition: game.world.returnPosition ? { x: game.world.returnPosition.x, y: game.world.returnPosition.y, z: game.world.returnPosition.z } : null,
            },
            buildings: this._serializeBuildings(normalBldgs),
            stoneBuildings: this._serializeBuildings(stoneBldgs),
            goldBuildings: this._serializeBuildings(goldBldgs),
            achievements: game.achievements || {},
            achievementProgress: game.achievementProgress || {},
        };
        try {
            localStorage.setItem(this.getSlotSaveKey(username, slot), JSON.stringify(data));
        } catch (e) {
            console.error('Slot save failed:', e);
        }
    }

    static loadSlot(username, slot) {
        try {
            const raw = localStorage.getItem(this.getSlotSaveKey(username, slot));
            if (!raw) return null;
            return JSON.parse(raw);
        } catch { return null; }
    }

    static hasSlotSave(username, slot) {
        return localStorage.getItem(this.getSlotSaveKey(username, slot)) !== null;
    }

    static deleteSlotSave(username, slot) {
        localStorage.removeItem(this.getSlotSaveKey(username, slot));
    }

    static getSlotInfo(username, slot) {
        const data = this.loadSlot(username, slot);
        if (!data) return null;
        return {
            day: data.world?.dayCount || 1,
            timestamp: data.timestamp || 0,
            health: data.survival?.health ?? 100,
        };
    }

    static getUsedSlotCount(username) {
        let count = 0;
        for (let i = 1; i <= this.MAX_SLOTS; i++) {
            if (this.hasSlotSave(username, i)) count++;
        }
        return count;
    }

    static applySlotSave(username, slot, game) {
        const data = this.loadSlot(username, slot);
        if (!data) return false;
        return this._applyData(data, game);
    }

    static getMpSaveKey(username, roomId) {
        return 'ws_mpsave_' + (roomId || 'unknown') + '_' + username;
    }

    static _serializeBuildings(buildings) {
        return buildings.map(b => ({
            type: b.type,
            x: b.mesh.position.x,
            y: b.mesh.position.y,
            z: b.mesh.position.z,
            ry: b.mesh.rotation.y,
            minerTimer: b.minerTimer || 0,
            minerStorage: b.minerStorage || [],
            minerTools: (b.minerTools || []).map(tool => tool ? { id: tool.id, amount: tool.amount || 1 } : null),
            chestStorage: b.chestStorage || [],
            monumentName: b.monumentName || null,
            mysteryBoxStorage: b.mysteryBoxStorage || null,
            goldAltarStorage: b.goldAltarStorage || null,
            forgeStorage: b.forgeStorage || null,
        }));
    }

    static saveMultiplayer(username, roomId, game) {
        if (!username || !game) return;
        const normalBldgs = game.world.worldType === 'normal' ? game.world.buildings : (game.world._normalBuildings || []);
        const stoneBldgs = game.world.worldType === 'stone' ? game.world.buildings : (game.world._stoneBuildings || []);
        const goldBldgs = game.world.worldType === 'gold' ? game.world.buildings : (game.world._goldBuildings || []);
        const stoneCaveEnt = (game.world.worldType === 'stone')
            ? (game.world.getCaveEntrances ? game.world.getCaveEntrances() : (game.world._stoneCaveEntrances || []))
            : (game.world._stoneCaveEntrances || []);
        const data = {
            version: 1,
            timestamp: Date.now(),
            player: {
                x: game.player.position.x,
                y: game.player.position.y,
                z: game.player.position.z,
                yaw: game.player.yaw,
                pitch: game.player.pitch,
            },
            inventory: game.inventory.items.map(item => item ? { id: item.id, amount: item.amount, charge: item.charge || 0, uses: item.uses || 0 } : null),
            equipment: { ...game.inventory.equipment },
            survival: {
                health: game.survival.health,
                hunger: game.survival.hunger,
                thirst: game.survival.thirst,
                temperature: game.survival.temperature,
            },
            world: {
                dayCount: game.world.dayCount,
                currentHour: game.world.currentHour,
                worldType: game.world.worldType || 'normal',
                returnPosition: game.world.returnPosition ? { x: game.world.returnPosition.x, y: game.world.returnPosition.y, z: game.world.returnPosition.z } : null,
            },
            buildings: this._serializeBuildings(normalBldgs),
            stoneBuildings: this._serializeBuildings(stoneBldgs),
            goldBuildings: this._serializeBuildings(goldBldgs),
            stoneCaveEntrances: stoneCaveEnt,
            achievements: game.achievements || {},
            achievementProgress: game.achievementProgress || {},
        };
        try {
            localStorage.setItem(this.getMpSaveKey(username, roomId), JSON.stringify(data));
        } catch (e) {
            console.error('MP save failed:', e);
        }
    }

    static loadMultiplayer(username, roomId) {
        try {
            const raw = localStorage.getItem(this.getMpSaveKey(username, roomId));
            if (!raw) return null;
            return JSON.parse(raw);
        } catch { return null; }
    }

    static hasMpSave(username, roomId) {
        return localStorage.getItem(this.getMpSaveKey(username, roomId)) !== null;
    }

    static applyMpSave(username, roomId, game) {
        const data = this.loadMultiplayer(username, roomId);
        if (!data) return false;
        // 复用 applySave 的逻辑
        return this._applyData(data, game);
    }

    static _applyData(data, game) {
        // 玩家位置
        if (data.player) {
            game.player.position.set(data.player.x, data.player.y, data.player.z);
            game.player.yaw = data.player.yaw || 0;
            game.player.pitch = data.player.pitch || 0;
        }

        // 背包
        if (data.inventory) {
            for (let i = 0; i < game.inventory.size && i < data.inventory.length; i++) {
                const saved = data.inventory[i];
                game.inventory.items[i] = saved ? { id: saved.id, amount: saved.amount, charge: saved.charge || 0, uses: saved.uses || 0 } : null;
            }
            game.inventory.notify();
        }

        // 装备
        if (data.equipment) {
            game.inventory.equipment = { head: null, chest: null, legs: null, feet: null, talisman1: null, talisman2: null, talisman3: null, talisman4: null };
            for (const slot of ['head', 'chest', 'legs', 'feet', 'talisman1', 'talisman2', 'talisman3', 'talisman4']) {
                if (data.equipment[slot]) {
                    game.inventory.equipment[slot] = { id: data.equipment[slot].id, amount: 1, charge: data.equipment[slot].charge || 0 };
                }
            }
        }

        // 同步盔甲值和护身符
        if (game.survival) {
            game.survival.setArmor(game.inventory.getArmorValue());
            const talismans = ['talisman1', 'talisman2', 'talisman3', 'talisman4'].map(s => game.inventory.equipment[s]).filter(Boolean);
            game.survival.setTalismans(talismans);
        }

        // 生存属性
        if (data.survival) {
            game.survival.health = data.survival.health ?? 100;
            game.survival.hunger = data.survival.hunger ?? 100;
            game.survival.thirst = data.survival.thirst ?? 100;
            game.survival.temperature = data.survival.temperature ?? 37;
            game.survival.dead = false;
            game.survival.notify();
        }

        // 世界时间
        if (data.world) {
            game.world.dayCount = data.world.dayCount || 1;
            game.world.currentHour = data.world.currentHour || 8.0;
        }

        // 成就
        if (data.achievements) {
            game.achievements = data.achievements;
        }
        if (data.achievementProgress) {
            game.achievementProgress = data.achievementProgress;
        }

        // 恢复建筑：先清除现有建筑，再从存档恢复
        for (const b of game.world.buildings) {
            game.scene.remove(b.mesh);
        }
        game.world.buildings = [];
        game.world.campfires = [];

        if (data.buildings) {
            for (const b of data.buildings) {
                const pos = new THREE.Vector3(b.x, b.y, b.z);
                game.world.placeBuilding(b.type, pos, b.ry || 0);
                const placed = game.world.buildings[game.world.buildings.length - 1];
                if (b.minerTimer) placed.minerTimer = b.minerTimer;
                if (b.minerStorage) placed.minerStorage = b.minerStorage;
                if (b.minerTools) placed.minerTools = b.minerTools;
                if (b.chestStorage) placed.chestStorage = b.chestStorage;
                if (b.monumentName) placed.monumentName = b.monumentName;
                if (b.mysteryBoxStorage) placed.mysteryBoxStorage = b.mysteryBoxStorage;
                if (b.goldAltarStorage) placed.goldAltarStorage = b.goldAltarStorage;
                if (b.forgeStorage) placed.forgeStorage = b.forgeStorage;
            }
        }

        // 恢复石头世界建筑（存入_stoneBuildings，不加入场景）
        game.world._stoneBuildings = null;
        game.world._stoneCampfires = null;
        if (data.stoneBuildings && data.stoneBuildings.length > 0) {
            const normalBldgCount = game.world.buildings.length;
            const normalCfCount = game.world.campfires.length;
            for (const b of data.stoneBuildings) {
                const pos = new THREE.Vector3(b.x, b.y, b.z);
                game.world.placeBuilding(b.type, pos, b.ry || 0);
                const placed = game.world.buildings[game.world.buildings.length - 1];
                if (b.minerTimer) placed.minerTimer = b.minerTimer;
                if (b.minerStorage) placed.minerStorage = b.minerStorage;
                if (b.minerTools) placed.minerTools = b.minerTools;
                if (b.chestStorage) placed.chestStorage = b.chestStorage;
                if (b.monumentName) placed.monumentName = b.monumentName;
                if (b.mysteryBoxStorage) placed.mysteryBoxStorage = b.mysteryBoxStorage;
                if (b.goldAltarStorage) placed.goldAltarStorage = b.goldAltarStorage;
                if (b.forgeStorage) placed.forgeStorage = b.forgeStorage;
            }
            game.world._stoneBuildings = game.world.buildings.splice(normalBldgCount);
            game.world._stoneCampfires = game.world.campfires.splice(normalCfCount);
            for (const b of game.world._stoneBuildings) {
                game.scene.remove(b.mesh);
            }
        }

        // 恢复金维度建筑（存入_goldBuildings，不加入场景）
        game.world._goldBuildings = null;
        game.world._goldCampfires = null;
        if (data.goldBuildings && data.goldBuildings.length > 0) {
            const normalBldgCount2 = game.world.buildings.length;
            const normalCfCount2 = game.world.campfires.length;
            for (const b of data.goldBuildings) {
                const pos = new THREE.Vector3(b.x, b.y, b.z);
                game.world.placeBuilding(b.type, pos, b.ry || 0);
                const placed = game.world.buildings[game.world.buildings.length - 1];
                if (b.minerTimer) placed.minerTimer = b.minerTimer;
                if (b.minerStorage) placed.minerStorage = b.minerStorage;
                if (b.minerTools) placed.minerTools = b.minerTools;
                if (b.chestStorage) placed.chestStorage = b.chestStorage;
                if (b.monumentName) placed.monumentName = b.monumentName;
                if (b.mysteryBoxStorage) placed.mysteryBoxStorage = b.mysteryBoxStorage;
                if (b.goldAltarStorage) placed.goldAltarStorage = b.goldAltarStorage;
                if (b.forgeStorage) placed.forgeStorage = b.forgeStorage;
            }
            game.world._goldBuildings = game.world.buildings.splice(normalBldgCount2);
            game.world._goldCampfires = game.world.campfires.splice(normalCfCount2);
            for (const b of game.world._goldBuildings) {
                game.scene.remove(b.mesh);
            }
        }

        // 恢复石维度矿洞入口位置（供后续进入石维度或切换时使用）
        if (data.stoneCaveEntrances && Array.isArray(data.stoneCaveEntrances)) {
            game.world._stoneCaveEntrances = data.stoneCaveEntrances;
        } else {
            game.world._stoneCaveEntrances = game.world._stoneCaveEntrances || null;
        }

        // 恢复维度：如果存档时在石头世界，切换到石头世界
        if (data.world && data.world.worldType === 'stone' && game.world.worldType !== 'stone') {
            const retPos = data.world.returnPosition
                ? new THREE.Vector3(data.world.returnPosition.x, data.world.returnPosition.y, data.world.returnPosition.z)
                : new THREE.Vector3(0, 0, 0);
            game.world.switchToWorld('stone', retPos);
            if (data.player) {
                const playerPos = new THREE.Vector3(data.player.x, data.player.y, data.player.z);
                game.world.updateChunks(playerPos);
            }
        }

        // 恢复维度：如果存档时在金维度，切换到金维度
        if (data.world && data.world.worldType === 'gold' && game.world.worldType !== 'gold') {
            const retPos = data.world.returnPosition
                ? new THREE.Vector3(data.world.returnPosition.x, data.world.returnPosition.y, data.world.returnPosition.z)
                : new THREE.Vector3(0, 0, 0);
            game.world.switchToWorld('gold', retPos);
            if (data.player) {
                const playerPos = new THREE.Vector3(data.player.x, data.player.y, data.player.z);
                game.world.updateChunks(playerPos);
            }
        }

        // 兜底：若当前已在石维度且有暂存入口，立即恢复（确保单人/多人切换后可见）
        if (game.world.worldType === 'stone' && game.world._stoneCaveEntrances && game.world.restoreCaveEntrances) {
            try { game.world.restoreCaveEntrances(game.world._stoneCaveEntrances); } catch (e) {}
        }

        return true;
    }

    static save(username, game) {
        if (!username || !game) return;
        const normalBldgs = game.world.worldType === 'normal' ? game.world.buildings : (game.world._normalBuildings || []);
        const stoneBldgs = game.world.worldType === 'stone' ? game.world.buildings : (game.world._stoneBuildings || []);
        const goldBldgs = game.world.worldType === 'gold' ? game.world.buildings : (game.world._goldBuildings || []);
        const stoneCaveEnt = (game.world.worldType === 'stone')
            ? (game.world.getCaveEntrances ? game.world.getCaveEntrances() : (game.world._stoneCaveEntrances || []))
            : (game.world._stoneCaveEntrances || []);
        const data = {
            version: 1,
            timestamp: Date.now(),
            player: {
                x: game.player.position.x,
                y: game.player.position.y,
                z: game.player.position.z,
                yaw: game.player.yaw,
                pitch: game.player.pitch,
            },
            inventory: game.inventory.items.map(item => item ? { id: item.id, amount: item.amount, charge: item.charge || 0, uses: item.uses || 0 } : null),
            equipment: { ...game.inventory.equipment },
            survival: {
                health: game.survival.health,
                hunger: game.survival.hunger,
                thirst: game.survival.thirst,
                temperature: game.survival.temperature,
            },
            world: {
                dayCount: game.world.dayCount,
                currentHour: game.world.currentHour,
                worldType: game.world.worldType || 'normal',
                returnPosition: game.world.returnPosition ? { x: game.world.returnPosition.x, y: game.world.returnPosition.y, z: game.world.returnPosition.z } : null,
            },
            buildings: this._serializeBuildings(normalBldgs),
            stoneBuildings: this._serializeBuildings(stoneBldgs),
            goldBuildings: this._serializeBuildings(goldBldgs),
            stoneCaveEntrances: stoneCaveEnt,
        };
        try {
            localStorage.setItem(this.getSaveKey(username), JSON.stringify(data));
        } catch (e) {
            console.error('Save failed:', e);
        }
    }

    static load(username) {
        try {
            const raw = localStorage.getItem(this.getSaveKey(username));
            if (!raw) return null;
            return JSON.parse(raw);
        } catch { return null; }
    }

    static hasSave(username) {
        return localStorage.getItem(this.getSaveKey(username)) !== null;
    }

    static getSaveInfo(username) {
        const data = this.load(username);
        if (!data) return null;
        return {
            day: data.world?.dayCount || 1,
            timestamp: data.timestamp || 0,
        };
    }

    static applySave(username, game) {
        const data = this.load(username);
        if (!data) return false;
        return this._applyData(data, game);
    }

    // ===== 娱乐室（Arcade）存档 =====
    static getArcadeSaveKey(username) {
        return 'ws_arcade_save_' + username;
    }

    static saveArcade(username, game) {
        if (!username || !game) return;
        const data = {
            version: 1,
            timestamp: Date.now(),
            berryUpgrades: game.berryUpgrades || { wood_sword: 0, wood_pickaxe: 0, efficiency: 1, collectCount: 0, randomizerCount: 0 },
            inventory: game.inventory.items.map(item => item ? { id: item.id, amount: item.amount, charge: item.charge || 0, uses: item.uses || 0 } : null),
            arcadeZombie: game.arcadeZombie || { active: false, score: 0, leaderboard: [] },
        };
        try {
            localStorage.setItem(this.getArcadeSaveKey(username), JSON.stringify(data));
        } catch (e) {
            console.error('Arcade save failed:', e);
        }
    }

    static hasArcadeSave(username) {
        return localStorage.getItem(this.getArcadeSaveKey(username)) !== null;
    }

    static loadArcadeSave(username) {
        try {
            const raw = localStorage.getItem(this.getArcadeSaveKey(username));
            if (!raw) return null;
            return JSON.parse(raw);
        } catch { return null; }
    }

    static applyArcadeSave(username, game) {
        const data = this.loadArcadeSave(username);
        if (!data) return false;
        if (data.berryUpgrades) {
            game.berryUpgrades = { ...data.berryUpgrades };
        }
        if (data.inventory) {
            const size = game.inventory.size || game.inventory.items.length;
            for (let i = 0; i < size && i < data.inventory.length; i++) {
                const saved = data.inventory[i];
                game.inventory.items[i] = saved ? { id: saved.id, amount: saved.amount, charge: saved.charge || 0, uses: saved.uses || 0 } : null;
            }
            game.inventory.notify();
        }
        if (data.arcadeZombie) {
            game.arcadeZombie = { ...data.arcadeZombie };
        }
        return true;
    }
}
