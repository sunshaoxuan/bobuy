from pathlib import Path
import shutil
e=Path(__file__).parent;old=e/'second-glyph-failure';old.mkdir(exist_ok=True)
for n in ['browser.json','glyphs.json','locale-ja-JP-logo.png','locale-ja-JP-text.png','admin-ja-320-logo.png','admin-ja-320-text.png']:
 if (e/'local'/n).exists():shutil.copy2(e/'local'/n,old/n)
