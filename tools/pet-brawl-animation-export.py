"""Export silent 256 px battle clips from the approved idle artwork (Pillow and FFmpeg)."""
from math import cos, pi, sin
from pathlib import Path
import subprocess
import sys

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1] / "public/images/pets/animations"
OUTPUT = ROOT / "brawl-v1"
FPS = 24
FRAMES = 21
SPECIES = {
    "momota": (255, 185, 87),
    "hexiaotun": (144, 211, 91),
    "yubingmiao": (255, 162, 137),
    "paixiaoyu": (101, 207, 247),
}


def pulse(t, start, end):
    return sin(pi * (t - start) / (end - start)) if start < t < end else 0


def sprite_at(image, width, height, angle, dx, dy):
    sprite = image.resize((round(width), round(height)), Image.Resampling.LANCZOS)
    sprite = sprite.rotate(angle, Image.Resampling.BICUBIC, expand=True)
    result = Image.new("RGBA", (256, 256))
    result.alpha_composite(sprite, (round(128 + dx - sprite.width / 2), round(213 + dy - sprite.height)))
    return result


def frame(image, color, action, t):
    w, h = image.size
    if action == "attack":
        windup, leap = pulse(t, 0, .35), pulse(t, .19, .83)
        actor = sprite_at(image, w * (1 + .10 * leap), h * (1 - .13 * windup), -12 * leap + 7 * windup, 32 * leap - 10 * windup, -12 * leap)
    elif action == "hit":
        shake = pulse(t, .18, .82)
        actor = sprite_at(image, w * (1 - .12 * shake), h * (1 - .13 * shake), 14 * shake, -25 * shake, 2 * shake)
    elif action == "victory":
        jump = pulse(t, .08, .58) + .48 * pulse(t, .58, .99)
        actor = sprite_at(image, w, h * (1 + .06 * jump), -5 * jump, 0, -25 * jump)
    else:
        slump = min(1, t / .55)
        actor = sprite_at(image, w * (1 + .07 * slump), h * (1 - .21 * slump), 10 * slump, -5 * slump, 0)

    effects = Image.new("RGBA", actor.size)
    draw = ImageDraw.Draw(effects)
    if action == "attack":
        stroke = pulse(t, .23, .64)
        if stroke:
            x = 22 * (t - .23) / .41
            draw.arc((138 + x, 60, 221 + x, 169), -60, 52, (*color, round(220 * stroke)), width=7)
            draw.arc((148 + x, 68, 219 + x, 177), -55, 33, (255, 252, 231, round(228 * stroke)), width=3)
    elif action == "hit":
        burst = pulse(t, .19, .58)
        if burst:
            for index in range(5):
                angle = (index - 2) * .48
                x, y = 194 + cos(angle) * 17 * burst, 113 + sin(angle) * 28
                draw.line((x, y, x + cos(angle) * 12, y + sin(angle) * 12), fill=(*color, round(240 * burst)), width=4)
    elif action == "victory":
        for index in range(7):
            start = .08 + .035 * index
            glint = pulse(t, start, .95)
            if glint:
                x = 37 + (index * 31) % 184
                y = 111 - ((t - start) * 65) - (index % 3) * 12
                radius = 4 + index % 4
                draw.polygon([(x, y-radius), (x+2, y-2), (x+radius, y), (x+2, y+2), (x, y+radius),
                              (x-2, y+2), (x-radius, y), (x-2, y-2)], fill=(*color, round(255 * glint)))
    if action == "defeat":
        drop = pulse(t, .22, .94)
        if drop:
            y = 69 + 21 * t
            draw.polygon([(176, y-7), (171, y+3), (173, y+7), (180, y+7), (182, y+3)],
                         fill=(115, 191, 231, round(210 * drop)))
    return Image.alpha_composite(actor, effects)


def main(ffmpeg):
    for species, color in SPECIES.items():
        source = Image.open(ROOT / f"{species}-v1" / "idle.webp").convert("RGBA")
        source = source.crop(source.getbbox())
        source.thumbnail((157, 158), Image.Resampling.LANCZOS)
        folder = OUTPUT / species
        folder.mkdir(parents=True, exist_ok=True)
        for action in ("attack", "hit", "victory", "defeat"):
            frames = b"".join(frame(source, color, action, n / (FRAMES - 1)).tobytes() for n in range(FRAMES))
            subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-f", "rawvideo",
                            "-pixel_format", "rgba", "-video_size", "256x256", "-framerate", str(FPS),
                            "-i", "pipe:0", "-an", "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
                            "-crf", "36", "-b:v", "0", str(folder / f"{action}.webm")],
                           input=frames, check=True)
        # 提取出招首帧作为同尺寸静态回退，保留透明通道，避免切换家园立绘时闪大图。
        subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-c:v", "libvpx-vp9",
                        "-i", str(folder / "attack.webm"), "-frames:v", "1", "-c:v", "libwebp", "-lossless", "1",
                        str(folder / "idle.webp")], check=True)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "ffmpeg")
