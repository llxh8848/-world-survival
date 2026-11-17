// ===== 我的世界 · 3D体素方块沙盒 (无限区块动态加载 + 极致防卡顿 + 纯生存背包合成) =====
(function () {
    'use strict';
    const el = id => document.getElementById(id);

    const CHUNK_SIZE = 16;   // 每个区块 16x16
    const VIEW_DIST = 2;     // 视距半径 (周围 5x5 = 25个动态无缝区块)

    // 方块与物品定义 (hard=硬度, best=最适工具, harvest=采集所需工具等级, drop=掉落物id, tool=工具属性)
    const TOOL_TIERS = {
        wood:  { tier: 1, speed: 2, dur: 59,  name: '木' },
        stone: { tier: 2, speed: 4, dur: 131, name: '石' },
        iron:  { tier: 3, speed: 6, dur: 250, name: '铁' }
    };
    const TOOL_KINDS = { pickaxe: '镐', axe: '斧', shovel: '锹' };
    const ITEM_DEFS = [
        { id: 1, key: 'wood',     name: '橡木原木', top: '#c8a675', side: '#73512e', isWood: true, hard: 2, best: 'axe' },
        { id: 2, key: 'planks',   name: '橡木木板', color: '#c19a6b', noise: 15, hard: 2, best: 'axe' },
        { id: 3, key: 'stick',    name: '木棍',     color: '#8d6e63', isItem: true },
        { id: 4, key: 'crafting', name: '工作台',   top: '#b8860b', side: '#8b6508', isCrafting: true, hard: 2.5, best: 'axe' },
        { id: 5, key: 'pickaxe',  name: '木镐',     color: '#c19a6b', isItem: true, tool: { type: 'pickaxe', ...TOOL_TIERS.wood } },
        { id: 6, key: 'dirt',     name: '泥土',     color: '#866043', hard: 0.5, best: 'shovel' },
        { id: 7, key: 'stone',    name: '石头',     color: '#757575', noise: 25, hard: 1.5, best: 'pickaxe', harvest: 1, drop: 14 },
        { id: 8, key: 'apple',    name: '红苹果',   color: '#e53935', isFood: true },
        { id: 9, key: 'tnt',      name: 'TNT',      top: '#d32f2f', side: '#e53935', isTNT: true, hard: 0 },
        { id: 10, key: 'grass',   name: '草方块',   top: '#5b8731', side: '#866043', sideGrass: true, bot: '#866043', hard: 0.6, best: 'shovel', drop: 6 },
        { id: 11, key: 'leaves',  name: '橡树树叶', color: '#338833', transparent: true, opacity: 0.88, hard: 0.2 },
        { id: 12, key: 'coal_ore', name: '煤矿石',  color: '#757575', noise: 25, speck: '#263238', hard: 3, best: 'pickaxe', harvest: 1, drop: 20 },
        { id: 14, key: 'cobble',  name: '圆石',     color: '#8a8a8a', noise: 45, hard: 2, best: 'pickaxe', harvest: 1 },
        { id: 15, key: 'iron_ore', name: '铁矿石',  color: '#757575', noise: 25, speck: '#d7a98c', hard: 3, best: 'pickaxe', harvest: 2, drop: 21 },
        { id: 16, key: 'furnace', name: '熔炉',     color: '#7a7a7a', noise: 30, isFurnace: true, hard: 3.5, best: 'pickaxe', harvest: 1 },
        { id: 17, key: 'stone_pickaxe', name: '石镐', color: '#8a8a8a', isItem: true, tool: { type: 'pickaxe', ...TOOL_TIERS.stone } },
        { id: 18, key: 'iron_pickaxe',  name: '铁镐', color: '#e0e0e0', isItem: true, tool: { type: 'pickaxe', ...TOOL_TIERS.iron } },
        { id: 19, key: 'iron_ingot', name: '铁锭',  color: '#e0e0e0', isItem: true },
        { id: 20, key: 'coal',    name: '煤炭',     color: '#212121', isItem: true },
        { id: 21, key: 'raw_iron', name: '粗铁',    color: '#d7a98c', isItem: true },
        { id: 22, key: 'wood_axe',   name: '木斧', color: '#c19a6b', isItem: true, tool: { type: 'axe', ...TOOL_TIERS.wood } },
        { id: 23, key: 'stone_axe',  name: '石斧', color: '#8a8a8a', isItem: true, tool: { type: 'axe', ...TOOL_TIERS.stone } },
        { id: 24, key: 'iron_axe',   name: '铁斧', color: '#e0e0e0', isItem: true, tool: { type: 'axe', ...TOOL_TIERS.iron } },
        { id: 25, key: 'wood_shovel',  name: '木锹', color: '#c19a6b', isItem: true, tool: { type: 'shovel', ...TOOL_TIERS.wood } },
        { id: 26, key: 'stone_shovel', name: '石锹', color: '#8a8a8a', isItem: true, tool: { type: 'shovel', ...TOOL_TIERS.stone } },
        { id: 27, key: 'iron_shovel',  name: '铁锹', color: '#e0e0e0', isItem: true, tool: { type: 'shovel', ...TOOL_TIERS.iron } },
        { id: 28, key: 'sand', name: '沙子', color: '#dbd3a0', hard: 0.5, best: 'shovel' },
        { id: 29, key: 'snow_grass', name: '积雪草方块', color: '#f4f8ff', hard: 0.6, best: 'shovel', drop: 6 },
        { id: 30, key: 'water', name: '水', color: '#3a6fd8', transparent: true, opacity: 0.6, fluid: true, hard: -1 },
        { id: 31, key: 'lava', name: '岩浆', color: '#ff6a00', emissive: true, fluid: true, hard: -1 },
        { id: 32, key: 'bedrock', name: '基岩', color: '#333333', hard: -1 },
        { id: 34, key: 'rotten_flesh', name: '腐肉', color: '#7a8a4a', isFood: true, food: 2 },
        { id: 35, key: 'gunpowder', name: '火药', color: '#555555', isItem: true },
        { id: 36, key: 'raw_pork', name: '生猪排', color: '#e8a0a0', isFood: true, food: 2 },
        { id: 37, key: 'cooked_pork', name: '熟猪排', color: '#a0522d', isFood: true, food: 8 },
        { id: 38, key: 'wood_sword', name: '木剑', color: '#c19a6b', isItem: true, tool: { type: 'sword', dmg: 4, ...TOOL_TIERS.wood } },
        { id: 39, key: 'stone_sword', name: '石剑', color: '#8a8a8a', isItem: true, tool: { type: 'sword', dmg: 5, ...TOOL_TIERS.stone } },
        { id: 40, key: 'iron_sword', name: '铁剑', color: '#e0e0e0', isItem: true, tool: { type: 'sword', dmg: 6, ...TOOL_TIERS.iron } }
,
        { id: 33, key: 'cactus', name: '仙人掌', color: '#2e7d32', hard: 0.4 },
        { id: 41, key: 'bone', name: '骨头', color: '#e8e8e0', isItem: true },
        { id: 42, key: 'arrow', name: '箭', color: '#c8b88a', isItem: true }
    ];
    const SEA = 5;
    const FLUID = { 30: true, 31: true };
    const defOf = id => ITEM_DEFS.find(d => d.id === id);
    const iconColor = d => d.color || d.side || d.top || '#888';
    const MAX_STACK = 64;
    const ICON_URL = {};
    const iconCss = d => ICON_URL[d.key]
        ? `background:url(${ICON_URL[d.key]}) center/100% 100% no-repeat;image-rendering:pixelated;border:none;border-radius:0;box-shadow:none`
        : `background:${iconColor(d)}`;

    // 合成配方（原版有形/无形网格合成）：P=木板 S=木棍 C=圆石 I=铁锭 G=火药 D=沙子 L=原木；M 随材质替换
    const GRID_KEY = { P: 2, S: 3, C: 14, I: 19, G: 35, D: 28, L: 1 };
    const GRID_RECIPES = [];
    const addGrid = (rows, outId, outNum) => GRID_RECIPES.push({ rows, h: rows.length, w: rows[0].length, outId, outNum });
    addGrid(['L'], 2, 4);
    addGrid(['P', 'P'], 3, 4);
    addGrid(['PP', 'PP'], 4, 1);
    addGrid(['CCC', 'C C', 'CCC'], 16, 1);
    addGrid(['GDG', 'DGD', 'GDG'], 9, 1);
    [['P', 1], ['C', 2], ['I', 3]].forEach(([m, tier]) => {
        const pat = {
            pickaxe: ['MMM', ' S ', ' S '], axe: ['MM', 'MS', ' S'], shovel: ['M', 'S', 'S'], sword: ['M', 'M', 'S']
        };
        Object.keys(pat).forEach(kind => {
            const out = ITEM_DEFS.find(d => d.tool && d.tool.type === kind && d.tool.tier === tier);
            if (out) addGrid(pat[kind].map(r => r.replace(/M/g, m)), out.id, 1);
        });
    });
    // 熔炉烧炼：输入物品 -> 产物
    const SMELT = { 21: 19, 36: 37, 14: 7 };
    const FUEL_BURN = 80, SMELT_TIME = 10;
    function matchGrid(ids, n) {
        let r0 = n, r1 = -1, c0 = n, c1 = -1;
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
            if (ids[r * n + c]) { r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c); }
        }
        if (r1 < 0) return null;
        const h = r1 - r0 + 1, w = c1 - c0 + 1;
        for (const rec of GRID_RECIPES) {
            if (rec.h !== h || rec.w !== w) continue;
            for (const mir of [false, true]) {
                let ok = true;
                for (let r = 0; r < h && ok; r++) for (let c = 0; c < w; c++) {
                    const ch = rec.rows[r][mir ? w - 1 - c : c];
                    if (ids[(r0 + r) * n + c0 + c] !== (ch === ' ' ? 0 : GRID_KEY[ch])) { ok = false; break; }
                }
                if (ok) return rec;
            }
        }
        return null;
    }

    const MC = {
        inited: false, running: false,
        scene: null, cam: null, rdr: null,
        sharedBoxGeom: null, // 全局共享单个几何体，杜绝内存开销
        blockMaterials: {},

        // 无限区块管理器
        chunks: new Map(), // key: "cx,cz" => { cx, cz, group, visibleMeshes: [] }
        voxels: new Map(), // key: "x,y,z" => { type, mesh } (全局体素数据)
        lastPlayerChunk: { cx: 99999, cz: 99999 },

        selectedBlockIdx: 0,
        hotbar: [
            { id: 1, count: 0 }, { id: 2, count: 0 }, { id: 3, count: 0 },
            { id: 4, count: 0 }, { id: 5, count: 0 }, { id: 6, count: 0 },
            { id: 7, count: 0 }, { id: 8, count: 0 }, { id: 9, count: 0 }
        ],
        mainInv: Array.from({ length: 27 }, () => ({ id: 0, count: 0 })),
        invOpen: false,
        heldItem: null, // 鼠标拾起的物品堆 { id, count, dur }
        _mx: 0, _my: 0,
        craftMode: 'inv', craftGrid: [], craftOut: null,
        furnaces: new Map(), furnaceKey: null, _furnSig: '',
        drops: [], _lastRem: 0,

        player: {
            x: 0, y: 14, z: 0,
            vx: 0, vy: 0, vz: 0,
            yaw: 0, pitch: 0,
            onGround: false,
            flying: false,
            mode: 'survival',
            health: 10,
            food: 10,
            isDead: false,
            fallStartY: 0
        },
        spawnPoint: { x: 0, y: 14, z: 0 },
        keys: {},
        touchMove: { x: 0, y: 0 },
        raycaster: null,
        targetBlock: null,
        highlightBox: null,
        particles: [],
        lastTime: 0,
        dayTime: 2000,
        sunLight: null,
        ambientLight: null,
        regenTimer: 0,
        starveTimer: 0,

        // ---------- 入口与生命周期 ----------
        enter() {
            const screen = el('levelcivScreen');
            if (screen) screen.style.display = 'block';
            if (!this.inited) {
                this.inited = true;
                this._initTextures();
                this._init3D();
                this._initEvents();
                this._updateInfiniteChunks(true);
            }
            this.running = true;
            this.lastTime = performance.now();
            this.player.isDead = false;
            this.invOpen = false;
            this.heldItem = null;
            this._clearDrops();
            this._loadInv();

            const deathOverlay = el('mcDeathOverlay');
            if (deathOverlay) deathOverlay.style.display = 'none';
            const invModal = el('mcInventoryModal');
            if (invModal) invModal.style.display = 'none';

            this._selectHotbar(this.selectedBlockIdx);
            this._updateHotbarCounts();
            this._updateHUD();
            this._loop();
        },
        exit() {
            this.running = false;
            const screen = el('levelcivScreen');
            if (screen) screen.style.display = 'none';
            if (document.exitPointerLock) {
                try { document.exitPointerLock(); } catch (e) {}
            }
            if (window.ui && window.game) {
                window.ui.showMainMenu(window.game.username);
            }
        },

        // ---------- 全局地形高度无缝连续数学函数 ----------
        getTerrainHeight(x, z) {
            return Math.max(2, Math.round(
                Math.sin(x * 0.08) * 3.5 +
                Math.cos(z * 0.08) * 3.5 +
                Math.sin((x + z) * 0.04) * 2.5 +
                Math.cos(x * 0.15 - z * 0.12) * 1.5 + 8
            ));
        },

        getBiome(x, z) {
            const v = Math.sin(x * 0.012 + 0.2) * Math.cos(z * 0.011) + 0.5 * Math.sin((x + z) * 0.006 + 1);
            if (v > 0.8) return 'desert';
            if (v < -0.7) return 'snow';
            return 'plains';
        },

        _treeSpot(cx, cz) {
            const tx = cx * CHUNK_SIZE + 4 + Math.floor(this.chunkHash(cx, cz, 11) * 8);
            const tz = cz * CHUNK_SIZE + 4 + Math.floor(this.chunkHash(cx, cz, 22) * 8);
            return this.getTerrainHeight(tx, tz) > SEA && this.getBiome(tx, tz) !== 'desert';
        },

        // 确定性哈希：给定区块坐标生成该区块的特征随机数
        chunkHash(cx, cz, seed = 1337) {
            let h = (cx * 374761393 + cz * 668265263 + seed) ^ (cx * cz);
            h = Math.imul(h ^ (h >>> 13), 1274126177);
            return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
        },

        // ---------- 16x16 像素材质程序化生成 ----------
        _createPixelCanvas(w, h, drawFn) {
            const cv = document.createElement('canvas');
            cv.width = w; cv.height = h;
            const ctx = cv.getContext('2d');
            drawFn(ctx, w, h);
            const tex = new THREE.CanvasTexture(cv);
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            return tex;
        },
        _initTextures() {
            this.sharedBoxGeom = new THREE.BoxGeometry(1, 1, 1);

            const makeNoise = (ctx, w, h, baseCol, spread) => {
                ctx.fillStyle = baseCol;
                ctx.fillRect(0, 0, w, h);
                const rgb = parseInt(baseCol.replace('#', ''), 16);
                const r = (rgb >> 16) & 255, g = (rgb >> 8) & 255, b = rgb & 255;
                for (let x = 0; x < w; x++) {
                    for (let y = 0; y < h; y++) {
                        const n = (Math.random() - 0.5) * spread;
                        ctx.fillStyle = `rgb(${Math.min(255, Math.max(0, r + n))}, ${Math.min(255, Math.max(0, g + n))}, ${Math.min(255, Math.max(0, b + n))})`;
                        ctx.fillRect(x, y, 1, 1);
                    }
                }
            };

            const R = seed => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
            const P = (c, x, y, col) => { c.fillStyle = col; c.fillRect(x, y, 1, 1); };
            const pick = (pal, r) => pal[Math.floor(r() * pal.length)];
            const fillPal = (c, pal, r) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) P(c, x, y, pick(pal, r)); };
            const blobs = (c, cols, spots, r) => spots.forEach(([bx, by]) => {
                [[0, 0], [1, 0], [0, 1], [1, 1], [2, 0], [0, 2], [2, 1]].forEach(([dx, dy]) => { if (r() < 0.85) P(c, bx + dx, by + dy, pick(cols, r)); });
            });
            const STONE = ['#7f7f7f', '#8b8b8b', '#747474', '#979797', '#7a7a7a'];
            const DIRT = ['#866043', '#785238', '#8f6a4b', '#6b4a30', '#9a7452'];
            const PLANK = ['#9c7f4e', '#a38655', '#947746'];
            const planks = (c, r) => {
                const BOARD = [['#a38655', '#9c7f4e', '#ab8e5d'], ['#947746', '#9c7f4e', '#8d7040'], ['#ab8e5d', '#a38655', '#b39665'], ['#9c7f4e', '#947746', '#a38655']];
                [0, 4, 8, 12].forEach((y0, i) => { for (let y = y0; y < y0 + 3; y++) for (let x = 0; x < 16; x++) P(c, x, y, pick(BOARD[i], r)); });
                c.fillStyle = '#6e5530';
                [3, 7, 11, 15].forEach((y, i) => { c.fillRect(0, y, 16, 1); c.fillRect(i % 2 ? 4 : 11, y - 3, 1, 3); });
                c.fillStyle = 'rgba(255,240,200,.18)';
                [0, 4, 8, 12].forEach(y => c.fillRect(0, y, 16, 1));
            };
            const T = {
                dirt: { all: (c, r) => fillPal(c, DIRT, r) },
                stone: { all: (c, r) => fillPal(c, STONE, r) },
                cobble: { all: (c, r) => {
                    fillPal(c, ['#7b7b7b', '#8a8a8a', '#6c6c6c', '#959595'], r);
                    c.fillStyle = '#444';
                    [0, 5, 10].forEach((y, i) => { c.fillRect(0, y, 16, 1); const o = i % 2 ? 4 : 9; c.fillRect(o, y, 1, 5); c.fillRect((o + 8) % 16, y, 1, 5); });
                    c.fillRect(0, 15, 16, 1);
                } },
                planks: { all: planks },
                wood: {
                    side: (c, r) => { fillPal(c, ['#52412a', '#463722', '#5c4a31', '#3e301d'], r); c.fillStyle = 'rgba(0,0,0,.2)'; [2, 5, 9, 12, 14].forEach(x => c.fillRect(x, 0, 1, 16)); },
                    top: (c, r) => { fillPal(c, ['#9a7b49', '#a38250', '#927342'], r); c.strokeStyle = '#7c5d33'; c.lineWidth = 1; c.strokeRect(2.5, 2.5, 11, 11); c.strokeRect(5.5, 5.5, 5, 5); c.strokeStyle = '#4a3a22'; c.strokeRect(0.5, 0.5, 15, 15); }
                },
                leaves: { all: (c, r) => { fillPal(c, ['#2e7d1c', '#3d9427', '#256a15', '#49a82f'], r); for (let i = 0; i < 22; i++) P(c, Math.floor(r() * 16), Math.floor(r() * 16), '#1a4d0e'); } },
                grass: {
                    top: (c, r) => fillPal(c, ['#5f9e38', '#6bae42', '#559130', '#76b94c'], r),
                    side: (c, r) => {
                        fillPal(c, DIRT, r);
                        for (let x = 0; x < 16; x++) {
                            const d = 2 + (r() < 0.5 ? 1 : 0) + (r() < 0.25 ? 1 : 0);
                            for (let y = 0; y < d; y++) P(c, x, y, pick(['#5f9e38', '#6bae42', '#559130'], r));
                        }
                    },
                    bottom: (c, r) => fillPal(c, DIRT, r)
                },
                coal_ore: { all: (c, r) => { fillPal(c, STONE, r); blobs(c, ['#1c1c1c', '#2e2e2e'], [[2, 2], [9, 1], [5, 8], [11, 9], [2, 12], [8, 13]], r); } },
                iron_ore: { all: (c, r) => { fillPal(c, STONE, r); blobs(c, ['#d9b499', '#c9a283', '#e3c3a8'], [[3, 2], [10, 3], [6, 8], [11, 10], [2, 11], [8, 13]], r); } },
                crafting: {
                    top: (c, r) => { planks(c, r); c.fillStyle = '#5a3f1e'; c.fillRect(0, 0, 16, 2); c.fillRect(0, 14, 16, 2); c.fillRect(0, 0, 2, 16); c.fillRect(14, 0, 2, 16); c.fillStyle = '#7a5a30'; c.fillRect(7, 2, 2, 12); c.fillRect(2, 7, 12, 2); },
                    side: (c, r) => { planks(c, r); c.fillStyle = '#6b4a26'; c.fillRect(0, 0, 16, 4); c.fillRect(0, 4, 2, 12); c.fillRect(14, 4, 2, 12); c.fillStyle = '#c8c8c8'; c.fillRect(4, 6, 5, 2); c.fillStyle = '#5a3f1e'; c.fillRect(3, 6, 1, 4); c.fillStyle = '#8a8a8a'; c.fillRect(10, 6, 3, 2); c.fillStyle = '#5a3f1e'; c.fillRect(11, 8, 1, 4); }
                },
                furnace: {
                    top: (c, r) => { fillPal(c, STONE, r); c.fillStyle = '#2a2a2a'; c.fillRect(3, 3, 10, 10); },
                    side: (c, r) => { fillPal(c, ['#6f6f6f', '#7d7d7d', '#666', '#858585'], r); c.fillStyle = '#1f1f1f'; c.fillRect(3, 4, 10, 6); c.fillStyle = '#2a2a2a'; c.fillRect(3, 11, 10, 2); c.fillStyle = '#ff9a1f'; c.fillRect(6, 8, 4, 2); c.fillStyle = '#ffd54f'; c.fillRect(7, 9, 2, 1); }
                },
                cactus: {
                    top: (c, r) => { fillPal(c, ['#3a8f3a', '#2f7d32', '#43a047'], r); c.fillStyle = '#1b5e20'; c.fillRect(0, 0, 16, 1); c.fillRect(0, 15, 16, 1); c.fillRect(0, 0, 1, 16); c.fillRect(15, 0, 1, 16); },
                    side: (c, r) => { fillPal(c, ['#2e7d32', '#388e3c', '#2a7030'], r); c.fillStyle = '#1b5e20'; c.fillRect(0, 0, 1, 16); c.fillRect(15, 0, 1, 16); for (let i = 0; i < 9; i++) P(c, 2 + Math.floor(r() * 12), Math.floor(r() * 16), '#e8f5c8'); }
                },
                sand: { all: (c, r) => fillPal(c, ['#dbd3a0', '#d6cc96', '#e0d8a8', '#cfc58d'], r) },
                snow_grass: {
                    top: (c, r) => fillPal(c, ['#f4f8ff', '#e6eef8', '#fafcff'], r),
                    side: (c, r) => {
                        fillPal(c, DIRT, r);
                        for (let x = 0; x < 16; x++) {
                            const d = 3 + (r() < 0.5 ? 1 : 0);
                            for (let y = 0; y < d; y++) P(c, x, y, pick(['#f4f8ff', '#e6eef8'], r));
                        }
                    },
                    bottom: (c, r) => fillPal(c, DIRT, r)
                },
                water: { all: (c, r) => fillPal(c, ['#3b6fd6', '#3466c9', '#4378de'], r) },
                lava: { all: (c, r) => fillPal(c, ['#ff7a00', '#ff9a1f', '#e65100', '#ffb74d'], r) },
                bedrock: { all: (c, r) => fillPal(c, ['#3a3a3a', '#4a4a4a', '#2a2a2a', '#555555'], r) },
                tnt: {
                    top: (c, r) => { fillPal(c, ['#c9ad74', '#bfa268', '#d2b57d'], r); c.fillStyle = '#5e4b2a'; c.fillRect(7, 7, 2, 2); },
                    side: (c, r) => { fillPal(c, ['#d6392a', '#c4301f', '#cf3626'], r); c.fillStyle = '#dcdcdc'; c.fillRect(0, 5, 16, 6); c.fillStyle = '#111'; c.font = 'bold 6px sans-serif'; c.fillText('TNT', 1.5, 10.5); }
                }
            };
            const tierCol = { 1: '#a07a45', 2: '#8a8a8a', 3: '#e0e0e0' };
            const paintItem = (c, def) => {
                const line = (pts, col) => pts.forEach(p => P(c, p[0], p[1], col));
                const diag = (x0, y0, n, col) => { for (let i = 0; i < n; i++) P(c, x0 + i, y0 - i, col); };
                if (def.tool) {
                    const PAL = { 1: ['#a07a45', '#c9a368', '#6e5128'], 2: ['#8a8a8a', '#b8b8b8', '#5c5c5c'], 3: ['#d8d8d8', '#ffffff', '#9a9a9a'] }[def.tool.tier];
                    const col = PAL[0], hi = PAL[1], lo = PAL[2], ol = '#2a2016';
                    if (def.tool.type === 'sword') {
                        diag(6, 9, 8, ol); diag(7, 9, 8, ol); diag(5, 9, 8, ol);
                        diag(6, 9, 8, hi); diag(7, 9, 7, col); diag(7, 10, 7, lo);
                        line([[4, 9], [5, 10], [6, 11], [3, 8], [7, 12]], '#6b4a26');
                        line([[4, 11], [3, 12], [2, 13]], '#8a6a3b'); P(c, 1, 14, '#3e2a14');
                    } else {
                        diag(2, 14, 9, ol); diag(3, 14, 9, ol);
                        diag(2, 14, 9, '#6b4a26'); diag(3, 14, 9, '#8a6a3b');
                        if (def.tool.type === 'pickaxe') {
                            line([[4, 5], [5, 4], [6, 3], [7, 2], [8, 2], [9, 2], [10, 3], [11, 4], [12, 5], [13, 6], [13, 7], [12, 8]], ol);
                            line([[5, 5], [6, 4], [7, 3], [8, 3], [9, 3], [10, 4], [11, 5], [12, 6]], col);
                            line([[6, 3], [7, 2], [8, 2], [9, 2]], hi); line([[12, 6], [13, 7], [12, 8]], lo);
                        } else if (def.tool.type === 'axe') {
                            c.fillStyle = ol; c.fillRect(7, 2, 6, 7); c.fillRect(12, 3, 2, 5);
                            c.fillStyle = col; c.fillRect(8, 3, 4, 5); c.fillRect(12, 4, 1, 3);
                            c.fillStyle = hi; c.fillRect(8, 3, 4, 1); c.fillRect(8, 3, 1, 5);
                            c.fillStyle = lo; c.fillRect(9, 7, 3, 1);
                        } else if (def.tool.type === 'shovel') {
                            c.fillStyle = ol; c.fillRect(9, 1, 5, 6); P(c, 11, 0, ol); P(c, 11, 7, ol);
                            c.fillStyle = col; c.fillRect(10, 2, 3, 4); P(c, 11, 1, col); P(c, 11, 6, col);
                            c.fillStyle = hi; c.fillRect(10, 2, 1, 3); P(c, 11, 1, hi);
                            c.fillStyle = lo; c.fillRect(12, 3, 1, 3); P(c, 11, 6, lo);
                        }
                    }
                } else if (def.key === 'stick') {
                    diag(3, 13, 10, '#6b4a26'); diag(4, 13, 9, '#8a6a3b');
                } else if (def.key === 'iron_ingot') {
                    c.fillStyle = '#e8e8e8'; c.fillRect(3, 7, 10, 4); c.fillStyle = '#bdbdbd'; c.fillRect(3, 10, 10, 1); c.fillStyle = '#fff'; c.fillRect(4, 7, 8, 1);
                } else if (['coal', 'raw_iron', 'rotten_flesh', 'raw_pork', 'cooked_pork', 'gunpowder'].includes(def.key)) {
                    const base = {
                        coal: ['#1c1c1c', '#2e2e2e', '#3a3a3a'], raw_iron: ['#c9a283', '#d9b499', '#a8795a'],
                        rotten_flesh: ['#6f7f3f', '#8a9a52', '#566b2e'], raw_pork: ['#e8a0a0', '#f2b8b8', '#d68888'],
                        cooked_pork: ['#a0522d', '#8b4513', '#b8683a'], gunpowder: ['#555555', '#666666', '#444444']
                    }[def.key];
                    const r = R(def.id * 97);
                    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) if (Math.hypot(x - 7.5, y - 8) < 5.2 + r() * 0.8) P(c, x, y, pick(base, r));
                } else if (def.key === 'bone') {
                    diag(3, 13, 10, '#e8e8e0'); diag(4, 13, 9, '#cfcfc4'); line([[2, 12], [3, 11], [2, 14], [4, 14], [11, 3], [12, 2], [11, 1], [13, 3]], '#e8e8e0');
                } else if (def.key === 'arrow') {
                    diag(2, 14, 11, '#8a6a3b'); line([[12, 3], [13, 2], [13, 3], [12, 2], [14, 1]], '#bdbdbd'); line([[2, 13], [3, 14], [1, 13], [2, 15]], '#eeeeee');
                } else if (def.key === 'apple') {
                    for (let x = 0; x < 16; x++) for (let y = 0; y < 16; y++) if (Math.hypot(x - 7.5, y - 9) < 5.5) P(c, x, y, (x + y) % 5 === 0 ? '#ef5350' : '#d32f2f');
                    P(c, 11, 6, '#ffcdd2'); P(c, 7, 3, '#5d4037'); P(c, 8, 4, '#5d4037'); line([[9, 2], [10, 2], [10, 3]], '#4caf50');
                } else {
                    c.fillStyle = def.color || '#888'; c.fillRect(3, 3, 10, 10);
                }
            };

            ITEM_DEFS.forEach((def) => {
                const vt = T[def.key];
                if (vt) {
                    const mk = (fn, tag) => this._createPixelCanvas(16, 16, (c) => fn(c, R(def.id * 7919 + tag.charCodeAt(0))));
                    const topT = mk(vt.top || vt.all, 'top');
                    const sideT = mk(vt.side || vt.all, 'side');
                    const botT = vt.bottom ? mk(vt.bottom, 'bottom') : topT;
                    const o = { transparent: !!def.transparent, opacity: def.opacity || 1, depthWrite: !(def.fluid && def.transparent) };
                    const MatC = def.emissive ? THREE.MeshBasicMaterial : THREE.MeshLambertMaterial;
                    const topM = new MatC({ map: topT, ...o });
                    const sideM = new MatC({ map: sideT, ...o });
                    const botM = new MatC({ map: botT, ...o });
                    this.blockMaterials[def.id] = (vt.all && !vt.top) ? sideM : [sideM, sideM, topM, botM, sideM, sideM];
                    ICON_URL[def.key] = sideT.image.toDataURL();
                    return;
                }
                if (def.isItem || def.isFood) {
                    const cv = document.createElement('canvas');
                    cv.width = cv.height = 16;
                    paintItem(cv.getContext('2d'), def);
                    ICON_URL[def.key] = cv.toDataURL();
                    this.blockMaterials[def.id] = new THREE.MeshLambertMaterial({ color: def.color || '#888' });
                    return;
                }
                if (def.isWood) {
                    const sideTex = this._createPixelCanvas(16, 16, (ctx) => {
                        makeNoise(ctx, 16, 16, '#6d4c41', 28);
                        ctx.fillStyle = '#4e342e';
                        for (let y = 0; y < 16; y++) {
                            ctx.fillRect(2, y, 1, 1); ctx.fillRect(8, y, 1, 1); ctx.fillRect(13, y, 1, 1);
                        }
                    });
                    const topTex = this._createPixelCanvas(16, 16, (ctx) => {
                        makeNoise(ctx, 16, 16, '#bcaaa4', 20);
                        ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = 1;
                        ctx.strokeRect(3, 3, 10, 10);
                        ctx.strokeRect(6, 6, 4, 4);
                    });
                    const topMat = new THREE.MeshLambertMaterial({ map: topTex });
                    const sideMat = new THREE.MeshLambertMaterial({ map: sideTex });
                    this.blockMaterials[def.id] = [sideMat, sideMat, topMat, topMat, sideMat, sideMat];
                } else if (def.isCrafting) {
                    const topTex = this._createPixelCanvas(16, 16, (ctx) => {
                        makeNoise(ctx, 16, 16, '#c19a6b', 20);
                        ctx.fillStyle = '#5d4037';
                        ctx.strokeRect(2, 2, 12, 12);
                    });
                    const sideTex = this._createPixelCanvas(16, 16, (ctx) => {
                        makeNoise(ctx, 16, 16, '#8b6508', 25);
                        ctx.fillStyle = '#d7ccc8';
                        ctx.fillRect(4, 4, 8, 4);
                    });
                    const topMat = new THREE.MeshLambertMaterial({ map: topTex });
                    const sideMat = new THREE.MeshLambertMaterial({ map: sideTex });
                    this.blockMaterials[def.id] = [sideMat, sideMat, topMat, topMat, sideMat, sideMat];
                } else if (def.sideGrass) {
                    const topTex = this._createPixelCanvas(16, 16, (ctx) => makeNoise(ctx, 16, 16, '#5b8731', 30));
                    const botTex = this._createPixelCanvas(16, 16, (ctx) => makeNoise(ctx, 16, 16, '#866043', 25));
                    const sideTex = this._createPixelCanvas(16, 16, (ctx) => {
                        makeNoise(ctx, 16, 16, '#866043', 25);
                        ctx.fillStyle = '#5b8731';
                        for (let x = 0; x < 16; x++) {
                            const h = 3 + Math.floor(Math.random() * 3);
                            ctx.fillRect(x, 0, 1, h);
                        }
                    });
                    const topMat = new THREE.MeshLambertMaterial({ map: topTex });
                    const sideMat = new THREE.MeshLambertMaterial({ map: sideTex });
                    const botMat = new THREE.MeshLambertMaterial({ map: botTex });
                    this.blockMaterials[def.id] = [sideMat, sideMat, topMat, botMat, sideMat, sideMat];
                } else if (def.isTNT) {
                    const topTex = this._createPixelCanvas(16, 16, (ctx) => makeNoise(ctx, 16, 16, '#c62828', 20));
                    const sideTex = this._createPixelCanvas(16, 16, (ctx) => {
                        makeNoise(ctx, 16, 16, '#e53935', 20);
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 5, 16, 6);
                        ctx.fillStyle = '#000000';
                        ctx.font = 'bold 5px sans-serif';
                        ctx.fillText('TNT', 2, 10);
                    });
                    const topMat = new THREE.MeshLambertMaterial({ map: topTex });
                    const sideMat = new THREE.MeshLambertMaterial({ map: sideTex });
                    this.blockMaterials[def.id] = [sideMat, sideMat, topMat, topMat, sideMat, sideMat];
                } else if (def.isFurnace) {
                    const topTex = this._createPixelCanvas(16, 16, (ctx) => {
                        makeNoise(ctx, 16, 16, '#7a7a7a', 25);
                        ctx.fillStyle = '#2b2b2b';
                        ctx.fillRect(4, 4, 8, 8);
                    });
                    const sideTex = this._createPixelCanvas(16, 16, (ctx) => {
                        makeNoise(ctx, 16, 16, '#7a7a7a', 30);
                        ctx.fillStyle = '#212121';
                        ctx.fillRect(4, 6, 8, 6);
                        ctx.fillStyle = '#ff9800';
                        ctx.fillRect(5, 10, 6, 2);
                    });
                    const topMat = new THREE.MeshLambertMaterial({ map: topTex });
                    const sideMat = new THREE.MeshLambertMaterial({ map: sideTex });
                    this.blockMaterials[def.id] = [sideMat, sideMat, topMat, topMat, sideMat, sideMat];
                } else {
                    const tex = this._createPixelCanvas(16, 16, (ctx) => {
                        makeNoise(ctx, 16, 16, def.color || '#888888', def.noise || 25);
                        if (def.speck) {
                            ctx.fillStyle = def.speck;
                            const spots = [[2, 3], [9, 2], [5, 8], [12, 7], [3, 12], [10, 12], [7, 5]];
                            spots.forEach(p => ctx.fillRect(p[0], p[1], 2, 2));
                        }
                    });
                    const mat = new THREE.MeshLambertMaterial({
                        map: tex,
                        transparent: !!def.transparent,
                        opacity: def.opacity || 1
                    });
                    this.blockMaterials[def.id] = mat;
                }
            });
        },

        // ---------- 3D 渲染与场景初始化 ----------
        _init3D() {
            const cv = el('lcCanvas');
            this.rdr = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' });
            this.rdr.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
            this.rdr.setSize(window.innerWidth, window.innerHeight);

            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x78a7ff);
            this.scene.fog = new THREE.FogExp2(0x78a7ff, 0.015);

            this.cam = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 300);

            this.ambientLight = new THREE.AmbientLight(0x90a4ae, 0.7);
            this.scene.add(this.ambientLight);

            this.sunLight = new THREE.DirectionalLight(0xfff9e6, 1.3);
            this.sunLight.position.set(50, 100, 60);
            this.scene.add(this.sunLight);

            this.raycaster = new THREE.Raycaster();
            this.raycaster.far = 6.5;

            const geom = new THREE.BoxGeometry(1.004, 1.004, 1.004);
            const edges = new THREE.EdgesGeometry(geom);
            this.highlightBox = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }));
            this.highlightBox.visible = false;
            this.scene.add(this.highlightBox);

            this._crackTex = [];
            for (let s = 0; s < 10; s++) {
                const cv = document.createElement('canvas'); cv.width = cv.height = 16;
                const g = cv.getContext('2d');
                let seed = 7;
                const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
                g.fillStyle = 'rgba(0,0,0,0.85)';
                for (let i = 0; i < (s + 1) * 14; i++) {
                    const x = Math.floor(rnd() * 16), y = Math.floor(rnd() * 16);
                    if (rnd() < 0.5 + s * 0.05) g.fillRect(x, y, 1, 1);
                }
                const t = new THREE.CanvasTexture(cv);
                t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter;
                this._crackTex.push(t);
            }
            this.crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.006, 1.006, 1.006),
                new THREE.MeshBasicMaterial({ map: this._crackTex[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
            this.crackMesh.visible = false;
            this.scene.add(this.crackMesh);

            this._initClouds();
            this._initSky();
        },

        _initClouds() {
            const cloudGeom = new THREE.BoxGeometry(12, 1.6, 12);
            this.cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
            for (let i = 0; i < 12; i++) { // 原版风格：由若干扁平方块拼成的云团，统一高度
                const bx = (Math.random() - 0.5) * 160, bz = (Math.random() - 0.5) * 160;
                const n = 2 + Math.floor(Math.random() * 3);
                for (let k = 0; k < n; k++) {
                    const cloud = new THREE.Mesh(cloudGeom, this.cloudMat);
                    cloud.position.set(bx + k * 12, 28, bz + (k % 2) * 12 * (Math.random() < 0.5 ? 1 : -1));
                    this.scene.add(cloud);
                }
            }
        },

        _initSky() { // 夜空：星星群 + 像素月，随昼夜淡入淡出、跟随玩家
            const starGeo = new THREE.BufferGeometry();
            const pts = [];
            for (let i = 0; i < 220; i++) {
                const a = Math.random() * Math.PI * 2, e = 0.12 + Math.random() * 0.95, r = 180;
                pts.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
            }
            starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
            this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
            this.stars = new THREE.Points(starGeo, this.starMat);
            this.scene.add(this.stars);
            const mv = document.createElement('canvas'); mv.width = mv.height = 64; // 像素月：方块月面+陨石斑
            const mc = mv.getContext('2d');
            mc.fillStyle = '#e8ecf5'; mc.fillRect(0, 0, 64, 64);
            mc.fillStyle = '#c9cede'; mc.fillRect(0, 0, 64, 12); mc.fillRect(0, 0, 12, 64); // 左上暗影带
            mc.fillStyle = '#b8becf';
            for (const p of [[36, 20, 10], [20, 40, 9], [42, 42, 12], [28, 10, 7]]) mc.fillRect(p[0], p[1], p[2], p[2]);
            this.moonMat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(mv), transparent: true, opacity: 0, fog: false, depthWrite: false });
            this.moon = new THREE.Sprite(this.moonMat);
            this.moon.scale.set(26, 26, 1);
            this.scene.add(this.moon);
        },

        // ---------- 无限区块管理器：按需动态加载与远端卸载回收 (防卡顿核心) ----------
        _updateInfiniteChunks(force = false) {
            const curCx = Math.floor(this.player.x / CHUNK_SIZE);
            const curCz = Math.floor(this.player.z / CHUNK_SIZE);

            if (!force && curCx === this.lastPlayerChunk.cx && curCz === this.lastPlayerChunk.cz) {
                return;
            }
            this.lastPlayerChunk = { cx: curCx, cz: curCz };

            const activeChunkKeys = new Set();

            // 1. 加载视距范围内的区块 (以玩家为中心的 (2*R+1)^2 个无缝区块)
            for (let dx = -VIEW_DIST; dx <= VIEW_DIST; dx++) {
                for (let dz = -VIEW_DIST; dz <= VIEW_DIST; dz++) {
                    const cx = curCx + dx;
                    const cz = curCz + dz;
                    const key = `${cx},${cz}`;
                    activeChunkKeys.add(key);

                    if (!this.chunks.has(key)) {
                        this._generateChunk(cx, cz);
                    }
                }
            }

            // 2. 卸载远离视距的区块 (释放内存与GPU对象，防止随走动无限变卡)
            for (const [key, chunk] of this.chunks.entries()) {
                if (!activeChunkKeys.has(key)) {
                    this.scene.remove(chunk.group);
                    this.chunks.delete(key);
                }
            }
        },

        _oreHash(x, y, z) {
            const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
            return n - Math.floor(n);
        },

        // 生成单个区块 (16x16) 并采用表面方块剔除 (防卡顿关键：完全被遮蔽的地下深层不建Mesh)
        _generateChunk(cx, cz) {
            const group = new THREE.Group();
            const chunk = { cx, cz, group, visibleMeshes: [] };
            const startX = cx * CHUNK_SIZE;
            const startZ = cz * CHUNK_SIZE;

            // 1. 生成地形并仅对暴露表面创建渲染 Mesh
            for (let lx = 0; lx < CHUNK_SIZE; lx++) {
                for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                    const wx = startX + lx;
                    const wz = startZ + lz;
                    const h = this.getTerrainHeight(wx, wz);
                    const biome = this.getBiome(wx, wz);
                    const sandy = biome === 'desert' || h <= SEA;

                    for (let y = 0; y <= Math.max(h, SEA); y++) {
                        let type = 7; // 石头
                        if (y === 0) type = 32;
                        else if (y > h) type = 30;
                        else if (y === h) type = sandy ? 28 : (biome === 'snow' ? 29 : 10);
                        else if (y >= h - 2) type = sandy ? 28 : 6;
                        else {
                            const r = this._oreHash(wx, y, wz);
                            if (r < 0.012 && y <= h - 5) type = 15; // 铁矿
                            else if (r > 0.97) type = 12; // 煤矿
                            else if (y <= 5 && y < h - 2 && this._oreHash(wx + 101, y, wz - 57) > 0.975) type = 31; // 岩浆
                        }

                        const vKey = `${wx},${y},${wz}`;
                        if (!this.voxels.has(vKey)) {
                            this.voxels.set(vKey, { type, mesh: null, chunkKey: `${cx},${cz}` });
                        }

                        // 【防卡顿表面剔除】：只给顶层与次顶层表面创建渲染网格，深层全遮挡方块不占GPU！
                        if ((y >= h - 1 && y <= h) || (y === SEA && y > h)) {
                            this._addVoxelMesh(wx, y, wz, type, group, chunk);
                        }
                    }
                }
            }

            // 2. 确定性哈希生成本区块的自然橡树 (约 40% 概率生成一棵树)
            if (this.chunkHash(cx, cz) < 0.45 && this._treeSpot(cx, cz)) {
                const tx = startX + 4 + Math.floor(this.chunkHash(cx, cz, 11) * 8);
                const tz = startZ + 4 + Math.floor(this.chunkHash(cx, cz, 22) * 8);
                const ty = this.getTerrainHeight(tx, tz) + 1;

                // 树干 (4格原木)
                for (let y = 0; y < 4; y++) {
                    const vKey = `${tx},${ty + y},${tz}`;
                    this.voxels.set(vKey, { type: 1, mesh: null, chunkKey: `${cx},${cz}` });
                    this._addVoxelMesh(tx, ty + y, tz, 1, group, chunk);
                }
                // 树冠 (叶片)
                for (let lx = -2; lx <= 2; lx++) {
                    for (let lz = -2; lz <= 2; lz++) {
                        for (let ly = 2; ly <= 4; ly++) {
                            if (Math.abs(lx) === 2 && Math.abs(lz) === 2 && ly === 4) continue;
                            if (lx === 0 && lz === 0 && ly < 4) continue;
                            const wx = tx + lx, wy = ty + ly, wz = tz + lz;
                            const vKey = `${wx},${wy},${wz}`;
                            const ex = this.voxels.get(vKey);
                            if (!ex || ex.type === 11) {
                                this.voxels.set(vKey, { type: 11, mesh: null, chunkKey: `${cx},${cz}` });
                                this._addVoxelMesh(wx, wy, wz, 11, group, chunk);
                            }
                        }
                    }
                }
                const topKey = `${tx},${ty + 5},${tz}`;
                this.voxels.set(topKey, { type: 11, mesh: null, chunkKey: `${cx},${cz}` });
                this._addVoxelMesh(tx, ty + 5, tz, 11, group, chunk);
            }

            if (this.chunkHash(cx, cz, 77) < 0.7) {
                const kx = startX + 3 + Math.floor(this.chunkHash(cx, cz, 31) * 10);
                const kz = startZ + 3 + Math.floor(this.chunkHash(cx, cz, 32) * 10);
                const kh = this.getTerrainHeight(kx, kz);
                if (this.getBiome(kx, kz) === 'desert' && kh > SEA) {
                    const cn = 1 + Math.floor(this.chunkHash(cx, cz, 33) * 3);
                    for (let i = 1; i <= cn; i++) {
                        this.voxels.set(`${kx},${kh + i},${kz}`, { type: 33, mesh: null, chunkKey: `${cx},${cz}` });
                        this._addVoxelMesh(kx, kh + i, kz, 33, group, chunk);
                    }
                }
            }

            this.scene.add(group);
            this.chunks.set(`${cx},${cz}`, chunk);

            // 若是出生点区块，初始化出生点高度
            if (cx === 0 && cz === 0) {
                const groundY = this.getTerrainHeight(0, 0) + 1.2;
                this.spawnPoint.y = groundY;
                this.player.y = groundY;
                this.player.fallStartY = groundY;
            }
        },

        _addVoxelMesh(x, y, z, type, group, chunk) {
            const mat = this.blockMaterials[type] || this.blockMaterials[1] || this.blockMaterials[10];
            const mesh = new THREE.Mesh(this.sharedBoxGeom, mat);
            mesh.position.set(x, y, z);
            mesh.userData = { vx: x, vy: y, vz: z, type, chunkKey: `${chunk.cx},${chunk.cz}` };
            group.add(mesh);
            if (!FLUID[type]) chunk.visibleMeshes.push(mesh);

            const item = this.voxels.get(`${x},${y},${z}`);
            if (item) item.mesh = mesh;
            return mesh;
        },

        // 放置单个方块
        _setBlock(x, y, z, type) {
            const key = `${x},${y},${z}`;
            const cx = Math.floor(x / CHUNK_SIZE);
            const cz = Math.floor(z / CHUNK_SIZE);
            const cKey = `${cx},${cz}`;
            const chunk = this.chunks.get(cKey);

            if (this.voxels.has(key)) {
                const old = this.voxels.get(key);
                if (old.mesh && chunk) {
                    chunk.group.remove(old.mesh);
                    const idx = chunk.visibleMeshes.indexOf(old.mesh);
                    if (idx !== -1) chunk.visibleMeshes.splice(idx, 1);
                }
                this.voxels.delete(key);
            }
            if (type === 0) return;

            if (chunk) {
                this.voxels.set(key, { type, mesh: null, chunkKey: cKey });
                this._addVoxelMesh(x, y, z, type, chunk.group, chunk);
            }
        },

        // ---------- 背包库存管理方法 ----------
        addItem(id, count) {
            const def = defOf(id);
            const slots = this.hotbar.concat(this.mainInv);
            let rem = count;
            if (def && def.tool) {
                while (rem > 0) {
                    const s = slots.find(x => x.count === 0);
                    if (!s) break;
                    s.id = id; s.count = 1; s.dur = def.tool.dur;
                    rem--;
                }
            } else {
                for (const s of slots) {
                    if (rem <= 0) break;
                    if (s.id === id && s.count > 0 && s.count < MAX_STACK) {
                        const put = Math.min(MAX_STACK - s.count, rem);
                        s.count += put; rem -= put;
                    }
                }
                for (const s of slots) {
                    if (rem <= 0) break;
                    if (s.count === 0) {
                        const put = Math.min(MAX_STACK, rem);
                        s.id = id; s.count = put; s.dur = 0; rem -= put;
                    }
                }
            }
            this._lastRem = rem;
            this._updateHotbarCounts();
            this._renderInventory();
            if (rem > 0) this._toast('背包已满！');
            return rem === 0;
        },

        _canFit(id) {
            const def = defOf(id);
            const slots = this.hotbar.concat(this.mainInv);
            if (def && def.tool) return slots.some(s => s.count === 0);
            return slots.some(s => s.count === 0 || (s.id === id && s.count < MAX_STACK));
        },

        // ---------- 掉落物实体 ----------
        _dropItem(id, count, x, y, z, vx, vy, vz, delay) {
            const d = defOf(id);
            if (!d || count <= 0 || !this.scene) return;
            if (!this._dropGeom) {
                this._dropGeom = new THREE.BoxGeometry(0.3, 0.3, 0.3);
                this._dropFlat = new THREE.BoxGeometry(0.36, 0.36, 0.08);
                this._dropMats = {};
            }
            const isBlock = !d.isItem && !d.isFood;
            let mat = isBlock ? this.blockMaterials[id] : this._dropMats[id];
            if (!mat) {
                mat = new THREE.MeshBasicMaterial({ color: iconColor(d) });
                this._dropMats[id] = mat;
            }
            const mesh = new THREE.Mesh(isBlock ? this._dropGeom : this._dropFlat, mat);
            mesh.position.set(x, y, z);
            this.scene.add(mesh);
            this.drops.push({
                mesh, id, count, dur: 0, x, y, z, age: 0, delay: delay === undefined ? 0.5 : delay, ground: false,
                vx: vx === undefined ? (Math.random() - 0.5) * 2 : vx,
                vy: vy === undefined ? 3 : vy,
                vz: vz === undefined ? (Math.random() - 0.5) * 2 : vz
            });
        },

        _updateDrops(dt) {
            const p = this.player;
            for (let i = this.drops.length - 1; i >= 0; i--) {
                const d = this.drops[i];
                d.age += dt;
                let remove = d.age > 300 || d.y < -40;
                if (!remove) {
                    const dx = p.x - d.x, dy = (p.y + 0.8) - d.y, dz = p.z - d.z;
                    const dist = Math.hypot(dx, dy, dz);
                    const canPick = !p.isDead && d.age >= d.delay && this._canFit(d.id);
                    if (canPick && dist < 2.4) {
                        const sp = 6 * dt / Math.max(dist, 0.01);
                        d.x += dx * sp; d.y += dy * sp; d.z += dz * sp;
                        d.vx = d.vy = d.vz = 0;
                        if (dist < 0.8) {
                            const dd = defOf(d.id);
                            const before = d.count;
                            this.addItem(d.id, d.count);
                            d.count = this._lastRem;
                            this._toast('+' + (before - d.count) + ' ' + dd.name);
                            if (d.count <= 0) remove = true;
                        }
                    } else {
                        d.vy -= 18 * dt;
                        let nx = d.x + d.vx * dt, ny = d.y + d.vy * dt, nz = d.z + d.vz * dt;
                        if (this._solid(Math.round(nx), Math.round(d.y), Math.round(d.z))) { nx = d.x; d.vx = 0; }
                        if (this._solid(Math.round(d.x), Math.round(d.y), Math.round(nz))) { nz = d.z; d.vz = 0; }
                        d.ground = false;
                        if (d.vy <= 0 && this._solid(Math.round(nx), Math.round(ny - 0.16), Math.round(nz))) {
                            ny = Math.round(ny - 0.16) + 0.5 + 0.16; d.vy = 0; d.ground = true;
                            d.vx *= 0.7; d.vz *= 0.7;
                        } else if (d.vy > 0 && this._solid(Math.round(nx), Math.round(ny + 0.16), Math.round(nz))) {
                            d.vy = 0; ny = d.y;
                        }
                        d.x = nx; d.y = ny; d.z = nz;
                    }
                }
                if (remove) { this.scene.remove(d.mesh); this.drops.splice(i, 1); continue; }
                d.mesh.position.set(d.x, d.y + (d.ground ? 0.06 + Math.sin(d.age * 3) * 0.05 : 0), d.z);
                d.mesh.rotation.y += dt * 1.6;
            }
        },

        _clearDrops() {
            for (const d of this.drops) this.scene.remove(d.mesh);
            this.drops = [];
        },

        _updateFurnaces(dt) {
            this.furnaces.forEach(f => {
                const outId = f.inp.count > 0 ? SMELT[f.inp.id] : 0;
                const canSmelt = !!outId && (f.out.count === 0 || (f.out.id === outId && f.out.count < MAX_STACK));
                if (f.burn > 0) f.burn = Math.max(0, f.burn - dt);
                if (canSmelt && f.burn <= 0 && f.fuel.count > 0) {
                    f.fuel.count--; if (f.fuel.count <= 0) f.fuel.id = 0;
                    f.burn = f.burnMax = FUEL_BURN;
                }
                if (canSmelt && f.burn > 0) {
                    f.cook += dt;
                    if (f.cook >= SMELT_TIME) {
                        f.cook = 0;
                        f.inp.count--; if (f.inp.count <= 0) f.inp.id = 0;
                        f.out.id = outId; f.out.count++;
                    }
                } else if (f.cook > 0) f.cook = Math.max(0, f.cook - dt * 2);
            });
            if (this.invOpen && this.craftMode === 'furnace') {
                const f = this.furnaces.get(this.furnaceKey);
                if (!f) return;
                const sig = [f.inp.id, f.inp.count, f.fuel.count, f.out.id, f.out.count].join(',');
                if (sig !== this._furnSig) { this._renderCrafting(); }
                const fl = el('mcFurnFlame'), ar = el('mcFurnArrow');
                if (fl) fl.style.width = (f.burnMax ? f.burn / f.burnMax * 100 : 0) + '%';
                if (ar) ar.style.width = (f.cook / SMELT_TIME * 100) + '%';
            }
        },

        _heldDef() {
            const s = this.hotbar[this.selectedBlockIdx];
            return s && s.count > 0 ? defOf(s.id) : null;
        },

        _breakTime(def) {
            if (this.player.mode === 'creative') return 0;
            if (def.hard < 0) return Infinity;
            const held = this._heldDef();
            const t = held && held.tool;
            const match = !!(t && t.type === def.best);
            const canHarvest = !def.harvest || (match && t.tier >= def.harvest);
            const speed = match ? t.speed : 1;
            return (def.hard || 0) * (canHarvest ? 1.5 : 5) / speed;
        },

        _nearStation(id) {
            const px = Math.floor(this.player.x + 0.5), py = Math.floor(this.player.y), pz = Math.floor(this.player.z + 0.5);
            for (let dx = -4; dx <= 4; dx++) for (let dy = -3; dy <= 3; dy++) for (let dz = -4; dz <= 4; dz++) {
                const v = this.voxels.get(`${px + dx},${py + dy},${pz + dz}`);
                if (v && v.type === id) return true;
            }
            return false;
        },

        fuel: 0,
        mining: false, _mineKey: null, _mineProg: 0,

        _mineTick(dt) {
            const bar = this._mineBar();
            const tb = this.targetBlock;
            if (!this.mining || !this.running || this.player.isDead || this.invOpen || !tb) {
                this._mineKey = null; this._mineProg = 0; bar.style.display = 'none';
                if (this.crackMesh) this.crackMesh.visible = false;
                this._swingArm(false);
                return;
            }
            const key = `${tb.x},${tb.y},${tb.z}`;
            const v = this.voxels.get(key);
            const def = v && defOf(v.type);
            if (!def) { this._mineKey = null; this._mineProg = 0; bar.style.display = 'none'; if (this.crackMesh) this.crackMesh.visible = false; this._swingArm(false); return; }
            if (key !== this._mineKey) { this._mineKey = key; this._mineProg = 0; }
            this._mineProg += dt;
            const need = Math.max(0.05, this._breakTime(def));
            bar.style.display = 'block';
            bar.firstChild.style.width = Math.min(100, this._mineProg / need * 100) + '%';
            this._swingArm(true);
            if (this.crackMesh) {
                const st = Math.min(9, Math.floor(this._mineProg / need * 10));
                this.crackMesh.material.map = this._crackTex[st];
                this.crackMesh.material.needsUpdate = true;
                this.crackMesh.position.set(tb.x, tb.y, tb.z);
                this.crackMesh.visible = true;
            }
            if (this._mineProg >= need) {
                this._dig();
                this._mineKey = null; this._mineProg = 0;
                if (this.crackMesh) this.crackMesh.visible = false;
            }
        },

        _swingArm(on) {
            let a = el('mcArm');
            if (!a) {
                if (!document.getElementById('mcArmStyle')) {
                    const st = document.createElement('style');
                    st.id = 'mcArmStyle';
                    st.textContent = '@keyframes mcSwing{0%{transform:rotate(15deg) translate(0,0)}50%{transform:rotate(-35deg) translate(-30px,-40px)}100%{transform:rotate(15deg) translate(0,0)}}#mcArm.swing{animation:mcSwing .35s infinite ease-in-out}';
                    document.head.appendChild(st);
                }
                a = document.createElement('div');
                a.id = 'mcArm';
                a.style.cssText = 'position:fixed;right:8%;bottom:-10px;width:70px;height:190px;background:linear-gradient(90deg,#c68e5e,#a8734a);border:3px solid #6d4a2b;border-radius:10px 10px 0 0;transform-origin:50% 100%;transform:rotate(15deg);z-index:55;pointer-events:none;display:none';
                document.body.appendChild(a);
            }
            if (on) { a.style.display = 'block'; a.classList.add('swing'); }
            else { a.classList.remove('swing'); a.style.display = this.running ? 'block' : 'none'; }
        },

        _mineBar() {
            let b = el('mcMineBar');
            if (!b) {
                b = document.createElement('div');
                b.id = 'mcMineBar';
                b.style.cssText = 'position:fixed;left:50%;top:56%;width:120px;height:8px;margin-left:-60px;background:rgba(0,0,0,.6);border:1px solid #fff;display:none;z-index:60;pointer-events:none';
                b.innerHTML = '<div style="height:100%;width:0;background:#8bc34a"></div>';
                document.body.appendChild(b);
            }
            return b;
        },

        hasItem(id, count) {
            let total = 0;
            this.hotbar.forEach(s => { if (s.id === id) total += s.count; });
            this.mainInv.forEach(s => { if (s.id === id) total += s.count; });
            return total >= count;
        },

        consumeItem(id, count) {
            let need = count;
            for (let i = 0; i < 9 && need > 0; i++) {
                if (this.hotbar[i].id === id) {
                    const take = Math.min(this.hotbar[i].count, need);
                    this.hotbar[i].count -= take;
                    need -= take;
                }
            }
            for (let i = 0; i < 27 && need > 0; i++) {
                if (this.mainInv[i].id === id) {
                    const take = Math.min(this.mainInv[i].count, need);
                    this.mainInv[i].count -= take;
                    need -= take;
                }
            }
            this._updateHotbarCounts();
            this._renderInventory();
        },

        // ---------- 生存模式：挖掘与放置/食用 ----------
        _dig() {
            if (this.player.isDead || !this.targetBlock) return;
            const tb = this.targetBlock;
            const key = `${tb.x},${tb.y},${tb.z}`;
            const item = this.voxels.get(key);
            if (item) {
                const blockType = item.type;
                this._spawnBreakParticles(tb.x, tb.y, tb.z, blockType);

                const cx = Math.floor(tb.x / CHUNK_SIZE);
                const cz = Math.floor(tb.z / CHUNK_SIZE);
                const chunk = this.chunks.get(`${cx},${cz}`);
                if (chunk && item.mesh) {
                    chunk.group.remove(item.mesh);
                    const idx = chunk.visibleMeshes.indexOf(item.mesh);
                    if (idx !== -1) chunk.visibleMeshes.splice(idx, 1);
                }
                this.voxels.delete(key);
                this.targetBlock = null;
                this.highlightBox.visible = false;

                // 露出六个相邻方块（动态激活暴露面）
                [[0, -1, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]].forEach(d => {
                    const nx = tb.x + d[0], ny = tb.y + d[1], nz = tb.z + d[2];
                    const nItem = this.voxels.get(`${nx},${ny},${nz}`);
                    if (nItem && !nItem.mesh) {
                        const nChunk = this.chunks.get(`${Math.floor(nx / CHUNK_SIZE)},${Math.floor(nz / CHUNK_SIZE)}`);
                        if (nChunk) this._addVoxelMesh(nx, ny, nz, nItem.type, nChunk.group, nChunk);
                    }
                });

                this._flowFluid(tb.x, tb.y, tb.z);

                if (blockType === 16 && this.furnaces.has(key)) {
                    const f = this.furnaces.get(key);
                    [f.inp, f.fuel, f.out].forEach(s => { if (s.count > 0) this._dropItem(s.id, s.count, tb.x, tb.y, tb.z); });
                    this.furnaces.delete(key);
                    if (this.invOpen && this.furnaceKey === key) this._toggleInventory();
                }

                const bdef = defOf(blockType);
                const held = this._heldDef();
                const tool = held && held.tool;
                const match = !!(tool && bdef && tool.type === bdef.best);
                const canHarvest = !bdef || !bdef.harvest || (match && tool.tier >= bdef.harvest);

                if (canHarvest) {
                    if (blockType === 11) {
                        if (Math.random() < 0.25) this._dropItem(8, 1, tb.x, tb.y, tb.z);
                    } else {
                        const dropId = (bdef && bdef.drop) || blockType;
                        const dd = defOf(dropId);
                        if (dd) this._dropItem(dropId, 1, tb.x, tb.y, tb.z);
                    }
                } else {
                    this._toast('工具不合适，没有掉落');
                }

                if (tool && bdef && bdef.hard > 0) {
                    const slot = this.hotbar[this.selectedBlockIdx];
                    slot.dur = (slot.dur || tool.dur) - 1;
                    if (slot.dur <= 0) {
                        slot.count = 0;
                        this._toast(held.name + '损坏了！');
                    }
                    this._updateHotbarCounts();
                    this._renderInventory();
                }

                this.player.food = Math.max(0, this.player.food - 0.05);
            }
        },

        _place() {
            if (this.player.isDead) return;
            const curSlot = this.hotbar[this.selectedBlockIdx];
            if (!curSlot || curSlot.count <= 0) {
                this._toast('⚠️ 当前手持物品为空，请先收集！');
                return;
            }

            const def = ITEM_DEFS.find(d => d.id === curSlot.id);
            if (!def) return;

            if (def.isItem && !def.isFood) {
                this._toast('这个物品无法放置');
                return;
            }

            if (def.isFood) {
                if (this.player.food >= 10 && this.player.health >= 10) {
                    this._toast('饱食度和生命值已满！');
                    return;
                }
                curSlot.count -= 1;
                const fv = def.food || 3;
                this.player.food = Math.min(10, this.player.food + fv);
                if (def.key !== 'rotten_flesh') this.player.health = Math.min(10, this.player.health + 1);
                this._toast(`食用了${def.name} (饱食度+${fv})`);
                this._updateHotbarCounts();
                this._updateHUD();
                return;
            }

            if (!this.targetBlock) return;
            const tb = this.targetBlock;
            const nx = tb.x + tb.normal.x;
            const ny = tb.y + tb.normal.y;
            const nz = tb.z + tb.normal.z;

            const px = Math.floor(this.player.x + 0.5);
            const py1 = Math.floor(this.player.y);
            const py2 = Math.floor(this.player.y + 0.8);
            const pz = Math.floor(this.player.z + 0.5);
            if (nx === px && (ny === py1 || ny === py2) && nz === pz) return;

            this._setBlock(nx, ny, nz, def.id);
            curSlot.count -= 1;
            this._updateHotbarCounts();
            this.player.food = Math.max(0, this.player.food - 0.03);
        },

        _spawnBreakParticles(x, y, z, type) {
            const def = ITEM_DEFS.find(d => d.id === type) || ITEM_DEFS[0];
            const pGeom = new THREE.BoxGeometry(0.18, 0.18, 0.18);
            const pMat = new THREE.MeshBasicMaterial({ color: def.color || def.top || 0x888888 });
            for (let i = 0; i < 6; i++) {
                const p = new THREE.Mesh(pGeom, pMat);
                p.position.set(x + (Math.random() - 0.5) * 0.8, y + (Math.random() - 0.5) * 0.8, z + (Math.random() - 0.5) * 0.8);
                const vx = (Math.random() - 0.5) * 4, vy = 2 + Math.random() * 3, vz = (Math.random() - 0.5) * 4;
                this.scene.add(p);
                this.particles.push({ mesh: p, vx, vy, vz, life: 0.5 });
            }
        },

        // ---------- 伤害、死亡与重生 ----------
        _takeDamage(dmg, reason) {
            if (this.player.isDead) return;
            this.player.health = Math.max(0, this.player.health - dmg);
            this._toast(`💥 受到伤害 (-${dmg.toFixed(1)}) ${reason || ''}`);
            this._updateHUD();

            const cv = el('lcCanvas');
            if (cv) {
                cv.style.filter = 'drop-shadow(0 0 20px #f44336)';
                setTimeout(() => cv.style.filter = 'none', 180);
            }

            if (this.player.health <= 0) {
                this._die();
            }
        },

        _die() {
            this.player.isDead = true;
            this.player.pitch = -0.8;
            const deathOverlay = el('mcDeathOverlay');
            if (deathOverlay) deathOverlay.style.display = 'flex';
            if (document.exitPointerLock) {
                try { document.exitPointerLock(); } catch (e) {}
            }
        },

        _respawn() {
            this.player.isDead = false;
            this.player.health = 10;
            this.player.food = 10;
            this.player.vx = 0; this.player.vy = 0; this.player.vz = 0;
            this.player.x = this.spawnPoint.x;
            this.player.y = this.spawnPoint.y;
            this.player.z = this.spawnPoint.z;
            this.player.fallStartY = this.player.y;
            this.player.pitch = 0;

            const deathOverlay = el('mcDeathOverlay');
            if (deathOverlay) deathOverlay.style.display = 'none';

            this._toast('✨ 已在出生点重生！');
            this._updateHUD();
        },

        // ---------- 背包与合成系统界面逻辑 ----------
        _toggleInventory(mode, fKey) {
            this.invOpen = !this.invOpen;
            const modal = el('mcInventoryModal');
            if (!modal) return;
            modal.style.display = this.invOpen ? 'flex' : 'none';

            if (this.invOpen) {
                this.craftMode = mode || 'inv';
                this.furnaceKey = fKey || null;
                this.craftGrid = Array.from({ length: this.craftMode === 'table' ? 9 : this.craftMode === 'inv' ? 4 : 0 }, () => ({ id: 0, count: 0, dur: 0 }));
                this.craftOut = null;
                if (document.exitPointerLock) {
                    try { document.exitPointerLock(); } catch (e) {}
                }
                this._renderInventory();
                this._renderCrafting();
            } else {
                this._returnCraft();
                this._returnHeld();
                this._renderHeld();
            }
        },

        _returnCraft() {
            const p = this.player;
            for (const s of this.craftGrid) {
                if (s.count <= 0) continue;
                this.addItem(s.id, s.count);
                if (this._lastRem > 0) this._dropItem(s.id, this._lastRem, p.x, p.y + 1, p.z, 0, 2, 0, 1);
                s.id = 0; s.count = 0;
            }
            this.craftGrid = []; this.craftOut = null;
        },

        _useBlockOrPlace() {
            const tb = this.targetBlock;
            if (tb && !this.player.isDead) {
                const v = this.voxels.get(`${tb.x},${tb.y},${tb.z}`);
                if (v && v.type === 4) { this._toggleInventory('table'); return; }
                if (v && v.type === 16) {
                    const key = `${tb.x},${tb.y},${tb.z}`;
                    if (!this.furnaces.has(key)) {
                        this.furnaces.set(key, {
                            inp: { id: 0, count: 0, dur: 0 }, fuel: { id: 0, count: 0, dur: 0 }, out: { id: 0, count: 0, dur: 0 },
                            burn: 0, burnMax: 0, cook: 0
                        });
                    }
                    this._toggleInventory('furnace', key);
                    return;
                }
            }
            this._place();
        },

        _renderSlotGrid(container, arr, area) {
            if (!container) return;
            container.innerHTML = '';
            arr.forEach((slot, idx) => {
                const d = slot.count > 0 ? defOf(slot.id) : null;
                const slotDiv = document.createElement('div');
                slotDiv.className = 'mc-inv-slot' + (slot.count > 0 ? '' : ' empty')
                    + (area === 'hot' && idx === this.selectedBlockIdx ? ' selected' : '');
                if (d) {
                    const durPct = d.tool
                        ? Math.max(0, Math.min(100, (slot.dur || d.tool.dur) / d.tool.dur * 100))
                        : 0;
                    const durBar = d.tool ? `<div class="mc-dur"><i style="width:${durPct}%"></i></div>` : '';
                    slotDiv.innerHTML = `<div class="mc-slot-icon mc-b-${d.key}" style="${iconCss(d)}"></div>`
                        + `<span class="mc-count">${d.tool ? '' : slot.count}</span>${durBar}`;
                    slotDiv.title = d.tool
                        ? `${d.name} 耐久 ${slot.dur || d.tool.dur}/${d.tool.dur}`
                        : `${d.name} (${slot.count})`;
                }
                slotDiv.addEventListener('mousedown', e => {
                    e.preventDefault();
                    this._invSlotClick(area, idx, e);
                });
                slotDiv.addEventListener('contextmenu', e => e.preventDefault());
                container.appendChild(slotDiv);
            });
        },

        _renderInventory() {
            this._renderSlotGrid(el('mcMainInvGrid'), this.mainInv, 'main');
            this._renderSlotGrid(el('mcHotbarInvGrid'), this.hotbar, 'hot');
            this._renderHeld();
        },

        // 左键：拿起/放下/交换；右键：拆一半/放一个；Shift+左键：主包↔快捷栏快速移动
        _invSlotClick(area, idx, e) {
            if (area === 'cout') { this._takeCraft(e.shiftKey); return; }
            const F = this.craftMode === 'furnace' ? this.furnaces.get(this.furnaceKey) : null;
            let arr;
            if (area === 'hot') arr = this.hotbar;
            else if (area === 'craft') arr = this.craftGrid;
            else if (area === 'finp' && F) arr = [F.inp];
            else if (area === 'ffuel' && F) arr = [F.fuel];
            else if (area === 'fout' && F) arr = [F.out];
            else arr = this.mainInv;
            const slot = arr[idx];
            if (!slot) return;
            const held = this.heldItem;
            const right = e.button === 2;

            if (area === 'fout') {
                if (slot.count <= 0) return;
                if (e.shiftKey && !held) {
                    this._moveStack(slot, this.hotbar.concat(this.mainInv));
                } else if (!held) {
                    this.heldItem = { id: slot.id, count: slot.count, dur: 0 };
                    slot.id = 0; slot.count = 0;
                } else if (held.id === slot.id && held.count + slot.count <= MAX_STACK) {
                    held.count += slot.count; slot.id = 0; slot.count = 0;
                }
                this._afterInvChange();
                return;
            }
            if (area === 'ffuel' && held && held.id !== 20) { this._toast('只能放入煤炭作为燃料'); return; }

            if (e.shiftKey && !held && slot.count > 0) {
                const dest = (area === 'hot') ? this.mainInv
                    : (area === 'main' && this.craftMode !== 'furnace') ? this.hotbar
                    : (area === 'main') ? this.hotbar : this.hotbar.concat(this.mainInv);
                this._moveStack(slot, dest);
            } else if (!held) {
                if (slot.count <= 0) return;
                const d = defOf(slot.id);
                if (right && d && !d.tool && slot.count > 1) {
                    const half = Math.ceil(slot.count / 2);
                    this.heldItem = { id: slot.id, count: half, dur: 0 };
                    slot.count -= half;
                } else {
                    this.heldItem = { id: slot.id, count: slot.count, dur: slot.dur || 0 };
                    slot.id = 0; slot.count = 0; slot.dur = 0;
                }
            } else {
                const hd = defOf(held.id);
                const canStack = hd && !hd.tool && (slot.count === 0 || (slot.id === held.id && slot.count < MAX_STACK));
                if (right && canStack) {
                    if (slot.count === 0) { slot.id = held.id; slot.dur = held.dur || 0; }
                    slot.count += 1;
                    held.count -= 1;
                    if (held.count <= 0) this.heldItem = null;
                } else if (slot.count > 0 && slot.id === held.id && hd && !hd.tool && slot.count < MAX_STACK) {
                    const put = Math.min(MAX_STACK - slot.count, held.count);
                    slot.count += put;
                    held.count -= put;
                    if (held.count <= 0) this.heldItem = null;
                } else {
                    const tmp = { id: slot.id, count: slot.count, dur: slot.dur || 0 };
                    slot.id = held.id; slot.count = held.count; slot.dur = held.dur || 0;
                    this.heldItem = tmp.count > 0 ? tmp : null;
                }
            }
            this._afterInvChange();
        },

        _moveStack(slot, dest) {
            if (!slot || slot.count <= 0) return;
            const d = defOf(slot.id);
            if (d && d.tool) {
                const empty = dest.find(s => s.count === 0);
                if (empty) {
                    empty.id = slot.id; empty.count = slot.count; empty.dur = slot.dur || 0;
                    slot.id = 0; slot.count = 0; slot.dur = 0;
                }
                return;
            }
            let rem = slot.count;
            for (const s of dest) {
                if (rem <= 0) break;
                if (s.id === slot.id && s.count > 0 && s.count < MAX_STACK) {
                    const put = Math.min(MAX_STACK - s.count, rem);
                    s.count += put; rem -= put;
                }
            }
            for (const s of dest) {
                if (rem <= 0) break;
                if (s.count === 0) {
                    const put = Math.min(MAX_STACK, rem);
                    s.id = slot.id; s.count = put; s.dur = 0; rem -= put;
                }
            }
            slot.count = rem;
            if (rem <= 0) { slot.id = 0; slot.dur = 0; }
        },

        _afterInvChange() {
            this._updateHotbarCounts();
            this._renderInventory();
            this._renderCrafting();
            this._saveInv();
        },

        _renderHeld() {
            let cur = el('mcHeldCursor');
            if (!this.heldItem) {
                if (cur) cur.style.display = 'none';
                return;
            }
            if (!cur) {
                cur = document.createElement('div');
                cur.id = 'mcHeldCursor';
                cur.className = 'mc-held-cursor';
                document.body.appendChild(cur);
            }
            const d = defOf(this.heldItem.id);
            cur.style.display = 'flex';
            cur.innerHTML = d
                ? `<div class="mc-slot-icon mc-b-${d.key}" style="${iconCss(d)}"></div><span class="mc-count">${d.tool ? '' : this.heldItem.count}</span>`
                : '';
            cur.style.left = (this._mx || 0) + 'px';
            cur.style.top = (this._my || 0) + 'px';
        },

        _dropHeld() {
            if (!this.heldItem) return;
            const d = defOf(this.heldItem.id);
            this._toast(`丢弃了 ${d ? d.name : '物品'} x${this.heldItem.count}`);
            const p = this.player, h = this.heldItem;
            this._dropItem(h.id, h.count, p.x - Math.sin(p.yaw) * 0.6, p.y + 1.2, p.z - Math.cos(p.yaw) * 0.6,
                -Math.sin(p.yaw) * 4, 2, -Math.cos(p.yaw) * 4, 1.5);
            this.heldItem = null;
            this._afterInvChange();
        },

        _returnHeld() {
            if (!this.heldItem) return;
            const h = this.heldItem;
            this.heldItem = null;
            this.addItem(h.id, h.count);
        },

        _sortInventory() {
            const all = this.hotbar.concat(this.mainInv);
            const tools = [];
            const stacks = new Map();
            all.forEach(s => {
                if (s.count <= 0) return;
                const d = defOf(s.id);
                if (d && d.tool) tools.push({ id: s.id, count: s.count, dur: s.dur || 0 });
                else stacks.set(s.id, (stacks.get(s.id) || 0) + s.count);
            });
            const out = tools.slice();
            [...stacks.entries()].sort((a, b) => a[0] - b[0]).forEach(([id, total]) => {
                let rem = total;
                while (rem > 0) {
                    const put = Math.min(MAX_STACK, rem);
                    out.push({ id, count: put, dur: 0 });
                    rem -= put;
                }
            });
            all.forEach((s, i) => {
                const o = out[i];
                s.id = o ? o.id : 0;
                s.count = o ? o.count : 0;
                s.dur = o ? o.dur : 0;
            });
            this._toast('背包已整理');
            this._afterInvChange();
        },

        _saveInv() {
            try {
                localStorage.setItem('mcInvSave', JSON.stringify({
                    hotbar: this.hotbar, mainInv: this.mainInv, sel: this.selectedBlockIdx
                }));
            } catch (e) { /* ignore */ }
        },

        _loadInv() {
            try {
                const s = JSON.parse(localStorage.getItem('mcInvSave') || 'null');
                if (!s) return;
                const norm = (arr, len) => (Array.isArray(arr) && arr.length === len)
                    ? arr.map(x => {
                        const id = x.id | 0, count = x.count | 0;
                        if (count <= 0 || !defOf(id)) return { id: 0, count: 0, dur: 0 };
                        return { id, count, dur: x.dur | 0 };
                    })
                    : null;
                const hb = norm(s.hotbar, 9), mi = norm(s.mainInv, 27);
                if (hb) this.hotbar = hb;
                if (mi) this.mainInv = mi;
                if (typeof s.sel === 'number') this.selectedBlockIdx = Math.max(0, Math.min(8, s.sel));
            } catch (e) { /* ignore */ }
        },

        _updateCraftOut() {
            const n = this.craftMode === 'table' ? 3 : 2;
            const rec = matchGrid(this.craftGrid.map(s => s.count > 0 ? s.id : 0), n);
            if (!rec) { this.craftOut = null; return; }
            const d = defOf(rec.outId);
            this.craftOut = { id: rec.outId, count: rec.outNum, dur: d && d.tool ? d.tool.dur : 0 };
        },

        _takeCraft(shift) {
            if (!this.craftOut) return;
            const consume = () => {
                for (const s of this.craftGrid) {
                    if (s.count > 0) { s.count--; if (s.count <= 0) { s.id = 0; s.dur = 0; } }
                }
                this._updateCraftOut();
            };
            if (shift) {
                const p = this.player;
                let guard = 64;
                while (this.craftOut && guard-- > 0 && this._canFit(this.craftOut.id)) {
                    const o = this.craftOut;
                    this.addItem(o.id, o.count);
                    if (this._lastRem > 0) this._dropItem(o.id, this._lastRem, p.x, p.y + 1, p.z, 0, 2, 0, 1);
                    consume();
                }
            } else {
                const o = this.craftOut, held = this.heldItem, d = defOf(o.id);
                if (held) {
                    if (held.id !== o.id || (d && d.tool) || held.count + o.count > MAX_STACK) return;
                    held.count += o.count;
                } else {
                    this.heldItem = { id: o.id, count: o.count, dur: o.dur };
                }
                consume();
            }
            this._afterInvChange();
        },

        _renderCrafting() {
            const list = el('mcCraftList');
            if (!list) return;
            list.innerHTML = '';
            list.style.maxHeight = 'none';
            const title = el('mcCraftTitle');
            const mode = this.craftMode;
            const mkGrid = (n, arr, area) => {
                const g = document.createElement('div');
                g.className = 'mc-inv-grid';
                g.style.gridTemplateColumns = `repeat(${n}, 52px)`;
                g.style.width = 'fit-content';
                this._renderSlotGrid(g, arr, area);
                return g;
            };
            const mkLabel = (txt) => {
                const l = document.createElement('div');
                l.style.cssText = 'color:#bbb;font-size:12px';
                l.textContent = txt;
                return l;
            };
            const mkBar = (id, color, pct) => {
                const b = document.createElement('div');
                b.style.cssText = 'width:140px;height:10px;background:#000;border-radius:5px;overflow:hidden;border:1px solid #555';
                b.innerHTML = `<i id="${id}" style="display:block;height:100%;width:${pct}%;background:${color}"></i>`;
                return b;
            };
            const wrap = document.createElement('div');
            wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:8px';
            if (mode === 'furnace') {
                const f = this.furnaces.get(this.furnaceKey);
                if (!f) return;
                if (title) title.textContent = '🔥 熔炉';
                wrap.appendChild(mkLabel('原料'));
                wrap.appendChild(mkGrid(1, [f.inp], 'finp'));
                wrap.appendChild(mkBar('mcFurnFlame', '#ff9800', f.burnMax ? f.burn / f.burnMax * 100 : 0));
                wrap.appendChild(mkLabel('燃料（煤炭）'));
                wrap.appendChild(mkGrid(1, [f.fuel], 'ffuel'));
                wrap.appendChild(mkBar('mcFurnArrow', '#fff', f.cook / SMELT_TIME * 100));
                wrap.appendChild(mkLabel('产物'));
                wrap.appendChild(mkGrid(1, [f.out], 'fout'));
                wrap.appendChild(mkLabel('粗铁 → 铁锭 · 生猪排 → 熟猪排 · 圆石 → 石头；1煤炭燃烧80秒，每件10秒'));
                this._furnSig = [f.inp.id, f.inp.count, f.fuel.count, f.out.id, f.out.count].join(',');
            } else {
                const n = mode === 'table' ? 3 : 2;
                this._updateCraftOut();
                if (title) title.textContent = mode === 'table' ? '🔨 工作台（3x3 合成）' : '🔨 合成（2x2）';
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;gap:14px';
                row.appendChild(mkGrid(n, this.craftGrid, 'craft'));
                const ar = document.createElement('div');
                ar.style.cssText = 'color:#ffca28;font-size:28px';
                ar.textContent = '=>';
                row.appendChild(ar);
                row.appendChild(mkGrid(1, [this.craftOut || { id: 0, count: 0 }], 'cout'));
                wrap.appendChild(row);
                wrap.appendChild(mkLabel(mode === 'table'
                    ? '按原版配方摆放材料，点击右侧成品取出（Shift+点击批量合成）'
                    : '2x2 可合成木板、木棍、工作台；右键工作台用3x3，右键熔炉烧炼'));
            }
            list.appendChild(wrap);
        },

        // ---------- 交互事件绑定 ----------
        _initEvents() {
            window.addEventListener('resize', () => {
                const w = window.innerWidth, h = window.innerHeight;
                this.rdr.setSize(w, h);
                this.cam.aspect = w / h;
                this.cam.updateProjectionMatrix();
            });

            window.addEventListener('keydown', e => {
                this.keys[e.code] = true;
                if (e.code === 'KeyE') {
                    e.preventDefault();
                    this._toggleInventory();
                }
                if (e.code >= 'Digit1' && e.code <= 'Digit9' && !this.invOpen) {
                    const idx = parseInt(e.code.replace('Digit', '')) - 1;
                    this._selectHotbar(idx);
                }
                if (e.code === 'KeyQ' && this.invOpen) {
                    e.preventDefault();
                    this._dropHeld();
                } else if (e.code === 'KeyQ' && this.running && !this.player.isDead) {
                    const s = this.hotbar[this.selectedBlockIdx], p = this.player;
                    if (s && s.count > 0) {
                        this._dropItem(s.id, 1, p.x - Math.sin(p.yaw) * 0.6, p.y + 1.2, p.z - Math.cos(p.yaw) * 0.6,
                            -Math.sin(p.yaw) * 4, 2, -Math.cos(p.yaw) * 4, 1.5);
                        s.count--;
                        if (s.count <= 0) { s.id = 0; s.dur = 0; }
                        this._updateHotbarCounts();
                    }
                }
            });
            window.addEventListener('keyup', e => this.keys[e.code] = false);

            window.addEventListener('wheel', e => {
                if (!this.running || this.player.isDead || this.invOpen) return;
                let next = this.selectedBlockIdx + (e.deltaY > 0 ? 1 : -1);
                if (next < 0) next = 8;
                if (next > 8) next = 0;
                this._selectHotbar(next);
            }, { passive: true });

            const cv = el('lcCanvas');
            cv.addEventListener('click', () => {
                if (this.player.isDead || this.invOpen) return;
                if (document.pointerLockElement !== cv && cv.requestPointerLock) {
                    cv.requestPointerLock();
                }
            });
            document.addEventListener('mousemove', e => {
                this._mx = e.clientX; this._my = e.clientY;
                if (this.invOpen && this.heldItem) this._renderHeld();
            });
            document.addEventListener('mousemove', e => {
                if (this.player.isDead || this.invOpen) return;
                if (document.pointerLockElement === cv) {
                    const sens = 0.0022;
                    this.player.yaw -= e.movementX * sens;
                    this.player.pitch = Math.max(-1.45, Math.min(1.45, this.player.pitch - e.movementY * sens));
                }
            });

            cv.addEventListener('mousedown', e => {
                if (this.player.isDead || this.invOpen || document.pointerLockElement !== cv) return;
                if (e.button === 0) { if (!this._tryAttack()) this.mining = true; }
                else if (e.button === 2) this._useBlockOrPlace();
            });
            document.addEventListener('mouseup', e => { if (e.button === 0) this.mining = false; });
            clearInterval(this._mineTimer);
            this._mineTimer = setInterval(() => this._mineTick(0.05), 50);
            cv.addEventListener('contextmenu', e => e.preventDefault());

            let touchX = 0, touchY = 0, touching = false;
            cv.addEventListener('touchstart', e => {
                if (this.player.isDead || this.invOpen) return;
                const t = e.touches[0];
                if (t.clientX > window.innerWidth * 0.35) {
                    touching = true;
                    touchX = t.clientX; touchY = t.clientY;
                }
            }, { passive: true });
            cv.addEventListener('touchmove', e => {
                if (!touching || this.player.isDead || this.invOpen) return;
                const t = e.touches[0];
                const dx = t.clientX - touchX, dy = t.clientY - touchY;
                touchX = t.clientX; touchY = t.clientY;
                this.player.yaw -= dx * 0.005;
                this.player.pitch = Math.max(-1.4, Math.min(1.4, this.player.pitch - dy * 0.005));
            }, { passive: true });
            cv.addEventListener('touchend', () => touching = false);

            const joy = el('lcJoy');
            if (joy) {
                joy.addEventListener('pointermove', e => {
                    if (this.player.isDead || this.invOpen) return;
                    if (!e.buttons && e.pointerType === 'mouse') return;
                    const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
                    const dx = e.clientX - cx, dy = e.clientY - cy;
                    const dist = Math.min(40, Math.hypot(dx, dy));
                    const a = Math.atan2(dy, dx);
                    this.touchMove.x = Math.cos(a) * (dist / 40);
                    this.touchMove.y = Math.sin(a) * (dist / 40);
                });
                const resetJoy = () => this.touchMove = { x: 0, y: 0 };
                joy.addEventListener('pointerup', resetJoy);
                joy.addEventListener('pointerleave', resetJoy);
            }

            const btnDig = el('btnMcDig');
            if (btnDig) {
                btnDig.addEventListener('pointerdown', () => { if (!this._tryAttack()) this.mining = true; });
                ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btnDig.addEventListener(ev, () => { this.mining = false; }));
            }
            const btnBuild = el('btnMcBuild');
            if (btnBuild) btnBuild.addEventListener('click', () => this._useBlockOrPlace());
            const btnJump = el('btnMcJump');
            if (btnJump) btnJump.addEventListener('click', () => {
                if (!this.player.isDead && this.player.onGround && !this.invOpen) {
                    this.player.vy = 8.5;
                    this.player.onGround = false;
                    this.player.fallStartY = this.player.y;
                }
            });

            document.querySelectorAll('#mcHotbar .mc-slot').forEach(s => {
                s.addEventListener('click', () => this._selectHotbar(parseInt(s.dataset.idx)));
            });

            const btnOpenInv = el('btnMcOpenInv');
            if (btnOpenInv) btnOpenInv.addEventListener('click', () => this._toggleInventory());
            const btnInvTouch = el('btnMcInvTouch');
            if (btnInvTouch) btnInvTouch.addEventListener('click', () => this._toggleInventory());
            const btnCloseInv = el('btnMcCloseInv');
            if (btnCloseInv) btnCloseInv.addEventListener('click', () => this._toggleInventory());

            const btnSortInv = el('btnMcSortInv');
            if (btnSortInv) btnSortInv.addEventListener('click', () => this._sortInventory());

            const invModal = el('mcInventoryModal');
            if (invModal) {
                invModal.addEventListener('contextmenu', e => e.preventDefault());
                invModal.addEventListener('mousedown', e => {
                    if (e.target === invModal && this.heldItem) this._dropHeld();
                });
            }

            const btnBack = el('btnLcBack');
            if (btnBack) btnBack.addEventListener('click', () => this.exit());

            const btnRespawn = el('btnMcRespawn');
            if (btnRespawn) btnRespawn.addEventListener('click', () => this._respawn());
            const btnDeathQuit = el('btnMcDeathQuit');
            if (btnDeathQuit) btnDeathQuit.addEventListener('click', () => this.exit());

            const btnOnline = el('btnMcOnline');
            if (btnOnline) {
                btnOnline.addEventListener('click', () => {
                    const ifr = el('mcIframe');
                    if (ifr) ifr.src = 'https://eaglercraft.com/mc/1.8.8/';
                    const modal = el('mcOnlineModal');
                    if (modal) modal.style.display = 'flex';
                });
            }
            const btnCloseOnline = el('btnMcCloseOnline');
            if (btnCloseOnline) {
                btnCloseOnline.addEventListener('click', () => {
                    const ifr = el('mcIframe');
                    if (ifr) ifr.src = '';
                    const modal = el('mcOnlineModal');
                    if (modal) modal.style.display = 'none';
                });
            }
        },

        _selectHotbar(idx) {
            this.selectedBlockIdx = idx;
            document.querySelectorAll('#mcHotbar .mc-slot').forEach((s, i) => {
                s.classList.toggle('active', i === idx);
            });
            const slot = this.hotbar[idx];
            const def = ITEM_DEFS.find(d => d.id === slot.id);
            const name = def ? def.name : '空';
            this._showItemToast(`${name} (剩余: ${slot.count})`);
            this._saveInv();
        },

        _updateHotbarCounts() {
            document.querySelectorAll('#mcHotbar .mc-slot').forEach((s, i) => {
                const countEl = s.querySelector('.mc-count');
                const iconEl = s.querySelector('.mc-slot-icon');
                const slot = this.hotbar[i];
                const d = defOf(slot.id);
                if (iconEl) {
                    if (d && slot.count > 0) {
                        iconEl.className = 'mc-slot-icon mc-b-' + d.key;
                        iconEl.style.cssText = iconCss(d);
                    } else {
                        iconEl.className = 'mc-slot-icon';
                        iconEl.style.cssText = 'display:none';
                    }
                }
                if (countEl) countEl.textContent = (slot.count <= 0 || (d && d.tool)) ? '' : slot.count;
                s.title = (d && d.tool && slot.count > 0) ? `${d.name} 耐久 ${slot.dur || d.tool.dur}/${d.tool.dur}` : '';
                let durEl = s.querySelector('.mc-dur');
                if (d && d.tool && slot.count > 0) {
                    if (!durEl) {
                        durEl = document.createElement('div');
                        durEl.className = 'mc-dur';
                        durEl.innerHTML = '<i></i>';
                        s.appendChild(durEl);
                    }
                    const pct = Math.max(0, Math.min(100, (slot.dur || d.tool.dur) / d.tool.dur * 100));
                    durEl.firstChild.style.width = pct + '%';
                } else if (durEl) {
                    durEl.remove();
                }
            });
            this._saveInv();
        },

        _showItemToast(txt) {
            const it = el('mcItemToast');
            if (!it) return;
            it.textContent = txt;
            it.style.opacity = '1';
            clearTimeout(this._itTimer);
            this._itTimer = setTimeout(() => it.style.opacity = '0', 1600);
        },

        _toast(msg) {
            const t = el('lcToast');
            if (!t) return;
            t.textContent = msg; t.style.opacity = '1';
            clearTimeout(this._tTimer);
            this._tTimer = setTimeout(() => t.style.opacity = '0', 2200);
        },

        _updateHUD() {
            const p = this.player;
            const posTag = el('mcPosTag');
            if (posTag) posTag.textContent = `XYZ: ${Math.round(p.x)}, ${Math.round(p.y)}, ${Math.round(p.z)}`;
            const isDay = (this.dayTime % 24000) < 12000;
            const timeTag = el('mcTimeTag');
            if (timeTag) timeTag.textContent = isDay ? '☀️ 白天' : '🌙 夜晚';

            const heartsEl = el('mcHearts');
            if (heartsEl) {
                const fullH = Math.round(p.health);
                let str = '';
                for (let i = 0; i < 10; i++) str += (i < fullH ? '❤️' : '🖤');
                heartsEl.textContent = str;
            }

            const foodEl = el('mcFood');
            if (foodEl) {
                const fullF = Math.round(p.food);
                let str = '';
                for (let i = 0; i < 10; i++) str += (i < fullF ? '🍗' : '🦴');
                foodEl.textContent = str;
            }
        },

        // ---------- 主物理与渲染循环 ----------
        _loop() {
            if (!this.running) return;
            requestAnimationFrame(() => this._loop());

            const now = performance.now();
            const dt = Math.min(0.08, (now - this.lastTime) / 1000);
            this.lastTime = now;

            if (!this.player.isDead && !this.invOpen) {
                this._updatePlayer(dt);
                this._updateInfiniteChunks();
                this._updateRaycast();
                this._updateSurvivalStats(dt);
                this._updateMobs(dt);
                this._updateDrops(dt);
            }
            this._updateFurnaces(dt);
            this._updateParticles(dt);
            this._updateDayNight(dt);
            this._updateHUD();

            this.rdr.render(this.scene, this.cam);
        },

        _updateSurvivalStats(dt) {
            const p = this.player;

            if (p.food >= 9 && p.health < 10) {
                this.regenTimer += dt;
                if (this.regenTimer > 3.5) {
                    this.regenTimer = 0;
                    p.health = Math.min(10, p.health + 1);
                    p.food = Math.max(0, p.food - 0.2);
                }
            } else {
                this.regenTimer = 0;
            }

            if (p.food <= 0.1) {
                this.starveTimer += dt;
                if (this.starveTimer > 3.0) {
                    this.starveTimer = 0;
                    this._takeDamage(1, '(饥饿)');
                }
            } else {
                this.starveTimer = 0;
            }
        },

        // ---------- 体素碰撞辅助 ----------
        _solid(bx, by, bz) {
            const v = this.voxels.get(`${bx},${by},${bz}`);
            if (v) return !FLUID[v.type];
            if (!this.chunks.has(`${Math.floor(bx / CHUNK_SIZE)},${Math.floor(bz / CHUNK_SIZE)}`)) return by <= this.getTerrainHeight(bx, bz);
            return false;
        },

        _fluidAt(x, y, z) {
            const v = this.voxels.get(`${Math.floor(x + 0.5)},${Math.floor(y + 0.5)},${Math.floor(z + 0.5)}`);
            return v && FLUID[v.type] ? v.type : 0;
        },

        _collides(x, y, z, feetOnly, r = 0.3, h = 1.75) {
            const ys = feetOnly ? [y] : [y + 0.05, y + h / 2, y + h];
            for (const yy of ys) {
                const by = Math.floor(yy + 0.5);
                for (const ox of [-r, r]) {
                    for (const oz of [-r, r]) {
                        if (this._solid(Math.floor(x + ox + 0.5), by, Math.floor(z + oz + 0.5))) return true;
                    }
                }
            }
            return false;
        },

        _moveBody(b, dt, r, h) {
            let blocked = false;
            const nx = b.x + b.vx * dt;
            if (!this._collides(nx, b.y, b.z, false, r, h)) b.x = nx; else { b.vx = 0; blocked = true; }
            const nz = b.z + b.vz * dt;
            if (!this._collides(b.x, b.y, nz, false, r, h)) b.z = nz; else { b.vz = 0; blocked = true; }
            if (this._fluidAt(b.x, b.y + 0.3, b.z) === 30) b.vy = 1.5;
            else b.vy = Math.max(-40, b.vy - 24 * dt);
            const total = b.vy * dt;
            const steps = Math.max(1, Math.ceil(Math.abs(total) / 0.4));
            const st = total / steps;
            let landed = false;
            for (let i = 0; i < steps; i++) {
                const ny = b.y + st;
                if (st < 0) {
                    if (this._collides(b.x, ny, b.z, true, r, h)) { b.y = Math.floor(ny + 0.5) + 0.5; b.vy = 0; landed = true; break; }
                    b.y = ny;
                } else {
                    if (this._collides(b.x, ny, b.z, false, r, h)) { b.vy = 0; break; }
                    b.y = ny;
                }
            }
            b.onGround = landed;
            return blocked;
        },

        _exposeNeighbors(x, y, z) {
            [[0, -1, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]].forEach(d => {
                const nx = x + d[0], ny = y + d[1], nz = z + d[2];
                const nItem = this.voxels.get(`${nx},${ny},${nz}`);
                if (nItem && !nItem.mesh) {
                    const nChunk = this.chunks.get(`${Math.floor(nx / CHUNK_SIZE)},${Math.floor(nz / CHUNK_SIZE)}`);
                    if (nChunk) this._addVoxelMesh(nx, ny, nz, nItem.type, nChunk.group, nChunk);
                }
            });
        },

        _flowFluid(x, y, z) {
            const q = [[x, y, z]];
            const dirs = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
            let n = 0;
            while (q.length && n < 120) {
                const [cx, cy, cz] = q.shift();
                if (cy < 1 || this.voxels.has(`${cx},${cy},${cz}`)) continue;
                if (!this.chunks.has(`${Math.floor(cx / CHUNK_SIZE)},${Math.floor(cz / CHUNK_SIZE)}`)) continue;
                let ft = 0;
                const up = this.voxels.get(`${cx},${cy + 1},${cz}`);
                if (up && FLUID[up.type]) ft = up.type;
                else {
                    for (const d of dirs) {
                        const v = this.voxels.get(`${cx + d[0]},${cy},${cz + d[2]}`);
                        if (v && FLUID[v.type]) { ft = v.type; break; }
                    }
                }
                if (!ft) continue;
                this._setBlock(cx, cy, cz, ft);
                n++;
                q.push([cx, cy - 1, cz]);
                dirs.forEach(d => q.push([cx + d[0], cy, cz + d[2]]));
            }
        },

        arrows: [], cactusTimer: 0,

        _shootArrow(m) {
            const p = this.player;
            const o = new THREE.Vector3(m.x, m.y + 1.5, m.z);
            const dir = new THREE.Vector3(p.x - o.x + (Math.random() - 0.5) * 1.2, p.y + 1.2 - o.y + (Math.random() - 0.5) * 0.6, p.z - o.z + (Math.random() - 0.5) * 1.2).normalize();
            const mesh = new THREE.Mesh(this.sharedBoxGeom, new THREE.MeshBasicMaterial({ color: 0xc8b88a }));
            mesh.scale.set(0.07, 0.07, 0.6);
            mesh.position.copy(o);
            this.scene.add(mesh);
            this.arrows.push({ mesh, vel: dir.multiplyScalar(16), life: 4 });
        },

        _updateArrows(dt) {
            const p = this.player;
            for (let i = this.arrows.length - 1; i >= 0; i--) {
                const a = this.arrows[i];
                a.vel.y -= 5 * dt;
                const pos = a.mesh.position;
                pos.addScaledVector(a.vel, dt);
                a.mesh.lookAt(pos.x + a.vel.x, pos.y + a.vel.y, pos.z + a.vel.z);
                a.life -= dt;
                let done = a.life <= 0 || this._solid(Math.floor(pos.x + 0.5), Math.floor(pos.y + 0.5), Math.floor(pos.z + 0.5));
                if (!done && Math.abs(pos.x - p.x) < 0.45 && Math.abs(pos.z - p.z) < 0.45 && pos.y > p.y && pos.y < p.y + 1.8) {
                    this._takeDamage(1.5, '(骨架射箭)');
                    done = true;
                }
                if (done) { this.scene.remove(a.mesh); this.arrows.splice(i, 1); }
            }
        },

        _touchCactus(p) {
            for (const ox of [-0.45, 0, 0.45]) for (const oz of [-0.45, 0, 0.45]) for (const yy of [0.3, 1.2]) {
                const v = this.voxels.get(`${Math.floor(p.x + ox + 0.5)},${Math.floor(p.y + yy + 0.5)},${Math.floor(p.z + oz + 0.5)}`);
                if (v && v.type === 33) return true;
            }
            return false;
        },

        // ---------- 生物系统：猪 / 僵尸 / 苦力怕 / 骨架 ----------
        mobs: [], mobTimer: 0, attackCd: 0, lavaTimer: 0, _inWater: false, _sunY: 1,

        _makeMob(type) {
            const g = new THREE.Group();
            const mats = [];
            const mk = (col) => { const m = new THREE.MeshLambertMaterial({ color: col }); mats.push(m); return m; };
            const box = (w, h, d, mat, x, y, z) => {
                const m = new THREE.Mesh(this.sharedBoxGeom, mat);
                m.scale.set(w, h, d); m.position.set(x, y, z); g.add(m); return m;
            };
            const face = (draw) => {
                const m = new THREE.MeshLambertMaterial({ map: this._createPixelCanvas(8, 8, draw) });
                mats.push(m); return m;
            };
            const legs = [];
            const headMats = (skin, f) => [skin, skin, skin, skin, f, skin];
            if (type === 'zombie') {
                const skin = mk('#5b8f4a');
                const f = face(c => {
                    c.fillStyle = '#5b8f4a'; c.fillRect(0, 0, 8, 8);
                    c.fillStyle = '#111'; c.fillRect(1, 3, 2, 1); c.fillRect(5, 3, 2, 1);
                    c.fillStyle = '#2a4a22'; c.fillRect(2, 5, 4, 1);
                });
                legs.push(box(0.25, 0.7, 0.25, mk('#2c3f8f'), -0.125, 0.35, 0), box(0.25, 0.7, 0.25, mk('#2c3f8f'), 0.125, 0.35, 0));
                box(0.5, 0.7, 0.25, mk('#2f6dab'), 0, 1.05, 0);
                box(0.2, 0.2, 0.7, skin, -0.35, 1.3, 0.35); box(0.2, 0.2, 0.7, skin, 0.35, 1.3, 0.35);
                box(0.5, 0.5, 0.5, headMats(skin, f), 0, 1.65, 0);
                return { g, mats, legs, r: 0.3, h: 1.9, hp: 20, speed: 2.4, hostile: true };
            }
            if (type === 'creeper') {
                const skin = mk('#5cae4e');
                const f = face(c => {
                    c.fillStyle = '#5cae4e'; c.fillRect(0, 0, 8, 8);
                    c.fillStyle = '#111'; c.fillRect(1, 2, 2, 2); c.fillRect(5, 2, 2, 2);
                    c.fillRect(3, 4, 2, 3); c.fillRect(2, 5, 1, 2); c.fillRect(5, 5, 1, 2);
                });
                [[-0.15, -0.2], [0.15, -0.2], [-0.15, 0.2], [0.15, 0.2]].forEach(p => legs.push(box(0.25, 0.4, 0.25, skin, p[0], 0.2, p[1])));
                box(0.5, 0.75, 0.3, skin, 0, 0.775, 0);
                box(0.5, 0.5, 0.5, headMats(skin, f), 0, 1.4, 0);
                return { g, mats, legs, r: 0.3, h: 1.65, hp: 20, speed: 2.1, hostile: true };
            }
            if (type === 'skeleton') {
                const bone = mk('#d8d8d0');
                const f = face(c => {
                    c.fillStyle = '#d8d8d0'; c.fillRect(0, 0, 8, 8);
                    c.fillStyle = '#222'; c.fillRect(1, 3, 2, 2); c.fillRect(5, 3, 2, 2);
                    c.fillRect(2, 6, 4, 1);
                });
                legs.push(box(0.15, 0.7, 0.15, bone, -0.12, 0.35, 0), box(0.15, 0.7, 0.15, bone, 0.12, 0.35, 0));
                box(0.45, 0.7, 0.2, mk('#bdbdb4'), 0, 1.05, 0);
                box(0.12, 0.12, 0.6, bone, -0.3, 1.3, 0.3); box(0.12, 0.12, 0.6, bone, 0.3, 1.3, 0.3);
                box(0.5, 0.5, 0.5, headMats(bone, f), 0, 1.65, 0);
                return { g, mats, legs, r: 0.3, h: 1.9, hp: 20, speed: 1.9, hostile: true };
            }
            const pink = mk('#f0a0a8');
            const f = face(c => {
                c.fillStyle = '#f0a0a8'; c.fillRect(0, 0, 8, 8);
                c.fillStyle = '#111'; c.fillRect(1, 2, 1, 1); c.fillRect(6, 2, 1, 1);
                c.fillStyle = '#e08890'; c.fillRect(2, 4, 4, 3);
            });
            box(0.6, 0.55, 0.95, pink, 0, 0.6, 0);
            [[-0.2, -0.3], [0.2, -0.3], [-0.2, 0.3], [0.2, 0.3]].forEach(p => legs.push(box(0.18, 0.35, 0.18, pink, p[0], 0.175, p[1])));
            box(0.45, 0.45, 0.4, headMats(pink, f), 0, 0.75, 0.62);
            return { g, mats, legs, r: 0.4, h: 0.9, hp: 10, speed: 1.6, hostile: false };
        },

        _spawnMob(type, x, y, z) {
            const o = this._makeMob(type);
            const m = Object.assign(o, {
                type, x, y, z, vx: 0, vy: 0, vz: 0, yaw: Math.random() * 6.28, onGround: false,
                cd: 0, fuse: 0, hurt: 0, burn: 0, kt: 0, kx: 0, kz: 0, wanderT: 0, wdx: 0, wdz: 0
            });
            this.scene.add(m.g);
            this.mobs.push(m);
        },

        _removeMob(i) {
            const m = this.mobs[i];
            this.scene.remove(m.g);
            this.mobs.splice(i, 1);
        },

        _trySpawnMob(night) {
            const p = this.player;
            const hostiles = this.mobs.filter(m => m.hostile).length;
            const passive = this.mobs.length - hostiles;
            const a = Math.random() * Math.PI * 2, d = 24.5 + Math.random() * 6;
            const x = Math.floor(p.x + Math.sin(a) * d), z = Math.floor(p.z + Math.cos(a) * d);
            if (Math.hypot(x - p.x, z - p.z) < 24) return;
            if (!this.chunks.has(`${Math.floor(x / CHUNK_SIZE)},${Math.floor(z / CHUNK_SIZE)}`)) return;
            let y = -1;
            for (let yy = 40; yy >= 1; yy--) { if (this._solid(x, yy, z)) { y = yy; break; } }
            if (y < 0 || this._solid(x, y + 1, z) || this._fluidAt(x, y + 1, z)) return;
            const under = this.voxels.get(`${x},${y},${z}`);
            let type;
            if (night && hostiles < 7) { const r = Math.random(); type = r < 0.4 ? 'zombie' : (r < 0.7 ? 'creeper' : 'skeleton'); }
            else if (!night && passive < 5 && under && under.type === 10) type = 'pig';
            else return;
            this._spawnMob(type, x, y + 0.5, z);
        },

        _flashMob(m, hex) {
            m.mats.forEach(mt => { if (mt.emissive) mt.emissive.setHex(hex); });
        },

        _updateMobs(dt) {
            const p = this.player;
            this.attackCd = Math.max(0, this.attackCd - dt);
            this._updateArrows(dt);
            const night = this._sunY < 0.1;
            this.mobTimer += dt;
            if (this.mobTimer > 2) { this.mobTimer = 0; this._trySpawnMob(night); }

            for (let i = this.mobs.length - 1; i >= 0; i--) {
                const m = this.mobs[i];
                const dx = p.x - m.x, dz = p.z - m.z;
                const dist = Math.hypot(dx, dz) || 0.001;
                const dy = Math.abs(p.y - m.y);
                if (dist > 50 || m.y < -10) { this._removeMob(i); continue; }
                if (m.hostile && !night) { m.burn += dt; if (m.burn > 3) { this._removeMob(i); continue; } }

                let wx = 0, wz = 0, sp = m.speed;
                if (m.hostile) {
                    if (dist < 22) { wx = dx / dist; wz = dz / dist; m.yaw = Math.atan2(dx, dz); }
                } else {
                    m.wanderT -= dt;
                    if (m.wanderT <= 0) {
                        m.wanderT = 2 + Math.random() * 3;
                        if (Math.random() < 0.6) { const a = Math.random() * 6.283; m.wdx = Math.sin(a); m.wdz = Math.cos(a); }
                        else { m.wdx = 0; m.wdz = 0; }
                    }
                    wx = m.wdx; wz = m.wdz; sp *= 0.6;
                    if (wx || wz) m.yaw = Math.atan2(wx, wz);
                }

                if (m.type === 'zombie') {
                    m.cd -= dt;
                    if (dist < 1.2 && dy < 1.6 && m.cd <= 0) { m.cd = 1; this._takeDamage(1.5, '(僵尸)'); }
                    if (dist < 1.0) { wx = 0; wz = 0; }
                } else if (m.type === 'skeleton') {
                    m.cd -= dt;
                    if (dist < 5) { wx = -wx; wz = -wz; } else if (dist < 14) { wx = 0; wz = 0; }
                    if (dist < 18 && m.cd <= 0) { m.cd = 2; this._shootArrow(m); }
                } else if (m.type === 'creeper') {
                    if (dist < 3 && dy < 2) { m.fuse += dt; wx = 0; wz = 0; }
                    else m.fuse = Math.max(0, m.fuse - dt);
                    if (m.fuse > 1.5) {
                        this._explode(m.x, m.y + 0.8, m.z);
                        this._removeMob(i);
                        continue;
                    }
                }

                m.kt -= dt;
                if (m.kt > 0) { m.vx = m.kx; m.vz = m.kz; }
                else { m.vx = wx * sp; m.vz = wz * sp; }
                const blocked = this._moveBody(m, dt, m.r, m.h);
                if (blocked && m.onGround && (wx || wz)) m.vy = 7.5;

                m.hurt = Math.max(0, m.hurt - dt);
                if (m.type === 'creeper' && m.fuse > 0) {
                    this._flashMob(m, Math.floor(m.fuse * 8) % 2 === 0 ? 0xffffff : 0x000000);
                    m.g.scale.setScalar(1 + m.fuse * 0.15);
                } else {
                    this._flashMob(m, m.hurt > 0 ? 0x881111 : 0x000000);
                }

                const swing = (wx || wz) ? Math.sin(performance.now() / 120) * 0.6 : 0;
                m.legs.forEach((l, k) => { l.rotation.x = swing * (k % 2 ? 1 : -1); });
                m.g.position.set(m.x, m.y, m.z);
                m.g.rotation.y = m.yaw;
            }
        },

        _explode(x, y, z) {
            const R = 3;
            const cx = Math.round(x), cy = Math.round(y), cz = Math.round(z);
            const removed = [];
            let fx = 0;
            for (let dx = -R; dx <= R; dx++) for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) {
                if (dx * dx + dy * dy + dz * dz > R * R + 1) continue;
                const bx = cx + dx, by = cy + dy, bz = cz + dz;
                const v = this.voxels.get(`${bx},${by},${bz}`);
                if (!v || v.type === 32 || FLUID[v.type]) continue;
                if (fx++ < 24) this._spawnBreakParticles(bx, by, bz, v.type);
                this._setBlock(bx, by, bz, 0);
                removed.push([bx, by, bz]);
            }
            removed.forEach(r => this._exposeNeighbors(r[0], r[1], r[2]));
            removed.forEach(r => this._flowFluid(r[0], r[1], r[2]));
            const p = this.player;
            const d = Math.hypot(p.x - x, p.y + 0.9 - y, p.z - z);
            if (d < 6) this._takeDamage(7 * (1 - d / 6), '(苦力怕爆炸)');
            this.targetBlock = null;
        },

        _tryAttack() {
            if (this.player.isDead || this.invOpen) return false;
            const d = new THREE.Vector3();
            this.cam.getWorldDirection(d);
            const o = this.cam.position;
            let best = -1, bestT = 99;
            this.mobs.forEach((m, i) => {
                const cx = m.x - o.x, cy = m.y + m.h / 2 - o.y, cz = m.z - o.z;
                const t = cx * d.x + cy * d.y + cz * d.z;
                if (t < 0 || t > 4) return;
                const perp2 = cx * cx + cy * cy + cz * cz - t * t;
                const rad = m.h / 2 + 0.15;
                if (perp2 > rad * rad) return;
                const tb = this.targetBlock;
                if (tb && Math.hypot(tb.x - o.x, tb.y - o.y, tb.z - o.z) < t - 0.8) return;
                if (t < bestT) { bestT = t; best = i; }
            });
            if (best < 0) return false;
            if (this.attackCd > 0) return true;
            this.attackCd = 0.45;

            const m = this.mobs[best];
            const held = this._heldDef();
            const tool = held && held.tool;
            const dmg = tool ? (tool.dmg || 1 + tool.tier) : 1;
            m.hp -= dmg;
            m.hurt = 0.3;
            const hd = Math.hypot(m.x - o.x, m.z - o.z) || 1;
            m.kx = (m.x - o.x) / hd * 6; m.kz = (m.z - o.z) / hd * 6; m.kt = 0.2; m.vy = 4;
            if (tool) {
                const slot = this.hotbar[this.selectedBlockIdx];
                slot.dur = (slot.dur || tool.dur) - 1;
                if (slot.dur <= 0) { slot.count = 0; this._toast(held.name + '损坏了！'); }
                this._updateHotbarCounts();
                this._renderInventory();
            }
            if (m.hp <= 0) this._killMob(best);
            return true;
        },

        _killMob(i) {
            const m = this.mobs[i];
            const n = 1 + Math.floor(Math.random() * 2);
            const dr = (id, c) => this._dropItem(id, c, m.x, m.y + 0.5, m.z);
            if (m.type === 'pig') dr(36, n);
            else if (m.type === 'zombie') { if (Math.random() < 0.7) dr(34, n); }
            else if (m.type === 'skeleton') { if (Math.random() < 0.8) dr(41, n); if (Math.random() < 0.6) dr(42, n); }
            else if (Math.random() < 0.7) dr(35, n);
            this._removeMob(i);
        },

        _updatePlayer(dt) {
            const p = this.player;
            const speed = 5.2 * (this._inWater ? 0.55 : 1);

            let mx = 0, mz = 0;
            if (this.keys['KeyW']) mz += 1;
            if (this.keys['KeyS']) mz -= 1;
            if (this.keys['KeyA']) mx -= 1;
            if (this.keys['KeyD']) mx += 1;

            if (Math.abs(this.touchMove.x) > 0.1 || Math.abs(this.touchMove.y) > 0.1) {
                mx += this.touchMove.x;
                mz -= this.touchMove.y;
            }

            const cos = Math.cos(p.yaw), sin = Math.sin(p.yaw);
            const fx = -sin * mz + cos * mx;
            const fz = -cos * mz - sin * mx;
            const len = Math.hypot(fx, fz);
            if (len > 0.01) {
                p.vx = (fx / Math.max(1, len)) * speed;
                p.vz = (fz / Math.max(1, len)) * speed;
                p.food = Math.max(0, p.food - 0.015 * dt);
            } else {
                p.vx *= 0.65; p.vz *= 0.65;
            }

            const feetFl = this._fluidAt(p.x, p.y + 0.3, p.z);
            const inWater = feetFl === 30 || this._fluidAt(p.x, p.y + 1.6, p.z) === 30;
            const inLava = feetFl === 31 || this._fluidAt(p.x, p.y + 0.9, p.z) === 31;
            this._inWater = inWater || inLava;

            if (inWater || inLava) {
                p.vy -= 8 * dt;
                p.vy = Math.max(p.vy, inLava ? -1.2 : -2.5);
                if (this.keys['Space']) p.vy = inLava ? 2.2 : 3.2;
                p.fallStartY = p.y;
                p.onGround = false;
            } else {
                p.vy = Math.max(-40, p.vy - 24 * dt);
                if (this.keys['Space'] && p.onGround) {
                    p.vy = 8.5;
                    p.onGround = false;
                    p.fallStartY = p.y;
                    p.food = Math.max(0, p.food - 0.02);
                }
            }
            if (inLava) {
                this.lavaTimer = (this.lavaTimer || 0) + dt;
                if (this.lavaTimer > 0.5) { this.lavaTimer = 0; this._takeDamage(1.5, '(岩浆)'); }
            }

            if (p.y > p.fallStartY) p.fallStartY = p.y;

            const nx = p.x + p.vx * dt;
            if (!this._collides(nx, p.y, p.z, false)) p.x = nx; else p.vx = 0;
            const nz = p.z + p.vz * dt;
            if (!this._collides(p.x, p.y, nz, false)) p.z = nz; else p.vz = 0;

            const totalDy = p.vy * dt;
            const steps = Math.max(1, Math.ceil(Math.abs(totalDy) / 0.4));
            const stepY = totalDy / steps;
            let landed = false;
            for (let i = 0; i < steps; i++) {
                const ny = p.y + stepY;
                if (stepY < 0) {
                    if (this._collides(p.x, ny, p.z, true)) {
                        if (!inWater && !inLava) {
                            const fallDist = p.fallStartY - ny;
                            if (fallDist > 3.5) {
                                const dmg = Math.round((fallDist - 3.5) * 1.5);
                                if (dmg > 0) this._takeDamage(dmg, '(高处摔落)');
                            }
                        }
                        p.y = Math.floor(ny + 0.5) + 0.5;
                        p.vy = 0;
                        landed = true;
                        break;
                    }
                    p.y = ny;
                } else {
                    if (this._collides(p.x, ny, p.z, false)) { p.vy = 0; break; }
                    p.y = ny;
                }
            }
            p.onGround = landed;
            if (landed) p.fallStartY = p.y;

            this.cactusTimer = Math.max(0, this.cactusTimer - dt);
            if (this.cactusTimer <= 0 && this._touchCactus(p)) { this.cactusTimer = 0.5; this._takeDamage(1, '(仙人掌)'); }

            if (p.y < -15) {
                this._takeDamage(10, '(掉入虚空)');
            }

            this.cam.position.set(p.x, p.y + 1.62, p.z);
            const cy = Math.cos(p.pitch), sy = Math.sin(p.pitch);
            const lookX = p.x - Math.sin(p.yaw) * cy;
            const lookY = p.y + 1.62 + sy;
            const lookZ = p.z - Math.cos(p.yaw) * cy;
            this.cam.lookAt(lookX, lookY, lookZ);
        },

        // 准心射线检测优化：仅检测当前玩家周围区块的可见网格，削减90%以上CPU开销
        _updateRaycast() {
            this.raycaster.setFromCamera({ x: 0, y: 0 }, this.cam);

            const curCx = Math.floor(this.player.x / CHUNK_SIZE);
            const curCz = Math.floor(this.player.z / CHUNK_SIZE);
            const nearbyMeshes = [];

            // 仅对当前及相邻 9 个区块检测射线
            for (let dx = -1; dx <= 1; dx++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const ch = this.chunks.get(`${curCx + dx},${curCz + dz}`);
                    if (ch) {
                        nearbyMeshes.push(...ch.visibleMeshes);
                    }
                }
            }

            const hits = this.raycaster.intersectObjects(nearbyMeshes, false);

            if (hits.length > 0) {
                const hit = hits[0];
                const ud = hit.object.userData;
                const normal = hit.face.normal;
                this.targetBlock = { x: ud.vx, y: ud.vy, z: ud.vz, normal };
                this.highlightBox.position.set(ud.vx, ud.vy, ud.vz);
                this.highlightBox.visible = true;
            } else {
                this.targetBlock = null;
                this.highlightBox.visible = false;
            }
        },

        _updateParticles(dt) {
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i];
                p.life -= dt;
                if (p.life <= 0) {
                    this.scene.remove(p.mesh);
                    this.particles.splice(i, 1);
                    continue;
                }
                p.vy -= 18 * dt;
                p.mesh.position.x += p.vx * dt;
                p.mesh.position.y += p.vy * dt;
                p.mesh.position.z += p.vz * dt;
                p.mesh.scale.setScalar(p.life / 0.5);
            }
        },

        _updateDayNight(dt) {
            this.dayTime += dt * 300;
            const angle = (this.dayTime / 24000) * Math.PI * 2;
            const sunY = Math.sin(angle);
            this._sunY = sunY;
            const sunX = Math.cos(angle);
            this.sunLight.position.set(sunX * 90, sunY * 90, 40);

            if (sunY > 0) {
                this.sunLight.intensity = Math.max(0.2, sunY * 1.3);
                this.scene.background.setRGB(0.47 * sunY + 0.05, 0.65 * sunY + 0.05, 0.95 * sunY + 0.1);
            } else {
                this.sunLight.intensity = 0.05;
                this.scene.background.setRGB(0.03, 0.04, 0.08);
            }
            // 夜空元素：夜里淡入星星与像素月，跟随玩家；云朵夜间变暗变稀
            const nightK = Math.max(0, Math.min(1, -sunY * 2));
            if (this.stars) {
                this.starMat.opacity = nightK * 0.95;
                this.moonMat.opacity = nightK;
                const px = this.player.x, pz = this.player.z;
                this.stars.position.set(px, 0, pz);
                this.stars.rotation.y = angle * 0.5; // 星空随时间缓慢旋转
                this.moon.position.set(px - sunX * 120, -sunY * 90 + 20, pz - 60);
                this.moon.visible = nightK > 0.02;
            }
            if (this.cloudMat) {
                this.cloudMat.opacity = 0.75 - nightK * 0.35;
                const ck = 1 - nightK * 0.65;
                this.cloudMat.color.setRGB(ck, ck, ck);
            }
        }
    };

    window.minecraft = MC;
    window.levelciv = MC;
})();
