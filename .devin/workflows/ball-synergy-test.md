---
description: 新增球种/羁绊组后的平衡测试流程
---
Ball Battle 新增球种或羁绊组后的验证流程。

1. 新球种加进 `F:\xy\xyxnyz\www\js\ballbattle.js` 的 `BB_TYPES`，并在 `_makeBall` 初始化新字段、`_update`/`_hurt`/`_render` 实现机制。
2. 新羁绊组加进 `BB_SYNERGY` 数组（`{ name: 'xx组', types: ['typeA','typeB',...] }`），同队凑齐成员即触发，全队 atk+5（超伤额外 judgeDps+5），无需改 `_applySynergy`。
3. 语法校验：`node --check F:\xy\xyxnyz\www\js\ballbattle.js`
4. 单体平衡：`node F:\xy\xyxnyz\bbsim.js` → 查看 `F:\xy\xyxnyz\sim_result.txt`（全球1v1两两循环，80场/对）
5. 队伍平衡：`node F:\xy\xyxnyz\bbteamsim.js` → 查看 `F:\xy\xyxnyz\sim_teams.txt`（全2球/3球组合循环，20场/对，约3.8万场需1-2分钟，建议后台运行）
6. 向用户报告新球/新羁绊相关对阵的胜率和总榜位置，提出调整建议。
