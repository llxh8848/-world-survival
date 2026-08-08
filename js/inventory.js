// 背包与快捷栏系统

class Inventory {
    constructor() {
        this.hotbarSize = 5;
        this.backpackSize = 20;
        this.size = this.hotbarSize + this.backpackSize; // 25 total
        this.items = new Array(this.size).fill(null); // {id, amount}
        this.selectedSlot = 0;
        this.equipment = { head: null, chest: null, legs: null, feet: null, talisman1: null, talisman2: null, talisman3: null, talisman4: null };
        this.listeners = [];
    }

    onChange(fn) { this.listeners.push(fn); }
    notify() { this.listeners.forEach(fn => fn()); }

    addItem(itemId, amount = 1) {
        if (!ITEMS[itemId]) return amount;
        const info = ITEMS[itemId];
        const maxStack = info.stackable ? (info.maxStack || 99) : 1;
        let remaining = amount;

        // 先堆叠到已有格子（快捷栏优先）
        if (info.stackable) {
            for (let i = 0; i < this.size && remaining > 0; i++) {
                if (this.items[i] && this.items[i].id === itemId && this.items[i].amount < maxStack) {
                    const space = maxStack - this.items[i].amount;
                    const add = Math.min(space, remaining);
                    this.items[i].amount += add;
                    remaining -= add;
                }
            }
        }
        // 再找空格子（快捷栏0-4优先，然后背包5-24）
        for (let i = 0; i < this.size && remaining > 0; i++) {
            if (!this.items[i]) {
                const add = Math.min(maxStack, remaining);
                this.items[i] = { id: itemId, amount: add };
                remaining -= add;
            }
        }
        this.notify();
        return remaining;
    }

    removeItem(itemId, amount = 1) {
        let remaining = amount;
        // 先从背包移除（5-24），再从快捷栏移除（0-4）
        for (let i = this.size - 1; i >= 0 && remaining > 0; i--) {
            if (this.items[i] && this.items[i].id === itemId) {
                const remove = Math.min(this.items[i].amount, remaining);
                this.items[i].amount -= remove;
                remaining -= remove;
                if (this.items[i].amount <= 0) this.items[i] = null;
            }
        }
        this.notify();
        return remaining;
    }

    hasItem(itemId, amount = 1) {
        return this.getItemCount(itemId) >= amount;
    }

    getItemCount(itemId) {
        let count = 0;
        for (const item of this.items) {
            if (item && item.id === itemId) count += item.amount;
        }
        return count;
    }

    getSelectedItem() {
        return this.items[this.selectedSlot] || null;
    }

    selectSlot(index) {
        if (index >= 0 && index < this.hotbarSize) {
            this.selectedSlot = index;
            this.notify();
        }
    }

    getHotbarItems() {
        return this.items.slice(0, this.hotbarSize);
    }

    getBackpackItems() {
        return this.items.slice(this.hotbarSize);
    }

    equipItem(slotIndex) {
        if (slotIndex < 0 || slotIndex >= this.size) return false;
        const item = this.items[slotIndex];
        if (!item) return false;
        const info = ITEMS[item.id];
        if (!info || !info.equipable) return false;
        const slot = info.equip_slot;
        let actualSlot = slot;
        if (slot === 'talisman') {
            actualSlot = ['talisman1', 'talisman2', 'talisman3', 'talisman4'].find(s => !this.equipment[s]);
            if (!actualSlot) return false;
        }
        const prev = this.equipment[actualSlot];
        this.equipment[actualSlot] = { id: item.id, amount: 1, charge: item.charge || 0, uses: item.uses || 0 };
        if (item.amount > 1) {
            item.amount -= 1;
        } else {
            this.items[slotIndex] = null;
        }
        if (prev) {
            this.items[slotIndex] = prev;
        }
        this.notify();
        return true;
    }

    unequipItem(equipSlot) {
        const item = this.equipment[equipSlot];
        if (!item) return false;
        const emptyIndex = this.items.findIndex(s => !s);
        if (emptyIndex < 0) return false;
        this.items[emptyIndex] = item;
        this.equipment[equipSlot] = null;
        this.notify();
        return true;
    }

    getArmorValue() {
        let total = 0;
        for (const slot of ['head', 'chest', 'legs', 'feet']) {
            const eq = this.equipment[slot];
            if (eq && ITEMS[eq.id]) {
                total += ITEMS[eq.id].armor || 0;
                total += eq.charge || 0;
            }
        }
        return total;
    }

    moveItem(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.size) return;
        if (toIndex < 0 || toIndex >= this.size) return;
        const from = this.items[fromIndex];
        const to = this.items[toIndex];
        if (!from) return;
        if (!to) {
            this.items[toIndex] = from;
            this.items[fromIndex] = null;
        } else if (to.id === from.id && ITEMS[to.id].stackable) {
            const maxStack = ITEMS[to.id].maxStack || 99;
            const space = maxStack - to.amount;
            const move = Math.min(space, from.amount);
            to.amount += move;
            from.amount -= move;
            if (from.amount <= 0) this.items[fromIndex] = null;
        } else {
            this.items[toIndex] = from;
            this.items[fromIndex] = to;
        }
        this.notify();
    }
}
