// 多人游戏系统：使用 MQTT 公共 broker 实现实时同步

const OFFICIAL_ROOMS = [
    { id: 'room_official', name: '官方房间', desc: '玩家唯一可以联机玩的地方' },
];

const MQTT_BROKER = 'wss://broker.emqx.io:8084/mqtt';
const MQTT_PREFIX = 'ws_mp_';

// 共享几何体和材质，所有玩家模型复用
let _sharedGeo = null;
let _sharedMats = null;
function _getSharedAssets() {
    if (_sharedGeo) return { geo: _sharedGeo, mats: _sharedMats };
    _sharedGeo = {
        body: new THREE.CapsuleGeometry(0.35, 0.8, 4, 8),
        head: new THREE.SphereGeometry(0.3, 8, 6),
        helm: new THREE.SphereGeometry(0.34, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
        chest: new THREE.CapsuleGeometry(0.4, 0.5, 4, 8),
        legs: new THREE.CapsuleGeometry(0.28, 0.6, 4, 8),
        boots: new THREE.BoxGeometry(0.3, 0.2, 0.45),
        // 坚硬木盔甲
        hHelm: new THREE.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
        hBrim: new THREE.TorusGeometry(0.33, 0.04, 6, 12),
        hCrossH: new THREE.BoxGeometry(0.5, 0.05, 0.05),
        hCrossV: new THREE.BoxGeometry(0.05, 0.35, 0.05),
        hNeck: new THREE.BoxGeometry(0.5, 0.25, 0.08),
        hChest: new THREE.CylinderGeometry(0.42, 0.36, 1.1, 8),
        hBelt: new THREE.TorusGeometry(0.38, 0.05, 6, 12),
        hBuckle: new THREE.BoxGeometry(0.12, 0.1, 0.06),
        hShoulder: new THREE.CylinderGeometry(0.22, 0.16, 0.3, 6, 1, false, 0, Math.PI),
        hRivet: new THREE.SphereGeometry(0.04, 5, 4),
        hLeg: new THREE.CylinderGeometry(0.18, 0.14, 1.0, 6, 1, false, 0, Math.PI * 1.2),
        hKnee: new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5),
        hStrap: new THREE.TorusGeometry(0.16, 0.03, 5, 10),
        hBoot: new THREE.CylinderGeometry(0.17, 0.2, 0.45, 6, 1, false, 0, Math.PI * 1.3),
        hSole: new THREE.BoxGeometry(0.22, 0.06, 0.5),
        hAnkle: new THREE.TorusGeometry(0.17, 0.035, 5, 10),
    };
    _sharedMats = {
        body: new THREE.MeshStandardMaterial({ color: 0x4488ff, roughness: 0.6 }),
        head: new THREE.MeshStandardMaterial({ color: 0x3366cc, roughness: 0.5 }),
        armor: new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.7, transparent: true, opacity: 0 }),
        armorDead: new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.7, transparent: true, opacity: 0 }),
        hardArmor: new THREE.MeshStandardMaterial({ color: 0x4a2510, roughness: 0.5, transparent: true, opacity: 0, metalness: 0.4, flatShading: true }),
        hardMetal: new THREE.MeshStandardMaterial({ color: 0xb8782a, roughness: 0.3, metalness: 0.85, transparent: true, opacity: 0 }),
    };
    return { geo: _sharedGeo, mats: _sharedMats };
}

class MultiplayerSystem {
    constructor(game) {
        this.game = game;
        this.client = null;
        this.roomId = null;
        this.username = game.username;
        this.players = {};
        this.myTopic = null;
        this.roomTopic = null;
        this.connected = false;
        this.sendTimer = 0;
        this.cleanupTimer = 0;
        this.heartbeatTimer = 0;
        this._tmpVec = new THREE.Vector3();
        this._lastSentPos = new THREE.Vector3();
        this._lastSentYaw = 0;
        this._lastSentEq = '';
        this._reconnectAttempts = 0;
        this._maxReconnectAttempts = 5;
        this.timeSyncTimer = 0;
        this._timeOffset = 0; // 本地与主机时间差
        this._hasTimeSync = false;
        this.buildingSaveTimer = 0;
        this._buildingsLoaded = false;
    }

