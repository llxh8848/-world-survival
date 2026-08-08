// 第一人称玩家控制器

class Player {
    constructor(camera, world, survival, inventory) {
        this.camera = camera;
        this.world = world;
        this.survival = survival;
        this.inventory = inventory;

        this.position = new THREE.Vector3(0, 5, 0);
        this.velocity = new THREE.Vector3();
        this.onGround = false;

        this.yaw = 0;
        this.pitch = 0;
        this.height = 1.7;
        this.radius = 0.4;

        this.walkSpeed = 5;
        this.sprintSpeed = 8;
        this.jumpForce = 7;
        this.gravity = 20;

        this.canMove = true;
        this.mouseLocked = false;
        this.buildMode = false;
        this.buildItem = 'wall_wood';

        this.attackCooldown = 0;
        this.attackAnim = 0;
        this.interactTarget = null;
        this.recycleTarget = null;
        this.recycleTimer = 0;
        this.recycleTotal = 0;

        this.keys = {};
        this.thirdPerson = false;
        this.playerModel = null;
        this._initInput();
    }

    _initInput() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            // 数字键切换快捷栏
            if (e.code >= 'Digit1' && e.code <= 'Digit5') {
                this.inventory.selectSlot(parseInt(e.code.slice(-1)) - 1);
            }
        });
        document.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.mouseLocked) return;
            this.yaw -= e.movementX * 0.0025;
            this.pitch -= e.movementY * 0.0025;
            this.pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.pitch));
        });

        document.addEventListener('mousedown', (e) => {
            if (!this.mouseLocked) return;
            if (e.button === 0) { // 左键
                if (this.buildMode) this._placeBuilding();
                else { this._attack(); this._startRecycle(); }
            } else if (e.button === 2) { // 右键
                // 先检查是否对准知识书架
                if (!this._interactBuilding()) {
                    this._useItem();
                }
            }
        });
        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) this._stopRecycle();
        });
        document.addEventListener('contextmenu', (e) => e.preventDefault());

        // F10切换视角
        document.addEventListener('keydown', (e) => {
            if (e.code === 'F10') {
                e.preventDefault();
                this.toggleView();
            }
        });
    }

    toggleView() {
        this.thirdPerson = !this.thirdPerson;
        if (this.thirdPerson) {
            if (!this.playerModel) this._createPlayerModel();
            this.playerModel.visible = true;
        } else if (this.playerModel) {
            this.playerModel.visible = false;
        }
    }

    _createPlayerModel() {
        const group = new THREE.Group();
        // 身体 - 超高细分
        const bodyGeo = new THREE.CapsuleGeometry(0.35, 0.8, 12, 24);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4488ff, roughness: 0.5, flatShading: false });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.75;
        body.castShadow = true;
        body.receiveShadow = true;
        group.add(body);
        // 头 - 超高细分
        const headGeo = new THREE.SphereGeometry(0.3, 24, 18);
        const headMat = new THREE.MeshStandardMaterial({ color: 0x3366cc, roughness: 0.4, flatShading: false });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 1.5;
        head.castShadow = true;
        head.receiveShadow = true;
        group.add(head);
        // 头发
        const hairGeo = new THREE.SphereGeometry(0.32, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.45);
        const hairMat = new THREE.MeshStandardMaterial({ color: 0x2a1a08, roughness: 0.7, flatShading: false });
        const hair = new THREE.Mesh(hairGeo, hairMat);
        hair.position.y = 1.52;
        hair.castShadow = true;
        group.add(hair);
        // 手臂 - 超高细分
        const armGeo = new THREE.CapsuleGeometry(0.12, 0.5, 8, 16);
        const armMat = new THREE.MeshStandardMaterial({ color: 0x3366cc, roughness: 0.5, flatShading: false });
        const armL = new THREE.Mesh(armGeo, armMat);
        armL.position.set(-0.45, 0.8, 0);
        armL.castShadow = true;
        group.add(armL);
        const armR = new THREE.Mesh(armGeo, armMat);
        armR.position.set(0.45, 0.8, 0);
        armR.castShadow = true;
        group.add(armR);
        // 手
        const handGeo = new THREE.SphereGeometry(0.1, 10, 8);
        const handMat = new THREE.MeshStandardMaterial({ color: 0x3366cc, roughness: 0.5, flatShading: false });
        const handL = new THREE.Mesh(handGeo, handMat);
        handL.position.set(-0.45, 0.5, 0);
        handL.castShadow = true;
        group.add(handL);
        const handR = new THREE.Mesh(handGeo, handMat);
        handR.position.set(0.45, 0.5, 0);
        handR.castShadow = true;
        group.add(handR);
        // 腿 - 超高细分
        const pLegGeo = new THREE.CapsuleGeometry(0.14, 0.4, 8, 16);
        const pLegMat = new THREE.MeshStandardMaterial({ color: 0x224488, roughness: 0.55, flatShading: false });
        const pLegL = new THREE.Mesh(pLegGeo, pLegMat);
        pLegL.position.set(-0.18, 0.25, 0);
        pLegL.castShadow = true;
        group.add(pLegL);
        const pLegR = new THREE.Mesh(pLegGeo, pLegMat);
        pLegR.position.set(0.18, 0.25, 0);
        pLegR.castShadow = true;
        group.add(pLegR);
        // 盔甲
        this.armorMeshes = {};
        // 普通木盔甲 - 超高细分
        const helmGeo = new THREE.SphereGeometry(0.34, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
        const helmMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.6, transparent: true, opacity: 0, flatShading: false });
        const helm = new THREE.Mesh(helmGeo, helmMat);
        helm.position.y = 1.5;
        helm.castShadow = true;
        group.add(helm);
        // 头盔装饰带
        const helmBandGeo = new THREE.TorusGeometry(0.32, 0.03, 8, 20);
        const helmBandMat = new THREE.MeshStandardMaterial({ color: 0x6b3a1b, roughness: 0.6, transparent: true, opacity: 0 });
        const helmBand = new THREE.Mesh(helmBandGeo, helmBandMat);
        helmBand.position.y = 1.38;
        helmBand.rotation.x = Math.PI / 2;
        group.add(helmBand);
        this.armorMeshes.head = { mesh: helm, mat: helmMat, extras: [{ mesh: helmBand, mat: helmBandMat }] };
        // 胸甲 - 超高细分
        const chestGeo = new THREE.CapsuleGeometry(0.4, 0.5, 12, 24);
        const chestMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.6, transparent: true, opacity: 0, flatShading: false });
        const chest = new THREE.Mesh(chestGeo, chestMat);
        chest.position.y = 0.85;
        chest.castShadow = true;
        group.add(chest);
        // 胸甲装饰带
        const chestBandGeo = new THREE.TorusGeometry(0.38, 0.03, 8, 20);
        const chestBandMat = new THREE.MeshStandardMaterial({ color: 0x6b3a1b, roughness: 0.6, transparent: true, opacity: 0 });
        const chestBand = new THREE.Mesh(chestBandGeo, chestBandMat);
        chestBand.position.y = 0.6;
        chestBand.rotation.x = Math.PI / 2;
        group.add(chestBand);
        this.armorMeshes.chest = { mesh: chest, mat: chestMat, extras: [{ mesh: chestBand, mat: chestBandMat }] };
        // 护腿 - 超高细分
        const legsGeo = new THREE.CapsuleGeometry(0.28, 0.6, 12, 24);
        const legsMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.6, transparent: true, opacity: 0, flatShading: false });
        const legs = new THREE.Mesh(legsGeo, legsMat);
        legs.position.y = 0.35;
        legs.castShadow = true;
        group.add(legs);
        this.armorMeshes.legs = { mesh: legs, mat: legsMat };
        // 靴子 - 超高细分
        const bootsGeo = new THREE.BoxGeometry(0.3, 0.2, 0.45);
        const bootsMat = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.6, transparent: true, opacity: 0, flatShading: false });
        const boots = new THREE.Mesh(bootsGeo, bootsMat);
        boots.position.y = 0.1;
        boots.castShadow = true;
        group.add(boots);
        this.armorMeshes.feet = { mesh: boots, mat: bootsMat };

        // 坚硬木盔甲（独立模型）
        this.hardArmorMeshes = {};
        // 坚硬头盔：圆顶+金属帽檐+十字护面+后颈护片
        const hHelmGeo = new THREE.SphereGeometry(0.35, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
        const hHelmMat = new THREE.MeshStandardMaterial({ color: 0x4a2510, roughness: 0.5, transparent: true, opacity: 0, metalness: 0.4 });
        const hHelm = new THREE.Mesh(hHelmGeo, hHelmMat);
        hHelm.position.y = 1.5;
        hHelm.castShadow = true;
        group.add(hHelm);
        // 金属帽檐（环形）
        const brimGeo = new THREE.TorusGeometry(0.33, 0.04, 10, 24);
        const brimMat = new THREE.MeshStandardMaterial({ color: 0xb8782a, roughness: 0.3, metalness: 0.85, transparent: true, opacity: 0 });
        const brim = new THREE.Mesh(brimGeo, brimMat);
        brim.position.y = 1.35;
        brim.rotation.x = Math.PI / 2;
        group.add(brim);
        // 十字护面（横条+竖条）
        const crossHGeo = new THREE.BoxGeometry(0.5, 0.05, 0.05);
        const crossMat = new THREE.MeshStandardMaterial({ color: 0xb8782a, roughness: 0.3, metalness: 0.85, transparent: true, opacity: 0 });
        const crossH = new THREE.Mesh(crossHGeo, crossMat);
        crossH.position.set(0, 1.42, 0.31);
        group.add(crossH);
        const crossVGeo = new THREE.BoxGeometry(0.05, 0.35, 0.05);
        const crossV = new THREE.Mesh(crossVGeo, crossMat);
        crossV.position.set(0, 1.3, 0.31);
        group.add(crossV);
        // 后颈护片
        const neckGeo = new THREE.BoxGeometry(0.5, 0.25, 0.08);
        const neckMat = new THREE.MeshStandardMaterial({ color: 0x4a2510, roughness: 0.5, transparent: true, opacity: 0, metalness: 0.4 });
        const neck = new THREE.Mesh(neckGeo, neckMat);
        neck.position.set(0, 1.25, -0.3);
        group.add(neck);
        this.hardArmorMeshes.head = { mesh: hHelm, mat: hHelmMat, extras: [{ mesh: brim, mat: brimMat }, { mesh: crossH, mat: crossMat }, { mesh: crossV, mat: crossMat }, { mesh: neck, mat: neckMat }] };

        // 坚硬胸甲：锥形主体+金属腰带+铆钉+肩甲片
        const hChestGeo = new THREE.CylinderGeometry(0.42, 0.36, 1.1, 16);
        const hChestMat = new THREE.MeshStandardMaterial({ color: 0x4a2510, roughness: 0.5, transparent: true, opacity: 0, metalness: 0.4 });
        const hChest = new THREE.Mesh(hChestGeo, hChestMat);
        hChest.position.y = 0.85;
        hChest.castShadow = true;
        group.add(hChest);
        // 金属腰带
        const beltGeo = new THREE.TorusGeometry(0.38, 0.05, 10, 24);
        const beltMat = new THREE.MeshStandardMaterial({ color: 0xb8782a, roughness: 0.3, metalness: 0.85, transparent: true, opacity: 0 });
        const belt = new THREE.Mesh(beltGeo, beltMat);
        belt.position.y = 0.45;
        belt.rotation.x = Math.PI / 2;
        group.add(belt);
        // 腰带扣
        const buckleGeo = new THREE.BoxGeometry(0.12, 0.1, 0.06);
        const buckleMat = new THREE.MeshStandardMaterial({ color: 0xd4a050, roughness: 0.2, metalness: 0.9, transparent: true, opacity: 0 });
        const buckle = new THREE.Mesh(buckleGeo, buckleMat);
        buckle.position.set(0, 0.45, 0.38);
        group.add(buckle);
        // 肩甲片（梯形）
        const shoulderGeo = new THREE.CylinderGeometry(0.22, 0.16, 0.3, 10, 1, false, 0, Math.PI);
        const shoulderMatL = new THREE.MeshStandardMaterial({ color: 0x4a2510, roughness: 0.5, transparent: true, opacity: 0, metalness: 0.4 });
        const shoulderMatR = shoulderMatL.clone();
        const shoulderL = new THREE.Mesh(shoulderGeo, shoulderMatL);
        shoulderL.position.set(-0.42, 1.25, 0);
        shoulderL.rotation.z = Math.PI / 2;
        shoulderL.rotation.y = -Math.PI / 2;
        shoulderL.castShadow = true;
        group.add(shoulderL);
        const shoulderR = new THREE.Mesh(shoulderGeo, shoulderMatR);
        shoulderR.position.set(0.42, 1.25, 0);
        shoulderR.rotation.z = Math.PI / 2;
        shoulderR.rotation.y = Math.PI / 2;
        shoulderR.castShadow = true;
        group.add(shoulderR);
        // 铆钉
        const rivetGeo = new THREE.SphereGeometry(0.04, 10, 8);
        const rivetMat = new THREE.MeshStandardMaterial({ color: 0xd4a050, roughness: 0.2, metalness: 0.9, transparent: true, opacity: 0 });
        const rivets = [];
        const rivetMats = [];
        for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2;
            const rm = rivetMat.clone();
            const r = new THREE.Mesh(rivetGeo, rm);
            r.position.set(Math.cos(ang) * 0.4, 1.1, Math.sin(ang) * 0.4);
            group.add(r);
            rivets.push({ mesh: r, mat: rm });
        }
        this.hardArmorMeshes.chest = { mesh: hChest, mat: hChestMat, extras: [{ mesh: belt, mat: beltMat }, { mesh: buckle, mat: buckleMat }, { mesh: shoulderL, mat: shoulderMatL }, { mesh: shoulderR, mat: shoulderMatR }, ...rivets] };

        // 坚硬护腿：双腿独立板甲+金属护膝+绑带
        const hLegsMat = new THREE.MeshStandardMaterial({ color: 0x4a2510, roughness: 0.5, transparent: true, opacity: 0, metalness: 0.4 });
        const legGeo = new THREE.CylinderGeometry(0.18, 0.14, 1.0, 10, 1, false, 0, Math.PI * 1.2);
        const legL = new THREE.Mesh(legGeo, hLegsMat);
        legL.position.set(-0.2, 0.35, 0);
        legL.rotation.y = Math.PI / 2;
        legL.castShadow = true;
        group.add(legL);
        const legR = new THREE.Mesh(legGeo, hLegsMat);
        legR.position.set(0.2, 0.35, 0);
        legR.rotation.y = -Math.PI / 2;
        legR.castShadow = true;
        group.add(legR);
        // 金属护膝（半球形）
        const kneeGuardGeo = new THREE.SphereGeometry(0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
        const kneeMatL = new THREE.MeshStandardMaterial({ color: 0xb8782a, roughness: 0.3, metalness: 0.85, transparent: true, opacity: 0 });
        const kneeMatR = kneeMatL.clone();
        const kneeL = new THREE.Mesh(kneeGuardGeo, kneeMatL);
        kneeL.position.set(-0.2, 0.15, 0.15);
        kneeL.rotation.x = Math.PI / 2;
        group.add(kneeL);
        const kneeR = new THREE.Mesh(kneeGuardGeo, kneeMatR);
        kneeR.position.set(0.2, 0.15, 0.15);
        kneeR.rotation.x = Math.PI / 2;
        group.add(kneeR);
        // 金属绑带（每腿两条）
        const strapGeo = new THREE.TorusGeometry(0.16, 0.03, 8, 16);
        const strapMat1L = new THREE.MeshStandardMaterial({ color: 0xb8782a, roughness: 0.3, metalness: 0.85, transparent: true, opacity: 0 });
        const strapMat1R = strapMat1L.clone();
        const strapMat2L = strapMat1L.clone();
        const strapMat2R = strapMat1L.clone();
        const strap1L = new THREE.Mesh(strapGeo, strapMat1L);
        strap1L.position.set(-0.2, 0.55, 0); strap1L.rotation.x = Math.PI / 2;
        group.add(strap1L);
        const strap1R = new THREE.Mesh(strapGeo, strapMat1R);
        strap1R.position.set(0.2, 0.55, 0); strap1R.rotation.x = Math.PI / 2;
        group.add(strap1R);
        const strap2L = new THREE.Mesh(strapGeo, strapMat2L);
        strap2L.position.set(-0.2, -0.15, 0); strap2L.rotation.x = Math.PI / 2;
        group.add(strap2L);
        const strap2R = new THREE.Mesh(strapGeo, strapMat2R);
        strap2R.position.set(0.2, -0.15, 0); strap2R.rotation.x = Math.PI / 2;
        group.add(strap2R);
        this.hardArmorMeshes.legs = { mesh: legL, mat: hLegsMat, extras: [{ mesh: legR, mat: hLegsMat }, { mesh: kneeL, mat: kneeMatL }, { mesh: kneeR, mat: kneeMatR }, { mesh: strap1L, mat: strapMat1L }, { mesh: strap1R, mat: strapMat1R }, { mesh: strap2L, mat: strapMat2L }, { mesh: strap2R, mat: strapMat2R }] };

        // 坚硬靴子：高筒+金属鞋底+鞋面铆钉+脚踝护环
        const hBootsGeo = new THREE.CylinderGeometry(0.17, 0.2, 0.45, 10, 1, false, 0, Math.PI * 1.3);
        const hBootsMat = new THREE.MeshStandardMaterial({ color: 0x4a2510, roughness: 0.5, transparent: true, opacity: 0, metalness: 0.4 });
        const bootL = new THREE.Mesh(hBootsGeo, hBootsMat);
        bootL.position.set(-0.2, 0.2, 0.03);
        bootL.rotation.y = Math.PI / 2;
        bootL.castShadow = true;
        group.add(bootL);
        const bootR = new THREE.Mesh(hBootsGeo, hBootsMat);
        bootR.position.set(0.2, 0.2, 0.03);
        bootR.rotation.y = -Math.PI / 2;
        bootR.castShadow = true;
        group.add(bootR);
        // 金属鞋底
        const soleGeo = new THREE.BoxGeometry(0.22, 0.06, 0.5);
        const soleMat = new THREE.MeshStandardMaterial({ color: 0xb8782a, roughness: 0.3, metalness: 0.85, transparent: true, opacity: 0 });
        const soleL = new THREE.Mesh(soleGeo, soleMat);
        soleL.position.set(-0.2, 0.02, 0.05);
        group.add(soleL);
        const soleR = new THREE.Mesh(soleGeo, soleMat);
        soleR.position.set(0.2, 0.02, 0.05);
        group.add(soleR);
        // 脚踝护环
        const ankleGeo = new THREE.TorusGeometry(0.17, 0.035, 8, 16);
        const ankleMatL = new THREE.MeshStandardMaterial({ color: 0xb8782a, roughness: 0.3, metalness: 0.85, transparent: true, opacity: 0 });
        const ankleMatR = ankleMatL.clone();
        const ankleL = new THREE.Mesh(ankleGeo, ankleMatL);
        ankleL.position.set(-0.2, 0.35, 0); ankleL.rotation.x = Math.PI / 2;
        group.add(ankleL);
        const ankleR = new THREE.Mesh(ankleGeo, ankleMatR);
        ankleR.position.set(0.2, 0.35, 0); ankleR.rotation.x = Math.PI / 2;
        group.add(ankleR);
        this.hardArmorMeshes.feet = { mesh: bootL, mat: hBootsMat, extras: [{ mesh: bootR, mat: hBootsMat }, { mesh: soleL, mat: soleMat }, { mesh: soleR, mat: soleMat }, { mesh: ankleL, mat: ankleMatL }, { mesh: ankleR, mat: ankleMatR }] };

        // 石头盔甲（独立模型）
        this.stoneArmorMeshes = {};
        // 石头盔：岩石圆顶+石刺+护鼻 - 超高细分
        const sHelmGeo = new THREE.IcosahedronGeometry(0.36, 3);
        const sHelmMat = new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.85, transparent: true, opacity: 0, flatShading: false, metalness: 0.1 });
        const sHelm = new THREE.Mesh(sHelmGeo, sHelmMat);
        sHelm.position.y = 1.5;
        sHelm.castShadow = true;
        group.add(sHelm);
        // 石刺（4个尖锥）- 超高细分
        const spikeGeo = new THREE.ConeGeometry(0.06, 0.22, 8);
        const spikeMat = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.75, transparent: true, opacity: 0, flatShading: false });
        const spike1 = new THREE.Mesh(spikeGeo, spikeMat);
        spike1.position.set(0, 1.85, 0); group.add(spike1);
        const spike2 = new THREE.Mesh(spikeGeo, spikeMat.clone());
        spike2.position.set(-0.15, 1.78, 0.1); spike2.rotation.z = 0.4; group.add(spike2);
        const spike3 = new THREE.Mesh(spikeGeo, spikeMat.clone());
        spike3.position.set(0.15, 1.78, 0.1); spike3.rotation.z = -0.4; group.add(spike3);
        const spike4 = new THREE.Mesh(spikeGeo, spikeMat.clone());
        spike4.position.set(0, 1.78, -0.15); spike4.rotation.x = 0.4; group.add(spike4);
        // 护鼻条
        const noseGeo = new THREE.BoxGeometry(0.08, 0.3, 0.06);
        const noseMat = new THREE.MeshStandardMaterial({ color: 0x5a5e64, roughness: 0.8, transparent: true, opacity: 0, flatShading: false });
        const nose = new THREE.Mesh(noseGeo, noseMat);
        nose.position.set(0, 1.35, 0.32); group.add(nose);
        this.stoneArmorMeshes.head = { mesh: sHelm, mat: sHelmMat, extras: [{ mesh: spike1, mat: spikeMat }, { mesh: spike2, mat: spikeMat.clone() }, { mesh: spike3, mat: spikeMat.clone() }, { mesh: spike4, mat: spikeMat.clone() }, { mesh: nose, mat: noseMat }] };

        // 石胸甲：厚重岩石板+石板腰带+肩部石块 - 超高细分
        const sChestGeo = new THREE.BoxGeometry(0.72, 0.9, 0.6);
        const sChestMat = new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.85, transparent: true, opacity: 0, flatShading: false, metalness: 0.1 });
        const sChest = new THREE.Mesh(sChestGeo, sChestMat);
        sChest.position.y = 0.85;
        sChest.castShadow = true;
        group.add(sChest);
        // 石板腰带
        const sBeltGeo = new THREE.BoxGeometry(0.68, 0.12, 0.58);
        const sBeltMat = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.75, transparent: true, opacity: 0, flatShading: false });
        const sBelt = new THREE.Mesh(sBeltGeo, sBeltMat);
        sBelt.position.y = 0.45; group.add(sBelt);
        // 肩部石块 - 超高细分
        const sShoulderGeo = new THREE.IcosahedronGeometry(0.22, 2);
        const sShoulderMatL = new THREE.MeshStandardMaterial({ color: 0x5a5e64, roughness: 0.8, transparent: true, opacity: 0, flatShading: false });
        const sShoulderMatR = sShoulderMatL.clone();
        const sShoulderL = new THREE.Mesh(sShoulderGeo, sShoulderMatL);
        sShoulderL.position.set(-0.45, 1.2, 0); sShoulderL.castShadow = true; group.add(sShoulderL);
        const sShoulderR = new THREE.Mesh(sShoulderGeo, sShoulderMatR);
        sShoulderR.position.set(0.45, 1.2, 0); sShoulderR.castShadow = true; group.add(sShoulderR);
        // 胸口石晶 - 超高细分
        const gemGeo = new THREE.OctahedronGeometry(0.09, 2);
        const gemMat = new THREE.MeshStandardMaterial({ color: 0x8a8e94, roughness: 0.25, metalness: 0.6, transparent: true, opacity: 0, flatShading: false });
        const gem = new THREE.Mesh(gemGeo, gemMat);
        gem.position.set(0, 0.95, 0.32); group.add(gem);
        this.stoneArmorMeshes.chest = { mesh: sChest, mat: sChestMat, extras: [{ mesh: sBelt, mat: sBeltMat }, { mesh: sShoulderL, mat: sShoulderMatL }, { mesh: sShoulderR, mat: sShoulderMatR }, { mesh: gem, mat: gemMat }] };

        // 石护腿：双腿石板+护膝石块 - 超高细分
        const sLegsMat = new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.85, transparent: true, opacity: 0, flatShading: false, metalness: 0.1 });
        const sLegGeo = new THREE.BoxGeometry(0.22, 0.9, 0.28);
        const sLegL = new THREE.Mesh(sLegGeo, sLegsMat);
        sLegL.position.set(-0.2, 0.35, 0); sLegL.castShadow = true; group.add(sLegL);
        const sLegR = new THREE.Mesh(sLegGeo, sLegsMat);
        sLegR.position.set(0.2, 0.35, 0); sLegR.castShadow = true; group.add(sLegR);
        // 护膝石块 - 超高细分
        const sKneeGeo = new THREE.IcosahedronGeometry(0.14, 2);
        const sKneeMatL = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.75, transparent: true, opacity: 0, flatShading: false });
        const sKneeMatR = sKneeMatL.clone();
        const sKneeL = new THREE.Mesh(sKneeGeo, sKneeMatL);
        sKneeL.position.set(-0.2, 0.1, 0.16); group.add(sKneeL);
        const sKneeR = new THREE.Mesh(sKneeGeo, sKneeMatR);
        sKneeR.position.set(0.2, 0.1, 0.16); group.add(sKneeR);
        this.stoneArmorMeshes.legs = { mesh: sLegL, mat: sLegsMat, extras: [{ mesh: sLegR, mat: sLegsMat }, { mesh: sKneeL, mat: sKneeMatL }, { mesh: sKneeR, mat: sKneeMatR }] };

        // 石靴：厚重石靴+石底+脚踝石环 - 超高细分
        const sBootsGeo = new THREE.BoxGeometry(0.24, 0.4, 0.5);
        const sBootsMat = new THREE.MeshStandardMaterial({ color: 0x4a4e54, roughness: 0.85, transparent: true, opacity: 0, flatShading: false, metalness: 0.1 });
        const sBootL = new THREE.Mesh(sBootsGeo, sBootsMat);
        sBootL.position.set(-0.2, 0.2, 0.05); sBootL.castShadow = true; group.add(sBootL);
        const sBootR = new THREE.Mesh(sBootsGeo, sBootsMat);
        sBootR.position.set(0.2, 0.2, 0.05); sBootR.castShadow = true; group.add(sBootR);
        // 石底
        const sSoleGeo = new THREE.BoxGeometry(0.26, 0.08, 0.54);
        const sSoleMat = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.75, transparent: true, opacity: 0, flatShading: false });
        const sSoleL = new THREE.Mesh(sSoleGeo, sSoleMat);
        sSoleL.position.set(-0.2, 0.02, 0.05); group.add(sSoleL);
        const sSoleR = new THREE.Mesh(sSoleGeo, sSoleMat);
        sSoleR.position.set(0.2, 0.02, 0.05); group.add(sSoleR);
        // 脚踝石环
        const sAnkleGeo = new THREE.TorusGeometry(0.18, 0.04, 10, 20);
        const sAnkleMatL = new THREE.MeshStandardMaterial({ color: 0x6a6e74, roughness: 0.75, transparent: true, opacity: 0, flatShading: false });
        const sAnkleMatR = sAnkleMatL.clone();
        const sAnkleL = new THREE.Mesh(sAnkleGeo, sAnkleMatL);
        sAnkleL.position.set(-0.2, 0.38, 0.05); sAnkleL.rotation.x = Math.PI / 2; group.add(sAnkleL);
        const sAnkleR = new THREE.Mesh(sAnkleGeo, sAnkleMatR);
        sAnkleR.position.set(0.2, 0.38, 0.05); sAnkleR.rotation.x = Math.PI / 2; group.add(sAnkleR);
        this.stoneArmorMeshes.feet = { mesh: sBootL, mat: sBootsMat, extras: [{ mesh: sBootR, mat: sBootsMat }, { mesh: sSoleL, mat: sSoleMat }, { mesh: sSoleR, mat: sSoleMat }, { mesh: sAnkleL, mat: sAnkleMatL }, { mesh: sAnkleR, mat: sAnkleMatR }] };

        group.visible = false;
        this.world.scene.add(group);
        this.playerModel = group;
    }

    _updatePlayerModel() {
        if (!this.playerModel) return;
        this.playerModel.position.copy(this.position);
        this.playerModel.position.y -= 1.7;
        this.playerModel.rotation.y = this.yaw;
        // 更新盔甲显示
        if (this.armorMeshes) {
            const eq = this.inventory.equipment;
            const slots = { head: eq.head, chest: eq.chest, legs: eq.legs, feet: eq.feet };
            for (const [slot, item] of Object.entries(slots)) {
                // 普通木盔甲
                const part = this.armorMeshes[slot];
                if (part) {
                    if (item && ITEMS[item.id] && !item.id.startsWith('hard_wood') && !item.id.startsWith('stone_')) {
                        part.mat.opacity = 0.85;
                    } else {
                        part.mat.opacity = 0;
                    }
                    if (part.extras) {
                        for (const ex of part.extras) {
                            ex.mat.opacity = (item && ITEMS[item.id] && !item.id.startsWith('hard_wood') && !item.id.startsWith('stone_')) ? 0.85 : 0;
                        }
                    }
                }
                // 坚硬木盔甲
                const hPart = this.hardArmorMeshes && this.hardArmorMeshes[slot];
                if (hPart) {
                    const isHard = item && ITEMS[item.id] && item.id.startsWith('hard_wood');
                    hPart.mat.opacity = isHard ? 0.85 : 0;
                    if (hPart.extras) {
                        for (const ex of hPart.extras) {
                            ex.mat.opacity = isHard ? 0.85 : 0;
                        }
                    }
                }
                // 石头盔甲
                const sPart = this.stoneArmorMeshes && this.stoneArmorMeshes[slot];
                if (sPart) {
                    const isStone = item && ITEMS[item.id] && item.id.startsWith('stone_');
                    sPart.mat.opacity = isStone ? 0.85 : 0;
                    if (sPart.extras) {
                        for (const ex of sPart.extras) {
                            ex.mat.opacity = isStone ? 0.85 : 0;
                        }
                    }
                }
            }
        }
    }

    lockMouse() {
        this.mouseLocked = true;
        if (!('ontouchstart' in window)) {
            const promise = document.body.requestPointerLock();
            if (promise && promise.catch) promise.catch(() => {});
        }
    }

    unlockMouse() {
        this.mouseLocked = false;
        if (!('ontouchstart' in window)) {
            document.exitPointerLock();
        }
    }

    _attack() {
        if (this.attackCooldown > 0) return;
        this.attackCooldown = 0.4;
        this.attackAnim = 0.25;

        const selectedItem = this.inventory.getSelectedItem();
        let damage = 1;
        let toolPower = 0;
        if (selectedItem) {
            const info = this._getItemInfo(selectedItem.id);
            damage = 1 + (info.attack_bonus || 0);
            toolPower = info.mining_power || info.chopping_power || 0;
            // 充能加成
            const charge = selectedItem.charge || 0;
            if (charge > 0) {
                if (info.weapon || info.attack_bonus) damage += charge;
                if (info.mining_power) toolPower += charge;
                if (info.chopping_power) toolPower += charge;
            }
        }

        // 射线检测前方物体
        const raycaster = new THREE.Raycaster();
        const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
        raycaster.set(this.position, dir);
        raycaster.far = 4;

        // 检测资源
        const resourceMeshes = this.world.resources.filter(r => !r.depleted).map(r => r.mesh);
        const hits = raycaster.intersectObjects(resourceMeshes, true);
        if (hits.length > 0) {
            const hitMesh = hits[0].object;
            const resource = this.world.resources.find(r => r.mesh === hitMesh.parent || r.mesh === hitMesh);
            if (resource && !resource.depleted) {
                // 检查工具匹配
                let power = toolPower;
                let axeId = null;
                let toolCharge = 0;
                if (resource.group === 'tree') {
                    const info = selectedItem ? this._getItemInfo(selectedItem.id) : {};
                    power = info.chopping_power || 0;
                    axeId = selectedItem ? selectedItem.id : null;
                    toolCharge = selectedItem ? (selectedItem.charge || 0) : 0;
                    power += toolCharge;
                } else if (resource.group === 'rock') {
                    const info = selectedItem ? this._getItemInfo(selectedItem.id) : {};
                    power = info.mining_power || 0;
                    toolCharge = selectedItem ? (selectedItem.charge || 0) : 0;
                    power += toolCharge;
                }
                const drops = this.world.harvest(resource, power, axeId, toolCharge);
                if (drops) {
                    for (const [id, amt] of Object.entries(drops)) {
                        this.inventory.addItem(id, amt);
                    }
                    window.game.onMessage(`采集获得: ${Object.entries(drops).map(([k,v]) => `${v}x${this._getItemInfo(k)?.name||k}`).join(', ')}`);
                } else {
                    window.game.onMessage(`砍树中... ${resource.health}/${resource.maxHealth}`);
                }
            }
        }

        // 检测敌人
        if (window.game.enemies) {
            for (const enemy of window.game.enemies.enemies) {
                if (enemy.dead) continue;
                const dx = this.position.x - enemy.mesh.position.x;
                const dz = this.position.z - enemy.mesh.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist < 3) {
                    // 检查是否大致朝向敌人（仅用水平方向）
                    const toEnemy2D = new THREE.Vector3(dx * -1, 0, dz * -1).normalize();
                    const dir2D = new THREE.Vector3(dir.x, 0, dir.z).normalize();
                    if (dir2D.dot(toEnemy2D) > 0.3) {
                        // 斧头对树精/树士卫/假树无视防御值额外伤害
                        if (selectedItem && (enemy.enemyType === 'tree_spirit' || enemy.enemyType === 'tree_guardian' || enemy.enemyType === 'tree_guardian_enhanced' || enemy.enemyType === 'friendly_tree_guardian' || enemy.enemyType === 'fake_tree')) {
                            const axeBonus = { wood_axe: 5, stone_axe: 10, iron_axe: 20, steel_axe: 25, ultimate_axe: 40, certain_one: 40 }[selectedItem.id];
                            if (axeBonus) {
                                enemy.health -= axeBonus;
                                enemy.hitFlash = 0.2;
                                if (window.game && window.game.enemies) window.game.enemies._updateHealthBar(enemy);
                                if (window.game) window.game.onMessage(`斧头额外伤害: ${axeBonus}`);
                                if (enemy.health <= 0) {
                                    enemy.dead = true;
                                    enemy.deathTimer = 0;
                                }
                            }
                        }
                        // 镐子对石守卫/石化人无视防御值额外伤害
                        if (selectedItem && (enemy.enemyType === 'stone_guardian' || enemy.enemyType === 'petrified_human' || enemy.enemyType === 'stone_monster_boss' || enemy.enemyType === 'giant_stone_boss' || enemy.enemyType === 'gold_zombie')) {
                            const pickBonus = { wood_pickaxe: 5, stone_pickaxe: 10, iron_pickaxe: 20, steel_pickaxe: 25, ultimate_pickaxe: 40, certain_one: 40 }[selectedItem.id];
                            if (pickBonus) {
                                enemy.health -= pickBonus + 1;
                                enemy.hitFlash = 0.2;
                                if (window.game && window.game.enemies) window.game.enemies._updateHealthBar(enemy);
                                if (window.game) window.game.onMessage(`镐子额外伤害: ${pickBonus + 1}`);
                                if (enemy.health <= 0) {
                                    enemy.dead = true;
                                    enemy.deathTimer = 0;
                                }
                            }
                        }
                        enemy.takeDamage(damage, this);
                        if (window.game && window.game.enemies) window.game.enemies._updateHealthBar(enemy);
                    }
                }
            }
        }

        // 多人PvP攻击检测
        if (window.game.multiplayer) {
            window.game.multiplayer.checkPvPAttack(damage);
        }

        // 狂欢之剑使用次数消耗
        if (selectedItem && selectedItem.id === 'carnival_sword') {
            selectedItem.uses = (selectedItem.uses || 0) + 1;
            const maxUses = this._getItemInfo('carnival_sword').maxUses || 5;
            if (selectedItem.uses >= maxUses) {
                this.inventory.removeItem('carnival_sword', 1);
                window.game.onMessage('狂欢之剑已达到使用上限，消失了！');
            } else {
                window.game.onMessage(`狂欢之剑剩余使用次数: ${maxUses - selectedItem.uses}`);
            }
            this.inventory.notify();
        }
    }

    _useItem() {
        const selectedItem = this.inventory.getSelectedItem();
        if (!selectedItem) return;
        const info = this._getItemInfo(selectedItem.id);
        // 可放置物品：右键放置
        if (info.placeable) {
            const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
            const pos = this.position.clone().add(dir.multiplyScalar(3));
            pos.y = this.world.getHeight(pos.x, pos.z);
            pos.x = Math.round(pos.x);
            pos.z = Math.round(pos.z);
            let placeYaw = this.yaw;
            // 墙体对齐：如果旁边有墙，对齐位置和朝向
            if (selectedItem.id === 'wall_wood' || selectedItem.id === 'wall_stone') {
                const snap = this._snapToAdjacentWall(pos, selectedItem.id);
                if (snap) {
                    pos.copy(snap.pos);
                    placeYaw = snap.yaw;
                }
            }
            this.world.placeBuilding(selectedItem.id, pos, placeYaw, selectedItem.charge || 0);
            this.inventory.removeItem(selectedItem.id, 1);
            window.game.onMessage(`放置了 ${info.name}`);
            // 同步建筑到多人游戏
            if (window.game.multiplayer && window.game.multiplayer.connected) {
                window.game.multiplayer.sendBuilding(selectedItem.id, pos.x, pos.y, pos.z, placeYaw);
            }
            return;
        }
        // 可食用物品：右键使用
        if (info.hunger || info.thirst) {
            const charge = selectedItem.charge || 0;
            const extraHunger = charge * 5;
            const extraThirst = charge * 5;
            this.survival.eat((info.hunger || 0) + extraHunger, (info.thirst || 0) + extraThirst);
            this.inventory.removeItem(selectedItem.id, 1);
            if (charge > 0) {
                window.game.onMessage(`使用了 ${info.name} (充能+${charge}) 额外恢复${extraHunger}饥饿${extraThirst}口渴`);
            } else {
                window.game.onMessage(`使用了 ${info.name}`);
            }
        }
        // 光明石头：右键对10m内怪物造成10点伤害
        if (selectedItem.id === 'light_stone') {
            if (window.game && window.game.enemies) {
                let hitCount = 0;
                for (const enemy of window.game.enemies.enemies) {
                    if (enemy.dead) continue;
                    const dist = this.position.distanceTo(enemy.mesh.position);
                    if (dist <= 10) {
                        enemy.takeDamage(10, this);
                        enemy.hitFlash = 0.2;
                        if (window.game.enemies) window.game.enemies._updateHealthBar(enemy);
                        if (enemy.health <= 0) {
                            enemy.dead = true;
                            enemy.deathTimer = 0;
                        }
                        hitCount++;
                    }
                }
                this.inventory.removeItem('light_stone', 1);
                if (hitCount > 0) {
                    window.game.onMessage(`光明石头释放！命中${hitCount}个怪物，各造成10点伤害`);
                } else {
                    window.game.onMessage('光明石头释放！附近没有怪物');
                }
            }
            return;
        }
    }

    // 右键对准建筑交互（知识书架打开合成）
    _interactBuilding() {
        const raycaster = new THREE.Raycaster();
        const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
        raycaster.set(this.position, dir);
        raycaster.far = 4;
        const buildingMeshes = this.world.buildings.map(b => b.mesh);
        const hits = raycaster.intersectObjects(buildingMeshes, true);
        if (hits.length > 0) {
            // 找到对应的建筑
            let hitObj = hits[0].object;
            while (hitObj.parent && !this.world.buildings.find(b => b.mesh === hitObj)) {
                hitObj = hitObj.parent;
            }
            const building = this.world.buildings.find(b => b.mesh === hitObj);
            if (building && building.type === 'knowledge_bookshelf') {
                // 打开合成界面
                if (window.game && window.game.ui) {
                    window.game.ui._togglePanel('craftingUI');
                }
                return true;
            }
            if (building && building.type === 'auto_miner') {
                if (window.game && window.game.ui) {
                    window.game.ui.openMiner(building);
                }
                return true;
            }
            if (building && building.type === 'chest') {
                if (window.game && window.game.ui) {
                    window.game.ui.openChest(building);
                }
                return true;
            }
            if (building && building.type === 'rare_wood_pile') {
                if (window.game && window.game.ui) {
                    window.game.ui.openRareWoodPile(building);
                }
                return true;
            }
            if (building && building.type === 'normal_altar') {
                if (window.game && window.game.ui) {
                    window.game.ui.openAltar(building);
                }
                return true;
            }
            if (building && building.type === 'ultimate_bookshelf') {
                if (window.game && window.game.ui) {
                    window.game.ui.openUltimateBookshelf(building);
                }
                return true;
            }
            if (building && building.type === 'portal') {
                this._teleportViaPortal();
                return true;
            }
            if (building && building.type === 'teleport_monument') {
                if (window.game && window.game.ui) {
                    window.game.ui.openMonumentNaming(building);
                }
                return true;
            }
            if (building && building.type === 'mystery_box') {
                if (window.game && window.game.ui) {
                    window.game.ui.openMysteryBox(building);
                }
                return true;
            }
            if (building && building.type === 'gold_altar') {
                if (window.game && window.game.ui) {
                    window.game.ui.openGoldAltar(building);
                }
                return true;
            }
        }
        return false;
    }

    _teleportViaPortal() {
        if (this._portalCooldown && this._portalCooldown > 0) return;
        if (this.world.worldType === 'normal') {
            this.world.switchToWorld('stone', this.position);
            this.position.set(0, 5, 0);
            if (window.game) window.game.onMessage('进入了石头世界！');
        } else {
            const returnPos = this.world.returnPosition;
            this.world.switchToWorld('normal', this.position);
            if (returnPos) {
                this.position.set(returnPos.x, returnPos.y + 5, returnPos.z);
            } else {
                this.position.set(0, 5, 0);
            }
            if (window.game) window.game.onMessage('回到了普通世界');
        }
        this._portalCooldown = 3;
    }

    _startRecycle() {
        // 射线检测前方建筑
        const raycaster = new THREE.Raycaster();
        const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
        raycaster.set(this.position, dir);
        raycaster.far = 8;
        const buildingMeshes = this.world.buildings.map(b => b.mesh);
        const hits = raycaster.intersectObjects(buildingMeshes, true);
        if (hits.length === 0) return;

        let hitObj = hits[0].object;
        while (hitObj.parent && !this.world.buildings.find(b => b.mesh === hitObj)) {
            hitObj = hitObj.parent;
        }
        const building = this.world.buildings.find(b => b.mesh === hitObj);
        if (!building) return;
        if (building.type !== 'portal' && hits[0].distance > 4) return;

        // 计算回收时间
        const type = building.type;
        let time = 0;
        if (type === 'torch') time = 0;
        else if (type === 'wall_wood') time = 4;
        else if (type === 'wall_stone') time = 9;
        else if (type === 'campfire') time = 2;
        else if (type === 'knowledge_bookshelf') time = 3;
        else if (type === 'auto_miner') time = 5;
        else if (type === 'chest') time = 4;
        else if (type === 'portal') time = 0;
        else return;

        // 工具减少时间
        const selectedItem = this.inventory.getSelectedItem();
        if (selectedItem) {
            const info = this._getItemInfo(selectedItem.id);
            if (type === 'wall_wood' && info.chopping_power) {
                time -= info.chopping_power; // 木斧-1 石斧-2 铁斧-3
            }
            if (type === 'wall_stone' && info.mining_power) {
                time -= info.mining_power * 2; // 木镐-2 石镐-4 铁镐-6
                // 更精确: 木镐-3 石镐-5 铁镐-7
                if (info.mining_power === 1) time = 9 - 3;
                else if (info.mining_power === 2) time = 9 - 5;
                else if (info.mining_power === 3) time = 9 - 7;
                else if (info.mining_power === 4) time = 0.6; // 钢镐
            }
        }
        time = Math.max(0, time);

        this.recycleTarget = building;
        this.recycleTimer = 0;
        this.recycleTotal = time;
        if (time === 0) {
            this._completeRecycle();
        } else {
            window.game.onMessage(`回收中... ${time}s`);
        }
    }

    _stopRecycle() {
        if (this.recycleTarget) {
            window.game.onMessage('回收取消');
        }
        this.recycleTarget = null;
        this.recycleTimer = 0;
        this.recycleTotal = 0;
    }

    _completeRecycle() {
        if (!this.recycleTarget) return;
        const pos = this.recycleTarget.mesh.position;
        const type = this.world.removeBuilding(this.recycleTarget);
        if (type) {
            // 返还1个材料
            this.inventory.addItem(type, 1);
            const name = this._getItemInfo(type)?.name || type;
            window.game.onMessage(`回收了 ${name} +1`);
            // 同步建筑移除到多人游戏
            if (window.game.multiplayer && window.game.multiplayer.connected) {
                window.game.multiplayer.sendBuildingRemoved(pos.x, pos.y, pos.z);
            }
        }
        this.recycleTarget = null;
        this.recycleTimer = 0;
        this.recycleTotal = 0;
    }

    _placeBuilding() {
        if (!this.inventory.hasItem(this.buildItem, 1)) {
            window.game.onMessage('材料不足!');
            return;
        }
        const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
        const pos = this.position.clone().add(dir.multiplyScalar(3));
        pos.y = this.world.getHeight(pos.x, pos.z);
        pos.x = Math.round(pos.x);
        pos.z = Math.round(pos.z);
        let placeYaw = this.yaw;
        // 墙体对齐
        if (this.buildItem === 'wall_wood' || this.buildItem === 'wall_stone') {
            const snap = this._snapToAdjacentWall(pos, this.buildItem);
            if (snap) {
                pos.copy(snap.pos);
                placeYaw = snap.yaw;
            }
        }
        this.world.placeBuilding(this.buildItem, pos, placeYaw);
        this.inventory.removeItem(this.buildItem, 1);
        // 同步建筑到多人游戏
        if (window.game.multiplayer && window.game.multiplayer.connected) {
            window.game.multiplayer.sendBuilding(this.buildItem, pos.x, pos.y, pos.z, placeYaw);
        }
    }

    // 墙体对齐：检测附近墙体，自动对齐位置和朝向
    _snapToAdjacentWall(pos, itemId) {
        const snapDist = 2.5;
        let best = null;
        let bestDist = snapDist;
        for (const b of this.world.buildings) {
            if (b.type !== 'wall_wood' && b.type !== 'wall_stone') continue;
            const dx = pos.x - b.mesh.position.x;
            const dz = pos.z - b.mesh.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist > snapDist || dist < 0.1) continue;
            if (dist < bestDist) {
                bestDist = dist;
                best = b;
            }
        }
        if (!best) return null;
        const byaw = best.mesh.rotation.y;
        // 计算在邻居墙的局部坐标系中的位置
        const dx = pos.x - best.mesh.position.x;
        const dz = pos.z - best.mesh.position.z;
        const cosY = Math.cos(byaw), sinY = Math.sin(byaw);
        const localX = dx * cosY + dz * sinY;
        const localZ = -dx * sinY + dz * cosY;
        // 墙宽2，沿宽方向间隔2对齐
        const snapLocalX = Math.round(localX / 2) * 2;
        // 厚度方向对齐到0
        const snapLocalZ = 0;
        // 转回世界坐标
        const snapX = best.mesh.position.x + snapLocalX * cosY - snapLocalZ * sinY;
        const snapZ = best.mesh.position.z + snapLocalX * sinY + snapLocalZ * cosY;
        return {
            pos: new THREE.Vector3(Math.round(snapX), pos.y, Math.round(snapZ)),
            yaw: byaw,
        };
    }

    interact() {
        if (!this.interactTarget) return;
        const drops = this.world.interact(this.interactTarget);
        if (drops) {
            for (const [id, amt] of Object.entries(drops)) {
                this.inventory.addItem(id, amt);
            }
            window.game.onMessage(`拾取: ${Object.entries(drops).map(([k,v]) => `${v}x${this._getItemInfo(k)?.name||k}`).join(', ')}`);
        }
    }

    _getItemInfo(id) {
        if (!window.game) return {};
        return window.game.items[id] || {};
    }

    update(dt) {
        if (!this.canMove) return;

        // 攻击冷却
        this.attackCooldown = Math.max(0, this.attackCooldown - dt);
        this.attackAnim = Math.max(0, this.attackAnim - dt);

        // 确凿者光环：每5秒对5m内怪物造成伤害
        this.certainOneTimer = (this.certainOneTimer || 0) + dt;
        if (this.certainOneTimer >= 5) {
            this.certainOneTimer = 0;
            const selectedItem = this.inventory.getSelectedItem();
            if (selectedItem && selectedItem.id === 'certain_one' && window.game && window.game.enemies) {
                let hitCount = 0;
                for (const enemy of window.game.enemies.enemies) {
                    if (enemy.dead) continue;
                    const dist = this.position.distanceTo(enemy.mesh.position);
                    if (dist <= 5) {
                        enemy.takeDamage(10, this);
                        enemy.hitFlash = 0.2;
                        if (window.game.enemies) window.game.enemies._updateHealthBar(enemy);
                        if (enemy.health <= 0) {
                            enemy.dead = true;
                            enemy.deathTimer = 0;
                        }
                        hitCount++;
                    }
                }
                if (hitCount > 0 && window.game) window.game.onMessage(`确凿者光环命中${hitCount}个怪物`);
            }
        }

        // 回收进度
        if (this.recycleTarget) {
            this.recycleTimer += dt;
            if (this.recycleTimer >= this.recycleTotal) {
                this._completeRecycle();
            }
        }

        // 移动
        const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
        const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        const moveDir = new THREE.Vector3();
        if (this.keys['KeyW']) moveDir.add(forward);
        if (this.keys['KeyS']) moveDir.sub(forward);
        if (this.keys['KeyA']) moveDir.sub(right);
        if (this.keys['KeyD']) moveDir.add(right);
        moveDir.normalize();

        const sprinting = this.keys['ShiftLeft'] && this.survival.hunger > 5;
        const speed = (sprinting ? this.sprintSpeed : this.walkSpeed) + (this.survival.getSpeedBonus ? this.survival.getSpeedBonus() : 0);

        this.velocity.x = moveDir.x * speed;
        this.velocity.z = moveDir.z * speed;

        // 重力
        this.velocity.y -= this.gravity * dt;

        // 跳跃
        if (this.keys['Space'] && this.onGround) {
            this.velocity.y = this.jumpForce;
            this.onGround = false;
        }

        // 应用移动
        this.position.x += this.velocity.x * dt;
        this.position.z += this.velocity.z * dt;
        const prevY = this.position.y;
        this.position.y += this.velocity.y * dt;

        // 地面碰撞
        let groundY = this.world.getHeight(this.position.x, this.position.z) + this.height;
        // 建筑顶部当作地面（玩家可以站在上面）
        for (const b of this.world.buildings) {
            if (b.type === 'torch' || b.type === 'portal') continue;
            const dx = this.position.x - b.mesh.position.x;
            const dz = this.position.z - b.mesh.position.z;
            let colHeight = 3;
            if (b.type === 'campfire') colHeight = 0.5;
            else if (b.type === 'knowledge_bookshelf') colHeight = 2;
            else if (b.type === 'auto_miner') colHeight = 1.5;
            else if (b.type === 'chest') colHeight = 1;
            else if (b.type === 'forge') colHeight = 1;
            else if (b.type === 'rare_wood_pile') colHeight = 1;
            else if (b.type === 'ultimate_bookshelf') colHeight = 2.2;
            else if (b.type === 'normal_altar') colHeight = 2;

            if (b.type === 'wall_wood' || b.type === 'wall_stone') {
                // 墙体：宽2、厚0.2，用方形碰撞
                const yaw = b.mesh.rotation.y;
                const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
                const localX = dx * cosY + dz * sinY;
                const localZ = -dx * sinY + dz * cosY;
                const halfW = 1.0 + this.radius;
                const halfD = 0.1 + this.radius;
                if (Math.abs(localX) < halfW && Math.abs(localZ) < halfD) {
                    const topY = b.mesh.position.y + colHeight + this.height;
                    if (prevY >= topY - 0.1 && this.position.y <= topY + 0.01 && groundY < topY) {
                        groundY = topY;
                    }
                }
            } else {
                const dist2D = Math.sqrt(dx * dx + dz * dz);
                let colRadius = 1.0;
                if (b.type === 'campfire') colRadius = 0.6;
                else if (b.type === 'knowledge_bookshelf') colRadius = 0.8;
                else if (b.type === 'auto_miner') colRadius = 0.7;
                else if (b.type === 'chest') colRadius = 0.6;
                else if (b.type === 'forge') colRadius = 0.8;
                else if (b.type === 'rare_wood_pile') colRadius = 0.7;
                else if (b.type === 'ultimate_bookshelf') colRadius = 0.9;
                else if (b.type === 'normal_altar') colRadius = 0.8;
                if (dist2D < colRadius + this.radius) {
                    const topY = b.mesh.position.y + colHeight + this.height;
                    if (prevY >= topY - 0.1 && this.position.y <= topY + 0.01 && groundY < topY) {
                        groundY = topY;
                    }
                }
            }
        }
        if (this.position.y <= groundY) {
            this.position.y = groundY;
            this.velocity.y = 0;
            this.onGround = true;
        }

        // 建筑水平碰撞（火把/传送门无碰撞）— 只有玩家脚部低于建筑顶部时才阻挡
        for (const b of this.world.buildings) {
            if (b.type === 'torch' || b.type === 'portal') continue;
            const dx = this.position.x - b.mesh.position.x;
            const dz = this.position.z - b.mesh.position.z;
            let colHeight = 3;
            if (b.type === 'campfire') colHeight = 0.5;
            else if (b.type === 'knowledge_bookshelf') colHeight = 2;
            else if (b.type === 'auto_miner') colHeight = 1.5;
            else if (b.type === 'chest') colHeight = 1;
            else if (b.type === 'forge') colHeight = 1;
            else if (b.type === 'rare_wood_pile') colHeight = 1;
            else if (b.type === 'ultimate_bookshelf') colHeight = 2.2;
            else if (b.type === 'normal_altar') colHeight = 2;
            const buildingTop = b.mesh.position.y + colHeight;

            if (prevY - this.height >= buildingTop - 0.1) continue;

            if (b.type === 'wall_wood' || b.type === 'wall_stone') {
                // 墙体：方形碰撞，宽2、厚0.2
                const yaw = b.mesh.rotation.y;
                const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
                const localX = dx * cosY + dz * sinY;
                const localZ = -dx * sinY + dz * cosY;
                const halfW = 1.0 + this.radius;
                const halfD = 0.1 + this.radius;
                if (Math.abs(localX) < halfW && Math.abs(localZ) < halfD) {
                    // 沿穿透较浅的轴推出
                    const penX = halfW - Math.abs(localX);
                    const penZ = halfD - Math.abs(localZ);
                    if (penZ < penX) {
                        const pushLocalZ = (localZ > 0 ? 1 : -1) * penZ;
                        this.position.x += -pushLocalZ * sinY;
                        this.position.z += pushLocalZ * cosY;
                    } else {
                        const pushLocalX = (localX > 0 ? 1 : -1) * penX;
                        this.position.x += pushLocalX * cosY;
                        this.position.z += pushLocalX * sinY;
                    }
                }
            } else {
                const dist2D = Math.sqrt(dx * dx + dz * dz);
                let colRadius = 1.0;
                if (b.type === 'campfire') colRadius = 0.6;
                else if (b.type === 'knowledge_bookshelf') colRadius = 0.8;
                else if (b.type === 'auto_miner') colRadius = 0.7;
                else if (b.type === 'chest') colRadius = 0.6;
                else if (b.type === 'forge') colRadius = 0.8;
                else if (b.type === 'rare_wood_pile') colRadius = 0.7;
                else if (b.type === 'ultimate_bookshelf') colRadius = 0.9;
                else if (b.type === 'normal_altar') colRadius = 0.8;
                if (dist2D < colRadius + this.radius) {
                    if (dist2D > 0.001) {
                        const pushX = (dx / dist2D) * (colRadius + this.radius - dist2D);
                        const pushZ = (dz / dist2D) * (colRadius + this.radius - dist2D);
                        this.position.x += pushX;
                        this.position.z += pushZ;
                    }
                }
            }
        }

        // 更新相机
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.yaw;
        this.camera.rotation.x = this.pitch;
        if (this.thirdPerson) {
            const offset = new THREE.Vector3(0, 0.5, 4).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
            this.camera.position.copy(this.position).add(offset);
            this._updatePlayerModel();
        } else {
            this.camera.position.copy(this.position);
        }

        // 屏幕震动
        if (this.cameraShake && this.cameraShake > 0) {
            this.camera.position.x += (Math.random() - 0.5) * this.cameraShake;
            this.camera.position.y += (Math.random() - 0.5) * this.cameraShake;
            this.camera.position.z += (Math.random() - 0.5) * this.cameraShake;
            this.cameraShake = Math.max(0, this.cameraShake - dt * 3);
        }

        // 攻击动画
        if (this.attackAnim > 0) {
            this.camera.rotation.z = Math.sin(this.attackAnim * 25) * 0.05;
        } else {
            this.camera.rotation.z *= 0.9;
        }

        // 交互检测
        this._checkInteraction();

        // 传送门靠近检测
        this._checkPortalProximity();

    }

    _checkPortalProximity() {
        if (this.recycleTarget) return;
        if (this._portalCooldown && this._portalCooldown > 0) {
            this._portalCooldown -= 0.016;
            return;
        }
        // 检测玩家是否瞄准传送门（瞄准时不传送，允许回收）
        const aimRaycaster = new THREE.Raycaster();
        const aimDir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
        aimRaycaster.set(this.position, aimDir);
        aimRaycaster.far = 8;
        const portalMeshes = this.world.buildings.filter(b => b.type === 'portal' && b.mesh.visible).map(b => b.mesh);
        const aimHits = aimRaycaster.intersectObjects(portalMeshes, true);
        if (aimHits.length > 0) return;
        for (const b of this.world.buildings) {
            if (b.type !== 'portal') continue;
            if (!b.mesh.visible) continue;
            const dx = this.position.x - b.mesh.position.x;
            const dz = this.position.z - b.mesh.position.z;
            const dist2D = Math.sqrt(dx * dx + dz * dz);
            if (dist2D < 2.0) {
                if (this.world.worldType === 'normal') {
                    this.world.switchToWorld('stone', this.position);
                    this.position.set(0, 5, 0);
                    if (window.game) window.game.onMessage('进入了石头世界！');
                } else if (this.world.worldType === 'gold') {
                    // 从金维度返回之前的世界
                    const returnWorld = this.world._goldReturnWorld || 'normal';
                    const returnPos = this.world._goldReturnPosition || this.world.returnPosition;
                    if (returnWorld === 'stone') {
                        this.world.switchToWorld('stone', this.position);
                        this.position.set(0, 5, 0);
                    } else {
                        this.world.switchToWorld('normal', this.position);
                        if (returnPos) {
                            this.position.set(returnPos.x, returnPos.y + 5, returnPos.z);
                        } else {
                            this.position.set(0, 5, 0);
                        }
                    }
                    if (window.game) window.game.onMessage('离开了金维度');
                } else {
                    const returnPos = this.world.returnPosition;
                    this.world.switchToWorld('normal', this.position);
                    if (returnPos) {
                        this.position.set(returnPos.x, returnPos.y + 5, returnPos.z);
                    } else {
                        this.position.set(0, 5, 0);
                    }
                    if (window.game) window.game.onMessage('回到了普通世界');
                }
                this._portalCooldown = 3;
                return;
            }
        }
    }

    _checkInteraction() {
        const raycaster = new THREE.Raycaster();
        const dir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
        raycaster.set(this.position, dir);
        raycaster.far = 5;

        const resourceMeshes = this.world.resources.filter(r => !r.depleted).map(r => r.mesh);
        const hits = raycaster.intersectObjects(resourceMeshes, true);
        if (hits.length > 0) {
            const hitMesh = hits[0].object;
            this.interactTarget = this.world.resources.find(r => r.mesh === hitMesh.parent || r.mesh === hitMesh);
        } else {
            this.interactTarget = null;
        }
    }

    takeDamage(amount) {
        this.survival.takeDamage(amount);
    }
}
