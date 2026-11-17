// 世界生存重置版：联机房间系统
// 复用旧多人模式的 MQTT 公共 broker 方案（无需自建服务器）。
// 主题结构：
//   ws_rmk_lobby/<房间id>          —— 房间公告（retained）：{id,name,host,cnt,st,ts}
//   ws_rmk_room_<房间id>/<用户名>  —— 房间内消息（谁发的看主题尾段）
(function () {
    'use strict';

    const isLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname);
    const BROKERS = [
        isLocal ? (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/mqtt' : null,
        'wss://broker.emqx.io:8084/mqtt',
        'wss://test.mosquitto.org:8081/mqtt',
        'wss://broker.hivemq.com:8884/mqtt',
    ].filter(Boolean);
    let brokerIdx = 0;

    const LOBBY_PREFIX = 'ws_rmk_lobby/';
    const ROOM_PREFIX = 'ws_rmk_room_';
    const ROOM_TTL = 25000;       // 房间公告超过25s未刷新视为失效
    const HB_MS = 10000;          // 房主每10s刷新一次公告

    const RmkNet = {
        client: null,             // mqtt客户端
        status: 'idle',           // idle/connecting/online/offline
        name: '',                 // 我的用户名
        rooms: new Map(),         // 大厅房间表 id->{id,name,host,cnt,st,ts}
        myRooms: [],              // 我创建的房间 [{id,name,saveId,st}]
        roomId: null,             // 当前加入的房间id
        isHost: false,
        inGame: false,            // 已进入房间游戏中
        _hbT: null,
        _cbs: {},                 // on(msgName, fn)

        on(t, fn) { this._cbs[t] = fn; },
        _emit(t, m) { if (this._cbs[t]) this._cbs[t](m); },

        // ===== 连接 =====
        ensure() {
            if (this.client) { this._emitStatus(); return; }
            if (typeof mqtt === 'undefined') { this.status = 'offline'; this._emitStatus(); return; }
            this.status = 'connecting'; this._emitStatus();
            this._tryConnect();
        },
        _tryConnect() {
            if (brokerIdx >= BROKERS.length) { this.status = 'offline'; this._emitStatus(); return; }
            const url = BROKERS[brokerIdx];
            let done = false;
            const timeout = setTimeout(() => {
                if (done) return; done = true;
                try { c.end(true); } catch (e) {}
                brokerIdx++; this._tryConnect();
            }, 6000);
            const c = mqtt.connect(url, {
                clientId: 'rmk_' + Math.random().toString(36).slice(2, 12),
                clean: true, reconnectPeriod: 0, connectTimeout: 5000,
            });
            c.on('connect', () => {
                if (done) return; done = true; clearTimeout(timeout);
                this.client = c;
                this.status = 'online'; this._emitStatus();
                c.subscribe(LOBBY_PREFIX + '+', { qos: 0 });
                if (this.roomId) this._joinRoomTopic(); // 断线重连场景（reconnectPeriod=0实际不会触发）
            });
            c.on('message', (topic, buf) => this._onMsg(topic, buf));
            c.on('error', () => {});
            c.on('close', () => {
                if (!done) { done = true; clearTimeout(timeout); brokerIdx++; this._tryConnect(); return; }
                this.client = null;
                if (this.status === 'online') { this.status = 'offline'; this._emitStatus(); }
            });
        },
        disconnect() {
            this._stopHb();
            if (this.client) { try { this.client.end(true); } catch (e) {} this.client = null; }
            this.status = 'idle'; this.roomId = null; this.isHost = false; this.inGame = false;
        },

        // ===== 大厅 =====
        _onMsg(topic, buf) {
            let m;
            try { m = JSON.parse(buf.toString()); } catch (e) { return; }
            if (topic.startsWith(LOBBY_PREFIX)) {              // 房间公告
                if (!m || !m.id) return;
                if (m.st === 'closed' || m.st === 'lobby') {   // 关闭/未开启：从大厅隐藏
                    if (m.st === 'closed' && this.rooms.has(m.id)) this.rooms.delete(m.id);
                    else this.rooms.set(m.id, m);              // lobby态保留但不显示为可加入
                } else this.rooms.set(m.id, m);
                this.rooms.get(m.id) && (this.rooms.get(m.id).ts = Date.now());
                this._emit('rooms');
                return;
            }
            m.f = topic.slice(topic.lastIndexOf('/') + 1);     // 发送者名
            if (m.f === this.name) return;                     // 自己的回声忽略
            this._emit('msg', m);
        },
        myRoom() { return this.myRooms.find(r => r.id === this.roomId) || null; },

        // 创建房间（大厅态，别人看不到，点开启后才可见）
        createRoom(roomName, cb) {
            if (!this.client) return cb && cb('未连接到服务器');
            const id = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
            const room = { id, name: roomName, st: 'lobby', saveId: null };
            this.myRooms.push(room);
            this._saveMyRooms();
            this._publishMeta(room, 0);
            cb && cb(null, room);
        },

        // 开启房间：进入游戏+对大家可见
        openRoom(room, cb) {
            if (!this.client) return cb && cb('未连接');
            this.leave(true);                      // 若曾在别的房间先退出
            this.roomId = room.id; this.isHost = true;
            room.st = 'open';
            this._joinRoomTopic();
            this._publishMeta(room, 1);
            this._startHb(room);
            cb && cb(null);
        },

        // 加入别人房间：订阅主题+打招呼，等world包
        joinRoom(roomId, cb) {
            if (!this.client) return cb && cb('未连接');
            this.leave(true);
            const room = this.rooms.get(roomId);
            if (!room) return cb && cb('加入失败：房间不存在');
            this.roomId = roomId; this.isHost = false;
            this._joinRoomTopic();
            this._send({ t: 'hi' });
            clearInterval(this._hiT);                       // hi丢包重发，直到收到world
            this._hiT = setInterval(() => this._send({ t: 'hi' }), 3000);
            if (window.remake) window.remake._worldPending = true;
            cb && cb(null);
        },

        // 关闭房间（房主游戏中点关闭）：所有人退回主界面，房间从大厅消失
        closeRoom() {
            this._send({ t: 'closed' });
            const room = this.myRooms.find(r => r.id === this.roomId);
            if (room) { room.st = 'closed'; this._publishMeta(room, 0); this._saveMyRooms(); }
            this._stopHb();
            this._leaveTopic();
            this.roomId = null; this.isHost = false; this.inGame = false;
        },
        // 离开房间（自己退出/换房）；silent=仅清理不通知
        leave(silent) {
            if (this.roomId && !silent) this._send({ t: 'bye' });
            this._stopHb();
            clearInterval(this._hiT); this._hiT = null;
            this._leaveTopic();
            this.roomId = null; this.isHost = false; this.inGame = false;
        },
        _leaveTopic() {
            if (this.client && this.roomId) this.client.unsubscribe(ROOM_PREFIX + this.roomId + '/+');
        },
        _joinRoomTopic() {
            this.client.subscribe(ROOM_PREFIX + this.roomId + '/+', { qos: 0 });
        },
        _send(m) {
            if (!this.client || !this.roomId) return;
            this.client.publish(ROOM_PREFIX + this.roomId + '/' + this.name, JSON.stringify(m), { qos: 0 });
        },
        _publishMeta(room, cnt) {
            if (!this.client) return;
            const meta = { id: room.id, name: room.name, host: this.name, cnt: cnt === undefined ? (room._cnt || 0) : cnt, st: room.st };
            room._cnt = meta.cnt;
            this.client.publish(LOBBY_PREFIX + room.id, JSON.stringify(meta), { qos: 0, retain: true });
        },
        bumpCnt(room, d) { room._cnt = Math.max(0, (room._cnt || 0) + d); this._publishMeta(room); },
        _startHb(room) {
            this._stopHb();
            this._hbT = setInterval(() => this._publishMeta(room), HB_MS);
        },
        _stopHb() { if (this._hbT) { clearInterval(this._hbT); this._hbT = null; } },

        // 大厅房间列表（过滤过期/隐藏态）
        roomList() {
            const now = Date.now();
            for (const [id, r] of this.rooms) if (now - r.ts > ROOM_TTL) this.rooms.delete(id);
            return [...this.rooms.values()].filter(r => r.st === 'open');
        },
        _emitStatus() { this._emit('status', this.status); },

        // ===== 我的房间持久化（房间存档对应关系） =====
        _saveMyRooms() { try { localStorage.setItem('rmk_rooms_' + this.name, JSON.stringify(this.myRooms)); } catch (e) {} },
        _loadMyRooms() {
            try { this.myRooms = JSON.parse(localStorage.getItem('rmk_rooms_' + this.name)) || []; }
            catch (e) { this.myRooms = []; }
        },
        delMyRoom(id) {
            const i = this.myRooms.findIndex(r => r.id === id);
            if (i < 0) return;
            if (this.client) this.client.publish(LOBBY_PREFIX + id, '', { retain: true }); // 清retained
            this.myRooms.splice(i, 1); this._saveMyRooms();
        },
    };
    window.RmkNet = RmkNet;

    // ===== 大厅UI =====
    const el = id => document.getElementById(id);
    let selRoom = null, selMy = null;

    function refreshRooms() {
        const list = el('rmkRoomList');
        const rooms = RmkNet.roomList();
        if (!rooms.some(r => r.id === (selRoom && selRoom.id))) selRoom = null;
        list.innerHTML = rooms.length ? '' : '<div class="rmk-save-empty">暂无房间</div>';
        for (const r of rooms) {
            const d = document.createElement('div');
            d.className = 'rmk-save' + (selRoom && selRoom.id === r.id ? ' sel' : '');
            d.innerHTML = '<span class="rmk-save-name">' + _esc(r.name) + '</span><span class="rmk-save-time">' + (r.cnt || 1) + '人</span>';
            d.onclick = () => { selRoom = r; refreshRooms(); refreshBtns(); };
            list.appendChild(d);
        }
        refreshBtns();
    }
    function refreshMyRooms() {
        const list = el('rmkMyRoomList');
        if (!RmkNet.myRooms.some(r => r.id === (selMy && selMy.id))) selMy = null;
        list.innerHTML = RmkNet.myRooms.length ? '' : '<div class="rmk-save-empty">暂无房间</div>';
        for (const r of RmkNet.myRooms) {
            const d = document.createElement('div');
            d.className = 'rmk-save' + (selMy && selMy.id === r.id ? ' sel' : '');
            d.innerHTML = '<span class="rmk-save-name">' + _esc(r.name) + '</span><span class="rmk-save-time">' + (r.st === 'open' ? '进行中' : '已关闭') + '</span>';
            d.onclick = () => { selMy = r; refreshMyRooms(); refreshBtns(); };
            list.appendChild(d);
        }
        refreshBtns();
    }
    function refreshBtns() {
        el('btnRoomJoin').disabled = !selRoom;
        el('btnRoomOpen').disabled = !selMy;
        el('btnRoomDel').disabled = !selMy;
    }
    function setStatus() {
        const s = { idle: '未连接', connecting: '连接中...', online: '在线', offline: '服务器离线' }[RmkNet.status] || '';
        el('rmkRoomStatus').textContent = s;
    }
    function _esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

    function openLobby() {
        el('remakeScreen').style.display = 'none';
        el('rmkLobbyScreen').style.display = 'flex';
        if (!RmkNet.name) {
            RmkNet.name = localStorage.getItem('rmk_name') || ('玩家' + Math.floor(1000 + Math.random() * 9000));
            el('rmkNetName').value = RmkNet.name;
        }
        RmkNet._loadMyRooms();
        RmkNet.ensure();
        refreshRooms(); refreshMyRooms(); setStatus();
        if (!RmkNet._uiTimer) RmkNet._uiTimer = setInterval(() => {
            if (el('rmkLobbyScreen').style.display === 'flex') refreshRooms();
        }, 3000);
    }

    document.addEventListener('DOMContentLoaded', () => {
        el('btnRmkRooms').addEventListener('click', openLobby);
        el('btnRoomBack').addEventListener('click', () => {
            el('rmkLobbyScreen').style.display = 'none';
            el('remakeScreen').style.display = 'flex';
        });
        el('rmkNetName').addEventListener('change', () => {
            const n = el('rmkNetName').value.trim();
            if (n && n !== RmkNet.name) {
                RmkNet.name = n; localStorage.setItem('rmk_name', n);
                RmkNet._loadMyRooms(); refreshMyRooms();
            }
        });
        el('btnRoomJoin').addEventListener('click', () => {
            if (!selRoom) return;
            RmkNet.joinRoom(selRoom.id, err => {
                if (err) { el('rmkRoomMsg').textContent = err; return; }
                el('rmkRoomMsg').textContent = '正在加入「' + selRoom.name + '」...';
            });
        });
        el('btnRoomCreate').addEventListener('click', () => {
            const row = el('rmkRoomCreateRow');
            row.style.display = row.style.display === 'none' ? 'flex' : 'none';
            if (row.style.display === 'flex') el('rmkRoomName').focus();
        });
        const doCreate = () => {
            const name = (el('rmkRoomName').value || '').trim() || (RmkNet.name + '的房间');
            RmkNet.createRoom(name, (err, room) => {
                if (err) { el('rmkRoomMsg').textContent = err; return; }
                el('rmkRoomName').value = '';
                el('rmkRoomCreateRow').style.display = 'none';
                selMy = room; refreshMyRooms();
            });
        };
        el('btnRoomCreateOk').addEventListener('click', doCreate);
        el('rmkRoomName').addEventListener('keydown', e => { if (e.key === 'Enter') doCreate(); e.stopPropagation(); });
        el('btnRoomDel').addEventListener('click', () => {
            if (!selMy) return;
            if (!confirm('删除房间「' + selMy.name + '」？（存档会保留在私人存档里）')) return;
            RmkNet.delMyRoom(selMy.id); selMy = null; refreshMyRooms();
        });
        el('btnRoomOpen').addEventListener('click', () => {
            if (!selMy) return;
            const game = window.remake;
            RmkNet.openRoom(selMy, err => {
                if (err) { el('rmkRoomMsg').textContent = err; return; }
                el('rmkLobbyScreen').style.display = 'none';
                game.joinRoomWorld(selMy);           // 以房主身份进入房间世界
            });
        });

        // 网络回调 → 游戏
        RmkNet.on('rooms', refreshRooms);
        RmkNet.on('status', setStatus);
        RmkNet.on('msg', m => window.remake && window.remake._onNetMsg(m));
    });
})();