    connect(roomId) {
        this.roomId = roomId;
        this.username = this.game.username;
        this.roomTopic = MQTT_PREFIX + roomId;
        this.myTopic = this.roomTopic + '/' + this.username;
        this._reconnectAttempts = 0;

        try {
            this.client = mqtt.connect(MQTT_BROKER, {
                clientId: 'ws_' + this.username + '_' + Math.random().toString(36).substr(2, 6),
                clean: true,
                connectTimeout: 8000,
                keepalive: 20,
                reconnectPeriod: 2000,
            });
        } catch (e) {
            console.error('MQTT connect failed:', e);
            this.game.onMessage('连接服务器失败');
            return false;
        }

        this.client.on('connect', () => {
            this.connected = true;
            this._reconnectAttempts = 0;
            this.client.subscribe(this.roomTopic + '/+', { qos: 0 });
            this._sendRaw('j');
            // 立即强制发送位置，让房间里已有玩家能看到自己
            setTimeout(() => this._sendPositionForce(), 200);
            // 先从服务器加载建筑状态（离线持久化）
            this._loadBuildingsFromServer().then(() => {
                // 再请求在线玩家同步最新状态
                setTimeout(() => this.requestBuildSync(), 500);
            });
            this.game.onMessage('已连接到房间: ' + this.getRoomName());
        });

        this.client.on('message', (topic, payload) => {
            try {
                const msg = JSON.parse(payload.toString());
                this._onMessage(msg);
            } catch (e) {}
        });

        this.client.on('error', (e) => {
            console.error('MQTT error:', e);
        });

        this.client.on('close', () => {
            if (this.connected) {
                this.connected = false;
                this.game.onMessage('连接断开，尝试重连...');
            }
        });

        this.client.on('reconnect', () => {
            this._reconnectAttempts++;
            if (this._reconnectAttempts <= this._maxReconnectAttempts) {
                this.game.onMessage('正在重连... (' + this._reconnectAttempts + '/' + this._maxReconnectAttempts + ')');
            } else {
                this.game.onMessage('重连失败，请检查网络');
                this.client.end();
            }
        });

        return true;
    }

    getRoomName() {
        const room = OFFICIAL_ROOMS.find(r => r.id === this.roomId);
        return room ? room.name : this.roomId;
    }

    _sendRaw(type, extra) {
        if (!this.connected || !this.client) return;
        const msg = { t: type, u: this.username };
        if (extra) Object.assign(msg, extra);
        this.client.publish(this.myTopic, JSON.stringify(msg), { qos: 0 });
    }

    _sendPosition() {
        const p = this.game.player.position;
        const eq = this.game.inventory.equipment;
        const eqStr = (eq.head?.id||'') + (eq.chest?.id||'') + (eq.legs?.id||'') + (eq.feet?.id||'');
        // 静止时跳过发送（位置/角度/装备未变化）
        const moved = Math.abs(p.x - this._lastSentPos.x) > 0.01 ||
                      Math.abs(p.y - this._lastSentPos.y) > 0.01 ||
                      Math.abs(p.z - this._lastSentPos.z) > 0.01;
        const rotated = Math.abs(this.game.player.yaw - this._lastSentYaw) > 0.01;
        const eqChanged = eqStr !== this._lastSentEq;
        if (!moved && !rotated && !eqChanged) return;

        this._lastSentPos.copy(p);
        this._lastSentYaw = this.game.player.yaw;
        this._lastSentEq = eqStr;

        this._publishPosition();
    }

    // 强制发送位置（不受静止检测限制），用于心跳和新玩家加入时
    _sendPositionForce() {
        const p = this.game.player.position;
        const eq = this.game.inventory.equipment;
        const eqStr = (eq.head?.id||'') + (eq.chest?.id||'') + (eq.legs?.id||'') + (eq.feet?.id||'');
        this._lastSentPos.copy(p);
        this._lastSentYaw = this.game.player.yaw;
        this._lastSentEq = eqStr;
        this._publishPosition();
    }

