// ai.js — 玩玩AI · 第二代引擎（纯本地知识库版）
//
// 不接任何大模型：根据玩家的话判断意图→检索知识库→给出答案。
// 返回 think 字段告诉前端"思考"多久，模拟真AI的想一想过渡。
//
// 架构：
//  · 意图：算式(调度场)/开网站/寒暄&小玩法(掷骰/推荐/报时)
//  · 检索：字符二元组 Dice 相似度（容错/语序不敏感）
//  · 对话：每用户会话状态机（话题/追问/轮次）
//  · 应答：句式多样化 + suggest 相关问推荐

const KB = require('./gamekb.js');

const pick = arr => arr[Math.floor(Math.random() * arr.length)];

// ================= 检索器：二元组 Dice =================
const STOP = /^(?:请问|告诉我|你知道|说说|讲讲|我想知道)/;
const QWORDS = /什么是|是什么|谁是|是谁|介绍一下|介绍|是什么意思|是多少|为什么|怎么办|怎么做|怎么用|怎么样|如何|的意思/g;
const norm = s => String(s || '').toLowerCase()
    .replace(STOP, '').replace(QWORDS, '')
    .replace(/[^一-龥a-z0-9]/g, '');

function gramsOf(s) { // 字符二元组集合；单字退化为自身
    const g = new Set();
    for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2));
    if (s.length === 1) g.add(s);
    return g;
}

const DOCS = Object.entries(KB).map(([key, fact]) => ({
    key, fact: String(fact),
    raw: norm(key), g: gramsOf(norm(key)),
}));

function retrieve(query, n) {
    const qn = norm(query);
    if (!qn) return [];
    const qg = gramsOf(qn), out = [];
    for (const d of DOCS) {
        let inter = 0;
        for (const g of qg) if (d.g.has(g)) inter++;
        let sc = (2 * inter) / (qg.size + d.g.size); // Dice 系数
        if (qn === d.raw) sc += 1;                    // 全等
        else if (qn.includes(d.raw)) sc += 0.35;      // 问句含词条
        else if (d.raw.includes(qn) && qn.length >= 2) sc += 0.2; // 词条含问句
        if (sc > 0.3) out.push({ d, sc });
    }
    out.sort((a, b) => b.sc - a.sc);
    const top = [];
    for (const h of out) { // 被更高分词条覆盖的短词丢掉
        if (!top.some(p => p.d.key.includes(h.d.key) || h.d.key.includes(p.d.key))) top.push(h);
    }
    return top.slice(0, n || 3).map(h => h.d);
}

// ================= 意图1：算式（调度场） =================
function calcExpr(src) {
    const prec = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3, '~': 4 }; // ~=一元负
    const right = { '^': 1, '~': 1 };
    const out = [], ops = [];
    const apply = () => { // 弹栈求值压回
        const op = ops.pop(), b = out.pop();
        if (op === '~') { out.push(-b); return true; }
        const a = out.pop();
        if (a === undefined) return false;
        out.push(op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : op === '%' ? a % b : op === '^' ? Math.pow(a, b) : a / b);
        return true;
    };
    let i = 0, unary = true;
    while (i < src.length) {
        const c = src[i];
        if (c === ' ') { i++; continue; }
        if (/[\d.]/.test(c)) {
            const m = /^\d+(?:\.\d+)?/.exec(src.slice(i));
            out.push(parseFloat(m[0])); i += m[0].length; unary = false;
        } else if (c === '(') { ops.push(c); i++; unary = true; }
        else if (c === ')') {
            while (ops.length && ops[ops.length - 1] !== '(') if (!apply()) return NaN;
            if (!ops.length) return NaN; ops.pop(); i++; unary = false;
        } else if (prec[c]) {
            const op = unary && c === '-' ? '~' : c;
            while (ops.length && ops[ops.length - 1] !== '(' &&
                (prec[ops[ops.length - 1]] > prec[op] ||
                    (prec[ops[ops.length - 1]] === prec[op] && !right[op])))
                if (!apply()) return NaN;
            ops.push(op); i++; unary = true;
        } else return NaN;
    }
    while (ops.length) { if (ops[ops.length - 1] === '(') return NaN; if (!apply()) return NaN; }
    return out.length === 1 ? out[0] : NaN;
}
function tryCalc(msg) {
    const s = String(msg).trim()
        .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
        .replace(/（/g, '(').replace(/）/g, ')')
        .replace(/[xX×]/g, '*').replace(/÷/g, '/')
        .replace(/的平方/g, '^2').replace(/的立方/g, '^3')
        .replace(/加/g, '+').replace(/减/g, '-').replace(/乘方/g, '^').replace(/乘/g, '*').replace(/除/g, '/')
        .replace(/帮我算|请算|麻烦算|算一下|算一算|等于多少|是多少|等于几|是几|等于|算算|多少|算|，|,|？|\?|＝|=/g, '').trim();
    if (!/^[\d\s.+\-*/%^()]+$/.test(s)) return null;
    if ((s.match(/\d+(?:\.\d+)?/g) || []).length < 2 || !/[+\-*/%^]/.test(s)) return null;
    const v = calcExpr(s);
    if (!isFinite(v)) return '这题算出无穷大了，除数不能是0哦~';
    return pick(['算好了：', '这题我会：', '答案是——']) + `${s.replace(/\s+/g, '')} = ${Math.round(v * 1e10) / 1e10}`;
}

