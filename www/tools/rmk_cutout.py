# 扣白底：把jpg近白背景转透明，边缘反混合去白边，裁掉透明边，输出png
# 用法: python tools/rmk_cutout.py 输入.jpg 输出.png
import sys
from PIL import Image, ImageEnhance

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
w, h = im.size
px = im.load()
out = Image.new('RGBA', (w, h))
po = out.load()
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        v = min(r, g, b)          # 最暗通道：白底接近255，深色图案远低于此
        if v >= 245:
            po[x, y] = (0, 0, 0, 0)
            continue
        a = 255 if v <= 225 else int((245 - v) * 255 / 20)
        if a < 255:                # 半透明边缘：按“前景*a+白底*(1-a)”反解前景色，去白边
            t = (255 - a) / 255
            r = max(0, min(255, int((r - 255 * t) * 255 / a)))
            g = max(0, min(255, int((g - 255 * t) * 255 / a)))
            b = max(0, min(255, int((b - 255 * t) * 255 / a)))
        po[x, y] = (r, g, b, a)
bbox = out.getbbox()               # 裁掉四周透明边
if bbox:
    out = out.crop(bbox)
# 优化观感：提饱和/对比/锐化（只在RGB上做，保留alpha）
alpha = out.getchannel('A')
rgb = out.convert('RGB')
rgb = ImageEnhance.Color(rgb).enhance(1.18)
rgb = ImageEnhance.Contrast(rgb).enhance(1.1)
rgb = ImageEnhance.Sharpness(rgb).enhance(1.6)
out = rgb.convert('RGBA')
out.putalpha(alpha)
out.save(dst)
print('OK', dst, out.size)
