const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const aedes = require('aedes')();
const websocketStream = require('websocket-stream');
const WebSocket = require('ws');
const { aiChat, aiSuggest } = require('./ai.js'); // 玩玩AI引擎（独立模块）

// 本地密钥文件 .env（每行 KEY=VALUE；不覆盖已存在的环境变量）
try {
    for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
} catch { }

const ROOT = path.join(__dirname, 'www');
const PORT = 8090;

// 角色数据存储
const CHARACTERS_FILE = path.join(__dirname, 'characters.json');
function loadCharacters() {
    try { return JSON.parse(fs.readFileSync(CHARACTERS_FILE, 'utf8')); }
    catch { return {}; }
}
function saveCharacters(data) {
    fs.writeFileSync(CHARACTERS_FILE, JSON.stringify(data, null, 2));
}

// AI聊天记录：按账号分存，跨设备可回看
const AICHAT_FILE = path.join(__dirname, 'aichat.json');
function loadAiChats() {
    try { return JSON.parse(fs.readFileSync(AICHAT_FILE, 'utf8')); }
    catch { return {}; }
}
function saveAiChats(data) {
    fs.writeFileSync(AICHAT_FILE, JSON.stringify(data, null, 2));
}

// ===== 玩玩AI引擎已拆到 ai.js（确定性意图→KB检索→大模型→本地兜底） =====

