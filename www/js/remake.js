// ===== 世界生存 重置版 =====
// 存档菜单(绿底) + Three.js 无尽平地 + WASD移动 + 空格跳跃 + 7格物品栏 + 100血
// 昼夜循环：夜晚刷新正方体怪物，左键近战攻击
// 时间流速：现实0.3s=游戏1分钟 → 一昼夜(24h)=432s真实时间
const RMK_DAY_LEN = 270;      // 白天时长(s)
const RMK_NIGHT_LEN = 162;    // 黑夜时长(s)
const RMK_MOB_HP = 100;       // 正方体血量
const RMK_MOB_DMG = 10;       // 正方体攻击
const RMK_MOB_SPD = 1.5;      // 移动速度 1.5m/s
const RMK_MOB_RANGE = 2;      // 攻击距离 2m
const RMK_MOB_AGGRO = 18;     // 检测区：玩家进入18m才追击
const RMK_SPAWN_MIN = 25;     // 玩家25m内不刷怪
const RMK_SPAWN_MAX = 430;    // 玩家430m内刷怪
const RMK_MOB_SIZE = 1.4;     // 正方体边长
const RMK_MOB_MAX = 18;       // 夜晚同屏上限
const RMK_MOB_DIE_T = 0.4;    // 死亡压扁动画时长(s)
const RMK_SD_HP = 100;        // 静寂黑暗血量
const RMK_SD_DMG = 15;        // 静寂黑暗攻击
const RMK_SD_SPD = 3.5;       // 静寂黑暗速度 3.5m/s
const RMK_SD_SIZE = 1.5;      // 静寂黑暗边长（仿图：深灰正方体）
const RMK_SD_CH = 0.7;        // 游戏19点后刷怪时70%概率替换正方体
const RMK_FRAG_CH = 0.8;      // 正方体死亡80%概率掉方块片
const RMK_CORN_HEAL = 5;      // 手持玉米右键回复生命
const RMK_SEED_CH = 0.65;     // 挖草65%概率掉杂乱种子
const RMK_CROP_T = 60;        // 作物生长时长(现实s)
const RMK_GRASS_CHOP = 0.1;   // 挖草耗时(s)
const RMK_ATK_RANGE = 3.5;    // 玩家近战距离
const RMK_ATK_DMG = 10;       // 玩家近战伤害（持斧+5）
const RMK_AXE_DMG = 5;        // 手持木斧头额外伤害
const RMK_SWORD_DMG = 8;      // 手持木剑额外伤害
const RMK_ATK_CD = 0.6;       // 玩家挥击间隔
const RMK_WALL_W = 2.0;       // 木墙宽(m)
const RMK_WALL_H = 2.2;       // 木墙高(m)
const RMK_WALL_D = 0.25;      // 木墙厚(m)
const RMK_WALL_MAX = 4.3;     // 最远放置距离(m)
const RMK_TABLE_S = 0.95;     // 合成桌边长(m)
const RMK_FARM_S = 5.0;       // 锄头耕地边长(m)
// 合成配方：可放入材料（仅能增加成功率的材料才允许放入该配方格子）
const RMK_CRAFT_MATS = { wall: ['wood', 'twig', 'frag'], axe: ['wood', 'twig', 'frag'], sword: ['wood', 'twig', 'frag'], table: ['wood', 'twig', 'wall', 'frag'], hoe: ['wood', 'twig', 'frag'] };
const RMK_CRAFT_NAMES = { axe: '木斧头', wall: '木墙', sword: '木剑', table: '合成桌', hoe: '锄头' };
const RMK_CRAFT_TITLES = { axe: '合成木斧头（≥2木材）', wall: '合成木墙（≥3木材）', sword: '合成木剑（≥2木材+1柳条）', table: '合成合成桌（≥1木材+1木墙）', hoe: '合成锄头（≥1木材+1柳条）' };
class RemakeGame {
    constructor() {
        this.saves = [];           // [{id,name,x,y,z,yaw,hp,slot,t}]
        this.selId = null;         // 菜单中选中的存档
        this.curSave = null;       // 正在玩的存档
        this.playing = false;
        this.paused = false;
        this.inited = false;       // three场景是否已初始化
        this.keys = {};
        this.yaw = 0; this.pitch = 0;
        this.px = 0; this.py = 1.7; this.pz = 0;
        this.vy = 0;               // 垂直速度
        this.grounded = true;
        this.hp = 100; this.maxHp = 100;
        this.slot = 0;             // 选中的物品栏格 0-6
        this._last = 0;
        this._saveT = 0;
        this.CHUNK = 32;           // 区块边长
        this.CHUNK_R = 3;          // 渲染半径（区块）
        this.chunks = new Map();   // "cx,cz" -> {cx,cz,trees:[]}
        this.chopped = new Set();  // 已砍树id "cx:cz:i"
        this.dug = new Set();      // 已挖草id "cx:cz:g:i"
        this.drops = [];           // 掉落物 [{mesh}]
        this.lakeList = [];        // 已加载区块的湖泊数据（地形凹陷用）
        this._lakeKey = '';
        this.inv = [];             // 7格物品栏 [{type,count}] 每格最多45
        this.bag = [];             // 背包8格，物品栏满后放这里
        this.bagOpen = false;
        this.invSel = null;        // 背包界面里选中的格子 {src:'bag'|'inv', i}
        this.craftOpen = false;    // 合成面板打开中
        this.craftFromTable = false; // 合成面板是否从合成桌打开（显示全部配方）
        this.craftSlots = [null, null, null, null]; // 合成格（每格1个物品）
        this.mouseDown = false;
        this.chopT = 0; this.chopTarget = null;
        this.time = 60;            // 世界时钟(s)：0-300白天 300-480黑夜，初始清晨
        this.mobs = [];            // 正方体怪 [{mesh,body,bar,hp,atkCd,hitT,dying}]
        this.walls = [];           // 已放置木墙 [{mesh,x,z,ry}]
        this.tables = [];          // 已放置合成桌 [{mesh,x,z,ry}]
        this.farms = [];           // 已耕地 [{mesh,x,z}]（纯装饰）
        this.craftRecipe = 'axe';  // 当前合成配方 axe/wall
        this.mobT = 0;             // 夜间刷怪计时
        this.atkT = 0;             // 玩家挥击冷却
        this.hurtT = 0;            // 受击红屏计时
        this._wasNight = false;    // 昼夜切换沿检测
        this._nightIdx = 0;        // 夜晚序号（静寂黑暗活到第2夜自动死）
        // ===== 联机 =====
        this.net = null;            // null单机 / 'host'房主 / 'guest'客机
        this.netPeers = new Map();  // 房主端：客机 name -> {x,y,z,yaw,hp,atkT,lastSeen}
        this.netRemotes = new Map();// 远端玩家渲染 name -> {mesh,tx,ty,tz,tyaw}
        this._mobNid = 0;           // 联机怪物id
        this._dropNid = 0;          // 联机掉落物id
        this._snapT = 0; this._posT = 0;
        this.netTime = null;        // 客机：主机时钟快照
        this._worldPending = false; // 客机：已加入房间等待world包
        this._hostGoneT = 0;        // 客机：收不到快照计时
        this._clockTxt = '';
        this.ray = new THREE.Raycaster();
        this.ray.far = 5;          // 砍树最远5m
        this.SAVE_KEY = 'rmk_saves';
        this._load();
        this._bind();
    }

    // ===== 存档持久化 =====
    _load() {
        try { this.saves = JSON.parse(localStorage.getItem(this.SAVE_KEY)) || []; }
        catch (e) { this.saves = []; }
    }
    _store() { try { localStorage.setItem(this.SAVE_KEY, JSON.stringify(this.saves)); } catch (e) {} }

    // ===== 菜单 =====
    showMenu() {
        this._saveNow();
        document.getElementById('remakeScreen').style.display = 'flex';
        document.getElementById('rmkCreateRow').style.display = 'none';
        this.selId = null;
        this._renderSaves();
    }
    hideMenu() { document.getElementById('remakeScreen').style.display = 'none'; }

    _renderSaves() {
        const list = document.getElementById('rmkSaveList');
        list.innerHTML = '';
        if (!this.saves.length) {
            list.innerHTML = '<div class="rmk-save-empty">暂无存档</div>';
        }
        for (const s of this.saves) {
            const el = document.createElement('div');
            el.className = 'rmk-save' + (s.id === this.selId ? ' sel' : '');
            el.innerHTML = '<span class="rmk-save-name">' + s.name + '</span><span class="rmk-save-time">' + new Date(s.t).toLocaleString() + '</span>';
            el.addEventListener('click', () => { this.selId = s.id; this._renderSaves(); });
            list.appendChild(el);
        }
        document.getElementById('btnRmkJoin').disabled = !this.selId;
        document.getElementById('btnRmkDelete').disabled = !this.selId;
    }

    _createSave() {
        const inp = document.getElementById('rmkSaveName');
        const name = (inp.value || '').trim() || ('存档' + (this.saves.length + 1));
        const s = { id: Date.now() + '_' + Math.floor(Math.random() * 1e6), name,
            x: 0, y: 1.7, z: 0, yaw: 0, hp: 100, slot: 0, t: Date.now(), time: 60,
            seed: Math.floor(Math.random() * 0xffffffff) };
        this.saves.unshift(s);
        this._store();
        inp.value = '';
        document.getElementById('rmkCreateRow').style.display = 'none';
        this.selId = s.id;
        this._renderSaves();
    }

    _deleteSave() { // 删除当前选中的存档
        const i = this.saves.findIndex(x => x.id === this.selId);
        if (i < 0) return;
        if (!confirm('删除存档「' + this.saves[i].name + '」？')) return;
        this.saves.splice(i, 1);
        this.selId = null;
        this._store();
        this._renderSaves();
    }

    _saveNow() {
        if (!this.curSave) return;
        const s = this.curSave;
        s.x = this.px; s.y = this.py; s.z = this.pz; s.yaw = this.yaw;
        s.hp = this.hp; s.slot = this.slot; s.t = Date.now(); s.time = this.time;
        s.inv = this.inv.slice();
        s.walls = this.walls.map(w => ({ x: +w.x.toFixed(2), z: +w.z.toFixed(2), ry: +w.ry.toFixed(3) }));
        s.tables = this.tables.map(w => ({ x: +w.x.toFixed(2), z: +w.z.toFixed(2), ry: +w.ry.toFixed(3) }));
        s.farms = this.farms.map(f => ({ x: +f.x.toFixed(2), z: +f.z.toFixed(2) }));
        s.bag = this.bag.slice();
        s.chopped = [...this.chopped];
        s.dug = [...this.dug];
        this._store();
    }

    // ===== 进入/退出游戏 =====
    join() {
        const s = this.saves.find(x => x.id === this.selId);
        if (!s) return;
        this._enterWorld(s);
    }

    // 房主开启房间：用房间专属存档进入世界（第一次自动创建）
    joinRoomWorld(room) {
        let s = room.saveId && this.saves.find(x => x.id === room.saveId);
        if (!s) {
            s = { id: 'room_' + room.id, name: '\u{1f3e0}' + room.name,
                x: 0, y: 1.7, z: 0, yaw: 0, hp: 100, slot: 0, t: Date.now(), time: 60,
                seed: Math.floor(Math.random() * 0xffffffff) };
            this.saves.unshift(s);
            room.saveId = s.id;
            RmkNet._saveMyRooms();
        }
        this.net = 'host';
        this._enterWorld(s);
        RmkNet.inGame = true;
        document.getElementById('btnRoomClose').style.display = 'block';
        const tag = document.getElementById('rmkNetTag');
        tag.style.display = 'block';
        tag.textContent = '\u{1f3e0} ' + room.name + '（房主）';
    }

    _enterWorld(s) {
        this.curSave = s;
        this.px = s.x; this.py = s.y; this.pz = s.z; this.yaw = s.yaw; this.pitch = 0;
        this.vy = 0; this.hp = s.hp || 100; this.slot = s.slot || 0;
        this.inv = Array.isArray(s.inv) ? s.inv.slice(0, 7) : [];
        while (this.inv.length < 7) this.inv.push(null);   // 补齐7格，findIndex才能找到空格
        this.bag = Array.isArray(s.bag) ? s.bag.slice(0, 8) : [];
        while (this.bag.length < 8) this.bag.push(null);   // 补齐8格
        this.chopped = new Set(s.chopped || []);
        this.dug = new Set(s.dug || []);
        this.time = s.time === undefined ? 60 : s.time;   // 旧存档默认清晨
        this.mobs.length = 0; this.mobT = 0; this.atkT = 0; this._wasNight = false;
        this.bagOpen = false; this.craftOpen = false; this.invSel = null;
        document.getElementById('rmkBag').style.display = 'none';
        document.getElementById('rmkCraft').style.display = 'none';
        if (this.inited) { this._clearDrops(); this._clearMobs(); this._clearWalls(); this._clearTables(); this._clearFarms(); }
        this.mouseDown = false; this._endChop();
        this.hideMenu();
        document.getElementById('remakeGameScreen').style.display = 'block';
        document.getElementById('rmkPause').style.display = 'none';
        if (!this.inited) this._init3D();
        else this._clearChunks();  // 换存档重建区块树
        this._loadWalls(s.walls || []);
        this._loadTables(s.tables || []);
        this._loadFarms(s.farms || []);
        this.playing = true; this.paused = true; // 等点击画面锁定鼠标后开始
        this._updateHud();
        this._renderHotbar();
        this._last = performance.now();
        requestAnimationFrame(t => this._loop(t));
    }
    exit() {
        if (this.net === 'host') RmkNet.closeRoom();     // 房主退出=关闭房间
        else if (this.net === 'guest') RmkNet.leave();   // 客机退出=离开房间
        this._clearNet();
        this.playing = false;                    // 先置位：关闭面板不再回锁鼠标
        if (this.craftOpen) this._closeCraft();   // 格子物品退回再存档
        this._saveNow();
        this.curSave = null; this.paused = false;
        this.mouseDown = false; this._endChop();
        this._clearDrops();
        this._clearMobs();
        this._clearWalls();
        this._clearTables();
        this._clearFarms();
        this.bagOpen = false;
        document.getElementById('rmkBag').style.display = 'none';
        if (document.pointerLockElement) document.exitPointerLock();
        document.getElementById('remakeGameScreen').style.display = 'none';
        document.getElementById('rmkPause').style.display = 'none';
        this.showMenu();
    }

