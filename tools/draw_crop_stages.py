# 仿照农作物LOGO风格，纯PIL手绘生长阶段贴图 + 物品图标 → www/img/
# 水稻: s0土堆小芽 s1幼苗 s2抽青穗 (s3成熟沿用照片)   橘子: s0发芽 s1幼树 s2满树青果
import math, random, os
from PIL import Image, ImageDraw

SS = 3          # 3倍超采样抗锯齿
SZ = 256 * SS
OUT = r'F:\xy\xyxnyz\www\img'
os.makedirs(OUT, exist_ok=True)

def canvas():
    im = Image.new('RGBA', (SZ, SZ), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)

def bez(p0, p1, p2, t):
    return ((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
            (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])

def leaf_blade(d, p0, p1, p2, w0, fill, edge=None, mid=None, steps=24):
    """弯曲叶刃：沿贝塞尔主脉，宽从w0渐缩至0"""
    L, R, spine = [], [], []
    for i in range(steps + 1):
        t = i / steps
        x, y = bez(p0, p1, p2, t)
        spine.append((x, y))
        x2, y2 = bez(p0, p1, p2, min(1, t + 0.02))
        dx, dy = x2 - x, y2 - y
        ln = math.hypot(dx, dy) or 1
        nx, ny = -dy / ln, dx / ln
        w = w0 * (1 - t) ** 0.85
        L.append((x + nx * w, y + ny * w))
        R.append((x - nx * w, y - ny * w))
    d.polygon(L + R[::-1], fill=fill, outline=edge)
    if mid:
        d.line(spine, fill=mid, width=max(2, int(w0 * 0.35)))

def soil(d, cx, cy, rx, ry, seed=0):
    """土堆：底形 + 随机土块颗粒 + 零星小草"""
    rnd = random.Random(seed)
    d.ellipse([cx - rx, cy - ry * 0.72, cx + rx, cy + ry], fill=(101, 67, 33, 255))
    for _ in range(90):
        x = cx + rnd.uniform(-rx, rx) * 0.92
        y = cy + rnd.uniform(-ry * 0.6, ry * 0.8)
        if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1:
            continue
        s = rnd.uniform(4, 12) * SS
        col = rnd.choice([(80, 52, 26), (120, 80, 40), (140, 95, 50),
                          (90, 58, 30), (110, 74, 38), (150, 105, 58)])
        d.ellipse([x - s, y - s * 0.68, x + s, y + s * 0.68], fill=col)
    # 上缘阴影线
    d.arc([cx - rx, cy - ry * 0.72, cx + rx, cy + ry], 200, 340,
          fill=(62, 39, 19, 255), width=3 * SS)
    return rnd

def tuft(d, x, y, s, col=(92, 155, 60, 255)):
    """小草丛"""
    for a in (-0.45, 0.0, 0.45):
        leaf_blade(d, (x, y), (x + math.sin(a) * s * 0.35, y - s * 0.6),
                   (x + math.sin(a) * s * 0.95, y - s), s * 0.14, col)

def shoot(d, x, y, h, bend, col=(124, 179, 66, 255), w=7 * SS):
    """小嫩芽"""
    leaf_blade(d, (x, y), (x + bend * 0.4, y - h * 0.6), (x + bend, y - h),
               w, col, mid=(85, 138, 50, 255))

def rice_ear(d, x, y, ln, droop, gold=False, n=8):
    """稻穗：弓形茎 + 下垂谷粒。gold=False为青穗"""
    tip = (x + droop, y - ln * 0.35)
    ctrl = (x + droop * 0.25, y - ln * 1.0)
    spine = [bez((x, y), ctrl, tip, i / 16) for i in range(17)]
    d.line(spine, fill=(139, 110, 60, 255), width=max(2, int(3.2 * SS)))
    gcol = [(255, 213, 79, 255), (251, 192, 45, 255)] if gold else \
           [(139, 195, 74, 255), (124, 179, 66, 255)]
    ged = (249, 168, 37, 255) if gold else (104, 159, 56, 255)
    for i in range(n):
        t = 0.35 + 0.65 * i / max(1, n - 1)
        px, py = bez((x, y), ctrl, tip, t)
        # 谷粒沿穗两侧下垂
        for side in (-1, 1):
            if side < 0 and i % 2 == 0 and i < n - 1:
                continue
            off = 6 * SS * side
            s = (11 - t * 3) * SS
            gy = py + 5 * SS + abs(off) * 0.4
            c = gcol[i % 2] if not gold else gcol[(i + (0 if side > 0 else 1)) % 2]
            d.ellipse([px + off - s * 0.62, gy - s, px + off + s * 0.62, gy + s],
                      fill=c, outline=ged)

def trunk(d, x0, y0, x1, y1, w0, w1, bend=0, steps=16):
    """树干：弯曲渐细多边形 + 亮部"""
    ctrl = ((x0 + x1) / 2 + bend, (y0 + y1) / 2)
    L, R, spine = [], [], []
    for i in range(steps + 1):
        t = i / steps
        x, y = bez((x0, y0), ctrl, (x1, y1), t)
        spine.append((x, y))
        x2, y2 = bez((x0, y0), ctrl, (x1, y1), min(1, t + 0.02))
        dx, dy = x2 - x, y2 - y
        ln = math.hypot(dx, dy) or 1
        nx, ny = -dy / ln, dx / ln
        w = w0 + (w1 - w0) * t
        L.append((x + nx * w / 2, y + ny * w / 2))
        R.append((x - nx * w / 2, y - ny * w / 2))
    d.polygon(L + R[::-1], fill=(109, 76, 42, 255), outline=(74, 50, 26, 255))
    d.line(spine, fill=(141, 102, 58, 255), width=max(2, int(w1 * 0.35)))

def canopy(d, cx, cy, rx, ry, seed=1, n=34):
    """树冠：多层绿叶块 + 亮部"""
    rnd = random.Random(seed)
    greens = [(46, 125, 50), (56, 142, 60), (67, 160, 71), (76, 175, 80)]
    for _ in range(n):
        x = cx + rnd.uniform(-rx, rx) * 0.9
        y = cy + rnd.uniform(-ry, ry) * 0.9
        if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1:
            continue
        s = rnd.uniform(0.26, 0.42) * rx
        d.ellipse([x - s, y - s * 0.72, x + s, y + s * 0.72],
                  fill=rnd.choice(greens) + (255,))
    for _ in range(int(n * 0.35)):  # 亮部小叶
        x = cx + rnd.uniform(-rx, rx) * 0.7
        y = cy + rnd.uniform(-ry, 0) * 0.8
        if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 > 1:
            continue
        s = rnd.uniform(0.14, 0.24) * rx
        d.ellipse([x - s, y - s * 0.7, x + s, y + s * 0.7], fill=(129, 199, 132, 255))

def fruit(d, x, y, r, green=False):
    """果实：圆+描边+高光+蒂"""
    col, edge = ((124, 168, 80, 255), (85, 120, 55, 255)) if green else \
                ((245, 124, 0, 255), (191, 90, 0, 255))
    d.ellipse([x - r, y - r, x + r, y + r], fill=col, outline=edge,
              width=max(2, int(r * 0.14)))
    d.ellipse([x - r * 0.55, y - r * 0.62, x - r * 0.02, y - r * 0.14],
              fill=(255, 255, 255, 70))
    d.line([(x, y - r), (x + r * 0.18, y - r * 1.3)],
           fill=(90, 60, 30, 255), width=max(2, int(r * 0.16)))

def finish(im, name, mx=256):
    im = im.resize((mx, mx), Image.LANCZOS)
    im.save(os.path.join(OUT, name))
    print(name, im.size)

# ================= 水稻 =================
def rice_s0():  # 土堆 + 3棵小芽
    im, d = canvas()
    soil(d, 128 * SS, 218 * SS, 100 * SS, 34 * SS, seed=7)
    tuft(d, 62 * SS, 216 * SS, 16 * SS)
    tuft(d, 196 * SS, 214 * SS, 15 * SS)
    shoot(d, 118 * SS, 214 * SS, 42 * SS, -6 * SS)
    shoot(d, 132 * SS, 216 * SS, 34 * SS, 8 * SS)
    shoot(d, 126 * SS, 215 * SS, 26 * SS, -14 * SS, col=(139, 190, 80, 255))
    return im

def rice_s1():  # 幼苗：7片叶
    im, d = canvas()
    soil(d, 128 * SS, 220 * SS, 96 * SS, 32 * SS, seed=8)
    tuft(d, 60 * SS, 218 * SS, 15 * SS)
    tuft(d, 200 * SS, 218 * SS, 14 * SS)
    bx, by = 128 * SS, 214 * SS
    for bend, h, c in [(-78, 108, (102, 168, 60)), (-50, 132, (118, 178, 68)),
                       (-22, 150, (129, 199, 90)), (8, 158, (102, 168, 60)),
                       (36, 140, (118, 178, 68)), (66, 116, (129, 199, 90)),
                       (90, 96, (102, 168, 60))]:
        leaf_blade(d, (bx, by), (bx + bend * 0.35 * SS, by - h * 0.62 * SS),
                   (bx + bend * SS, by - h * SS), 10 * SS, c + (255,),
                   mid=(70, 120, 45, 255))
    return im

def rice_s2():  # 长高 + 3支青穗
    im, d = canvas()
    soil(d, 128 * SS, 224 * SS, 92 * SS, 30 * SS, seed=9)
    tuft(d, 62 * SS, 222 * SS, 14 * SS)
    tuft(d, 198 * SS, 222 * SS, 13 * SS)
    bx, by = 128 * SS, 218 * SS
    for bend, h, c in [(-86, 150, (102, 168, 60)), (-56, 178, (118, 178, 68)),
                       (-24, 196, (129, 199, 90)), (14, 202, (102, 168, 60)),
                       (46, 180, (118, 178, 68)), (78, 152, (129, 199, 90)),
                       (100, 126, (102, 168, 60))]:
        leaf_blade(d, (bx, by), (bx + bend * 0.35 * SS, by - h * 0.62 * SS),
                   (bx + bend * SS, by - h * SS), 10 * SS, c + (255,),
                   mid=(70, 120, 45, 255))
    rice_ear(d, bx - 10 * SS, by - 128 * SS, 62 * SS, 52 * SS)
    rice_ear(d, bx + 14 * SS, by - 148 * SS, 70 * SS, 64 * SS)
    rice_ear(d, bx + 40 * SS, by - 118 * SS, 56 * SS, 60 * SS)
    return im

def rice_s3():  # 成熟：满株 + 5支金穗
    im, d = canvas()
    soil(d, 128 * SS, 226 * SS, 96 * SS, 30 * SS, seed=10)
    tuft(d, 60 * SS, 224 * SS, 14 * SS)
    tuft(d, 200 * SS, 224 * SS, 13 * SS)
    tuft(d, 128 * SS, 226 * SS, 12 * SS)
    bx, by = 128 * SS, 220 * SS
    for bend, h, c in [(-92, 140, (102, 168, 60)), (-64, 172, (118, 178, 68)),
                       (-34, 190, (129, 199, 90)), (0, 198, (102, 168, 60)),
                       (28, 192, (118, 178, 68)), (56, 176, (129, 199, 90)),
                       (84, 150, (102, 168, 60)), (102, 120, (118, 178, 68))]:
        leaf_blade(d, (bx, by), (bx + bend * 0.35 * SS, by - h * 0.62 * SS),
                   (bx + bend * SS, by - h * SS), 10 * SS, c + (255,),
                   mid=(70, 120, 45, 255))
    rice_ear(d, bx - 44 * SS, by - 122 * SS, 66 * SS, 46 * SS, gold=True)
    rice_ear(d, bx - 16 * SS, by - 150 * SS, 74 * SS, 54 * SS, gold=True)
    rice_ear(d, bx + 12 * SS, by - 162 * SS, 78 * SS, 62 * SS, gold=True)
    rice_ear(d, bx + 40 * SS, by - 142 * SS, 72 * SS, 66 * SS, gold=True)
    rice_ear(d, bx + 62 * SS, by - 112 * SS, 60 * SS, 58 * SS, gold=True)
    return im

# ================= 橘子 =================
def orange_s0():  # 土堆 + 两片小叶
    im, d = canvas()
    soil(d, 128 * SS, 220 * SS, 100 * SS, 33 * SS, seed=11)
    tuft(d, 64 * SS, 218 * SS, 15 * SS)
    tuft(d, 194 * SS, 218 * SS, 14 * SS)
    trunk(d, 126 * SS, 214 * SS, 127 * SS, 176 * SS, 7 * SS, 3 * SS, bend=3 * SS)
    leaf_blade(d, (127 * SS, 178 * SS), (110 * SS, 166 * SS), (100 * SS, 170 * SS),
               11 * SS, (102, 168, 60, 255), mid=(70, 120, 45, 255))
    leaf_blade(d, (127 * SS, 176 * SS), (146 * SS, 162 * SS), (156 * SS, 166 * SS),
               11 * SS, (118, 182, 70, 255), mid=(70, 120, 45, 255))
    return im

def orange_s1():  # 幼树：细干+小树冠+2青果
    im, d = canvas()
    soil(d, 128 * SS, 226 * SS, 94 * SS, 30 * SS, seed=12)
    tuft(d, 64 * SS, 224 * SS, 14 * SS)
    tuft(d, 196 * SS, 224 * SS, 13 * SS)
    trunk(d, 126 * SS, 222 * SS, 122 * SS, 118 * SS, 16 * SS, 8 * SS, bend=8 * SS)
    trunk(d, 123 * SS, 160 * SS, 92 * SS, 122 * SS, 7 * SS, 4 * SS)
    trunk(d, 124 * SS, 150 * SS, 160 * SS, 112 * SS, 7 * SS, 4 * SS)
    canopy(d, 126 * SS, 104 * SS, 74 * SS, 52 * SS, seed=3, n=30)
    fruit(d, 102 * SS, 116 * SS, 13 * SS, green=True)
    fruit(d, 154 * SS, 96 * SS, 12 * SS, green=True)
    return im

def orange_s2():  # 满树冠青果
    im, d = canvas()
    soil(d, 128 * SS, 230 * SS, 92 * SS, 28 * SS, seed=13)
    tuft(d, 66 * SS, 228 * SS, 13 * SS)
    tuft(d, 194 * SS, 228 * SS, 12 * SS)
    trunk(d, 124 * SS, 228 * SS, 120 * SS, 120 * SS, 22 * SS, 11 * SS, bend=9 * SS)
    trunk(d, 121 * SS, 160 * SS, 84 * SS, 110 * SS, 9 * SS, 5 * SS)
    trunk(d, 122 * SS, 150 * SS, 168 * SS, 100 * SS, 9 * SS, 5 * SS)
    canopy(d, 126 * SS, 92 * SS, 100 * SS, 66 * SS, seed=4, n=44)
    fruit(d, 84 * SS, 104 * SS, 15 * SS, green=True)
    fruit(d, 128 * SS, 72 * SS, 16 * SS, green=True)
    fruit(d, 168 * SS, 110 * SS, 15 * SS, green=True)
    fruit(d, 150 * SS, 140 * SS, 13 * SS, green=True)
    return im

def orange_s3():  # 成熟：大树冠挂满橙果
    im, d = canvas()
    soil(d, 128 * SS, 232 * SS, 96 * SS, 28 * SS, seed=14)
    tuft(d, 60 * SS, 230 * SS, 14 * SS)
    tuft(d, 200 * SS, 230 * SS, 13 * SS)
    tuft(d, 130 * SS, 232 * SS, 11 * SS)
    trunk(d, 124 * SS, 230 * SS, 118 * SS, 116 * SS, 26 * SS, 12 * SS, bend=10 * SS)
    trunk(d, 120 * SS, 158 * SS, 78 * SS, 102 * SS, 10 * SS, 5 * SS)
    trunk(d, 120 * SS, 148 * SS, 176 * SS, 96 * SS, 10 * SS, 5 * SS)
    canopy(d, 126 * SS, 84 * SS, 106 * SS, 70 * SS, seed=5, n=52)
    fruit(d, 74 * SS, 96 * SS, 17 * SS)
    fruit(d, 120 * SS, 60 * SS, 18 * SS)
    fruit(d, 178 * SS, 92 * SS, 17 * SS)
    fruit(d, 100 * SS, 130 * SS, 16 * SS)
    fruit(d, 156 * SS, 138 * SS, 16 * SS)
    fruit(d, 130 * SS, 108 * SS, 15 * SS)
    return im

# ================= 物品图标 =================
def ico_rice():  # 一簇金穗 + 叶
    im, d = canvas()
    leaf_blade(d, (100 * SS, 236 * SS), (88 * SS, 150 * SS), (74 * SS, 96 * SS),
               12 * SS, (118, 178, 68, 255), mid=(70, 120, 45, 255))
    leaf_blade(d, (104 * SS, 236 * SS), (130 * SS, 170 * SS), (148 * SS, 128 * SS),
               11 * SS, (102, 168, 60, 255), mid=(70, 120, 45, 255))
    rice_ear(d, 100 * SS, 240 * SS, 150 * SS, 86 * SS, gold=True, n=9)
    rice_ear(d, 116 * SS, 238 * SS, 130 * SS, 100 * SS, gold=True, n=8)
    return im

def ico_orange():  # 单果 + 叶
    im, d = canvas()
    leaf_blade(d, (128 * SS, 78 * SS), (150 * SS, 44 * SS), (182 * SS, 40 * SS),
               14 * SS, (118, 182, 70, 255), mid=(70, 120, 45, 255))
    fruit(d, 122 * SS, 152 * SS, 62 * SS)
    d.line([(126 * SS, 90 * SS), (128 * SS, 78 * SS)], fill=(90, 60, 30, 255),
           width=5 * SS)
    return im

finish(rice_s0(), 'crop_rice_s0.png')
finish(rice_s1(), 'crop_rice_s1.png')
finish(rice_s2(), 'crop_rice_s2.png')
finish(orange_s0(), 'crop_orange_s0.png')
finish(orange_s1(), 'crop_orange_s1.png')
finish(orange_s2(), 'crop_orange_s2.png')
finish(rice_s3(), 'crop_rice.png')        # 成熟也改手绘
finish(orange_s3(), 'crop_orange.png')
finish(ico_rice(), 'ico_rice.png', 96)
finish(ico_orange(), 'ico_orange.png', 96)