// 建筑持久化：所有建筑保存在服务器，任何玩家上线都能加载，不依赖"看过建筑的玩家是否在线"
const BUILDINGS_FILE = path.join(__dirname, 'buildings.json');
function loadBuildings() {
    try { return JSON.parse(fs.readFileSync(BUILDINGS_FILE, 'utf8')); }
    catch { return {}; }
}
function saveBuildings(data) {
    fs.writeFileSync(BUILDINGS_FILE, JSON.stringify(data, null, 2));
}

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';

    // 角色API
    if (urlPath === '/api/characters' && req.method === 'GET') {
        const query = new URL(req.url, 'http://localhost').searchParams;
        const username = query.get('username');
        const all = loadCharacters();
        const myList = Object.entries(all)
            .filter(([name, owner]) => owner === username)
            .map(([name]) => name);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ characters: myList }));
        return;
    }
    if (urlPath === '/api/characters' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { characterName, username } = JSON.parse(body);
                if (!characterName || !username) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: '参数缺失' }));
                    return;
                }
                const all = loadCharacters();
                if (all[characterName]) {
                    if (all[characterName] !== username) {
                        res.writeHead(409, { 'Content-Type': 'application/json; charset=utf-8' });
                        res.end(JSON.stringify({ error: '角色名已被占用' }));
                        return;
                    }
                }
                all[characterName] = username;
                saveCharacters(all);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: '服务器错误' }));
            }
        });
        return;
    }
    if (urlPath === '/api/characters/check' && req.method === 'GET') {
        const query = new URL(req.url, 'http://localhost').searchParams;
        const characterName = query.get('name');
        const all = loadCharacters();
        if (!all[characterName]) {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ available: true }));
        } else {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ available: false, owner: all[characterName] }));
        }
        return;
    }

    // 玩玩AI：每个账号一份聊天记录
    if (urlPath === '/api/ai/history' && req.method === 'GET') {
        const user = new URL(req.url, 'http://localhost').searchParams.get('user') || 'guest';
        const all = loadAiChats();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ messages: all[user] || [] }));
        return;
    }
    // 随机话题建议（欢迎页气泡）
    if (urlPath === '/api/ai/suggest' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ suggest: aiSuggest(4) }));
        return;
    }
    if (urlPath === '/api/ai' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { user, msg } = JSON.parse(body);
                if (!msg || !String(msg).trim()) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: '消息为空' }));
                    return;
                }
                const u = (user || 'guest').slice(0, 24);
                const all = loadAiChats();
                const list = all[u] || (all[u] = []);
                const out = await aiChat(String(msg).slice(0, 200), u, list); // {reply, open?}
                list.push({ r: 'u', t: String(msg).slice(0, 200), ts: Date.now() });
                list.push({ r: 'a', t: out.reply, ts: Date.now() });
                while (list.length > 200) list.shift(); // 每账号最多留200条
                saveAiChats(all);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify(out));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: '服务器错误' }));
            }
        });
        return;
    }
    if (urlPath === '/api/ai/clear' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { user } = JSON.parse(body);
                const all = loadAiChats();
                delete all[user || 'guest'];
                saveAiChats(all);
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ error: '服务器错误' }));
            }
        });
        return;
    }

    // 建筑持久化 API：按 worldType(normal/stone/gold/cave) 分别存储。
    // 新加入的玩家即使没有"看过建筑"的玩家在线，也能从服务器加载到各维度的建筑。
    // 额外持久化 caveEntrances（石维度矿洞入口），确保服务器重启后矿洞依然存在。
    if (urlPath.startsWith('/api/buildings/')) {
        const parts = urlPath.split('/');
        const roomId = parts[3];
        if (!roomId) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'roomId缺失' }));
            return;
        }
        const all = loadBuildings();
        if (req.method === 'GET') {
            let roomData = all[roomId];
            let wb, caveEntrances = [];
            if (roomData && roomData.worldBuildings) {
                wb = roomData.worldBuildings;
                caveEntrances = Array.isArray(roomData.caveEntrances) ? roomData.caveEntrances : [];
            } else if (roomData) {
                // 兼容旧数据：之前直接存 wb 或平列表
                if (typeof roomData === 'object' && !Array.isArray(roomData) && (roomData.normal || roomData.stone)) {
                    wb = roomData;
                } else if (Array.isArray(roomData)) {
                    wb = { normal: roomData, stone: [], gold: [], cave: [] };
                } else {
                    wb = { normal: [], stone: [], gold: [], cave: [] };
                }
                caveEntrances = [];
            } else {
                wb = { normal: [], stone: [], gold: [], cave: [] };
            }
            if (!wb || typeof wb !== 'object' || Array.isArray(wb)) {
                const legacy = Array.isArray(wb) ? wb : (wb && Array.isArray(wb.buildings) ? wb.buildings : []);
                wb = { normal: legacy, stone: [], gold: [], cave: [] };
            }
            wb.normal = Array.isArray(wb.normal) ? wb.normal : [];
            wb.stone = Array.isArray(wb.stone) ? wb.stone : [];
            wb.gold = Array.isArray(wb.gold) ? wb.gold : [];
            wb.cave = Array.isArray(wb.cave) ? wb.cave : [];
            all[roomId] = { worldBuildings: wb, caveEntrances };
            saveBuildings(all);
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ worldBuildings: wb, caveEntrances }));
            return;
        }
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    const payload = JSON.parse(body);
                    let wb;
                    if (payload && payload.worldBuildings && typeof payload.worldBuildings === 'object') {
                        wb = payload.worldBuildings;
                    } else if (payload && Array.isArray(payload.buildings)) {
                        wb = { normal: payload.buildings, stone: [], gold: [], cave: [] };
                    } else {
                        wb = { normal: [], stone: [], gold: [], cave: [] };
                    }
                    wb.normal = Array.isArray(wb.normal) ? wb.normal : [];
                    wb.stone = Array.isArray(wb.stone) ? wb.stone : [];
                    wb.gold = Array.isArray(wb.gold) ? wb.gold : [];
                    wb.cave = Array.isArray(wb.cave) ? wb.cave : [];

                    const incomingEnt = Array.isArray(payload && payload.caveEntrances) ? payload.caveEntrances : null;
                    let caveEntrances = incomingEnt || [];
                    // 如果没传 entrances，保留旧的
                    if (!incomingEnt) {
                        const prev = all[roomId];
                        if (prev && Array.isArray(prev.caveEntrances)) caveEntrances = prev.caveEntrances;
                        else if (prev && prev.worldBuildings && Array.isArray(prev.caveEntrances)) caveEntrances = prev.caveEntrances;
                    }
                    caveEntrances = caveEntrances.map(e => ({ x: +e.x, y: +e.y, z: +e.z })).filter(e => Number.isFinite(e.x) && Number.isFinite(e.z));

                    all[roomId] = { worldBuildings: wb, caveEntrances };
                    saveBuildings(all);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: true }));
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: '服务器错误' }));
                }
            });
            return;
        }
        res.writeHead(405, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
    }

    // 禁用 sw.js 的 ServiceWorker 缓存干扰
    const filePath = path.join(ROOT, urlPath);
    const ext = path.extname(filePath).toLowerCase();

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found: ' + urlPath);
            return;
        }

        const mime = MIME[ext] || 'application/octet-stream';
        // 所有文件都禁用缓存，确保实时更新
        res.writeHead(200, {
            'Content-Type': mime,
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
        });
        res.end(data);
    });
});

// 本地MQTT broker - 通过WebSocket提供局域网联机
const wss = new WebSocket.Server({ noServer: true });
server.on('upgrade', (request, socket, head) => {
    const urlPath = request.url.split('?')[0];
    if (urlPath === '/mqtt') {
        wss.handleUpgrade(request, socket, head, (ws) => {
            const stream = websocketStream(ws);
            aedes.handle(stream);
        });
    } else {
        socket.destroy();
    }
});

aedes.on('client', (client) => {
    console.log(`  [MQTT] 客户端连接: ${client.id}`);
});
aedes.on('clientDisconnect', (client) => {
    console.log(`  [MQTT] 客户端断开: ${client.id}`);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  🌐 游戏服务器已启动`);
    console.log(`  ➜  http://localhost:${PORT}`);
    console.log(`  ➜  局域网: http://${getLocalIP()}:${PORT}`);
    console.log(`  ➜  所有文件已禁用缓存，修改 www/ 后刷新即可生效\n`);
});

function getLocalIP() {
    const os = require('os');
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return '127.0.0.1';
}
