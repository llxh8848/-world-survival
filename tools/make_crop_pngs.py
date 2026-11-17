# 把方案/农作物LOGO 下的白底JPG转成透明PNG，输出到 www/img/
# 算法：从四边泛洪填出背景掩码（不伤内部高光），再把紧贴边缘的浅色毛边按亮度羽化
from PIL import Image
from collections import deque
import os

def white_to_alpha(src, dst, thr=240, feather=3, feather_lo=180, max_size=256):
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    px = im.load()
    visited = bytearray(w * h)
    bg = bytearray(w * h)
    q = deque()
    # 从四边播种：只把与边缘相连的近白色区域标记为背景
    def seed(x, y):
        r, g, b, a = px[x, y]
        if min(r, g, b) >= thr:
            i = y * w + x
            if not visited[i]:
                visited[i] = 1
                q.append((x, y))
    for x in range(w):
        seed(x, 0)
        seed(x, h - 1)
    for y in range(h):
        seed(0, y)
        seed(w - 1, y)
    while q:
        x, y = q.popleft()
        bg[y * w + x] = 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h:
                i = ny * w + nx
                if not visited[i]:
                    r, g, b, a = px[nx, ny]
                    if min(r, g, b) >= thr:
                        visited[i] = 1
                        q.append((nx, ny))
    # 向外扩张 feather 圈：边缘的浅色毛边（JPG噪边）也纳入羽化区
    cur = bytearray(bg)
    for _ in range(feather):
        nxt = bytearray(cur)
        for y in range(h):
            for x in range(w):
                i = y * w + x
                if cur[i]:
                    continue
                near = (x > 0 and cur[i - 1]) or (x < w - 1 and cur[i + 1]) or \
                       (y > 0 and cur[i - w]) or (y < h - 1 and cur[i + w])
                if near:
                    r, g, b, a = px[x, y]
                    if min(r, g, b) >= feather_lo:  # 足够浅才算白边
                        nxt[i] = 1
        cur = nxt
    # 写透明度：背景全透明；羽化区按亮度线性衰减
    for y in range(h):
        for x in range(w):
            i = y * w + x
            r, g, b, a = px[x, y]
            if bg[i]:
                px[x, y] = (r, g, b, 0)
            elif cur[i]:
                m = min(r, g, b)
                alpha = 0 if m >= thr else int(255 * (thr - m) / (thr - feather_lo))
                px[x, y] = (r, g, b, max(0, min(255, alpha)))
    # 裁掉四周透明空白边（留一点边距）
    bbox = im.getchannel('A').getbbox()
    if bbox:
        pad = 8
        l, t, r, b = bbox
        im = im.crop((max(0, l - pad), max(0, t - pad), min(w, r + pad), min(h, b + pad)))
    im.thumbnail((max_size, max_size))
    im.save(dst)
    print(dst, 'ok', im.size)

os.makedirs(r'F:\xy\xyxnyz\www\img', exist_ok=True)
white_to_alpha(r'F:\xy\xyxnyz\方案\农作物LOGO\水稻.jpg', r'F:\xy\xyxnyz\www\img\crop_rice.png')
white_to_alpha(r'F:\xy\xyxnyz\方案\农作物LOGO\橘子.jpg', r'F:\xy\xyxnyz\www\img\crop_orange.png')
