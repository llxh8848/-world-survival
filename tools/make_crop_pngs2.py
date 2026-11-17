# 从农作物LOGO原图衍生各生长阶段贴图 + 物品图标，输出到 www/img/
# st0: 土堆+小芽   st1: 幼苗/幼树   st2: 快成熟（橘子先抠掉果实）   st3: 成熟全图
# 物品图标：稻米=稻穗局部  橘子=单个果子局部
from PIL import Image
from collections import deque
import os

OUT = r'F:\xy\xyxnyz\www\img'
os.makedirs(OUT, exist_ok=True)

def white_to_alpha(src, thr=240, feather=3, feather_lo=180):
    im = Image.open(src).convert('RGBA')
    w, h = im.size
    px = im.load()
    visited = bytearray(w * h)
    bg = bytearray(w * h)
    q = deque()
    def seed(x, y):
        r, g, b, a = px[x, y]
        if min(r, g, b) >= thr:
            i = y * w + x
            if not visited[i]:
                visited[i] = 1
                q.append((x, y))
    for x in range(w):
        seed(x, 0); seed(x, h - 1)
    for y in range(h):
        seed(0, y); seed(w - 1, y)
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
                    if min(r, g, b) >= feather_lo:
                        nxt[i] = 1
        cur = nxt
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
    bbox = im.getchannel('A').getbbox()
    if bbox:
        pad = 8
        l, t, r, b = bbox
        im = im.crop((max(0, l - pad), max(0, t - pad), min(w, r + pad), min(h, b + pad)))
    return im  # 紧凑透明底全分辨率

def save(im, name, mx=256):
    c = im.copy()
    c.thumbnail((mx, mx))
    c.save(os.path.join(OUT, name))
    print(name, c.size)

def cut(im, box, name, mx=256):
    w, h = im.size
    c = im.crop((int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)))
    save(c, name, mx)

def recolor(im, test, to):
    # test(r,g,b)->bool 命中像素按亮度转成to基准色（保留明暗）
    im = im.copy()
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 0 and test(r, g, b):
                k = ((r + g + b) / 3) / 150.0
                px[x, y] = (min(255, int(to[0] * k)), min(255, int(to[1] * k)), min(255, int(to[2] * k)), a)
    return im

def deorange(im):  # 橙果→青果（未熟）
    return recolor(im, lambda r, g, b: r > 170 and r - g > 40 and g < 190 and b < 130, (110, 160, 90))

def degold(im):    # 金穗→青穗（未熟）
    return recolor(im, lambda r, g, b: r > 170 and g > 130 and r - b > 90 and b < 140, (100, 160, 80))

rice = white_to_alpha(r'F:\xy\xyxnyz\方案\农作物LOGO\水稻.jpg')
org = white_to_alpha(r'F:\xy\xyxnyz\方案\农作物LOGO\橘子.jpg')

# ===== 水稻阶段：构图 穗在上方0-35% 叶中部 土堆+小草在底部 =====
cut(rice, (0.00, 0.70, 0.42, 1.00), 'crop_rice_s0.png')   # 土堆+小芽
cut(rice, (0.10, 0.50, 0.85, 1.00), 'crop_rice_s1.png')   # 幼苗（下部叶片）
save(degold(rice.crop((int(0.05 * rice.width), int(0.30 * rice.height), int(0.95 * rice.width), rice.height))), 'crop_rice_s2.png')  # 长高抽青穗
save(rice, 'crop_rice.png')                                # 成熟全图
cut(rice, (0.00, 0.02, 0.30, 0.34), 'ico_rice.png', 96)    # 稻米物品图标：一簇金穗

# ===== 橘子阶段：构图 树冠0-70% 树干55-80% 土堆75-100% =====
cut(org, (0.55, 0.68, 1.00, 1.00), 'crop_orange_s0.png')  # 土堆+小芽
s1 = org.crop((int(0.20 * org.width), int(0.50 * org.height), int(0.80 * org.width), org.height))
save(deorange(s1), 'crop_orange_s1.png')                   # 幼树（树干+树冠+青果）
save(deorange(org), 'crop_orange_s2.png')                  # 满树冠青果（未熟）
save(org, 'crop_orange.png')                               # 成熟挂果全图
cut(org, (0.52, 0.30, 0.72, 0.50), 'ico_orange.png', 96)   # 橘子物品图标：单个果子