    // ===== 事件 =====
    _bind() {
        document.getElementById('btnRmkCreate').addEventListener('click', () => {
            const row = document.getElementById('rmkCreateRow');
            row.style.display = row.style.display === 'none' ? 'flex' : 'none';
            if (row.style.display === 'flex') document.getElementById('rmkSaveName').focus();
        });
        document.getElementById('btnRmkCreateOk').addEventListener('click', () => this._createSave());
        document.getElementById('rmkSaveName').addEventListener('keydown', e => {
            if (e.key === 'Enter') this._createSave();
            e.stopPropagation();
        });
        document.getElementById('btnRmkJoin').addEventListener('click', () => this.join());
        document.getElementById('btnRmkDelete').addEventListener('click', () => this._deleteSave());
        document.getElementById('btnRmkBack').addEventListener('click', () => {
            this.hideMenu();
            document.getElementById('worldSurvivalScreen').style.display = 'flex';
        });
        document.getElementById('btnRmkResume').addEventListener('click', () => this._lock());
        document.getElementById('btnRmkExit').addEventListener('click', () => this.exit());
        document.getElementById('btnRoomClose').addEventListener('click', () => {
            if (this.net === 'host' && confirm('关闭房间？所有玩家将退出到主界面')) this.exit();
        });

        // 独立游戏：window capture阶段拦截——游戏运行中老版世界生存的全局监听收不到事件
        window.addEventListener('keydown', e => {
            if (!this.playing) return;
            e.stopPropagation();
            if (e.code === 'KeyE') { this._toggleBag(); return; }
            if (this.paused) return;
            this.keys[e.code] = true;
            if (e.code === 'Space') e.preventDefault();
            if (e.code >= 'Digit1' && e.code <= 'Digit7') {
                this.slot = +e.code.slice(5) - 1;
                this._renderHotbar();
            }
        }, true);
        window.addEventListener('keyup', e => {
            if (this.playing) e.stopPropagation();
            this.keys[e.code] = false;
        }, true);
        window.addEventListener('mousemove', e => {
            if (!this.playing || this.paused || document.pointerLockElement !== this.canvas) return;
            e.stopPropagation();
            this.yaw -= e.movementX * 0.0024;
            this.pitch = Math.max(-1.55, Math.min(1.55, this.pitch - e.movementY * 0.0024));
        }, true);
        window.addEventListener('wheel', e => {
            if (!this.playing || this.paused) return;
            e.stopPropagation();
            this.slot = (this.slot + (e.deltaY > 0 ? 1 : 6)) % 7;
            this._renderHotbar();
        }, { capture: true, passive: true });
        window.addEventListener('mousedown', e => {
            if (!this.playing) return;
            e.stopPropagation();
            if (e.button === 0 && !this.paused && document.pointerLockElement === this.canvas)
                this.mouseDown = true;
            if (e.button === 2 && !this.paused && document.pointerLockElement === this.canvas) {
                if (this._tableAtCrosshair()) this._openTableCraft(); // 准星对准合成桌→打开全配方合成界面
                else if (!this._useHeld()) this._placeBlock();        // 方块片右键回血；否则放置手持物（木墙/合成桌）
            }
        }, true);
        window.addEventListener('contextmenu', e => { if (this.playing) e.preventDefault(); });
        window.addEventListener('mouseup', e => {
            if (!this.playing) return;
            e.stopPropagation();
            if (e.button === 0) this.mouseDown = false;
        }, true);
        document.addEventListener('pointerlockchange', () => {
            if (!this.playing) return;
            const locked = document.pointerLockElement === this.canvas;
            this.paused = !locked;
            document.getElementById('rmkPause').style.display = (!locked && !this.bagOpen && !this.craftOpen) ? 'flex' : 'none';
            document.getElementById('rmkBag').style.display = (!locked && this.bagOpen) ? 'flex' : 'none';
            if (locked) this._last = performance.now();
            else { this.mouseDown = false; this._endChop(); }
        });
        window.addEventListener('resize', () => this._resize());
        document.getElementById('rmkViewport').addEventListener('click', () => this._lock());
        document.getElementById('btnCraftWall').addEventListener('click', () => this._openCraft('wall'));
        document.getElementById('btnCraftTable').addEventListener('click', () => this._openCraft('table'));
        document.getElementById('btnCraftDo').addEventListener('click', () => this._craftDo());
        document.getElementById('btnCraftBack').addEventListener('click', () => this._closeCraft());
        // 下方物品格：点击取1个放入上方空格（仅配方认可的材料，方块片任意配方可用）
        document.getElementById('rmkCraftInv').addEventListener('click', e => {
            const d = e.target.closest('.rmk-slot');
            if (!d) return;
            const msg = document.getElementById('rmkCraftMsg');
            const type = d.dataset.type;
            if (RMK_CRAFT_MATS[this.craftRecipe].indexOf(type) < 0) { msg.textContent = '该材料不增加此配方成功率'; return; }
            const idx = this.craftSlots.indexOf(null);
            if (idx < 0) { msg.textContent = '上面格子已满'; return; }
            this._takeItem(type, 1);
            this.craftSlots[idx] = type;
            msg.textContent = '';
            this._renderCraft(); this._renderHotbar(); this._renderBag();
        });
        // 上方合成格：点击取回物品
        document.getElementById('rmkCraftSlots').addEventListener('click', e => {
            const d = e.target.closest('.rmk-slot');
            if (!d) return;
            const i = +d.dataset.i, t = this.craftSlots[i];
            if (!t) return;
            this.craftSlots[i] = null;
            this._addItem(t, 1);
            this._renderCraft(); this._renderHotbar(); this._renderBag();
        });
        document.getElementById('btnRmkBagClose').addEventListener('click', () => this._toggleBag());
        // 背包内格子：点击选中→再点目标格交换；拖拽同理（事件委托，bag/inv共用）
        const bagEl = document.getElementById('rmkBag');
        bagEl.addEventListener('click', e => {
            const d = e.target.closest('.rmk-slot');
            if (!d || !d.dataset.src) return;
            this._invSlotClick(d.dataset.src, +d.dataset.i);
        });
        bagEl.addEventListener('dragstart', e => {
            const d = e.target.closest('.rmk-slot');
            if (!d || !d.dataset.src) return;
            e.dataTransfer.setData('text/plain', d.dataset.src + ':' + d.dataset.i);
            e.dataTransfer.effectAllowed = 'move';
            this.invSel = { src: d.dataset.src, i: +d.dataset.i };
            this._renderBag();
        });
        bagEl.addEventListener('dragover', e => {
            if (e.target.closest('.rmk-slot')) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
        });
        bagEl.addEventListener('drop', e => {
            const d = e.target.closest('.rmk-slot');
            if (!d || !d.dataset.src) return;
            e.preventDefault();
            const parts = (e.dataTransfer.getData('text/plain') || '').split(':');
            const from = { src: parts[0], i: +parts[1] };
            if (from.src !== d.dataset.src || from.i !== +d.dataset.i) {
                this._moveSlot(from, { src: d.dataset.src, i: +d.dataset.i });
            }
            this.invSel = null;
            this._renderBag(); this._renderHotbar();
        });
        bagEl.addEventListener('dragend', () => { this.invSel = null; this._renderBag(); });
    }
    _lock() {
        if (this.canvas && this.playing) this.canvas.requestPointerLock();
    }

