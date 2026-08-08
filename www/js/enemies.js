// 敌人AI系统

class EnemySystem {
    constructor(scene, world, player) {
        this.scene = scene;
        this.world = world;
        this.player = player;
        this.enemies = [];
        this.spawnTimer = 0;
        this.spawnInterval = 8;
        this.cowSpawnTimer = 0;
        this.cowSpawnInterval = 15;
        this.nightTreeChopCount = 0; // 夜晚砍树计数
        this.stoneMinedCount = 0; // 石头维度挖石头计数
        this._camera = null;
    }

    // Boss造成伤害：攻击本地玩家 + 同步到其他在线玩家
    _bossDamagePlayers(damage) {
        this.player.takeDamage(damage);
        if (window.game.multiplayer && window.game.multiplayer.connected) {
            for (const username of Object.keys(window.game.multiplayer.players)) {
                const p = window.game.multiplayer.players[username];
                if (p.health <= 0) continue;
                window.game.multiplayer.sendBossHitPlayer(username, damage);
            }
        }
    }

    // 创建血条+防御值精灵
    _createHealthBar(enemy) {
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 48;
        const tex = new THREE.CanvasTexture(canvas);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(1.5, 0.56, 1);
        sprite.position.y = 2.5;
        sprite.renderOrder = 999;
        enemy.mesh.add(sprite);
        enemy.healthBar = { canvas, tex, sprite };
        this._updateHealthBar(enemy);
    }

