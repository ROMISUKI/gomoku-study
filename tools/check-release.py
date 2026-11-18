import zipfile,json,hashlib
from pathlib import Path
root=Path(r'C:\Users\段小段\OneDrive - MSFT\文档\常规问题\gomoku-study-android')
z=zipfile.ZipFile(root/'dist/Gomoku-Study-v1.1.0-source.zip')
names=z.namelist()
print('source entries',len(names))
print('keystore?',any('keystore' in n or n.endswith('.jks') or n.endswith('password.txt') for n in names))
print('audio/video?',any(n.lower().endswith(('.wav','.mp3','.m4a','.mp4','.mov')) for n in names))
print('has system method?',any('system' in n or '内容与规则' in n for n in names))
print('apk sha',hashlib.sha256((root/'dist/Gomoku-Study-v1.1.0.apk').read_bytes()).hexdigest())
print('source sha',hashlib.sha256((root/'dist/Gomoku-Study-v1.1.0-source.zip').read_bytes()).hexdigest())
print('report',json.loads((root/'qa/apk-report.json').read_text(encoding='utf-8'))['htmlSha256'])
print('ui',json.loads((root/'qa/ui-report.json').read_text(encoding='utf-8'))['htmlSha256'])
