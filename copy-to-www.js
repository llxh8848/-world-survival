// copy-to-www.js - 将网页文件复制到 www 目录供 Capacitor 打包
const fs = require('fs');
const path = require('path');

const files = ['index.html', 'style.css', 'manifest.json', 'sw.js', 'icon-192.png', 'icon-512.png'];
const dirs = ['js'];

const wwwDir = path.join(__dirname, 'www');
if (!fs.existsSync(wwwDir)) fs.mkdirSync(wwwDir, { recursive: true });

for (const f of files) {
    const src = path.join(__dirname, f);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(wwwDir, f));
    }
}

for (const d of dirs) {
    const srcDir = path.join(__dirname, d);
    const dstDir = path.join(wwwDir, d);
    if (fs.existsSync(srcDir)) {
        fs.cpSync(srcDir, dstDir, { recursive: true });
    }
}

console.log('Files copied to www/');