    // ===== Three.js 场景 =====
    _init3D() {
        const vp = document.getElementById('rmkViewport');
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
        this.renderer.setSize(innerWidth, innerHeight);
        this.renderer.shadowMap.enabled = true;                // 光影：软阴影
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        vp.appendChild(this.renderer.domElement);
        this.canvas = this.renderer.domElement;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xc8e6c9);      // 淡绿天空
        this.scene.fog = new THREE.Fog(0xc8e6c9, 40, 160);       // 雾藏住地面边缘=无尽感
        this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 400);

        // 光照：中性环境光为主 + 微暖平行光（带阴影，跟随玩家）
        this.hemi = new THREE.HemisphereLight(0xffffff, 0x5a7050, 0.9);
        this.scene.add(this.hemi);
        this._skyDay = new THREE.Color(0xc8e6c9);    // 白天淡绿
        this._skyNight = new THREE.Color(0x0b1026);  // 夜晚深蓝黑
        this.sun = new THREE.DirectionalLight(0xfff4d6, 0.6);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(2048, 2048);
        const sc = this.sun.shadow.camera;
        sc.left = sc.bottom = -80; sc.right = sc.top = 80;
        sc.near = 10; sc.far = 400;
        this.sunDir = new THREE.Vector3(60, 90, 40).normalize();
        this.scene.add(this.sun);
        this.scene.add(this.sun.target);

        // 太阳：纯背景贴图（黄色发光圆，不受雾影响，钉在天空方向）
        const scv = document.createElement('canvas');
        scv.width = scv.height = 256;
        const c2 = scv.getContext('2d');
        const rg = c2.createRadialGradient(128, 128, 18, 128, 128, 128);
        rg.addColorStop(0, 'rgba(255,246,180,1)');
        rg.addColorStop(0.32, 'rgba(255,214,64,1)');
        rg.addColorStop(0.5, 'rgba(255,200,40,0.45)');
        rg.addColorStop(1, 'rgba(255,200,40,0)');
        c2.fillStyle = rg;
        c2.fillRect(0, 0, 256, 256);
        this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
            map: new THREE.CanvasTexture(scv),
            fog: false, depthWrite: false, transparent: true }));
        this.sunSprite.scale.set(80, 80, 1);
        this.scene.add(this.sunSprite);

        // 无尽平地：大地面跟随玩家吸附到格子步长
        this.cell = 4;
        this.ground = new THREE.Mesh(
            new THREE.PlaneGeometry(600, 600, 180, 180),   // 分段网格，顶点下凹做湖坑
            new THREE.MeshLambertMaterial({ color: 0x7d9c6a })); // 低饱和绿
        this.ground.receiveShadow = true;
        this.ground.rotation.x = -Math.PI / 2;
        this.scene.add(this.ground);

        // 玩家身体（colorWrite/depthWrite关闭=相机不可见，仅用于投影）
        this.body = new THREE.Mesh(
            new THREE.CapsuleGeometry(0.35, 1.0, 4, 10),
            new THREE.MeshLambertMaterial({ color: 0x455a64 }));
        this.body.material.colorWrite = false;
        this.body.material.depthWrite = false;
        this.body.castShadow = true;
        this.scene.add(this.body);

        // 木墙放置虚影（绿色半透明）
        this.wallGhost = new THREE.Mesh(
            new THREE.BoxGeometry(RMK_WALL_W, RMK_WALL_H, RMK_WALL_D),
            new THREE.MeshBasicMaterial({ color: 0x2e7d32, transparent: true, opacity: 0.4, depthWrite: false }));
        this.wallGhost.visible = false;
        this.scene.add(this.wallGhost);

        // 合成桌放置虚影（绿色半透明立方体）
        this.tableGhost = new THREE.Mesh(
            new THREE.BoxGeometry(RMK_TABLE_S, RMK_TABLE_S, RMK_TABLE_S),
            new THREE.MeshBasicMaterial({ color: 0x2e7d32, transparent: true, opacity: 0.4, depthWrite: false }));
        this.tableGhost.visible = false;
        this.scene.add(this.tableGhost);

        // 第一人称手持物品：相机右下角的物品视图模型
        this.scene.add(this.camera);
        this.heldGroup = new THREE.Group();
        this.heldGroup.position.set(0.34, -0.34, -0.55);
        this.heldGroup.rotation.y = -0.25;
        this.camera.add(this.heldGroup);
        this._heldType = undefined; // 当前手持物类型（变化时重建网格）
        this._animT = 0;            // 手持动画计时

        this.inited = true;
        this._clearChunks();
    }
    _resize() {
        if (!this.inited) return;
        this.camera.aspect = innerWidth / innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(innerWidth, innerHeight);
    }

    // ===== 主循环 =====
    _loop(t) {
        if (!this.playing) return;
        requestAnimationFrame(tt => this._loop(tt));
        const dt = Math.min(0.05, (t - this._last) / 1000);
        this._last = t;
        this._netTick(dt);                                        // 联机：发包/快照/掉线检测（暂停中也发）
        if (this.paused) { this.renderer.render(this.scene, this.camera); return; }

        // WASD移动（相对yaw朝向）
        const sp = 8;
        let mx = 0, mz = 0;
        if (this.keys['KeyW']) mz -= 1;
        if (this.keys['KeyS']) mz += 1;
        if (this.keys['KeyA']) mx -= 1;
        if (this.keys['KeyD']) mx += 1;
        if (mx || mz) {
            const l = Math.hypot(mx, mz); mx /= l; mz /= l;
            const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
            this.px += (mx * cos + mz * sin) * sp * dt;
            this.pz += (mz * cos - mx * sin) * sp * dt;
        }
        // 跳跃+重力+地面
        if (this.keys['Space'] && this.grounded) { this.vy = 8.5; this.grounded = false; }
        this.vy -= 22 * dt;
        this.py += this.vy * dt;
        const gy = 1.7 + this._groundH(this.px, this.pz);   // 湖坑处地面更低
        if (this.py <= gy) { this.py = gy; this.vy = 0; this.grounded = true; }

        // 树碰撞：不可穿过树干；木墙碰撞：不可穿过墙
        this._resolveTreeCollision();
        { const pc = { x: this.px, z: this.pz }; this._resolveWalls(pc, 0.35); this.px = pc.x; this.pz = pc.z; }

        // 地面跟随玩家（吸附到格线，地面看起来不动）；位置变化时重算凹陷
        const ngx = Math.round(this.px / this.cell) * this.cell;
        const ngz = Math.round(this.pz / this.cell) * this.cell;
        if (ngx !== this.ground.position.x || ngz !== this.ground.position.z) {
            this.ground.position.x = ngx; this.ground.position.z = ngz;
            this._updateGround();
        }

        // 相机=玩家眼睛；身体跟随（投影用）
        this.camera.position.set(this.px, this.py, this.pz);
        this.camera.rotation.set(0, 0, 0);
        this.camera.rotateY(this.yaw);
        this.camera.rotateX(this.pitch);
        this.body.position.set(this.px, this.py - 0.9, this.pz);

        // 区块树：新进入视野的区块生成，离开半径的卸载
        this._updateChunks();

        // 砍树 + 掉落物 + 作物生长
        this._updateChop(dt);
        this._updateDrops(dt);
        this._updateFarms(dt);

        // 昼夜推进 + 正方体怪 + 玩家近战 + 受击红屏
        if (this.net !== 'guest') {                               // 主机/单机：权威模拟
            this._updateTime(dt);
            this._updateMobs(dt);
        } else {                                                  // 客机：快照插值
            this._updateNetTime(dt);
            this._updateNetMobs(dt);
        }
        this._updateCombat(dt);
        this._updateWallGhost();
        this._updateHeld(dt);
        this._updateRemotes(dt);
        if (this.hurtT > 0) {
            this.hurtT -= dt;
            document.getElementById('rmkHurt').style.opacity = Math.max(0, this.hurtT * 1.1);
        }

        // 太阳贴图钉在天空方向（相对相机恒定）；平行光随玩家移动保持阴影范围
        this.sunSprite.position.copy(this.camera.position).addScaledVector(this.sunDir, 300);
        this.sun.position.copy(this.camera.position).addScaledVector(this.sunDir, 150);
        this.sun.target.position.set(this.px, 0, this.pz);

        // 定期自动存档（客机不存）
        this._saveT += dt;
        if (this._saveT > 5) { this._saveT = 0; if (this.net !== 'guest') this._saveNow(); }

        this.renderer.render(this.scene, this.camera);
    }

    // ===== 区块树 =====
    // 确定性伪随机（种子+区块坐标），同一存档树的位置固定
    _hash(x, z, s) {
        let h = (x * 374761393 + z * 668265263 + s * 1442695041) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }
    _makeTree(x, z, scale) {
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.32, 2.2, 7),
            new THREE.MeshLambertMaterial({ color: 0x6d4c33 }));
        trunk.position.y = 1.1;
        trunk.castShadow = true;
        const leaf = new THREE.Mesh(
            new THREE.ConeGeometry(1.5, 3.0, 8),
            new THREE.MeshLambertMaterial({ color: 0x4a7a4f }));
        leaf.position.y = 3.2;
        leaf.castShadow = true;
        g.add(trunk, leaf);
        g.scale.setScalar(scale);
        g.position.set(x, 0, z);
        return g;
    }
    _makeWillow(x, z, scale) {
        // 柳树：细长树干，顶部小冠 + 一圈下垂的柳叶条
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.1, 0.18, 4.4, 6),
            new THREE.MeshLambertMaterial({ color: 0x5d4530 }));
        trunk.position.y = 2.2;
        trunk.castShadow = true;
        g.add(trunk);
        const leafMat = new THREE.MeshLambertMaterial({ color: 0x7bab4a });
        const top = new THREE.Mesh(new THREE.SphereGeometry(0.85, 8, 6), leafMat);
        top.position.y = 4.5;
        top.castShadow = true;
        g.add(top);
        const leafGeo = new THREE.BoxGeometry(0.16, 2.6, 0.06);
        for (let i = 0; i < 8; i++) {
            const a = i / 8 * Math.PI * 2;
            const leaf = new THREE.Mesh(leafGeo, leafMat);
            leaf.position.set(Math.cos(a) * 0.75, 3.35, Math.sin(a) * 0.75);
            leaf.rotation.x = Math.sin(a) * 0.3;   // 向外倾斜下垂
            leaf.rotation.z = -Math.cos(a) * 0.3;
            leaf.castShadow = true;
            g.add(leaf);
        }
        g.scale.setScalar(scale);
        g.position.set(x, 0, z);
        return g;
    }
    _makeGrass(x, z) { // 草：4根外斜的绿色细条
        const g = new THREE.Group();
        const mat = new THREE.MeshLambertMaterial({ color: 0x66bb6a });
        for (let i = 0; i < 4; i++) {
            const b = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4 + (i % 2) * 0.15, 0.05), mat);
            const a = i / 4 * Math.PI * 2;
            b.position.set(Math.cos(a) * 0.08, 0.22, Math.sin(a) * 0.08);
            b.rotation.z = Math.cos(a) * 0.25;
            b.rotation.x = -Math.sin(a) * 0.25;
            g.add(b);
        }
        g.position.set(x, this._groundH(x, z), z);
        return g;
    }
    _makeCrop() { // 作物苗：茎+3片叶（生长期放大，成熟变金黄）
        const g = new THREE.Group();
        const mat = new THREE.MeshLambertMaterial({ color: 0x7cb342 });
        const stem = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.08), mat);
        stem.position.y = 0.45;
        g.add(stem);
        for (let i = 0; i < 3; i++) {
            const lf = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.12), mat);
            const a = i / 3 * Math.PI * 2;
            lf.position.set(Math.cos(a) * 0.1, 0.3 + i * 0.12, Math.sin(a) * 0.1);
            lf.rotation.z = Math.cos(a) * 0.5;
            lf.rotation.x = -Math.sin(a) * 0.5;
            g.add(lf);
        }
        g.scale.setScalar(0.2);
        return g;
    }
    _makeLake(lk) {
        const m = new THREE.Mesh(
            new THREE.CircleGeometry(lk.r, 28),
            new THREE.MeshLambertMaterial({ color: 0x4d9fd6, transparent: true, opacity: 0.9 }));
        m.rotation.x = -Math.PI / 2;
        m.position.set(lk.x, -0.22, lk.z);   // 水面沉在凹陷坑里
        m.receiveShadow = true;
        return m;
    }
    // 每3×3区块(超格)80%概率1个湖：湖落哪个区块由超格种子决定，位置/大小确定性随机
    _lakeAt(cx, cz, seed) {
        const s = seed + 999;
        const SC = 3;
        const sx = Math.floor(cx / SC), sz = Math.floor(cz / SC);
        if (this._hash(sx, sz, s + 6) >= 0.8) return null;   // 80%的超格出湖
        const ox = Math.floor(this._hash(sx, sz, s) * SC);       // 超格内选中区块偏移0-5
        const oz = Math.floor(this._hash(sx, sz, s + 1) * SC);
        if ((cx - sx * SC) !== ox || (cz - sz * SC) !== oz) return null;
        const r = 3.5 + this._hash(cx, cz, s + 3) * 5.5;   // 湖面半径3.5-9m(直径7-18m)
        return {
            x: (cx + 0.2 + this._hash(cx, cz, s + 4) * 0.6) * this.CHUNK,
            z: (cz + 0.2 + this._hash(cx, cz, s + 5) * 0.6) * this.CHUNK,
            r, depR: r * 1.4   // depR=凹陷区半径(坡地外缘)
        };
    }
    _genChunk(cx, cz) {
        const seed = (this.curSave && this.curSave.seed) || 1;
        const ch = { cx, cz, trees: [], lakes: [], lakeData: [], grass: [] };
        // 本区块的湖
        const lk = this._lakeAt(cx, cz, seed);
        if (lk) {
            const m = this._makeLake(lk);
            ch.lakes.push(m);
            ch.lakeData.push(lk);
            this.scene.add(m);
        }
        // 本区块+邻区块的湖：判断树是否落湖里/湖边变柳树
        const near = [];
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
            const l = this._lakeAt(cx + dx, cz + dz, seed);
            if (l) near.push(l);
        }
        const n = Math.floor(this._hash(cx, cz, seed) * 3); // 0-2棵
        for (let i = 0; i < n; i++) {
            const id = cx + ':' + cz + ':' + i;
            if (this.chopped.has(id)) continue;   // 已砍过的树不重生
            const x = (cx + this._hash(cx + i, cz, seed + 7)) * this.CHUNK;
            const z = (cz + this._hash(cx, cz + i, seed + 13)) * this.CHUNK;
            let inLake = false, nearLake = false;
            for (const l of near) {
                const d = Math.hypot(x - l.x, z - l.z);
                if (d < l.depR) { inLake = true; break; }
                if (d < l.depR + 5) nearLake = true;   // 湖边5m内
            }
            if (inLake) continue;   // 湖里不生树
            const sc = 0.8 + this._hash(cx + i * 31, cz - i * 17, seed + 23) * 0.6;
            const tree = nearLake ? this._makeWillow(x, z, sc) : this._makeTree(x, z, sc);
            tree.userData.id = id;
            tree.userData.willow = nearLake;
            ch.trees.push(tree);
            this.scene.add(tree);
        }
        if (lk) { // 湖边必刷1-3棵柳树：在凹陷区外缘环线确定性取点
            const nl = 1 + Math.floor(this._hash(cx, cz, seed + 51) * 3);
            for (let i = 0; i < nl; i++) {
                const id = cx + ':' + cz + ':L' + i;
                if (this.chopped.has(id)) continue;
                const a = this._hash(cx + i * 7, cz - i * 3, seed + 52) * Math.PI * 2;
                const d0 = lk.depR + 0.4 + this._hash(cx - i * 5, cz + i * 11, seed + 53) * 1.8;
                const x = lk.x + Math.cos(a) * d0, z = lk.z + Math.sin(a) * d0;
                let inLake = false;
                for (const l of near) if (Math.hypot(x - l.x, z - l.z) < l.depR) { inLake = true; break; }
                if (inLake) continue;
                const sc = 0.8 + this._hash(cx + i * 13, cz + i * 29, seed + 54) * 0.6;
                const tree = this._makeWillow(x, z, sc);
                tree.userData.id = id;
                tree.userData.willow = true;
                ch.trees.push(tree);
                this.scene.add(tree);
            }
        }
        // 每区块1-2个草（湖里不生）
        const ng = 1 + Math.floor(this._hash(cx, cz, seed + 61) * 2);
        for (let i = 0; i < ng; i++) {
            const id = cx + ':' + cz + ':g' + i;
            if (this.dug.has(id)) continue;
            const x = (cx + this._hash(cx - i * 3, cz + i * 7, seed + 62)) * this.CHUNK;
            const z = (cz + this._hash(cx + i * 11, cz - i * 5, seed + 63)) * this.CHUNK;
            let inLake = false;
            for (const l of near) if (Math.hypot(x - l.x, z - l.z) < l.depR) { inLake = true; break; }
            if (inLake) continue;
            const g = this._makeGrass(x, z);
            g.userData.id = id;
            g.userData.isGrass = true;
            ch.grass.push(g);
            this.scene.add(g);
        }
        this.chunks.set(cx + ',' + cz, ch);
    }
    _updateChunks() {
        const cx = Math.floor(this.px / this.CHUNK);
        const cz = Math.floor(this.pz / this.CHUNK);
        const R = this.CHUNK_R;
        for (let dx = -R; dx <= R; dx++) {
            for (let dz = -R; dz <= R; dz++) {
                const k = (cx + dx) + ',' + (cz + dz);
                if (!this.chunks.has(k)) this._genChunk(cx + dx, cz + dz);
            }
        }
        for (const [k, ch] of this.chunks) {
            if (Math.max(Math.abs(ch.cx - cx), Math.abs(ch.cz - cz)) > R + 1) {
                for (const t of ch.trees) this.scene.remove(t);
                for (const l of (ch.lakes || [])) this.scene.remove(l);
                for (const g of (ch.grass || [])) this.scene.remove(g);
                this.chunks.delete(k);
            }
        }
        // 维护湖泊列表，变化时重算地面凹陷
        this.lakeList = [];
        for (const ch of this.chunks.values())
            for (const l of ch.lakeData || []) this.lakeList.push(l);
        const key = this.lakeList.map(l => l.x + ',' + l.z).join('|');
        if (key !== this._lakeKey) { this._lakeKey = key; this._updateGround(); }
    }
    _clearChunks() {
        for (const ch of this.chunks.values()) {
            for (const t of ch.trees) this.scene.remove(t);
            for (const l of (ch.lakes || [])) this.scene.remove(l);
            for (const g of (ch.grass || [])) this.scene.remove(g);
        }
        this.chunks.clear();
        this.lakeList = [];
        this._lakeKey = '';
    }

    // ===== 地形高度（湖凹陷） =====
    _groundH(x, z) {
        let h = 0;
        for (const l of this.lakeList) {
            const d = Math.hypot(x - l.x, z - l.z);
            if (d >= l.depR) continue;
            // 平滑碗状凹陷：外缘0 → 湖心-0.55
            const t = Math.min(1, Math.max(0, (l.depR - d) / (l.depR - l.r * 0.7)));
            h -= 0.55 * t * t * (3 - 2 * t);
        }
        return h;
    }
    _updateGround() {
        const pos = this.ground.geometry.attributes.position;
        const gx = this.ground.position.x, gz = this.ground.position.z;
        for (let i = 0; i < pos.count; i++) {
            // 平面绕x轴-90°后：local x→world x，local y→world -z，local z→world y
            pos.setZ(i, this._groundH(gx + pos.getX(i), gz - pos.getY(i)));
        }
        pos.needsUpdate = true;
        this.ground.geometry.computeVertexNormals();
    }

    // ===== 树碰撞 =====
    _resolveTreeCollision() {
        const cx = Math.floor(this.px / this.CHUNK), cz = Math.floor(this.pz / this.CHUNK);
        for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
            const ch = this.chunks.get((cx + dx) + ',' + (cz + dz));
            if (!ch) continue;
            for (const t of ch.trees) {
                const rr = 0.35 + 0.45 * t.scale.x;   // 玩家半径+树干半径
                const dxp = this.px - t.position.x, dzp = this.pz - t.position.z;
                const d = Math.hypot(dxp, dzp);
                if (d < rr) {
                    if (d < 1e-6) { this.px += rr; continue; }
                    const push = (rr - d) / d;
                    this.px += dxp * push; this.pz += dzp * push;
                }
            }
        }
    }

    // ===== 砍树/拆墙 =====
    _chopTarget() {
        this.ray.setFromCamera({ x: 0, y: 0 }, this.camera);
        const list = [];
        for (const ch of this.chunks.values()) {
            for (const t of ch.trees) list.push(t);
            for (const g of (ch.grass || [])) list.push(g);      // 草可挖
        }
        for (const w of this.walls) list.push(w.mesh);           // 木墙也可拆
        for (const t of this.tables) list.push(t.mesh);          // 合成桌也可拆
        const hits = this.ray.intersectObjects(list, true)
            .filter(h => h.object.isMesh);              // 排除描边线（默认1m容差会误命中）
        if (!hits.length) return null;
        let o = hits[0].object;
        while (o && !o.userData.id && !o.userData.isWall && !o.userData.isTable) o = o.parent; // 回溯到树/墙/桌group
        return o;
    }
    _updateChop(dt) {
        const wrap = document.getElementById('rmkChopWrap');
        const fill = document.getElementById('rmkChopFill');
        if (!this.mouseDown) { this._endChop(); return; }
        if (this._mobInRange()) { this._endChop(); return; } // 有怪贴脸优先近战
        const t = this._chopTarget();
        if (!t) { this._endChop(); return; }
        if (t !== this.chopTarget) { this._endChop(); this.chopTarget = t; }
        this.chopT += dt;
        const need = this._chopNeed(t);
        if (!t.userData.isWall && !t.userData.isTable && !t.userData.isGrass)   // 树越砍越晃；墙/桌/草不抖动
            t.rotation.z = Math.sin(this.chopT * 45) * 0.03 * Math.min(1, this.chopT * 3);
        wrap.style.display = 'block';
        fill.style.width = Math.min(100, this.chopT / need * 100) + '%';
        if (this.chopT >= need) {
            if (t.userData.isWall) this._chopWall(t);
            else if (t.userData.isTable) this._chopTable(t);
            else if (t.userData.isGrass) this._chopGrass(t);
            else this._chopTree(t);
            this._endChop();
        }
    }
    _endChop() {
        if (this.chopTarget) this.chopTarget.rotation.z = 0;
        this.chopTarget = null; this.chopT = 0;
        document.getElementById('rmkChopWrap').style.display = 'none';
        document.getElementById('rmkChopFill').style.width = '0';
    }
    _chopTree(t) {
        this.chopped.add(t.userData.id);
        for (const ch of this.chunks.values()) {
            const i = ch.trees.indexOf(t);
            if (i >= 0) { ch.trees.splice(i, 1); break; }
        }
        const wil = !!t.userData.willow;
        if (this.net === 'guest') {           // 客机：本地移除+通知主机结算掉落
            RmkNet._send({ t: 'chop', id: t.userData.id, x: +t.position.x.toFixed(1), z: +t.position.z.toFixed(1), wil: wil ? 1 : 0 });
        } else {
            const nw = wil ? 3 + Math.floor(Math.random() * 4) : 2 + Math.floor(Math.random() * 3); // 柳树3-6木材/普通2-4
            for (let i = 0; i < nw; i++) this._dropItem('wood', t.position.x, t.position.z);
            if (wil) { // 柳树另掉1-4个柳条
                const nt = 1 + Math.floor(Math.random() * 4);
                for (let i = 0; i < nt; i++) this._dropItem('twig', t.position.x, t.position.z);
            }
            if (this.net === 'host') RmkNet._send({ t: 'tree', id: t.userData.id }); // 房主砍树→客机移除
        }
        this.scene.remove(t);
    }
    _chopGrass(t) { // 挖草：65%掉1个杂乱种子
        this.dug.add(t.userData.id);
        for (const ch of this.chunks.values()) {
            const i = ch.grass.indexOf(t);
            if (i >= 0) { ch.grass.splice(i, 1); break; }
        }
        if (this.net === 'guest') {           // 客机：本地移除+通知主机结算掉落
            RmkNet._send({ t: 'gdig', id: t.userData.id, x: +t.position.x.toFixed(1), z: +t.position.z.toFixed(1) });
        } else {
            if (Math.random() < RMK_SEED_CH) this._dropItem('seed', t.position.x, t.position.z);
            if (this.net === 'host') RmkNet._send({ t: 'gdig', id: t.userData.id }); // 房主挖草→客机移除
        }
        this.scene.remove(t);
    }
    _chopWall(g) {   // 拆除木墙：掉回1个木墙物品
        const i = this.walls.findIndex(w => w.mesh === g);
        if (i < 0) return;
        const w = this.walls[i];
        this.walls.splice(i, 1);
        this.scene.remove(g);
        if (this.net === 'guest') RmkNet._send({ t: 'wgo', x: w.x, z: w.z });   // 客机拆除：主机结算掉落
        else {
            this._dropItem('wall', w.x, w.z);
            if (this.net === 'host') RmkNet._send({ t: 'wgo', x: w.x, z: w.z }); // 房主拆除→客机同步
        }
    }
    _chopTable(g) {   // 拆除合成桌：掉回1个合成桌物品
        const i = this.tables.findIndex(w => w.mesh === g);
        if (i < 0) return;
        const w = this.tables[i];
        this.tables.splice(i, 1);
        this.scene.remove(g);
        if (this.net === 'guest') RmkNet._send({ t: 'tgo', x: w.x, z: w.z });
        else {
            this._dropItem('table', w.x, w.z);
            if (this.net === 'host') RmkNet._send({ t: 'tgo', x: w.x, z: w.z });
        }
    }

    // ===== 掉落物 =====
    _dropItem(type, x, z, count) {
        const m = this._itemMesh(type);
        m.castShadow = true;
        if (type === 'frag') m.rotation.y = Math.random() * Math.PI;
        const a = Math.random() * Math.PI * 2, r = 0.3 + Math.random() * 0.8;
        m.position.set(x + Math.cos(a) * r, 0.3, z + Math.sin(a) * r);
        this.scene.add(m);
        this.drops.push({ mesh: m, type, count: count || 1, life: 60, did: ++this._dropNid }); // 60s后消失
    }
    _itemMesh(type) { // 物品的3D网格：掉落物与第一人称手持显示共用
        let m;
        if (type === 'twig') {
            m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, 0.04),   // 柳条：细长绿条
                new THREE.MeshLambertMaterial({ color: 0x8bc34a }));
        } else if (type === 'wall') {
            m = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.12), // 小木墙块
                new THREE.MeshLambertMaterial({ color: 0x8b5a2b }));
        } else if (type === 'table') {
            m = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), // 小合成桌方块
                new THREE.MeshLambertMaterial({ color: 0x6d4c33 }));
        } else if (type === 'sword') {
            m = new THREE.Group();                                     // 木剑：柄+护手+剑身
            const hd = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.05),
                new THREE.MeshLambertMaterial({ color: 0x8b5a2b }));
            hd.position.y = -0.21;
            const gd = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.05),
                new THREE.MeshLambertMaterial({ color: 0x6d4c33 }));
            gd.position.y = -0.12;
            const bl = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.32, 0.03),
                new THREE.MeshLambertMaterial({ color: 0xa06a35 }));
            bl.position.y = 0.06;
            m.add(hd, gd, bl);
        } else if (type === 'axe') {
            m = new THREE.Group();                                     // 木斧头：柄+双刃头
            const hd = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06),
                new THREE.MeshLambertMaterial({ color: 0xb8912f }));
            const axMat = new THREE.MeshLambertMaterial({ color: 0xc9a52f });
            const ax = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.04), axMat);
            ax.position.set(0.09, 0.14, 0);
            const ax2 = ax.clone(); ax2.position.x = -0.09;            // 镜像第二刃
            const wrap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.07), // 绿色缠绳
                new THREE.MeshLambertMaterial({ color: 0x52e03c }));
            wrap.position.y = 0.1;
            m.add(hd, ax, ax2, wrap);
        } else if (type === 'hoe') {
            m = new THREE.Group();                                     // 锄头：木柄+铁刃
            const hd = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.45, 0.06),
                new THREE.MeshLambertMaterial({ color: 0xa06a35 }));
            const bl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.04),
                new THREE.MeshLambertMaterial({ color: 0x78909c }));
            bl.position.set(0.07, 0.22, 0);
            m.add(hd, bl);
        } else if (type === 'frag') {
            m = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.07, 0.26), // 方块片：暗红薄片
                new THREE.MeshLambertMaterial({ color: 0xb71c1c, emissive: 0x300404 }));
            m.rotation.y = Math.random() * Math.PI;
        } else if (type === 'seed') {
            m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5),      // 杂乱种子：小褐粒
                new THREE.MeshLambertMaterial({ color: 0x8d6e63 }));
        } else if (type === 'weed') {
            m = this._makeGrass(0, 0);                                   // 杂草：缩小草丛
            m.scale.setScalar(0.6);
        } else if (type === 'rice') {
            m = new THREE.Group();                                       // 稻谷：茎+穗粒
            const st = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.04),
                new THREE.MeshLambertMaterial({ color: 0x9ccc65 }));
            const grain = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 5),
                new THREE.MeshLambertMaterial({ color: 0xe6d8a8 }));
            grain.position.y = 0.25; grain.scale.set(0.8, 1.4, 0.8);
            m.add(st, grain);
        } else if (type === 'corn') {
            m = new THREE.Group();                                       // 玉米：黄棒+绿叶壳
            const cob = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.34, 7),
                new THREE.MeshLambertMaterial({ color: 0xffd54f }));
            const husk = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.14),
                new THREE.MeshLambertMaterial({ color: 0x7cb342 }));
            husk.position.set(0.08, -0.05, 0);
            husk.rotation.z = 0.3;
            m.add(cob, husk);
        } else {
            m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28),
                new THREE.MeshLambertMaterial({ color: 0x8b5a2b }));
        }
        return m;
    }
    _updateDrops(dt) {
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const d = this.drops[i];
            d.life -= dt;
            if (d.life <= 0) {                          // 超时消失
                this.scene.remove(d.mesh);
                this.drops.splice(i, 1);
                continue;
            }
            if (d.life < 5) d.mesh.visible = Math.sin(d.life * 12) > -0.4; // 最后5s闪烁提示
            d.mesh.rotation.y += dt * 1.2;              // 较慢旋转
            const dx = this.px - d.mesh.position.x;
            const dz = this.pz - d.mesh.position.z;
            const dist = Math.hypot(dx, dz);
            if (this.net === 'guest') {                 // 客机：请求拾取，等主机give
                if (dist < 0.6 && !d._req) { d._req = true; RmkNet._send({ t: 'pick', id: d.did }); }
                continue;
            }
            if (dist < 1.6) {                           // 吸取：飞向玩家
                const k = Math.min(1, dt * (10 / Math.max(dist, 0.15)));
                d.mesh.position.x += dx * k;
                d.mesh.position.z += dz * k;
                d.mesh.position.y += ((this.py - 0.9) - d.mesh.position.y) * k;
            }
            if (dist < 0.45) {                          // 贴近后拾取进物品栏
                if (!this._addItem(d.type, d.count || 1)) continue; // 全满则留在地上
                this.scene.remove(d.mesh);
                this.drops.splice(i, 1);
            }
        }
    }
    _clearDrops() {
        for (const d of this.drops) this.scene.remove(d.mesh);
        this.drops.length = 0;
    }

    // ===== 昼夜时间 =====
    _dayF() { // 光照系数：白天1→夜里0.12，交界20s平滑过渡
        if (this.time >= RMK_DAY_LEN) return 0.12;
        const f = Math.max(0, Math.min(1, Math.min(this.time, RMK_DAY_LEN - this.time) / 20));
        const s = f * f * (3 - 2 * f);
        return 0.12 + 0.88 * s;
    }
    _updateTime(dt) {
        const cyc = RMK_DAY_LEN + RMK_NIGHT_LEN;
        this.time = (this.time + dt) % cyc;
        const night = this.time >= RMK_DAY_LEN;
        if (night !== this._wasNight) {           // 昼夜切换沿
            this._wasNight = night;
            if (night) for (let i = 0; i < 5; i++) this._spawnCube(); // 入夜先刷一波
            else this._clearCubes();                                   // 天亮清正方体（静寂黑暗不消散）
        }
        if (night && this.mobs.length < RMK_MOB_MAX) { // 夜间每3s补一只
            this.mobT -= dt;
            if (this.mobT <= 0) { this.mobT = 3; this._spawnCube(); }
        }
        this._updateSky();
        this._updateClock();
    }
    _updateSky() {
        const dayF = this._dayF();
        // 白天太阳东升西落；夜晚固定高空（光强已近0，只为阴影方向稳定）
        if (this.time < RMK_DAY_LEN) {
            const ang = Math.PI * (this.time / RMK_DAY_LEN);
            this.sunDir.set(Math.cos(ang), Math.max(0.08, Math.sin(ang)), 0.35).normalize();
        } else this.sunDir.set(0.3, 1, 0.35);
        this.sun.intensity = 0.6 * dayF;
        this.hemi.intensity = 0.25 + 0.75 * dayF;
        this.sunSprite.visible = dayF > 0.2;
        this.sunSprite.material.opacity = Math.max(0, Math.min(1, (dayF - 0.2) / 0.8));
        const c = this._skyNight.clone().lerp(this._skyDay, (dayF - 0.12) / 0.88);
        this.scene.background = c;
        this.scene.fog.color.copy(c);
    }
    _updateClock() { // 一昼夜=24h，右上角显示 ☀/🌙 + HH:MM
        const h24 = this.time / (RMK_DAY_LEN + RMK_NIGHT_LEN) * 24;
        const hh = Math.floor(h24), mm = Math.floor((h24 - hh) * 60);
        const txt = (this.time < RMK_DAY_LEN ? '☀ ' : '🌙 ') +
            String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
        if (txt !== this._clockTxt) {
            this._clockTxt = txt;
            document.getElementById('rmkTime').textContent = txt;
        }
    }

    // ===== 正方体怪 / 静寂黑暗 =====
    _randPlayerPos() { // 联机时刷怪中心=随机一名玩家
        const ps = [{ x: this.px, z: this.pz }];
        if (this.net === 'host') for (const p of this.netPeers.values()) ps.push(p);
        return ps[Math.floor(Math.random() * ps.length)];
    }
    _spawnCube(sx, sz) { // 玩家25-430m环带内刷出；sx,sz=客机按主机坐标复制
        let x = sx, z = sz;
        if (x === undefined) {
            const c = this._randPlayerPos();
            const a = Math.random() * Math.PI * 2;
            const r = RMK_SPAWN_MIN + Math.random() * (RMK_SPAWN_MAX - RMK_SPAWN_MIN);
            x = c.x + Math.cos(a) * r; z = c.z + Math.sin(a) * r;
            const h24 = this.time / (RMK_DAY_LEN + RMK_NIGHT_LEN) * 24; // 游戏时钟0-24
            if (h24 >= 19 && Math.random() < RMK_SD_CH) { this._spawnDark(x, z); return; } // 19点后70%替换为静寂黑暗
        }
        const S = RMK_MOB_SIZE, half = S / 2;
        const g = new THREE.Group();
        const geo = new THREE.BoxGeometry(S, S, S);
        const body = new THREE.Mesh(geo,
            new THREE.MeshLambertMaterial({ color: 0xe03131, emissive: 0x2a0505 })); // 亮红正方体，夜里微泛光可见
        body.castShadow = true;
        g.add(body);
        g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), // 卡通黑描边
            new THREE.LineBasicMaterial({ color: 0x1a0000 })));
        // 正面两条竖长方形眼睛（暗红，无光照也能看清轮廓）
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x8b1a1a });
        for (const ex of [-0.26, 0.26]) {
            const eye = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.62, 0.03), eyeMat);
            eye.position.set(ex, 0.05, half + 0.016);
            g.add(eye);
        }
        // 方块生物造型：四肢 + 怒眉，不再只是浮空正方体
        const limbMat = new THREE.MeshLambertMaterial({ color: 0x8e0000, emissive: 0x1a0303 });
        const limbGeo = new THREE.BoxGeometry(S * 0.18, S * 0.32, S * 0.18);
        for (const lx of [-S * 0.32, S * 0.32]) for (const lz of [-S * 0.32, S * 0.32]) {
            const leg = new THREE.Mesh(limbGeo, limbMat);
            leg.position.set(lx, -half - S * 0.08, lz);
            leg.castShadow = true;
            g.add(leg);
        }
        const armGeo = new THREE.BoxGeometry(S * 0.16, S * 0.5, S * 0.16);
        for (const ax of [-1, 1]) {
            const arm = new THREE.Mesh(armGeo, limbMat);
            arm.position.set(ax * (half + S * 0.1), -S * 0.05, 0);
            arm.rotation.z = ax * 0.25;
            arm.castShadow = true;
            g.add(arm);
        }
        const browGeo = new THREE.BoxGeometry(0.3, 0.09, 0.04);
        for (const bx of [-0.26, 0.26]) { // 斜怒眉
            const brow = new THREE.Mesh(browGeo, new THREE.MeshBasicMaterial({ color: 0x330000 }));
            brow.position.set(bx, 0.42, half + 0.02);
            brow.rotation.z = bx > 0 ? 0.45 : -0.45;
            g.add(brow);
        }
        g.position.set(x, half + S * 0.16 + this._groundH(x, z), z);
        this.scene.add(g);
        // 头顶血条（sprite画布，黑底绿条）
        const bcv = document.createElement('canvas'); bcv.width = 64; bcv.height = 10;
        const bctx = bcv.getContext('2d');
        const btex = new THREE.CanvasTexture(bcv);
        const bspr = new THREE.Sprite(new THREE.SpriteMaterial({ map: btex, depthTest: false }));
        bspr.scale.set(1.2, 0.19, 1);
        bspr.position.y = half + 0.4;
        g.add(bspr);
        this.mobs.push({ mesh: g, body, bar: { ctx: bctx, tex: btex, spr: bspr }, hp: RMK_MOB_HP, maxHp: RMK_MOB_HP,
            dmg: RMK_MOB_DMG, spd: RMK_MOB_SPD, size: S, half, atkCd: 0, hitT: 0, sd: false, emi: 0x2a0505,
            nid: ++this._mobNid }); // 联机id：客机按nid对齐快照
    }
    _spawnDark(x, z) { // 静寂黑暗：仿图深灰金属正方体+双竖白发光眼（100血/15伤/3.5m/s）
        const S = RMK_SD_SIZE, half = S / 2;
        const g = new THREE.Group();
        const geo = new THREE.BoxGeometry(S, S, S);
        const body = new THREE.Mesh(geo,
            new THREE.MeshLambertMaterial({ color: 0x4e4e58, emissive: 0x101018 })); // 深灰金属，夜里隐约可见
        body.castShadow = true;
        g.add(body);
        g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), // 黑描边轮廓
            new THREE.LineBasicMaterial({ color: 0x0a0a0d })));
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); // 白色发光竖眼（仿图）
        for (const ex of [-0.28, 0.28]) {
            const eye = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.68, 0.03), eyeMat);
            eye.position.set(ex, 0.05, half + 0.016);
            g.add(eye);
        }
        // 静寂黑暗：头顶双犄角 + 披风肩甲，轮廓更凶猛
        const hornMat = new THREE.MeshLambertMaterial({ color: 0x2b2b33, emissive: 0x0a0a10 });
        for (const hx of [-0.32, 0.32]) {
            const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 4), hornMat);
            horn.position.set(hx, half + 0.2, 0);
            horn.rotation.z = hx > 0 ? -0.3 : 0.3;
            horn.castShadow = true;
            g.add(horn);
        }
        const shoulderMat = new THREE.MeshLambertMaterial({ color: 0x3a3a44, emissive: 0x0c0c14 });
        for (const sx2 of [-1, 1]) {
            const sp = new THREE.Mesh(new THREE.BoxGeometry(S * 0.3, S * 0.12, S * 0.7), shoulderMat);
            sp.position.set(sx2 * (half + S * 0.04), half - S * 0.16, 0);
            sp.rotation.z = sx2 * 0.3;
            sp.castShadow = true;
            g.add(sp);
        }
        g.position.set(x, half + this._groundH(x, z), z);
        this.scene.add(g);
        const bcv = document.createElement('canvas'); bcv.width = 64; bcv.height = 10; // 头顶血条
        const bctx = bcv.getContext('2d');
        const btex = new THREE.CanvasTexture(bcv);
        const bspr = new THREE.Sprite(new THREE.SpriteMaterial({ map: btex, depthTest: false }));
        bspr.scale.set(1.2, 0.19, 1);
        bspr.position.y = half + 0.4;
        g.add(bspr);
        this.mobs.push({ mesh: g, body, bar: { ctx: bctx, tex: btex, spr: bspr }, hp: RMK_SD_HP, maxHp: RMK_SD_HP,
            dmg: RMK_SD_DMG, spd: RMK_SD_SPD, size: S, half, atkCd: 0, hitT: 0, sd: true, emi: 0x101018,
            sdNight: this._nightIdx, nid: ++this._mobNid }); // 出生夜序号：下一次入夜自动死亡
    }
    _drawMobBar(mo) {
        const { ctx, tex } = mo.bar;
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 64, 10);
        ctx.fillStyle = '#4caf50'; ctx.fillRect(1, 1, Math.max(0, 62 * mo.hp / mo.maxHp), 8);
        tex.needsUpdate = true;
    }
    _updateMobs(dt) {
        for (let i = this.mobs.length - 1; i >= 0; i--) {
            const mo = this.mobs[i], m = mo.mesh;
            if (mo.dying !== undefined) { // 死亡压扁：0.4s内缩短至消失，期间不攻击/不受击
                mo.dying -= dt;
                mo.bar.spr.visible = false;
                const s = Math.max(0.01, mo.dying / RMK_MOB_DIE_T);
                m.scale.y = s;
                m.position.y = mo.half * s + this._groundH(m.position.x, m.position.z);
                if (mo.dying <= 0) this._killMob(mo);
                continue;
            }
            if (mo.hitT > 0) { // 受击闪红
                mo.hitT -= dt;
                mo.body.material.emissive.setHex(mo.hitT > 0 ? 0xff2222 : mo.emi);
            }
            if (mo._barHp !== mo.hp) { mo._barHp = mo.hp; this._drawMobBar(mo); } // 血条刷新
            // 目标=最近玩家（联机含客机）
            let tx = this.px, tz = this.pz, tn = null;
            let d = Math.hypot(this.px - m.position.x, this.pz - m.position.z);
            if (this.net === 'host') for (const [n, p] of this.netPeers) {
                const pd = Math.hypot(p.x - m.position.x, p.z - m.position.z);
                if (pd < d) { d = pd; tx = p.x; tz = p.z; tn = n; }
            }
            const dx = tx - m.position.x, dz = tz - m.position.z;
            if (d <= RMK_MOB_AGGRO) {           // 玩家在18m检测区内才行动
                if (d > RMK_MOB_RANGE * 0.9) {  // 追击（正方体1.5/静寂黑暗3.5m/s）
                    const k = mo.spd * dt / d;
                    m.position.x += dx * k; m.position.z += dz * k;
                    const mp = { x: m.position.x, z: m.position.z }; // 木墙碰撞：不可穿墙
                    this._resolveWalls(mp, mo.size * 0.55);
                    m.position.x = mp.x; m.position.z = mp.z;
                }
                m.rotation.y = Math.atan2(dx, dz); // 面向目标
                mo.atkCd -= dt;
                if (d <= RMK_MOB_RANGE && mo.atkCd <= 0 &&
                    !this._wallBlocked(m.position.x, m.position.z, tx, tz)) { // 隔墙不能攻击
                    mo.atkCd = 1;                 // 1s攻速
                    if (tn) RmkNet._send({ t: 'hit', to: tn, d: mo.dmg }); // 客机：通知其掉血
                    else this._playerHit(mo.dmg); // 正方体10伤/静寂黑暗15伤
                }
            }
            m.position.y = mo.half + this._groundH(m.position.x, m.position.z); // 贴地
        }
        // 怪间散开，别挤成一团
        for (let i = 0; i < this.mobs.length; i++) for (let j = i + 1; j < this.mobs.length; j++) {
            if (this.mobs[i].dying !== undefined || this.mobs[j].dying !== undefined) continue; // 压扁中不挤位
            const a = this.mobs[i].mesh.position, b = this.mobs[j].mesh.position;
            const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz);
            const sr = (this.mobs[i].size + this.mobs[j].size) / 2 * 0.95;
            if (d < sr && d > 1e-4) {
                const p = (sr - d) / d / 2;
                a.x += dx * p; a.z += dz * p; b.x -= dx * p; b.z -= dz * p;
            }
        }
    }
    _mobInRange() {
        for (const mo of this.mobs)
            if (mo.dying === undefined &&
                Math.hypot(mo.mesh.position.x - this.px, mo.mesh.position.z - this.pz) <= RMK_ATK_RANGE &&
                !this._wallBlocked(this.px, this.pz, mo.mesh.position.x, mo.mesh.position.z)) return true;
        return false;
    }
    _updateCombat(dt) { // 玩家近战：3.5m内左键挥击，10伤（持斧15），0.6s冷却
        this.atkT -= dt;
        if (!this.mouseDown || this.atkT > 0) return;
        let best = null, bd = RMK_ATK_RANGE;
        for (const mo of this.mobs) {
            if (mo.dying !== undefined) continue; // 压扁中不可被攻击
            const d = Math.hypot(mo.mesh.position.x - this.px, mo.mesh.position.z - this.pz);
            if (d <= bd && !this._wallBlocked(this.px, this.pz, mo.mesh.position.x, mo.mesh.position.z)) { bd = d; best = mo; } // 隔墙不能攻击
        }
        if (!best) return;
        this.atkT = RMK_ATK_CD;
        const held = this.inv[this.slot];
        if (this.net === 'guest') { // 客机：请求主机结算伤害（本地只播受击闪红）
            best.hitT = 0.12;
            RmkNet._send({ t: 'atk', x: this.px, z: this.pz, h: held ? held.type : '' });
            return;
        }
        best.hp -= RMK_ATK_DMG + (held && held.type === 'sword' ? RMK_SWORD_DMG
            : held && held.type === 'axe' ? RMK_AXE_DMG : 0); // 持剑+8 持斧+5
        best.hitT = 0.12;
        const md = Math.max(0.1, Math.hypot(best.mesh.position.x - this.px, best.mesh.position.z - this.pz));
        best.mesh.position.x += (best.mesh.position.x - this.px) / md * 0.35; // 击退
        best.mesh.position.z += (best.mesh.position.z - this.pz) / md * 0.35;
        if (best.hp <= 0) {
            best.dying = RMK_MOB_DIE_T;         // 开始压扁动画
            best.hitT = 0;
            best.body.material.emissive.setHex(best.emi);
        }
    }
    _killMob(mo) {
        const i = this.mobs.indexOf(mo);
        if (i >= 0) this.mobs.splice(i, 1);
        if (!mo.sd && Math.random() < RMK_FRAG_CH) { // 正方体80%掉1-3个方块片
            const n = 1 + Math.floor(Math.random() * 3);
            for (let k = 0; k < n; k++) this._dropItem('frag', mo.mesh.position.x, mo.mesh.position.z);
        }
        this.scene.remove(mo.mesh);
    }
    _clearMobs() {
        for (const mo of this.mobs) this.scene.remove(mo.mesh);
        this.mobs.length = 0;
    }
    _clearCubes() { // 天亮只清普通正方体，静寂黑暗白天存活
        for (let i = this.mobs.length - 1; i >= 0; i--)
            if (!this.mobs[i].sd) { this.scene.remove(this.mobs[i].mesh); this.mobs.splice(i, 1); }
    }
    // ===== 木墙 =====
    _addWall(x, z, ry) {
        const g = new THREE.Group();
        const geo = new THREE.BoxGeometry(RMK_WALL_W, RMK_WALL_H, RMK_WALL_D);
        const body = new THREE.Mesh(geo,
            new THREE.MeshLambertMaterial({ color: 0x8b5a2b }));
        body.position.y = RMK_WALL_H / 2;
        body.castShadow = true; body.receiveShadow = true;
        body.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), // 黑边木板轮廓
            new THREE.LineBasicMaterial({ color: 0x4a2e12 })));
        g.add(body);
        g.position.set(x, this._groundH(x, z), z);
        g.rotation.y = ry;
        g.userData.isWall = true;   // 拆除目标标记
        this.scene.add(g);
        this.walls.push({ mesh: g, x, z, ry });
    }
    _loadWalls(list) {
        this._clearWalls();
        for (const w of list) this._addWall(w.x, w.z, w.ry);
    }
    _clearWalls() {
        for (const w of this.walls) this.scene.remove(w.mesh);
        this.walls.length = 0;
    }
    // ===== 合成桌 =====
    _addTable(x, z, ry) { // 近似正方体的合成桌方块
        const g = new THREE.Group();
        const geo = new THREE.BoxGeometry(RMK_TABLE_S, RMK_TABLE_S, RMK_TABLE_S);
        const body = new THREE.Mesh(geo,
            new THREE.MeshLambertMaterial({ color: 0x8b5a2b }));
        body.position.y = RMK_TABLE_S / 2;
        body.castShadow = true; body.receiveShadow = true;
        body.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), // 黑边轮廓
            new THREE.LineBasicMaterial({ color: 0x4a2e12 })));
        const top = new THREE.Mesh(new THREE.BoxGeometry(RMK_TABLE_S * 0.9, 0.03, RMK_TABLE_S * 0.9), // 深色台面
            new THREE.MeshLambertMaterial({ color: 0x6d4c33 }));
        top.position.y = RMK_TABLE_S / 2 + 0.016;
        body.add(top);
        g.add(body);
        g.position.set(x, this._groundH(x, z), z);
        g.rotation.y = ry;
        g.userData.isTable = true;   // 拆除/交互目标标记
        this.scene.add(g);
        this.tables.push({ mesh: g, x, z, ry });
    }
    _loadTables(list) {
        this._clearTables();
        for (const w of list) this._addTable(w.x, w.z, w.ry);
    }
    _clearTables() {
        for (const w of this.tables) this.scene.remove(w.mesh);
        this.tables.length = 0;
    }
    _tableAtCrosshair() { // 准星最近遮挡物是合成桌且距离可达 → 返回其group
        if (!this.tables.length) return null;
        const list = [];
        for (const w of this.walls) list.push(w.mesh);
        for (const t of this.tables) list.push(t.mesh);
        this.ray.setFromCamera({ x: 0, y: 0 }, this.camera);
        const hits = this.ray.intersectObjects(list, true).filter(h => h.object.isMesh);
        if (!hits.length || hits[0].distance > RMK_WALL_MAX + 1) return null;
        let o = hits[0].object;
        while (o && !o.userData.isTable && !o.userData.isWall) o = o.parent;
        return o && o.userData.isTable ? o : null;
    }
    _openTableCraft() { // 右键合成桌：打开含全部配方的合成界面
        this.bagOpen = false;
        document.getElementById('rmkBag').style.display = 'none';
        document.getElementById('rmkPause').style.display = 'none';
        this._openCraft(this.craftRecipe || 'wall', true);
        document.exitPointerLock();
    }
    _wallTarget() { // 放置点：视线方向，看地取落点，最远4.3m；朝向=面向玩家再转90°
        const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
        let d = RMK_WALL_MAX;
        if (this.pitch < -0.05) {
            const hd = (this.py - this._groundH(this.px, this.pz)) / Math.tan(-this.pitch);
            d = Math.max(0.8, Math.min(RMK_WALL_MAX, hd));
        }
        return { x: this.px + fx * d, z: this.pz + fz * d, ry: this.yaw + Math.PI / 2 };
    }
    _updateWallGhost() { // 手持木墙/合成桌时显示绿色放置虚影
        const it = this.inv[this.slot];
        const isWall = !!(it && it.type === 'wall'), isTable = !!(it && it.type === 'table');
        this.wallGhost.visible = isWall;
        this.tableGhost.visible = isTable;
        if (!isWall && !isTable) return;
        const t = this._wallTarget();
        const g = isWall ? this.wallGhost : this.tableGhost;
        g.position.set(t.x, this._groundH(t.x, t.z) + (isWall ? RMK_WALL_H : RMK_TABLE_S) / 2, t.z);
        g.rotation.y = t.ry;
    }
    _useHeld() { // 右键使用：锄头耕地/收割；种子播种；玉米+5血；返回true=已使用
        const it = this.inv[this.slot];
        if (!it) return false;
        if (it.type === 'hoe') return this._hoeUse();
        if (it.type === 'seed') return this._plantSeed();
        if (it.type !== 'corn' || this.hp >= this.maxHp) return false;
        it.count--;
        if (it.count <= 0) this.inv[this.slot] = null;
        this.hp = Math.min(this.maxHp, this.hp + RMK_CORN_HEAL);
        this._updateHud(); this._renderHotbar();
        return true;
    }
    _placeBlock() { // 右键放置：消耗1个木墙/合成桌
        const it = this.inv[this.slot];
        if (!it || (it.type !== 'wall' && it.type !== 'table')) return;
        const g = it.type === 'wall' ? this.wallGhost : this.tableGhost;
        if (!g.visible) return;
        const t = this._wallTarget();
        if (it.type === 'wall') this._addWall(t.x, t.z, t.ry);
        else this._addTable(t.x, t.z, t.ry);
        if (this.net) RmkNet._send({ t: 'place', k: it.type, x: +t.x.toFixed(1), z: +t.z.toFixed(1), ry: +t.ry.toFixed(3) }); // 联机同步放置
        it.count--;
        if (it.count <= 0) this.inv[this.slot] = null;
        this._renderHotbar();
    }
    // ===== 锄头耕地：5m×5m装饰地块；落点在已有耕地内再锄一次即消除 =====
    _hoeTarget() { // 锄头落点：视线与地面交点（需低头看地，最远RMK_WALL_MAX）
        if (this.pitch > -0.05) return null;
        const hd = (this.py - this._groundH(this.px, this.pz)) / Math.tan(-this.pitch);
        if (hd > RMK_WALL_MAX) return null;
        const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
        return { x: this.px + fx * hd, z: this.pz + fz * hd };
    }
    _farmOverlap(x, z) { // 以(x,z)为中心的5×5新田是否与已有耕地重叠（贴边拼接允许）
        return this.farms.some(f => Math.abs(x - f.x) < RMK_FARM_S && Math.abs(z - f.z) < RMK_FARM_S);
    }
    _flashHint(msg) { // 底部提示栏短暂显示消息（1.8s后还原）
        const h = document.getElementById('rmkHint');
        if (!h) return;
        if (this._hintOrig === undefined) this._hintOrig = h.textContent;
        h.textContent = msg;
        clearTimeout(this._hintT);
        this._hintT = setTimeout(() => { h.textContent = this._hintOrig; }, 1800);
    }
    _hoeUse() { // 持锄头右键：成熟作物→收割；落点在已有耕地内→消除；否则开垦5×5耕地
        const t = this._hoeTarget();
        if (!t) return false;
        const f = this.farms.find(f => Math.abs(t.x - f.x) <= RMK_FARM_S / 2 && Math.abs(t.z - f.z) <= RMK_FARM_S / 2);
        if (f && f.crop && f.crop.grow >= RMK_CROP_T) { // 成熟作物：收割（耕地保留）
            f.mesh.remove(f.crop.mesh);
            f.crop = null;
            if (this.net === 'guest') RmkNet._send({ t: 'harv', x: f.x, z: f.z }); // 客机：主机结算掉落
            else {
                this._cropDrop(f.x, f.z);
                if (this.net === 'host') RmkNet._send({ t: 'harv', x: f.x, z: f.z }); // 房主收割→客机同步
            }
            return true;
        }
        if (f) { // 消除耕地（未成熟作物一并铲除，不掉落）
            this.farms.splice(this.farms.indexOf(f), 1);
            this.scene.remove(f.mesh);
            if (this.net) RmkNet._send({ t: 'fgo', x: f.x, z: f.z }); // 联机同步消除
        } else {
            if (this._farmOverlap(t.x, t.z)) { this._flashHint('这里放不下：耕地不能和已有的重叠'); return false; }
            this._addFarm(t.x, t.z);
            if (this.net) RmkNet._send({ t: 'place', k: 'farm', x: +t.x.toFixed(1), z: +t.z.toFixed(1) });
        }
        return true;
    }
    _plantSeed() { // 持种子右键田里：落点在耕地内且无作物→播种
        const t = this._hoeTarget();
        if (!t) return false;
        const f = this.farms.find(f => Math.abs(t.x - f.x) <= RMK_FARM_S / 2 && Math.abs(t.z - f.z) <= RMK_FARM_S / 2);
        if (!f || f.crop) return false;
        this._addCrop(f, 0);
        const it = this.inv[this.slot];
        it.count--;
        if (it.count <= 0) this.inv[this.slot] = null;
        this._renderHotbar();
        if (this.net) RmkNet._send({ t: 'plant', x: f.x, z: f.z }); // 联机同步播种
        return true;
    }
    _addCrop(f, grow) { // 耕地中央种一株作物（grow=已生长秒数，按进度恢复外观）
        const g = this._makeCrop();
        f.mesh.add(g);
        f.crop = { mesh: g, grow: grow || 0 };
        if (f.crop.grow >= RMK_CROP_T) { // 已成熟：直接金黄+满尺寸
            const mat = new THREE.MeshLambertMaterial({ color: 0xd4b93f });
            for (const m of g.children) m.material = mat;
            g.scale.setScalar(1);
        } else g.scale.setScalar(0.2 + 0.8 * f.crop.grow / RMK_CROP_T);
    }
    _cropDrop(x, z) { // 收割掉落：70%杂草 20%稻谷 10%玉米
        const r = Math.random();
        this._dropItem(r < 0.7 ? 'weed' : r < 0.9 ? 'rice' : 'corn', x, z);
    }
    _updateFarms(dt) { // 作物生长：60s成熟，放大+成熟变金黄
        for (const f of this.farms) {
            const c = f.crop;
            if (!c || c.grow >= RMK_CROP_T) continue;
            c.grow = Math.min(RMK_CROP_T, c.grow + dt);
            c.mesh.scale.setScalar(0.2 + 0.8 * c.grow / RMK_CROP_T);
            if (c.grow >= RMK_CROP_T) {
                const mat = new THREE.MeshLambertMaterial({ color: 0xd4b93f });
                for (const m of c.mesh.children) m.material = mat;
            }
        }
    }
    _netPlant(m) { // 他端播种：找到落点所在耕地加作物
        const f = this.farms.find(f => Math.abs(m.x - f.x) <= RMK_FARM_S / 2 && Math.abs(m.z - f.z) <= RMK_FARM_S / 2);
        if (f && !f.crop) this._addCrop(f, 0);
    }
    _netRemoveCrop(m) { // 他端收割：移除作物不掉落
        const f = this.farms.find(f => Math.abs(m.x - f.x) <= RMK_FARM_S / 2 && Math.abs(m.z - f.z) <= RMK_FARM_S / 2);
        if (f && f.crop) { f.mesh.remove(f.crop.mesh); f.crop = null; }
    }
    _addFarm(x, z, grow) {
        const g = new THREE.Group();
        const base = new THREE.Mesh(new THREE.PlaneGeometry(RMK_FARM_S, RMK_FARM_S), // 棕色地块
            new THREE.MeshLambertMaterial({ color: 0x6d4c33 }));
        base.rotation.x = -Math.PI / 2;
        base.receiveShadow = true;
        g.add(base);
        for (let i = 0; i < 4; i++) { // 田垄：4条深色凸条
            const fur = new THREE.Mesh(new THREE.BoxGeometry(RMK_FARM_S - 0.3, 0.05, 0.4),
                new THREE.MeshLambertMaterial({ color: 0x5d4530 }));
            fur.position.set(0, 0.025, -1.6 + i * 1.06);
            fur.receiveShadow = true;
            g.add(fur);
        }
        g.position.set(x, this._groundH(x, z) + 0.02, z);
        g.userData.isFarm = true;
        this.scene.add(g);
        const rec = { mesh: g, x, z, crop: null };
        this.farms.push(rec);
        if (grow !== undefined) this._addCrop(rec, grow); // 联机快照/存档带生长进度
    }
    _loadFarms(list) {
        this._clearFarms();
        for (const f of list) this._addFarm(f.x, f.z, f.g);
    }
    _clearFarms() {
        for (const f of this.farms) this.scene.remove(f.mesh);
        this.farms.length = 0;
    }
    _resolveWalls(p, r) { // 圆形碰撞体(玩家/怪)不可穿过木墙（旋转矩形OBB推出）
        const hw = RMK_WALL_W / 2 + r, hd = RMK_WALL_D / 2 + r;
        for (const w of this.walls) {
            const c = Math.cos(w.ry), s = Math.sin(w.ry);
            let lx = (p.x - w.x) * c - (p.z - w.z) * s;
            let lz = (p.x - w.x) * s + (p.z - w.z) * c;
            if (Math.abs(lx) >= hw || Math.abs(lz) >= hd) continue;
            if (hw - Math.abs(lx) < hd - Math.abs(lz)) lx = (lx || 1) > 0 ? hw : -hw;
            else lz = (lz || 1) > 0 ? hd : -hd;
            p.x = w.x + lx * c + lz * s;
            p.z = w.z - lx * s + lz * c;
        }
        const th = RMK_TABLE_S / 2 + r; // 合成桌：近似正方体OBB推出
        for (const w of this.tables) {
            const c = Math.cos(w.ry), s = Math.sin(w.ry);
            let lx = (p.x - w.x) * c - (p.z - w.z) * s;
            let lz = (p.x - w.x) * s + (p.z - w.z) * c;
            if (Math.abs(lx) >= th || Math.abs(lz) >= th) continue;
            if (th - Math.abs(lx) < th - Math.abs(lz)) lx = (lx || 1) > 0 ? th : -th;
            else lz = (lz || 1) > 0 ? th : -th;
            p.x = w.x + lx * c + lz * s;
            p.z = w.z - lx * s + lz * c;
        }
    }
    _wallBlocked(x1, z1, x2, z2) { // 攻击视线：线段与任一木墙矩形相交→被挡（slab法）
        const hw = RMK_WALL_W / 2, hd = RMK_WALL_D / 2;
        for (const w of this.walls) {
            const c = Math.cos(w.ry), s = Math.sin(w.ry);
            const ax = (x1 - w.x) * c - (z1 - w.z) * s, az = (x1 - w.x) * s + (z1 - w.z) * c;
            const dx = (x2 - x1) * c - (z2 - z1) * s, dz = (x2 - x1) * s + (z2 - z1) * c;
            let t0 = 0, t1 = 1;
            if (Math.abs(dx) < 1e-9) { if (Math.abs(ax) > hw) continue; }
            else {
                let ta = (-hw - ax) / dx, tb = (hw - ax) / dx;
                if (ta > tb) { const tt = ta; ta = tb; tb = tt; }
                t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
                if (t0 > t1) continue;
            }
            if (Math.abs(dz) < 1e-9) { if (Math.abs(az) > hd) continue; }
            else {
                let ta = (-hd - az) / dz, tb = (hd - az) / dz;
                if (ta > tb) { const tt = ta; ta = tb; tb = tt; }
                t0 = Math.max(t0, ta); t1 = Math.min(t1, tb);
                if (t0 > t1) continue;
            }
            return true;
        }
        return false;
    }

    _playerHit(dmg) {
        if (this.hp <= 0) return;
        this.hp -= dmg;
        this.hurtT = 0.4;
        document.getElementById('rmkHurt').style.opacity = 0.45;
        this._updateHud();
        if (this.hp <= 0) {           // 死亡：掉落全部物品，出生点满血复活
            const drops = [];
            for (const arr of [this.inv, this.bag])
                for (let i = 0; i < arr.length; i++) {
                    const it = arr[i];
                    if (!it) continue;
                    drops.push({ ty: it.type, n: it.count });
                    arr[i] = null;
                }
            if (this.net === 'guest') // 客机死亡：掉落物由主机生成广播
                RmkNet._send({ t: 'die', x: +this.px.toFixed(1), z: +this.pz.toFixed(1), d: drops });
            else for (const it of drops) this._dropItem(it.ty, this.px, this.pz, it.n);
            this._renderHotbar();
            if (this.bagOpen) this._renderBag();
            this.hp = this.maxHp;
            this.px = 0; this.pz = 0;
            this.py = 1.7 + this._groundH(0, 0);
            this.vy = 0;
            this.hurtT = 1;
            this._updateHud();
        }
    }

    // ===== 联机 =====
    _clearNet() { // 退出联机：清远端玩家/重置状态
        for (const [, r] of this.netRemotes) if (this.scene) this.scene.remove(r.mesh);
        this.netRemotes.clear();
        this.netPeers.clear();
        this.net = null; this.netTime = null;
        this._worldPending = false; this._hostGoneT = 0;
        RmkNet.inGame = false;
        document.getElementById('btnRoomClose').style.display = 'none';
        document.getElementById('rmkNetTag').style.display = 'none';
    }
    _onNetMsg(m) {
        if (this.net === 'host') this._hostOnMsg(m);
        else this._guestOnMsg(m);
    }
    _roomClosed(msg) { // 房间被关/房主掉线：退回主界面
        alert(msg || '房主关闭了房间');
        RmkNet.leave(true);
        this._clearNet();
        this.exit();
    }

    // ---- 房主端消息 ----
    _hostOnMsg(m) {
        if (m.t === 'hi') {
            if (!this.netPeers.has(m.f)) {
                this.netPeers.set(m.f, { x: 0, y: 1.7, z: 0, yaw: 0, hp: 100, atkT: 0, lastSeen: performance.now() });
                const room = RmkNet.myRooms.find(r => r.id === RmkNet.roomId);
                if (room) RmkNet.bumpCnt(room, 1);
            }
            this._sendWorld(m.f);
            return;
        }
        if (!this.playing) return;
        const p = this.netPeers.get(m.f);
        switch (m.t) {
            case 'pos':
                if (p) {
                    p.x = m.x; p.y = m.y; p.z = m.z; p.yaw = m.yaw; p.hp = m.hp;
                    p.lastSeen = performance.now();
                    this._setRemote(m.f, p.x, p.y, p.z, p.yaw);
                }
                break;
            case 'bye':
                if (p) {
                    this.netPeers.delete(m.f); this._removeRemote(m.f);
                    const room = RmkNet.myRooms.find(r => r.id === RmkNet.roomId);
                    if (room) RmkNet.bumpCnt(room, -1);
                }
                break;
            case 'atk': this._netAtkFrom(m); break;
            case 'chop': this._hostChopReq(m); break;
            case 'gdig': this._hostDigReq(m); break;
            case 'plant': this._netPlant(m); break;
            case 'harv': this._hostHarvReq(m); break;
            case 'wgo': this._hostRemove(this.walls, m.x, m.z, 'wall'); break;
            case 'tgo': this._hostRemove(this.tables, m.x, m.z, 'table'); break;
            case 'fgo': this._hostRemove(this.farms, m.x, m.z, null); break;
            case 'place': if (m.k === 'wall') this._addWall(m.x, m.z, m.ry); else if (m.k === 'farm') { if (!this._farmOverlap(m.x, m.z)) this._addFarm(m.x, m.z); } else this._addTable(m.x, m.z, m.ry); break;
            case 'pick': this._hostPick(m); break;
            case 'die': for (const it of (m.d || [])) this._dropItem(it.ty, m.x, m.z, it.n); break;
        }
    }
    _sendWorld(to) { // 世界快照给新加入的客机
        const s = this.curSave;
        RmkNet._send({ t: 'world', to, seed: s.seed, time: this.time, x: this.px, z: this.pz,
            walls: this.walls.map(w => ({ x: w.x, z: w.z, ry: w.ry })),
            tables: this.tables.map(w => ({ x: w.x, z: w.z, ry: w.ry })),
            farms: this.farms.map(f => ({ x: f.x, z: f.z, g: f.crop ? +f.crop.grow.toFixed(1) : undefined })),
            chopped: [...this.chopped],
            dug: [...this.dug],
            mobs: this.mobs.map(mo => ({ id: mo.nid, t: mo.sd ? 1 : 0,
                x: +mo.mesh.position.x.toFixed(1), z: +mo.mesh.position.z.toFixed(1), hp: Math.max(0, Math.round(mo.hp)) })),
            drops: this.drops.map(d => ({ id: d.did, ty: d.type,
                x: +d.mesh.position.x.toFixed(1), z: +d.mesh.position.z.toFixed(1), n: d.count })),
            ps: [{ n: RmkNet.name, x: this.px, y: this.py, z: this.pz, yaw: this.yaw },
                 ...[...this.netPeers.entries()].map(([n, p]) => ({ n, x: p.x, y: p.y, z: p.z, yaw: p.yaw }))],
        });
    }
    _netAtkFrom(m) { // 客机挥击：按其位置结算最近怪
        const p = this.netPeers.get(m.f);
        if (!p) return;
        const now = performance.now();
        if (now - (p.atkT || 0) < RMK_ATK_CD * 900) return;
        p.atkT = now;
        let best = null, bd = RMK_ATK_RANGE;
        for (const mo of this.mobs) {
            if (mo.dying !== undefined) continue;
            const d = Math.hypot(mo.mesh.position.x - m.x, mo.mesh.position.z - m.z);
            if (d <= bd) { bd = d; best = mo; }
        }
        if (!best) return;
        best.hp -= RMK_ATK_DMG + (m.h === 'sword' ? RMK_SWORD_DMG : m.h === 'axe' ? RMK_AXE_DMG : 0);
        best.hitT = 0.12;
        const md = Math.max(0.1, Math.hypot(best.mesh.position.x - m.x, best.mesh.position.z - m.z));
        best.mesh.position.x += (best.mesh.position.x - m.x) / md * 0.35;
        best.mesh.position.z += (best.mesh.position.z - m.z) / md * 0.35;
        if (best.hp <= 0) { best.dying = RMK_MOB_DIE_T; best.hitT = 0; best.body.material.emissive.setHex(best.emi); }
    }
    _hostChopReq(m) { // 客机砍倒树：主机标记+结算掉落（树移除由各端自行广播/本地处理）
        this.chopped.add(m.id);
        this._netRemoveTree(m.id); // 主机场景同步移除
        const nw = m.wil ? 3 + Math.floor(Math.random() * 4) : 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < nw; i++) this._dropItem('wood', m.x, m.z);
        if (m.wil) {
            const nt = 1 + Math.floor(Math.random() * 4);
            for (let i = 0; i < nt; i++) this._dropItem('twig', m.x, m.z);
        }
    }
    _hostDigReq(m) { // 客机挖草：主机标记+65%结算掉落
        this.dug.add(m.id);
        this._netRemoveGrass(m.id);
        if (Math.random() < RMK_SEED_CH) this._dropItem('seed', m.x, m.z);
    }
    _hostHarvReq(m) { // 客机收割：主机移除作物+结算掉落
        const f = this.farms.find(f => Math.abs(m.x - f.x) <= RMK_FARM_S / 2 && Math.abs(m.z - f.z) <= RMK_FARM_S / 2);
        if (!f || !f.crop) return;
        f.mesh.remove(f.crop.mesh);
        f.crop = null;
        this._cropDrop(f.x, f.z);
    }
    _hostRemove(list, x, z, dropType) { // 客机拆墙/桌：主机移除+掉落
        const i = list.findIndex(w => Math.hypot(w.x - x, w.z - z) < 0.6);
        if (i < 0) return;
        const w = list[i];
        list.splice(i, 1);
        this.scene.remove(w.mesh);
        if (dropType) this._dropItem(dropType, w.x, w.z); // 耕地纯装饰：消除不掉物品
    }
    _hostPick(m) { // 客机拾取掉落物
        const i = this.drops.findIndex(d => d.did === m.id);
        if (i < 0) return;
        const d = this.drops[i];
        this.drops.splice(i, 1);
        this.scene.remove(d.mesh);
        RmkNet._send({ t: 'give', to: m.f, ty: d.type, n: d.count });
    }

    // ---- 客机端消息 ----
    _guestOnMsg(m) {
        if (m.t === 'world') { if (this._worldPending && m.to === RmkNet.name) this._joinAsGuest(m); return; }
        if (!this.playing || this.net !== 'guest') return;
        switch (m.t) {
            case 'snap': this._applySnap(m); break;
            case 'hit': if (m.to === RmkNet.name) this._playerHit(m.d); break;
            case 'give':
                if (m.to === RmkNet.name) {
                    this._addItem(m.ty, m.n);
                    this._renderHotbar(); if (this.bagOpen) this._renderBag();
                }
                break;
            case 'tree': case 'chop': this._netRemoveTree(m.id); break; // 他人砍的树
            case 'gdig': this._netRemoveGrass(m.id); break;             // 他人挖的草
            case 'plant': this._netPlant(m); break;
            case 'harv': this._netRemoveCrop(m); break;
            case 'wgo': this._netRemoveWall(m.x, m.z); break;
            case 'tgo': this._netRemoveTable(m.x, m.z); break;
            case 'fgo': this._netRemoveFrom(this.farms, m.x, m.z); break;
            case 'place': if (m.k === 'wall') this._addWall(m.x, m.z, m.ry); else if (m.k === 'farm') { if (!this._farmOverlap(m.x, m.z)) this._addFarm(m.x, m.z); } else this._addTable(m.x, m.z, m.ry); break;
            case 'pos': this._setRemote(m.f, m.x, m.y, m.z, m.yaw); break;
            case 'bye': this._removeRemote(m.f); break;
            case 'closed': this._roomClosed(); break;
        }
    }
    _joinAsGuest(m) {
        this._worldPending = false;
        clearInterval(RmkNet._hiT); RmkNet._hiT = null;     // 已拿到world包，停hi重发
        this.net = 'guest';
        const s = { id: '__room__', name: '联机房间',
            x: m.x + 2, y: 1.7, z: m.z + 2, yaw: 0,
            hp: 100, slot: 0, t: Date.now(), time: m.time, seed: m.seed,
            walls: m.walls || [], tables: m.tables || [], chopped: m.chopped || [], dug: m.dug || [], farms: m.farms || [] };
        document.getElementById('rmkLobbyScreen').style.display = 'none';
        this._enterWorld(s);
        RmkNet.inGame = true;
        const tag = document.getElementById('rmkNetTag');
        tag.style.display = 'block';
        tag.textContent = '🌐 联机房间（客机）';
        for (const mo of m.mobs || []) this._netSpawnMob(mo);
        for (const d of m.drops || []) this._netSpawnDrop(d);
        for (const p of m.ps || []) if (p.n !== RmkNet.name) this._setRemote(p.n, p.x, p.y, p.z, p.yaw);
    }
    _applySnap(m) {
        this.netTime = m.tm;
        this._hostGoneT = 0;
        const seen = new Set();
        for (const o of m.mobs || []) {
            seen.add(o.id);
            let mo = this.mobs.find(x => x.nid === o.id);
            if (!mo) { this._netSpawnMob(o); mo = this.mobs[this.mobs.length - 1]; }
            else if (mo.hp > o.hp) mo.hitT = 0.12;
            mo.hp = o.hp;
            if (o.dy && mo.dying === undefined) mo.dying = RMK_MOB_DIE_T;
            if (mo.dying === undefined) { mo.tx = o.x; mo.tz = o.z; }
        }
        for (let i = this.mobs.length - 1; i >= 0; i--) {
            const mo = this.mobs[i];
            if (!seen.has(mo.nid)) { this.scene.remove(mo.mesh); this.mobs.splice(i, 1); }
        }
        const dseen = new Set();
        for (const o of m.drops || []) {
            dseen.add(o.id);
            if (!this.drops.some(d => d.did === o.id)) this._netSpawnDrop(o);
        }
        for (let i = this.drops.length - 1; i >= 0; i--) {
            const d = this.drops[i];
            if (d.did !== undefined && !dseen.has(d.did)) { this.scene.remove(d.mesh); this.drops.splice(i, 1); }
        }
        for (const p of m.p || []) if (p.n !== RmkNet.name) this._setRemote(p.n, p.x, p.y, p.z, p.yaw);
    }
    _netSpawnMob(o) { // 客机按主机坐标建怪（含静寂黑暗）
        const n0 = this.mobs.length;
        if (o.t === 1) this._spawnDark(o.x, o.z);
        else this._spawnCube(o.x, o.z);
        const mo = this.mobs[this.mobs.length - 1];
        if (this.mobs.length > n0) { mo.nid = o.id; mo.hp = o.hp; }
    }
    _netSpawnDrop(o) {
        this._dropItem(o.ty, o.x, o.z, o.n);
        const d = this.drops[this.drops.length - 1];
        d.did = o.id;
        d.mesh.position.x = o.x; d.mesh.position.z = o.z;
    }
    _netRemoveTree(id) {
        this.chopped.add(id);
        for (const ch of this.chunks.values()) {
            const i = ch.trees.findIndex(t => t.userData.id === id);
            if (i >= 0) { this.scene.remove(ch.trees[i]); ch.trees.splice(i, 1); return; }
        }
    }
    _netRemoveGrass(id) {
        this.dug.add(id);
        for (const ch of this.chunks.values()) {
            const i = ch.grass.findIndex(g => g.userData.id === id);
            if (i >= 0) { this.scene.remove(ch.grass[i]); ch.grass.splice(i, 1); return; }
        }
    }
    _netRemoveWall(x, z) { this._netRemoveFrom(this.walls, x, z); }
    _netRemoveTable(x, z) { this._netRemoveFrom(this.tables, x, z); }
    _netRemoveFrom(list, x, z) {
        const i = list.findIndex(w => Math.hypot(w.x - x, w.z - z) < 0.6);
        if (i < 0) return;
        this.scene.remove(list[i].mesh);
        list.splice(i, 1);
    }
    _updateNetTime(dt) { // 客机时钟平滑追主机
        if (this.netTime !== null) {
            const cyc = RMK_DAY_LEN + RMK_NIGHT_LEN;
            let diff = this.netTime - this.time;
            if (diff < -cyc / 2) diff += cyc;
            if (diff > cyc / 2) diff -= cyc;
            this.time = (this.time + diff * Math.min(1, dt * 3) + cyc) % cyc;
        }
        this._updateSky();
        this._updateClock();
    }
    _updateNetMobs(dt) { // 客机怪：插值+压扁动画+血条（无AI）
        for (let i = this.mobs.length - 1; i >= 0; i--) {
            const mo = this.mobs[i], m = mo.mesh;
            if (mo.dying !== undefined) {
                mo.dying -= dt;
                mo.bar.spr.visible = false;
                const s = Math.max(0.01, mo.dying / RMK_MOB_DIE_T);
                m.scale.y = s;
                m.position.y = mo.half * s + this._groundH(m.position.x, m.position.z);
                if (mo.dying <= 0) { this.scene.remove(m); this.mobs.splice(i, 1); }
                continue;
            }
            if (mo.hitT > 0) {
                mo.hitT -= dt;
                mo.body.material.emissive.setHex(mo.hitT > 0 ? 0xff2222 : mo.emi);
            }
            if (mo._barHp !== mo.hp) { mo._barHp = mo.hp; this._drawMobBar(mo); }
            if (mo.tx !== undefined) {
                const k = Math.min(1, dt * 8);
                m.position.x += (mo.tx - m.position.x) * k;
                m.position.z += (mo.tz - m.position.z) * k;
            }
            m.position.y = mo.half + this._groundH(m.position.x, m.position.z);
        }
    }

    // ---- 远端玩家 ----
    _setRemote(n, x, y, z, yaw) {
        let r = this.netRemotes.get(n);
        if (!r) { r = this._makeRemote(n); this.netRemotes.set(n, r); }
        r.tx = x; r.ty = y; r.tz = z; r.tyaw = yaw;
    }
    _makeRemote(name) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.1, 0.4),
            new THREE.MeshLambertMaterial({ color: 0x5c6bc0 }));
        body.position.y = 1.0; body.castShadow = true;
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4),
            new THREE.MeshLambertMaterial({ color: 0xffcc80 }));
        head.position.y = 1.75; head.castShadow = true;
        g.add(body, head);
        const cv = document.createElement('canvas'); cv.width = 128; cv.height = 24;
        const cx = cv.getContext('2d');
        cx.fillStyle = 'rgba(0,0,0,0.4)'; cx.fillRect(0, 0, 128, 24);
        cx.fillStyle = '#fff'; cx.font = 'bold 15px sans-serif';
        cx.textAlign = 'center'; cx.fillText(name.slice(0, 10), 64, 17);
        const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false }));
        spr.scale.set(2.4, 0.45, 1); spr.position.y = 2.25;
        g.add(spr);
        this.scene.add(g);
        return { mesh: g, tx: 0, ty: 0, tz: 0, tyaw: 0 };
    }
    _removeRemote(n) {
        const r = this.netRemotes.get(n);
        if (r) { this.scene.remove(r.mesh); this.netRemotes.delete(n); }
    }
    _updateRemotes(dt) {
        for (const [, r] of this.netRemotes) {
            const k = Math.min(1, dt * 10);
            const m = r.mesh;
            m.position.x += (r.tx - m.position.x) * k;
            m.position.z += (r.tz - m.position.z) * k;
            m.position.y += ((r.ty - 1.7) - m.position.y) * k; // py是眼高，组原点贴脚底
            m.rotation.y = r.tyaw;
        }
    }

    // ---- 收发节拍 ----
    _netTick(dt) {
        if (!this.net) return;
        this._posT -= dt;
        if (this._posT <= 0) {
            this._posT = 0.1;
            RmkNet._send({ t: 'pos', x: +this.px.toFixed(2), y: +this.py.toFixed(2),
                z: +this.pz.toFixed(2), yaw: +this.yaw.toFixed(3), hp: Math.round(this.hp) });
        }
        if (this.net === 'host') {
            this._snapT -= dt;
            if (this._snapT <= 0) {
                this._snapT = 0.1;
                const now = performance.now();
                const ps = [{ n: RmkNet.name, x: +this.px.toFixed(2), y: +this.py.toFixed(2),
                    z: +this.pz.toFixed(2), yaw: +this.yaw.toFixed(3), hp: Math.round(this.hp) }];
                for (const [n, p] of this.netPeers) {
                    if (now - p.lastSeen > 12000) {   // 掉线清理
                        this.netPeers.delete(n); this._removeRemote(n);
                        const room = RmkNet.myRooms.find(r => r.id === RmkNet.roomId);
                        if (room) RmkNet.bumpCnt(room, -1);
                        continue;
                    }
                    this._setRemote(n, p.x, p.y, p.z, p.yaw);
                    ps.push({ n, x: p.x, y: p.y, z: p.z, yaw: p.yaw, hp: p.hp });
                }
                RmkNet._send({ t: 'snap', tm: +this.time.toFixed(1),
                    mobs: this.mobs.map(mo => ({ id: mo.nid, t: mo.sd ? 1 : 0,
                        x: +mo.mesh.position.x.toFixed(1), z: +mo.mesh.position.z.toFixed(1),
                        hp: Math.max(0, Math.round(mo.hp)), dy: mo.dying !== undefined ? 1 : 0 })),
                    drops: this.drops.map(d => ({ id: d.did, ty: d.type,
                        x: +d.mesh.position.x.toFixed(1), z: +d.mesh.position.z.toFixed(1), n: d.count })),
                    p: ps });
            }
        } else {
            this._hostGoneT += dt;
            if (this._hostGoneT > 12) this._roomClosed('与房主失去连接');
        }
    }

    // ===== 物品/背包 =====
    _itemHtml(type) {
        if (type === 'wood') return '<div class="rmk-item-wood"></div>';
        if (type === 'twig') return '<div class="rmk-item-twig"><svg viewBox="0 0 24 24"><path d="M6 2.5C12.5 5 16.8 11.5 17.5 21.5" fill="none" stroke="#6d4c33" stroke-width="1.8" stroke-linecap="round"/><path d="M8.6 5.6c2.3-.6 4.3.2 5.3 2-2.3.6-4.3-.2-5.3-2z" fill="#8bc34a" stroke="#558b2f" stroke-width=".7"/><path d="M12 10.2c2.4-.5 4.3.4 5.2 2.2-2.4.5-4.3-.4-5.2-2.2z" fill="#8bc34a" stroke="#558b2f" stroke-width=".7"/><path d="M14.6 15.2c2.3-.4 4.2.7 4.9 2.4-2.3.4-4.2-.7-4.9-2.4z" fill="#8bc34a" stroke="#558b2f" stroke-width=".7"/><path d="M8.3 10c-2.2.7-4.1.1-5.2-1.6 2.2-.7 4.1-.1 5.2 1.6z" fill="#7cb342" stroke="#558b2f" stroke-width=".7"/><path d="M11.6 14.8c-2.3.5-4.2-.2-5.1-1.9 2.3-.5 4.2.2 5.1 1.9z" fill="#7cb342" stroke="#558b2f" stroke-width=".7"/></svg></div>';
        if (type === 'sword') return '<div class="rmk-item-sword"><svg viewBox="0 0 24 24"><g transform="rotate(45 12 12)"><path d="M10.4 3.2 12 .6l1.6 2.6z" fill="#a06a35" stroke="#5d3a1a" stroke-width=".9"/><rect x="10.4" y="3.2" width="3.2" height="12" rx=".8" fill="#a06a35" stroke="#5d3a1a" stroke-width=".9"/><rect x="7" y="15" width="10" height="2" rx=".9" fill="#6d4c33" stroke="#3a2718" stroke-width=".9"/><rect x="10.8" y="17" width="2.4" height="6" rx="1" fill="#8b5a2b" stroke="#5d3a1a" stroke-width=".9"/></g></svg></div>';
        if (type === 'wall') return '<div class="rmk-item-wall"><svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="6" height="14" rx="1" fill="#a06a35" stroke="#5d3a1a" stroke-width="1"/><rect x="9.5" y="5" width="6" height="14" rx="1" fill="#8b5a2b" stroke="#5d3a1a" stroke-width="1"/><rect x="16.5" y="5" width="5" height="14" rx="1" fill="#a06a35" stroke="#5d3a1a" stroke-width="1"/></svg></div>';
        if (type === 'axe') return '<div class="rmk-item-axe"><img src="img/rmk_axe.png" alt="木斧头"></div>';
        if (type === 'frag') return '<div class="rmk-item-frag"><svg viewBox="0 0 24 24"><rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="#c62828" stroke="#5d1313" stroke-width="1.2" transform="rotate(18 12 12)"/><rect x="10" y="9" width="7" height="7" rx="1" fill="#e53935" stroke="#7f1d1d" stroke-width=".8" transform="rotate(-12 12 12)"/></svg></div>';
        if (type === 'seed') return '<div class="rmk-item-seed"><svg viewBox="0 0 24 24"><ellipse cx="9" cy="9.5" rx="2.4" ry="3.4" fill="#a1887f" stroke="#5d4037" stroke-width=".9" transform="rotate(-20 9 9.5)"/><ellipse cx="15.5" cy="12" rx="2.2" ry="3.1" fill="#8d6e63" stroke="#5d4037" stroke-width=".9" transform="rotate(15 15.5 12)"/><ellipse cx="10.5" cy="16" rx="2" ry="2.9" fill="#a1887f" stroke="#5d4037" stroke-width=".9" transform="rotate(-8 10.5 16)"/></svg></div>';
        if (type === 'weed') return '<div class="rmk-item-weed"><svg viewBox="0 0 24 24"><path d="M12 21c0-5-1-8-4-10 3.5-.5 4 2.5 4 2.5s-1-6 0-9c1.5 3 0 9 0 9s.5-3 4-2.5c-3 2-4 5-4 10z" fill="#66bb6a" stroke="#33691e" stroke-width="1"/><path d="M8 21c0-3-.5-5-2.5-6.5 2.5-.8 3.8.8 2.5 6.5zM16 21c0-3 .5-5 2.5-6.5-2.5-.8-3.8.8-2.5 6.5z" fill="#558b2f" stroke="#33691e" stroke-width=".8"/></svg></div>';
        if (type === 'rice') return '<div class="rmk-item-rice"><svg viewBox="0 0 24 24"><path d="M12 22V8" stroke="#9ccc65" stroke-width="1.6"/><path d="M12 8c-1.5-2.5-1-5 0-6 1 1 1.5 3.5 0 6z" fill="#e6d8a8" stroke="#a1884f" stroke-width=".7"/><ellipse cx="9.5" cy="7" rx="1.4" ry="2.4" fill="#e6d8a8" stroke="#a1884f" stroke-width=".7" transform="rotate(-30 9.5 7)"/><ellipse cx="14.5" cy="7" rx="1.4" ry="2.4" fill="#e6d8a8" stroke="#a1884f" stroke-width=".7" transform="rotate(30 14.5 7)"/><ellipse cx="9" cy="11" rx="1.3" ry="2.2" fill="#e6d8a8" stroke="#a1884f" stroke-width=".7" transform="rotate(-35 9 11)"/><ellipse cx="15" cy="11" rx="1.3" ry="2.2" fill="#e6d8a8" stroke="#a1884f" stroke-width=".7" transform="rotate(35 15 11)"/></svg></div>';
        if (type === 'corn') return '<div class="rmk-item-corn"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="10.5" rx="4" ry="7.5" fill="#ffd54f" stroke="#c17900" stroke-width="1"/><path d="M9 6h6M8.5 9.5h7M8.5 13h7M9.5 16h5" stroke="#c17900" stroke-width=".8" fill="none"/><path d="M12 18c-2.5 0-4.5 1-5 4h10c-.5-3-2.5-4-5-4z" fill="#7cb342" stroke="#33691e" stroke-width=".9"/></svg></div>';
        if (type === 'hoe') return '<div class="rmk-item-hoe"><svg viewBox="0 0 24 24"><g transform="rotate(45 12 12)"><rect x="11" y="1.5" width="2.2" height="13.5" rx="1" fill="#a06a35" stroke="#5d3a1a" stroke-width=".8"/><rect x="7.5" y="14.5" width="9" height="3" rx="1" fill="#90a4ae" stroke="#546e7a" stroke-width=".8"/><rect x="9" y="17.5" width="6" height="4.5" rx="1" fill="#78909c" stroke="#546e7a" stroke-width=".8"/></g></svg></div>';
        if (type === 'table') return '<div class="rmk-item-table"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="5" rx="1" fill="#a06a35" stroke="#5d3a1a" stroke-width="1"/><rect x="5" y="10" width="3" height="10" fill="#8b5a2b" stroke="#5d3a1a" stroke-width=".8"/><rect x="16" y="10" width="3" height="10" fill="#8b5a2b" stroke="#5d3a1a" stroke-width=".8"/></svg></div>';
        return '';
    }
    _addItem(type, n) {
        // 先堆叠已有的不满45的同种物品（物品栏+背包）
        let it = this.inv.concat(this.bag).find(i => i && i.type === type && i.count < 45);
        if (it) { const a = Math.min(n, 45 - it.count); it.count += a; n -= a; }
        // 再开新堆：物品栏空格优先，然后背包空格
        while (n > 0) {
            let arr = this.inv, cap = 7, idx = arr.findIndex(i => !i);
            if (idx < 0 && arr.length < cap) idx = arr.length;
            if (idx < 0) {
                arr = this.bag; cap = 8;
                idx = arr.findIndex(i => !i);
                if (idx < 0 && arr.length < cap) idx = arr.length;
            }
            if (idx < 0) { this._renderHotbar(); if (this.bagOpen) this._renderBag(); return false; }
            const a = Math.min(n, 45);
            arr[idx] = { type, count: a }; n -= a;
        }
        this._renderHotbar();
        if (this.bagOpen) this._renderBag();
        return true;
    }
    _countItem(type) {
        let n = 0;
        for (const arr of [this.inv, this.bag])
            for (const i of arr) if (i && i.type === type) n += i.count;
        return n;
    }
    _takeItem(type, n) {
        for (const arr of [this.inv, this.bag]) {
            for (let k = 0; k < arr.length && n > 0; k++) {
                const i = arr[k];
                if (!i || i.type !== type) continue;
                const t = Math.min(n, i.count);
                i.count -= t; n -= t;
                if (i.count <= 0) arr[k] = null;
            }
        }
    }
    _chopNeed(t) {
        if (t && t.userData.isGrass) return RMK_GRASS_CHOP;    // 草0.1s挖掉
        const base = (t && t.userData.willow) ? 3.2 : 2; // 柳树3.2s，其余(树/木墙/合成桌)2s
        const it = this.inv[this.slot];
        return (it && it.type === 'axe') ? base - 0.8 : base;   // 手持木斧头-0.8s
    }
    _toggleBag() {
        if (this.bagOpen) {
            this.bagOpen = false;
            this.invSel = null;
            if (this.craftOpen) this._closeCraft();
            document.getElementById('rmkBag').style.display = 'none';
            if (this.paused) this._lock();
        } else if (!this.paused) {
            this.bagOpen = true;
            this._renderBag();
            document.exitPointerLock();   // 解锁后 pointerlockchange 显示背包面板
        }
    }
    // ===== 合成面板：4格放材料（仅配方认可的材料） =====
    // 木斧头：木+10%/柳+25%，≥2木；木墙：木+20%/柳+15%，≥3木；木剑：木+13%/柳+15%，≥2木+1柳；合成桌：木+5%/柳+6%/墙+15%，≥1木+1墙；锄头：木+30%/柳+30%，≥1木+1柳；方块片任意配方+5%/片；失败不返还
    _openCraft(recipe, fromTable) {
        this.craftRecipe = recipe || 'wall';
        this.craftOpen = true;
        this.craftFromTable = !!fromTable;
        this.craftSlots = [null, null, null, null];
        document.getElementById('rmkCraftMsg').textContent = '';
        document.getElementById('rmkCraftTitle').textContent = RMK_CRAFT_TITLES[this.craftRecipe] || RMK_CRAFT_TITLES.wall;
        this._renderCraft();
        document.getElementById('rmkCraft').style.display = 'flex';
    }
    _closeCraft() {
        const fromTable = this.craftFromTable;
        this.craftOpen = false;
        this.craftFromTable = false;
        for (const t of this.craftSlots) if (t) this._addItem(t, 1);   // 未合成关闭：格子物品退回
        this.craftSlots = [null, null, null, null];
        document.getElementById('rmkCraft').style.display = 'none';
        if (fromTable && this.playing) this._lock();   // 合成桌界面关闭后回到游戏
    }
    _setCraftRecipe(r) { // 合成桌界面：切换配方，新配方不接受的格子材料退回
        if (r === this.craftRecipe) return;
        this.craftRecipe = r;
        const ok = RMK_CRAFT_MATS[r];
        for (let i = 0; i < 4; i++) {
            const t = this.craftSlots[i];
            if (t && ok.indexOf(t) < 0) { this.craftSlots[i] = null; this._addItem(t, 1); }
        }
        document.getElementById('rmkCraftMsg').textContent = '';
        document.getElementById('rmkCraftTitle').textContent = RMK_CRAFT_TITLES[r] || r;
        this._renderCraft();
    }
    _craftChance() {
        let w = 0, t = 0, l = 0, f = 0;
        for (const s of this.craftSlots) { if (s === 'wood') w++; else if (s === 'twig') t++; else if (s === 'wall') l++; else if (s === 'frag') f++; }
        const bonus = f * 5; // 方块片：任意配方每片+5%
        if (this.craftRecipe === 'hoe')
            return (w < 1 || t < 1) ? 0 : Math.min(100, w * 30 + t * 30 + bonus); // 锄头：木+30%/柳条+30%，≥1木+1柳条
        if (this.craftRecipe === 'wall')
            return w < 3 ? 0 : Math.min(100, w * 20 + t * 15 + bonus);
        if (this.craftRecipe === 'sword')
            return (w < 2 || t < 1) ? 0 : Math.min(100, w * 13 + t * 15 + bonus);
        if (this.craftRecipe === 'table')
            return (w < 1 || l < 1) ? 0 : Math.min(100, w * 5 + t * 6 + l * 15 + bonus);
        return w < 2 ? 0 : Math.min(100, w * 10 + t * 25 + bonus);
    }
    _renderCraft() {
        const slots = document.getElementById('rmkCraftSlots');
        slots.innerHTML = '';
        for (let i = 0; i < 4; i++) {
            const d = document.createElement('div');
            d.className = 'rmk-slot';
            d.dataset.i = i;
            if (this.craftSlots[i]) d.innerHTML = this._itemHtml(this.craftSlots[i]);
            slots.appendChild(d);
        }
        const rlist = document.getElementById('rmkCraftList');
        rlist.style.display = this.craftFromTable ? 'flex' : 'none';
        rlist.innerHTML = '';
        if (this.craftFromTable) { // 合成桌界面：列出所有可合成物
            for (const r of ['wall', 'axe', 'sword', 'table', 'hoe']) {
                const b = document.createElement('button');
                b.className = 'menu-btn' + (r === this.craftRecipe ? ' sel' : '');
                b.textContent = RMK_CRAFT_NAMES[r];
                b.addEventListener('click', () => this._setCraftRecipe(r));
                rlist.appendChild(b);
            }
        }
        const grid = document.getElementById('rmkCraftInv');
        grid.innerHTML = '';
        const allow = RMK_CRAFT_MATS[this.craftRecipe] || [];
        for (const arr of [this.inv, this.bag]) {
            for (const it of arr) {
                if (!it) continue;
                const d = document.createElement('div');
                d.className = 'rmk-slot' + (allow.indexOf(it.type) >= 0 ? ' ok' : '');
                d.dataset.type = it.type;
                d.innerHTML = this._itemHtml(it.type) + '<span class="rmk-cnt">' + it.count + '</span>';
                grid.appendChild(d);
            }
        }
        if (!grid.childElementCount)
            grid.innerHTML = '<div class="rmk-craft-empty">背包是空的</div>';
        document.getElementById('rmkCraftChance').textContent = '成功率 ' + this._craftChance() + '%';
    }
    _craftDo() {
        const msg = document.getElementById('rmkCraftMsg');
        const ch = this._craftChance();
        const ok = ch > 0 && Math.random() * 100 < ch;
        this.craftSlots = [null, null, null, null];   // 无论成败都消耗（失败不返还）
        if (ok) {
            const it = this.craftRecipe;
            this._addItem(it, 1);
            msg.textContent = '合成成功！获得' + RMK_CRAFT_NAMES[it];
        } else msg.textContent = '合成失败';
        this._renderCraft();
        this._renderHotbar();
        if (this.bagOpen) this._renderBag();
    }
    // 背包/物品栏格子点击：选中→再点交换
    _invSlotClick(src, i) {
        const arr = src === 'bag' ? this.bag : this.inv;
        if (this.invSel === null) {
            if (!arr[i]) return;                       // 空格不可选中
            this.invSel = { src, i };
        } else if (this.invSel.src === src && this.invSel.i === i) {
            this.invSel = null;                        // 再点自己=取消
        } else {
            this._moveSlot(this.invSel, { src, i });   // 交换/合并
            this.invSel = null;
        }
        this._renderBag(); this._renderHotbar();
    }
    _moveSlot(a, b) {   // a/b: {src:'bag'|'inv', i}
        const A = a.src === 'bag' ? this.bag : this.inv;
        const B = b.src === 'bag' ? this.bag : this.inv;
        const x = A[a.i], y = B[b.i];
        if (!x) return;
        if (!y) { B[b.i] = x; A[a.i] = null; }
        else if (y.type === x.type) {                // 同类合并，每格最多45
            const move = Math.min(45 - y.count, x.count);
            y.count += move; x.count -= move;
            if (x.count <= 0) A[a.i] = null;
        } else { B[b.i] = x; A[a.i] = y; }           // 异类交换
    }
    _renderBag() {
        const grid = document.getElementById('rmkBagGrid');
        if (grid.childElementCount !== 8) {
            grid.innerHTML = '';
            for (let i = 0; i < 8; i++) {
                const d = document.createElement('div');
                d.className = 'rmk-slot';
                d.dataset.src = 'bag'; d.dataset.i = i;
                grid.appendChild(d);
            }
        }
        for (let i = 0; i < 8; i++) {
            const el = grid.children[i], it = this.bag[i];
            const html = it ? this._itemHtml(it.type) + '<span class="rmk-cnt">' + it.count + '</span>' : '';
            if (el._rmkHtml !== html) { el.innerHTML = html; el._rmkHtml = html; }
            el.draggable = !!it;
            el.classList.toggle('sel', !!(this.invSel && this.invSel.src === 'bag' && this.invSel.i === i));
        }
        // 面板内物品栏（0-6）
        const bar = document.getElementById('rmkInvBar');
        if (bar) {
            if (bar.childElementCount !== 7) {
                bar.innerHTML = '';
                for (let i = 0; i < 7; i++) {
                    const d = document.createElement('div');
                    d.className = 'rmk-slot';
                    d.dataset.src = 'inv'; d.dataset.i = i;
                    bar.appendChild(d);
                }
            }
            for (let i = 0; i < 7; i++) {
                const el = bar.children[i], it = this.inv[i];
                const html = it ? this._itemHtml(it.type) + '<span class="rmk-cnt">' + it.count + '</span>' : '';
                if (el._rmkHtml !== html) { el.innerHTML = html; el._rmkHtml = html; }
                el.draggable = !!it;
                el.classList.toggle('sel', !!(this.invSel && this.invSel.src === 'inv' && this.invSel.i === i));
            }
        }
    }

    // ===== HUD =====
    _updateHud() {
        document.getElementById('rmkHpFill').style.width = Math.max(0, this.hp / this.maxHp * 100) + '%';
        document.getElementById('rmkHpText').textContent = Math.ceil(this.hp);
    }
    _renderHotbar() {
        const bar = document.getElementById('rmkHotbar');
        if (bar.childElementCount !== 7) {
            bar.innerHTML = '';
            for (let i = 0; i < 7; i++) {
                const d = document.createElement('div');
                d.className = 'rmk-slot';
                bar.appendChild(d);
            }
        }
        for (let i = 0; i < 7; i++) {
            const el = bar.children[i];
            el.classList.toggle('sel', i === this.slot);
            const it = this.inv[i];
            const html = it ? this._itemHtml(it.type) + '<span class="rmk-cnt">' + it.count + '</span>' : '';
            if (el._rmkHtml !== html) { el.innerHTML = html; el._rmkHtml = html; }
        }
    }
}
window.remake = new RemakeGame();
window.remake = new RemakeGame();