    // 更新血条显示
    _updateHealthBar(enemy) {
        if (!enemy.healthBar) return;
        const { canvas, tex } = enemy.healthBar;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 128, 48);
        // 背景
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(8, 8, 112, 16);
        // 血条
        const ratio = Math.max(0, enemy.health / enemy.maxHealth);
        const barW = 108 * ratio;
        let barColor = '#4caf50';
        if (ratio < 0.6) barColor = '#ff9800';
        if (ratio < 0.3) barColor = '#f44336';
        ctx.fillStyle = barColor;
        ctx.fillRect(10, 10, barW, 12);
        // 血量数字
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(enemy.health)}/${enemy.maxHealth}`, 64, 21);
        // 防御值
        const def = enemy.defense || 0;
        ctx.fillStyle = '#80d8ff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`🛡${def}`, 64, 42);
        tex.needsUpdate = true;
    }

    spawnEnemy() {
        const maxEnemies = 3 + this.world.dayCount;
        if (this.enemies.filter(e => !e.dead).length >= maxEnemies) return;

        const playerPos = this.player.position;
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 20;
        const x = playerPos.x + Math.cos(angle) * dist;
        const z = playerPos.z + Math.sin(angle) * dist;
        const y = this.world.getHeight(x, z);

        // 20%概率生成石之怪
        const isStoneMonster = Math.random() < 0.20;
        if (isStoneMonster) {
            this._spawnStoneMonster(x, y, z);
        } else {
            this._spawnZombie(x, y, z);
        }
    }

    // 夜晚砍树时调用，累计5棵生成树士卫
    onTreeChopped() {
        if (!this.world.isNight) return;
        this.nightTreeChopCount++;
        if (this.nightTreeChopCount >= 5) {
            this.nightTreeChopCount = 0;
            // 在玩家附近生成树士卫
            const playerPos = this.player.position;
            const angle = Math.random() * Math.PI * 2;
            const dist = 15 + Math.random() * 10;
            const x = playerPos.x + Math.cos(angle) * dist;
            const z = playerPos.z + Math.sin(angle) * dist;
            const y = this.world.getHeight(x, z);
            this._spawnTreeGuardian(x, y, z);
            if (window.game) window.game.onMessage('树士卫出现了！');
        }
    }

    // 白天重置砍树计数
    resetTreeChopCount() {
        this.nightTreeChopCount = 0;
    }

    // 石头维度挖石头时调用，累计15个生成石守卫
    onStoneMined() {
        if (this.world.worldType !== 'stone') return;
        this.stoneMinedCount++;
        if (this.stoneMinedCount >= 15) {
            this.stoneMinedCount = 0;
            const playerPos = this.player.position;
            const angle = Math.random() * Math.PI * 2;
            const dist = 8 + Math.random() * 6;
            const x = playerPos.x + Math.cos(angle) * dist;
            const z = playerPos.z + Math.sin(angle) * dist;
            const y = this.world.getHeight(x, z);
            this._spawnStoneGuardian(x, y, z);
            if (window.game) window.game.onMessage('石守卫出现了！');
        }
    }

    _spawnStoneGuardian(x, y, z) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // 身体 - 厚重石块，超高细分
        const bodyGeo = new THREE.BoxGeometry(0.9, 1.2, 0.7);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x5a5e64, roughness: 0.8, flatShading: false, metalness: 0.15, envMapIntensity: 0.5 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.8;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        // 胸口裂纹网络 - 横纹+竖纹+斜纹
        const crackMat = new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.95, flatShading: false });
        const crackH = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.04), crackMat);
        crackH.position.set(0, 0.9, 0.36); group.add(crackH);
        const crackV = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.04), crackMat);
        crackV.position.set(0.1, 0.95, 0.36); group.add(crackV);
        const crackD = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.04), crackMat);
        crackD.position.set(-0.08, 0.7, 0.36); crackD.rotation.z = 0.5; group.add(crackD);
        // 胸口发光核心
        const coreGeo = new THREE.SphereGeometry(0.1, 12, 10);
        const coreMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.7 });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.set(0, 0.9, 0.36);
        group.add(core);
        // 苔藓斑块 - 身体侧面
        const mossGeo = new THREE.DodecahedronGeometry(0.12, 1);
        const mossMat = new THREE.MeshStandardMaterial({ color: 0x4a6a2a, roughness: 0.9, flatShading: false, emissive: 0x1a3a0a, emissiveIntensity: 0.2 });
        const moss1 = new THREE.Mesh(mossGeo, mossMat);
        moss1.position.set(-0.46, 0.6, 0.2); moss1.scale.set(1, 0.3, 1); group.add(moss1);
        const moss2 = new THREE.Mesh(mossGeo, mossMat);
        moss2.position.set(0.46, 1.1, -0.1); moss2.scale.set(1, 0.4, 1); group.add(moss2);

        // 肩甲突起 - 超高细分 + 肩甲边缘
        const shoulderGeo = new THREE.DodecahedronGeometry(0.28, 2);
        const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.8, flatShading: false, metalness: 0.15 });
        const shoulderL = new THREE.Mesh(shoulderGeo, shoulderMat);
        shoulderL.position.set(-0.5, 1.3, 0);
        shoulderL.castShadow = true;
        group.add(shoulderL);
        const shoulderR = new THREE.Mesh(shoulderGeo, shoulderMat);
        shoulderR.position.set(0.5, 1.3, 0);
        shoulderR.castShadow = true;
        group.add(shoulderR);
        // 肩甲顶部尖刺
        const shoulderSpikeGeo = new THREE.ConeGeometry(0.06, 0.18, 6);
        const shoulderSpikeMat = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.7, flatShading: false });
        const ssL = new THREE.Mesh(shoulderSpikeGeo, shoulderSpikeMat);
        ssL.position.set(-0.5, 1.55, 0); group.add(ssL);
        const ssR = new THREE.Mesh(shoulderSpikeGeo, shoulderSpikeMat);
        ssR.position.set(0.5, 1.55, 0); group.add(ssR);

        // 头 - 石块，超高细分
        const headGeo = new THREE.IcosahedronGeometry(0.38, 2);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.75, flatShading: false, metalness: 0.15 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.7;
        head.castShadow = true;
        group.add(head);
        // 头部裂纹
        const headCrack = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.04), crackMat);
        headCrack.position.set(0.1, 1.7, 0.33); group.add(headCrack);

        // 眼睛 - 发光裂缝
        const eyeGeo = new THREE.SphereGeometry(0.08, 10, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.13, 1.72, 0.3);
        group.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.13, 1.72, 0.3);
        group.add(eyeR);
        // 眼睛光晕

        // 手臂 - 两侧石块，超高细分
        const armGeo = new THREE.BoxGeometry(0.3, 0.9, 0.3);
        const armMat = new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.8, flatShading: false, metalness: 0.15 });
        const armL = new THREE.Mesh(armGeo, armMat);
        armL.position.set(-0.65, 0.8, 0);
        armL.castShadow = true;
        group.add(armL);
        const armR = new THREE.Mesh(armGeo, armMat);
        armR.position.set(0.65, 0.8, 0);
        armR.castShadow = true;
        group.add(armR);
        // 手臂裂纹
        const armCrackL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.04), crackMat);
        armCrackL.position.set(-0.65, 0.8, 0.16); group.add(armCrackL);
        const armCrackR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.04), crackMat);
        armCrackR.position.set(0.65, 0.8, 0.16); group.add(armCrackR);
        // 拳头突起 - 超高细分
        const fistGeo = new THREE.DodecahedronGeometry(0.2, 2);
        const fistL = new THREE.Mesh(fistGeo, armMat);
        fistL.position.set(-0.65, 0.3, 0);
        fistL.castShadow = true;
        group.add(fistL);
        const fistR = new THREE.Mesh(fistGeo, armMat);
        fistR.position.set(0.65, 0.3, 0);
        fistR.castShadow = true;
        group.add(fistR);
        // 拳头指节
        const knuckleGeo = new THREE.SphereGeometry(0.05, 8, 6);
        const knuckleMat = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.7, flatShading: false });
        for (let i = 0; i < 3; i++) {
            const kL = new THREE.Mesh(knuckleGeo, knuckleMat);
            kL.position.set(-0.65 - 0.06 + i * 0.06, 0.18, 0.18); group.add(kL);
            const kR = new THREE.Mesh(knuckleGeo, knuckleMat);
            kR.position.set(0.65 - 0.06 + i * 0.06, 0.18, 0.18); group.add(kR);
        }

        // 腿 - 粗壮石柱
        const legGeo = new THREE.BoxGeometry(0.3, 0.6, 0.3);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.8, flatShading: false, metalness: 0.15 });
        const legL = new THREE.Mesh(legGeo, legMat);
        legL.position.set(-0.22, 0.15, 0);
        legL.castShadow = true;
        group.add(legL);
        const legR = new THREE.Mesh(legGeo, legMat);
        legR.position.set(0.22, 0.15, 0);
        legR.castShadow = true;
        group.add(legR);
        // 膝盖护甲
        const kneeGeo = new THREE.DodecahedronGeometry(0.12, 1);
        const kneeMat = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.7, flatShading: false });
        const kneeL = new THREE.Mesh(kneeGeo, kneeMat);
        kneeL.position.set(-0.22, 0.35, 0.12); group.add(kneeL);
        const kneeR = new THREE.Mesh(kneeGeo, kneeMat);
        kneeR.position.set(0.22, 0.35, 0.12); group.add(kneeR);
        // 脚下碎石
        const rubbleGeo = new THREE.DodecahedronGeometry(0.08, 0);
        const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.9, flatShading: false });
        for (let i = 0; i < 4; i++) {
            const ang = (i / 4) * Math.PI * 2;
            const r = new THREE.Mesh(rubbleGeo, rubbleMat);
            r.position.set(Math.cos(ang) * 0.35, 0.02, Math.sin(ang) * 0.25);
            r.scale.set(1, 0.5, 1);
            r.castShadow = true;
            group.add(r);
        }

        this.scene.add(group);

        const enemy = {
            mesh: group,
            health: 50,
            maxHealth: 50,
            speed: 1.8,
            damage: 16,
            attackRange: 1.8,
            attackCooldown: 0,
            dead: false,
            state: 'idle',
            wanderDir: new THREE.Vector3(),
            wanderTimer: 0,
            bodyMat: bodyMat,
            hitFlash: 0,
            enemyType: 'stone_guardian',
            playerHit: false,
            burning: false,
            dropsAwarded: false,
            defense: 1,
            takeDamage(amount, attacker = null) {
                if (attacker) this.playerHit = true;
                const actualDamage = Math.max(0, amount - this.defense);
                this.health -= actualDamage;
                this.hitFlash = 0.2;
                if (this.health <= 0) {
                    this.dead = true;
                    this.deathTimer = 0;
                }
            },
        };
        this.enemies.push(enemy);
        this._createHealthBar(enemy);
    }

    _spawnStoneMonsterBoss(x, y, z) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // 身体 - 巨大石块，超高细分
        const bodyGeo = new THREE.BoxGeometry(1.4, 1.8, 1.0);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.75, flatShading: false, metalness: 0.15, envMapIntensity: 0.5 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 1.2;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        // 胸口裂纹网络
        const bossCrackMat = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.95, flatShading: false });
        const bossCrackH = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.06), bossCrackMat);
        bossCrackH.position.set(0, 1.3, 0.51); group.add(bossCrackH);
        const bossCrackV = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), bossCrackMat);
        bossCrackV.position.set(0.15, 1.4, 0.51); group.add(bossCrackV);
        const bossCrackD = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.06, 0.06), bossCrackMat);
        bossCrackD.position.set(-0.1, 1.0, 0.51); bossCrackD.rotation.z = 0.4; group.add(bossCrackD);
        // 胸口发光核心
        const bossCoreGeo = new THREE.SphereGeometry(0.15, 12, 10);
        const bossCoreMat = new THREE.MeshBasicMaterial({ color: 0xff3300, transparent: true, opacity: 0.6 });
        const bossCore = new THREE.Mesh(bossCoreGeo, bossCoreMat);
        bossCore.position.set(0, 1.3, 0.51); group.add(bossCore);
        // 苔藓斑块
        const bossMossGeo = new THREE.DodecahedronGeometry(0.18, 1);
        const bossMossMat = new THREE.MeshStandardMaterial({ color: 0x4a6a2a, roughness: 0.9, flatShading: false, emissive: 0x1a3a0a, emissiveIntensity: 0.2 });
        const bmoss1 = new THREE.Mesh(bossMossGeo, bossMossMat);
        bmoss1.position.set(-0.72, 0.8, 0.3); bmoss1.scale.set(1, 0.3, 1); group.add(bmoss1);
        const bmoss2 = new THREE.Mesh(bossMossGeo, bossMossMat);
        bmoss2.position.set(0.72, 1.6, -0.2); bmoss2.scale.set(1, 0.4, 1); group.add(bmoss2);
        const bmoss3 = new THREE.Mesh(bossMossGeo, bossMossMat);
        bmoss3.position.set(0.3, 0.5, 0.5); bmoss3.scale.set(1, 0.3, 1); group.add(bmoss3);

        // 肩甲突起 - 超高细分 + 顶部尖刺
        const shoulderGeo = new THREE.DodecahedronGeometry(0.38, 2);
        const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.8, flatShading: false, metalness: 0.15 });
        const shoulderL = new THREE.Mesh(shoulderGeo, shoulderMat);
        shoulderL.position.set(-0.8, 2.0, 0);
        shoulderL.castShadow = true;
        group.add(shoulderL);
        const shoulderR = new THREE.Mesh(shoulderGeo, shoulderMat);
        shoulderR.position.set(0.8, 2.0, 0);
        shoulderR.castShadow = true;
        group.add(shoulderR);
        // 肩甲尖刺
        const bssGeo = new THREE.ConeGeometry(0.08, 0.25, 6);
        const bssMat = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.7, flatShading: false });
        const bssL = new THREE.Mesh(bssGeo, bssMat);
        bssL.position.set(-0.8, 2.35, 0); group.add(bssL);
        const bssR = new THREE.Mesh(bssGeo, bssMat);
        bssR.position.set(0.8, 2.35, 0); group.add(bssR);

        // 头 - 巨大石块，超高细分
        const headGeo = new THREE.IcosahedronGeometry(0.58, 2);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x5a5e64, roughness: 0.7, flatShading: false, metalness: 0.15 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 2.5;
        head.castShadow = true;
        group.add(head);
        // 头部裂纹
        const headCrack1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), bossCrackMat);
        headCrack1.position.set(0.15, 2.55, 0.5); group.add(headCrack1);
        const headCrack2 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.06), bossCrackMat);
        headCrack2.position.set(-0.1, 2.35, 0.5); headCrack2.rotation.z = 0.5; group.add(headCrack2);

        // 眼睛 - 发光红缝
        const eyeGeo = new THREE.SphereGeometry(0.12, 10, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.2, 2.55, 0.48);
        group.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.2, 2.55, 0.48);
        group.add(eyeR);
        // 眼睛光晕
        const bossEyeLight = new THREE.PointLight(0xff2200, 1.2, 6);
        bossEyeLight.position.set(0, 2.55, 0.5);
        group.add(bossEyeLight);

        // 手臂 - 粗壮石臂，超高细分
        const armGeo = new THREE.BoxGeometry(0.4, 1.4, 0.4);
        const armMat = new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.8, flatShading: false, metalness: 0.15 });
        const armL = new THREE.Mesh(armGeo, armMat);
        armL.position.set(-1.0, 1.2, 0);
        armL.castShadow = true;
        group.add(armL);
        const armR = new THREE.Mesh(armGeo, armMat);
        armR.position.set(1.0, 1.2, 0);
        armR.castShadow = true;
        group.add(armR);
        // 手臂裂纹
        const bArmCrackL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), bossCrackMat);
        bArmCrackL.position.set(-1.0, 1.2, 0.21); group.add(bArmCrackL);
        const bArmCrackR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), bossCrackMat);
        bArmCrackR.position.set(1.0, 1.2, 0.21); group.add(bArmCrackR);
        // 拳头 - 超高细分
        const fistGeo = new THREE.DodecahedronGeometry(0.28, 2);
        const fistL = new THREE.Mesh(fistGeo, armMat);
        fistL.position.set(-1.0, 0.4, 0);
        fistL.castShadow = true;
        group.add(fistL);
        const fistR = new THREE.Mesh(fistGeo, armMat);
        fistR.position.set(1.0, 0.4, 0);
        fistR.castShadow = true;
        group.add(fistR);
        // 拳头指节
        const bKnuckleGeo = new THREE.SphereGeometry(0.07, 8, 6);
        const bKnuckleMat = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.7, flatShading: false });
        for (let i = 0; i < 3; i++) {
            const kL = new THREE.Mesh(bKnuckleGeo, bKnuckleMat);
            kL.position.set(-1.0 - 0.08 + i * 0.08, 0.22, 0.25); group.add(kL);
            const kR = new THREE.Mesh(bKnuckleGeo, bKnuckleMat);
            kR.position.set(1.0 - 0.08 + i * 0.08, 0.22, 0.25); group.add(kR);
        }

        // 腿 - 粗壮石柱
        const legGeo = new THREE.BoxGeometry(0.45, 0.9, 0.45);
        const legL = new THREE.Mesh(legGeo, armMat);
        legL.position.set(-0.35, 0.25, 0);
        legL.castShadow = true;
        group.add(legL);
        const legR = new THREE.Mesh(legGeo, armMat);
        legR.position.set(0.35, 0.25, 0);
        legR.castShadow = true;
        group.add(legR);
        // 膝盖护甲
        const bKneeGeo = new THREE.DodecahedronGeometry(0.18, 1);
        const bKneeMat = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.7, flatShading: false });
        const bKneeL = new THREE.Mesh(bKneeGeo, bKneeMat);
        bKneeL.position.set(-0.35, 0.55, 0.18); group.add(bKneeL);
        const bKneeR = new THREE.Mesh(bKneeGeo, bKneeMat);
        bKneeR.position.set(0.35, 0.55, 0.18); group.add(bKneeR);
        // 脚下碎石
        const bRubbleGeo = new THREE.DodecahedronGeometry(0.12, 0);
        const bRubbleMat = new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.9, flatShading: false });
        for (let i = 0; i < 5; i++) {
            const ang = (i / 5) * Math.PI * 2;
            const r = new THREE.Mesh(bRubbleGeo, bRubbleMat);
            r.position.set(Math.cos(ang) * 0.5, 0.02, Math.sin(ang) * 0.35);
            r.scale.set(1, 0.5, 1);
            r.castShadow = true;
            group.add(r);
        }

        // 背部石刺 - 超高细分，4根 + 底部小刺
        for (let i = 0; i < 4; i++) {
            const spikeGeo = new THREE.ConeGeometry(0.15, 0.55, 8);
            const spike = new THREE.Mesh(spikeGeo, headMat);
            spike.position.set(0, 1.4 + i * 0.4, -0.5);
            spike.rotation.x = -0.3;
            spike.castShadow = true;
            group.add(spike);
        }
        // 背部小碎石
        const backRubbleGeo = new THREE.DodecahedronGeometry(0.1, 0);
        for (let i = 0; i < 3; i++) {
            const r = new THREE.Mesh(backRubbleGeo, shoulderMat);
            r.position.set((i - 1) * 0.3, 1.2 + i * 0.3, -0.48);
            r.castShadow = true;
            group.add(r);
        }

        this.scene.add(group);

        const enemy = {
            mesh: group,
            health: 150,
            maxHealth: 150,
            speed: 1.8,
            damage: 18,
            rangedDamage: 20,
            attackRange: 1.0,
            rangedRange: 8.0,
            detectRange: 30.0,
            attackCooldown: 0,
            rangedCooldown: 0,
            dead: false,
            state: 'chase',
            wanderDir: new THREE.Vector3(),
            wanderTimer: 0,
            bodyMat: bodyMat,
            hitFlash: 0,
            enemyType: 'stone_monster_boss',
            playerHit: false,
            burning: false,
            dropsAwarded: false,
            defense: 8,
            projectiles: [],
            takeDamage(amount, attacker = null) {
                if (attacker) this.playerHit = true;
                const actualDamage = Math.max(0, amount - this.defense);
                this.health -= actualDamage;
                this.hitFlash = 0.2;
                if (this.health <= 0) {
                    this.dead = true;
                    this.deathTimer = 0;
                }
            },
        };
        this.enemies.push(enemy);
        this._createHealthBar(enemy);
    }

    _spawnStoneBall(enemy, targetPos) {
        const enemyPos = enemy.mesh.position.clone();
        enemyPos.y += 2.0;
        const dir = targetPos.clone().sub(enemyPos);
        dir.y = 0;
        dir.normalize();

        const ballGeo = new THREE.DodecahedronGeometry(0.4, 1);
        const ballMat = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.55, flatShading: false });
        const ball = new THREE.Mesh(ballGeo, ballMat);
        ball.position.copy(enemyPos);
        ball.castShadow = true;
        this.scene.add(ball);

        enemy.projectiles.push({
            mesh: ball,
            velocity: dir.multiplyScalar(12),
            damage: enemy.rangedDamage,
            life: 5,
            distance: 0,
            maxDistance: 35,
            mat: ballMat,
            geo: ballGeo,
        });
    }

    _updateStoneBalls(enemy, dt) {
        if (!enemy.projectiles) return;
        for (let i = enemy.projectiles.length - 1; i >= 0; i--) {
            const p = enemy.projectiles[i];
            const moveDist = p.velocity.clone().multiplyScalar(dt);
            p.mesh.position.add(moveDist);
            p.distance += moveDist.length();
            // 速度逐渐变慢
            p.velocity.multiplyScalar(0.98);
            p.life -= dt;
            // 碰撞检测：玩家
            const dist = p.mesh.position.distanceTo(this.player.position);
            if (dist < 0.9) {
                this._bossDamagePlayers(p.damage);
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mat.dispose();
                enemy.projectiles.splice(i, 1);
                continue;
            }
            // 碰撞检测：树精/树士卫
            for (const other of this.enemies) {
                if (other.dead || other === enemy) continue;
                if (other.enemyType !== 'tree_spirit' && other.enemyType !== 'tree_guardian' && other.enemyType !== 'tree_guardian_enhanced') continue;
                const d = p.mesh.position.distanceTo(other.mesh.position);
                if (d < 1.0) {
                    other.takeDamage(p.damage);
                    this.scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    p.mat.dispose();
                    enemy.projectiles.splice(i, 1);
                    break;
                }
            }
            if (i >= enemy.projectiles.length) continue;
            // 地面碰撞
            const groundY = this.world.getHeight(p.mesh.position.x, p.mesh.position.z);
            if (p.mesh.position.y < groundY) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mat.dispose();
                enemy.projectiles.splice(i, 1);
                continue;
            }
            // 距离上限或生命结束
            if (p.distance >= p.maxDistance || p.life <= 0) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mat.dispose();
                enemy.projectiles.splice(i, 1);
            }
        }
    }

    _spawnGiantStoneBoss(x, y, z) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // 身体 - 巨大石块，超高细分
        const bodyGeo = new THREE.BoxGeometry(3.0, 4.0, 2.5);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3a3e44, roughness: 0.8, flatShading: false, metalness: 0.15, envMapIntensity: 0.5 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 2.5;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        // 胸口裂纹网络 - 多条裂纹
        const gCrackMat = new THREE.MeshStandardMaterial({ color: 0x0a0e14, roughness: 0.95, flatShading: false });
        const gCrackH = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.1), gCrackMat);
        gCrackH.position.set(0, 2.8, 1.26); group.add(gCrackH);
        const gCrackV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.1), gCrackMat);
        gCrackV.position.set(0.3, 2.9, 1.26); group.add(gCrackV);
        const gCrackD1 = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.1, 0.1), gCrackMat);
        gCrackD1.position.set(-0.2, 2.2, 1.26); gCrackD1.rotation.z = 0.4; group.add(gCrackD1);
        const gCrackD2 = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.1), gCrackMat);
        gCrackD2.position.set(0.1, 3.5, 1.26); gCrackD2.rotation.z = -0.3; group.add(gCrackD2);
        // 岩浆发光脉络 - 橙红色发光裂缝
        const magmaMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.7 });
        const magma1 = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.06), magmaMat);
        magma1.position.set(0, 2.8, 1.27); group.add(magma1);
        const magma2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.06), magmaMat);
        magma2.position.set(0.3, 2.9, 1.27); group.add(magma2);
        const magma3 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), magmaMat);
        magma3.position.set(-0.2, 2.2, 1.27); magma3.rotation.z = 0.4; group.add(magma3);
        // 岩浆光源
        const magmaLight = new THREE.PointLight(0xff4400, 1.5, 8);
        magmaLight.position.set(0, 2.8, 1.3);
        group.add(magmaLight);
        // 苔藓斑块
        const gMossGeo = new THREE.DodecahedronGeometry(0.25, 1);
        const gMossMat = new THREE.MeshStandardMaterial({ color: 0x4a6a2a, roughness: 0.9, flatShading: false, emissive: 0x1a3a0a, emissiveIntensity: 0.2 });
        const gMoss1 = new THREE.Mesh(gMossGeo, gMossMat);
        gMoss1.position.set(-1.55, 1.5, 0.5); gMoss1.scale.set(1, 0.3, 1); group.add(gMoss1);
        const gMoss2 = new THREE.Mesh(gMossGeo, gMossMat);
        gMoss2.position.set(1.55, 3.0, -0.3); gMoss2.scale.set(1, 0.4, 1); group.add(gMoss2);

        // 肩甲突起 - 超高细分 + 顶部尖刺
        const shoulderGeo = new THREE.DodecahedronGeometry(0.85, 2);
        const shoulderMat = new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.8, flatShading: false, metalness: 0.15 });
        const shoulderL = new THREE.Mesh(shoulderGeo, shoulderMat);
        shoulderL.position.set(-1.8, 4.2, 0);
        shoulderL.castShadow = true;
        group.add(shoulderL);
        const shoulderR = new THREE.Mesh(shoulderGeo, shoulderMat);
        shoulderR.position.set(1.8, 4.2, 0);
        shoulderR.castShadow = true;
        group.add(shoulderR);
        // 肩甲尖刺
        const gssGeo = new THREE.ConeGeometry(0.15, 0.5, 6);
        const gssMat = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.7, flatShading: false });
        const gssL = new THREE.Mesh(gssGeo, gssMat);
        gssL.position.set(-1.8, 5.0, 0); group.add(gssL);
        const gssR = new THREE.Mesh(gssGeo, gssMat);
        gssR.position.set(1.8, 5.0, 0); group.add(gssR);

        // 头 - 巨大石块，超高细分
        const headGeo = new THREE.IcosahedronGeometry(1.25, 2);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.75, flatShading: false, metalness: 0.15 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 5.5;
        head.castShadow = true;
        group.add(head);
        // 头部裂纹
        const gHeadCrack1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), gCrackMat);
        gHeadCrack1.position.set(0.3, 5.6, 1.0); group.add(gHeadCrack1);
        const gHeadCrack2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.1), gCrackMat);
        gHeadCrack2.position.set(-0.2, 5.2, 1.0); gHeadCrack2.rotation.z = 0.5; group.add(gHeadCrack2);

        // 眼睛 - 灰色（阶段1）
        const eyeGeo = new THREE.SphereGeometry(0.28, 12, 10);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x888888 });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.4, 5.7, 1.0);
        group.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.4, 5.7, 1.0);
        group.add(eyeR);

        // 手臂 - 巨大石臂，超高细分
        const armGeo = new THREE.BoxGeometry(0.9, 3.5, 0.9);
        const armMat = new THREE.MeshStandardMaterial({ color: 0x2a2e34, roughness: 0.8, flatShading: false, metalness: 0.15 });
        const armL = new THREE.Mesh(armGeo, armMat);
        armL.position.set(-2.2, 2.5, 0);
        armL.castShadow = true;
        group.add(armL);
        const armR = new THREE.Mesh(armGeo, armMat);
        armR.position.set(2.2, 2.5, 0);
        armR.castShadow = true;
        group.add(armR);
        // 手臂裂纹
        const gArmCrackL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), gCrackMat);
        gArmCrackL.position.set(-2.2, 2.5, 0.46); group.add(gArmCrackL);
        const gArmCrackR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), gCrackMat);
        gArmCrackR.position.set(2.2, 2.5, 0.46); group.add(gArmCrackR);
        // 巨拳 - 超高细分
        const fistGeo = new THREE.DodecahedronGeometry(0.65, 2);
        const fistL = new THREE.Mesh(fistGeo, armMat);
        fistL.position.set(-2.2, 0.6, 0);
        fistL.castShadow = true;
        group.add(fistL);
        const fistR = new THREE.Mesh(fistGeo, armMat);
        fistR.position.set(2.2, 0.6, 0);
        fistR.castShadow = true;
        group.add(fistR);
        // 拳头指节
        const gKnuckleGeo = new THREE.SphereGeometry(0.12, 10, 8);
        const gKnuckleMat = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.7, flatShading: false });
        for (let i = 0; i < 3; i++) {
            const kL = new THREE.Mesh(gKnuckleGeo, gKnuckleMat);
            kL.position.set(-2.2 - 0.15 + i * 0.15, 0.3, 0.55); group.add(kL);
            const kR = new THREE.Mesh(gKnuckleGeo, gKnuckleMat);
            kR.position.set(2.2 - 0.15 + i * 0.15, 0.3, 0.55); group.add(kR);
        }

        // 腿 - 巨大石柱
        const legGeo = new THREE.BoxGeometry(1.0, 2.5, 1.0);
        const legL = new THREE.Mesh(legGeo, armMat);
        legL.position.set(-0.8, 0.6, 0);
        legL.castShadow = true;
        group.add(legL);
        const legR = new THREE.Mesh(legGeo, armMat);
        legR.position.set(0.8, 0.6, 0);
        legR.castShadow = true;
        group.add(legR);
        // 膝盖护甲
        const gKneeGeo = new THREE.DodecahedronGeometry(0.35, 1);
        const gKneeMat = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.7, flatShading: false });
        const gKneeL = new THREE.Mesh(gKneeGeo, gKneeMat);
        gKneeL.position.set(-0.8, 1.2, 0.4); group.add(gKneeL);
        const gKneeR = new THREE.Mesh(gKneeGeo, gKneeMat);
        gKneeR.position.set(0.8, 1.2, 0.4); group.add(gKneeR);
        // 脚下巨石碎片
        const gRubbleGeo = new THREE.DodecahedronGeometry(0.25, 0);
        const gRubbleMat = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.9, flatShading: false });
        for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2;
            const r = new THREE.Mesh(gRubbleGeo, gRubbleMat);
            r.position.set(Math.cos(ang) * 1.1, 0.02, Math.sin(ang) * 0.8);
            r.scale.set(1, 0.5, 1);
            r.castShadow = true;
            group.add(r);
        }

        // 背部石刺 - 超高细分，5根 + 底部小碎石
        for (let i = 0; i < 5; i++) {
            const spikeGeo = new THREE.ConeGeometry(0.4, 1.3, 8);
            const spike = new THREE.Mesh(spikeGeo, headMat);
            spike.position.set(0, 3.2 + i * 1.0, -1.3);
            spike.rotation.x = -0.3;
            spike.castShadow = true;
            group.add(spike);
        }
        // 背部小碎石
        const gBackRubbleGeo = new THREE.DodecahedronGeometry(0.18, 0);
        for (let i = 0; i < 4; i++) {
            const r = new THREE.Mesh(gBackRubbleGeo, shoulderMat);
            r.position.set((i - 1.5) * 0.5, 2.8 + i * 0.4, -1.25);
            r.castShadow = true;
            group.add(r);
        }

        this.scene.add(group);

        const enemy = {
            mesh: group,
            health: 1000,
            maxHealth: 1000,
            speed: 0.3,
            damage: 70,
            attackRange: 3.0,
            attackCooldown: 0,
            dead: false,
            state: 'chase',
            wanderDir: new THREE.Vector3(),
            wanderTimer: 0,
            bodyMat: bodyMat,
            headMat: headMat,
            eyeMat: eyeMat,
            armL: armL,
            armR: armR,
            hitFlash: 0,
            enemyType: 'giant_stone_boss',
            playerHit: false,
            burning: false,
            dropsAwarded: false,
            defense: 8,
            phase: 1,
            phase2Triggered: false,
            // 技能计时器
            boulderTimer: 10,       // 阶段1：每10s投巨石
            digTimer: 10,           // 阶段1：每10s钻地
            trackingTimer: 6.45,    // 阶段2：每6.45s扔追踪石头
            groundSlamTimer: 8,     // 阶段2：每8s地砸
            // 钻地状态
            digging: false,
            digPhase: 0,            // 0=normal, 1=underground, 2=emerging
            digTimer2: 0,
            // 地砸状态
            slamming: false,
            slamTimer: 0,
            // 弹射物
            projectiles: [],
            // 抵消值（阶段2）
            absorbValue: 0,
            takeDamage(amount, attacker = null) {
                if (attacker) this.playerHit = true;
                if (this.phase === 2) {
                    // 阶段2：抵消值真正抵消伤害
                    if (this.absorbValue > 0) {
                        const absorbed = Math.min(this.absorbValue, amount);
                        this.absorbValue -= absorbed;
                        amount -= absorbed;
                    }
                    if (amount > 0) {
                        const actualDamage = Math.max(0, amount - this.defense);
                        this.health -= actualDamage;
                    }
                } else {
                    const actualDamage = Math.max(0, amount - this.defense);
                    this.health -= actualDamage;
                }
                this.hitFlash = 0.2;
                if (this.health <= 0) {
                    this.dead = true;
                    this.deathTimer = 0;
                }
            },
        };
        this.enemies.push(enemy);
        this._createHealthBar(enemy);
    }

    _spawnGiantBoulder(enemy, targetPos) {
        const enemyPos = enemy.mesh.position.clone();
        enemyPos.y += 6.0;
        const dir = targetPos.clone().sub(enemyPos);
        dir.y = 0;
        const dist = dir.length();
        dir.normalize();

        const boulderGeo = new THREE.DodecahedronGeometry(1.5, 1);
        const boulderMat = new THREE.MeshStandardMaterial({ color: 0x5a5e64, roughness: 0.65, flatShading: false });
        const boulder = new THREE.Mesh(boulderGeo, boulderMat);
        boulder.position.copy(enemyPos);
        boulder.castShadow = true;
        this.scene.add(boulder);

        // 速度计算：到达12m处
        const targetDist = Math.min(dist, 12);
        const speed = 15;
        const velocity = dir.clone().multiplyScalar(speed);
        velocity.y = 6; // 抛物线

        enemy.projectiles.push({
            mesh: boulder,
            velocity: velocity,
            damage: 20,
            life: 5,
            type: 'giant_boulder',
            mat: boulderMat,
            geo: boulderGeo,
            split: true,
            splitDir: dir.clone(),
        });
    }

    _spawnTrackingStone(enemy, targetPos) {
        const enemyPos = enemy.mesh.position.clone();
        enemyPos.y += 6.0;
        const dir = targetPos.clone().sub(enemyPos);
        dir.normalize();

        const stoneGeo = new THREE.IcosahedronGeometry(0.6, 1);
        const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.45, flatShading: false, emissive: 0x222222 });
        const stone = new THREE.Mesh(stoneGeo, stoneMat);
        stone.position.copy(enemyPos);
        stone.castShadow = true;
        this.scene.add(stone);

        enemy.projectiles.push({
            mesh: stone,
            velocity: dir.multiplyScalar(8), // 疾跑速度
            damage: 15,
            life: 10,
            type: 'tracking_stone',
            mat: stoneMat,
            geo: stoneGeo,
            tracking: true,
            trackRange: 60,
        });
    }

    _updateGiantStoneProjectiles(enemy, dt) {
        if (!enemy.projectiles) return;
        for (let i = enemy.projectiles.length - 1; i >= 0; i--) {
            const p = enemy.projectiles[i];
            if (p.type === 'tracking_stone') {
                // 追踪石头：追踪玩家
                const toPlayer = this.player.position.clone().sub(p.mesh.position);
                const distToPlayer = toPlayer.length();
                if (distToPlayer < p.trackRange) {
                    toPlayer.normalize();
                    p.velocity.x = toPlayer.x * 8;
                    p.velocity.z = toPlayer.z * 8;
                    p.velocity.y = toPlayer.y * 8;
                }
                p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
                p.life -= dt;
                // 碰撞检测：玩家
                const dist = p.mesh.position.distanceTo(this.player.position);
                if (dist < 1.2) {
                    this._bossDamagePlayers(p.damage);
                    this.scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    p.mat.dispose();
                    enemy.projectiles.splice(i, 1);
                    continue;
                }
                if (p.life <= 0) {
                    this.scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    p.mat.dispose();
                    enemy.projectiles.splice(i, 1);
                    continue;
                }
            } else if (p.type === 'giant_boulder') {
                // 巨石：抛物线飞行
                p.velocity.y -= 20 * dt; // 重力
                p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
                p.life -= dt;
                // 碰撞检测：玩家
                const dist = p.mesh.position.distanceTo(this.player.position);
                if (dist < 2.0) {
                    this._bossDamagePlayers(p.damage);
                    // 分裂成8个小石头
                    if (p.split) {
                        this._spawnBoulderFragments(enemy, p.mesh.position.clone(), p.splitDir);
                    }
                    this.scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    p.mat.dispose();
                    enemy.projectiles.splice(i, 1);
                    continue;
                }
                // 地面碰撞
                const groundY = this.world.getHeight(p.mesh.position.x, p.mesh.position.z);
                if (p.mesh.position.y <= groundY) {
                    // 分裂成8个小石头
                    if (p.split) {
                        this._spawnBoulderFragments(enemy, p.mesh.position.clone(), p.splitDir);
                    }
                    this.scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    p.mat.dispose();
                    enemy.projectiles.splice(i, 1);
                    continue;
                }
                if (p.life <= 0) {
                    if (p.split) {
                        this._spawnBoulderFragments(enemy, p.mesh.position.clone(), p.splitDir);
                    }
                    this.scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    p.mat.dispose();
                    enemy.projectiles.splice(i, 1);
                    continue;
                }
            } else if (p.type === 'boulder_fragment') {
                // 小石头碎片
                p.velocity.y -= 20 * dt;
                p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
                p.life -= dt;
                // 碰撞检测：玩家
                const dist = p.mesh.position.distanceTo(this.player.position);
                if (dist < 1.0) {
                    this._bossDamagePlayers(p.damage);
                    this.scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    p.mat.dispose();
                    enemy.projectiles.splice(i, 1);
                    continue;
                }
                // 地面碰撞
                const groundY = this.world.getHeight(p.mesh.position.x, p.mesh.position.z);
                if (p.mesh.position.y <= groundY) {
                    this.scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    p.mat.dispose();
                    enemy.projectiles.splice(i, 1);
                    continue;
                }
                if (p.life <= 0) {
                    this.scene.remove(p.mesh);
                    p.mesh.geometry.dispose();
                    p.mat.dispose();
                    enemy.projectiles.splice(i, 1);
                }
            }
        }
    }

    _spawnBoulderFragments(enemy, pos, baseDir) {
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const fragGeo = new THREE.DodecahedronGeometry(0.5, 1);
            const fragMat = new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.75, flatShading: false });
            const frag = new THREE.Mesh(fragGeo, fragMat);
            frag.position.copy(pos);
            frag.castShadow = true;
            this.scene.add(frag);

            const dir = new THREE.Vector3(Math.cos(angle), 0.5, Math.sin(angle));
            enemy.projectiles.push({
                mesh: frag,
                velocity: dir.multiplyScalar(8),
                damage: 4,
                life: 3,
                type: 'boulder_fragment',
                mat: fragMat,
                geo: fragGeo,
            });
        }
    }

    _updateGiantStoneBossAI(e, dt, playerPos) {
        // 阶段切换
        if (!e.phase2Triggered && e.health <= e.maxHealth / 2) {
            e.phase2Triggered = true;
            e.phase = 2;
            e.health = 1000;
            e.maxHealth = 1000;
            e.defense = 8;
            e.absorbValue = 0;
            // 眼睛变白色
            e.eyeMat.color.setHex(0xffffff);
            if (window.game) window.game.onMessage('巨石怪进入第2阶段！');
        }

        // 技能计时器递减
        e.boulderTimer -= dt;
        e.digTimer -= dt;
        e.trackingTimer -= dt;
        e.groundSlamTimer -= dt;

        // 更新弹射物
        this._updateGiantStoneProjectiles(e, dt);

        // 钻地状态处理
        if (e.digging) {
            e.digTimer2 += dt;
            if (e.digPhase === 0) {
                // 钻进地下
                e.mesh.position.y = Math.max(-3, e.mesh.position.y - 10 * dt);
                e.mesh.scale.setScalar(Math.max(0.1, e.mesh.scale.x - 3 * dt));
                if (e.digTimer2 >= 1.0) {
                    e.digPhase = 1;
                    e.digTimer2 = 0;
                    // 传送到玩家下方
                    e.mesh.position.x = playerPos.x;
                    e.mesh.position.z = playerPos.z;
                    const groundY = this.world.getHeight(playerPos.x, playerPos.z);
                    e.mesh.position.y = groundY - 3;
                }
            } else if (e.digPhase === 1) {
                // 在地下等待1.67s后出来
                if (e.digTimer2 >= 1.0) {
                    e.digPhase = 2;
                    e.digTimer2 = 0;
                }
            } else if (e.digPhase === 2) {
                // 钻出来
                const groundY = this.world.getHeight(e.mesh.position.x, e.mesh.position.z);
                e.mesh.position.y = Math.min(groundY, e.mesh.position.y + 10 * dt);
                e.mesh.scale.setScalar(Math.min(1.0, e.mesh.scale.x + 3 * dt));
                if (e.mesh.position.y >= groundY - 0.1 && e.mesh.scale.x >= 0.99) {
                    e.mesh.position.y = groundY;
                    e.mesh.scale.setScalar(1.0);
                    e.digging = false;
                    e.digPhase = 0;
                    e.digTimer2 = 0;
                    // 出来时对上方2m内生物造成40伤害
                    const distToPlayer = e.mesh.position.distanceTo(playerPos);
                    if (distToPlayer < 2.0) {
                        this._bossDamagePlayers(40);
                    }
                    for (const other of this.enemies) {
                        if (other.dead || other === e) continue;
                        const d = e.mesh.position.distanceTo(other.mesh.position);
                        if (d < 2.0) {
                            other.takeDamage(40);
                        }
                    }
                    if (window.game) window.game.onMessage('巨石怪钻出地面！');
                }
            }
            return;
        }

        // 地砸状态处理（带动画）
        if (e.slamming) {
            e.slamTimer += dt;
            const t = e.slamTimer;
            // 动画：0-1.2s抬手，1.2-2.0s蓄力震动，2.0s砸下，2.0-2.5s恢复
            if (t < 1.2) {
                // 抬手：双臂缓慢向上旋转
                const p = t / 1.2;
                const angle = -p * Math.PI * 0.6;
                e.armL.rotation.x = angle;
                e.armR.rotation.x = angle;
                // 身体微微下蹲蓄力
                e.mesh.position.y = e.slamBaseY - p * 0.3;
            } else if (t < 2.0) {
                // 蓄力：手臂保持抬起，身体震动
                const p = (t - 1.2) / 0.8;
                const shake = Math.sin(p * Math.PI * 6) * 0.05;
                e.armL.rotation.x = -Math.PI * 0.6;
                e.armR.rotation.x = -Math.PI * 0.6;
                e.mesh.position.x = e.slamBaseX + shake;
                e.mesh.position.y = e.slamBaseY - 0.3 - Math.abs(shake) * 0.5;
            } else if (t < 2.05 && !e.slamHit) {
                // 砸下：手臂快速落下
                e.slamHit = true;
                e.armL.rotation.x = 0.3;
                e.armR.rotation.x = 0.3;
                e.mesh.position.y = e.slamBaseY;
                // 砸下瞬间：对前方40m长3m宽矩形区域内生物造成150伤害
                const slamDir = e.slamDir;
                const bossPos = e.mesh.position;
                // 检查玩家
                const toPlayer = new THREE.Vector3().subVectors(playerPos, bossPos);
                toPlayer.y = 0;
                const forwardDist = toPlayer.dot(slamDir);
                const sideVec = new THREE.Vector3(-slamDir.z, 0, slamDir.x);
                const sideDist = Math.abs(toPlayer.dot(sideVec));
                if (forwardDist > 0 && forwardDist < 40 && sideDist < 1.5) {
                    this._bossDamagePlayers(150);
                }
                for (const other of this.enemies) {
                    if (other.dead || other === e) continue;
                    const toOther = new THREE.Vector3().subVectors(other.mesh.position, bossPos);
                    toOther.y = 0;
                    const fwd = toOther.dot(slamDir);
                    const sd = Math.abs(toOther.dot(sideVec));
                    if (fwd > 0 && fwd < 40 && sd < 1.5) {
                        other.takeDamage(150);
                    }
                }
                // 屏幕震动效果
                if (window.game && window.game.player) {
                    window.game.player.cameraShake = 0.5;
                }
                if (window.game) window.game.onMessage('巨石怪地砸造成毁灭性打击！');
            } else if (t >= 2.05) {
                // 恢复
                const p = Math.min(1, (t - 2.05) / 0.45);
                e.armL.rotation.x = 0.3 * (1 - p);
                e.armR.rotation.x = 0.3 * (1 - p);
                e.mesh.position.x = e.slamBaseX;
                e.mesh.position.y = e.slamBaseY;
            }
            if (t >= 2.5) {
                e.slamming = false;
                e.slamTimer = 0;
                e.slamHit = false;
                e.armL.rotation.x = 0;
                e.armR.rotation.x = 0;
            }
            return;
        }

        // 阶段1技能
        if (e.phase === 1) {
            // 每10s投巨石
            if (e.boulderTimer <= 0) {
                e.boulderTimer = 10;
                this._spawnGiantBoulder(e, playerPos);
            }
            // 每10s钻地
            if (e.digTimer <= 0) {
                e.digTimer = 10;
                e.digging = true;
                e.digPhase = 0;
                e.digTimer2 = 0;
                if (window.game) window.game.onMessage('巨石怪钻入地下！');
            }
        }

        // 阶段2技能
        if (e.phase === 2) {
            // 每6.45s扔2个追踪石头
            if (e.trackingTimer <= 0) {
                e.trackingTimer = 6.45;
                this._spawnTrackingStone(e, playerPos);
                this._spawnTrackingStone(e, playerPos);
            }
            // 每8s地砸
            if (e.groundSlamTimer <= 0) {
                e.groundSlamTimer = 8;
                e.slamming = true;
                e.slamTimer = 0;
                e.slamHit = false;
                e.slamBaseX = e.mesh.position.x;
                e.slamBaseY = e.mesh.position.y;
                e.slamBaseZ = e.mesh.position.z;
                // 锁定朝向（砸地期间不转向）
                const dir = playerPos.clone().sub(e.mesh.position);
                dir.y = 0;
                dir.normalize();
                e.slamDir = dir;
                e.mesh.rotation.y = Math.atan2(dir.x, dir.z);
                if (window.game) window.game.onMessage('巨石怪准备地砸！');
            }
        }

        // 移动：极慢追击玩家
        const distToPlayer = e.mesh.position.distanceTo(playerPos);
        if (distToPlayer > e.attackRange) {
            const dir = playerPos.clone().sub(e.mesh.position);
            dir.y = 0;
            dir.normalize();
            e.mesh.position.x += dir.x * e.speed * dt;
            e.mesh.position.z += dir.z * e.speed * dt;
            e.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        }

        // 近战攻击
        if (distToPlayer < e.attackRange && e.attackCooldown <= 0) {
            e.attackCooldown = 2.0;
            this._bossDamagePlayers(e.damage);
        }
    }

    _spawnZombie(x, y, z) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // 身体 - 超高细分
        const bodyGeo = new THREE.CapsuleGeometry(0.35, 0.8, 8, 16);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8b2222, roughness: 0.65, flatShading: false, metalness: 0.05 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.75;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        // 破烂衣物碎片
        const ragGeo = new THREE.BoxGeometry(0.15, 0.25, 0.02);
        const ragMat = new THREE.MeshStandardMaterial({ color: 0x3a1a0a, roughness: 0.9, flatShading: false });
        const rag1 = new THREE.Mesh(ragGeo, ragMat);
        rag1.position.set(-0.25, 0.6, 0.33); rag1.rotation.z = 0.3; group.add(rag1);
        const rag2 = new THREE.Mesh(ragGeo, ragMat);
        rag2.position.set(0.2, 0.9, 0.33); rag2.rotation.z = -0.2; group.add(rag2);
        const rag3 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.02), ragMat);
        rag3.position.set(0.1, 0.4, 0.33); rag3.rotation.z = 0.4; group.add(rag3);
        // 肋骨 - 胸腔骨骼外露
        const ribGeo = new THREE.BoxGeometry(0.3, 0.03, 0.03);
        const ribMat = new THREE.MeshStandardMaterial({ color: 0xc8c0a8, roughness: 0.5, flatShading: false });
        for (let i = 0; i < 3; i++) {
            const rib = new THREE.Mesh(ribGeo, ribMat);
            rib.position.set(0, 0.85 - i * 0.12, 0.34);
            rib.castShadow = true;
            group.add(rib);
        }
        // 头 - 超高细分
        const headGeo = new THREE.SphereGeometry(0.3, 16, 12);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x5a1111, roughness: 0.55, flatShading: false, metalness: 0.05 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.5;
        head.castShadow = true;
        group.add(head);
        // 头骨外露碎片
        const skullGeo = new THREE.BoxGeometry(0.08, 0.06, 0.02);
        const skullMat = new THREE.MeshStandardMaterial({ color: 0xc8c0a8, roughness: 0.5, flatShading: false });
        const skull = new THREE.Mesh(skullGeo, skullMat);
        skull.position.set(-0.1, 1.65, 0.25); group.add(skull);

        // 眼睛 - 发光
        const eyeGeo = new THREE.SphereGeometry(0.07, 8, 6);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.12, 1.55, 0.25);
        group.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.12, 1.55, 0.25);
        group.add(eyeR);
        // 眼睛光晕
        // 嘴部 - 张开的黑色嘴
        const mouthGeo = new THREE.BoxGeometry(0.12, 0.06, 0.02);
        const mouthMat = new THREE.MeshBasicMaterial({ color: 0x1a0000 });
        const mouth = new THREE.Mesh(mouthGeo, mouthMat);
        mouth.position.set(0, 1.4, 0.28); group.add(mouth);
        // 牙齿
        const toothGeo = new THREE.BoxGeometry(0.02, 0.03, 0.02);
        const toothMat = new THREE.MeshStandardMaterial({ color: 0xc8c0a8, roughness: 0.4 });
        for (let i = 0; i < 4; i++) {
            const tooth = new THREE.Mesh(toothGeo, toothMat);
            tooth.position.set(-0.045 + i * 0.03, 1.38, 0.29);
            group.add(tooth);
        }

        // 手臂 - 超高细分 + 骨刺外露
        const zArmGeo = new THREE.CapsuleGeometry(0.12, 0.5, 6, 12);
        const zArmMat = new THREE.MeshStandardMaterial({ color: 0x6b1a1a, roughness: 0.7, flatShading: false, metalness: 0.05 });
        const zArmL = new THREE.Mesh(zArmGeo, zArmMat);
        zArmL.position.set(-0.4, 0.8, 0);
        zArmL.castShadow = true;
        group.add(zArmL);
        const zArmR = new THREE.Mesh(zArmGeo, zArmMat);
        zArmR.position.set(0.4, 0.8, 0);
        zArmR.castShadow = true;
        group.add(zArmR);
        // 手臂骨刺外露
        const boneGeo = new THREE.BoxGeometry(0.04, 0.15, 0.04);
        const boneMat = new THREE.MeshStandardMaterial({ color: 0xc8c0a8, roughness: 0.5, flatShading: false });
        const boneL = new THREE.Mesh(boneGeo, boneMat);
        boneL.position.set(-0.4, 0.6, 0.14); boneL.rotation.x = 0.5; group.add(boneL);
        const boneR = new THREE.Mesh(boneGeo, boneMat);
        boneR.position.set(0.4, 0.65, 0.14); boneR.rotation.x = -0.3; group.add(boneR);
        // 手爪 - 瘦长指尖
        const clawGeo = new THREE.ConeGeometry(0.04, 0.15, 5);
        const clawMat = new THREE.MeshStandardMaterial({ color: 0x4a0e0e, roughness: 0.6, flatShading: false });
        const clawL = new THREE.Mesh(clawGeo, clawMat);
        clawL.position.set(-0.4, 0.45, 0.1); clawL.rotation.x = Math.PI / 2; group.add(clawL);
        const clawR = new THREE.Mesh(clawGeo, clawMat);
        clawR.position.set(0.4, 0.45, 0.1); clawR.rotation.x = Math.PI / 2; group.add(clawR);
        // 腿
        const zLegGeo = new THREE.CapsuleGeometry(0.12, 0.4, 6, 12);
        const zLegMat = new THREE.MeshStandardMaterial({ color: 0x4a0e0e, roughness: 0.7, flatShading: false, metalness: 0.05 });
        const zLegL = new THREE.Mesh(zLegGeo, zLegMat);
        zLegL.position.set(-0.15, 0.25, 0);
        zLegL.castShadow = true;
        group.add(zLegL);
        const zLegR = new THREE.Mesh(zLegGeo, zLegMat);
        zLegR.position.set(0.15, 0.25, 0);
        zLegR.castShadow = true;
        group.add(zLegR);
        // 脚骨
        const footGeo = new THREE.BoxGeometry(0.12, 0.06, 0.2);
        const footMat = new THREE.MeshStandardMaterial({ color: 0x3a0a0a, roughness: 0.7, flatShading: false });
        const footL = new THREE.Mesh(footGeo, footMat);
        footL.position.set(-0.15, 0.05, 0.04); group.add(footL);
        const footR = new THREE.Mesh(footGeo, footMat);
        footR.position.set(0.15, 0.05, 0.04); group.add(footR);

        this.scene.add(group);

        const enemy = {
            mesh: group,
            health: 10,
            maxHealth: 10,
            speed: 2.5 + Math.random() * 1.5,
            damage: 10,
            attackRange: 2,
            attackCooldown: 0,
            dead: false,
            state: 'idle',
            wanderDir: new THREE.Vector3(),
            wanderTimer: 0,
            bodyMat: bodyMat,
            hitFlash: 0,
            enemyType: 'zombie',
            playerHit: false,
            burning: false,
            dropsAwarded: false,
            takeDamage(amount, attacker = null) {
                if (attacker) this.playerHit = true;
                this.health -= amount;
                this.hitFlash = 0.2;
                if (this.health <= 0) {
                    this.dead = true;
                    this.deathTimer = 0;
                }
            },
        };
        this.enemies.push(enemy);
        this._createHealthBar(enemy);
    }

    _spawnGoldZombie(x, y, z) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        const bodyGeo = new THREE.CapsuleGeometry(0.38, 0.9, 8, 16);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.3, flatShading: false, metalness: 0.7, emissive: 0x442200, emissiveIntensity: 0.3 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.8;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        const gCrackMat = new THREE.MeshStandardMaterial({ color: 0xb8860b, roughness: 0.2, metalness: 0.9, flatShading: false });
        const gCrack1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.02), gCrackMat);
        gCrack1.position.set(0, 0.9, 0.36); group.add(gCrack1);
        const gCrack2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.02), gCrackMat);
        gCrack2.position.set(0.15, 1.0, 0.36); group.add(gCrack2);
        const ribGeo = new THREE.BoxGeometry(0.32, 0.03, 0.03);
        const ribMat = new THREE.MeshStandardMaterial({ color: 0xffdd44, roughness: 0.2, metalness: 0.8, flatShading: false });
        for (let i = 0; i < 3; i++) {
            const rib = new THREE.Mesh(ribGeo, ribMat);
            rib.position.set(0, 0.95 - i * 0.13, 0.37);
            rib.castShadow = true;
            group.add(rib);
        }
        const headGeo = new THREE.SphereGeometry(0.32, 16, 12);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.25, flatShading: false, metalness: 0.7, emissive: 0x442200, emissiveIntensity: 0.3 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.6;
        head.castShadow = true;
        group.add(head);
        const hCrackGeo = new THREE.BoxGeometry(0.12, 0.04, 0.02);
        const hCrack = new THREE.Mesh(hCrackGeo, gCrackMat);
        hCrack.position.set(-0.08, 1.7, 0.27); hCrack.rotation.z = 0.3; group.add(hCrack);
        const eyeGeo = new THREE.SphereGeometry(0.08, 8, 6);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.13, 1.65, 0.27);
        group.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.13, 1.65, 0.27);
        group.add(eyeR);
        const mouthGeo = new THREE.BoxGeometry(0.14, 0.07, 0.02);
        const mouthMat = new THREE.MeshBasicMaterial({ color: 0x2a1a00 });
        const mouth = new THREE.Mesh(mouthGeo, mouthMat);
        mouth.position.set(0, 1.5, 0.3); group.add(mouth);
        const toothGeo = new THREE.BoxGeometry(0.02, 0.04, 0.02);
        const toothMat = new THREE.MeshStandardMaterial({ color: 0xffdd44, roughness: 0.2, metalness: 0.8 });
        for (let i = 0; i < 4; i++) {
            const tooth = new THREE.Mesh(toothGeo, toothMat);
            tooth.position.set(-0.05 + i * 0.035, 1.47, 0.31);
            group.add(tooth);
        }
        const gzArmGeo = new THREE.CapsuleGeometry(0.13, 0.55, 6, 12);
        const gzArmMat = new THREE.MeshStandardMaterial({ color: 0xcc9900, roughness: 0.3, flatShading: false, metalness: 0.6, emissive: 0x332200, emissiveIntensity: 0.2 });
        const gzArmL = new THREE.Mesh(gzArmGeo, gzArmMat);
        gzArmL.position.set(-0.45, 0.85, 0);
        gzArmL.castShadow = true;
        group.add(gzArmL);
        const gzArmR = new THREE.Mesh(gzArmGeo, gzArmMat);
        gzArmR.position.set(0.45, 0.85, 0);
        gzArmR.castShadow = true;
        group.add(gzArmR);
        const gBoneGeo = new THREE.BoxGeometry(0.04, 0.18, 0.04);
        const gBoneMat = new THREE.MeshStandardMaterial({ color: 0xffdd44, roughness: 0.2, metalness: 0.8, flatShading: false });
        const gBoneL = new THREE.Mesh(gBoneGeo, gBoneMat);
        gBoneL.position.set(-0.45, 0.6, 0.15); gBoneL.rotation.x = 0.5; group.add(gBoneL);
        const gBoneR = new THREE.Mesh(gBoneGeo, gBoneMat);
        gBoneR.position.set(0.45, 0.7, 0.15); gBoneR.rotation.x = -0.3; group.add(gBoneR);
        const gClawGeo = new THREE.ConeGeometry(0.05, 0.18, 5);
        const gClawMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.3, metalness: 0.7, flatShading: false });
        const gClawL = new THREE.Mesh(gClawGeo, gClawMat);
        gClawL.position.set(-0.45, 0.48, 0.12); gClawL.rotation.x = Math.PI / 2; group.add(gClawL);
        const gClawR = new THREE.Mesh(gClawGeo, gClawMat);
        gClawR.position.set(0.45, 0.48, 0.12); gClawR.rotation.x = Math.PI / 2; group.add(gClawR);
        const gzLegGeo = new THREE.CapsuleGeometry(0.13, 0.45, 6, 12);
        const gzLegMat = new THREE.MeshStandardMaterial({ color: 0xaa7700, roughness: 0.35, flatShading: false, metalness: 0.5, emissive: 0x221100, emissiveIntensity: 0.2 });
        const gzLegL = new THREE.Mesh(gzLegGeo, gzLegMat);
        gzLegL.position.set(-0.16, 0.27, 0);
        gzLegL.castShadow = true;
        group.add(gzLegL);
        const gzLegR = new THREE.Mesh(gzLegGeo, gzLegMat);
        gzLegR.position.set(0.16, 0.27, 0);
        gzLegR.castShadow = true;
        group.add(gzLegR);
        const gFootGeo = new THREE.BoxGeometry(0.14, 0.07, 0.22);
        const gFootMat = new THREE.MeshStandardMaterial({ color: 0x886600, roughness: 0.4, metalness: 0.5, flatShading: false });
        const gFootL = new THREE.Mesh(gFootGeo, gFootMat);
        gFootL.position.set(-0.16, 0.05, 0.05); group.add(gFootL);
        const gFootR = new THREE.Mesh(gFootGeo, gFootMat);
        gFootR.position.set(0.16, 0.05, 0.05); group.add(gFootR);

        this.scene.add(group);

        const enemy = {
            mesh: group,
            health: 5000,
            maxHealth: 5000,
            speed: 2.0,
            damage: 50,
            attackRange: 2.5,
            attackCooldown: 0,
            dead: false,
            state: 'idle',
            wanderDir: new THREE.Vector3(),
            wanderTimer: 0,
            bodyMat: bodyMat,
            hitFlash: 0,
            enemyType: 'gold_zombie',
            playerHit: false,
            burning: false,
            dropsAwarded: false,
            defense: 5,
            eyeMat: eyeMat,
            takeDamage(amount, attacker = null) {
                if (attacker) this.playerHit = true;
                const actualDamage = Math.max(1, amount - this.defense);
                this.health -= actualDamage;
                this.hitFlash = 0.2;
                if (this.health <= 0) {
                    this.dead = true;
                    this.deathTimer = 0;
                }
            },
        };
        this.enemies.push(enemy);
        this._createHealthBar(enemy);
    }

    _spawnStoneMonster(x, y, z) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // 身体 - 大块岩石，超高细分
        const bodyGeo = new THREE.DodecahedronGeometry(0.7, 3);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.82, flatShading: false, metalness: 0.08, envMapIntensity: 0.4 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.7;
        body.scale.set(1.2, 1.0, 1.2);
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        // 裂纹
        const smCrackMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.95, flatShading: false });
        const smCrack1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.04), smCrackMat);
        smCrack1.position.set(0.1, 0.8, 0.55); smCrack1.rotation.z = 0.3; group.add(smCrack1);
        const smCrack2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.04), smCrackMat);
        smCrack2.position.set(-0.15, 0.6, 0.55); group.add(smCrack2);
        // 苔藓斑块
        const smMossGeo = new THREE.DodecahedronGeometry(0.1, 0);
        const smMossMat = new THREE.MeshStandardMaterial({ color: 0x4a6a2a, roughness: 0.9, flatShading: false, emissive: 0x1a3a0a, emissiveIntensity: 0.15 });
        const smMoss1 = new THREE.Mesh(smMossGeo, smMossMat);
        smMoss1.position.set(-0.5, 0.5, 0.3); smMoss1.scale.set(1, 0.3, 1); group.add(smMoss1);
        const smMoss2 = new THREE.Mesh(smMossGeo, smMossMat);
        smMoss2.position.set(0.4, 1.0, -0.3); smMoss2.scale.set(1, 0.4, 1); group.add(smMoss2);
        // 浮动碎石碎片
        const fragmentGeo = new THREE.DodecahedronGeometry(0.08, 0);
        const fragmentMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.85, flatShading: false });
        const frag1 = new THREE.Mesh(fragmentGeo, fragmentMat);
        frag1.position.set(0.6, 1.2, 0.3); frag1.castShadow = true; group.add(frag1);
        const frag2 = new THREE.Mesh(fragmentGeo, fragmentMat);
        frag2.position.set(-0.55, 0.3, 0.4); frag2.castShadow = true; group.add(frag2);
        const frag3 = new THREE.Mesh(fragmentGeo, fragmentMat);
        frag3.position.set(0.5, 0.2, -0.3); frag3.castShadow = true; group.add(frag3);

        // 头 - 较小岩石，超高细分
        const headGeo = new THREE.DodecahedronGeometry(0.42, 3);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.82, flatShading: false, metalness: 0.08 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.5;
        head.castShadow = true;
        group.add(head);
        // 头部裂纹
        const smHeadCrack = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.04), smCrackMat);
        smHeadCrack.position.set(0.1, 1.5, 0.35); group.add(smHeadCrack);

        // 眼睛 - 发光裂缝
        const eyeGeo = new THREE.SphereGeometry(0.09, 10, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.15, 1.55, 0.32);
        group.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.15, 1.55, 0.32);
        group.add(eyeR);
        // 眼睛光晕

        // 手臂 - 两侧小石块，超高细分
        const armGeo = new THREE.DodecahedronGeometry(0.27, 2);
        const armMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.82, flatShading: false, metalness: 0.08 });
        const armL = new THREE.Mesh(armGeo, armMat);
        armL.position.set(-0.8, 0.8, 0);
        armL.castShadow = true;
        group.add(armL);
        const armR = new THREE.Mesh(armGeo, armMat);
        armR.position.set(0.8, 0.8, 0);
        armR.castShadow = true;
        group.add(armR);
        // 手臂末端尖刺
        const smSpikeGeo = new THREE.ConeGeometry(0.05, 0.15, 5);
        const smSpikeMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.7, flatShading: false });
        const smSpikeL = new THREE.Mesh(smSpikeGeo, smSpikeMat);
        smSpikeL.position.set(-0.8, 0.55, 0.15); smSpikeL.rotation.x = Math.PI / 2; group.add(smSpikeL);
        const smSpikeR = new THREE.Mesh(smSpikeGeo, smSpikeMat);
        smSpikeR.position.set(0.8, 0.55, 0.15); smSpikeR.rotation.x = Math.PI / 2; group.add(smSpikeR);
        // 底部碎石基座
        const smRubbleGeo = new THREE.DodecahedronGeometry(0.07, 0);
        const smRubbleMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.9, flatShading: false });
        for (let i = 0; i < 4; i++) {
            const ang = (i / 4) * Math.PI * 2;
            const r = new THREE.Mesh(smRubbleGeo, smRubbleMat);
            r.position.set(Math.cos(ang) * 0.45, 0.02, Math.sin(ang) * 0.35);
            r.scale.set(1, 0.5, 1);
            r.castShadow = true;
            group.add(r);
        }

        this.scene.add(group);

        const enemy = {
            mesh: group,
            health: 40,
            maxHealth: 40,
            speed: 0.5,
            damage: 15,
            attackRange: 2.5,
            attackCooldown: 0,
            dead: false,
            state: 'idle',
            wanderDir: new THREE.Vector3(),
            wanderTimer: 0,
            bodyMat: bodyMat,
            hitFlash: 0,
            enemyType: 'stone_monster',
            playerHit: false,
            burning: false,
            dropsAwarded: false,
            defense: 0.5,
            takeDamage(amount, attacker = null) {
                if (attacker) this.playerHit = true;
                const actualDamage = Math.max(0, amount - this.defense);
                this.health -= actualDamage;
                this.hitFlash = 0.2;
                if (this.health <= 0) {
                    this.dead = true;
                    this.deathTimer = 0;
                }
            },
        };
        this.enemies.push(enemy);
        this._createHealthBar(enemy);
    }

    _spawnPetrifiedHuman(x, y, z) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // 身体 - 人形石化体，超高细分
        const bodyGeo = new THREE.CapsuleGeometry(0.35, 0.9, 8, 16);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.75, flatShading: false, metalness: 0.15, envMapIntensity: 0.4 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.8;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        // 石化裂纹网络
        const phCrackMat = new THREE.MeshStandardMaterial({ color: 0x5a5a5a, roughness: 0.95, flatShading: false });
        const phCrack1 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.03, 0.03), phCrackMat);
        phCrack1.position.set(0.05, 0.9, 0.33); phCrack1.rotation.z = 0.3; group.add(phCrack1);
        const phCrack2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.4, 0.03), phCrackMat);
        phCrack2.position.set(-0.1, 0.7, 0.33); group.add(phCrack2);
        const phCrack3 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.03), phCrackMat);
        phCrack3.position.set(0.08, 0.5, 0.33); phCrack3.rotation.z = -0.4; group.add(phCrack3);
        // 化石纹理 - 暗色矿脉
        const veinGeo = new THREE.BoxGeometry(0.04, 0.3, 0.04);
        const veinMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.8, flatShading: false, metalness: 0.3 });
        const vein1 = new THREE.Mesh(veinGeo, veinMat);
        vein1.position.set(-0.2, 0.8, 0.32); vein1.rotation.z = 0.2; group.add(vein1);
        const vein2 = new THREE.Mesh(veinGeo, veinMat);
        vein2.position.set(0.15, 1.0, 0.32); vein2.rotation.z = -0.3; group.add(vein2);

        // 头 - 超高细分
        const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.7, flatShading: false, metalness: 0.15 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.6;
        head.castShadow = true;
        group.add(head);
        // 头部裂纹
        const phHeadCrack = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.25, 0.03), phCrackMat);
        phHeadCrack.position.set(0.08, 1.6, 0.23); group.add(phHeadCrack);
        // 头部化石纹理
        const phHeadVein = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.03), veinMat);
        phHeadVein.position.set(-0.05, 1.7, 0.23); phHeadVein.rotation.z = 0.3; group.add(phHeadVein);

        // 眼睛 - 灰白色裂缝
        const eyeGeo = new THREE.SphereGeometry(0.08, 10, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xccccdd });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.12, 1.62, 0.23);
        group.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.12, 1.62, 0.23);
        group.add(eyeR);
        // 眼睛光晕

        // 手臂 - 石化手臂，超高细分
        const armGeo = new THREE.CapsuleGeometry(0.15, 0.6, 8, 16);
        const armMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.75, flatShading: false, metalness: 0.15 });
        const armL = new THREE.Mesh(armGeo, armMat);
        armL.position.set(-0.5, 0.9, 0);
        armL.castShadow = true;
        group.add(armL);
        const armR = new THREE.Mesh(armGeo, armMat);
        armR.position.set(0.5, 0.9, 0);
        armR.castShadow = true;
        group.add(armR);
        // 手臂裂纹
        const phArmCrackL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.03), phCrackMat);
        phArmCrackL.position.set(-0.5, 0.9, 0.14); group.add(phArmCrackL);
        const phArmCrackR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.3, 0.03), phCrackMat);
        phArmCrackR.position.set(0.5, 0.9, 0.14); group.add(phArmCrackR);
        // 石化手指
        const phFingerGeo = new THREE.BoxGeometry(0.04, 0.04, 0.12);
        const phFingerMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.75, flatShading: false });
        const phFingerL = new THREE.Mesh(phFingerGeo, phFingerMat);
        phFingerL.position.set(-0.5, 0.55, 0.1); phFingerL.rotation.x = Math.PI / 2; group.add(phFingerL);
        const phFingerR = new THREE.Mesh(phFingerGeo, phFingerMat);
        phFingerR.position.set(0.5, 0.55, 0.1); phFingerR.rotation.x = Math.PI / 2; group.add(phFingerR);

        // 腿 - 超高细分
        const legGeo = new THREE.CapsuleGeometry(0.15, 0.5, 8, 16);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.75, flatShading: false, metalness: 0.15 });
        const legL = new THREE.Mesh(legGeo, legMat);
        legL.position.set(-0.18, 0.3, 0);
        legL.castShadow = true;
        group.add(legL);
        const legR = new THREE.Mesh(legGeo, legMat);
        legR.position.set(0.18, 0.3, 0);
        legR.castShadow = true;
        group.add(legR);
        // 腿部裂纹
        const phLegCrackL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.25, 0.03), phCrackMat);
        phLegCrackL.position.set(-0.18, 0.3, 0.14); group.add(phLegCrackL);
        const phLegCrackR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.25, 0.03), phCrackMat);
        phLegCrackR.position.set(0.18, 0.3, 0.14); group.add(phLegCrackR);
        // 石化脚
        const phFootGeo = new THREE.BoxGeometry(0.15, 0.08, 0.25);
        const phFootMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.75, flatShading: false });
        const phFootL = new THREE.Mesh(phFootGeo, phFootMat);
        phFootL.position.set(-0.18, 0.05, 0.05); group.add(phFootL);
        const phFootR = new THREE.Mesh(phFootGeo, phFootMat);
        phFootR.position.set(0.18, 0.05, 0.05); group.add(phFootR);
        // 碎石基座
        const phRubbleGeo = new THREE.DodecahedronGeometry(0.08, 0);
        const phRubbleMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9, flatShading: false });
        for (let i = 0; i < 4; i++) {
            const ang = (i / 4) * Math.PI * 2;
            const r = new THREE.Mesh(phRubbleGeo, phRubbleMat);
            r.position.set(Math.cos(ang) * 0.3, 0.02, Math.sin(ang) * 0.22);
            r.scale.set(1, 0.5, 1);
            r.castShadow = true;
            group.add(r);
        }

        this.scene.add(group);

        const enemy = {
            mesh: group,
            health: 100,
            maxHealth: 100,
            speed: 8,
            damage: 15,
            attackRange: 4,
            attackCooldown: 0,
            dead: false,
            state: 'idle',
            wanderDir: new THREE.Vector3(),
            wanderTimer: 0,
            bodyMat: bodyMat,
            hitFlash: 0,
            enemyType: 'petrified_human',
            playerHit: false,
            burning: false,
            dropsAwarded: false,
            defense: 0.5,
            takeDamage(amount, attacker = null) {
                if (attacker) this.playerHit = true;
                const actualDamage = Math.max(0, amount - this.defense);
                this.health -= actualDamage;
                this.hitFlash = 0.2;
                if (this.health <= 0) {
                    this.dead = true;
                    this.deathTimer = 0;
                }
            },
        };
        this.enemies.push(enemy);
        this._createHealthBar(enemy);
    }

    _spawnCow(x, y, z) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // 身体 - 超高细分
        const bodyGeo = new THREE.BoxGeometry(1.0, 0.6, 0.6);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, flatShading: false, metalness: 0.05 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.7;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);

        // 白色斑块 - 超高细分
        const patchGeo = new THREE.BoxGeometry(0.4, 0.35, 0.62);
        const patchMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.75, flatShading: false, metalness: 0.05 });
        const patch = new THREE.Mesh(patchGeo, patchMat);
        patch.position.set(0.1, 0.75, 0);
        group.add(patch);
        // 第二块斑
        const patch2 = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.2, 0.62), patchMat);
        patch2.position.set(-0.3, 0.6, 0);
        group.add(patch2);
        // 第三块斑
        const patch3 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.62), patchMat);
        patch3.position.set(0.35, 0.55, 0);
        group.add(patch3);
        // 第四块斑 - 背部
        const patch4 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), patchMat);
        patch4.position.set(-0.1, 1.02, 0);
        group.add(patch4);

        // 头 - 超高细分
        const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, flatShading: false, metalness: 0.05 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.set(0.6, 0.8, 0);
        head.castShadow = true;
        group.add(head);
        // 鼻吻 - 粉色
        const snoutGeo = new THREE.BoxGeometry(0.2, 0.2, 0.1);
        const snoutMat = new THREE.MeshStandardMaterial({ color: 0xd4a8a8, roughness: 0.6, flatShading: false });
        const snout = new THREE.Mesh(snoutGeo, snoutMat);
        snout.position.set(0.8, 0.72, 0);
        group.add(snout);
        // 鼻孔
        const nostrilGeo = new THREE.SphereGeometry(0.03, 8, 6);
        const nostrilMat = new THREE.MeshBasicMaterial({ color: 0x1a0a0a });
        const nostrilL = new THREE.Mesh(nostrilGeo, nostrilMat);
        nostrilL.position.set(0.84, 0.74, -0.05); group.add(nostrilL);
        const nostrilR = new THREE.Mesh(nostrilGeo, nostrilMat);
        nostrilR.position.set(0.84, 0.74, 0.05); group.add(nostrilR);

        // 耳朵 - 两侧扁平三角形
        const earGeo = new THREE.ConeGeometry(0.1, 0.2, 4);
        const earMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8, flatShading: false });
        const earL = new THREE.Mesh(earGeo, earMat);
        earL.position.set(0.5, 1.05, -0.2); earL.rotation.z = -0.5; earL.rotation.x = 0.3; group.add(earL);
        const earR = new THREE.Mesh(earGeo, earMat);
        earR.position.set(0.5, 1.05, 0.2); earR.rotation.z = -0.5; earR.rotation.x = -0.3; group.add(earR);

        // 角 - 超高细分
        const hornGeo = new THREE.ConeGeometry(0.08, 0.25, 8);
        const hornMat = new THREE.MeshStandardMaterial({ color: 0xddccaa, roughness: 0.55, flatShading: false, metalness: 0.1 });
        const hornL = new THREE.Mesh(hornGeo, hornMat);
        hornL.position.set(0.55, 1.05, -0.15);
        hornL.castShadow = true;
        group.add(hornL);
        const hornR = new THREE.Mesh(hornGeo, hornMat);
        hornR.position.set(0.55, 1.05, 0.15);
        hornR.castShadow = true;
        group.add(hornR);

        // 眼睛
        const eyeGeo = new THREE.SphereGeometry(0.05, 8, 6);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(0.78, 0.85, -0.12);
        group.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.78, 0.85, 0.12);
        group.add(eyeR);

        // 腿 - 超高细分
        const legGeo = new THREE.BoxGeometry(0.15, 0.5, 0.15);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8, flatShading: false, metalness: 0.05 });
        const positions = [[-0.35, 0.25, -0.2], [-0.35, 0.25, 0.2], [0.35, 0.25, -0.2], [0.35, 0.25, 0.2]];
        for (const [lx, ly, lz] of positions) {
            const leg = new THREE.Mesh(legGeo, legMat);
            leg.position.set(lx, ly, lz);
            leg.castShadow = true;
            group.add(leg);
        }
        // 蹄子 - 深色硬蹄
        const hoofGeo = new THREE.BoxGeometry(0.17, 0.08, 0.17);
        const hoofMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, flatShading: false, metalness: 0.2 });
        for (const [lx, , lz] of positions) {
            const hoof = new THREE.Mesh(hoofGeo, hoofMat);
            hoof.position.set(lx, 0.02, lz);
            hoof.castShadow = true;
            group.add(hoof);
        }
        // 尾巴 - 超高细分
        const tailGeo = new THREE.CylinderGeometry(0.04, 0.08, 0.4, 10);
        const tail = new THREE.Mesh(tailGeo, legMat);
        tail.position.set(-0.55, 0.75, 0);
        tail.rotation.z = Math.PI / 3;
        group.add(tail);
        // 尾巴末端毛球
        const tailBallGeo = new THREE.SphereGeometry(0.06, 8, 6);
        const tailBall = new THREE.Mesh(tailBallGeo, patchMat);
        tailBall.position.set(-0.72, 0.95, 0);
        group.add(tailBall);
        // 乳房 - 腹部下方
        const udderGeo = new THREE.SphereGeometry(0.12, 10, 8);
        const udderMat = new THREE.MeshStandardMaterial({ color: 0xd4a8a8, roughness: 0.6, flatShading: false });
        const udder = new THREE.Mesh(udderGeo, udderMat);
        udder.position.set(-0.1, 0.35, 0);
        udder.scale.set(1, 0.6, 1);
        group.add(udder);

        this.scene.add(group);

        const enemy = {
            mesh: group,
            health: 15,
            maxHealth: 15,
            speed: 1.5 + Math.random() * 0.5,
            damage: 0,
            attackRange: 0,
            attackCooldown: 0,
            dead: false,
            state: 'idle',
            wanderDir: new THREE.Vector3(),
            wanderTimer: 0,
            bodyMat: bodyMat,
            hitFlash: 0,
            enemyType: 'cow',
            playerHit: false,
            burning: false,
            dropsAwarded: false,
            takeDamage(amount, attacker = null) {
                if (attacker) this.playerHit = true;
                this.health -= amount;
                this.hitFlash = 0.2;
                if (this.health <= 0) {
                    this.dead = true;
                    this.deathTimer = 0;
                }
            },
        };
        this.enemies.push(enemy);
        this._createHealthBar(enemy);
    }

    _spawnFakeTree(x, y, z) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // 树干 - 超高分段
        const trunkGeo = new THREE.CylinderGeometry(0.22, 0.45, 4, 20);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8, flatShading: false, metalness: 0.05 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 2;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        group.add(trunk);
        // 树干纹理凹槽 - 5条
        const grooveGeo = new THREE.BoxGeometry(0.05, 3, 0.05);
        const grooveMat = new THREE.MeshStandardMaterial({ color: 0x4a2e13, roughness: 0.9 });
        for (let i = 0; i < 5; i++) {
            const groove = new THREE.Mesh(grooveGeo, grooveMat);
            const ang = (i / 5) * Math.PI * 2;
            groove.position.set(Math.cos(ang) * 0.3, 2, Math.sin(ang) * 0.3);
            groove.rotation.y = ang;
            group.add(groove);
        }
        // 树干横向纹理环
        const ringGeo = new THREE.TorusGeometry(0.33, 0.02, 6, 16);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0x5a3813, roughness: 0.85, flatShading: false });
        for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.y = 1.2 + i * 0.8;
            ring.rotation.x = Math.PI / 2;
            group.add(ring);
        }

        // 扭曲树根 - 4条从底部伸出
        const rootGeo = new THREE.CylinderGeometry(0.06, 0.12, 0.6, 8);
        const rootMat = new THREE.MeshStandardMaterial({ color: 0x4a2e13, roughness: 0.85, flatShading: false });
        for (let i = 0; i < 4; i++) {
            const ang = (i / 4) * Math.PI * 2 + 0.3;
            const root = new THREE.Mesh(rootGeo, rootMat);
            root.position.set(Math.cos(ang) * 0.3, 0.15, Math.sin(ang) * 0.3);
            root.rotation.set(Math.cos(ang) * 0.8, ang, Math.sin(ang) * 0.8);
            root.castShadow = true;
            group.add(root);
        }

        // 树叶 - 多层树冠，超高细分
        const leafGeo = new THREE.IcosahedronGeometry(1.8, 2);
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.7, flatShading: false, metalness: 0.05 });
        const leaves = new THREE.Mesh(leafGeo, leafMat);
        leaves.position.y = 4.5;
        leaves.scale.set(1, 0.8, 1);
        leaves.castShadow = true;
        group.add(leaves);
        // 第二层树叶
        const leaf2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 2), leafMat);
        leaf2.position.set(0.4, 5.0, 0.2);
        leaf2.castShadow = true;
        group.add(leaf2);
        // 第三层树叶
        const leaf3 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), leafMat);
        leaf3.position.set(-0.3, 5.3, -0.1);
        leaf3.castShadow = true;
        group.add(leaf3);
        // 第四层小树叶
        const leaf4 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 2), leafMat);
        leaf4.position.set(0.1, 5.6, 0.1);
        leaf4.castShadow = true;
        group.add(leaf4);
        // 树冠中的枯枝
        const branchGeo = new THREE.CylinderGeometry(0.03, 0.06, 0.8, 6);
        const branchMat = new THREE.MeshStandardMaterial({ color: 0x4a2e13, roughness: 0.85, flatShading: false });
        const branch1 = new THREE.Mesh(branchGeo, branchMat);
        branch1.position.set(0.5, 4.8, 0.3); branch1.rotation.z = 0.6; group.add(branch1);
        const branch2 = new THREE.Mesh(branchGeo, branchMat);
        branch2.position.set(-0.4, 5.0, -0.2); branch2.rotation.z = -0.5; group.add(branch2);

        // 树干上的2个棕色眼睛（隐藏在树干上，不太显眼）
        const eyeGeo = new THREE.SphereGeometry(0.09, 10, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x4a2a00 });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.15, 2.2, 0.38);
        group.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.15, 2.2, 0.38);
        group.add(eyeR);
        // 隐藏嘴部 - 树干上的黑色裂缝
        const mouthGeo = new THREE.BoxGeometry(0.2, 0.04, 0.02);
        const mouthMat = new THREE.MeshBasicMaterial({ color: 0x1a0a00 });
        const ftMouth = new THREE.Mesh(mouthGeo, mouthMat);
        ftMouth.position.set(0, 1.9, 0.38); group.add(ftMouth);
        // 嘴部尖牙
        const fangGeo = new THREE.ConeGeometry(0.03, 0.08, 4);
        const fangMat = new THREE.MeshStandardMaterial({ color: 0xc8c0a8, roughness: 0.4 });
        const fangL = new THREE.Mesh(fangGeo, fangMat);
        fangL.position.set(-0.06, 1.87, 0.39); fangL.rotation.x = Math.PI; group.add(fangL);
        const fangR = new THREE.Mesh(fangGeo, fangMat);
        fangR.position.set(0.06, 1.87, 0.39); fangR.rotation.x = Math.PI; group.add(fangR);

        this.scene.add(group);

        const enemy = {
            mesh: group,
            health: 600,
            maxHealth: 600,
            speed: 8.5,
            damage: 8,
            attackRange: 2.5,
            attackCooldown: 0,
            dead: false,
            state: 'idle',
            wanderDir: new THREE.Vector3(),
            wanderTimer: 0,
            bodyMat: trunkMat,
            eyeMat: eyeMat,
            hitFlash: 0,
            enemyType: 'fake_tree',
            playerHit: false,
            burning: false,
            dropsAwarded: false,
            defense: 10,
            provoked: false,
            provokedTimer: 0,
            healthBarVisible: false,
            takeDamage(amount, attacker = null) {
                if (attacker) this.playerHit = true;
                const actualDamage = Math.max(0, amount - this.defense);
                this.health -= actualDamage;
                this.hitFlash = 0.2;
                this.provoked = true;
                this.provokedTimer = 30;
                if (this.health <= 0) {
                    this.dead = true;
                    this.deathTimer = 0;
                }
            },
        };
        this.enemies.push(enemy);
        // 不立即创建血条，被惊动后才显示
        this._createHealthBar(enemy);
        if (enemy.healthBar) enemy.healthBar.sprite.visible = false;
    }

    _spawnTreeGuardian(x, y, z) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // 身体 - 树干，超高细分
        const bodyGeo = new THREE.CylinderGeometry(0.4, 0.55, 1.6, 16);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.85, flatShading: false, metalness: 0.05 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.8;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        // 树干纹理 - 4条纵向凹槽
        const tgGrooveGeo = new THREE.BoxGeometry(0.04, 1.2, 0.04);
        const tgGrooveMat = new THREE.MeshStandardMaterial({ color: 0x2a1a08, roughness: 0.9 });
        for (let i = 0; i < 4; i++) {
            const ang = (i / 4) * Math.PI * 2;
            const groove = new THREE.Mesh(tgGrooveGeo, tgGrooveMat);
            groove.position.set(Math.cos(ang) * 0.42, 0.8, Math.sin(ang) * 0.42);
            groove.rotation.y = ang;
            group.add(groove);
        }
        // 树干横向纹理环
        const tgRingGeo = new THREE.TorusGeometry(0.45, 0.02, 6, 16);
        const tgRingMat = new THREE.MeshStandardMaterial({ color: 0x3a2510, roughness: 0.85, flatShading: false });
        for (let i = 0; i < 2; i++) {
            const ring = new THREE.Mesh(tgRingGeo, tgRingMat);
            ring.position.y = 0.5 + i * 0.6;
            ring.rotation.x = Math.PI / 2;
            group.add(ring);
        }

        // 头部 - 树冠，超高细分
        const headGeo = new THREE.IcosahedronGeometry(0.52, 2);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1a, roughness: 0.8, flatShading: false, metalness: 0.05 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.8;
        head.castShadow = true;
        group.add(head);
        // 顶部小树冠
        const head2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 2), headMat);
        head2.position.set(0.2, 2.1, 0.1);
        head2.castShadow = true;
        group.add(head2);
        // 侧面小树冠
        const head3 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 2), headMat);
        head3.position.set(-0.25, 1.95, -0.1);
        head3.castShadow = true;
        group.add(head3);
        // 后侧小树冠
        const head4 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 2), headMat);
        head4.position.set(0.05, 2.0, -0.3);
        head4.castShadow = true;
        group.add(head4);

        // 眼睛 - 绿色发光
        const eyeGeo = new THREE.SphereGeometry(0.08, 10, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ff44 });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.15, 1.85, 0.38);
        group.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.15, 1.85, 0.38);
        group.add(eyeR);
        // 眼睛光晕
        // 嘴部 - 树皮裂缝
        const tgMouthGeo = new THREE.BoxGeometry(0.15, 0.03, 0.02);
        const tgMouthMat = new THREE.MeshBasicMaterial({ color: 0x0a0500 });
        const tgMouth = new THREE.Mesh(tgMouthGeo, tgMouthMat);
        tgMouth.position.set(0, 1.65, 0.42); group.add(tgMouth);

        // 手臂 - 树枝，超高细分
        const armGeo = new THREE.CylinderGeometry(0.12, 0.08, 1.0, 10);
        const armMat = new THREE.MeshStandardMaterial({ color: 0x3a2810, roughness: 0.85, flatShading: false, metalness: 0.05 });
        const armL = new THREE.Mesh(armGeo, armMat);
        armL.position.set(-0.6, 1.0, 0);
        armL.rotation.z = Math.PI / 4;
        armL.castShadow = true;
        group.add(armL);
        const armR = new THREE.Mesh(armGeo, armMat);
        armR.position.set(0.6, 1.0, 0);
        armR.rotation.z = -Math.PI / 4;
        armR.castShadow = true;
        group.add(armR);
        // 手臂末端树叶 - 超高细分
        const armLeafGeo = new THREE.IcosahedronGeometry(0.22, 2);
        const armLeafL = new THREE.Mesh(armLeafGeo, headMat);
        armLeafL.position.set(-0.95, 1.35, 0);
        armLeafL.castShadow = true;
        group.add(armLeafL);
        const armLeafR = new THREE.Mesh(armLeafGeo, headMat);
        armLeafR.position.set(0.95, 1.35, 0);
        armLeafR.castShadow = true;
        group.add(armLeafR);
        // 小树枝分叉
        const tgBranchGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.4, 6);
        const tgBranchMat = new THREE.MeshStandardMaterial({ color: 0x3a2810, roughness: 0.85, flatShading: false });
        const tgBranch1 = new THREE.Mesh(tgBranchGeo, tgBranchMat);
        tgBranch1.position.set(-0.8, 1.2, 0.15); tgBranch1.rotation.z = Math.PI / 3; group.add(tgBranch1);
        const tgBranch2 = new THREE.Mesh(tgBranchGeo, tgBranchMat);
        tgBranch2.position.set(0.8, 1.2, -0.15); tgBranch2.rotation.z = -Math.PI / 3; group.add(tgBranch2);

        // 根部脚 - 超高细分 + 第三条根
        const rootGeo = new THREE.CylinderGeometry(0.15, 0.05, 0.5, 8);
        const rootMat = new THREE.MeshStandardMaterial({ color: 0x2a1a08, roughness: 0.9, flatShading: false });
        const rootL = new THREE.Mesh(rootGeo, rootMat);
        rootL.position.set(-0.2, 0.15, 0);
        rootL.castShadow = true;
        group.add(rootL);
        const rootR = new THREE.Mesh(rootGeo, rootMat);
        rootR.position.set(0.2, 0.15, 0);
        rootR.castShadow = true;
        group.add(rootR);
        // 后方第三条根
        const root3 = new THREE.Mesh(rootGeo, rootMat);
        root3.position.set(0, 0.15, -0.25);
        root3.rotation.x = 0.3;
        root3.castShadow = true;
        group.add(root3);

        this.scene.add(group);

        const enemy = {
            mesh: group,
            health: 60,
            maxHealth: 60,
            speed: 1.8 + Math.random() * 0.8,
            damage: 15,
            attackRange: 2.5,
            attackCooldown: 0,
            dead: false,
            state: 'idle',
            wanderDir: new THREE.Vector3(),
            wanderTimer: 0,
            bodyMat: bodyMat,
            hitFlash: 0,
            enemyType: 'tree_guardian',
            playerHit: false,
            burning: false,
            dropsAwarded: false,
            defense: 1.5,
            takeDamage(amount, attacker = null) {
                if (attacker) this.playerHit = true;
                // 防御值减伤
                const actualDamage = Math.max(0, amount - this.defense);
                this.health -= actualDamage;
                this.hitFlash = 0.2;
                if (this.health <= 0) {
                    this.dead = true;
                    this.deathTimer = 0;
                }
            },
        };
        this.enemies.push(enemy);
        this._createHealthBar(enemy);
    }

    _spawnFriendlyTreeGuardian(x, y, z) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // 身体 - 金色树干，超高细分
        const bodyGeo = new THREE.CylinderGeometry(0.4, 0.55, 1.6, 16);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd4a050, roughness: 0.65, emissive: 0x442200, emissiveIntensity: 0.35, flatShading: false, metalness: 0.1 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.8;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        // 树干金色纹理 - 4条
        const ftgGrooveGeo = new THREE.BoxGeometry(0.04, 1.2, 0.04);
        const ftgGrooveMat = new THREE.MeshStandardMaterial({ color: 0xa87830, roughness: 0.8, emissive: 0x221100, emissiveIntensity: 0.2 });
        for (let i = 0; i < 4; i++) {
            const ang = (i / 4) * Math.PI * 2;
            const groove = new THREE.Mesh(ftgGrooveGeo, ftgGrooveMat);
            groove.position.set(Math.cos(ang) * 0.42, 0.8, Math.sin(ang) * 0.42);
            groove.rotation.y = ang;
            group.add(groove);
        }
        // 金色树干环纹
        const ftgRingGeo = new THREE.TorusGeometry(0.45, 0.02, 6, 16);
        const ftgRingMat = new THREE.MeshStandardMaterial({ color: 0xc4962a, roughness: 0.6, flatShading: false, emissive: 0x221100, emissiveIntensity: 0.15 });
        for (let i = 0; i < 2; i++) {
            const ring = new THREE.Mesh(ftgRingGeo, ftgRingMat);
            ring.position.y = 0.5 + i * 0.6;
            ring.rotation.x = Math.PI / 2;
            group.add(ring);
        }

        // 头部 - 金色树冠，超高细分
        const headGeo = new THREE.IcosahedronGeometry(0.52, 2);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xe8c860, roughness: 0.55, flatShading: false, emissive: 0x332200, emissiveIntensity: 0.35, metalness: 0.1 });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.8;
        head.castShadow = true;
        group.add(head);
        // 顶部小树冠
        const head2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 2), headMat);
        head2.position.set(0.2, 2.1, 0.1);
        head2.castShadow = true;
        group.add(head2);
        // 侧面小树冠
        const head3 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.25, 2), headMat);
        head3.position.set(-0.25, 1.95, -0.1);
        head3.castShadow = true;
        group.add(head3);
        // 后侧小树冠
        const head4 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 2), headMat);
        head4.position.set(0.05, 2.0, -0.3);
        head4.castShadow = true;
        group.add(head4);

        // 眼睛 - 金色发光
        const eyeGeo = new THREE.SphereGeometry(0.08, 10, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffee44 });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.15, 1.85, 0.38);
        group.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.15, 1.85, 0.38);
        group.add(eyeR);
        // 眼睛光晕
        // 嘴部 - 金色树皮裂缝
        const ftgMouthGeo = new THREE.BoxGeometry(0.15, 0.03, 0.02);
        const ftgMouthMat = new THREE.MeshBasicMaterial({ color: 0x442200 });
        const ftgMouth = new THREE.Mesh(ftgMouthGeo, ftgMouthMat);
        ftgMouth.position.set(0, 1.65, 0.42); group.add(ftgMouth);

        // 手臂 - 金色树枝，超高细分
        const armGeo = new THREE.CylinderGeometry(0.12, 0.08, 1.0, 10);
        const armMat = new THREE.MeshStandardMaterial({ color: 0xc4962a, roughness: 0.65, flatShading: false, metalness: 0.1 });
        const armL = new THREE.Mesh(armGeo, armMat);
        armL.position.set(-0.6, 1.0, 0);
        armL.rotation.z = Math.PI / 4;
        armL.castShadow = true;
        group.add(armL);
        const armR = new THREE.Mesh(armGeo, armMat);
        armR.position.set(0.6, 1.0, 0);
        armR.rotation.z = -Math.PI / 4;
        armR.castShadow = true;
        group.add(armR);
        // 手臂末端金色树叶 - 超高细分
        const armLeafGeo = new THREE.IcosahedronGeometry(0.22, 2);
        const armLeafL = new THREE.Mesh(armLeafGeo, headMat);
        armLeafL.position.set(-0.95, 1.35, 0);
        armLeafL.castShadow = true;
        group.add(armLeafL);
        const armLeafR = new THREE.Mesh(armLeafGeo, headMat);
        armLeafR.position.set(0.95, 1.35, 0);
        armLeafR.castShadow = true;
        group.add(armLeafR);
        // 小树枝分叉
        const ftgBranchGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.4, 6);
        const ftgBranchMat = new THREE.MeshStandardMaterial({ color: 0xc4962a, roughness: 0.65, flatShading: false, metalness: 0.1 });
        const ftgBranch1 = new THREE.Mesh(ftgBranchGeo, ftgBranchMat);
        ftgBranch1.position.set(-0.8, 1.2, 0.15); ftgBranch1.rotation.z = Math.PI / 3; group.add(ftgBranch1);
        const ftgBranch2 = new THREE.Mesh(ftgBranchGeo, ftgBranchMat);
        ftgBranch2.position.set(0.8, 1.2, -0.15); ftgBranch2.rotation.z = -Math.PI / 3; group.add(ftgBranch2);

        // 根部脚 - 超高细分 + 第三条根
        const rootGeo = new THREE.CylinderGeometry(0.15, 0.05, 0.5, 8);
        const rootMat = new THREE.MeshStandardMaterial({ color: 0xa87830, roughness: 0.85, flatShading: false, emissive: 0x221100, emissiveIntensity: 0.15 });
        const rootL = new THREE.Mesh(rootGeo, rootMat);
        rootL.position.set(-0.2, 0.15, 0);
        rootL.castShadow = true;
        group.add(rootL);
        const rootR = new THREE.Mesh(rootGeo, rootMat);
        rootR.position.set(0.2, 0.15, 0);
        rootR.castShadow = true;
        group.add(rootR);
        // 后方第三条根
        const ftgRoot3 = new THREE.Mesh(rootGeo, rootMat);
        ftgRoot3.position.set(0, 0.15, -0.25);
        ftgRoot3.rotation.x = 0.3;
        ftgRoot3.castShadow = true;
        group.add(ftgRoot3);

        this.scene.add(group);

        const enemy = {
            mesh: group,
            health: 60,
            maxHealth: 60,
            speed: 2.0,
            damage: 15,
            attackRange: 2.5,
            attackCooldown: 0,
            dead: false,
            state: 'idle',
            wanderDir: new THREE.Vector3(),
            wanderTimer: 0,
            bodyMat: bodyMat,
            hitFlash: 0,
            enemyType: 'friendly_tree_guardian',
            playerHit: false,
            burning: false,
            dropsAwarded: false,
            defense: 1.5,
            takeDamage(amount, attacker = null) {
                this.health -= amount;
                this.hitFlash = 0.2;
                if (this.health <= 0) {
                    this.dead = true;
                    this.deathTimer = 0;
                }
            },
        };
        this.enemies.push(enemy);
        this._createHealthBar(enemy);
    }

    _spawnTreeSpirit(x, y, z) {
        const group = new THREE.Group();
        group.position.set(x, y, z);

        // 主体 - 巨大古树，超高细分
        const trunkGeo = new THREE.CylinderGeometry(0.7, 1.0, 3.5, 16);
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2510, roughness: 0.85, flatShading: false, metalness: 0.05 });
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.y = 1.75;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        group.add(trunk);
        // 树干纹理 - 5条纵向凹槽
        const tsGrooveGeo = new THREE.BoxGeometry(0.06, 2.5, 0.06);
        const tsGrooveMat = new THREE.MeshStandardMaterial({ color: 0x1a0e04, roughness: 0.9 });
        for (let i = 0; i < 5; i++) {
            const ang = (i / 5) * Math.PI * 2;
            const groove = new THREE.Mesh(tsGrooveGeo, tsGrooveMat);
            groove.position.set(Math.cos(ang) * 0.75, 1.75, Math.sin(ang) * 0.75);
            groove.rotation.y = ang;
            group.add(groove);
        }
        // 树干横向纹理环
        const tsRingGeo = new THREE.TorusGeometry(0.82, 0.03, 8, 20);
        const tsRingMat = new THREE.MeshStandardMaterial({ color: 0x2a1808, roughness: 0.85, flatShading: false });
        for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(tsRingGeo, tsRingMat);
            ring.position.y = 1.0 + i * 0.8;
            ring.rotation.x = Math.PI / 2;
            group.add(ring);
        }

        // 树冠 - 大型球体，超高细分
        const crownGeo = new THREE.IcosahedronGeometry(1.5, 2);
        const crownMat = new THREE.MeshStandardMaterial({ color: 0x1a4a10, roughness: 0.8, flatShading: false, metalness: 0.05 });
        const crown = new THREE.Mesh(crownGeo, crownMat);
        crown.position.y = 4.2;
        crown.castShadow = true;
        group.add(crown);

        // 第二层树冠 - 超高细分
        const crown2Geo = new THREE.IcosahedronGeometry(1.0, 2);
        const crown2 = new THREE.Mesh(crown2Geo, crownMat);
        crown2.position.y = 5.2;
        crown2.castShadow = true;
        group.add(crown2);
        // 第三层树冠
        const crown3 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 2), crownMat);
        crown3.position.set(0.3, 5.8, 0.1);
        crown3.castShadow = true;
        group.add(crown3);
        // 第四层小树冠
        const crown4 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 2), crownMat);
        crown4.position.set(-0.2, 6.1, -0.1);
        crown4.castShadow = true;
        group.add(crown4);
        // 侧面树冠
        const crown5 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 2), crownMat);
        crown5.position.set(0.8, 4.5, 0.3);
        crown5.castShadow = true;
        group.add(crown5);

        // 眼睛 - 大型发光眼睛
        const eyeGeo = new THREE.SphereGeometry(0.16, 10, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff3300 });
        const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
        eyeL.position.set(-0.3, 2.8, 0.7);
        group.add(eyeL);
        const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
        eyeR.position.set(0.3, 2.8, 0.7);
        group.add(eyeR);
        // 眼睛光晕
        const tsEyeLight = new THREE.PointLight(0xff3300, 1.2, 7);
        tsEyeLight.position.set(0, 2.8, 0.8);
        group.add(tsEyeLight);
        // 嘴部 - 大型树皮裂缝
        const tsMouthGeo = new THREE.BoxGeometry(0.3, 0.05, 0.02);
        const tsMouthMat = new THREE.MeshBasicMaterial({ color: 0x0a0500 });
        const tsMouth = new THREE.Mesh(tsMouthGeo, tsMouthMat);
        tsMouth.position.set(0, 2.4, 0.82); group.add(tsMouth);
        // 嘴部尖牙
        const tsFangGeo = new THREE.ConeGeometry(0.05, 0.12, 5);
        const tsFangMat = new THREE.MeshStandardMaterial({ color: 0xc8c0a8, roughness: 0.4 });
        const tsFangL = new THREE.Mesh(tsFangGeo, tsFangMat);
        tsFangL.position.set(-0.08, 2.36, 0.83); tsFangL.rotation.x = Math.PI; group.add(tsFangL);
        const tsFangR = new THREE.Mesh(tsFangGeo, tsFangMat);
        tsFangR.position.set(0.08, 2.36, 0.83); tsFangR.rotation.x = Math.PI; group.add(tsFangR);

        // 手臂 - 粗壮树枝，超高细分
        const armGeo = new THREE.CylinderGeometry(0.2, 0.12, 2.0, 10);
        const armMat = new THREE.MeshStandardMaterial({ color: 0x2a1808, roughness: 0.85, flatShading: false, metalness: 0.05 });
        const armL = new THREE.Mesh(armGeo, armMat);
        armL.position.set(-1.2, 2.0, 0);
        armL.rotation.z = Math.PI / 4;
        armL.castShadow = true;
        group.add(armL);
        const armR = new THREE.Mesh(armGeo, armMat);
        armR.position.set(1.2, 2.0, 0);
        armR.rotation.z = -Math.PI / 4;
        armR.castShadow = true;
        group.add(armR);
        // 手臂末端树叶球
        const tsArmLeafGeo = new THREE.IcosahedronGeometry(0.3, 2);
        const tsArmLeafL = new THREE.Mesh(tsArmLeafGeo, crownMat);
        tsArmLeafL.position.set(-1.9, 2.7, 0);
        tsArmLeafL.castShadow = true;
        group.add(tsArmLeafL);
        const tsArmLeafR = new THREE.Mesh(tsArmLeafGeo, crownMat);
        tsArmLeafR.position.set(1.9, 2.7, 0);
        tsArmLeafR.castShadow = true;
        group.add(tsArmLeafR);
        // 手臂分叉小树枝
        const tsBranchGeo = new THREE.CylinderGeometry(0.05, 0.08, 0.6, 6);
        const tsBranchMat = new THREE.MeshStandardMaterial({ color: 0x2a1808, roughness: 0.85, flatShading: false });
        const tsBranch1 = new THREE.Mesh(tsBranchGeo, tsBranchMat);
        tsBranch1.position.set(-1.5, 2.5, 0.2); tsBranch1.rotation.z = Math.PI / 3; group.add(tsBranch1);
        const tsBranch2 = new THREE.Mesh(tsBranchGeo, tsBranchMat);
        tsBranch2.position.set(1.5, 2.5, -0.2); tsBranch2.rotation.z = -Math.PI / 3; group.add(tsBranch2);

        // 根部 - 超高细分 + 第四条根
        const rootGeo = new THREE.CylinderGeometry(0.3, 0.1, 1.0, 8);
        const rootMat = new THREE.MeshStandardMaterial({ color: 0x1a0e04, roughness: 0.9, flatShading: false });
        const rootL = new THREE.Mesh(rootGeo, rootMat);
        rootL.position.set(-0.4, 0.25, 0.2);
        rootL.rotation.x = -0.3;
        rootL.castShadow = true;
        group.add(rootL);
        const rootR = new THREE.Mesh(rootGeo, rootMat);
        rootR.position.set(0.4, 0.25, 0.2);
        rootR.rotation.x = -0.3;
        rootR.castShadow = true;
        group.add(rootR);
        // 第三条根
        const root3 = new THREE.Mesh(rootGeo, rootMat);
        root3.position.set(0, 0.25, -0.4);
        root3.rotation.x = 0.3;
        root3.castShadow = true;
        group.add(root3);
        // 第四条根
        const root4 = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.08, 0.8, 8), rootMat);
        root4.position.set(-0.3, 0.2, -0.3);
        root4.rotation.set(0.2, 0.5, 0.2);
        root4.castShadow = true;
        group.add(root4);

        // 光源 - 更强
        const light = new THREE.PointLight(0x4a8a30, 2.5, 14);
        light.position.y = 4;
        group.add(light);

        this.scene.add(group);

        const enemy = {
            mesh: group,
            health: 700,
            maxHealth: 700,
            speed: 1.2,
            damage: 15,
            attackRange: 2.5,
            attackCooldown: 0,
            dead: false,
            state: 'chase',
            wanderDir: new THREE.Vector3(),
            wanderTimer: 0,
            bodyMat: trunkMat,
            hitFlash: 0,
            enemyType: 'tree_spirit',
            playerHit: false,
            burning: false,
            dropsAwarded: false,
            defense: 6,
            bossSkillTimer: 10,
            halfHpTriggered: false,
            projectiles: [],
            takeDamage(amount, attacker = null) {
                if (attacker) this.playerHit = true;
                const actualDamage = Math.max(0, amount - this.defense);
                this.health -= actualDamage;
                this.hitFlash = 0.2;
                if (this.health <= 0) {
                    this.dead = true;
                    this.deathTimer = 0;
                }
            },
        };
        this.enemies.push(enemy);
        this._createHealthBar(enemy);

        // 出场召唤5个树士卫
        for (let i = 0; i < 5; i++) {
            const ang = (i / 5) * Math.PI * 2;
            const sx = x + Math.cos(ang) * 4;
            const sz = z + Math.sin(ang) * 4;
            const sy = this.world.getHeight(sx, sz);
            this._spawnTreeGuardian(sx, sy, sz);
        }
    }

    _spawnEnhancedTreeGuardian(x, y, z) {
        this._spawnTreeGuardian(x, y, z);
        const e = this.enemies[this.enemies.length - 1];
        if (e) {
            e.health = 100;
            e.maxHealth = 100;
            e.defense = 5;
            e.enemyType = 'tree_guardian_enhanced';
            this._updateHealthBar(e);
        }
    }

    _spawnWoodBall(enemy) {
        const playerPos = this.player.position;
        const enemyPos = enemy.mesh.position.clone();
        enemyPos.y += 2.5;
        const dir = playerPos.clone().sub(enemyPos);
        dir.normalize();

        const ballGeo = new THREE.SphereGeometry(0.28, 12, 10);
        const ballMat = new THREE.MeshStandardMaterial({ color: 0x6a4a20, roughness: 0.55, flatShading: false });
        const ball = new THREE.Mesh(ballGeo, ballMat);
        ball.position.copy(enemyPos);
        ball.castShadow = true;
        this.scene.add(ball);

        enemy.projectiles.push({
            mesh: ball,
            velocity: dir.multiplyScalar(8),
            damage: 5,
            life: 5,
            mat: ballMat,
        });
    }

    _updateProjectiles(enemy, dt) {
        if (!enemy.projectiles) return;
        for (let i = enemy.projectiles.length - 1; i >= 0; i--) {
            const p = enemy.projectiles[i];
            p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));
            p.life -= dt;
            // 碰撞检测：玩家
            const dist = p.mesh.position.distanceTo(this.player.position);
            if (dist < 0.8) {
                this._bossDamagePlayers(p.damage);
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mat.dispose();
                enemy.projectiles.splice(i, 1);
                continue;
            }
            // 地面碰撞
            const groundY = this.world.getHeight(p.mesh.position.x, p.mesh.position.z);
            if (p.mesh.position.y < groundY) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mat.dispose();
                enemy.projectiles.splice(i, 1);
                continue;
            }
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mat.dispose();
                enemy.projectiles.splice(i, 1);
            }
        }
    }

    _setBurningEffect(enemy, burning) {
        if (burning && !enemy.burnEffect) {
            // 3层火焰
            const fireGeo1 = new THREE.ConeGeometry(0.2, 0.6, 8);
            const fireMat1 = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.8 });
            const fire1 = new THREE.Mesh(fireGeo1, fireMat1);
            fire1.position.y = 1.8;
            enemy.mesh.add(fire1);
            const fireGeo2 = new THREE.ConeGeometry(0.14, 0.45, 8);
            const fireMat2 = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.6 });
            const fire2 = new THREE.Mesh(fireGeo2, fireMat2);
            fire2.position.y = 1.85;
            enemy.mesh.add(fire2);
            const fireGeo3 = new THREE.ConeGeometry(0.08, 0.3, 8);
            const fireMat3 = new THREE.MeshBasicMaterial({ color: 0xffff88, transparent: true, opacity: 0.5 });
            const fire3 = new THREE.Mesh(fireGeo3, fireMat3);
            fire3.position.y = 1.9;
            enemy.mesh.add(fire3);
            const light = new THREE.PointLight(0xff6600, 1.5, 5);
            light.position.y = 1.5;
            enemy.mesh.add(light);
            enemy.burnEffect = { fire: fire1, fire2, fire3, light };
        } else if (!burning && enemy.burnEffect) {
            enemy.mesh.remove(enemy.burnEffect.fire);
            enemy.mesh.remove(enemy.burnEffect.fire2);
            enemy.mesh.remove(enemy.burnEffect.fire3);
            enemy.mesh.remove(enemy.burnEffect.light);
            enemy.burnEffect.fire.geometry.dispose();
            enemy.burnEffect.fire.material.dispose();
            enemy.burnEffect.fire2.geometry.dispose();
            enemy.burnEffect.fire2.material.dispose();
            enemy.burnEffect.fire3.geometry.dispose();
            enemy.burnEffect.fire3.material.dispose();
            enemy.burnEffect = null;
        }
    }

    update(dt) {
        // 石头世界：生成石之怪和石化人
        if (this.world.worldType === 'stone') {
            // 清除非石头世界敌人（保留树精和树士卫）
            for (const e of this.enemies) {
                if (!e.dead && e.enemyType !== 'stone_monster' && e.enemyType !== 'petrified_human' && e.enemyType !== 'tree_spirit' && e.enemyType !== 'tree_guardian' && e.enemyType !== 'tree_guardian_enhanced' && e.enemyType !== 'stone_guardian') { e.dead = true; e.deathTimer = 2; }
            }
            // 生成石之怪和石化人
            this.spawnTimer += dt;
            if (this.spawnTimer >= this.spawnInterval) {
                this.spawnTimer = 0;
                const playerPos = this.player.position;
                const maxStoneMonsters = 3 + this.world.dayCount;
                const stoneCount = this.enemies.filter(e => !e.dead && e.enemyType === 'stone_monster').length;
                const phCount = this.enemies.filter(e => !e.dead && e.enemyType === 'petrified_human').length;
                if (phCount < 4 && Math.random() < 0.4) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 20 + Math.random() * 20;
                    const x = playerPos.x + Math.cos(angle) * dist;
                    const z = playerPos.z + Math.sin(angle) * dist;
                    const y = this.world.getHeight(x, z);
                    this._spawnPetrifiedHuman(x, y, z);
                } else if (stoneCount < maxStoneMonsters) {
                    const angle = Math.random() * Math.PI * 2;
                    const dist = 20 + Math.random() * 20;
                    const x = playerPos.x + Math.cos(angle) * dist;
                    const z = playerPos.z + Math.sin(angle) * dist;
                    const y = this.world.getHeight(x, z);
                    this._spawnStoneMonster(x, y, z);
                }
            }
            // 更新石头世界敌人
            for (let i = this.enemies.length - 1; i >= 0; i--) {
                const e = this.enemies[i];
                if (e.dead) {
                    this._awardDrops(e);
                    if (e.healthBar) e.healthBar.sprite.visible = false;
                    e.deathTimer = (e.deathTimer || 0) + dt;
                    e.mesh.position.y -= dt * 2;
                    if (e.deathTimer > 1.5) {
                        this.scene.remove(e.mesh);
                        this.enemies.splice(i, 1);
                    }
                    continue;
                }
                const isStoneEnemy = e.enemyType === 'stone_monster' || e.enemyType === 'petrified_human' || e.enemyType === 'stone_guardian' || e.enemyType === 'stone_monster_boss';
                const isTreeEnemy = e.enemyType === 'tree_spirit' || e.enemyType === 'tree_guardian' || e.enemyType === 'tree_guardian_enhanced';
                if (!isStoneEnemy && !isTreeEnemy) {
                    // 清除非石头世界敌人的死亡动画
                    e.deathTimer += dt;
                    if (e.deathTimer > 1.5) {
                        if (e.mesh) {
                            this.world.scene.remove(e.mesh);
                            e.mesh.traverse(c => {
                                if (c.geometry) c.geometry.dispose();
                                if (c.material) c.material.dispose();
                            });
                        }
                        this.enemies.splice(i, 1);
                    }
                    continue;
                }
                // 石头世界敌人AI更新（含树精/树士卫）
                if (e.hitFlash > 0) {
                    e.hitFlash -= dt;
                    e.bodyMat.emissive.setHex(0x441111);
                    if (e.hitFlash <= 0) e.bodyMat.emissive.setHex(0x000000);
                    this._updateHealthBar(e);
                }
                e.attackCooldown = Math.max(0, e.attackCooldown - dt);
                // 树精boss技能
                if (e.enemyType === 'tree_spirit' && !e.dead) {
                    e.bossSkillTimer -= dt;
                    if (e.bossSkillTimer <= 0) {
                        e.bossSkillTimer = 10;
                        for (let b = 0; b < 3; b++) {
                            this._spawnWoodBall(e);
                        }
                    }
                    if (!e.halfHpTriggered && e.health <= e.maxHealth / 2) {
                        e.halfHpTriggered = true;
                        const pos = e.mesh.position;
                        for (let j = 0; j < 5; j++) {
                            const ang = (j / 5) * Math.PI * 2;
                            const sx = pos.x + Math.cos(ang) * 4;
                            const sz = pos.z + Math.sin(ang) * 4;
                            const sy = this.world.getHeight(sx, sz);
                            this._spawnEnhancedTreeGuardian(sx, sy, sz);
                        }
                    }
                    this._updateProjectiles(e, dt);
                }
                // 石志怪boss远程攻击
                if (e.enemyType === 'stone_monster_boss' && !e.dead) {
                    e.rangedCooldown = Math.max(0, e.rangedCooldown - dt);
                    this._updateStoneBalls(e, dt);
                }
                // 重力
                e.mesh.position.y -= 15 * dt;
                let groundY = this.world.getHeight(e.mesh.position.x, e.mesh.position.z);
                if (e.mesh.position.y < groundY) e.mesh.position.y = groundY;
                // 追击玩家或互相攻击
                const playerPos = this.player.position;
                const distToPlayer = e.mesh.position.distanceTo(playerPos);
                const aggroRange = e.enemyType === 'petrified_human' ? 15 : (e.enemyType === 'stone_monster_boss' ? e.detectRange : 20);
                // 树精/树士卫优先攻击石头怪物
                let foundStoneTarget = false;
                if (!e.dead && (e.enemyType === 'tree_spirit' || e.enemyType === 'tree_guardian' || e.enemyType === 'tree_guardian_enhanced')) {
                    for (let j = 0; j < this.enemies.length; j++) {
                        if (j === i) continue;
                        const other = this.enemies[j];
                        if (other.dead) continue;
                        if (other.enemyType !== 'stone_monster' && other.enemyType !== 'petrified_human' && other.enemyType !== 'stone_guardian' && other.enemyType !== 'stone_monster_boss') continue;
                        const dist = e.mesh.position.distanceTo(other.mesh.position);
                        if (dist < 30) {
                            foundStoneTarget = true;
                            const dir = other.mesh.position.clone().sub(e.mesh.position);
                            dir.y = 0;
                            dir.normalize();
                            e.mesh.position.x += dir.x * e.speed * dt;
                            e.mesh.position.z += dir.z * e.speed * dt;
                            e.mesh.rotation.y = Math.atan2(dir.x, dir.z);
                            if (dist < e.attackRange && e.attackCooldown <= 0) {
                                e.attackCooldown = 1.5;
                                other.takeDamage(e.damage);
                            }
                            break;
                        }
                    }
                }
                // 石头怪物优先攻击树精/树士卫
                let foundTreeTarget = false;
                if (!e.dead && (e.enemyType === 'stone_monster' || e.enemyType === 'petrified_human' || e.enemyType === 'stone_guardian' || e.enemyType === 'stone_monster_boss')) {
                    for (let j = 0; j < this.enemies.length; j++) {
                        if (j === i) continue;
                        const other = this.enemies[j];
                        if (other.dead) continue;
                        if (other.enemyType !== 'tree_spirit' && other.enemyType !== 'tree_guardian' && other.enemyType !== 'tree_guardian_enhanced') continue;
                        const dist = e.mesh.position.distanceTo(other.mesh.position);
                        if (dist < 30) {
                            foundTreeTarget = true;
                            const dir = other.mesh.position.clone().sub(e.mesh.position);
                            dir.y = 0;
                            dir.normalize();
                            e.mesh.position.x += dir.x * e.speed * dt;
                            e.mesh.position.z += dir.z * e.speed * dt;
                            e.mesh.rotation.y = Math.atan2(dir.x, dir.z);
                            if (dist < e.attackRange && e.attackCooldown <= 0) {
                                e.attackCooldown = 1.5;
                                other.takeDamage(e.damage);
                            }
                            // 石志怪boss远程攻击树精（检测到就发射，每5秒1次）
                            if (e.enemyType === 'stone_monster_boss' && e.rangedCooldown <= 0) {
                                e.rangedCooldown = 5;
                                this._spawnStoneBall(e, other.mesh.position);
                            }
                            break;
                        }
                    }
                }
                if (!foundStoneTarget && !foundTreeTarget) {
                    if (distToPlayer < aggroRange) {
                        const dir = playerPos.clone().sub(e.mesh.position);
                        dir.y = 0;
                        dir.normalize();
                        e.mesh.position.x += dir.x * e.speed * dt;
                        e.mesh.position.z += dir.z * e.speed * dt;
                        e.mesh.rotation.y = Math.atan2(dir.x, dir.z);
                        if (distToPlayer < e.attackRange && e.attackCooldown <= 0) {
                            e.attackCooldown = 1.5;
                            if (e.enemyType === 'stone_monster_boss' || e.enemyType === 'giant_stone_boss') {
                                this._bossDamagePlayers(e.damage);
                            } else {
                                this.player.takeDamage(e.damage);
                            }
                        }
                        // 石志怪boss远程攻击玩家（检测到就发射，每5秒1次）
                        if (e.enemyType === 'stone_monster_boss' && e.rangedCooldown <= 0) {
                            e.rangedCooldown = 5;
                            this._spawnStoneBall(e, playerPos);
                        }
                    } else {
                        e.wanderTimer -= dt;
                        if (e.wanderTimer <= 0) {
                            e.wanderTimer = 2 + Math.random() * 3;
                            const a = Math.random() * Math.PI * 2;
                            e.wanderDir.set(Math.cos(a), 0, Math.sin(a));
                        }
                        e.mesh.position.x += e.wanderDir.x * e.speed * 0.3 * dt;
                        e.mesh.position.z += e.wanderDir.z * e.speed * 0.3 * dt;
                    }
                }
            }
            return;
        }

        // 普通世界：清除石头世界敌人
        for (const e of this.enemies) {
            if (!e.dead && (e.enemyType === 'stone_monster' || e.enemyType === 'petrified_human')) { e.dead = true; e.deathTimer = 2; }
        }

        this.spawnTimer += dt;
        if (this.world.isNight && this.spawnTimer >= this.spawnInterval) {
            this.spawnTimer = 0;
            this.spawnEnemy();
        }

        // 白天生成牛
        this.cowSpawnTimer += dt;
        if (!this.world.isNight && this.cowSpawnTimer >= this.cowSpawnInterval) {
            this.cowSpawnTimer = 0;
            const maxCows = 3 + Math.floor(this.world.dayCount / 2);
            const cowCount = this.enemies.filter(e => !e.dead && e.enemyType === 'cow').length;
            if (cowCount < maxCows) {
                const playerPos = this.player.position;
                const angle = Math.random() * Math.PI * 2;
                const dist = 15 + Math.random() * 15;
                const x = playerPos.x + Math.cos(angle) * dist;
                const z = playerPos.z + Math.sin(angle) * dist;
                const y = this.world.getHeight(x, z);
                if (y > -0.5) this._spawnCow(x, y, z);
            }
        }

        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];

            // 白天燃烧：每秒损失2血，不会立即消失（树士卫/树精免疫）
            if (!this.world.isNight && !e.dead && e.enemyType !== 'tree_guardian' && e.enemyType !== 'tree_guardian_enhanced' && e.enemyType !== 'tree_spirit' && e.enemyType !== 'cow' && e.enemyType !== 'giant_stone_boss' && e.enemyType !== 'fake_tree') {
                e.burning = true;
                this._setBurningEffect(e, true);
                e.health -= 2 * dt;
                e.bodyMat.emissive.setHex(0x662200);
                this._updateHealthBar(e);
                if (e.health <= 0) {
                    e.dead = true;
                    e.deathTimer = 0;
                    this._awardDrops(e);
                }
            } else if (this.world.isNight && !e.dead && e.enemyType !== 'tree_guardian') {
                e.burning = false;
                this._setBurningEffect(e, false);
            }

            if (e.dead) {
                this._awardDrops(e);
                if (e.healthBar) e.healthBar.sprite.visible = false;
                e.deathTimer = (e.deathTimer || 0) + dt;
                e.mesh.position.y -= dt * 2;
                if (e.deathTimer > 1.5) {
                    this.scene.remove(e.mesh);
                    this.enemies.splice(i, 1);
                }
                continue;
            }

            // 受击闪烁
            if (e.hitFlash > 0) {
                e.hitFlash -= dt;
                e.bodyMat.emissive.setHex(0x441111);
                if (e.hitFlash <= 0) e.bodyMat.emissive.setHex(0x000000);
                this._updateHealthBar(e);
            }

            // 攻击冷却
            e.attackCooldown = Math.max(0, e.attackCooldown - dt);
            if (e._wallDamageCooldown > 0) e._wallDamageCooldown -= dt;

            // 树精boss技能
            if (e.enemyType === 'tree_spirit' && !e.dead) {
                // 技能1：每10秒发射3个木球
                e.bossSkillTimer -= dt;
                if (e.bossSkillTimer <= 0) {
                    e.bossSkillTimer = 10;
                    for (let b = 0; b < 3; b++) {
                        this._spawnWoodBall(e);
                    }
                }
                // 技能2：半血及以下触发，再召唤5个增强树士卫
                if (!e.halfHpTriggered && e.health <= e.maxHealth / 2) {
                    e.halfHpTriggered = true;
                    const pos = e.mesh.position;
                    for (let j = 0; j < 5; j++) {
                        const ang = (j / 5) * Math.PI * 2;
                        const sx = pos.x + Math.cos(ang) * 4;
                        const sz = pos.z + Math.sin(ang) * 4;
                        const sy = this.world.getHeight(sx, sz);
                        this._spawnEnhancedTreeGuardian(sx, sy, sz);
                    }
                }
                // 更新弹射物
                this._updateProjectiles(e, dt);
            }

            // 石志怪boss远程攻击和弹射物更新
            if (e.enemyType === 'stone_monster_boss' && !e.dead) {
                e.rangedCooldown = Math.max(0, e.rangedCooldown - dt);
                this._updateStoneBalls(e, dt);
            }

            // 重力
            e.mesh.position.y -= 15 * dt;
            let groundY = this.world.getHeight(e.mesh.position.x, e.mesh.position.z);
            // 建筑顶部当作地面
            for (const b of this.world.buildings) {
                if (b.type === 'torch') continue;
                const dx = e.mesh.position.x - b.mesh.position.x;
                const dz = e.mesh.position.z - b.mesh.position.z;
                let colHeight = 3, colRadius = 1.0;
                if (b.type === 'campfire') { colHeight = 0.5; colRadius = 0.6; }
                else if (b.type === 'wall_wood' || b.type === 'wall_stone') { colHeight = 3; colRadius = 1.0; }
                else if (b.type === 'knowledge_bookshelf') { colHeight = 2; colRadius = 0.8; }
                else if (b.type === 'auto_miner') { colHeight = 1.5; colRadius = 0.7; }
                else if (b.type === 'chest') { colHeight = 1; colRadius = 0.6; }
                else if (b.type === 'forge') { colHeight = 1; colRadius = 0.8; }
                else if (b.type === 'rare_wood_pile') { colHeight = 1; colRadius = 0.7; }
                else if (b.type === 'ultimate_bookshelf') { colHeight = 2.2; colRadius = 0.9; }
                else if (b.type === 'normal_altar') { colHeight = 2; colRadius = 0.8; }
                const dist2D = Math.sqrt(dx * dx + dz * dz);
                if (dist2D < colRadius + 0.4) {
                    const topY = b.mesh.position.y + colHeight;
                    if (e.mesh.position.y >= topY - 0.1 && groundY < topY) {
                        groundY = topY;
                    }
                }
            }
            if (e.mesh.position.y < groundY) e.mesh.position.y = groundY;

            // 建筑水平碰撞 — 推开怪物
            for (const b of this.world.buildings) {
                if (b.type === 'torch') continue;
                const dx = e.mesh.position.x - b.mesh.position.x;
                const dz = e.mesh.position.z - b.mesh.position.z;
                let colHeight = 3, colRadius = 1.0;
                if (b.type === 'campfire') { colHeight = 0.5; colRadius = 0.6; }
                else if (b.type === 'wall_wood' || b.type === 'wall_stone') { colHeight = 3; colRadius = 1.0; }
                else if (b.type === 'knowledge_bookshelf') { colHeight = 2; colRadius = 0.8; }
                else if (b.type === 'auto_miner') { colHeight = 1.5; colRadius = 0.7; }
                else if (b.type === 'chest') { colHeight = 1; colRadius = 0.6; }
                else if (b.type === 'forge') { colHeight = 1; colRadius = 0.8; }
                else if (b.type === 'rare_wood_pile') { colHeight = 1; colRadius = 0.7; }
                else if (b.type === 'ultimate_bookshelf') { colHeight = 2.2; colRadius = 0.9; }
                else if (b.type === 'normal_altar') { colHeight = 2; colRadius = 0.8; }
                const buildingTop = b.mesh.position.y + colHeight;
                if (e.mesh.position.y >= buildingTop - 0.1) continue;
                const dist2D = Math.sqrt(dx * dx + dz * dz);
                if (dist2D < colRadius + 0.4 && dist2D > 0.001) {
                    const push = (colRadius + 0.4 - dist2D);
                    e.mesh.position.x += (dx / dist2D) * push;
                    e.mesh.position.z += (dz / dist2D) * push;
                    // 充能围墙：怪物碰到受到5点伤害
                    if ((b.type === 'wall_wood' || b.type === 'wall_stone') && b.charge > 0) {
                        if (!e._wallDamageCooldown || e._wallDamageCooldown <= 0) {
                            e.takeDamage(5 * b.charge);
                            e._wallDamageCooldown = 1.0;
                            if (e.hitFlash !== undefined) e.hitFlash = 0.2;
                            this._updateHealthBar(e);
                            if (e.health <= 0 && !e.dead) {
                                e.dead = true;
                                e.deathTimer = 0;
                                this._awardDrops(e);
                            }
                        }
                    }
                }
            }

            // AI
            const playerPos = this.player.position;
            const distToPlayer = e.mesh.position.distanceTo(playerPos);

            // 牛：逃跑AI
            if (e.enemyType === 'cow') {
                if (distToPlayer < 12) {
                    // 逃跑
                    const fleeDir = e.mesh.position.clone().sub(playerPos);
                    fleeDir.y = 0;
                    fleeDir.normalize();
                    e.mesh.position.x += fleeDir.x * e.speed * 1.5 * dt;
                    e.mesh.position.z += fleeDir.z * e.speed * 1.5 * dt;
                    e.mesh.rotation.y = Math.atan2(fleeDir.x, fleeDir.z);
                } else {
                    // 闲置游走
                    e.wanderTimer -= dt;
                    if (e.wanderTimer <= 0) {
                        e.wanderTimer = 2 + Math.random() * 3;
                        const a = Math.random() * Math.PI * 2;
                        e.wanderDir.set(Math.cos(a), 0, Math.sin(a));
                    }
                    e.mesh.position.x += e.wanderDir.x * e.speed * 0.3 * dt;
                    e.mesh.position.z += e.wanderDir.z * e.speed * 0.3 * dt;
                }
                continue;
            }

            // 假树AI：未惊动不动，被攻击后追击玩家
            if (e.enemyType === 'fake_tree' && !e.dead) {
                if (e.provokedTimer > 0) {
                    e.provokedTimer -= dt;
                    if (!e.healthBarVisible) {
                        e.healthBarVisible = true;
                        if (e.healthBar) e.healthBar.sprite.visible = true;
                    }
                    if (e.provokedTimer <= 0) {
                        e.provoked = false;
                        e.healthBarVisible = false;
                        if (e.healthBar) e.healthBar.sprite.visible = false;
                    }
                }
                if (e.provoked) {
                    const dir = playerPos.clone().sub(e.mesh.position);
                    dir.y = 0;
                    dir.normalize();
                    e.mesh.position.x += dir.x * e.speed * dt;
                    e.mesh.position.z += dir.z * e.speed * dt;
                    e.mesh.rotation.y = Math.atan2(dir.x, dir.z);
                    if (distToPlayer < e.attackRange && e.attackCooldown <= 0) {
                        e.attackCooldown = 1.5;
                        // 检查玩家是否拿斧头，拿斧头额外5点伤害
                        const selItem = this.player.inventory.getSelectedItem();
                        const isAxe = selItem && (selItem.id === 'wood_axe' || selItem.id === 'stone_axe' || selItem.id === 'iron_axe' || selItem.id === 'steel_axe' || selItem.id === 'ultimate_axe' || selItem.id === 'certain_one');
                        const dmg = isAxe ? e.damage + 5 : e.damage;
                        this.player.takeDamage(dmg);
                    }
                }
                continue;
            }

            // 友善树士卫：保护玩家，攻击威胁玩家的怪物
            if (e.enemyType === 'friendly_tree_guardian' && !e.dead) {
                let target = null;
                let targetDist = Infinity;
                for (let j = 0; j < this.enemies.length; j++) {
                    if (j === i) continue;
                    const other = this.enemies[j];
                    if (other.dead) continue;
                    if (other.enemyType === 'friendly_tree_guardian' || other.enemyType === 'cow') continue;
                    const dToPlayer = other.mesh.position.distanceTo(playerPos);
                    if (dToPlayer < 20) {
                        const d = e.mesh.position.distanceTo(other.mesh.position);
                        if (d < targetDist) {
                            targetDist = d;
                            target = other;
                        }
                    }
                }
                if (target) {
                    const dir = target.mesh.position.clone().sub(e.mesh.position);
                    dir.y = 0;
                    dir.normalize();
                    e.mesh.position.x += dir.x * e.speed * dt;
                    e.mesh.position.z += dir.z * e.speed * dt;
                    e.mesh.rotation.y = Math.atan2(dir.x, dir.z);
                    if (targetDist < e.attackRange && e.attackCooldown <= 0) {
                        e.attackCooldown = 1.5;
                        target.takeDamage(e.damage);
                    }
                } else {
                    // 没有目标时跟随玩家
                    if (distToPlayer > 5) {
                        const dir = playerPos.clone().sub(e.mesh.position);
                        dir.y = 0;
                        dir.normalize();
                        e.mesh.position.x += dir.x * e.speed * 0.5 * dt;
                        e.mesh.position.z += dir.z * e.speed * 0.5 * dt;
                        e.mesh.rotation.y = Math.atan2(dir.x, dir.z);
                    }
                }
                continue;
            }

            // 石志怪boss AI（主世界）
            if (e.enemyType === 'stone_monster_boss' && !e.dead) {
                if (distToPlayer < e.detectRange) {
                    const dir = playerPos.clone().sub(e.mesh.position);
                    dir.y = 0;
                    dir.normalize();
                    e.mesh.position.x += dir.x * e.speed * dt;
                    e.mesh.position.z += dir.z * e.speed * dt;
                    e.mesh.rotation.y = Math.atan2(dir.x, dir.z);
                    if (distToPlayer < e.attackRange && e.attackCooldown <= 0) {
                        e.attackCooldown = 1.5;
                        this._bossDamagePlayers(e.damage);
                    }
                    // 远程攻击（检测到就发射，每5秒1次）
                    if (e.rangedCooldown <= 0) {
                        e.rangedCooldown = 5;
                        this._spawnStoneBall(e, playerPos);
                    }
                } else {
                    e.wanderTimer -= dt;
                    if (e.wanderTimer <= 0) {
                        e.wanderTimer = 2 + Math.random() * 3;
                        const a = Math.random() * Math.PI * 2;
                        e.wanderDir.set(Math.cos(a), 0, Math.sin(a));
                    }
                    e.mesh.position.x += e.wanderDir.x * e.speed * 0.3 * dt;
                    e.mesh.position.z += e.wanderDir.z * e.speed * 0.3 * dt;
                }
                continue;
            }

            // 巨石怪boss AI（主世界）
            if (e.enemyType === 'giant_stone_boss' && !e.dead) {
                this._updateGiantStoneBossAI(e, dt, playerPos);
                continue;
            }

            // 所有非树类怪物优先攻击树类怪物
            if (!e.dead && e.enemyType !== 'tree_guardian' && e.enemyType !== 'tree_guardian_enhanced' && e.enemyType !== 'tree_spirit' && e.enemyType !== 'friendly_tree_guardian' && e.enemyType !== 'cow') {
                let foundTreeTarget = false;
                for (let j = 0; j < this.enemies.length; j++) {
                    if (j === i) continue;
                    const treeTarget = this.enemies[j];
                    if (treeTarget.dead) continue;
                    if (treeTarget.enemyType !== 'tree_spirit' && treeTarget.enemyType !== 'tree_guardian' && treeTarget.enemyType !== 'tree_guardian_enhanced' && treeTarget.enemyType !== 'friendly_tree_guardian') continue;
                    const treeDist = e.mesh.position.distanceTo(treeTarget.mesh.position);
                    if (treeDist < 20) {
                        foundTreeTarget = true;
                        const dir = treeTarget.mesh.position.clone().sub(e.mesh.position);
                        dir.y = 0;
                        dir.normalize();
                        e.mesh.position.x += dir.x * e.speed * dt;
                        e.mesh.position.z += dir.z * e.speed * dt;
                        e.mesh.rotation.y = Math.atan2(dir.x, dir.z);
                        if (treeDist < e.attackRange && e.attackCooldown <= 0) {
                            e.attackCooldown = 1.5;
                            treeTarget.takeDamage(e.damage);
                        }
                        break;
                    }
                }
                if (foundTreeTarget) continue;
            }

            if (distToPlayer < 15) {
                e.state = 'chase';
            } else if (e.state === 'chase' && distToPlayer > 25) {
                e.state = 'idle';
            }

            if (e.state === 'chase') {
                const dir = playerPos.clone().sub(e.mesh.position);
                dir.y = 0;
                dir.normalize();
                e.mesh.position.x += dir.x * e.speed * dt;
                e.mesh.position.z += dir.z * e.speed * dt;
                // 朝向玩家
                e.mesh.rotation.y = Math.atan2(dir.x, dir.z);

                if (distToPlayer < e.attackRange && e.attackCooldown <= 0) {
                    e.attackCooldown = 1.5;
                    this._bossDamagePlayers(e.damage);
                }
            } else {
                // 闲置游走
                e.wanderTimer -= dt;
                if (e.wanderTimer <= 0) {
                    e.wanderTimer = 2 + Math.random() * 3;
                    const a = Math.random() * Math.PI * 2;
                    e.wanderDir.set(Math.cos(a), 0, Math.sin(a));
                }
                e.mesh.position.x += e.wanderDir.x * e.speed * 0.3 * dt;
                e.mesh.position.z += e.wanderDir.z * e.speed * 0.3 * dt;
            }

            // 怪物互攻：树士卫 vs 其它怪物（友善树士卫不参与互攻）
            if (!e.dead && e.enemyType !== 'friendly_tree_guardian') {
                for (let j = this.enemies.length - 1; j >= 0; j--) {
                    if (j === i) continue;
                    const other = this.enemies[j];
                    if (other.dead) continue;
                    if (other.enemyType === 'friendly_tree_guardian' || other.enemyType === 'cow') {
                        // 其他怪物会攻击友善树士卫，但不会攻击牛
                        if (other.enemyType === 'friendly_tree_guardian') {
                            const dist = e.mesh.position.distanceTo(other.mesh.position);
                            if (dist < 15) {
                                const dir = other.mesh.position.clone().sub(e.mesh.position);
                                dir.y = 0;
                                dir.normalize();
                                e.mesh.position.x += dir.x * e.speed * dt;
                                e.mesh.position.z += dir.z * e.speed * dt;
                                e.mesh.rotation.y = Math.atan2(dir.x, dir.z);
                                if (dist < e.attackRange && e.attackCooldown <= 0) {
                                    e.attackCooldown = 1.5;
                                    other.takeDamage(e.damage);
                                }
                                break;
                            }
                        }
                        continue;
                    }
                    const isEnemyPair = ((e.enemyType === 'tree_guardian' || e.enemyType === 'tree_guardian_enhanced' || e.enemyType === 'tree_spirit') && other.enemyType !== 'tree_guardian' && other.enemyType !== 'tree_guardian_enhanced' && other.enemyType !== 'tree_spirit') ||
                                        (e.enemyType !== 'tree_guardian' && e.enemyType !== 'tree_guardian_enhanced' && e.enemyType !== 'tree_spirit' && (other.enemyType === 'tree_guardian' || other.enemyType === 'tree_guardian_enhanced' || other.enemyType === 'tree_spirit'));
                    if (!isEnemyPair) continue;
                    const dist = e.mesh.position.distanceTo(other.mesh.position);
                    if (dist < 15) {
                        // 优先追击对方
                        const dir = other.mesh.position.clone().sub(e.mesh.position);
                        dir.y = 0;
                        dir.normalize();
                        e.mesh.position.x += dir.x * e.speed * dt;
                        e.mesh.position.z += dir.z * e.speed * dt;
                        e.mesh.rotation.y = Math.atan2(dir.x, dir.z);
                        if (dist < e.attackRange && e.attackCooldown <= 0) {
                            e.attackCooldown = 1.5;
                            other.takeDamage(e.damage);
                        }
                        break; // 只追击一个目标
                    }
                }
            }
        }
    }

    _awardDrops(enemy) {
        if (enemy.dropsAwarded) return;
        enemy.dropsAwarded = true;

        // Boss死亡同步到多人游戏
        if (enemy.enemyType === 'stone_monster_boss' || enemy.enemyType === 'giant_stone_boss' || enemy.enemyType === 'tree_spirit' || enemy.enemyType === 'gold_zombie') {
            if (window.game.multiplayer && window.game.multiplayer.connected) {
                window.game.multiplayer.sendBossDeath(enemy.enemyType);
            }
        }

        const playerDistance = this.player.position.distanceTo(enemy.mesh.position);
        if (!enemy.playerHit || playerDistance > 25) {
            if (window.game) window.game.onMessage('怪物死亡，但未满足掉落条件（需攻击过且距离≤25）');
            return;
        }

        if (enemy.enemyType === 'stone_monster') {
            let stoneCount = 1;
            if (Math.random() < 0.60) stoneCount += 1;
            if (Math.random() < 0.30) stoneCount += 2;
            if (Math.random() < 0.15) stoneCount += 3;
            if (Math.random() < 0.05) stoneCount += 4;
            window.game.inventory.addItem('stone', stoneCount);
            window.game.onMessage(`击杀石之怪! 获得${stoneCount}个石头`);
        } else if (enemy.enemyType === 'stone_guardian') {
            let msg = '击杀石守卫! 获得3个石头';
            window.game.inventory.addItem('stone', 3);
            if (Math.random() < 0.50) {
                window.game.inventory.addItem('rare_stone', 1);
                msg += '，1个稀有石头';
            }
            window.game.onMessage(msg);
        } else if (enemy.enemyType === 'stone_monster_boss') {
            let lightCount = 1;
            let msg = '击杀石志怪! 获得1个光明石头';
            if (Math.random() < 0.70) { lightCount += 1; msg += '，额外1个'; }
            if (Math.random() < 0.40) { lightCount += 4; msg += '，额外4个'; }
            if (Math.random() < 0.10) { lightCount += 15; msg += '，额外15个'; }
            window.game.inventory.addItem('light_stone', lightCount);
            window.game.onMessage(msg);
        } else if (enemy.enemyType === 'giant_stone_boss') {
            window.game.inventory.addItem('heart_of_stone', 10);
            window.game.onMessage('击杀巨石怪! 获得10个石之心');
        } else if (enemy.enemyType === 'petrified_human') {
            window.game.inventory.addItem('stone', 3);
            let msg = '击杀石化人! 获得3个石头';
            if (Math.random() < 0.70) {
                window.game.inventory.addItem('slotted_stone', 1);
                msg += '+1个切槽石头';
            }
            if (Math.random() < 0.30) {
                window.game.inventory.addItem('petrification_item', 1);
                msg += '+1个石化道具';
            }
            window.game.onMessage(msg);
        } else if (enemy.enemyType === 'cow') {
            window.game.inventory.addItem('fiber', 1);
            window.game.inventory.addItem('meat_raw', 1);
            let msg = '击杀牛! 获得1个纤维+1个生肉';
            if (Math.random() < 0.20) {
                window.game.inventory.addItem('meat_raw', 2);
                window.game.inventory.addItem('fiber', 3);
                msg += '，额外获得2个生肉+3个纤维';
            }
            window.game.onMessage(msg);
        } else if (enemy.enemyType === 'friendly_tree_guardian') {
            window.game.onMessage('友善树士卫倒下了...');
        } else if (enemy.enemyType === 'tree_guardian' || enemy.enemyType === 'tree_guardian_enhanced') {
            window.game.inventory.addItem('wood', 5);
            let msg = '击杀树士卫! 获得5个木材';
            if (Math.random() < 0.50) {
                window.game.inventory.addItem('rare_wood', 1);
                msg += '，1个稀有木材';
            }
            window.game.onMessage(msg);
        } else if (enemy.enemyType === 'tree_spirit') {
            window.game.inventory.addItem('high_wood', 5);
            window.game.inventory.addItem('high_willow', 5);
            let msg = '击杀树精! 获得5个高级木材+5个高级柳条';
            if (Math.random() < 0.70) {
                window.game.inventory.addItem('high_wood', 5);
                window.game.inventory.addItem('high_willow', 5);
                msg += '，额外获得5个高级木材+5个高级柳条';
            }
            window.game.onMessage(msg);
        } else if (enemy.enemyType === 'gold_zombie') {
            let coinCount = 3;
            if (Math.random() < 0.50) coinCount += 2;
            if (Math.random() < 0.20) coinCount += 5;
            window.game.inventory.addItem('gold_coin', coinCount);
            window.game.onMessage(`击杀金僵尸! 获得${coinCount}个金平`);
        } else if (enemy.enemyType === 'fake_tree') {
            let divineCount = 1;
            if (Math.random() < 0.30) divineCount += 1;
            if (Math.random() < 0.10) divineCount += 2;
            window.game.inventory.addItem('divine_wood', divineCount);
            window.game.onMessage(`击杀假树! 获得${divineCount}个神木`);
        } else {
            if (Math.random() < 0.5) window.game.inventory.addItem('meat_raw', 1);
            if (Math.random() < 0.0793) window.game.inventory.addItem('stone', 1);
            window.game.onMessage(enemy.burning ? '怪物燃烧死亡! 获得掉落物' : '击杀僵尸!');
        }
    }

    // 白天清除所有敌人（保留牛和友善树士卫）
    clearAll() {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (e.enemyType === 'cow' || e.enemyType === 'friendly_tree_guardian' || e.enemyType === 'gold_zombie') continue;
            this.scene.remove(e.mesh);
            this.enemies.splice(i, 1);
        }
    }
}
