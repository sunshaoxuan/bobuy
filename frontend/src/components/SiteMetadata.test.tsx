import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {MemoryRouter,useNavigate} from 'react-router-dom';
import {I18nProvider} from '../i18n';
import SiteMetadata from './SiteMetadata';
import HomeBrandIntro from './HomeBrandIntro';
import {publicCanonical,SITE_TITLE} from '../seo';
function Navigation(){const go=useNavigate();return <><button onClick={()=>go('/admin/products')}>Private</button><button onClick={()=>go('/recommendations/7?node=2')}>Public issue</button></>;}
it('keeps the brand, crawlable links and home-only structured data without locale title override',async()=>{
 const view=render(<I18nProvider><MemoryRouter><SiteMetadata/><HomeBrandIntro/><Navigation/></MemoryRouter></I18nProvider>);
 await waitFor(()=>expect(document.title).toBe(SITE_TITLE));expect(screen.getByRole('heading',{name:'宝宝败 Bobuy'})).toBeInTheDocument();
 expect(JSON.parse(document.querySelector('#bobuy-home-structured-data')!.textContent!)['@graph'][0]).toMatchObject({name:'宝宝败',alternateName:'Bobuy',url:'https://bobuy.cc/'});
 expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href','https://bobuy.cc/');
 fireEvent.click(screen.getByRole('button',{name:'Private'}));await waitFor(()=>expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content','noindex,nofollow'));
 expect(document.querySelector('link[rel="canonical"]')).toBeNull();expect(document.querySelector('#bobuy-home-structured-data')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Public issue'}));await waitFor(()=>expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute('href','https://bobuy.cc/recommendations/7'));
 expect(document.querySelector('#bobuy-home-structured-data')).toBeNull();view.unmount();expect(document.querySelector('[data-bobuy-seo]')).toBeNull();
});
it('does not index account, test, unknown or malformed recommendation routes',()=>{for(const path of ['/account','/login','/admin','/client/orders','/test','/recommendations/nope','/recommendations/0'])expect(publicCanonical(path)).toBeUndefined();});