// ================= 意图2：开网站 =================
const SITES = [
    { re: /b站|哔哩|bilibili|bili/i, url: 'https://www.bilibili.com', name: 'B站' },
    { re: /youtube|油管/i, url: 'https://www.youtube.com', name: 'YouTube' },
    { re: /百度|baidu/i, url: 'https://www.baidu.com', name: '百度' },
    { re: /共创世界|ccw/i, url: 'https://www.ccw.site/', name: '共创世界' },
];
function trySite(msg) {
    const site = SITES.find(s => s.re.test(msg));
    if (!site) return null;
    const strong = /打开|开启|进入|跳转|点开|带我去|帮我开/.test(msg);
    const weak = /看|刷|去|上|进|逛|玩/.test(msg) && !/[吗呢吧？?]|什么|是谁|怎么样|好不好/.test(msg);
    if (!strong && !weak) return null;
    return { reply: pick([`好嘞，正在为你打开${site.name}，新标签页见~`, `${site.name}马上就来，给你开新标签页啦~`]), open: site.url };
}

// ================= 意图3：闲聊&小玩法（全部动态拼装，无固定句式） =================
const GAMES = ['世界生存', '植物大战僵尸', '火柴人大战僵尸', '小球对战', '衬彩稻田'];

// 抽一条知识库冷知识：「词条名」+ 摘要（截到首个句号/40字）
function randomFact() {
    const d = RAND_POOL[Math.floor(Math.random() * RAND_POOL.length)];
    const first = String(d.fact).split(/[。\n]/)[0];
    const brief = first.length > 40 ? first.slice(0, 40) + '…' : first;
    return `「${d.key}」${brief}`;
}

function smalltalk(msg) {
    if (/^\s*(你好|嗨|哈喽|hi|hello|在吗|在么|早上好|下午好|晚上好)/i.test(msg))
        return pick(['你好', '嗨', '哈喽']) + pick(['~', '！', '呀~']) +
            pick(['正好想到一个：', '给你抖个冷知识——', '最近在研究', '聊个有意思的：']) + randomFact();
    if (/谢谢|感谢|谢啦|辛苦了/.test(msg))
        return pick(['不客气', '客气啥', '小事一桩']) + pick(['~', '！']) +
            pick(['对了，', '顺嘴一提，', '']) + pick([`「${aiSuggest(1)[0]}」也挺有意思的~`, '还有问题随时问~']);
    if (/再见|拜拜|溜了|我去玩了/.test(msg))
        return pick(['拜拜', '回见', '去吧']) + pick(['~', '！']) +
            pick([`走之前瞄一眼${randomFact()}？`, '游戏盒等你回来~', '回头见~']);
    if (/掷个骰子|掷骰|扔骰|骰子|roll/i.test(msg)) {
        const v = 1 + Math.floor(Math.random() * 6);
        return `🎲 掷出了 ${v} 点！` + (v === 6 ? '手气爆棚！' : v === 1 ? '呃…换个游戏转转运？' : '');
    }
    if (/推荐.*游戏|玩什么|什么好玩|好无聊|不知道玩啥|不知道玩什么/.test(msg)) {
        const g = pick(GAMES);
        return `无聊的话，去试试「${g}」吧！` + pick(['要攻略随时问我~', '它的攻略我门儿清，打不过来问我。']);
    }
    if (/几点|什么时间|现在时间|今天星期|几号了/.test(msg)) {
        const d = new Date();
        const wd = '日一二三四五六'[d.getDay()];
        return `现在是 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}，星期${wd}。到点了就去玩一局吧~`;
    }
    return null;
}

// ================= 会话状态机 =================
const sessions = new Map(); // user → {topic, fact, turns}
const sessOf = u => {
    let s = sessions.get(u);
    if (!s) sessions.set(u, s = { topic: '', fact: '', turns: 0 });
    return s;
};
const FOLLOWUP_ATTR = /怎么解锁|怎么获得|多少钱|几关|多少关|多少|强吗|强不强|厉害吗|怎么玩|在哪|剧情|技能|效果/;

