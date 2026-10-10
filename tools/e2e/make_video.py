"""Fabrique une vidéo Y4M servant de fausse caméra à Chrome (--use-file-for-fake-video-capture).

Usage : python make_video.py <visage.jpg> <sortie.y4m> [main.jpg] [apercu_dir]
Séquence en boucle (15 i/s) : de face, tête tournée d'un côté, de face, de l'autre côté, de face, main devant le visage.
La rotation est simulée par une déformation cylindrique de l'image ; la main est une photo collée par-dessus.
"""
import math
import sys

import cv2
import numpy as np

W, H, FPS = 640, 480, 15
face_path, out_path = sys.argv[1], sys.argv[2]
hand_path = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] != "-" else None
preview_dir = sys.argv[4] if len(sys.argv) > 4 else None

src = cv2.imread(face_path)
cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
faces = cascade.detectMultiScale(cv2.cvtColor(src, cv2.COLOR_BGR2GRAY), 1.1, 5, minSize=(60, 60))
x, y, w, h = max(faces, key=lambda f: f[2] * f[3])

# Visage centré, largeur ~38 % de l'image (l'ovale demande entre 25 % et 65 %).
scale = 0.38 * W / w
cx_src, cy_src = x + w / 2, y + h / 2
M = np.float32([[scale, 0, W / 2 - cx_src * scale], [0, scale, H / 2 - cy_src * scale]])
base = cv2.warpAffine(src, M, (W, H), borderMode=cv2.BORDER_REPLICATE)
face_w, face_h = w * scale, h * scale
cx, cy = W / 2, H / 2


def turned(img, theta_deg):
    """Rotation de la tête autour d'un axe vertical, approchée par un cylindre."""
    theta = math.radians(theta_deg)
    R = 0.62 * face_w
    xs = np.arange(W, dtype=np.float32)
    u = (xs - cx) / R
    inside = np.abs(u) < 1
    phi = np.arcsin(np.clip(u, -1, 1)) - theta
    src_x = np.where(inside, cx + R * np.sin(np.clip(phi, -math.pi / 2, math.pi / 2)), xs)
    # Le côté qui se rapproche grossit un peu, l'autre rapetisse (perspective).
    depth = np.where(inside, np.cos(np.clip(phi, -math.pi / 2, math.pi / 2)) - np.cos(np.arcsin(np.clip(u, -1, 1))), 0)
    yscale = 1 + 0.08 * depth
    map_x = np.tile(src_x, (H, 1)).astype(np.float32)
    ys = np.arange(H, dtype=np.float32)[:, None]
    map_y = (cy + (ys - cy) / yscale[None, :]).astype(np.float32)
    return cv2.remap(img, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


hand = None
if hand_path:
    hand_img = cv2.imread(hand_path)
    target_h = int(face_h * 1.5)
    hand = cv2.resize(hand_img, (int(hand_img.shape[1] * target_h / hand_img.shape[0]), target_h))


def with_hand(img, progress):
    """progress 0 → main sous l'image, 1 → main centrée sur le visage."""
    out = img.copy()
    hh, hw = hand.shape[:2]
    top = int(H + (cy - hh / 2 - H) * progress)
    left = int(cx - hw / 2)
    y0, y1 = max(top, 0), min(top + hh, H)
    x0, x1 = max(left, 0), min(left + hw, W)
    if y1 > y0 and x1 > x0:
        out[y0:y1, x0:x1] = hand[y0 - top:y1 - top, x0 - left:x1 - left]
    return out


frames = []
ramp = lambda n: [i / (n - 1) for i in range(n)]
frames += [base] * 45
for side in (1, -1):
    frames += [turned(base, side * 32 * t) for t in ramp(8)]
    frames += [turned(base, side * 32)] * 15
    frames += [turned(base, side * 32 * (1 - t)) for t in ramp(8)]
    frames += [base] * 10
if hand is not None:
    frames += [with_hand(base, t) for t in ramp(8)]
    frames += [with_hand(base, 1)] * 15
    frames += [with_hand(base, 1 - t) for t in ramp(8)]
    frames += [base] * 10

with open(out_path, "wb") as f:
    f.write(f"YUV4MPEG2 W{W} H{H} F{FPS}:1 Ip A1:1 C420jpeg\n".encode())
    for fr in frames:
        f.write(b"FRAME\n")
        f.write(cv2.cvtColor(fr, cv2.COLOR_BGR2YUV_I420).tobytes())

if preview_dir:
    for name, idx in [("face", 10), ("turn_a", 45 + 15), ("turn_b", 45 + 41 + 15), ("hand", len(frames) - 25)]:
        if idx < len(frames):
            cv2.imwrite(f"{preview_dir}/{name}.jpg", frames[idx])
print(f"{out_path} : {len(frames)} images ({len(frames) / FPS:.1f} s), visage {face_w:.0f}x{face_h:.0f} px")
