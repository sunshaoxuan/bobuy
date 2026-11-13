from pathlib import Path
p=Path(__file__).parent/'verify-pricing-ui.mjs';s=p.read_text(encoding='utf-8').replace("name:'撤销',exact:true","name:/撤\\s*销/").replace("name:'关闭',exact:true","name:/关\\s*闭/");p.write_text(s,encoding='utf-8')
