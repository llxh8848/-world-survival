// 3D世界：地形生成、资源点分布、昼夜循环

class World {
    constructor(scene) {
        this.scene = scene;
        this.resources = []; // {mesh, type, health, maxHealth, drops, depleted, respawnTimer, chunkKey}
        this.buildings = [];
        this.campfires = []; // {position, light, range}
        this.dayCount = 1;
        this.currentHour = 8.0;
        this.dayDuration = 120; // 秒/天
        this.isNight = false;
        this._timeAccum = 0;

        // 世界类型：'normal' 或 'stone'
        this.worldType = 'normal';
        this.returnPosition = null;
        this._normalBuildings = null;
        this._normalCampfires = null;
        this._stoneBuildings = null;
        this._stoneCampfires = null;

        // 区块系统
        this.chunkSize = 80;
        this.renderRadius = 2; // 渲染半径（区块数）
        this.chunks = {}; // key "cx,cz" -> {mesh, cx, cz}
        this.spawnedResourceChunks = new Set(); // 已生成资源的区块

        this._initLights();
        this._initSky();
        this._generateInitial();
    }

    _initLights() {
        // 太阳光
        this.sun = new THREE.DirectionalLight(0xfff5e8, 3.2);
        this.sun.castShadow = true;
        this.sun.shadow.mapSize.set(2048, 2048);
        this.sun.shadow.camera.left = -90;
        this.sun.shadow.camera.right = 90;
        this.sun.shadow.camera.top = 90;
        this.sun.shadow.camera.bottom = -90;
        this.sun.shadow.camera.near = 0.5;
        this.sun.shadow.camera.far = 300;
        this.sun.shadow.bias = -0.0003;
        this.sun.shadow.normalBias = 0.02;
        this.sun.shadow.radius = 4;
        this.scene.add(this.sun);
        this.scene.add(this.sun.target);
        this.ambient = new THREE.AmbientLight(0x7080aa, 0.8);
        this.scene.add(this.ambient);

        // 半球光 - 天空蓝/地面绿
        this.hemi = new THREE.HemisphereLight(0x99bbff, 0x556633, 0.7);
        this.scene.add(this.hemi);

        // 全局水面（跟随玩家移动）
        const waterSize = (this.renderRadius * 2 + 2) * this.chunkSize;
        const waterGeo = new THREE.PlaneGeometry(waterSize, waterSize, 32, 32);
        waterGeo.rotateX(-Math.PI / 2);
        const waterMat = new THREE.MeshStandardMaterial({
            color: 0x2a7aaa,
            transparent: true,
            opacity: 0.75,
            roughness: 0.08,
            metalness: 0.45,
            envMapIntensity: 2.0,
        });
        this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
        this.waterMesh.position.set(0, -0.8, 0);
        this.waterMesh.receiveShadow = true;
        this.scene.add(this.waterMesh);
    }

    _initSky() {
        this.scene.background = new THREE.Color(0x87b8eb);
        this.scene.fog = new THREE.Fog(0x87b8eb, 70, 180);
    }

    _noise(x, z) {
        if (this.worldType === 'stone') {
            // 石头世界：平坦地形，微小起伏
            return Math.sin(x * 0.1) * Math.cos(z * 0.1) * 0.3;
        }
        if (this.worldType === 'gold') {
            // 金维度：平坦金色平原
            return Math.sin(x * 0.08) * Math.cos(z * 0.08) * 0.5 + Math.sin(x * 0.2) * 0.15;
        }
        // 简单多频率噪声生成地形高度
        let h = 0;
        h += Math.sin(x * 0.05) * Math.cos(z * 0.05) * 2.0;
        h += Math.sin(x * 0.12 + 1.3) * Math.cos(z * 0.11 + 0.7) * 1.0;
        h += Math.sin(x * 0.3) * Math.cos(z * 0.25) * 0.3;
        return h;
    }

    // 河流：基于低频噪声，值接近0的地方是河道
    _riverNoise(x, z) {
        const r = Math.sin(x * 0.02) * Math.cos(z * 0.018) + Math.sin(x * 0.035 + 2.1) * Math.cos(z * 0.03 + 1.3) * 0.5;
        return Math.abs(r);
    }

    isRiver(x, z) {
        if (this.worldType === 'stone') return false;
        if (this.worldType === 'gold') return false;
        return this._riverNoise(x, z) < 0.15;
    }

    // 群系判定：基于区块坐标，23.5%概率为沙漠群系
    isDesertBiome(cx, cz) {
        if (this.worldType !== 'normal') return false;
        const seed = (cx * 73856093) ^ (cz * 19349663);
        const rng = this._seededRandom(seed);
        return rng() < 0.235;
    }

    getHeight(x, z) {
        if (this.worldType === 'stone') {
            return this._noise(x, z);
        }
        if (this.worldType === 'gold') {
            return this._noise(x, z);
        }
        let h = this._noise(x, z);
        const riverVal = this._riverNoise(x, z);
        if (riverVal < 0.08) {
            h = -1.5;
        } else if (riverVal < 0.15) {
            const t = (0.15 - riverVal) / 0.07;
            h = h * (1 - t) + (-1.5) * t;
        }
        return h;
    }

    _generateInitial() {
        // 初始加载原点附近的区块
        this.updateChunks(new THREE.Vector3(0, 0, 0));
    }

    _chunkKey(cx, cz) { return cx + ',' + cz; }

    _createChunk(cx, cz) {
        const size = this.chunkSize;
        const segs = 48;
        const offsetX = cx * size;
        const offsetZ = cz * size;
        const geo = new THREE.PlaneGeometry(size, size, segs, segs);
        geo.rotateX(-Math.PI / 2);

        const isDesert = this.isDesertBiome(cx, cz);
        const pos = geo.attributes.position;
        const colors = [];
        let hasRiver = false;
        for (let i = 0; i < pos.count; i++) {
            const wx = offsetX + pos.getX(i);
            const wz = offsetZ + pos.getZ(i);
            const h = this.getHeight(wx, wz);
            pos.setY(i, h);
            let r, g, b;
            const river = this._riverNoise(wx, wz);
            const t = Math.max(0, Math.min(1, (h + 1) / 3));
            if (isDesert && this.worldType === 'normal') {
                // 沙漠群系：沙黄色调
                if (river < 0.15) {
                    // 沙漠中的河岸：深沙色
                    r = 0.82; g = 0.72; b = 0.48;
                } else if (h < -0.5) {
                    r = 0.76; g = 0.66; b = 0.42;
                } else if (h < 0.5) {
                    r = 0.86 + t * 0.04;
                    g = 0.76 + t * 0.04;
                    b = 0.52 + t * 0.03;
                } else if (h < 1.5) {
                    r = 0.88 + t * 0.03;
                    g = 0.78 + t * 0.03;
                    b = 0.54 + t * 0.02;
                } else {
                    r = 0.90 + t * 0.02;
                    g = 0.80 + t * 0.02;
                    b = 0.56 + t * 0.02;
                }
            } else if (river < 0.15) {
                // 河岸沙地
                r = 0.76; g = 0.70; b = 0.50;
            } else if (h < -0.5) {
                r = 0.20; g = 0.35; b = 0.25;
            } else if (h < 0.5) {
                r = 0.30 + t * 0.12;
                g = 0.50 + t * 0.18;
                b = 0.18 + t * 0.08;
            } else if (h < 1.5) {
                r = 0.35 + t * 0.10;
                g = 0.55 + t * 0.15;
                b = 0.20 + t * 0.06;
            } else {
                r = 0.45 + t * 0.08;
                g = 0.50 + t * 0.10;
                b = 0.30 + t * 0.05;
            }
            // 石头世界用灰色调
            if (this.worldType === 'stone') {
                if (h < -1.0) {
                    r = 0.15; g = 0.25; b = 0.20;
                } else if (h < -0.3) {
                    r = 0.20; g = 0.35; b = 0.25;
                } else {
                    const v = 0.3 + (h + 0.3) * 0.1;
                    r = v; g = v; b = v * 0.95;
                }
            }
            // 金维度用金色调
            if (this.worldType === 'gold') {
                r = 0.85 + t * 0.05;
                g = 0.65 + t * 0.08;
                b = 0.15 + t * 0.05;
            }
            colors.push(r, g, b);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.85,
            metalness: 0.02,
            flatShading: false,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(offsetX, 0, offsetZ);
        mesh.receiveShadow = true;
        mesh.castShadow = false;
        this.scene.add(mesh);

        const key = this._chunkKey(cx, cz);
        this.chunks[key] = { mesh, cx, cz };

        // 在新区块生成资源（只生成一次）
        if (!this.spawnedResourceChunks.has(key)) {
            this.spawnedResourceChunks.add(key);
            this._spawnResourcesInChunk(cx, cz);
        }
    }

    _removeChunk(key) {
        const chunk = this.chunks[key];
        if (!chunk) return;
        this.scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
        chunk.mesh.material.dispose();
        delete this.chunks[key];
    }

    _spawnResourcesInChunk(cx, cz) {
        const size = this.chunkSize;
        const offsetX = cx * size;
        const offsetZ = cz * size;

        // 用区块坐标做随机种子，保证同一区块资源位置一致
        const seed = (cx * 73856093) ^ (cz * 19349663);
        const rng = this._seededRandom(seed);

        if (this.worldType === 'stone') {
            // 石头世界：生成大量石头节点
            const stoneCount = 6 + Math.floor(rng() * 7);
            for (let i = 0; i < stoneCount; i++) {
                const x = offsetX + (rng() - 0.5) * (size - 2);
                const z = offsetZ + (rng() - 0.5) * (size - 2);
                const y = this.getHeight(x, z);
                // 2.7%概率生成金矿，否则生成普通石头
                if (rng() < 0.027) {
                    this._spawnGoldOre(new THREE.Vector3(x, y, z));
                } else {
                    this._spawnStoneNode(new THREE.Vector3(x, y, z));
                }
            }
            // 3.72%概率生成石神殿
            if (rng() < 0.0372) {
                const tx = offsetX + (rng() - 0.5) * (size - 8);
                const tz = offsetZ + (rng() - 0.5) * (size - 8);
                const ty = this.getHeight(tx, tz);
                this._spawnStoneTemple(new THREE.Vector3(tx, ty, tz));
            }
            return;
        }

        if (this.worldType === 'gold') {
            // 金维度：生成金平矿点和金矿点
            const nodeCount = 4 + Math.floor(rng() * 5);
            for (let i = 0; i < nodeCount; i++) {
                const x = offsetX + (rng() - 0.5) * (size - 2);
                const z = offsetZ + (rng() - 0.5) * (size - 2);
                const y = this.getHeight(x, z);
                // 30%概率生成金平矿，70%生成金矿
                if (rng() < 0.3) {
                    this._spawnGoldCoinNode(new THREE.Vector3(x, y, z));
                } else {
                    this._spawnGoldOre(new THREE.Vector3(x, y, z));
                }
            }
            return;
        }

        // 沙漠群系：生成仙人掌代替树木
        const isDesert = this.isDesertBiome(cx, cz);
        if (isDesert) {
            // 仙人掌：每个区块2-4个（不在河流生成）
            const cactusCount = 2 + Math.floor(rng() * 3);
            for (let i = 0; i < cactusCount; i++) {
                const x = offsetX + (rng() - 0.5) * (size - 2);
                const z = offsetZ + (rng() - 0.5) * (size - 2);
                const y = this.getHeight(x, z);
                if (y < 0) continue;
                this._spawnCactus(new THREE.Vector3(x, y, z));
            }
        } else {
            // 树木：每个区块2-4棵（不在河流及河岸生成）
            const treeCount = 2 + Math.floor(rng() * 3);
            for (let i = 0; i < treeCount; i++) {
                const x = offsetX + (rng() - 0.5) * (size - 2);
                const z = offsetZ + (rng() - 0.5) * (size - 2);
                const y = this.getHeight(x, z);
                if (y < 0) continue; // 河流区域不生成树
                this._spawnTree(new THREE.Vector3(x, y, z));
            }
        }

        // 浆果丛：每个区块0-2个（不在河流及河岸生成）
        const berryCount = Math.floor(rng() * 3);
        for (let i = 0; i < berryCount; i++) {
            const x = offsetX + (rng() - 0.5) * (size - 2);
            const z = offsetZ + (rng() - 0.5) * (size - 2);
            const y = this.getHeight(x, z);
            if (y < 0) continue; // 河流区域不生成浆果
            this._spawnBerry(new THREE.Vector3(x, y, z));
        }

        // 海带：在河流区域生成1-3个
        const kelpCount = 1 + Math.floor(rng() * 3);
        for (let i = 0; i < kelpCount; i++) {
            const x = offsetX + (rng() - 0.5) * (size - 2);
            const z = offsetZ + (rng() - 0.5) * (size - 2);
            if (this._riverNoise(x, z) < 0.08) {
                this._spawnKelp(new THREE.Vector3(x, -1.0, z));
            }
        }

        // 假树：5.2%概率生成（主世界）
        if (rng() < 0.052) {
            const fx = offsetX + (rng() - 0.5) * (size - 2);
            const fz = offsetZ + (rng() - 0.5) * (size - 2);
            const fy = this.getHeight(fx, fz);
            if (fy >= 0 && window.game && window.game.enemies) {
                window.game.enemies._spawnFakeTree(fx, fy, fz);
            }
        }

        // 河中宝箱：37.81%概率生成
        if (rng() < 0.3781) {
            const x = offsetX + (rng() - 0.5) * (size - 2);
            const z = offsetZ + (rng() - 0.5) * (size - 2);
            if (this._riverNoise(x, z) < 0.08) {
                this._spawnRiverChest(new THREE.Vector3(x, -0.8, z));
            }
        }
    }

    _seededRandom(seed) {
        let s = seed >>> 0;
        return function() {
            s = (s * 1664525 + 1013904223) >>> 0;
            return s / 4294967296;
        };
    }

    updateChunks(playerPos) {
        this._playerPos = playerPos;
        // 水面跟随玩家（石头世界和金维度隐藏水面）
        if (this.worldType === 'stone' || this.worldType === 'gold') {
            this.waterMesh.visible = false;
        } else {
            this.waterMesh.visible = true;
            this.waterMesh.position.set(playerPos.x, -0.8, playerPos.z);
        }
        const pcx = Math.floor(playerPos.x / this.chunkSize);
        const pcz = Math.floor(playerPos.z / this.chunkSize);
        const r = this.renderRadius;

        // 加载附近区块
        const needed = new Set();
        for (let dx = -r; dx <= r; dx++) {
            for (let dz = -r; dz <= r; dz++) {
                const cx = pcx + dx;
                const cz = pcz + dz;
                const key = this._chunkKey(cx, cz);
                needed.add(key);
                if (!this.chunks[key]) {
                    this._createChunk(cx, cz);
                }
            }
        }

        // 卸载远处区块
        for (const key of Object.keys(this.chunks)) {
            if (!needed.has(key)) {
                this._removeChunk(key);
            }
        }

        // 卸载远处资源（超出渲染半径2倍）
        const unloadDist = (r + 2) * this.chunkSize;
        for (let i = this.resources.length - 1; i >= 0; i--) {
            const res = this.resources[i];
            const dx = res.mesh.position.x - playerPos.x;
            const dz = res.mesh.position.z - playerPos.z;
            if (Math.sqrt(dx * dx + dz * dz) > unloadDist) {
                this.scene.remove(res.mesh);
                this.resources.splice(i, 1);
            }
        }
    }

    _spawnTree(pos) {
        const group = new THREE.Group();
        group.position.copy(pos);

        // 树干 - 锥形圆柱，高分段，带纹理感
        const trunkGeo = new THREE.CylinderGeometry(0.22, 0.5, 4.5, 20, 4);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a35, roughness: 0.82, flatShading: false });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 2.25;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        group.add(trunk);

