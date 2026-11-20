"""ffmpeg montage (local, free). Vertical video 1080x1920 from images/clips + optional voice + on-screen text,
with a burned-in AI disclosure. Images normalised to 1080x1350 (Instagram 4:5) or 1080x1920."""
from __future__ import annotations

import shutil
import subprocess
import tempfile
import textwrap
from pathlib import Path

FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    "/Library/Fonts/Arial Bold.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]
DISCLOSURE = "Image virtuelle · générée par IA"


class MediaError(RuntimeError):
    pass


def available() -> bool:
    return shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


def _font() -> str:
    for f in FONT_CANDIDATES:
        if Path(f).is_file():
            return f":fontfile='{f}'"
    return ""


def _run(args: list[str]) -> None:
    p = subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y", *args],
                       capture_output=True, text=True, timeout=600, stdin=subprocess.DEVNULL)
    if p.returncode != 0:
        raise MediaError(p.stderr.strip()[-800:])


def duration(path: Path) -> float:
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
                       capture_output=True, text=True, timeout=60)
    try:
        return float(p.stdout.strip())
    except ValueError as e:
        raise MediaError(f"ffprobe failed: {p.stderr[-200:]}") from e


def _textfile(tmp: Path, name: str, text: str) -> str:
    f = tmp / name
    f.write_text(text, encoding="utf-8")
    return str(f).replace("\\", "/").replace(":", "\\:")


def _overlay_disclosure(tmp: Path, label: str = DISCLOSURE) -> str:
    return (f"drawtext=textfile='{_textfile(tmp, 'disc.txt', label)}'{_font()}:fontsize=30:fontcolor=white:"
            "box=1:boxcolor=black@0.45:boxborderw=10:x=30:y=h-th-40")


def placeholder_image(out: Path, label: str, w: int = 1080, h: int = 1920, color: str = "0xC8643B") -> None:
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        txt = f"drawtext=textfile='{_textfile(tmp, 'ph.txt', label)}'{_font()}:fontsize=54:fontcolor=white:x=(w-tw)/2:y=(h-th)/2"
        _run(["-f", "lavfi", "-i", f"color=c={color}:s={w}x{h}", "-frames:v", "1", "-vf", txt, str(out)])


def normalize_image(src: Path, out: Path, w: int = 1080, h: int = 1350, label: str = DISCLOSURE) -> None:
    with tempfile.TemporaryDirectory() as t:
        vf = f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},{_overlay_disclosure(Path(t), label)}"
        _run(["-i", str(src), "-frames:v", "1", "-vf", vf, str(out)])


def build_video(visuals: list[Path], out: Path, texts: list[str] | None = None, voice: Path | None = None,
                seconds_per_image: float = 4.0, fps: int = 30, label: str = DISCLOSURE) -> float:
    """Images -> slideshow with gentle zoom; a single clip -> normalised. Returns output duration (s)."""
    if not visuals:
        raise MediaError("no visual")
    texts = texts or []
    images = [v for v in visuals if v.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")]
    clips = [v for v in visuals if v.suffix.lower() in (".mp4", ".mov")]
    voice_d = duration(voice) if voice else 0.0
    with tempfile.TemporaryDirectory() as t:
        tmp = Path(t)
        args: list[str] = []
        filters: list[str] = []
        if clips:
            for c in clips:
                args += ["-i", str(c)]
            for i in range(len(clips)):
                filters.append(f"[{i}:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps={fps},setsar=1[v{i}]")
            n = len(clips)
            seg_d = None
        else:
            n = len(images)
            seg_d = max(seconds_per_image, voice_d / n if voice_d else 0, 2.0)
            frames = int(seg_d * fps)
            for i, img in enumerate(images):
                args += ["-i", str(img)]  # single frame: zoompan emits `frames` frames from it
                filters.append(
                    f"[{i}:v]scale=1188:2112:force_original_aspect_ratio=increase,crop=1188:2112,"
                    f"zoompan=z='min(zoom+0.0006,1.08)':d={frames}:s=1080x1920:fps={fps},setsar=1[v{i}]")
        filters.append("".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[cat]")
        chain = "[cat]"
        draw = []
        for i, txt in enumerate(texts[: n if seg_d else 1]):
            if not txt:
                continue
            enable = f":enable='between(t,{i * seg_d:.2f},{(i + 1) * seg_d:.2f})'" if seg_d else ""
            draw.append(f"drawtext=textfile='{_textfile(tmp, f't{i}.txt', textwrap.fill(txt[:110], 22))}'{_font()}:fontsize=58:fontcolor=white:line_spacing=12:"
                        f"borderw=4:bordercolor=black:x=(w-tw)/2:y=h*0.18{enable}")
        draw.append(_overlay_disclosure(tmp, label))
        filters.append(chain + ",".join(draw) + "[outv]")
        maps = ["-map", "[outv]"]
        if voice:
            args += ["-i", str(voice)]
            maps += ["-map", f"{len(clips) or n}:a", "-shortest"]
        elif len(clips) == 1:
            maps += ["-map", "0:a?"]
        _run([*args, "-filter_complex", ";".join(filters), *maps, "-c:v", "libx264", "-preset", "veryfast",
              "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(out)])
    return duration(out)
