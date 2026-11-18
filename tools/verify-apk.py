"""Validate the actual APK and extract its exact offline page for browser testing."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SDK = Path(r"X:\OpenCodeTools\android-sdk")
BT = SDK / "build-tools/35.0.0"
JAVA = SDK / "jdk-17/bin/java.exe"


def run(*args):
    p = subprocess.run([str(a) for a in args], capture_output=True, encoding="utf-8", errors="replace", check=False)
    if p.returncode:
        raise RuntimeError(p.stdout + p.stderr)
    return p.stdout + p.stderr


def main():
    apk = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "dist/Gomoku-Study-v1.1.0.apk"
    out = ROOT / "qa/extracted"
    out.mkdir(parents=True, exist_ok=True)
    signature = run(JAVA, "-jar", BT / "lib/apksigner.jar", "verify", "--verbose", "--print-certs", apk)
    assert "Verified using v2 scheme (APK Signature Scheme v2): true" in signature
    alignment = run(BT / "zipalign.exe", "-c", "4", apk)
    badging = run(BT / "aapt2.exe", "dump", "badging", apk)
    assert "name='com.duan.gomokustudy' versionCode='2' versionName='1.1.0'" in badging
    assert "application-label:'五子棋研习'" in badging
    permissions = run(BT / "aapt2.exe", "dump", "permissions", apk)
    assert "uses-permission" not in permissions, permissions
    with zipfile.ZipFile(apk) as z:
        assert z.read("classes.dex").startswith(b"dex\n")
        assert "res/drawable/ic_launcher.xml" in z.namelist()
        html = z.read("res/raw/app.html")
        page = html.decode("utf-8")
        assert "制作 / 署名：段小段" in page
        assert "Content-Security-Policy" in page
        assert "script src=" not in page
        assert "duan.gomoku-study.v1" in page
        (out / "app.html").write_bytes(html)
    duplicate = apk.with_name("五子棋研习-v1.1.0.apk")
    assert duplicate.read_bytes() == apk.read_bytes()
    report = {
        "ok": True,
        "apk": str(apk.resolve()),
        "bytes": apk.stat().st_size,
        "apkSha256": hashlib.sha256(apk.read_bytes()).hexdigest(),
        "htmlSha256": hashlib.sha256(html).hexdigest(),
        "extractedHtml": str(out / "app.html"),
        "badging": badging,
        "permissions": permissions,
        "signature": signature,
        "alignment": alignment,
        "androidDeviceRun": False,
        "androidDeviceReason": "No authorized Android device connected; ADB list is empty.",
    }
    (ROOT / "qa/apk-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({k: report[k] for k in ["ok", "bytes", "apkSha256", "htmlSha256", "extractedHtml"]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
