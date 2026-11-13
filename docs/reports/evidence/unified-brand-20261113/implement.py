from pathlib import Path
r=Path(__file__).resolve().parents[4]
def edit(p,a,b):
 f=r/p;s=f.read_text(encoding='utf-8');assert a in s,(p,a[:60]);f.write_text(s.replace(a,b),encoding='utf-8')
edit('frontend/src/components/StoreNavigation.tsx',"import {Drawer} from 'antd';","import {Drawer} from 'antd';\nimport BrandLogo from './BrandLogo';")
edit('frontend/src/components/StoreNavigation.tsx','<span className="browse-brand-mark">B</span><span className="browse-brand-label"><strong>{t(\'app.brand\')}</strong><span className="browse-brand-domain">bobuy.cc</span></span>','<BrandLogo/>')
edit('frontend/src/pages/Storefront.tsx',"import SiteMetadata", "import SiteMetadata") if False else None
f=r/'frontend/src/pages/Storefront.tsx';s=f.read_text(encoding='utf-8');s="import BrandLogo from '../components/BrandLogo';\n"+s;s=s.replace('<strong>{t(\'app.brand\')}</strong><span className="browse-brand-domain">bobuy.cc</span>','<BrandLogo compact/>');f.write_text(s,encoding='utf-8')
f=r/'frontend/src/App.tsx';s=f.read_text(encoding='utf-8');s="import BrandLogo from './components/BrandLogo';\n"+s;s=s.replace('<span className="brand-symbol">B<span /></span><strong>{t(\'app.brand\')}</strong>','<BrandLogo/>').replace('<b className="merchant-mobile-brand">{t(\'app.brand\')}</b>','<Link className="merchant-mobile-brand" to="/admin"><BrandLogo compact/></Link>');f.write_text(s,encoding='utf-8')
f=r/'frontend/src/pages/LoginPage.tsx';s=f.read_text(encoding='utf-8');s="import BrandLogo from '../components/BrandLogo';\n"+s;s=s.replace('<span className="brand-symbol">B<span /></span><strong>{t(\'app.brand\')}</strong>','<BrandLogo/>');f.write_text(s,encoding='utf-8')
f=r/'frontend/src/browse.css';lines=f.read_text(encoding='utf-8').splitlines();lines=[s for s in lines if not any(s.startswith(p) for p in ['.browse-brand strong','.browse-brand-label {','.browse-brand-domain {','.browse-mobile-brand strong {','.browse-mobile-brand .browse-brand-domain {'])];f.write_text('\n'.join(lines)+'\n',encoding='utf-8')
f=r/'frontend/src/merchant.css';s=f.read_text(encoding='utf-8');import re
s=re.sub(r'\.brand-symbol(?:>span)?\s*\{[^}]*\}\s*','',s);s=re.sub(r'\.merchant-brand strong\s*\{[^}]*\}','',s);s=s.replace('.merchant-drawer  }',' }')
# The contextual selector prefix must be removed with the retired rule.
s=s.replace('.merchant-drawer  }',' }');s=s.replace('.merchant-brand{padding-inline:10px}','.merchant-brand{padding-inline:10px}');f.write_text(s,encoding='utf-8')