        // 树干纹理感 - 纵向凹槽用细圆柱模拟
        for (let i = 0; i < 3; i++) {
            const a = (i / 3) * Math.PI * 2;
            const grooveGeo = new THREE.CylinderGeometry(0.03, 0.04, 4, 6);
            const grooveMat = new THREE.MeshStandardMaterial({ color: 0x5a3a18, roughness: 0.9 });
            const groove = new THREE.Mesh(grooveGeo, grooveMat);
            groove.position.set(Math.cos(a) * 0.28, 2.25, Math.sin(a) * 0.28);
            group.add(groove);
        }

        // 树根突起 - 更大更自然
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 + Math.PI * 0.2;
            const rootGeo = new THREE.SphereGeometry(0.22, 10, 8);
            rootGeo.scale(1.8, 0.4, 0.9);
            const root = new THREE.Mesh(rootGeo, trunkMat);
            root.position.set(Math.cos(angle) * 0.4, 0.12, Math.sin(angle) * 0.4);
            root.rotation.y = angle;
            root.castShadow = true;
            group.add(root);
        }

        // 三根树枝 - 更自然的角度
        const branchMat = new THREE.MeshStandardMaterial({ color: 0x6a4825, roughness: 0.85 });
        const branchPositions = [
            { x: 0.45, y: 3.5, z: 0.2, rz: -0.7, rx: 0.2, len: 1.4, r1: 0.07, r2: 0.13 },
            { x: -0.4, y: 3.2, z: -0.15, rz: 0.6, rx: 0.3, len: 1.2, r1: 0.06, r2: 0.11 },
            { x: 0.1, y: 3.8, z: -0.35, rz: -0.3, rx: -0.5, len: 1.0, r1: 0.05, r2: 0.09 },
        ];
        for (const bp of branchPositions) {
            const bg = new THREE.CylinderGeometry(bp.r1, bp.r2, bp.len, 10);
            const branch = new THREE.Mesh(bg, branchMat);
            branch.position.set(bp.x, bp.y, bp.z);
            branch.rotation.z = bp.rz;
            branch.rotation.x = bp.rx;
            branch.castShadow = true;
            group.add(branch);
        }

        // 多层树冠 - 5个球体簇，不同色调
        const leafMats = [
            new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.7, flatShading: false }),
            new THREE.MeshStandardMaterial({ color: 0x356b2f, roughness: 0.65, flatShading: false }),
            new THREE.MeshStandardMaterial({ color: 0x1f4520, roughness: 0.72, flatShading: false }),
            new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 0.6, flatShading: false }),
        ];
        const leafData = [
            { r: 1.7, x: 0, y: 4.3, z: 0, sx: 1, sy: 0.85, sz: 1, mi: 0 },
            { r: 1.2, x: 0.6, y: 4.9, z: 0.3, sx: 1, sy: 1, sz: 1, mi: 1 },
            { r: 1.0, x: -0.5, y: 4.7, z: -0.3, sx: 1, sy: 0.9, sz: 1, mi: 2 },
            { r: 0.8, x: 0.2, y: 5.4, z: -0.1, sx: 1, sy: 1, sz: 1, mi: 3 },
            { r: 0.7, x: -0.3, y: 5.2, z: 0.4, sx: 1, sy: 0.95, sz: 1, mi: 1 },
        ];
        for (const ld of leafData) {
            const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(ld.r, 4), leafMats[ld.mi]);
            leaf.position.set(ld.x, ld.y, ld.z);
            leaf.scale.set(ld.sx, ld.sy, ld.sz);
            leaf.castShadow = true;
            group.add(leaf);
        }

        // 底部灌木层 - 2个
        const bush1 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 2), leafMats[2]);
        bush1.position.set(0.3, 3.2, 0.2);
        bush1.scale.set(1, 0.6, 1);
        bush1.castShadow = true;
        group.add(bush1);
        const bush2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 2), leafMats[0]);
        bush2.position.set(-0.4, 3.0, -0.1);
        bush2.scale.set(1, 0.5, 1);
        bush2.castShadow = true;
        group.add(bush2);

        this.scene.add(group);
        this.resources.push({
            mesh: group, type: 'wood', health: 10, maxHealth: 10,
            drops: { wood: 3 }, depleted: false, respawnTimer: 0,
            respawnTime: 60, group: 'tree', baseY: pos.y,
        });
    }

    _spawnStoneNode(pos) {
        const group = new THREE.Group();
        group.position.copy(pos);

        // 主体 - 高细分不规则岩石，更自然
        const geo = new THREE.DodecahedronGeometry(0.95, 3);
        const mat = new THREE.MeshStandardMaterial({ color: 0x7a7a7a, roughness: 0.88, flatShading: false, metalness: 0.05 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 0.7;
        mesh.scale.set(1.35, 1.0, 1.35);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        // 顶部尖石 - 2块
        const topGeo = new THREE.DodecahedronGeometry(0.38, 2);
        const topMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.82, flatShading: false });
        const topMesh = new THREE.Mesh(topGeo, topMat);
        topMesh.position.set(0.2, 1.35, 0.1);
        topMesh.castShadow = true;
        group.add(topMesh);
        const top2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 1), topMat);
        top2.position.set(-0.25, 1.2, -0.15);
        top2.castShadow = true;
        group.add(top2);

        // 小石头围绕（带苔藓色）- 6个
        for (let i = 0; i < 6; i++) {
            const r = 0.18 + Math.random() * 0.18;
            const smallGeo = new THREE.DodecahedronGeometry(r, 2);
            const isMoss = i % 3 === 0;
            const smallMat = new THREE.MeshStandardMaterial({
                color: isMoss ? 0x4a6a3a : 0x666666,
                roughness: isMoss ? 0.75 : 0.9,
                flatShading: false,
                emissive: isMoss ? 0x0a2200 : 0x000000,
                emissiveIntensity: isMoss ? 0.1 : 0,
            });
            const small = new THREE.Mesh(smallGeo, smallMat);
            const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.3;
            small.position.set(Math.cos(angle) * (0.85 + Math.random() * 0.4), 0.15 + Math.random() * 0.25, Math.sin(angle) * (0.85 + Math.random() * 0.4));
            small.castShadow = true;
            small.receiveShadow = true;
            group.add(small);
        }

        this.scene.add(group);
        this.resources.push({
            mesh: group, type: 'stone_node', health: 10, maxHealth: 10,
            drops: { stone: 5 }, depleted: false, respawnTimer: 0,
            respawnTime: 60, group: 'rock', baseY: pos.y,
        });
    }

    _spawnGoldOre(pos) {
        const group = new THREE.Group();
        group.position.copy(pos);

        // 主体 - 金灿灿的矿石，超高细分
        const geo = new THREE.DodecahedronGeometry(0.9, 3);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xffd700, roughness: 0.1, metalness: 0.98,
            emissive: 0xffaa00, emissiveIntensity: 0.4, flatShading: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 0.7;
        mesh.scale.set(1.25, 1.0, 1.25);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        // 金色小矿石围绕 - 6个，带发光
        for (let i = 0; i < 6; i++) {
            const r = 0.18 + Math.random() * 0.14;
            const smallGeo = new THREE.DodecahedronGeometry(r, 2);
            const smallMat = new THREE.MeshStandardMaterial({
                color: 0xffcc00, roughness: 0.06, metalness: 1.0,
                emissive: 0xff8800, emissiveIntensity: 0.5, flatShading: false
            });
            const small = new THREE.Mesh(smallGeo, smallMat);
            const angle = (i / 6) * Math.PI * 2;
            small.position.set(Math.cos(angle) * (0.75 + Math.random() * 0.25), 0.2 + Math.random() * 0.35, Math.sin(angle) * (0.75 + Math.random() * 0.25));
            small.castShadow = true;
            group.add(small);
        }

        // 顶部金尖晶 - 高细分
        const spikeGeo = new THREE.OctahedronGeometry(0.32, 1);
        const spikeMat = new THREE.MeshStandardMaterial({ color: 0xffee44, roughness: 0.03, metalness: 1.0, emissive: 0xffaa00, emissiveIntensity: 0.7 });
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        spike.position.set(0.1, 1.35, 0);
        spike.castShadow = true;
        group.add(spike);

        // 第二个小尖晶
        const spike2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 1), spikeMat);
        spike2.position.set(-0.25, 1.15, 0.15);
        group.add(spike2);

        // 金色光源 - 更强
        const light = new THREE.PointLight(0xffd700, 2, 6, 2);
        light.position.y = 0.8;
        group.add(light);

        this.scene.add(group);
        this.resources.push({
            mesh: group, type: 'gold_ore', health: 15, maxHealth: 15,
            drops: { gold_ore: 3 }, depleted: false, respawnTimer: 0,
            respawnTime: 90, group: 'rock', baseY: pos.y,
        });
    }

    _spawnGoldCoinNode(pos) {
        const group = new THREE.Group();
        group.position.copy(pos);

        // 主体 - 闪亮的金平矿
        const geo = new THREE.DodecahedronGeometry(0.85, 3);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xffcc00, roughness: 0.05, metalness: 1.0,
            emissive: 0xffdd00, emissiveIntensity: 0.6, flatShading: false
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 0.65;
        mesh.scale.set(1.2, 0.9, 1.2);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        // 围绕的小金平石
        for (let i = 0; i < 5; i++) {
            const r = 0.15 + Math.random() * 0.12;
            const smallGeo = new THREE.DodecahedronGeometry(r, 2);
            const smallMat = new THREE.MeshStandardMaterial({
                color: 0xffdd44, roughness: 0.04, metalness: 1.0,
                emissive: 0xffcc00, emissiveIntensity: 0.6, flatShading: false
            });
            const small = new THREE.Mesh(smallGeo, smallMat);
            const angle = (i / 5) * Math.PI * 2;
            small.position.set(Math.cos(angle) * (0.7 + Math.random() * 0.2), 0.15 + Math.random() * 0.3, Math.sin(angle) * (0.7 + Math.random() * 0.2));
            small.castShadow = true;
            group.add(small);
        }

        // 顶部尖晶
        const spikeGeo = new THREE.OctahedronGeometry(0.28, 1);
        const spikeMat = new THREE.MeshStandardMaterial({ color: 0xffff66, roughness: 0.02, metalness: 1.0, emissive: 0xffdd00, emissiveIntensity: 0.8 });
        const spike = new THREE.Mesh(spikeGeo, spikeMat);
        spike.position.set(0, 1.25, 0);
        spike.castShadow = true;
        group.add(spike);

        // 光源
        const light = new THREE.PointLight(0xffdd00, 2.5, 7, 2);
        light.position.y = 0.8;
        group.add(light);

        this.scene.add(group);
        this.resources.push({
            mesh: group, type: 'gold_coin_ore', health: 20, maxHealth: 20,
            drops: { gold_coin: 2 }, depleted: false, respawnTimer: 0,
            respawnTime: 120, group: 'rock', baseY: pos.y,
        });
    }

    _spawnRock(pos) {
        const group = new THREE.Group();
        group.position.copy(pos);

        // 主体 - 超高细分
        const geo = new THREE.DodecahedronGeometry(0.85, 3);
        const mat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.85, flatShading: false, metalness: 0.05 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 0.6;
        mesh.scale.set(1.25, 0.9, 1.25);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        // 旁边小碎石 - 3个
        for (let i = 0; i < 3; i++) {
            const smGeo = new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.1, 2);
            const smMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.88, flatShading: false });
            const sm = new THREE.Mesh(smGeo, smMat);
            sm.position.set(0.55 + i * 0.3, 0.15 + Math.random() * 0.15, -0.3 + i * 0.4);
            sm.castShadow = true;
            sm.receiveShadow = true;
            group.add(sm);
        }

        this.scene.add(group);
        this.resources.push({
            mesh: group, type: 'stone', health: 40, maxHealth: 40,
            drops: { stone: 2 }, depleted: false, respawnTimer: 0,
            respawnTime: 60, group: 'rock', baseY: pos.y,
        });
    }

    _spawnIron(pos) {
        const group = new THREE.Group();
        group.position.copy(pos);

        // 主体 - 超高细分铁矿
        const geo = new THREE.DodecahedronGeometry(0.65, 3);
        const mat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.6, metalness: 0.4, flatShading: false });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.y = 0.5;
        mesh.scale.set(1.15, 0.85, 1.15);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);

        // 铁矿结晶体 - 2个
        const crystalGeo = new THREE.OctahedronGeometry(0.22, 1);
        const crystalMat = new THREE.MeshStandardMaterial({ color: 0x9a8a7a, roughness: 0.25, metalness: 0.75, emissive: 0x332211, emissiveIntensity: 0.25 });
        const crystal = new THREE.Mesh(crystalGeo, crystalMat);
        crystal.position.set(0.2, 0.9, 0.1);
        crystal.castShadow = true;
        group.add(crystal);
        const crystal2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 1), crystalMat);
        crystal2.position.set(-0.15, 0.8, -0.2);
        group.add(crystal2);

        // 小碎矿 - 3个
        for (let i = 0; i < 3; i++) {
            const smGeo = new THREE.DodecahedronGeometry(0.16 + Math.random() * 0.06, 1);
            const sm = new THREE.Mesh(smGeo, mat);
            sm.position.set(-0.4 + i * 0.4, 0.1 + Math.random() * 0.15, 0.3 - i * 0.35);
            sm.castShadow = true;
            group.add(sm);
        }

        this.scene.add(group);
        this.resources.push({
            mesh: group, type: 'iron', health: 50, maxHealth: 50,
            drops: { iron_ore: 1, stone: 1 }, depleted: false, respawnTimer: 0,
            respawnTime: 90, group: 'rock', baseY: pos.y,
        });
    }

    _spawnBerry(pos) {
        const group = new THREE.Group();
        group.position.copy(pos);

        // 灌木丛主体 - 多个球体堆叠，更自然
        const bushMats = [
            new THREE.MeshStandardMaterial({ color: 0x2a4a1a, roughness: 0.82, flatShading: false }),
            new THREE.MeshStandardMaterial({ color: 0x356a25, roughness: 0.78, flatShading: false }),
            new THREE.MeshStandardMaterial({ color: 0x1f3a15, roughness: 0.85, flatShading: false }),
        ];
        const bush1 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 16), bushMats[0]);
        bush1.position.y = 0.4;
        bush1.castShadow = true;
        bush1.receiveShadow = true;
        group.add(bush1);
        const bush2 = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 14), bushMats[1]);
        bush2.position.set(0.3, 0.55, 0.15);
        bush2.castShadow = true;
        group.add(bush2);
        const bush3 = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), bushMats[2]);
        bush3.position.set(-0.28, 0.5, -0.22);
        bush3.castShadow = true;
        group.add(bush3);
        const bush4 = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 10), bushMats[1]);
        bush4.position.set(0.1, 0.75, -0.1);
        bush4.castShadow = true;
        group.add(bush4);

        // 浆果 - 10颗，更精致
        const berryColors = [0x6611aa, 0x8822cc, 0xaa33ee, 0xbb44ff];
        for (let i = 0; i < 10; i++) {
            const berryGeo = new THREE.SphereGeometry(0.1, 14, 12);
            const berryMat = new THREE.MeshStandardMaterial({
                color: berryColors[i % 4], roughness: 0.35,
                emissive: 0x220044, emissiveIntensity: 0.3,
                metalness: 0.1,
            });
            const berry = new THREE.Mesh(berryGeo, berryMat);
            const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.3;
            const r = 0.25 + Math.random() * 0.25;
            berry.position.set(Math.cos(angle) * r, 0.3 + Math.random() * 0.5, Math.sin(angle) * r);
            berry.castShadow = true;
            group.add(berry);
        }

        this.scene.add(group);
        this.resources.push({
            mesh: group, type: 'berry', health: 15, maxHealth: 15,
            drops: { berry: 2 }, depleted: false, respawnTimer: 0,
            respawnTime: 30, group: 'berry', baseY: pos.y,
        });
    }

    _spawnCactus(pos) {
        const group = new THREE.Group();
        group.position.copy(pos);

        // 主体 - 绿色柱状，3段
        const cactusMat = new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 0.7, flatShading: false });
        // 主干
        const trunkGeo = new THREE.CylinderGeometry(0.35, 0.4, 2.5, 12, 4);
        const trunk = new THREE.Mesh(trunkGeo, cactusMat);
        trunk.position.y = 1.25;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        group.add(trunk);
        // 棱线
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            const ridgeGeo = new THREE.CylinderGeometry(0.02, 0.02, 2.5, 4);
            const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x3a6a2a, roughness: 0.8 });
            const ridge = new THREE.Mesh(ridgeGeo, ridgeMat);
            ridge.position.set(Math.cos(a) * 0.38, 1.25, Math.sin(a) * 0.38);
            group.add(ridge);
        }
        // 左臂
        const armLGeo = new THREE.CylinderGeometry(0.22, 0.25, 1.2, 10, 3);
        const armL = new THREE.Mesh(armLGeo, cactusMat);
        armL.position.set(-0.45, 1.6, 0);
        armL.rotation.z = Math.PI / 3;
        armL.castShadow = true;
        group.add(armL);
        // 左臂上段
        const armL2Geo = new THREE.CylinderGeometry(0.2, 0.22, 0.8, 10, 3);
        const armL2 = new THREE.Mesh(armL2Geo, cactusMat);
        armL2.position.set(-0.85, 2.2, 0);
        armL2.castShadow = true;
        group.add(armL2);
        // 右臂
        const armRGeo = new THREE.CylinderGeometry(0.22, 0.25, 1.0, 10, 3);
        const armR = new THREE.Mesh(armRGeo, cactusMat);
        armR.position.set(0.5, 1.3, 0);
        armR.rotation.z = -Math.PI / 3;
        armR.castShadow = true;
        group.add(armR);
        // 右臂上段
        const armR2Geo = new THREE.CylinderGeometry(0.2, 0.22, 0.6, 10, 3);
        const armR2 = new THREE.Mesh(armR2Geo, cactusMat);
        armR2.position.set(0.85, 1.7, 0);
        armR2.castShadow = true;
        group.add(armR2);
        // 顶部小花（黄色）
        const flowerGeo = new THREE.SphereGeometry(0.12, 10, 8);
        const flowerMat = new THREE.MeshBasicMaterial({ color: 0xffdd44 });
        const flower = new THREE.Mesh(flowerGeo, flowerMat);
        flower.position.set(0, 2.55, 0);
        group.add(flower);
        // 刺 - 小圆锥
        const spikeMat = new THREE.MeshStandardMaterial({ color: 0xddddaa, roughness: 0.9 });
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            const spikeGeo = new THREE.ConeGeometry(0.03, 0.12, 4);
            const spike = new THREE.Mesh(spikeGeo, spikeMat);
            spike.position.set(Math.cos(a) * 0.4, 0.8 + Math.random() * 1.2, Math.sin(a) * 0.4);
            spike.rotation.y = a;
            spike.rotation.x = Math.PI / 2;
            group.add(spike);
        }

        this.scene.add(group);
        this.resources.push({
            mesh: group, type: 'cactus', health: 8, maxHealth: 8,
            drops: { cactus: 2 }, depleted: false, respawnTimer: 0,
            respawnTime: 45, group: 'cactus', baseY: pos.y,
        });
    }

    _spawnKelp(pos) {
        const group = new THREE.Group();
        group.position.copy(pos);

        // 海带茎 - 3段弯曲，更自然
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x2a7a3a, roughness: 0.7, flatShading: false });
        const stem1 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.9, 14), stemMat);
        stem1.position.y = 0.45;
        stem1.castShadow = true;
        group.add(stem1);
        const stem2 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.9, 14), stemMat);
        stem2.position.set(0.06, 1.2, 0.04);
        stem2.rotation.z = 0.1;
        stem2.castShadow = true;
        group.add(stem2);
        const stem3 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.7, 12), stemMat);
        stem3.position.set(0.12, 1.85, 0.08);
        stem3.rotation.z = 0.15;
        stem3.castShadow = true;
        group.add(stem3);

        // 海带叶 - 8片螺旋分布
        for (let i = 0; i < 8; i++) {
            const leafGeo = new THREE.SphereGeometry(0.16, 14, 12);
            leafGeo.scale(1, 2.8, 1);
            const leafMat = new THREE.MeshStandardMaterial({ color: i % 2 === 0 ? 0x3a9a4a : 0x2a8a3a, roughness: 0.6, flatShading: false });
            const leaf = new THREE.Mesh(leafGeo, leafMat);
            const angle = (i / 8) * Math.PI * 2;
            const yOff = 0.4 + (i / 8) * 1.3;
            leaf.position.set(Math.cos(angle) * (0.12 + i * 0.025), yOff, Math.sin(angle) * (0.12 + i * 0.025));
            leaf.rotation.z = Math.cos(angle) * 0.35;
            leaf.rotation.x = Math.sin(angle) * 0.25;
            leaf.castShadow = true;
            group.add(leaf);
        }

        // 顶部尖 - 高分段
        const topGeo = new THREE.ConeGeometry(0.1, 0.45, 12);
        const topMat = new THREE.MeshStandardMaterial({ color: 0x4aaa5a, roughness: 0.65 });
        const top = new THREE.Mesh(topGeo, topMat);
        top.position.set(0.15, 2.3, 0.1);
        top.rotation.z = 0.15;
        group.add(top);

        this.scene.add(group);
        this.resources.push({
            mesh: group, type: 'kelp', health: 1, maxHealth: 1,
            drops: { kelp: 1 }, depleted: false, respawnTimer: 0,
            respawnTime: 40, group: 'kelp', baseY: pos.y,
        });
    }

    _spawnRiverChest(pos) {
        const group = new THREE.Group();
        group.position.copy(pos);

        // 箱子主体 - 带金属包边，更精致
        const boxGeo = new THREE.BoxGeometry(0.85, 0.55, 0.65);
        const boxMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.75, metalness: 0.25, flatShading: false });
        const box = new THREE.Mesh(boxGeo, boxMat);
        box.position.y = 0.28;
        box.castShadow = true;
        box.receiveShadow = true;
        group.add(box);

        // 金属包边 - 3道
        const bandMat = new THREE.MeshStandardMaterial({ color: 0xc89a5a, roughness: 0.35, metalness: 0.7 });
        const band1Geo = new THREE.BoxGeometry(0.87, 0.07, 0.67);
        const band1 = new THREE.Mesh(band1Geo, bandMat);
        band1.position.y = 0.15;
        band1.castShadow = true;
        group.add(band1);
        const band2 = new THREE.Mesh(band1Geo, bandMat);
        band2.position.y = 0.42;
        band2.castShadow = true;
        group.add(band2);
        // 纵向包边
        const bandVGeo = new THREE.BoxGeometry(0.07, 0.55, 0.67);
        const bandVL = new THREE.Mesh(bandVGeo, bandMat);
        bandVL.position.set(-0.39, 0.28, 0);
        group.add(bandVL);
        const bandVR = new THREE.Mesh(bandVGeo, bandMat);
        bandVR.position.set(0.39, 0.28, 0);
        group.add(bandVR);

        // 箱盖 - 弧形顶
        const lidGeo = new THREE.BoxGeometry(0.87, 0.22, 0.67);
        const lidMat = new THREE.MeshStandardMaterial({ color: 0x6b4910, roughness: 0.75, metalness: 0.25 });
        const lid = new THREE.Mesh(lidGeo, lidMat);
        lid.position.y = 0.65;
        lid.castShadow = true;
        group.add(lid);
        // 盖顶装饰条
        const lidTrimGeo = new THREE.BoxGeometry(0.89, 0.06, 0.69);
        const lidTrim = new THREE.Mesh(lidTrimGeo, bandMat);
        lidTrim.position.y = 0.77;
        group.add(lidTrim);

        // 金属锁 - 更精致
        const lockBaseGeo = new THREE.BoxGeometry(0.16, 0.16, 0.06);
        const lockMat = new THREE.MeshStandardMaterial({ color: 0xddaa00, roughness: 0.25, metalness: 0.85 });
        const lock = new THREE.Mesh(lockBaseGeo, lockMat);
        lock.position.set(0, 0.55, 0.34);
        lock.castShadow = true;
        group.add(lock);
        // 锁孔
        const keyholeGeo = new THREE.CircleGeometry(0.035, 10);
        const keyholeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const keyhole = new THREE.Mesh(keyholeGeo, keyholeMat);
        keyhole.position.set(0, 0.55, 0.38);
        group.add(keyhole);

        // 随机生成掉落物
        const possibleDrops = [
            { id: 'iron_ingot', min: 1, max: 3 },
            { id: 'wood', min: 3, max: 10 },
            { id: 'stone', min: 3, max: 8 },
            { id: 'willow', min: 1, max: 5 },
            { id: 'berry', min: 2, max: 6 },
            { id: 'meat_cooked', min: 1, max: 3 },
            { id: 'apple', min: 1, max: 2 },
            { id: 'kelp_crispy', min: 1, max: 3 },
            { id: 'rare_wood', min: 1, max: 2 },
        ];
        // 随机选2-4种物品
        const numDrops = 2 + Math.floor(Math.random() * 3);
        const drops = {};
        const shuffled = [...possibleDrops].sort(() => Math.random() - 0.5);
        for (let i = 0; i < numDrops && i < shuffled.length; i++) {
            const d = shuffled[i];
            drops[d.id] = d.min + Math.floor(Math.random() * (d.max - d.min + 1));
        }

        this.scene.add(group);
        this.resources.push({
            mesh: group, type: 'river_chest', health: 1, maxHealth: 1,
            drops: drops, depleted: false, respawnTimer: 0,
            respawnTime: 9999, group: 'river_chest', baseY: pos.y,
        });
    }

    // 石头世界：石神殿（9.72%概率生成）
    _spawnStoneTemple(pos) {
        const group = new THREE.Group();
        group.position.copy(pos);

        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.8, flatShading: false, metalness: 0.1 });
        const darkStoneMat = new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.8, flatShading: false, metalness: 0.1 });
        const accentMat = new THREE.MeshStandardMaterial({ color: 0x8a8e94, roughness: 0.6, metalness: 0.2, flatShading: false });

        // 底座平台 6x6 - 双层
        const baseGeo = new THREE.BoxGeometry(6, 0.4, 6);
        const base = new THREE.Mesh(baseGeo, darkStoneMat);
        base.position.y = 0.2;
        base.castShadow = true;
        base.receiveShadow = true;
        group.add(base);
        // 底座装饰边
        const baseTrimGeo = new THREE.BoxGeometry(6.1, 0.08, 6.1);
        const baseTrim = new THREE.Mesh(baseTrimGeo, accentMat);
        baseTrim.position.y = 0.42;
        group.add(baseTrim);

        // 四角石柱 - 带柱基和柱头
        const pillarGeo = new THREE.BoxGeometry(0.6, 4, 0.6);
        for (const [px, pz] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) {
            const pillar = new THREE.Mesh(pillarGeo, stoneMat);
            pillar.position.set(px, 2.2, pz);
            pillar.castShadow = true;
            pillar.receiveShadow = true;
            group.add(pillar);
            // 柱基
            const pillarBaseGeo = new THREE.BoxGeometry(0.75, 0.15, 0.75);
            const pb = new THREE.Mesh(pillarBaseGeo, accentMat);
            pb.position.set(px, 0.5, pz);
            group.add(pb);
            // 柱头
            const pillarCapGeo = new THREE.BoxGeometry(0.75, 0.15, 0.75);
            const pc = new THREE.Mesh(pillarCapGeo, accentMat);
            pc.position.set(px, 4.3, pz);
            group.add(pc);
        }

        // 顶部石板
        const topGeo = new THREE.BoxGeometry(6, 0.3, 6);
        const top = new THREE.Mesh(topGeo, stoneMat);
        top.position.y = 4.5;
        top.castShadow = true;
        top.receiveShadow = true;
        group.add(top);

        // 顶部装饰尖塔 - 带基座
        const spireBaseGeo = new THREE.BoxGeometry(0.5, 0.15, 0.5);
        const spireGeo = new THREE.ConeGeometry(0.4, 1.4, 6);
        for (const [px, pz] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) {
            const sb = new THREE.Mesh(spireBaseGeo, accentMat);
            sb.position.set(px, 4.72, pz);
            group.add(sb);
            const spire = new THREE.Mesh(spireGeo, darkStoneMat);
            spire.position.set(px, 5.5, pz);
            spire.castShadow = true;
            group.add(spire);
        }

        // 入口拱门（正面）
        const archGeo = new THREE.BoxGeometry(2, 0.3, 0.3);
        const arch = new THREE.Mesh(archGeo, stoneMat);
        arch.position.set(0, 3.0, 3.0);
        arch.castShadow = true;
        group.add(arch);
        // 拱门装饰
        const archDecoGeo = new THREE.BoxGeometry(2.1, 0.08, 0.35);
        const archDeco = new THREE.Mesh(archDecoGeo, accentMat);
        archDeco.position.set(0, 3.15, 3.0);
        group.add(archDeco);

            // 中央发光石晶 - 超高细分
            const crystalGeo = new THREE.OctahedronGeometry(0.45, 2);
            const crystalMat = new THREE.MeshStandardMaterial({
                color: 0x9a9ea4, roughness: 0.15, metalness: 0.5,
                emissive: 0x6a6e74, emissiveIntensity: 0.9, flatShading: false
            });
        const crystal = new THREE.Mesh(crystalGeo, crystalMat);
        crystal.position.y = 4.9;
        crystal.castShadow = true;
        group.add(crystal);
        // 水晶基座
        const crystalBaseGeo = new THREE.CylinderGeometry(0.3, 0.4, 0.15, 8);
        const crystalBase = new THREE.Mesh(crystalBaseGeo, accentMat);
        crystalBase.position.y = 4.65;
        group.add(crystalBase);

        // 光源 - 更强
        const light = new THREE.PointLight(0x8a8e94, 2.5, 14, 2);
        light.position.y = 4.9;
        group.add(light);

        this.scene.add(group);
        this.resources.push({
            mesh: group, type: 'stone_temple', health: Infinity, maxHealth: Infinity,
            depleted: false, group: 'stone_temple', baseY: pos.y,
        });

        // 生成石守卫（2-3个）
        if (window.game && window.game.enemies) {
            const guardianCount = 2 + Math.floor(Math.random() * 2);
            for (let i = 0; i < guardianCount; i++) {
                const angle = (i / guardianCount) * Math.PI * 2;
                const gx = pos.x + Math.cos(angle) * 2;
                const gz = pos.z + Math.sin(angle) * 2;
                const gy = this.getHeight(gx, gz);
                window.game.enemies._spawnStoneGuardian(gx, gy, gz);
            }
        }

        // 生成箱子（神殿中央）
        const chestPos = new THREE.Vector3(pos.x, pos.y + 0.4, pos.z);
        this._spawnTempleChest(chestPos);
    }

    // 石神殿箱子：固定掉落 苹果2-9, 石头1-6, 超级石头0-4
    _spawnTempleChest(pos) {
        const group = new THREE.Group();
        group.position.copy(pos);

        const boxGeo = new THREE.BoxGeometry(0.9, 0.6, 0.7);
        const boxMat = new THREE.MeshStandardMaterial({ color: 0x5a5e64, roughness: 0.75, metalness: 0.35, flatShading: false });
        const box = new THREE.Mesh(boxGeo, boxMat);
        box.position.y = 0.3;
        box.castShadow = true;
        box.receiveShadow = true;
        group.add(box);

        const lidGeo = new THREE.BoxGeometry(0.92, 0.22, 0.72);
        const lidMat = new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.75, metalness: 0.35 });
        const lid = new THREE.Mesh(lidGeo, lidMat);
        lid.position.y = 0.7;
        lid.castShadow = true;
        group.add(lid);
        // 盖顶装饰
        const lidTrimGeo = new THREE.BoxGeometry(0.94, 0.06, 0.74);
        const lidTrimMat = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.6, metalness: 0.4 });
        const lidTrim = new THREE.Mesh(lidTrimGeo, lidTrimMat);
        lidTrim.position.y = 0.82;
        group.add(lidTrim);

        // 发光锁 - 更精致
        const lockGeo = new THREE.BoxGeometry(0.2, 0.2, 0.07);
        const lockMat = new THREE.MeshStandardMaterial({
            color: 0xddaa00, roughness: 0.2, metalness: 0.9,
            emissive: 0x665500, emissiveIntensity: 0.6
        });
        const lock = new THREE.Mesh(lockGeo, lockMat);
        lock.position.set(0, 0.55, 0.37);
        lock.castShadow = true;
        group.add(lock);
        // 锁孔
        const lockHoleGeo = new THREE.CircleGeometry(0.035, 10);
        const lockHoleMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const lockHole = new THREE.Mesh(lockHoleGeo, lockHoleMat);
        lockHole.position.set(0, 0.55, 0.41);
        group.add(lockHole);
        // 金属包边
        const tBandGeo = new THREE.BoxGeometry(0.94, 0.06, 0.74);
        const tBandMat = new THREE.MeshStandardMaterial({ color: 0x8a8e94, roughness: 0.4, metalness: 0.5 });
        const tBand1 = new THREE.Mesh(tBandGeo, tBandMat);
        tBand1.position.y = 0.15;
        group.add(tBand1);
        const tBand2 = new THREE.Mesh(tBandGeo, tBandMat);
        tBand2.position.y = 0.5;
        group.add(tBand2);

        // 固定掉落
        const drops = {
            apple: 2 + Math.floor(Math.random() * 8),
            stone: 1 + Math.floor(Math.random() * 6),
        };
        const superStoneRoll = Math.floor(Math.random() * 5);
        if (superStoneRoll > 0) {
            drops.super_stone = superStoneRoll;
        }

        this.scene.add(group);
        this.resources.push({
            mesh: group, type: 'temple_chest', health: 1, maxHealth: 1,
            drops: drops, depleted: false, respawnTimer: 0,
            respawnTime: 9999, group: 'river_chest', baseY: pos.y,
        });
    }

    // 采集：返回获得的物品 {id: amount}
    harvest(resource, toolPower = 0, axeId = null, toolCharge = 0) {
        if (resource.depleted) return null;
        const damage = 5 + toolPower * 5;
        resource.health -= damage;
        // 受击闪烁
        resource.mesh.children.forEach(c => {
            if (c.material) {
                c.material.emissive = new THREE.Color(0x442200);
                setTimeout(() => { if (c.material) c.material.emissive = new THREE.Color(0x000000); }, 150);
            }
        });
        if (resource.health <= 0) {
            resource.depleted = true;
            resource.respawnTimer = resource.respawnTime;
            resource.mesh.visible = false;
            const drops = { ...resource.drops };
            // 砍树时通知敌人系统（用于树士卫生成计数）
            if (resource.group === 'tree' && window.game && window.game.enemies) {
                window.game.enemies.onTreeChopped();
            }
            // 石头维度挖石头时通知敌人系统（用于石守卫生成计数）
            if (resource.group === 'rock' && this.worldType === 'stone' && window.game && window.game.enemies) {
                window.game.enemies.onStoneMined();
            }
            // 最终木斧砍树10%概率召唤友善树士卫
            if (resource.group === 'tree' && axeId === 'ultimate_axe' && Math.random() < 0.10 && window.game && window.game.enemies) {
                const pos = resource.mesh.position;
                const sx = pos.x + (Math.random() - 0.5) * 2;
                const sz = pos.z + (Math.random() - 0.5) * 2;
                const sy = this.getHeight(sx, sz);
                window.game.enemies._spawnFriendlyTreeGuardian(sx, sy, sz);
                if (window.game) window.game.onMessage('友善树士卫出现了！');
            }
            // 砍树25%概率掉1条柳条
            if (resource.group === 'tree' && Math.random() < 0.9) {
                drops.willow = (drops.willow || 0) + 1;
            }
            // 石斧砍完树60%概率额外掉落6木材1柳条
            if (resource.group === 'tree' && axeId === 'stone_axe' && Math.random() < 0.60) {
                drops.wood = (drops.wood || 0) + 6;
                drops.willow = (drops.willow || 0) + 1;
            }
            // 铁斧砍完树75%概率额外掉落17木材5柳条
            if (resource.group === 'tree' && axeId === 'iron_axe' && Math.random() < 0.75) {
                drops.wood = (drops.wood || 0) + 17;
                drops.willow = (drops.willow || 0) + 5;
            }
            // 钢斧砍完树80%概率额外掉落1苹果23木材12柳条
            if (resource.group === 'tree' && axeId === 'steel_axe' && Math.random() < 0.80) {
                drops.apple = (drops.apple || 0) + 1;
                drops.wood = (drops.wood || 0) + 23;
                drops.willow = (drops.willow || 0) + 12;
            }
            // 最终木斧砍完树80%概率额外掉落1苹果23木材12柳条
            if (resource.group === 'tree' && axeId === 'ultimate_axe' && Math.random() < 0.80) {
                drops.apple = (drops.apple || 0) + 1;
                drops.wood = (drops.wood || 0) + 23;
                drops.willow = (drops.willow || 0) + 12;
            }
            // 最终石斧砍完树95%概率额外掉落5苹果99木材99柳条
            if (resource.group === 'tree' && axeId === 'ultimate_stone_axe' && Math.random() < 0.95) {
                drops.apple = (drops.apple || 0) + 5;
                drops.wood = (drops.wood || 0) + 99;
                drops.willow = (drops.willow || 0) + 99;
            }
            // 确凿者砍完树80%概率额外掉落1苹果23木材12柳条
            if (resource.group === 'tree' && axeId === 'certain_one' && Math.random() < 0.80) {
                drops.apple = (drops.apple || 0) + 1;
                drops.wood = (drops.wood || 0) + 23;
                drops.willow = (drops.willow || 0) + 12;
            }
            // 充能斧头额外掉落：每级充能增加1个掉落物
            if (toolCharge > 0 && resource.group === 'tree') {
                for (const key of Object.keys(drops)) {
                    drops[key] += toolCharge;
                }
            }
            return drops;
        }
        return null;
    }

    interact(resource) {
        if (resource.type === 'river_chest' && !resource.depleted) {
            resource.depleted = true;
            resource.respawnTimer = resource.respawnTime;
            resource.mesh.visible = false;
            return { ...resource.drops };
        }
        if ((resource.type === 'berry' || resource.type === 'kelp' || resource.type === 'cactus') && !resource.depleted) {
            resource.depleted = true;
            resource.respawnTimer = resource.respawnTime;
            resource.mesh.visible = false;
            return { ...resource.drops };
        }
        return null;
    }

    // 建造：放置建筑
    placeBuilding(itemId, position, yaw = 0, charge = 0) {
        const group = new THREE.Group();
        group.position.copy(position);
        // 建筑面向玩家
        group.rotation.y = yaw;

        if (itemId === 'wall_wood') {
            const geo = new THREE.BoxGeometry(2, 3, 0.2);
            const mat = new THREE.MeshStandardMaterial({ color: 0x7a5a35, roughness: 0.8, flatShading: false });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);
            // 木纹装饰条
            const trimMat = new THREE.MeshStandardMaterial({ color: 0x5a3a18, roughness: 0.85 });
            for (let i = 0; i < 3; i++) {
                const trimGeo = new THREE.BoxGeometry(2.02, 0.06, 0.22);
                const trim = new THREE.Mesh(trimGeo, trimMat);
                trim.position.y = 0.5 + i * 1.0;
                group.add(trim);
            }
        } else if (itemId === 'wall_stone') {
            const geo = new THREE.BoxGeometry(2, 3, 0.2);
            const mat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.85, flatShading: false, metalness: 0.05 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);
            // 石纹装饰条
            const trimMat = new THREE.MeshStandardMaterial({ color: 0x6a6a6a, roughness: 0.85 });
            for (let i = 0; i < 3; i++) {
                const trimGeo = new THREE.BoxGeometry(2.02, 0.06, 0.22);
                const trim = new THREE.Mesh(trimGeo, trimMat);
                trim.position.y = 0.5 + i * 1.0;
                group.add(trim);
            }
        } else if (itemId === 'campfire') {
            // 篝火：精致石圈+木柴+火焰
            const stoneGeo = new THREE.DodecahedronGeometry(0.32, 2);
            const stoneMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.85, flatShading: false, metalness: 0.05 });
            for (let i = 0; i < 8; i++) {
                const stone = new THREE.Mesh(stoneGeo, stoneMat);
                const a = (i / 8) * Math.PI * 2;
                stone.position.set(Math.cos(a) * 0.55, 0.2, Math.sin(a) * 0.55);
                stone.rotation.y = a;
                stone.castShadow = true;
                stone.receiveShadow = true;
                group.add(stone);
            }
            // 木柴 - 交叉堆叠
            const logGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.8, 12);
            const logMat = new THREE.MeshStandardMaterial({ color: 0x3a2010, roughness: 0.88 });
            for (let i = 0; i < 4; i++) {
                const log = new THREE.Mesh(logGeo, logMat);
                log.position.y = 0.25 + i * 0.05;
                log.rotation.z = Math.PI / 2;
                log.rotation.y = (i / 4) * Math.PI;
                log.castShadow = true;
                group.add(log);
            }
            // 火焰光
            const light = new THREE.PointLight(0xff6600, 2.5, 14, 2);
            light.position.y = 0.8;
            light.castShadow = true;
            group.add(light);
            // 火焰 - 3层
            const fireGeo1 = new THREE.ConeGeometry(0.28, 0.8, 10);
            const fireMat1 = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.85 });
            const fire1 = new THREE.Mesh(fireGeo1, fireMat1);
            fire1.position.y = 0.7;
            group.add(fire1);
            const fireGeo2 = new THREE.ConeGeometry(0.18, 0.6, 10);
            const fireMat2 = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8 });
            const fire2 = new THREE.Mesh(fireGeo2, fireMat2);
            fire2.position.y = 0.8;
            group.add(fire2);
            const fireGeo3 = new THREE.ConeGeometry(0.1, 0.4, 8);
            const fireMat3 = new THREE.MeshBasicMaterial({ color: 0xffff88, transparent: true, opacity: 0.7 });
            const fire3 = new THREE.Mesh(fireGeo3, fireMat3);
            fire3.position.y = 0.9;
            group.add(fire3);
            this.campfires.push({ position: position.clone(), light, fire: fire1 });
        } else if (itemId === 'torch') {
            // 火把：精致木杆+金属包裹+3层火焰
            const poleGeo = new THREE.CylinderGeometry(0.05, 0.07, 1.5, 14);
            const poleMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.85 });
            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.position.y = 0.75;
            pole.castShadow = true;
            group.add(pole);

            // 金属包裹头部
            const capGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.15, 12);
            const capMat = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.35, metalness: 0.75 });
            const cap = new THREE.Mesh(capGeo, capMat);
            cap.position.y = 1.5;
            cap.castShadow = true;
            group.add(cap);

            // 火焰 - 3层
            const fireGeo1 = new THREE.ConeGeometry(0.14, 0.5, 10);
            const fireMat1 = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.85 });
            const fire1 = new THREE.Mesh(fireGeo1, fireMat1);
            fire1.position.y = 1.75;
            group.add(fire1);
            const fireGeo2 = new THREE.ConeGeometry(0.09, 0.38, 10);
            const fireMat2 = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8 });
            const fire2 = new THREE.Mesh(fireGeo2, fireMat2);
            fire2.position.y = 1.8;
            group.add(fire2);
            const fireGeo3 = new THREE.ConeGeometry(0.05, 0.25, 8);
            const fireMat3 = new THREE.MeshBasicMaterial({ color: 0xffff88, transparent: true, opacity: 0.7 });
            const fire3 = new THREE.Mesh(fireGeo3, fireMat3);
            fire3.position.y = 1.85;
            group.add(fire3);

            // 光源
            const light = new THREE.PointLight(0xff8800, 1.8, 10, 2);
            light.position.y = 1.7;
            group.add(light);

            this.campfires.push({ position: position.clone(), light, fire: fire1 });
        } else if (itemId === 'knowledge_bookshelf') {
            // 知识书架：精致木质框架+多层书架+彩色书本
            const frameGeo = new THREE.BoxGeometry(1.5, 2, 0.8);
            const frameMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.8, flatShading: false });
            const frame = new THREE.Mesh(frameGeo, frameMat);
            frame.position.y = 1.0;
            frame.castShadow = true;
            frame.receiveShadow = true;
            group.add(frame);

            // 顶部装饰檐 - 双层
            const topTrimGeo = new THREE.BoxGeometry(1.6, 0.12, 0.9);
            const topTrimMat = new THREE.MeshStandardMaterial({ color: 0x3a2a10, roughness: 0.75 });
            const topTrim = new THREE.Mesh(topTrimGeo, topTrimMat);
            topTrim.position.y = 2.06;
            topTrim.castShadow = true;
            group.add(topTrim);
            const topTrim2Geo = new THREE.BoxGeometry(1.65, 0.06, 0.95);
            const topTrim2 = new THREE.Mesh(topTrim2Geo, topTrimMat);
            topTrim2.position.y = 2.15;
            group.add(topTrim2);
            // 底部装饰
            const botTrimGeo = new THREE.BoxGeometry(1.6, 0.08, 0.9);
            const botTrim = new THREE.Mesh(botTrimGeo, topTrimMat);
            botTrim.position.y = 0.04;
            group.add(botTrim);

            // 书架隔层
            for (let i = 0; i < 3; i++) {
                const shelfGeo = new THREE.BoxGeometry(1.35, 0.06, 0.75);
                const shelfMat = new THREE.MeshStandardMaterial({ color: 0x3a2a10, roughness: 0.85 });
                const shelf = new THREE.Mesh(shelfGeo, shelfMat);
                shelf.position.y = 0.5 + i * 0.55;
                group.add(shelf);
            }

            // 书本 - 高细分，多色，更多
            const bookColors = [0x8b0000, 0x006400, 0x00008b, 0x8b8b00, 0x8b008b, 0x008b8b, 0x4a6a2a, 0x6a3a4a];
            for (let row = 0; row < 3; row++) {
                for (let j = 0; j < 4; j++) {
                    const h = 0.35 + Math.random() * 0.05;
                    const bookGeo = new THREE.BoxGeometry(0.25, h, 0.5);
                    const bookMat = new THREE.MeshStandardMaterial({ color: bookColors[(row * 4 + j) % bookColors.length], roughness: 0.55, flatShading: false });
                    const book = new THREE.Mesh(bookGeo, bookMat);
                    book.position.set(-0.45 + j * 0.3, 0.68 + row * 0.55, 0.1);
                    book.castShadow = true;
                    group.add(book);
                }
            }
        } else if (itemId === 'auto_miner') {
            // 自动挖矿器：精致金属机身+钻头+指示灯
            const bodyGeo = new THREE.BoxGeometry(1.4, 1.1, 1.1);
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4d5660, roughness: 0.6, metalness: 0.7, flatShading: false });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 0.65;
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);

            // 顶部装饰条 - 双层
            const topBarGeo = new THREE.BoxGeometry(1.42, 0.08, 1.12);
            const topBarMat = new THREE.MeshStandardMaterial({ color: 0x6a7480, roughness: 0.45, metalness: 0.75 });
            const topBar = new THREE.Mesh(topBarGeo, topBarMat);
            topBar.position.y = 1.22;
            group.add(topBar);
            const topBar2Geo = new THREE.BoxGeometry(1.45, 0.04, 1.15);
            const topBar2 = new THREE.Mesh(topBar2Geo, topBarMat);
            topBar2.position.y = 1.28;
            group.add(topBar2);
            // 侧面散热槽
            const ventGeo = new THREE.BoxGeometry(0.04, 0.6, 0.8);
            const ventMat = new THREE.MeshStandardMaterial({ color: 0x2a3038, roughness: 0.5 });
            const ventL = new THREE.Mesh(ventGeo, ventMat);
            ventL.position.set(-0.72, 0.65, 0);
            group.add(ventL);
            const ventR = new THREE.Mesh(ventGeo, ventMat);
            ventR.position.set(0.72, 0.65, 0);
            group.add(ventR);

            // 钻头 - 锥形螺旋
            const drillGeo = new THREE.CylinderGeometry(0.22, 0.05, 0.9, 16);
            const drillMat = new THREE.MeshStandardMaterial({ color: 0xb5bcc4, roughness: 0.35, metalness: 0.85 });
            const drill = new THREE.Mesh(drillGeo, drillMat);
            drill.position.set(0, 0.35, -0.7);
            drill.rotation.x = Math.PI / 2;
            drill.castShadow = true;
            group.add(drill);
            // 钻头尖端
            const tipGeo = new THREE.ConeGeometry(0.05, 0.15, 10);
            const tip = new THREE.Mesh(tipGeo, drillMat);
            tip.position.set(0, 0.35, -1.2);
            tip.rotation.x = -Math.PI / 2;
            group.add(tip);
            // 钻头环
            const ringGeo = new THREE.TorusGeometry(0.22, 0.03, 8, 16);
            const ring = new THREE.Mesh(ringGeo, drillMat);
            ring.position.set(0, 0.35, -0.3);
            ring.rotation.y = Math.PI / 2;
            group.add(ring);

            // 指示灯
            const light = new THREE.PointLight(0x66ccff, 1.0, 5);
            light.position.y = 1.2;
            group.add(light);
            const ledGeo = new THREE.SphereGeometry(0.07, 12, 10);
            const ledMat = new THREE.MeshStandardMaterial({ color: 0x66ccff, emissive: 0x66ccff, emissiveIntensity: 1.2 });
            const led = new THREE.Mesh(ledGeo, ledMat);
            led.position.set(0.5, 1.0, 0.56);
            group.add(led);
            // 第二个指示灯
            const led2 = new THREE.Mesh(ledGeo, new THREE.MeshStandardMaterial({ color: 0x44ff88, emissive: 0x44ff88, emissiveIntensity: 1.0 }));
            led2.position.set(-0.5, 1.0, 0.56);
            group.add(led2);
        } else if (itemId === 'chest') {
            // 精致箱子：木质主体+金属包边+锁扣
            const bodyGeo = new THREE.BoxGeometry(1.4, 1.0, 1.0);
            const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.75, flatShading: false });
            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 0.5;
            body.castShadow = true;
            body.receiveShadow = true;
            group.add(body);

            // 弧形箱盖
            const lidGeo = new THREE.BoxGeometry(1.4, 0.3, 1.0);
            const lidMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.75 });
            const lid = new THREE.Mesh(lidGeo, lidMat);
            lid.position.y = 1.15;
            lid.castShadow = true;
            group.add(lid);
            // 盖顶装饰条
            const lidTrimGeo = new THREE.BoxGeometry(1.42, 0.06, 1.02);
            const lidTrimMat = new THREE.MeshStandardMaterial({ color: 0xc89a5a, roughness: 0.35, metalness: 0.7 });
            const lidTrim = new THREE.Mesh(lidTrimGeo, lidTrimMat);
            lidTrim.position.y = 1.32;
            group.add(lidTrim);

            // 金属锁扣 - 更精致
            const lockGeo = new THREE.BoxGeometry(0.2, 0.25, 0.1);
            const lockMat = new THREE.MeshStandardMaterial({ color: 0xc89a5a, roughness: 0.35, metalness: 0.7 });
            const lock = new THREE.Mesh(lockGeo, lockMat);
            lock.position.set(0, 0.9, 0.51);
            lock.castShadow = true;
            group.add(lock);
            // 锁孔
            const keyholeGeo = new THREE.CircleGeometry(0.04, 10);
            const keyholeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
            const keyhole = new THREE.Mesh(keyholeGeo, keyholeMat);
            keyhole.position.set(0, 0.9, 0.56);
            group.add(keyhole);

            // 金属包边 - 上下两道
            const bandGeo = new THREE.BoxGeometry(1.42, 0.08, 1.02);
            const bandMat = new THREE.MeshStandardMaterial({ color: 0xc89a5a, roughness: 0.35, metalness: 0.7 });
            const band1 = new THREE.Mesh(bandGeo, bandMat);
            band1.position.y = 0.2;
            band1.castShadow = true;
            group.add(band1);
            const band2 = new THREE.Mesh(bandGeo, bandMat);
            band2.position.y = 0.8;
            band2.castShadow = true;
            group.add(band2);
            // 角包边
            const cornerGeo = new THREE.BoxGeometry(0.12, 1.0, 0.12);
            for (const [cx, cz] of [[-0.65, -0.45], [0.65, -0.45], [-0.65, 0.45], [0.65, 0.45]]) {
                const corner = new THREE.Mesh(cornerGeo, bandMat);
                corner.position.set(cx, 0.5, cz);
                corner.castShadow = true;
                group.add(corner);
            }
        } else if (itemId === 'forge') {
            // 锻造台：精致石制底座+铁砧+火焰炉
            const baseGeo = new THREE.BoxGeometry(1.4, 0.6, 1.2);
            const baseMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.85, flatShading: false, metalness: 0.05 });
            const base = new THREE.Mesh(baseGeo, baseMat);
            base.position.y = 0.3;
            base.castShadow = true;
            base.receiveShadow = true;
            group.add(base);

            // 石制底座装饰边 - 双层
            const trimGeo = new THREE.BoxGeometry(1.42, 0.06, 1.22);
            const trimMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.8 });
            const trim = new THREE.Mesh(trimGeo, trimMat);
            trim.position.y = 0.6;
            group.add(trim);
            const trim2Geo = new THREE.BoxGeometry(1.45, 0.04, 1.25);
            const trim2 = new THREE.Mesh(trim2Geo, trimMat);
            trim2.position.y = 0.66;
            group.add(trim2);

            // 铁砧 - 精致形状
            const anvilGeo = new THREE.BoxGeometry(0.8, 0.3, 0.5);
            const anvilMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.35, metalness: 0.85 });
            const anvil = new THREE.Mesh(anvilGeo, anvilMat);
            anvil.position.y = 0.75;
            anvil.castShadow = true;
            group.add(anvil);

            // 铁砧尖角
            const hornGeo = new THREE.ConeGeometry(0.15, 0.3, 8);
            const horn = new THREE.Mesh(hornGeo, anvilMat);
            horn.position.set(0.45, 0.75, 0);
            horn.rotation.z = -Math.PI / 2;
            group.add(horn);

            // 铁砧顶部凹槽
            const grooveGeo = new THREE.BoxGeometry(0.6, 0.04, 0.3);
            const grooveMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.25, metalness: 0.9 });
            const groove = new THREE.Mesh(grooveGeo, grooveMat);
            groove.position.y = 0.91;
            group.add(groove);

            // 铁砧支架
            const standGeo = new THREE.BoxGeometry(0.3, 0.4, 0.3);
            const stand = new THREE.Mesh(standGeo, anvilMat);
            stand.position.y = 0.5;
            stand.castShadow = true;
            group.add(stand);

            // 火焰光
            const light = new THREE.PointLight(0xff6600, 2, 10, 2);
            light.position.set(-0.3, 0.8, 0);
            group.add(light);

            // 3层火焰
            const fireGeo1 = new THREE.ConeGeometry(0.2, 0.55, 10);
            const fireMat1 = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.85 });
            const fire1 = new THREE.Mesh(fireGeo1, fireMat1);
            fire1.position.set(-0.3, 0.95, 0);
            group.add(fire1);
            const fireGeo2 = new THREE.ConeGeometry(0.12, 0.4, 10);
            const fireMat2 = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.8 });
            const fire2 = new THREE.Mesh(fireGeo2, fireMat2);
            fire2.position.set(-0.3, 1.0, 0);
            group.add(fire2);
            const fireGeo3 = new THREE.ConeGeometry(0.06, 0.25, 8);
            const fireMat3 = new THREE.MeshBasicMaterial({ color: 0xffff88, transparent: true, opacity: 0.7 });
            const fire3 = new THREE.Mesh(fireGeo3, fireMat3);
            fire3.position.set(-0.3, 1.05, 0);
            group.add(fire3);
        } else if (itemId === 'rare_wood_pile') {
            // 稀有木堆：精致堆叠金色原木
            const logGeo = new THREE.CylinderGeometry(0.22, 0.22, 1.2, 14);
            const logMat = new THREE.MeshStandardMaterial({ color: 0xd4a050, roughness: 0.55, metalness: 0.25, emissive: 0x442200, emissiveIntensity: 0.2, flatShading: false });
            // 底层3根
            for (let i = 0; i < 3; i++) {
                const log = new THREE.Mesh(logGeo, logMat);
                log.position.set(-0.4 + i * 0.4, 0.22, 0);
                log.rotation.z = Math.PI / 2;
                log.castShadow = true;
                log.receiveShadow = true;
                group.add(log);
            }
            // 中层2根（垂直方向）
            for (let i = 0; i < 2; i++) {
                const log = new THREE.Mesh(logGeo, logMat);
                log.position.set(0, 0.55, -0.2 + i * 0.4);
                log.rotation.x = Math.PI / 2;
                log.castShadow = true;
                group.add(log);
            }
            // 顶层1根
            const topLog = new THREE.Mesh(logGeo, logMat);
            topLog.position.set(0, 0.88, 0);
            topLog.rotation.z = Math.PI / 2;
            topLog.castShadow = true;
            group.add(topLog);
            // 金色符文环绕 - 双层
            const runeGeo = new THREE.TorusGeometry(0.7, 0.025, 8, 24);
            const runeMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.15, metalness: 0.85, emissive: 0xffaa00, emissiveIntensity: 0.5, transparent: true, opacity: 0.7 });
            const rune = new THREE.Mesh(runeGeo, runeMat);
            rune.rotation.x = Math.PI / 2;
            rune.position.y = 0.05;
            group.add(rune);
            const rune2 = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.02, 6, 20), runeMat);
            rune2.rotation.x = Math.PI / 2;
            rune2.position.y = 0.1;
            group.add(rune2);
            // 光晕 - 更强
            const light = new THREE.PointLight(0xd4a050, 1.2, 5);
            light.position.y = 0.8;
            group.add(light);
        } else if (itemId === 'ultimate_bookshelf') {
            // 最终书架：金色华丽书架+发光水晶
            const frameGeo = new THREE.BoxGeometry(1.6, 2.2, 0.9);
            const frameMat = new THREE.MeshStandardMaterial({ color: 0xd4a050, roughness: 0.45, metalness: 0.35, emissive: 0x442200, emissiveIntensity: 0.25, flatShading: false });
            const frame = new THREE.Mesh(frameGeo, frameMat);
            frame.position.y = 1.1;
            frame.castShadow = true;
            frame.receiveShadow = true;
            group.add(frame);

            // 金色边框装饰 - 上下
            const trimGeo = new THREE.BoxGeometry(1.65, 0.08, 0.95);
            const trimMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.25, metalness: 0.7, flatShading: false });
            for (let i = 0; i < 5; i++) {
                const trim = new THREE.Mesh(trimGeo, trimMat);
                trim.position.y = 0.2 + i * 0.5;
                trim.castShadow = true;
                group.add(trim);
            }
            // 顶部华丽装饰 - 双层
            const crownGeo = new THREE.BoxGeometry(1.7, 0.15, 1.0);
            const crown = new THREE.Mesh(crownGeo, trimMat);
            crown.position.y = 2.28;
            crown.castShadow = true;
            group.add(crown);
            const crown2Geo = new THREE.BoxGeometry(1.75, 0.06, 1.05);
            const crown2 = new THREE.Mesh(crown2Geo, trimMat);
            crown2.position.y = 2.38;
            group.add(crown2);
            // 底部装饰
            const botCrownGeo = new THREE.BoxGeometry(1.7, 0.08, 1.0);
            const botCrown = new THREE.Mesh(botCrownGeo, trimMat);
            botCrown.position.y = 0.04;
            group.add(botCrown);

            // 书架隔层
            for (let i = 0; i < 4; i++) {
                const shelfGeo = new THREE.BoxGeometry(1.4, 0.05, 0.75);
                const shelfMat = new THREE.MeshStandardMaterial({ color: 0xa87830, roughness: 0.65 });
                const shelf = new THREE.Mesh(shelfGeo, shelfMat);
                shelf.position.y = 0.5 + i * 0.5;
                group.add(shelf);
            }

            // 彩色书本 - 高细分，更多色
            const bookColors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff, 0xff8844, 0x8844ff, 0x44ff88, 0xff4488];
            for (let row = 0; row < 4; row++) {
                for (let j = 0; j < 4; j++) {
                    const h = 0.35 + Math.random() * 0.05;
                    const bookGeo = new THREE.BoxGeometry(0.28, h, 0.5);
                    const bookMat = new THREE.MeshStandardMaterial({ color: bookColors[(row * 4 + j) % bookColors.length], roughness: 0.45, emissive: 0x111111, emissiveIntensity: 0.12, flatShading: false });
                    const book = new THREE.Mesh(bookGeo, bookMat);
                    book.position.set(-0.5 + j * 0.33, 0.68 + row * 0.5, 0.1);
                    book.castShadow = true;
                    group.add(book);
                }
            }

            // 顶部水晶 - 超高细分
            const crystalGeo = new THREE.OctahedronGeometry(0.28, 2);
            const crystalMat = new THREE.MeshStandardMaterial({ color: 0xe8c860, roughness: 0.08, metalness: 0.55, emissive: 0x886600, emissiveIntensity: 0.6, transparent: true, opacity: 0.9, flatShading: false });
            const crystal = new THREE.Mesh(crystalGeo, crystalMat);
            crystal.position.y = 2.6;
            crystal.castShadow = true;
            group.add(crystal);
            // 水晶基座
            const crystalBaseGeo2 = new THREE.CylinderGeometry(0.18, 0.25, 0.1, 8);
            const crystalBase2 = new THREE.Mesh(crystalBaseGeo2, trimMat);
            crystalBase2.position.y = 2.45;
            group.add(crystalBase2);

            const light = new THREE.PointLight(0xe8c860, 1.5, 6);
            light.position.y = 2.6;
            group.add(light);
        } else if (itemId === 'portal') {
            // 穿越器：精致石制门框 + 紫色传送门
            // 左柱
            const pillarGeo = new THREE.BoxGeometry(0.3, 3, 0.3);
            const pillarMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8, flatShading: false, metalness: 0.1 });
            const pillarL = new THREE.Mesh(pillarGeo, pillarMat);
            pillarL.position.set(-0.8, 1.5, 0);
            pillarL.castShadow = true;
            pillarL.receiveShadow = true;
            group.add(pillarL);
            // 右柱
            const pillarR = new THREE.Mesh(pillarGeo, pillarMat);
            pillarR.position.set(0.8, 1.5, 0);
            pillarR.castShadow = true;
            pillarR.receiveShadow = true;
            group.add(pillarR);
            // 顶部横梁
            const beamGeo = new THREE.BoxGeometry(2, 0.3, 0.3);
            const beam = new THREE.Mesh(beamGeo, pillarMat);
            beam.position.set(0, 3.0, 0);
            beam.castShadow = true;
            group.add(beam);
            // 柱顶装饰 - 双层
            const capMat = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.65, metalness: 0.35, flatShading: false });
            const capGeo = new THREE.BoxGeometry(0.4, 0.1, 0.4);
            const capL = new THREE.Mesh(capGeo, capMat);
            capL.position.set(-0.8, 3.15, 0);
            capL.castShadow = true;
            group.add(capL);
            const capR = new THREE.Mesh(capGeo, capMat);
            capR.position.set(0.8, 3.15, 0);
            capR.castShadow = true;
            group.add(capR);
            const capTopGeo = new THREE.BoxGeometry(0.45, 0.06, 0.45);
            const capTopL = new THREE.Mesh(capTopGeo, capMat);
            capTopL.position.set(-0.8, 3.23, 0);
            group.add(capTopL);
            const capTopR = new THREE.Mesh(capTopGeo, capMat);
            capTopR.position.set(0.8, 3.23, 0);
            group.add(capTopR);
            // 柱基
            const pillarBaseGeo2 = new THREE.BoxGeometry(0.45, 0.12, 0.45);
            const pBaseL = new THREE.Mesh(pillarBaseGeo2, capMat);
            pBaseL.position.set(-0.8, 0.06, 0);
            group.add(pBaseL);
            const pBaseR = new THREE.Mesh(pillarBaseGeo2, capMat);
            pBaseR.position.set(0.8, 0.06, 0);
            group.add(pBaseR);
            // 传送门光效（半透明圆环）- 3层
            const portalGeo = new THREE.PlaneGeometry(1.4, 2.6);
            const portalMat = new THREE.MeshBasicMaterial({ color: 0x9933ff, transparent: true, opacity: 0.65, side: THREE.DoubleSide });
            const portalMesh = new THREE.Mesh(portalGeo, portalMat);
            portalMesh.position.set(0, 1.5, 0);
            group.add(portalMesh);
            // 传送门内层光效
            const portalGeo2 = new THREE.PlaneGeometry(1.0, 2.2);
            const portalMat2 = new THREE.MeshBasicMaterial({ color: 0xcc66ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
            const portalMesh2 = new THREE.Mesh(portalGeo2, portalMat2);
            portalMesh2.position.set(0, 1.5, 0.02);
            group.add(portalMesh2);
            // 传送门核心光效
            const portalGeo3 = new THREE.PlaneGeometry(0.5, 1.6);
            const portalMat3 = new THREE.MeshBasicMaterial({ color: 0xee88ff, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
            const portalMesh3 = new THREE.Mesh(portalGeo3, portalMat3);
            portalMesh3.position.set(0, 1.5, 0.04);
            group.add(portalMesh3);
            // 紫色光源 - 更强
            const portalLight = new THREE.PointLight(0x9933ff, 2.5, 10, 2);
            portalLight.position.set(0, 1.5, 0);
            group.add(portalLight);
            // 底座 - 带装饰
            const baseGeo = new THREE.BoxGeometry(2.2, 0.2, 1.0);
            const base = new THREE.Mesh(baseGeo, pillarMat);
            base.position.set(0, 0.1, 0);
            base.castShadow = true;
            base.receiveShadow = true;
            group.add(base);
            const baseTrimGeo = new THREE.BoxGeometry(2.25, 0.05, 1.05);
            const baseTrim = new THREE.Mesh(baseTrimGeo, capMat);
            baseTrim.position.y = 0.22;
            group.add(baseTrim);
        } else if (itemId === 'normal_altar') {
            // 普通祭坛：石质底座+石柱+发光石晶
            const baseGeo = new THREE.BoxGeometry(1.4, 0.3, 1.4);
            const baseMat = new THREE.MeshStandardMaterial({ color: 0x5a5e64, roughness: 0.8, flatShading: false, metalness: 0.1 });
            const base = new THREE.Mesh(baseGeo, baseMat);
            base.position.y = 0.15;
            base.castShadow = true;
            base.receiveShadow = true;
            group.add(base);
            // 底座装饰边
            const altarTrimGeo = new THREE.BoxGeometry(1.45, 0.06, 1.45);
            const altarTrimMat = new THREE.MeshStandardMaterial({ color: 0x7a7e84, roughness: 0.6, metalness: 0.2 });
            const altarTrim = new THREE.Mesh(altarTrimGeo, altarTrimMat);
            altarTrim.position.y = 0.33;
            group.add(altarTrim);
            // 四角石柱 - 带柱基柱头
            const pillarGeo = new THREE.BoxGeometry(0.2, 1.2, 0.2);
            const pillarMat = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.75, flatShading: false, metalness: 0.1 });
            for (let i = 0; i < 4; i++) {
                const px = (i < 2 ? -0.5 : 0.5);
                const pz = (i % 2 === 0 ? -0.5 : 0.5);
                const pillar = new THREE.Mesh(pillarGeo, pillarMat);
                pillar.position.set(px, 0.9, pz);
                pillar.castShadow = true;
                group.add(pillar);
                // 柱基
                const pBase = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.28), altarTrimMat);
                pBase.position.set(px, 0.42, pz);
                group.add(pBase);
                // 柱头
                const pCap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.28), altarTrimMat);
                pCap.position.set(px, 1.42, pz);
                group.add(pCap);
            }
            // 顶部石板
            const topGeo = new THREE.BoxGeometry(1.2, 0.15, 1.2);
            const top = new THREE.Mesh(topGeo, baseMat);
            top.position.y = 1.55;
            top.castShadow = true;
            group.add(top);
            // 中央发光石晶 - 超高细分
            const crystalGeo = new THREE.OctahedronGeometry(0.28, 2);
            const crystalMat = new THREE.MeshStandardMaterial({ color: 0x9a9ea4, roughness: 0.15, metalness: 0.5, emissive: 0x4a4e54, emissiveIntensity: 0.6, flatShading: false });
            const crystal = new THREE.Mesh(crystalGeo, crystalMat);
            crystal.position.y = 1.9;
            crystal.castShadow = true;
            group.add(crystal);
            // 水晶基座
            const cBaseGeo = new THREE.CylinderGeometry(0.18, 0.25, 0.08, 8);
            const cBase = new THREE.Mesh(cBaseGeo, altarTrimMat);
            cBase.position.y = 1.7;
            group.add(cBase);
            // 光源 - 更强
            const altarLight = new THREE.PointLight(0x8a8e94, 2, 7, 2);
            altarLight.position.y = 1.9;
            group.add(altarLight);
        } else if (itemId === 'teleport_monument') {
            // 传送石碑：石质底座+石碑+绿色传送光效
            const baseGeo = new THREE.BoxGeometry(1.2, 0.2, 1.2);
            const baseMat = new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.8, flatShading: false, metalness: 0.1 });
            const base = new THREE.Mesh(baseGeo, baseMat);
            base.position.y = 0.1;
            base.castShadow = true;
            base.receiveShadow = true;
            group.add(base);
            // 底座装饰边
            const monTrimGeo = new THREE.BoxGeometry(1.25, 0.05, 1.25);
            const monTrimMat = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.6, metalness: 0.2 });
            const monTrim = new THREE.Mesh(monTrimGeo, monTrimMat);
            monTrim.position.y = 0.22;
            group.add(monTrim);
            // 石碑主体
            const steleGeo = new THREE.BoxGeometry(0.6, 2.2, 0.25);
            const steleMat = new THREE.MeshStandardMaterial({ color: 0x5a5e64, roughness: 0.75, flatShading: false, metalness: 0.1 });
            const stele = new THREE.Mesh(steleGeo, steleMat);
            stele.position.y = 1.3;
            stele.castShadow = true;
            stele.receiveShadow = true;
            group.add(stele);
            // 石碑顶部装饰 - 双层
            const topGeo = new THREE.BoxGeometry(0.8, 0.15, 0.45);
            const top = new THREE.Mesh(topGeo, baseMat);
            top.position.y = 2.5;
            top.castShadow = true;
            group.add(top);
            const top2Geo = new THREE.BoxGeometry(0.85, 0.06, 0.5);
            const top2 = new THREE.Mesh(top2Geo, monTrimMat);
            top2.position.y = 2.6;
            group.add(top2);
            // 绿色传送光效（中央符文）- 双层
            const runeGeo = new THREE.PlaneGeometry(0.4, 1.4);
            const runeMat = new THREE.MeshBasicMaterial({ color: 0x7adb5a, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
            const rune = new THREE.Mesh(runeGeo, runeMat);
            rune.position.set(0, 1.3, 0.13);
            group.add(rune);
            const rune2Geo = new THREE.PlaneGeometry(0.25, 1.0);
            const rune2Mat = new THREE.MeshBasicMaterial({ color: 0xaaffaa, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
            const rune2 = new THREE.Mesh(rune2Geo, rune2Mat);
            rune2.position.set(0, 1.3, 0.15);
            group.add(rune2);
            // 绿色光源 - 更强
            const monLight = new THREE.PointLight(0x7adb5a, 2, 7, 2);
            monLight.position.y = 1.3;
            group.add(monLight);
        } else if (itemId === 'mystery_box') {
            // 神秘盒：木质底座+神秘盒子+金色光效
            const baseGeo = new THREE.BoxGeometry(1.0, 0.1, 1.0);
            const baseMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.85, flatShading: false });
            const base = new THREE.Mesh(baseGeo, baseMat);
            base.position.y = 0.05;
            base.castShadow = true;
            base.receiveShadow = true;
            group.add(base);
            // 底座装饰边
            const mbTrimGeo = new THREE.BoxGeometry(1.05, 0.04, 1.05);
            const mbTrimMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.7 });
            const mbTrim = new THREE.Mesh(mbTrimGeo, mbTrimMat);
            mbTrim.position.y = 0.12;
            group.add(mbTrim);
            // 盒子主体
            const boxGeo = new THREE.BoxGeometry(0.8, 0.7, 0.8);
            const boxMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.6, flatShading: false, metalness: 0.15 });
            const box = new THREE.Mesh(boxGeo, boxMat);
            box.position.y = 0.45;
            box.castShadow = true;
            box.receiveShadow = true;
            group.add(box);
            // 盒盖
            const lidGeo = new THREE.BoxGeometry(0.85, 0.12, 0.85);
            const lid = new THREE.Mesh(lidGeo, boxMat);
            lid.position.y = 0.86;
            lid.castShadow = true;
            group.add(lid);
            // 盖顶装饰
            const lidDecoGeo = new THREE.BoxGeometry(0.9, 0.05, 0.9);
            const lidDeco = new THREE.Mesh(lidDecoGeo, mbTrimMat);
            lidDeco.position.y = 0.94;
            group.add(lidDeco);
            // 金色符文 - 双层
            const runeGeo = new THREE.PlaneGeometry(0.5, 0.5);
            const runeMat = new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.65, side: THREE.DoubleSide });
            const rune = new THREE.Mesh(runeGeo, runeMat);
            rune.position.set(0, 0.45, 0.41);
            group.add(rune);
            const rune2Geo = new THREE.PlaneGeometry(0.3, 0.3);
            const rune2Mat = new THREE.MeshBasicMaterial({ color: 0xffdd88, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
            const rune2 = new THREE.Mesh(rune2Geo, rune2Mat);
            rune2.position.set(0, 0.45, 0.42);
            group.add(rune2);
            // 金色光源 - 更强
            const mbLight = new THREE.PointLight(0xffaa44, 1.5, 6, 2);
            mbLight.position.y = 0.5;
            group.add(mbLight);
        } else if (itemId === 'gold_altar') {
            // 黄金祭坛：金色底座+金柱+发光金晶
            const baseGeo = new THREE.BoxGeometry(1.4, 0.3, 1.4);
            const baseMat = new THREE.MeshStandardMaterial({ color: 0xb8860b, roughness: 0.2, metalness: 0.9, flatShading: false });
            const base = new THREE.Mesh(baseGeo, baseMat);
            base.position.y = 0.15;
            base.castShadow = true;
            base.receiveShadow = true;
            group.add(base);
            // 底座装饰边
            const trimGeo = new THREE.BoxGeometry(1.45, 0.06, 1.45);
            const trimMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.1, metalness: 1.0 });
            const trim = new THREE.Mesh(trimGeo, trimMat);
            trim.position.y = 0.33;
            group.add(trim);
            // 四角金柱
            const pillarGeo = new THREE.BoxGeometry(0.2, 1.2, 0.2);
            const pillarMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.15, metalness: 0.95, flatShading: false });
            for (let i = 0; i < 4; i++) {
                const px = (i < 2 ? -0.5 : 0.5);
                const pz = (i % 2 === 0 ? -0.5 : 0.5);
                const pillar = new THREE.Mesh(pillarGeo, pillarMat);
                pillar.position.set(px, 0.9, pz);
                pillar.castShadow = true;
                group.add(pillar);
                const pBase = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.28), trimMat);
                pBase.position.set(px, 0.42, pz);
                group.add(pBase);
                const pCap = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.28), trimMat);
                pCap.position.set(px, 1.42, pz);
                group.add(pCap);
            }
            // 顶部金板
            const topGeo = new THREE.BoxGeometry(1.2, 0.15, 1.2);
            const top = new THREE.Mesh(topGeo, baseMat);
            top.position.y = 1.55;
            top.castShadow = true;
            group.add(top);
            // 中央发光金晶
            const crystalGeo = new THREE.OctahedronGeometry(0.3, 2);
            const crystalMat = new THREE.MeshStandardMaterial({ color: 0xffee44, roughness: 0.05, metalness: 1.0, emissive: 0xffaa00, emissiveIntensity: 0.8, flatShading: false });
            const crystal = new THREE.Mesh(crystalGeo, crystalMat);
            crystal.position.y = 1.95;
            crystal.castShadow = true;
            group.add(crystal);
            // 水晶基座
            const cBaseGeo = new THREE.CylinderGeometry(0.2, 0.28, 0.08, 8);
            const cBase = new THREE.Mesh(cBaseGeo, trimMat);
            cBase.position.y = 1.7;
            group.add(cBase);
            // 金色光源
            const altarLight = new THREE.PointLight(0xffd700, 2.5, 8, 2);
            altarLight.position.y = 1.95;
            group.add(altarLight);
        }

        this.scene.add(group);
        this.buildings.push({
            mesh: group,
            type: itemId,
            minerTimer: 0,
            minerStorage: [],
            minerTools: [null, null, null],
            chestStorage: [null, null, null, null, null, null, null, null, null, null],
            rareWoodPileStorage: [null],
            altarStorage: [null],
            monumentName: null,
            mysteryBoxStorage: [null, null],
            goldAltarStorage: [null, null],
            forgeStorage: [null, null, null],
            charge: charge,
        });
        return true;
    }

    getMinerCycleTime(building) {
        const reduction = (building?.minerTools || []).reduce((total, tool) => {
            if (!tool) return total;
            if (tool.id === 'iron_pickaxe') return total + 90;
            if (tool.id === 'stone_pickaxe') return total + 60;
            if (tool.id === 'wood_pickaxe') return total + 30;
            if (tool.id === 'drill') return total - 60;
            if (tool.id === 'steel_pickaxe') return total - 35;
            if (tool.id === 'ultimate_pickaxe') return total - 35;
            if (tool.id === 'certain_one') return total - 35;
            return total;
        }, 0);
        const chargeReduction = (building.charge || 0) * 1;
        return Math.max(10, 120 - reduction - chargeReduction);
    }

    // 更新自动挖矿器：基础120秒，可由三个镐子槽位减少挖矿时间
    updateMiners(dt) {
        for (const building of this.buildings) {
            if (building.type !== 'auto_miner') continue;
            const cycleTime = this.getMinerCycleTime(building);
            building.minerTimer += dt;
            if (building.minerTimer < cycleTime) continue;
            building.minerTimer -= cycleTime;
            const hasDrill = (building.minerTools || []).some(t => t && t.id === 'drill');
            const r = Math.random();
            let oreId;
            if (hasDrill) {
                if (r < 0.50) oreId = 'stone';
                else if (r < 0.85) oreId = 'iron_ore';
                else if (r < 0.95) oreId = 'steel_dirty';
                else oreId = 'steel';
            } else {
                oreId = r < 0.5 ? 'iron_ore' : 'stone';
            }
            const existing = building.minerStorage.find(item => item.id === oreId);
            if (existing) existing.amount += 1;
            else building.minerStorage.push({ id: oreId, amount: 1 });
            if (window.game) window.game.onMessage(`自动挖矿器获得1个${ITEMS[oreId].name}`);
        }
    }

    // 检查是否靠近篝火
    isNearCampfire(pos) {
        for (const cf of this.campfires) {
            const dx = cf.position.x - pos.x;
            const dz = cf.position.z - pos.z;
            const dy = cf.position.y - pos.y;
            if (dx * dx + dy * dy + dz * dz < 25) return true;
        }
        return false;
    }

    // 检查是否靠近知识书架
    isNearBookshelf(pos) {
        for (const b of this.buildings) {
            if (b.type === 'knowledge_bookshelf') {
                if (b.mesh.position.distanceTo(pos) < 4) return true;
            }
        }
        return false;
    }

    // 检查是否靠近锻造台
    isNearForge(pos) {
        for (const b of this.buildings) {
            if (b.type === 'forge') {
                if (b.mesh.position.distanceTo(pos) < 4) return true;
            }
        }
        return false;
    }

    // 回收建筑
    removeBuilding(building) {
        const idx = this.buildings.indexOf(building);
        if (idx === -1) return null;
        const type = building.type;
        // 清理篝火
        if (type === 'campfire' || type === 'torch') {
            const cfIdx = this.campfires.findIndex(cf => cf.position.equals(building.mesh.position));
            if (cfIdx !== -1) this.campfires.splice(cfIdx, 1);
        }
        this.scene.remove(building.mesh);
        building.mesh.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        });
        this.buildings.splice(idx, 1);
        return type;
    }

    // 昼夜循环
    updateDayNight(dt) {
        if (this.worldType === 'stone') {
            // 石头世界：永夜，不推进时间
            this.isNight = true;
            return null;
        }
        if (this.worldType === 'gold') {
            // 金维度：永昼，不推进时间
            this.isNight = false;
            return null;
        }
        this._timeAccum += dt;
        const hoursPerSec = 24 / this.dayDuration;
        this.currentHour += hoursPerSec * dt;
        if (this.currentHour >= 24) {
            this.currentHour -= 24;
            this.dayCount++;
        }

        const wasNight = this.isNight;
        this.isNight = this.currentHour >= 18 || this.currentHour < 6;
        if (wasNight !== this.isNight) {
            return this.isNight ? 'night' : 'day';
        }
        return null;
    }

    updateSun() {
        if (this.worldType === 'stone') {
            // 石头世界：永夜光照
            this.sun.intensity = 0.05;
            this.ambient.intensity = 0.15;
            this.hemi.intensity = 0.05;
            const stoneSky = new THREE.Color(0x1a1a2a);
            this.scene.background = stoneSky;
            this.scene.fog.color = stoneSky;
            this.sun.color.setHex(0x4466aa);
            if (this._playerPos) {
                this.sun.position.set(this._playerPos.x, 30, this._playerPos.z + 20);
                this.sun.target.position.copy(this._playerPos);
                this.sun.target.updateMatrixWorld();
            }
            return;
        }

        if (this.worldType === 'gold') {
            // 金维度：永昼金色光照
            this.sun.intensity = 1.2;
            this.ambient.intensity = 0.6;
            this.hemi.intensity = 0.5;
            const goldSky = new THREE.Color(0xffcc44);
            this.scene.background = goldSky;
            this.scene.fog.color = goldSky;
            this.sun.color.setHex(0xffdd88);
            if (this._playerPos) {
                this.sun.position.set(this._playerPos.x, 50, this._playerPos.z + 20);
                this.sun.target.position.copy(this._playerPos);
                this.sun.target.updateMatrixWorld();
            }
            return;
        }

        const progress = this.currentHour / 24;
        const angle = progress * Math.PI * 2 - Math.PI / 2;
        this.sun.position.set(Math.cos(angle) * 50, Math.sin(angle) * 50, 20);

        // 太阳阴影跟随玩家
        if (this._playerPos) {
            this.sun.target.position.copy(this._playerPos);
            this.sun.position.x = this._playerPos.x + Math.cos(angle) * 50;
            this.sun.position.z = this._playerPos.z + 20;
            this.sun.target.updateMatrixWorld();
        }

        const dayFactor = Math.max(0, Math.cos((this.currentHour - 12) / 6 * Math.PI / 2));
        this.sun.intensity = 0.05 + dayFactor * 1.15;
        this.ambient.intensity = 0.1 + dayFactor * 0.3;
        this.hemi.intensity = 0.05 + dayFactor * 0.25;

        // 天空颜色（复用对象避免GC压力）
        if (!this._dayColor) this._dayColor = new THREE.Color(0x87ceeb);
        if (!this._nightColor) this._nightColor = new THREE.Color(0x0a0a20);
        if (!this._sunsetColor) this._sunsetColor = new THREE.Color(0xff7733);
        if (!this._skyColor) this._skyColor = new THREE.Color();
        let skyColor;
        if (dayFactor > 0.3) {
            skyColor = this._dayColor.clone().lerp(this._nightColor, 1 - dayFactor);
        } else {
            skyColor = this._nightColor.clone().lerp(this._sunsetColor, dayFactor / 0.3);
        }
        this.scene.background = skyColor;
        this.scene.fog.color = skyColor;

        // 太阳颜色
        if (dayFactor > 0.5) {
            this.sun.color.setHex(0xffffee);
        } else {
            this.sun.color.setHex(0xff8844);
        }
    }

    // 资源重生
    updateResources(dt) {
        for (const r of this.resources) {
            if (r.depleted) {
                r.respawnTimer -= dt;
                if (r.respawnTimer <= 0) {
                    r.depleted = false;
                    r.health = r.maxHealth;
                    r.mesh.visible = true;
                }
            }
        }
        // 篝火火焰动画（缓存时间，减少Date.now调用）
        const now = performance.now();
        const sinVal = Math.sin(now * 0.01);
        const sinVal2 = Math.sin(now * 0.008);
        for (const cf of this.campfires) {
            if (cf.fire) {
                cf.fire.scale.y = 0.8 + sinVal * 0.2;
                cf.light.intensity = 1.5 + sinVal2 * 0.5;
            }
        }
    }

    getTimeString() {
        const h = Math.floor(this.currentHour);
        const m = Math.floor((this.currentHour - h) * 60);
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    switchToWorld(type, playerPos) {
        // 清除当前世界的区块和资源
        for (const key of Object.keys(this.chunks)) {
            this._removeChunk(key);
        }
        this.chunks = {};
        for (const r of this.resources) {
            this.scene.remove(r.mesh);
            r.mesh.traverse(c => {
                if (c.geometry) c.geometry.dispose();
                if (c.material) c.material.dispose();
            });
        }
        this.resources = [];
        this.spawnedResourceChunks = new Set();

        if (type === 'stone') {
            // 进入石头世界：保存普通世界状态，从场景移除普通世界建筑
            this.returnPosition = playerPos.clone();
            this._normalBuildings = this.buildings;
            this._normalCampfires = this.campfires;
            for (const b of this.buildings) {
                this.scene.remove(b.mesh);
            }
            // 恢复或创建石头世界
            if (this._stoneBuildings) {
                this.buildings = this._stoneBuildings;
                this.campfires = this._stoneCampfires || [];
                for (const b of this.buildings) {
                    this.scene.add(b.mesh);
                }
            } else {
                this.buildings = [];
                this.campfires = [];
                const portalPos = new THREE.Vector3(0, this.getHeight(0, 0), 0);
                this.placeBuilding('portal', portalPos, 0);
            }
            this.worldType = 'stone';
            this.waterMesh.visible = false;
        } else if (type === 'gold') {
            // 进入金维度：保存当前世界状态
            this._goldReturnWorld = this.worldType;
            this._goldReturnPosition = playerPos.clone();
            if (this.worldType === 'normal') {
                this._normalBuildings = this.buildings;
                this._normalCampfires = this.campfires;
            } else if (this.worldType === 'stone') {
                this._stoneBuildings = this.buildings;
                this._stoneCampfires = this.campfires;
            }
            for (const b of this.buildings) {
                this.scene.remove(b.mesh);
            }
            // 恢复或创建金维度
            if (this._goldBuildings) {
                this.buildings = this._goldBuildings;
                this.campfires = this._goldCampfires || [];
                for (const b of this.buildings) {
                    this.scene.add(b.mesh);
                }
            } else {
                this.buildings = [];
                this.campfires = [];
                // 金维度不创建传送门，只能通过传送石碑或死亡离开
            }
            this.worldType = 'gold';
            this.waterMesh.visible = false;
        } else {
            // 返回普通世界：保存当前世界状态，从场景移除当前世界建筑
            if (this.worldType === 'stone') {
                this._stoneBuildings = this.buildings;
                this._stoneCampfires = this.campfires;
            } else if (this.worldType === 'gold') {
                this._goldBuildings = this.buildings;
                this._goldCampfires = this.campfires;
            }
            for (const b of this.buildings) {
                this.scene.remove(b.mesh);
            }
            // 恢复普通世界
            this.buildings = this._normalBuildings || [];
            this.campfires = this._normalCampfires || [];
            for (const b of this.buildings) {
                this.scene.add(b.mesh);
            }
            this.worldType = 'normal';
            this.waterMesh.visible = true;
        }

        // 重新生成区块
        let targetPos;
        if (type === 'stone') {
            targetPos = new THREE.Vector3(0, 0, 0);
        } else if (type === 'gold') {
            targetPos = new THREE.Vector3(0, 0, 0);
        } else {
            targetPos = this.returnPosition || new THREE.Vector3(0, 0, 0);
        }
        this.updateChunks(targetPos);
    }
}
