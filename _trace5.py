# -*- coding: utf-8 -*-
# 重建 PVZ_ART：GIF/PNG 帧 -> 联合包围盒 -> 每套24色共享调色板 -> 每行RLE(色idx+33,x+33,len+33)
import os, json
from PIL import Image

A = r'F:\xy\xyxnyz\_assets'
R = r'F:\xy\xyxnyz\_ref'

SETS = {  # set名 -> 素材文件
    'sun_idle':   os.path.join(A, 'SunFlower.gif'),
    'pea_idle':   os.path.join(A, 'Peashooter.gif'),
    'pea_atk':    os.path.join(R, 'pea_atk.png'),
    'rep_idle':   os.path.join(A, 'Repeater.gif'),
    'rep_atk':    os.path.join(R, 'rep0.png'),
    'snow_idle':  os.path.join(A, 'SnowPea.gif'),
    'nut_idleH':  os.path.join(A, 'WallNut.gif'),
    'nut_idleM':  os.path.join(A, 'WallNut1.gif'),
    'nut_idleL':  os.path.join(A, 'WallNut2.gif'),
    'pota_idle':  os.path.join(A, 'PotatoMine1.gif'),
    'pota_armed': os.path.join(A, 'PotatoMine.gif'),
    'cher_idle':  os.path.join(A, 'CherryBomb.gif'),
    'chom_idle':  os.path.join(R, 'chom0.png'),
    'chom_atk':   os.path.join(R, 'chom_atk.png'),
    'chom_dig':   os.path.join(R, 'chom_dig.png'),
}
NCOL = 24
ATH = 128  # alpha阈值

def load_frames(path):
    im = Image.open(path)
    frames = []
    for i in range(getattr(im, 'n_frames', 1)):
        im.seek(i)
        frames.append(im.convert('RGBA'))
    # 去完全重复帧（保持顺序）
    out, prev = [], None
    for f in frames:
        b = f.tobytes()
        if b != prev:
            out.append(f)
        prev = b
    return out or frames[:1]

def union_bbox(frames):
    x0 = y0 = 10**9; x1 = y1 = -1
    for f in frames:
        a = f.getchannel('A')
        # alpha>=ATH 的有效区域
        mask = a.point(lambda v: 255 if v >= ATH else 0)
        bb = mask.getbbox()
        if bb:
            x0 = min(x0, bb[0]); y0 = min(y0, bb[1])
            x1 = max(x1, bb[2]); y1 = max(y1, bb[3])
    if x1 < 0:  # 全透明兜底
        f = frames[0]
        return (0, 0, f.width, f.height)
    return (x0, y0, x1, y1)

def build_set(path):
    frames = load_frames(path)
    bb = union_bbox(frames)
    crops = [f.crop(bb) for f in frames]
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    # 拼一条竖图做共享调色板（透明像素置白不参与也行——直接量化RGBA会带alpha，转RGB丢掉透明区）
    strip = Image.new('RGB', (w, h * len(crops)), (255, 255, 255))
    for i, c in enumerate(crops):
        rgb = Image.new('RGB', (w, h), (255, 255, 255))
        rgb.paste(c, (0, 0), c)  # 仅不透明区贴入
        strip.paste(rgb, (0, i * h))
    q = strip.quantize(colors=NCOL, method=Image.MEDIANCUT)
    palraw = q.getpalette()[:NCOL * 3]
    palraw = palraw + [0] * (NCOL * 3 - len(palraw))  # 实际颜色<NCOL时补位
    pal = ['rgb(%d,%d,%d)' % (palraw[i], palraw[i + 1], palraw[i + 2]) for i in range(0, NCOL * 3, 3)]
    # 用共享调色板逐帧量化
    fr_rows = []
    for c in crops:
        rgb = Image.new('RGB', (w, h), (255, 255, 255))
        rgb.paste(c, (0, 0), c)
        cq = rgb.quantize(palette=q, dither=Image.NONE)
        px = cq.load(); alpha = c.getchannel('A').load()
        rows = []
        for y in range(h):
            row = []
            x = 0
            while x < w:
                if alpha[x, y] >= ATH:
                    pi = px[x, y]; x0 = x
                    while x < w and alpha[x, y] >= ATH and px[x, y] == pi:
                        x += 1
                    row.append(chr(pi + 33) + chr(x0 + 33) + chr((x - x0) + 33))
                else:
                    x += 1
            rows.append(''.join(row))
        fr_rows.append(rows)
    return {'w': w, 'h': h, 'pal': pal, 'frames': fr_rows}

art = {}
for k, p in SETS.items():
    art[k] = build_set(p)
    print(k, art[k]['w'], 'x', art[k]['h'], 'frames=', len(art[k]['frames']))

js = 'const PVZ_ART = ' + json.dumps(art, ensure_ascii=False, separators=(',', ':')) + ';\n'
open(r'F:\xy\xyxnyz\_art.js', 'w', encoding='utf-8').write(js)
print('WROTE _art.js', len(js), 'bytes')
