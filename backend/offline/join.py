"""QR join page support (GET /api/join) and terminal join info for run_offline.sh.

Never depends on reliefos.local (mDNS is unreliable on some Android phones).
Set RELIEFOS_HOST_IP to force the address if auto-detection picks the wrong one.

Register in the Flask app factory (Person 2):
    from backend.offline.join import create_blueprint
    app.register_blueprint(create_blueprint())
"""
from __future__ import annotations

import os
import re
import socket
import subprocess

PRIVATE = re.compile(r"^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)")


def _candidates():
    # UDP connect sends no packet; it only asks the OS which interface it would use.
    for target in ("10.255.255.255", "192.168.255.255", "172.31.255.255", "8.8.8.8"):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.settimeout(0.2)
            s.connect((target, 1))
            yield s.getsockname()[0]
            s.close()
        except Exception:
            pass
    for cmd in (["hostname", "-I"], ["ipconfig", "getifaddr", "en0"], ["ipconfig", "getifaddr", "en1"]):
        try:
            out = subprocess.run(cmd, capture_output=True, text=True, timeout=2).stdout
            for tok in out.split():
                yield tok
        except Exception:
            pass
    try:
        for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
            yield ip
    except Exception:
        pass


def lan_ip() -> str:
    override = os.getenv("RELIEFOS_HOST_IP", "").strip()
    if override:
        return override
    seen = [ip for ip in _candidates() if re.match(r"^\d+\.\d+\.\d+\.\d+$", ip) and not ip.startswith(("127.", "169.254."))]
    for ip in seen:
        if PRIVATE.match(ip):
            return ip
    return seen[0] if seen else "127.0.0.1"


def qr_svg(text: str):
    try:
        import qrcode
        import qrcode.image.svg
    except ImportError:
        return None
    img = qrcode.make(text, image_factory=qrcode.image.svg.SvgPathImage, box_size=10)
    return img.to_string().decode("utf-8")


def join_info(port=None) -> dict:
    port = int(port or os.getenv("PORT", "5000"))
    ip = lan_ip()
    url = f"http://{ip}:{port}"
    return {"ip": ip, "port": port, "url": url, "qr_svg": qr_svg(url)}


def create_blueprint():
    from flask import Blueprint, jsonify

    bp = Blueprint("join", __name__)

    @bp.get("/api/join")
    def join():
        return jsonify(join_info())

    return bp


def print_join(port=None) -> None:
    info = join_info(port)
    print("\n  Phones: join this laptop's Wi-Fi hotspot, then open:\n")
    print(f"      {info['url']}\n")
    if info["ip"] == "127.0.0.1":
        print("  [WARN] No LAN address found. Turn the hotspot on first, or set RELIEFOS_HOST_IP.\n")
    try:
        import qrcode
        qr = qrcode.QRCode(border=1)
        qr.add_data(info["url"])
        qr.make()
        qr.print_ascii(invert=True)
    except ImportError:
        print("  (pip install qrcode to print a QR code here; /api/join still works)")
    print()


if __name__ == "__main__":
    print_join()
