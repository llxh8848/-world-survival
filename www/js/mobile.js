// 手机触控系统

class MobileControls {
    constructor(player, ui) {
        this.player = player;
        this.ui = ui;
        this.isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
        this.joystick = { active: false, x: 0, y: 0, startX: 0, startY: 0 };
        this.look = { active: false, x: 0, y: 0 };
        this.moveX = 0; // -1 ~ 1
        this.moveY = 0; // -1 ~ 1

        if (this.isMobile) {
            document.body.classList.add('is-mobile');
            this._initJoystick();
            this._initLook();
            this._initButtons();
        }
    }

    _initJoystick() {
        const zone = document.getElementById('joystickZone');
        const knob = document.getElementById('joystickKnob');
        const baseX = 35, baseY = 35; // knob初始位置
        const maxDist = 35;
        let touchId = null;

        zone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            // 找到落在joystickZone内的touch
            const rect = zone.getBoundingClientRect();
            for (const t of e.changedTouches) {
                if (t.clientX >= rect.left && t.clientX <= rect.right &&
                    t.clientY >= rect.top && t.clientY <= rect.bottom) {
                    touchId = t.identifier;
                    this.joystick.active = true;
                    this.joystick.startX = rect.left + rect.width / 2;
                    this.joystick.startY = rect.top + rect.height / 2;
                    break;
                }
            }
        }, { passive: false });

        zone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!this.joystick.active || touchId === null) return;
            // 只处理我们跟踪的touch
            let t = null;
            for (const touch of e.touches) {
                if (touch.identifier === touchId) { t = touch; break; }
            }
            if (!t) return;
            let dx = t.clientX - this.joystick.startX;
            let dy = t.clientY - this.joystick.startY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > maxDist) {
                dx = (dx / dist) * maxDist;
                dy = (dy / dist) * maxDist;
            }
            knob.style.left = (baseX + dx) + 'px';
            knob.style.top = (baseY + dy) + 'px';
            this.moveX = dx / maxDist;
            this.moveY = dy / maxDist;
        }, { passive: false });

        const endHandler = (e) => {
            e.preventDefault();
            // 检查是否是我们跟踪的touch结束了
            for (const t of e.changedTouches) {
                if (t.identifier === touchId) {
                    touchId = null;
                    this.joystick.active = false;
                    this.moveX = 0;
                    this.moveY = 0;
                    knob.style.left = baseX + 'px';
                    knob.style.top = baseY + 'px';
                    break;
                }
            }
        };
        zone.addEventListener('touchend', endHandler, { passive: false });
        zone.addEventListener('touchcancel', endHandler, { passive: false });
    }

    _initLook() {
        const lookZone = document.getElementById('lookZone');
        let lastX = 0, lastY = 0;
        let touchId = null;

        lookZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const rect = lookZone.getBoundingClientRect();
            for (const t of e.changedTouches) {
                if (t.clientX >= rect.left && t.clientX <= rect.right &&
                    t.clientY >= rect.top && t.clientY <= rect.bottom) {
                    touchId = t.identifier;
                    this.look.active = true;
                    lastX = t.clientX;
                    lastY = t.clientY;
                    break;
                }
            }
        }, { passive: false });

        lookZone.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (!this.look.active || touchId === null) return;
            let t = null;
            for (const touch of e.touches) {
                if (touch.identifier === touchId) { t = touch; break; }
            }
            if (!t) return;
            const dx = t.clientX - lastX;
            const dy = t.clientY - lastY;
            lastX = t.clientX;
            lastY = t.clientY;
            this.player.yaw -= dx * 0.005;
            this.player.pitch -= dy * 0.005;
            this.player.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.player.pitch));
        }, { passive: false });

        const endHandler = (e) => {
            e.preventDefault();
            for (const t of e.changedTouches) {
                if (t.identifier === touchId) {
                    touchId = null;
                    this.look.active = false;
                    break;
                }
            }
        };
        lookZone.addEventListener('touchend', endHandler, { passive: false });
        lookZone.addEventListener('touchcancel', endHandler, { passive: false });
    }

    _initButtons() {
        const bind = (id, onStart, onEnd) => {
            const el = document.getElementById(id);
            el.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onStart) onStart();
            }, { passive: false });
            el.addEventListener('touchend', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onEnd) onEnd();
            }, { passive: false });
        };

        // 攻击（按住可以回收建筑）
        bind('btnAttack', () => {
            if (this.player.buildMode) this.player._placeBuilding();
            else { this.player._attack(); this.player._startRecycle(); }
        }, () => {
            this.player._stopRecycle();
        });

        // 使用/放置（对准书架打开合成）
        bind('btnUse', () => {
            if (!this.player._interactBuilding()) {
                this.player._useItem();
            }
        });

        // 跳跃（按住持续跳）
        bind('btnJump', () => {
            this.player.keys['Space'] = true;
        }, () => {
            this.player.keys['Space'] = false;
        });

        // 交互
        bind('btnInteract', () => {
            this.player.interact();
        });

        // 背包
        bind('btnInventory', () => {
            this.ui._togglePanel('inventoryUI');
        });

        // 合成
        bind('btnCrafting', () => {
            this.ui._togglePanel('craftingUI');
        });

        // 建造
        bind('btnBuild', () => {
            this.ui._toggleBuildMode();
        });
    }

    // 每帧更新玩家移动输入
    update() {
        if (!this.isMobile) return;
        // 摇杆控制移动
        this.player.keys['KeyW'] = this.moveY < -0.3;
        this.player.keys['KeyS'] = this.moveY > 0.3;
        this.player.keys['KeyA'] = this.moveX < -0.3;
        this.player.keys['KeyD'] = this.moveX > 0.3;
    }
}
