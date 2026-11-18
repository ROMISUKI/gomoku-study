"""Package only checked deliverables; never include signing credentials."""
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def sha(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    qa, dist = ROOT / "qa", ROOT / "dist"
    apk_report = json.loads((qa / "apk-report.json").read_text(encoding="utf-8"))
    ui_report = json.loads((qa / "ui-report.json").read_text(encoding="utf-8"))
    assert apk_report["ok"] and ui_report["ok"]
    assert apk_report["htmlSha256"] == ui_report["htmlSha256"], "UI checks not bound to APK content"
    apk = dist / "Gomoku-Study-v1.1.0.apk"
    assert sha(apk) == apk_report["apkSha256"]
    assert (qa / "验收报告.md").exists()
    expected = qa / "release-source.html"
    subprocess.run(["node.exe", str(ROOT / "tools/build-html.cjs"), str(ROOT / "web"), str(expected)], check=True)
    assert sha(expected) == apk_report["htmlSha256"], "Source changed after APK build"
    info = json.loads((dist / "build-info-v1.1.0.json").read_text(encoding="utf-8-sig"))
    stage = Path(info["stage"]) / "src/app"
    for file in (ROOT / "app").rglob("*"):
        if file.is_file():
            assert file.read_bytes() == (stage / file.relative_to(ROOT / "app")).read_bytes(), "Native source changed after build"
    files = []
    for directory in ["app", "web", "tools", "docs"]:
        files += [f for f in (ROOT / directory).rglob("*") if f.is_file() and "__pycache__" not in f.parts]
    files += [ROOT / f for f in ["README.md", "修改记录.md", "build-apk.ps1", ".gitignore"]]
    files += [qa / f for f in ["验收报告.md", "logic-tests.txt", "apk-report.json", "ui-report.json", "course-390.png", "light-390.png", "opening-390.png", "gong-390.png", "dark-large-390.png", "about-dark.png"]]
    archive = dist / "Gomoku-Study-v1.1.0-source.zip"
    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for f in sorted(files):
            relative = f.relative_to(ROOT)
            assert "keystore" not in relative.parts and f.name != "password.txt"
            z.write(f, str(Path("gomoku-study-android") / relative))
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        assert not any("/keystore/" in n or n.endswith(".jks") or n.endswith("password.txt") for n in z.namelist())
        assert z.read("gomoku-study-android/web/core.js") == (ROOT / "web/core.js").read_bytes()
    deliverables = [apk, dist / "五子棋研习-v1.1.0.apk", archive]
    manifest = {"version": "1.1.0", "htmlSha256": apk_report["htmlSha256"], "androidDeviceRun": False,
                "files": [{"name": f.name, "bytes": f.stat().st_size, "sha256": sha(f)} for f in deliverables]}
    (dist / "交付清单.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    (dist / "SHA256SUMS.txt").write_text("\n".join(sha(f) + "  " + f.name for f in deliverables) + "\n", encoding="utf-8")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
