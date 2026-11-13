from pathlib import Path
import shutil
e=Path(__file__).parent;old=e/'english-network-transient';old.mkdir(exist_ok=True)
for n in ['browser.json','locale-en-US.png','locale-en-US-logo.png','locale-en-US-text.png']:shutil.copy2(e/'local'/n,old/n)
p=e/'browser.mjs';s=p.read_text(encoding='utf-8').replace("process.argv.includes('--mobile')?[320]:[1440,320]","process.argv.includes('--english')?[]:process.argv.includes('--mobile')?[320]:[1440,320]")
s=s.replace("process.argv.includes('--mobile')&&fs.existsSync", "(process.argv.includes('--mobile')||process.argv.includes('--english'))&&fs.existsSync").replace("v.width===1440&&!views.some(n=>n.name===v.name)","(process.argv.includes('--english')||v.width===1440)&&!views.some(n=>n.name===v.name)")
s=s.replace("for(const locale of ['zh-TW','ja-JP','en-US'])", "for(const locale of (process.argv.includes('--english')?['en-US']:['zh-TW','ja-JP','en-US']))").replace("if(!live){const ctx=await pageFor(320,true,'ja-JP')", "if(!live&&!process.argv.includes('--english')){const ctx=await pageFor(320,true,'ja-JP')")
p.write_text(s,encoding='utf-8')
