from pathlib import Path
import shutil
e=Path(__file__).parent;old=e/'first-layout-failure';old.mkdir(exist_ok=True)
for n in ['browser.json','glyphs.json','home-320.png','home-320-logo.png','admin-320.png','admin-320-logo.png']:
 if (e/'local'/n).exists():shutil.copy2(e/'local'/n,old/n)
p=e/'browser.mjs';s=p.read_text(encoding='utf-8').replace('for(const width of [1440,320])',"for(const width of (process.argv.includes('--mobile')?[320]:[1440,320]))")
s=s.replace("fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({base,views},null,2));", "const previous=process.argv.includes('--mobile')&&fs.existsSync(path.join(out,'browser.json'))?JSON.parse(fs.readFileSync(path.join(out,'browser.json'),'utf8')).views.filter(v=>v.width===1440&&!views.some(n=>n.name===v.name)):[];fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({base,views:[...previous,...views]},null,2));")
s=s.replace("if(!live)for(const locale", "if(!live)for(const locale")
s=s.replace("await ctx.page.close();}\n}","await ctx.page.close();}\n}")
# Add the longest localized name at the narrow viewport without repeating other states.
s=s.replace("}finally{secret=null;", "if(!live){const ctx=await pageFor(320,true,'ja-JP');await ctx.page.goto(base+'/admin/basic-data/currencies');await capture(ctx,'admin-ja-320','.merchant-mobile-brand .brand-lockup');const gap=await ctx.page.locator('.merchant-header').evaluate(el=>el.querySelector('.merchant-header-tools').getBoundingClientRect().left-el.querySelector('.merchant-mobile-brand').getBoundingClientRect().right);if(gap<6)throw Error('Longest localized logo overlaps tools');await ctx.page.close();}}finally{secret=null;")
p.write_text(s,encoding='utf-8')