    _publishPosition() {
        const p = this.game.player.position;
        const eq = this.game.inventory.equipment;
        this.client.publish(this.myTopic, JSON.stringify([
            'p', this.username,
            +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2),
            +this.game.player.yaw.toFixed(3),
            Math.round(this.game.survival.health),
            eq.head ? eq.head.id : '',
            eq.chest ? eq.chest.id : '',
            eq.legs ? eq.legs.id : '',
            eq.feet ? eq.feet.id : '',
        ]), { qos: 0 });
    }

    _onMessage(msg) {
        // 支持压缩数组格式和旧对象格式
        if (Array.isArray(msg)) {
            const [type, username, ...rest] = msg;
            if (username === this.username) return;
            switch (type) {
                case 'p': // position
                    this._updatePlayer(username, rest[0], rest[1], rest[2], rest[3], rest[4], rest[5], rest[6], rest[7], rest[8]);
                    break;
                case 'a': // attack
                    this._onPlayerAttack(username, rest[0]);
                    break;
                case 'h': // hit
                    if (rest[0] === this.username) {
                        this.game.survival.takeDamage(rest[1]);
                        this.game.onMessage(username + ' 攻击了你!');
                    }
                    break;
                case 'j': // join
                    this.game.onMessage(username + ' 加入了房间');
                    this._createPlayerMesh(username);
                    // 回复自己的位置给新玩家
                    this._sendPositionForce();
                    break;
                case 'l': // leave
                    this._removePlayer(username);
                    this.game.onMessage(username + ' 离开了房间');
                    break;
                case 'd': // death
                    this.game.onMessage(username + ' 被击败了');
                    break;
                case 'c': // chat
                    this.game.ui.addChatMessage(username, rest[0]);
                    break;
                case 'g': // give command (admin)
                    if (rest[0] === this.username) {
                        const qty = rest[2] || 1;
                        this.game.inventory.addItem(rest[1], qty);
                        const info = ITEMS[rest[1]];
                        this.game.onMessage(username + ' 给了你 ' + qty + '个 ' + (info ? info.name : rest[1]));
                    }
                    break;
                case 'b': // build - 放置建筑（含可选状态）
                    this._onRemoteBuild(username, rest[0], rest[1], rest[2], rest[3], rest[4], rest[5]);
                    break;
                case 'br': // build remove - 移除建筑
                    this._onRemoteBuildRemove(rest[0], rest[1], rest[2]);
                    break;
                case 't': // time sync
                    this._onTimeSync(rest[0], rest[1]);
                    break;
                case 'bs': // build sync request (新玩家请求现有建筑)
                    // 广播自己的建筑给新玩家
                    this._sendAllBuildings();
                    break;
                case 'eb': // enemy boss spawn - Boss召唤同步
                    this._onRemoteBossSpawn(rest[0], rest[1], rest[2], rest[3], rest[4]);
                    break;
                case 'ed': // enemy boss dead - Boss死亡同步
                    this._onRemoteBossDeath(rest[0]);
                    break;
                case 'eh': // enemy boss hit player - Boss攻击其他玩家
                    if (rest[0] === this.username) {
                        this.game.survival.takeDamage(rest[1]);
                        this.game.onMessage('Boss攻击了你! -' + rest[1]);
                    }
                    break;
            }
            return;
        }

        // 旧格式兼容
        if (msg.username === this.username) return;
        switch (msg.t || msg.type) {
            case 'j': case 'join':
                this.game.onMessage(msg.u + ' 加入了房间');
                this._createPlayerMesh(msg.u);
                this._sendPositionForce();
                break;
            case 'l': case 'leave':
                this._removePlayer(msg.u);
                this.game.onMessage(msg.u + ' 离开了房间');
                break;
            case 'd': case 'death':
                this.game.onMessage(msg.u + ' 被击败了');
                break;
        }
    }

    _createPlayerMesh(username) {
        if (this.players[username]) return;

        const { geo, mats } = _getSharedAssets();
        const group = new THREE.Group();

        // 复用共享几何体，每玩家独立材质实例（因为颜色/透明度需要独立控制）
        const bodyMat = mats.body.clone();
        const body = new THREE.Mesh(geo.body, bodyMat);
        body.position.y = 0.75;
        body.castShadow = true;
        group.add(body);

        const head = new THREE.Mesh(geo.head, mats.head);
        head.position.y = 1.5;
        head.castShadow = true;
        group.add(head);

        // 盔甲 - 每玩家独立材质（opacity需独立控制）
        const armorParts = {};
        const helmMat = mats.armor.clone();
        const helm = new THREE.Mesh(geo.helm, helmMat);
        helm.position.y = 1.5;
        group.add(helm);
        armorParts.head = { mesh: helm, mat: helmMat };

        const chestMat = mats.armor.clone();
        const chest = new THREE.Mesh(geo.chest, chestMat);
        chest.position.y = 0.85;
        group.add(chest);
        armorParts.chest = { mesh: chest, mat: chestMat };

        const legsMat = mats.armor.clone();
        const legs = new THREE.Mesh(geo.legs, legsMat);
        legs.position.y = 0.35;
        group.add(legs);
        armorParts.legs = { mesh: legs, mat: legsMat };

        const bootsMat = mats.armor.clone();
        const boots = new THREE.Mesh(geo.boots, bootsMat);
        boots.position.y = 0.1;
        group.add(boots);
        armorParts.feet = { mesh: boots, mat: bootsMat };

        // 坚硬木盔甲
        const hardArmorParts = {};
        // 头盔
        const hHelmMat = mats.hardArmor.clone();
        const hHelm = new THREE.Mesh(geo.hHelm, hHelmMat);
        hHelm.position.y = 1.5;
        group.add(hHelm);
        const hBrimMat = mats.hardMetal.clone();
        const hBrim = new THREE.Mesh(geo.hBrim, hBrimMat);
        hBrim.position.y = 1.35; hBrim.rotation.x = Math.PI / 2;
        group.add(hBrim);
        const hCrossMat = mats.hardMetal.clone();
        const hCrossH = new THREE.Mesh(geo.hCrossH, hCrossMat);
        hCrossH.position.set(0, 1.42, 0.31);
        group.add(hCrossH);
        const hCrossV = new THREE.Mesh(geo.hCrossV, hCrossMat);
        hCrossV.position.set(0, 1.3, 0.31);
        group.add(hCrossV);
        const hNeckMat = mats.hardArmor.clone();
        const hNeck = new THREE.Mesh(geo.hNeck, hNeckMat);
        hNeck.position.set(0, 1.25, -0.3);
        group.add(hNeck);
        hardArmorParts.head = { mesh: hHelm, mat: hHelmMat, extras: [{ mesh: hBrim, mat: hBrimMat }, { mesh: hCrossH, mat: hCrossMat }, { mesh: hCrossV, mat: hCrossMat }, { mesh: hNeck, mat: hNeckMat }] };
        // 胸甲
        const hChestMat = mats.hardArmor.clone();
        const hChest = new THREE.Mesh(geo.hChest, hChestMat);
        hChest.position.y = 0.85;
        group.add(hChest);
        const hBeltMat = mats.hardMetal.clone();
        const hBelt = new THREE.Mesh(geo.hBelt, hBeltMat);
        hBelt.position.y = 0.45; hBelt.rotation.x = Math.PI / 2;
        group.add(hBelt);
        const hBuckleMat = mats.hardMetal.clone();
        hBuckleMat.color.setHex(0xd4a050);
        const hBuckle = new THREE.Mesh(geo.hBuckle, hBuckleMat);
        hBuckle.position.set(0, 0.45, 0.38);
        group.add(hBuckle);
        const hShoulderMatL = mats.hardArmor.clone();
        const hShoulderMatR = mats.hardArmor.clone();
        const hShoulderL = new THREE.Mesh(geo.hShoulder, hShoulderMatL);
        hShoulderL.position.set(-0.42, 1.25, 0); hShoulderL.rotation.z = Math.PI / 2; hShoulderL.rotation.y = -Math.PI / 2;
        group.add(hShoulderL);
        const hShoulderR = new THREE.Mesh(geo.hShoulder, hShoulderMatR);
        hShoulderR.position.set(0.42, 1.25, 0); hShoulderR.rotation.z = Math.PI / 2; hShoulderR.rotation.y = Math.PI / 2;
        group.add(hShoulderR);
        const hRivetMat = mats.hardMetal.clone();
        hRivetMat.color.setHex(0xd4a050);
        const rivetExtras = [];
        for (let i = 0; i < 6; i++) {
            const ang = (i / 6) * Math.PI * 2;
            const rm = hRivetMat.clone();
            const r = new THREE.Mesh(geo.hRivet, rm);
            r.position.set(Math.cos(ang) * 0.4, 1.1, Math.sin(ang) * 0.4);
            group.add(r);
            rivetExtras.push({ mesh: r, mat: rm });
        }
        hardArmorParts.chest = { mesh: hChest, mat: hChestMat, extras: [{ mesh: hBelt, mat: hBeltMat }, { mesh: hBuckle, mat: hBuckleMat }, { mesh: hShoulderL, mat: hShoulderMatL }, { mesh: hShoulderR, mat: hShoulderMatR }, ...rivetExtras] };
        // 护腿
        const hLegsMat = mats.hardArmor.clone();
        const hLegL = new THREE.Mesh(geo.hLeg, hLegsMat);
        hLegL.position.set(-0.2, 0.35, 0); hLegL.rotation.y = Math.PI / 2;
        group.add(hLegL);
        const hLegR = new THREE.Mesh(geo.hLeg, hLegsMat);
        hLegR.position.set(0.2, 0.35, 0); hLegR.rotation.y = -Math.PI / 2;
        group.add(hLegR);
        const hKneeMatL = mats.hardMetal.clone();
        const hKneeMatR = mats.hardMetal.clone();
        const hKneeL = new THREE.Mesh(geo.hKnee, hKneeMatL);
        hKneeL.position.set(-0.2, 0.15, 0.15); hKneeL.rotation.x = Math.PI / 2;
        group.add(hKneeL);
        const hKneeR = new THREE.Mesh(geo.hKnee, hKneeMatR);
        hKneeR.position.set(0.2, 0.15, 0.15); hKneeR.rotation.x = Math.PI / 2;
        group.add(hKneeR);
        const hStrapMat1L = mats.hardMetal.clone();
        const hStrapMat1R = mats.hardMetal.clone();
        const hStrapMat2L = mats.hardMetal.clone();
        const hStrapMat2R = mats.hardMetal.clone();
        const hStrap1L = new THREE.Mesh(geo.hStrap, hStrapMat1L);
        hStrap1L.position.set(-0.2, 0.55, 0); hStrap1L.rotation.x = Math.PI / 2;
        group.add(hStrap1L);
        const hStrap1R = new THREE.Mesh(geo.hStrap, hStrapMat1R);
        hStrap1R.position.set(0.2, 0.55, 0); hStrap1R.rotation.x = Math.PI / 2;
        group.add(hStrap1R);
        const hStrap2L = new THREE.Mesh(geo.hStrap, hStrapMat2L);
        hStrap2L.position.set(-0.2, -0.15, 0); hStrap2L.rotation.x = Math.PI / 2;
        group.add(hStrap2L);
        const hStrap2R = new THREE.Mesh(geo.hStrap, hStrapMat2R);
        hStrap2R.position.set(0.2, -0.15, 0); hStrap2R.rotation.x = Math.PI / 2;
        group.add(hStrap2R);
        hardArmorParts.legs = { mesh: hLegL, mat: hLegsMat, extras: [{ mesh: hLegR, mat: hLegsMat }, { mesh: hKneeL, mat: hKneeMatL }, { mesh: hKneeR, mat: hKneeMatR }, { mesh: hStrap1L, mat: hStrapMat1L }, { mesh: hStrap1R, mat: hStrapMat1R }, { mesh: hStrap2L, mat: hStrapMat2L }, { mesh: hStrap2R, mat: hStrapMat2R }] };
        // 靴子
        const hBootsMat = mats.hardArmor.clone();
        const hBootL = new THREE.Mesh(geo.hBoot, hBootsMat);
        hBootL.position.set(-0.2, 0.2, 0.03); hBootL.rotation.y = Math.PI / 2;
        group.add(hBootL);
        const hBootR = new THREE.Mesh(geo.hBoot, hBootsMat);
        hBootR.position.set(0.2, 0.2, 0.03); hBootR.rotation.y = -Math.PI / 2;
        group.add(hBootR);
        const hSoleMat = mats.hardMetal.clone();
        const hSoleL = new THREE.Mesh(geo.hSole, hSoleMat);
        hSoleL.position.set(-0.2, 0.02, 0.05);
        group.add(hSoleL);
        const hSoleR = new THREE.Mesh(geo.hSole, hSoleMat);
        hSoleR.position.set(0.2, 0.02, 0.05);
        group.add(hSoleR);
        const hAnkleMatL = mats.hardMetal.clone();
        const hAnkleMatR = mats.hardMetal.clone();
        const hAnkleL = new THREE.Mesh(geo.hAnkle, hAnkleMatL);
        hAnkleL.position.set(-0.2, 0.35, 0); hAnkleL.rotation.x = Math.PI / 2;
        group.add(hAnkleL);
        const hAnkleR = new THREE.Mesh(geo.hAnkle, hAnkleMatR);
        hAnkleR.position.set(0.2, 0.35, 0); hAnkleR.rotation.x = Math.PI / 2;
        group.add(hAnkleR);
        hardArmorParts.feet = { mesh: hBootL, mat: hBootsMat, extras: [{ mesh: hBootR, mat: hBootsMat }, { mesh: hSoleL, mat: hSoleMat }, { mesh: hSoleR, mat: hSoleMat }, { mesh: hAnkleL, mat: hAnkleMatL }, { mesh: hAnkleR, mat: hAnkleMatR }] };

        // 名牌
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, 256, 64);
        ctx.fillStyle = '#6a9c5a';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(username, 128, 40);
        const tex = new THREE.CanvasTexture(canvas);
        const labelMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
        const label = new THREE.Sprite(labelMat);
        label.scale.set(1.5, 0.4, 1);
        label.position.y = 2.2;
        group.add(label);

        // 血条
        const hpCanvas = document.createElement('canvas');
        hpCanvas.width = 128; hpCanvas.height = 20;
        const hpTex = new THREE.CanvasTexture(hpCanvas);
        const hpMat = new THREE.SpriteMaterial({ map: hpTex, transparent: true, depthTest: false });
        const hpSprite = new THREE.Sprite(hpMat);
        hpSprite.scale.set(1.2, 0.19, 1);
        hpSprite.position.y = 2.6;
        hpSprite.renderOrder = 999;
        group.add(hpSprite);

        this.game.scene.add(group);
        this.players[username] = {
            mesh: group,
            health: 100,
            lastUpdate: Date.now(),
            bodyMat: bodyMat,
            label: label,
            labelTex: tex,
            hpCanvas: hpCanvas,
            hpTex: hpTex,
            hpSprite: hpSprite,
            armorParts: armorParts,
            hardArmorParts: hardArmorParts,
            targetPos: new THREE.Vector3(0, 0, 0),
            targetYaw: 0,
            lerpFactor: 0,
            lastPos: new THREE.Vector3(0, 0, 0),
            velocity: new THREE.Vector3(0, 0, 0),
        };
        this._updatePlayerHealthBar(this.players[username]);
    }

    _updatePlayer(username, x, y, z, yaw, health, eqHead, eqChest, eqLegs, eqFeet) {
        if (!this.players[username]) {
            this._createPlayerMesh(username);
        }
        const p = this.players[username];
        const newTarget = new THREE.Vector3(x, y - 1.7, z);
        // 计算速度用于插值预测
        if (p.lerpFactor > 0) {
            p.velocity.copy(newTarget).sub(p.targetPos);
        }
        p.targetPos.copy(newTarget);
        p.targetYaw = yaw || 0;
        p.health = health ?? 100;
        p.lastUpdate = Date.now();
        // 第一次出现时直接定位
        if (p.lerpFactor === 0) {
            p.mesh.position.copy(p.targetPos);
            p.mesh.rotation.y = p.targetYaw;
            p.lastPos.copy(p.targetPos);
        }
        p.lerpFactor = 1;

        if (p.health <= 0) {
            p.bodyMat.color.setHex(0x444444);
        } else {
            p.bodyMat.color.setHex(0x4488ff);
        }
        this._updatePlayerHealthBar(p);

        // 更新盔甲显示
        if (p.armorParts) {
            const slots = { head: eqHead, chest: eqChest, legs: eqLegs, feet: eqFeet };
            for (const [slot, itemId] of Object.entries(slots)) {
                // 普通木盔甲
                const part = p.armorParts[slot];
                if (!part) continue;
                if (itemId && ITEMS[itemId] && !itemId.startsWith('hard_wood')) {
                    part.mat.opacity = 0.85;
                } else {
                    part.mat.opacity = 0;
                }
                // 坚硬木盔甲
                const hPart = p.hardArmorParts && p.hardArmorParts[slot];
                if (hPart) {
                    const isHard = itemId && ITEMS[itemId] && itemId.startsWith('hard_wood');
                    hPart.mat.opacity = isHard ? 0.85 : 0;
                    if (hPart.extras) {
                        for (const ex of hPart.extras) {
                            ex.mat.opacity = isHard ? 0.85 : 0;
                        }
                    }
                }
            }
        }
    }

    _updatePlayerHealthBar(p) {
        if (!p.hpCanvas) return;
        const ctx = p.hpCanvas.getContext('2d');
        ctx.clearRect(0, 0, 128, 20);
        // 背景
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(4, 4, 120, 12);
        // 血条
        const ratio = Math.max(0, p.health / 100);
        const barW = 116 * ratio;
        let barColor = '#4caf50';
        if (ratio < 0.6) barColor = '#ff9800';
        if (ratio < 0.3) barColor = '#f44336';
        ctx.fillStyle = barColor;
        ctx.fillRect(6, 6, barW, 8);
        // 血量数字
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.ceil(p.health)}`, 64, 14);
        p.hpTex.needsUpdate = true;
    }

    _onPlayerAttack(username, damage) {
        if (!this.players[username]) return;
        const attacker = this.players[username];
        const dist = this.game.player.position.distanceTo(attacker.mesh.position);
        if (dist < 4) {
            this.game.survival.takeDamage(damage);
            this.game.onMessage(username + ' 攻击了你! -' + damage);
            this._sendRaw('h', { 0: username, 1: damage });
            // 用数组格式发hit
            this.client.publish(this.myTopic, JSON.stringify(['h', this.username, username, damage]), { qos: 0 });
        }
    }

    _removePlayer(username) {
        if (!this.players[username]) return;
        const p = this.players[username];
        this.game.scene.remove(p.mesh);
        // 清理每玩家独立材质（共享几何体不dispose）
        if (p.bodyMat) p.bodyMat.dispose();
        if (p.labelTex) p.labelTex.dispose();
        if (p.armorParts) {
            for (const part of Object.values(p.armorParts)) {
                if (part.mat) part.mat.dispose();
            }
        }
        if (p.hardArmorParts) {
            for (const part of Object.values(p.hardArmorParts)) {
                if (part.mat) part.mat.dispose();
                if (part.extras) for (const ex of part.extras) if (ex.mat) ex.mat.dispose();
            }
        }
        // 遍历group清理材质
        p.mesh.traverse(child => {
            if (child.material && child.material !== p.bodyMat &&
                (!p.armorParts || !Object.values(p.armorParts).some(a => a.mat === child.material))) {
                if (child.material.map !== p.labelTex) child.material.dispose();
            }
        });
        delete this.players[username];
    }

    // 每帧调用
    update(dt) {
        if (!this.connected) return;

        // 动态发送频率：静止时0.2秒（5fps），移动时0.05秒（20fps）
        this.sendTimer += dt;
        const p = this.game.player.position;
        const moving = Math.abs(p.x - this._lastSentPos.x) > 0.01 ||
                       Math.abs(p.y - this._lastSentPos.y) > 0.01 ||
                       Math.abs(p.z - this._lastSentPos.z) > 0.01 ||
                       Math.abs(this.game.player.yaw - this._lastSentYaw) > 0.01;
        const sendInterval = moving ? 0.05 : 0.2;
        if (this.sendTimer >= sendInterval) {
            this.sendTimer = 0;
            this._sendPosition();
        }

        // 插值平滑其他玩家移动 - 速度感知插值
        for (const username of Object.keys(this.players)) {
            const pl = this.players[username];
            if (pl.lerpFactor > 0) {
                // 计算到目标的距离
                const dist = pl.mesh.position.distanceTo(pl.targetPos);
                // 距离大时快速追上，距离小时平滑
                const baseSpeed = Math.min(1, dt * 12);
                const catchUp = dist > 2 ? Math.min(1, dt * 20) : baseSpeed;
                pl.mesh.position.lerp(pl.targetPos, catchUp);
                // 角度插值
                let dy = pl.targetYaw - pl.mesh.rotation.y;
                while (dy > Math.PI) dy -= Math.PI * 2;
                while (dy < -Math.PI) dy += Math.PI * 2;
                pl.mesh.rotation.y += dy * Math.min(1, dt * 15);
            }
        }

        // 每5秒清理超时玩家
        this.cleanupTimer += dt;
        if (this.cleanupTimer >= 5) {
            this.cleanupTimer = 0;
            const now = Date.now();
            for (const username of Object.keys(this.players)) {
                if (now - this.players[username].lastUpdate > 15000) {
                    this._removePlayer(username);
                    this.game.onMessage(username + ' 已超时断开');
                }
            }
        }

        // 心跳：每10秒强制发送一次位置，让其他玩家知道我们还在线
        this.heartbeatTimer += dt;
        if (this.heartbeatTimer >= 10) {
            this.heartbeatTimer = 0;
            this._sendPositionForce(); // 强制发送当前位置作为心跳
        }

        // 时间同步：每5秒广播一次当前游戏时间
        this.timeSyncTimer += dt;
        if (this.timeSyncTimer >= 5) {
            this.timeSyncTimer = 0;
            this._sendTimeSync();
        }

        // 定期保存建筑状态到服务器（每15秒）
        this.buildingSaveTimer += dt;
        if (this.buildingSaveTimer >= 15) {
            this.buildingSaveTimer = 0;
            this._saveBuildingsToServer();
        }
    }

    // 玩家攻击时检测是否打中其他玩家
    checkPvPAttack(damage) {
        if (!this.connected) return false;
        for (const username of Object.keys(this.players)) {
            const p = this.players[username];
            if (p.health <= 0) continue;
            const dist = this.game.player.position.distanceTo(p.mesh.position);
            if (dist < 4) {
                const dir = new THREE.Vector3();
                this.game.camera.getWorldDirection(dir);
                this._tmpVec.copy(p.mesh.position).sub(this.game.player.position).normalize();
                if (dir.dot(this._tmpVec) > 0.3) {
                    // 用数组格式发attack
                    this.client.publish(this.myTopic, JSON.stringify(['a', this.username, damage]), { qos: 0 });
                    return true;
                }
            }
        }
        return false;
    }

    sendDeath() {
        this._sendRaw('d');
    }

    sendChat(text) {
        if (!this.connected || !this.client) return;
        this.client.publish(this.myTopic, JSON.stringify(['c', this.username, text]), { qos: 0 });
    }

    // 管理员发送give指令给目标玩家
    sendGiveCommand(targetName, itemId, count = 1) {
        if (!this.connected || !this.client) return;
        this.client.publish(this.myTopic, JSON.stringify(['g', this.username, targetName, itemId, count]), { qos: 0 });
    }

    // 发送建筑放置
    sendBuilding(itemId, x, y, z, yaw) {
        if (!this.connected || !this.client) return;
        this.client.publish(this.myTopic, JSON.stringify([
            'b', this.username, itemId,
            +x.toFixed(2), +y.toFixed(2), +z.toFixed(2),
            +yaw.toFixed(3),
        ]), { qos: 0 });
        // 同时保存到服务器
        this._saveBuildingsToServer();
    }

    // 发送建筑移除（通知其他玩家）
    sendBuildingRemoved(x, y, z) {
        if (!this.connected || !this.client) return;
        this.client.publish(this.myTopic, JSON.stringify([
            'br', this.username, +x.toFixed(2), +y.toFixed(2), +z.toFixed(2),
        ]), { qos: 0 });
        // 同时保存到服务器
        this._saveBuildingsToServer();
    }

    // 发送Boss召唤同步
    sendBossSpawn(bossType, x, y, z) {
        if (!this.connected || !this.client) return;
        this.client.publish(this.myTopic, JSON.stringify([
            'eb', this.username, bossType,
            +x.toFixed(2), +y.toFixed(2), +z.toFixed(2),
        ]), { qos: 0 });
    }

    // 发送Boss死亡同步
    sendBossDeath(bossType) {
        if (!this.connected || !this.client) return;
        this.client.publish(this.myTopic, JSON.stringify([
            'ed', this.username, bossType,
        ]), { qos: 0 });
    }

    // 发送Boss攻击其他玩家
    sendBossHitPlayer(targetUsername, damage) {
        if (!this.connected || !this.client) return;
        this.client.publish(this.myTopic, JSON.stringify([
            'eh', this.username, targetUsername, damage,
        ]), { qos: 0 });
    }

    // 接收到远程Boss召唤
    _onRemoteBossSpawn(username, bossType, x, y, z) {
        if (window.game && window.game.enemies) {
            const pos = new THREE.Vector3(x, y, z);
            if (bossType === 'stone_monster_boss') {
                window.game.enemies._spawnStoneMonsterBoss(pos.x, pos.y, pos.z);
                this.game.onMessage(username + ' 召唤了石志怪!');
            } else if (bossType === 'giant_stone_boss') {
                window.game.enemies._spawnGiantStoneBoss(pos.x, pos.y, pos.z);
                this.game.onMessage(username + ' 召唤了巨石怪!');
            } else if (bossType === 'tree_spirit') {
                window.game.enemies._spawnTreeSpirit(pos.x, pos.y, pos.z);
                this.game.onMessage(username + ' 召唤了树精!');
            } else if (bossType === 'gold_zombie') {
                window.game.enemies._spawnGoldZombie(pos.x, pos.y, pos.z);
                this.game.onMessage(username + ' 召唤了金僵尸!');
            }
        }
    }

    // 接收到远程Boss死亡
    _onRemoteBossDeath(bossType) {
        if (window.game && window.game.enemies) {
            for (const e of window.game.enemies.enemies) {
                if (!e.dead && e.enemyType === bossType) {
                    e.health = 0;
                    e.dead = true;
                    break;
                }
            }
        }
    }

    // 接收到远程建筑放置（含可选状态数据）
    _onRemoteBuild(username, itemId, x, y, z, yaw, state) {
        const pos = new THREE.Vector3(x, y, z);
        const ok = this.game.world.placeBuilding(itemId, pos, yaw || 0);
        if (ok && state) {
            // 找到刚放置的建筑（最后一个）并恢复状态
            const buildings = this.game.world.buildings;
            const b = buildings[buildings.length - 1];
            if (b && b.type === itemId) {
                if (state.ms) b.minerStorage = state.ms;
                if (state.mt) b.minerTools = state.mt;
                if (state.cs) b.chestStorage = state.cs;
                if (state.as) b.altarStorage = state.as;
            }
        }
    }

    // 请求同步现有建筑（加入房间时）
    requestBuildSync() {
        if (!this.connected || !this.client) return;
        this.client.publish(this.myTopic, JSON.stringify(['bs', this.username]), { qos: 0 });
    }

    // 接收到远程建筑移除
    _onRemoteBuildRemove(x, y, z) {
        const buildings = this.game.world.buildings;
        for (let i = buildings.length - 1; i >= 0; i--) {
            const b = buildings[i];
            if (b.mesh &&
                Math.abs(b.mesh.position.x - x) < 0.5 &&
                Math.abs(b.mesh.position.y - y) < 0.5 &&
                Math.abs(b.mesh.position.z - z) < 0.5) {
                this.game.world.removeBuilding(b);
                break;
            }
        }
    }

    // 发送所有已有建筑给新玩家（含内部状态）
    _sendAllBuildings() {
        if (!this.connected || !this.client) return;
        const buildings = this.game.world.buildings;
        for (const b of buildings) {
            if (b.mesh) {
                const p = b.mesh.position;
                // 收集建筑内部状态
                let state = null;
                if (b.type === 'auto_miner' || b.type === 'chest' || b.type === 'normal_altar') {
                    state = {
                        ms: b.minerStorage || [],
                        mt: b.minerTools || [null, null, null],
                        cs: b.chestStorage || [],
                        as: b.altarStorage || [],
                    };
                }
                this.client.publish(this.myTopic, JSON.stringify([
                    'b', this.username, b.type,
                    +p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2),
                    +b.mesh.rotation.y.toFixed(3),
                    state,
                ]), { qos: 0 });
            }
        }
    }

    // 序列化所有建筑为JSON（用于服务器持久化）
    _serializeAllBuildings() {
        const buildings = this.game.world.buildings;
        const result = [];
        for (const b of buildings) {
            if (b.mesh) {
                const p = b.mesh.position;
                result.push({
                    type: b.type,
                    x: +p.x.toFixed(2),
                    y: +p.y.toFixed(2),
                    z: +p.z.toFixed(2),
                    ry: +b.mesh.rotation.y.toFixed(3),
                    minerStorage: b.minerStorage || [],
                    minerTools: (b.minerTools || []).map(t => t ? { id: t.id, amount: t.amount || 1 } : null),
                    chestStorage: b.chestStorage || [],
                    altarStorage: b.altarStorage || [],
                });
            }
        }
        return result;
    }

    // 保存建筑状态到服务器
    async _saveBuildingsToServer() {
        if (!this.roomId) return;
        try {
            const buildings = this._serializeAllBuildings();
            await fetch('/api/buildings/' + this.roomId, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ buildings }),
            });
        } catch (e) {
            console.error('Save buildings to server failed:', e);
        }
    }

    // 从服务器加载建筑状态
    async _loadBuildingsFromServer() {
        if (!this.roomId) return;
        try {
            const res = await fetch('/api/buildings/' + this.roomId);
            if (!res.ok) return;
            const data = await res.json();
            if (!data.buildings || data.buildings.length === 0) return;
            // 加载建筑（避免重复放置）
            for (const b of data.buildings) {
                // 检查是否已存在相同位置的建筑
                const exists = this.game.world.buildings.some(existing =>
                    existing.mesh &&
                    Math.abs(existing.mesh.position.x - b.x) < 0.1 &&
                    Math.abs(existing.mesh.position.z - b.z) < 0.1
                );
                if (exists) continue;
                const pos = new THREE.Vector3(b.x, b.y, b.z);
                const ok = this.game.world.placeBuilding(b.type, pos, b.ry || 0);
                if (ok) {
                    const placed = this.game.world.buildings[this.game.world.buildings.length - 1];
                    if (b.minerStorage) placed.minerStorage = b.minerStorage;
                    if (b.minerTools) placed.minerTools = b.minerTools;
                    if (b.chestStorage) placed.chestStorage = b.chestStorage;
                    if (b.altarStorage) placed.altarStorage = b.altarStorage;
                }
            }
            this._buildingsLoaded = true;
            if (window.game) window.game.onMessage('从服务器加载了' + data.buildings.length + '个建筑');
        } catch (e) {
            console.error('Load buildings from server failed:', e);
        }
    }

    // 发送时间同步
    _sendTimeSync() {
        if (!this.connected || !this.client) return;
        const w = this.game.world;
        this.client.publish(this.myTopic, JSON.stringify([
            't', this.username,
            +w.currentHour.toFixed(3), w.dayCount,
        ]), { qos: 0 });
    }

    // 接收到时间同步
    _onTimeSync(hour, day) {
        const w = this.game.world;
        if (!w) return;
        // 平滑调整本地时间向目标靠拢
        const targetHour = hour;
 let diff = targetHour - w.currentHour;
        // 处理跨日 wrap-around
        if (diff > 12) diff -= 24;
        if (diff < -12) diff += 24;
        // 只在差异较大时调整，小差异让本地自然推进
        if (Math.abs(diff) > 0.5) {
            w.currentHour += diff * 0.5;
            if (w.currentHour < 0) w.currentHour += 24;
            if (w.currentHour >= 24) w.currentHour -= 24;
        }
        if (day > w.dayCount) w.dayCount = day;
        this._hasTimeSync = true;
    }

    getPlayerList() {
        return Object.keys(this.players).map(username => ({
            username,
            health: this.players[username].health,
        }));
    }

    disconnect() {
        if (this.client) {
            this._sendRaw('l');
            this.client.end(true); // force close
            this.client = null;
        }
        this.connected = false;
        for (const username of Object.keys(this.players)) {
            this._removePlayer(username);
        }
        this.players = {};
        this.roomId = null;
        this._reconnectAttempts = 0;
    }
}
