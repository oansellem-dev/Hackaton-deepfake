"""Fabrique une vidéo Y4M servant de fausse caméra à Chrome (--use-file-for-fake-video-capture).

Usage : python make_video.py <visage.jpg> <sortie.y4m> [--hand main.jpg] [--mode precheck|live|static] [--preview dossier]

Modes (vidéo jouée en boucle, 15 i/s) :
- precheck : 3 s de face (cadrage), puis tête tournée et main devant le visage, deux fois chacune ;
- live     : gestes plus rapprochés (la main revient toutes les ~6 s), pour les défis en direct ;
- static   : visage de face immobile, sans aucun geste (cas « défi non exécuté »).
La rotation est simulée par une déformation cylindrique de l'image ; la main est une photo collée par-dessus.
"""
import argparse
import math

import cv2
import numpy as np

W, H, FPS = 640, 480, 15

parser = argparse.ArgumentParser()
parser.add_argument("face")
parser.add_argument("out")
parser.add_argument("--hand")
parser.add_argument("--mode", choices=["precheck", "live", "static"], default="precheck")
parser.add_argument("--preview")
args = parser.parse_args()

src = cv2.imread(args.face)
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
    phi = np.clip(np.arcsin(np.clip(u, -1, 1)) - theta, -math.pi / 2, math.pi / 2)
    src_x = np.where(inside, cx + R * np.sin(phi), xs)
    # Le côté qui se rapproche grossit un peu, l'autre rapetisse (perspective).
    depth = np.where(inside, np.cos(phi) - np.cos(np.arcsin(np.clip(u, -1, 1))), 0)
    yscale = 1 + 0.08 * depth
    map_x = np.tile(src_x, (H, 1)).astype(np.float32)
    ys = np.arange(H, dtype=np.float32)[:, None]
    map_y = (cy + (ys - cy) / yscale[None, :]).astype(np.float32)
    return cv2.remap(img, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)


hand = None
if args.hand:
    hand_img = cv2.imread(args.hand)
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


def ramp(n):
    return [i / (n - 1) for i in range(n)]


def turn(side):
    return ([turned(base, side * 32 * t) for t in ramp(8)] + [turned(base, side * 32)] * 15
            + [turned(base, side * 32 * (1 - t)) for t in ramp(8)])


def hand_pass():
    if hand is None:
        return []
    return [with_hand(base, t) for t in ramp(8)] + [with_hand(base, 1)] * 15 + [with_hand(base, 1 - t) for t in ramp(8)]


if args.mode == "static":
    frames = [base] * 45
elif args.mode == "live":
    frames = [base] * 20 + hand_pass() + [base] * 10 + turn(1) + [base] * 20 + hand_pass() + [base] * 10 + turn(-1)
else:
    frames = ([base] * 45 + turn(1) + [base] * 10 + hand_pass() + [base] * 10 + turn(-1) + [base] * 10
              + hand_pass() + [base] * 10)

with open(args.out, "wb") as f:
    f.write(f"YUV4MPEG2 W{W} H{H} F{FPS}:1 Ip A1:1 C420jpeg\n".encode())
    for fr in frames:
        f.write(b"FRAME\n")
        f.write(cv2.cvtColor(fr, cv2.COLOR_BGR2YUV_I420).tobytes())

if args.preview:
    for name, idx in [("face", 10), ("milieu", len(frames) // 2), ("fin", len(frames) - 20)]:
        cv2.imwrite(f"{args.preview}/{name}.jpg", frames[idx])
print(f"{args.out} : {len(frames)} images ({len(frames) / FPS:.1f} s, mode {args.mode}), visage {face_w:.0f}x{face_h:.0f} px")
