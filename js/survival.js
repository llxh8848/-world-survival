// 生存系统：生命/饥饿/口渴/体温
class SurvivalSystem {
    constructor() {
        this.health = 100;
        this.maxHealth = 100;
        this.hunger = 100;
        this.maxHunger = 100;
        this.thirst = 100;
        this.maxThirst = 100;
        this.temperature = 37;
        this.dead = false;
        this.armor = 0;
        this.accumulatedDamage = 0;
        this.listeners = [];
        this._timer = 0;
        this._talismanTimer = 0;
        this._talismans = [];
        this._speedBonus = 0;
    }

    onChange(fn) { this.listeners.push(fn); }
    notify() { this.listeners.forEach(fn => fn(this.getStats())); }
    getStats() {
        return { health: this.health, hunger: this.hunger, thirst: this.thirst, temperature: this.temperature };
    }

    update(dt, isNight, nearCampfire) {
        if (this.dead) return;
        this._timer += dt;
        if (this._timer < 1) return;
        this._timer = 0;

        // 护身符回血效果 + 耐久消耗
        if (this._talismans && this._talismans.length > 0) {
            for (const t of this._talismans) {
                // 耐久消耗：每15秒消耗1点
                if (t.def.maxDurability) {
                    if (t.item.durability === undefined) t.item.durability = t.item.maxDurability || t.def.maxDurability;
                    t.durabilityTimer = (t.durabilityTimer || 0) + 1;
                    if (t.durabilityTimer >= 15) {
                        t.durabilityTimer = 0;
                        t.item.durability = Math.max(0, t.item.durability - 1);
                        if (t.item.durability <= 0) {
                            if (window.game) window.game.onMessage(`${t.def.name} 耐久耗尽，已失效！`);
                            continue;
                        }
                    }
                }
                // 耐久为0时跳过效果
                if (t.def.maxDurability && t.item.durability !== undefined && t.item.durability <= 0) continue;
                if (t.def.heal_interval && t.def.heal_amount) {
                    t.timer += 1;
                    if (t.timer >= t.def.heal_interval) {
                        t.timer = 0;
                        const charge = t.item ? (t.item.charge || 0) : 0;
                        const healAmt = t.def.heal_amount + charge;
                        this.health = Math.min(this.maxHealth, this.health + healAmt);
                        if (window.game) window.game.onMessage(`护身符回血 +${healAmt}`);
                    }
                }
            }
        }

        // 饥饿和口渴持续下降
        this.hunger = Math.max(0, this.hunger - 0.3);
        this.thirst = Math.max(0, this.thirst - 0.4);

        // 饥饿/口渴归零时掉血
        if (this.hunger <= 0) this.health = Math.max(0, this.health - 0.5);
        if (this.thirst <= 0) this.health = Math.max(0, this.health - 0.7);

        // 体温：夜晚下降，篝火旁回升
        if (nearCampfire) {
            this.temperature = Math.min(40, this.temperature + 0.3);
        } else if (isNight && this.temperature > 34.5) {
            this.temperature -= 0.1;
        } else if (!isNight && this.temperature < 38) {
            this.temperature += 0.05;
        }

        // 极端体温掉血
        if (this.temperature < 35) this.health = Math.max(0, this.health - 1);
        else if (this.temperature > 40) this.health = Math.max(0, this.health - 1);

        // 饱食+饮水充足时回血
        if (this.hunger > 50 && this.thirst > 50 && this.health < this.maxHealth) {
            this.health = Math.min(this.maxHealth, this.health + 1);
        }

        if (this.health <= 0) {
            this.dead = true;
        }
        this.notify();
    }

    takeDamage(amount) {
        if (this.armor > 0) {
            this.accumulatedDamage += amount;
            if (this.accumulatedDamage > this.armor) {
                const damage = this.accumulatedDamage - this.armor;
                this.accumulatedDamage = 0;
                this.health = Math.max(0, this.health - damage);
            } else {
                return;
            }
        } else {
            this.health = Math.max(0, this.health - amount);
        }
        if (this.health <= 0) this.dead = true;
        this.notify();
    }

    eat(hunger, thirst) {
        if (hunger) this.hunger = Math.min(this.maxHunger, this.hunger + hunger);
        if (thirst) this.thirst = Math.min(this.maxThirst, this.thirst + thirst);
        this.notify();
    }

    respawn() {
        this.health = this.maxHealth;
        this.hunger = this.maxHunger;
        this.thirst = this.maxThirst;
        this.temperature = 37;
        this.dead = false;
        this.accumulatedDamage = 0;
        this.notify();
    }

    setArmor(value) {
        this.armor = value || 0;
        this.accumulatedDamage = 0;
    }

    setTalismans(items) {
        this._talismans = [];
        this._speedBonus = 0;
        if (items) {
            for (const item of items) {
                if (item && ITEMS[item.id] && ITEMS[item.id].talisman) {
                    const def = ITEMS[item.id];
                    if (item.durability === undefined && def.maxDurability) {
                        item.durability = item.maxDurability || def.maxDurability;
                    }
                    this._talismans.push({ def: def, timer: 0, item: item, durabilityTimer: 0 });
                    if (def.speed_bonus) {
                        const charge = item.charge || 0;
                        this._speedBonus += def.speed_bonus + charge;
                    }
                }
            }
        }
    }
    getSpeedBonus() {
        let bonus = 0;
        if (this._talismans) {
            for (const t of this._talismans) {
                if (t.def.maxDurability && t.item.durability !== undefined && t.item.durability <= 0) continue;
                if (t.def.speed_bonus) {
                    const charge = t.item ? (t.item.charge || 0) : 0;
                    bonus += t.def.speed_bonus + charge;
                }
            }
        }
        return bonus;
    }
}
