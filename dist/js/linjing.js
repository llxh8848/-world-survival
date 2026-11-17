// ===== 林静球山：漫画剧情 + 回合制闯关（全SVG图标） =====
(function () {
    'use strict';

    const svg = (inner, size, extra) => '<svg viewBox="0 0 24 24" width="' + (size || 18) + '" height="' + (size || 18) + '" style="vertical-align:-0.2em;' + (extra || '') + '">' + inner + '</svg>';

    const ICON = {
        mountain: s => svg('<path d="M2 20L9 7l4 7 3-4 6 10z" fill="#78909c" stroke="#eceff1" stroke-width="1.2" stroke-linejoin="round"/><circle cx="17.5" cy="5.5" r="2.2" fill="#ffd54f"/>', s),
        heart: s => svg('<path d="M12 21s-7-4.6-9.4-9.1A5.4 5.4 0 0 1 12 6.6a5.4 5.4 0 0 1 9.4 5.3C19 16.4 12 21 12 21z" fill="#ef5350"/>', s),
        bolt: s => svg('<path d="M14.5 2.5 8 12.5h4.3L9.8 21.5 18.5 10h-4.6z" fill="#ffd54f" stroke="#f9a825" stroke-width="1" stroke-linejoin="round"/>', s),
        sword: s => svg('<path d="M5 19L17 7M17 7l2-4 2 2-4 2zM6.5 15.5l2 2M4 20l2-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>', s),
        hammer: s => svg('<rect x="3" y="3" width="12" height="7" rx="1.500" fill="currentColor" transform="rotate(45 9 6.500)"/><path d="M11 11l9 9" stroke="currentColor" stroke-width="2.600" stroke-linecap="round"/>', s),
        flag: s => svg('<path d="M6 21V4M6 4h12l-3 4 3 4H6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>', s),
        star: s => svg('<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" fill="#ffd54f" stroke="#f9a825" stroke-width="1" stroke-linejoin="round"/>', s),
        skull: s => svg('<path d="M12 3a8 8 0 0 0-8 8c0 3 1.5 4.7 3 5.7V20h10v-3.3c1.5-1 3-2.700 3-5.700a8 8 0 0 0-8-8z" fill="#cfd8dc"/><circle cx="9" cy="11" r="2" fill="#263238"/><circle cx="15" cy="11" r="2" fill="#263238"/><path d="M10 20v-3M14 20v-3" stroke="#263238" stroke-width="1.2"/>', s),
        arrow: s => svg('<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>', s),
        ball: (c, s) => svg('<circle cx="12" cy="12" r="9" fill="' + c + '" stroke="#37474f" stroke-width="1.4"/><circle cx="9" cy="9.500" r="2.200" fill="rgba(255,255,255,.55)"/>', s),
        hero: s => svg('<circle cx="12" cy="12" r="9" fill="#eceff1" stroke="#37474f" stroke-width="1.4"/><circle cx="9" cy="11" r="1.300" fill="#263238"/><circle cx="15" cy="11" r="1.300" fill="#263238"/><path d="M8.500 15c2 1.600 5 1.600 7 0" fill="none" stroke="#263238" stroke-width="1.300" stroke-linecap="round"/>', s),
        dark: s => svg('<circle cx="12" cy="12" r="9" fill="#212121" stroke="#7b1fa2" stroke-width="1.600"/><path d="M6.500 10.500l4 1.500M17.500 10.500l-4 1.500" stroke="#e040fb" stroke-width="1.800" stroke-linecap="round"/><circle cx="9" cy="13" r="1.300" fill="#e040fb"/><circle cx="15" cy="13" r="1.300" fill="#e040fb"/>', s),
        puppet: s => svg('<circle cx="12" cy="12" r="9" fill="#a1887f" stroke="#4e342e" stroke-width="1.400"/><path d="M8 9l2 2M10 9l-2 2M14 9l2 2M16 9l-2 2" stroke="#3e2723" stroke-width="1.400" stroke-linecap="round"/><path d="M8 16h8M10 15v2M12 15v2M14 15v2" stroke="#3e2723" stroke-width="1.200"/><path d="M12 3V0M7 4L5 1.500M17 4l2-2.500" stroke="#bdbdbd" stroke-width="1" stroke-linecap="round"/>', s),
        bread: s => svg('<path d="M3 14c0-4 4-7 9-7s9 3 9 7v4H3z" fill="#e0a458" stroke="#8d5524" stroke-width="1.300" stroke-linejoin="round"/><path d="M8 11l1.500 3M12 10.500l1 3.500M16 11l-1 3" stroke="#8d5524" stroke-width="1.200" stroke-linecap="round"/>', s),
        bomb: s => svg('<circle cx="12" cy="14.500" r="7" fill="#37474f" stroke="#263238" stroke-width="1.200"/><rect x="9.500" y="5.500" width="5" height="3" rx="1" fill="#90a4ae"/><path d="M12 5.500c0-2 1.500-3 3.500-3" stroke="#ffb300" stroke-width="1.600" fill="none" stroke-linecap="round"/><circle cx="16" cy="2.500" r="1.200" fill="#ff7043"/><circle cx="9.500" cy="12" r="1.600" fill="rgba(255,255,255,.35)"/>', s),
        ice: s => svg('<path d="M12 2.5v19M4.200 7l15.600 10M19.8 7 4.2 17" stroke="#4fc3f7" stroke-width="2" stroke-linecap="round"/><path d="M12 5.8 9.9 4.7M12 5.8l2.1-1.1M12 18.2l-2.1 1.1M12 18.2l2.1 1.1" stroke="#4fc3f7" stroke-width="1.300" stroke-linecap="round"/>', s),
        machine: s => svg('<circle cx="12" cy="13" r="8.500" fill="#78909c" stroke="#37474f" stroke-width="1.500"/><rect x="7.500" y="9.500" width="3.500" height="3.500" rx="0.600" fill="#ff5252"/><rect x="13" y="9.500" width="3.500" height="3.500" rx="0.600" fill="#ff5252"/><path d="M8 16.5h8M10 16.5v1.5M12 16.5v1.5M14 16.5v1.5" stroke="#37474f" stroke-width="1.200"/><path d="M12 4.5V1.500" stroke="#90a4ae" stroke-width="1.400" stroke-linecap="round"/><circle cx="12" cy="1.500" r="1.300" fill="#ff5252"/>', s)
    };

    const STORY = [
        { art: () => ICON.ball('#ffffff', 44) + ICON.ball('#ffd54f', 44) + ICON.ball('#4fc3f7', 44) + ICON.ball('#81c784', 44), bg: 'linear-gradient(#81d4fa,#c5e1a5)', text: '1. 从前有座山，这里的球们生活得很美好。' },
        { art: () => ICON.dark(72) + ICON.puppet(44) + ICON.puppet(44), bg: 'linear-gradient(#212121,#4a148c)', text: '2. 突然，一个黑暗球来到这里，他把这里的球都化作了傀儡……' },
        { art: () => ICON.hero(64) + ICON.sword(48).replace('<svg', '<svg style="color:#fff;"') + ICON.mountain(56), bg: 'linear-gradient(#ffcc80,#ef5350)', text: '3. 此时，有一个球站了出来，带着幸存者去攻打黑暗球的基地……' }
    ];

    const LEVELS = [
        { name: '第一关 · 普通傀儡', skills: ['atk'],
          enemies: [{ name: '普通傀儡', hp: 1, atk: 1 }] },
        { name: '第二关 · 沉重傀儡', skills: ['atk', 'heavy'],
          enemies: [{ name: '沉重傀儡', hp: 3, atk: 2 }] },
        { name: '第三关 · 脆弱傀儡群', skills: ['atk', 'heavy', 'bomb'],
          enemies: [1, 2, 3, 4, 5].map(i => ({ name: '脆弱傀儡' + i, hp: 0.5, atk: 0.5 })) },
        { name: '第四关 · 傀儡混编队', skills: ['atk', 'heavy', 'bomb', 'bread'],
          enemies: [{ name: '普通傀儡1', hp: 1, atk: 1 }, { name: '普通傀儡2', hp: 1, atk: 1 }]
              .concat([1, 2, 3].map(i => ({ name: '脆弱傀儡' + i, hp: 0.5, atk: 0.5 }))) },
        { name: '第五关 · 小BOSS:机器傀儡', skills: ['atk', 'heavy', 'bomb', 'bread', 'ice'],
          enemies: [{ name: '机器傀儡', hp: 5, atk: 1, boss: true, icon: 'machine',
              summonPool: [{ name: '普通傀儡', hp: 1, atk: 1 }, { name: '沉重傀儡', hp: 3, atk: 2 }, { name: '脆弱傀儡', hp: 0.5, atk: 0.5 }] }] }
    ];

    const SKILLS = {
        atk:   { cost: 1, dmg: 1,   name: '攻击',     desc: '-1能量 · 1伤害',       icon: 'sword',  cls: '' },
        heavy: { cost: 2, dmg: 3,   name: '重重一击', desc: '-2能量 · 3伤害',       icon: 'hammer', cls: 'lj-sq-heavy' },
        bomb:  { cost: 1, dmg: 0.5, name: '炸弹',     desc: '-1能量 · 全场0.5伤害', icon: 'bomb',   cls: 'lj-sq-bomb', aoe: true },
        bread: { cost: 0, dmg: 0,   name: '面包',     desc: '0能量 · 回1滴血',      icon: 'bread',  cls: 'lj-sq-bread', heal: 1 },
        ice:   { cost: 2, dmg: 1,   name: '寒冰攻击', desc: '-2能量 · 1伤害·冻结1回合', icon: 'ice', cls: 'lj-sq-ice', freeze: 1, target: true }
    };

    const L = {
        root: null, onExit: null,
        panel: 0, level: 0,
        p: null, e: null, busy: false, log: [],

        _build() {
            if (this.root) return;
            const r = document.createElement('div');
            r.id = 'linjingScreen';
            r.innerHTML =
                '<button class="lj-back" id="ljBack">← 返回游戏盒</button>' +
                '<div class="lj-title">' + ICON.mountain(28) + ' 林静球山</div>' +
                '<div id="ljStory" class="lj-story"></div>' +
                '<div id="ljBattle" class="lj-battle" style="display:none"></div>';
            document.body.appendChild(r);
            this.root = r;
            r.querySelector('#ljBack').addEventListener('click', () => this.exit());
        },

        enter(onExit) {
            this._build();
            this.onExit = onExit || null;
            this.root.style.display = 'block';
            this.panel = 0;
            this.level = 0;
            this._showStory();
        },

        exit() {
            if (this.root) this.root.style.display = 'none';
            if (this.onExit) this.onExit();
        },

        _showStory() {
            const st = this.root.querySelector('#ljStory');
            this.root.querySelector('#ljBattle').style.display = 'none';
            st.style.display = 'flex';
            let html = '<div class="lj-panels">';
            for (let i = 0; i < STORY.length; i++) {
                const s = STORY[i];
                html += '<div class="lj-panel' + (i <= this.panel ? ' show' : '') + '" style="background:' + s.bg + '">' +
                    '<div class="lj-panel-art">' + s.art() + '</div>' +
                    '<div class="lj-panel-text">' + s.text + '</div></div>';
            }
            html += '</div>';
            const last = this.panel >= STORY.length - 1;
            html += '<button class="lj-btn" id="ljNext">' + (last ? ICON.sword(18) + ' 开始战斗' : '下一格 ' + ICON.arrow(16)) + '</button>';
            st.innerHTML = html;
            st.querySelector('#ljNext').addEventListener('click', () => {
                if (last) this._startLevel();
                else { this.panel++; this._showStory(); }
            });
        },

        _startLevel() {
            const lv = LEVELS[this.level];
            this.p = { hp: 4, maxHp: 4, energy: 1 };
            this.enemies = lv.enemies.map(e => ({ name: e.name, hp: e.hp, maxHp: e.hp, atk: e.atk,
                icon: ICON[e.icon || 'puppet'], boss: !!e.boss, summonPool: e.summonPool || null, frozen: 0 }));
            this.busy = false;
            this.root.querySelector('#ljStory').style.display = 'none';
            this.root.querySelector('#ljBattle').style.display = 'flex';
            this.log = ['你先手行动。'];
            this._render();
        },

        _bar(cur, max) {
            return '<div class="lj-bar"><i style="width:' + Math.max(0, cur / max * 100) + '%"></i></div>';
        },

        _render() {
            const lv = LEVELS[this.level];
            const b = this.root.querySelector('#ljBattle');
            b.innerHTML =
                '<div class="lj-level">' + lv.name + '</div>' +
                '<div class="lj-arena">' +
                  '<div class="lj-fighter"><div class="lj-ball">' + ICON.hero(64) + '</div><div>你</div>' +
                    this._bar(this.p.hp, this.p.maxHp) +
                    '<div class="lj-stat">' + ICON.heart(16) + ' ' + this.p.hp + '/' + this.p.maxHp + '　' + ICON.bolt(16) + ' ' + this.p.energy + '</div></div>' +
                  '<div class="lj-vs">VS</div>' +
                  '<div class="lj-foes">' +
                    this.enemies.map((e, i) =>
                      '<div class="lj-fighter lj-foe' + (e.hp <= 0 ? ' dead' : '') + (this.targeting && e.hp > 0 ? ' lj-tgt' : '') + '" data-fi="' + i + '"><div class="lj-ball">' + e.icon(this.enemies.length > 2 ? 40 : 64) + '</div><div>' + e.name + (e.boss ? '·BOSS' : '') + (e.frozen ? ' ❄冰冻' : '') + '</div>' +
                        this._bar(e.hp, e.maxHp) +
                        '<div class="lj-stat">' + ICON.heart(14) + ' ' + e.hp + '/' + e.maxHp + '　' + ICON.sword(14) + ' ' + e.atk + '</div></div>'
                    ).join('') +
                  '</div>' +
                '</div>' +
                '<div class="lj-log">' + this.log.slice(-4).join('<br>') + '</div>' +
                '<div class="lj-actions">' +
                  lv.skills.map(k => {
                      const sk = SKILLS[k];
                      return '<button class="lj-sq ' + sk.cls + '" data-sk="' + k + '"' + (this.busy || this.p.energy < sk.cost ? ' disabled' : '') + '>' + ICON[sk.icon](44) + '<b>' + sk.name + '</b><small>' + sk.desc + '</small></button>';
                  }).join('') +
                  '<button class="lj-sq lj-sq-pass" id="ljPass"' + (this.busy ? ' disabled' : '') + '>' + ICON.flag(44) + '<b>放弃机会</b><small>让对手攻击</small></button>' +
                '</div>';
            b.querySelectorAll('[data-sk]').forEach(bt => bt.addEventListener('click', () => this._attack(bt.dataset.sk)));
            b.querySelector('#ljPass').addEventListener('click', () => this._pass());
            if (this.targeting) { // 寒冰攻击：点击选择目标
                b.querySelectorAll('.lj-foe').forEach(fe => fe.addEventListener('click', () => {
                    const i = parseInt(fe.dataset.fi);
                    if (this.enemies[i] && this.enemies[i].hp > 0) this._attack(this.targeting, i);
                }));
            }
        },

        _attack(key, ti) {
            const sk = SKILLS[key || 'atk'];
            if (this.busy || this.p.energy < sk.cost) return;
            const alive = this.enemies.filter(e => e.hp > 0);
            if (!alive.length) return;
            if (sk.target && alive.length > 1 && ti === undefined) { // 寒冰攻击：先选择目标
                this.targeting = key;
                this.log.push('选择要攻击的傀儡。');
                this._render();
                return;
            }
            this.targeting = null;
            this.p.energy -= sk.cost;
            if (sk.heal) {
                this.p.hp = Math.min(this.p.maxHp, this.p.hp + sk.heal);
                this.log.push('你吃了' + sk.name + '，回复' + sk.heal + '点生命。');
            } else if (sk.aoe) {
                alive.forEach(e => { e.hp = Math.max(0, e.hp - sk.dmg); });
                this.log.push('你引爆了' + sk.name + '，对所有敌人造成' + sk.dmg + '点伤害！');
            } else {
                const t = (ti !== undefined && this.enemies[ti] && this.enemies[ti].hp > 0) ? this.enemies[ti] : alive[0];
                t.hp = Math.max(0, t.hp - sk.dmg);
                if (sk.freeze) { t.frozen = 1; this.log.push('你使用' + sk.name + '，对' + t.name + '造成' + sk.dmg + '点伤害并冻结！'); }
                else this.log.push('你使用' + sk.name + '，对' + t.name + '造成' + sk.dmg + '点伤害！');
            }
            if (!this.enemies.some(e => e.hp > 0)) { this._render(); return this._win(); }
            if (this.p.hp <= 0) { this._render(); return this._lose(); }
            this._enemyTurn();
        },

        _pass() {
            if (this.busy) return;
            this.targeting = null;
            this.log.push('你放弃了这次机会。');
            this._enemyTurn();
        },

        _enemyTurn() {
            this.busy = true;
            this._render();
            setTimeout(() => {
                const alive = this.enemies.filter(e => e.hp > 0);
                const active = alive.filter(e => !e.frozen); // 被冻结的傀儡本回合不能行动
                if (alive.some(e => e.frozen)) this.log.push('被冻结的傀儡无法行动！');
                const total = active.reduce((s, e) => s + e.atk, 0);
                if (total > 0) {
                    this.p.hp = Math.max(0, this.p.hp - total);
                    this.log.push((active.length > 1 ? active.length + '个傀儡' : active[0].name) + '攻击了你，共造成' + total + '点伤害！');
                }
                // 机器傀儡：每回合随机召唤一个傀儡(不召唤自己)，场上最多8个
                active.forEach(e => {
                    if (e.summonPool && this.enemies.length < 8) {
                        const s2 = e.summonPool[Math.floor(Math.random() * e.summonPool.length)];
                        this.enemies.push({ name: s2.name, hp: s2.hp, maxHp: s2.hp, atk: s2.atk, icon: ICON.puppet, frozen: 0 });
                        this.log.push(e.name + '召唤了' + s2.name + '！');
                    }
                });
                alive.forEach(e => { e.frozen = 0; }); // 冻结只持续一回合
                if (this.p.hp <= 0) { this._render(); return this._lose(); }
                this.p.energy += 1;
                this.busy = false;
                this.log.push('新回合开始，获得1点能量。');
                this._render();
            }, 700);
        },

        _end(titleHtml, btns) {
            const b = this.root.querySelector('#ljBattle');
            const m = document.createElement('div');
            m.className = 'lj-modal';
            m.innerHTML = '<div class="lj-modal-box"><h2>' + titleHtml + '</h2></div>';
            btns.forEach(x => {
                const bt = document.createElement('button');
                bt.className = 'lj-btn';
                bt.textContent = x[0];
                bt.addEventListener('click', x[1]);
                m.firstChild.appendChild(bt);
            });
            b.appendChild(m);
        },

        _win() {
            const hasNext = this.level + 1 < LEVELS.length;
            this._end(ICON.star(28) + (hasNext ? ' 通关！' : ' 通关！后续关卡敬请期待'), [
                hasNext ? ['下一关', () => { this.level++; this._startLevel(); }] : ['再玩一次', () => this._startLevel()],
                ['返回游戏盒', () => this.exit()]
            ]);
        },

        _lose() {
            this._end(ICON.skull(28) + ' 你倒下了……', [
                ['重试本关', () => this._startLevel()],
                ['返回游戏盒', () => this.exit()]
            ]);
        }
    };

    window.linjing = L;
})();
