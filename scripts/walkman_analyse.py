"""
Pre-analyse a YouTube track for the Walkman background visualizer.

    python scripts/walkman_analyse.py <videoId> [<videoId> ...] [--out DIR]

Pulls the audio once (yt-dlp), decodes it (ffmpeg) and writes <id>.wma: a
compact timeline of how the song moves, which the page plays back in sync
with the YouTube player. The page never touches the audio itself, so there's
no tab-sharing prompt and playback stays in the official player.

File format (little endian):
    b"WMA1"  float32 fps  uint32 frames
    then per frame: uint8 level, uint8 beat (0 / 255), 32 x uint8 bands
"""

import os
import shutil
import struct
import subprocess
import sys
import tempfile

import numpy as np

SR = 22050
FPS = 20
BANDS = 32
N_FFT = 2048
MAX_SECONDS = 15 * 60


def decode(video_id: str, tmp: str) -> np.ndarray:
    base = os.path.join(tmp, video_id)
    # YouTube hands out the odd 403 on a first try; a couple of retries clears it
    for attempt in range(3):
        done = subprocess.run(
            [
                "yt-dlp", "-q", "--no-warnings", "--no-playlist",
                "-f", "bestaudio/best",
                "--match-filter", f"!is_live & duration < {MAX_SECONDS}",
                "-o", base + ".%(ext)s",
                f"https://www.youtube.com/watch?v={video_id}",
            ],
            capture_output=True, text=True,
        )
        if done.returncode == 0:
            break
        if attempt == 2:
            raise RuntimeError((done.stderr or "yt-dlp failed").strip().splitlines()[-1])
    files = [f for f in os.listdir(tmp) if f.startswith(video_id + ".")]
    if not files:
        raise RuntimeError("no audio downloaded (live stream or too long?)")
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", os.path.join(tmp, files[0]), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype=np.float32)


def norm(x: np.ndarray, lo_p: float, hi_p: float) -> np.ndarray:
    lo, hi = np.percentile(x, lo_p), np.percentile(x, hi_p)
    return np.clip((x - lo) / max(hi - lo, 1e-6), 0, 1)


def analyse(y: np.ndarray):
    hop = SR / FPS
    n_frames = int(len(y) / hop)
    win = np.hanning(N_FFT).astype(np.float32)
    pad = np.concatenate([np.zeros(N_FFT // 2, np.float32), y, np.zeros(N_FFT, np.float32)])
    idx = (np.arange(n_frames) * hop).astype(np.int64)
    frames = np.stack([pad[i:i + N_FFT] * win for i in idx])
    mag = np.abs(np.fft.rfft(frames, axis=1))

    # 32 log-spaced bands, 32 Hz .. 11 kHz
    freqs = np.fft.rfftfreq(N_FFT, 1 / SR)
    edges = 32 * (11000 / 32) ** (np.arange(BANDS + 1) / BANDS)
    bands_db = np.zeros((n_frames, BANDS), np.float32)
    for b in range(BANDS):
        sel = (freqs >= edges[b]) & (freqs < max(edges[b + 1], edges[b] + SR / N_FFT))
        e = mag[:, sel].mean(axis=1) if sel.any() else np.zeros(n_frames)
        bands_db[:, b] = 20 * np.log10(e + 1e-7)

    # each band against its own range (every band stays lively) blended with a
    # shared range (so the bass still reads as the biggest thing in the mix)
    per_band = np.stack([norm(bands_db[:, b], 10, 99) for b in range(BANDS)], axis=1)
    shared = norm(bands_db, 15, 99.5)
    bands = np.clip(0.6 * per_band + 0.4 * shared, 0, 1) ** 1.15

    rms_db = 20 * np.log10(np.sqrt((frames ** 2).mean(axis=1)) + 1e-7)
    level = norm(rms_db, 5, 99.5) ** 1.2

    # beats: bursts of new low-end energy, peak-picked against a rolling threshold
    low = bands_db[:, :8].mean(axis=1)
    flux = np.maximum(0, np.diff(low, prepend=low[0])) + 0.25 * np.maximum(0, np.diff(bands_db.mean(axis=1), prepend=0))
    w = FPS  # 1 s window
    padded = np.pad(flux, (w, w), mode="edge")
    med = np.array([np.median(padded[i:i + 2 * w]) for i in range(n_frames)])
    thr = med * 2.0 + flux.std() * 0.9
    beat = np.zeros(n_frames, np.uint8)
    last = -999
    for i in range(1, n_frames - 1):
        if flux[i] > thr[i] and flux[i] >= flux[i - 1] and flux[i] >= flux[i + 1] and i - last >= int(0.3 * FPS):
            beat[i] = 255
            last = i
    return SR / hop, level, beat, bands


def write(path: str, fps: float, level, beat, bands):
    n = len(level)
    with open(path, "wb") as f:
        f.write(b"WMA1")
        f.write(struct.pack("<fI", fps, n))
        body = np.zeros((n, 2 + BANDS), np.uint8)
        body[:, 0] = np.round(level * 255)
        body[:, 1] = beat
        body[:, 2:] = np.round(bands * 255)
        f.write(body.tobytes())


def main():
    args = sys.argv[1:]
    out = os.path.join("public", "lab", "walkman", "analysis")
    if "--out" in args:
        i = args.index("--out")
        out = args[i + 1]
        del args[i:i + 2]
    os.makedirs(out, exist_ok=True)
    failed = 0
    for vid in args:
        if not (len(vid) == 11 and all(c.isalnum() or c in "-_" for c in vid)):
            print(f"skip {vid}: not a video id", file=sys.stderr)
            failed += 1
            continue
        tmp = tempfile.mkdtemp(prefix="wma-")
        try:
            fps, level, beat, bands = analyse(decode(vid, tmp))
            path = os.path.join(out, vid + ".wma")
            write(path, fps, level, beat, bands)
            print(f"{vid}: {len(level) / fps:.0f}s, {int((beat > 0).sum())} beats -> {path} ({os.path.getsize(path) // 1024} KB)")
        except Exception as e:  # keep going through the list
            print(f"{vid}: failed ({e})", file=sys.stderr)
            failed += 1
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    sys.exit(1 if failed and failed == len(args) else 0)


if __name__ == "__main__":
    main()