// 思考时长：底子700ms + 按答案长度加（每字14ms），封顶2600ms——答案越长想得越久
const thinkTime = reply => Math.min(2600, 700 + String(reply || '').length * 14 + Math.floor(Math.random() * 300));

// 招呼/AI自身/情绪类词条不作为随机话题（只在被直接问到时用）
const META = new Set(['小宇AI', '玩玩AI', '你是谁', '你叫什么', '你的名字', '你会什么', '你会', '帮助', '功能', '干嘛', '干什么',
    '你多大', '你喜欢', '你好', '早上好', '中午好', '晚上好', '晚安', '在吗', '在不在', '谢谢', '感谢', '再见', '拜拜',
    '吃了吗', '吃了', '时间', '几点', '天气', '骰子', '猜数字', '石头剪刀布', '难过', '伤心', '开心', '高兴', '喜欢', '爱',
    '笨', '傻', '厉害', '最强', '推荐', '哪个好玩', '好玩', '玩什么', '玩游戏', '无聊', '没事干', '运势', '运气',
    '计算', '共创世界', 'ccw', '玩法', '怎么玩', '关卡']);
const RAND_POOL = DOCS.filter(d => !META.has(d.key)); // 随机话题池：只装游戏内容词条

// 从知识库随机抽n个话题（欢迎气泡/没听懂时的引导都用它，不写死）
function aiSuggest(n) {
    const pool = RAND_POOL.map(d => d.key), out = [];
    while (out.length < n && pool.length) {
        const k = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
        if (!out.includes(k)) out.push(k);
    }
    return out;
}

// ================= 主流程（纯本地：无模型调用） =================
async function aiChat(raw, user, history) {
    const msg = String(raw || '').trim().slice(0, 200);
    if (!msg) return { reply: '想说点什么？', suggest: [] };
    const s = sessOf(user);
    s.turns++;
    const done = (reply, extra) => Object.assign({ reply, think: thinkTime(reply) }, extra);

    // ① 确定性意图（算式/开站/闲聊小玩法）——不会被模型带偏
    const c = tryCalc(msg);   if (c) return done(c);
    const st = trySite(msg);  if (st) return Object.assign(st, { think: thinkTime(st.reply) });
    const sm = smalltalk(msg); if (sm) return done(sm);

    // ② 检索
    let hits = retrieve(msg);
    // 追问：没命中/带代词/属性式短问 → 接上轮话题重查
    const isFollow = s.topic && (/它|这个|那个|他|她/.test(msg) ||
        /^(然后呢|还有吗|继续|再说说|详细点|还有呢|后来呢|比如呢|展开说)/.test(msg) ||
        (FOLLOWUP_ATTR.test(msg) && msg.length <= 12));
    if (isFollow) {
        const re = retrieve(msg.replace(/它|这个|那个|他|她/g, s.topic) + s.topic);
        if (re.length) hits = re;
        else if (!hits.length)
            return done(pick([
                `上回说到「${s.topic}」：${s.fact || '细节我记得不太清了'}，想深挖哪方面？`,
                `你是指刚才的「${s.topic}」吧——${s.fact || '再多细节我就不确定了'}，还想问它什么？`,
                `接着「${s.topic}」说？我记得的是：${s.fact || '只知道大概'}。`,
            ]), { suggest: [s.topic] });
    }

    // ③ 本地答案：多词条拼接 → 单词条 → 超范围
    let reply, sug;
    const multi = hits.length > 1 && !META.has(hits[0].key); // AI自身类词条只答最高分那条，别名不拼
    if (multi) {
        s.topic = hits[0].key; s.fact = hits[0].fact;
        const uniq = hits.filter((d, i) => hits.findIndex(e => e.fact === d.fact) === i); // 内容雷同的词条去重
        reply = uniq.length === 1 ? uniq[0].fact
            : pick(['你这句里有几个点——', '拆开来答——', '我找到这些——']) +
                uniq.map(d => `「${d.key}」${d.fact}`).join('；');
        sug = hits.map(d => d.key);
    } else if (hits.length >= 1) {
        s.topic = hits[0].key; s.fact = hits[0].fact;
        reply = hits[0].fact;
        sug = [hits[0].key];
    } else {
        // 没听懂：不背固定话术——从知识库随机抽3个话题反问/引导
        sug = aiSuggest(3);
        reply = pick([
            `这个我还没学到…你是想问「${sug[0]}」吗？`,
            `没听懂这句。要不聊聊「${sug[0]}」或者「${sug[1]}」？`,
            '这个我不懂欸，下面几个话题我倒是熟：',
        ]);
    }
    return done(reply, { suggest: sug });
}

module.exports = { aiChat, retrieve, aiSuggest };
