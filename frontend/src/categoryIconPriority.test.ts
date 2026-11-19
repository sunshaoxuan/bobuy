import {preloadCategoryIcons,visibleCategoryIconCount} from './categoryIconPriority';
import type {BrowseFacet} from './api';
const categories:BrowseFacet[]=Array.from({length:23},(_,i)=>({id:'shop-'+i,name:{'en-US':'Category '+i},count:1,imageUrl:'/api/storefront/recommendation-images/icon-'+i}));
afterEach(()=>{document.querySelectorAll('link[data-category-icon]').forEach(e=>e.remove());vi.restoreAllMocks();});
it('preloads only the visible shortcut budget at high priority and deduplicates repeat metadata',()=>{
 vi.spyOn(window,'innerWidth','get').mockReturnValue(390);preloadCategoryIcons(categories);preloadCategoryIcons(categories);
 const links=[...document.querySelectorAll<HTMLLinkElement>('link[data-category-icon]')];expect(links).toHaveLength(2);expect(links.map(e=>e.getAttribute('href'))).toEqual(categories.slice(0,2).map(c=>c.imageUrl));
 for(const link of links){expect(link.rel).toBe('preload');expect(link.as).toBe('image');expect(link.getAttribute('fetchpriority')).toBe('high');}
 expect(visibleCategoryIconCount(1920)).toBe(20);
});
it('ignores hidden/child categories, external URLs and image URL credentials or query strings',()=>{
 vi.spyOn(window,'innerWidth','get').mockReturnValue(1920);
 preloadCategoryIcons([{...categories[0],count:0},{...categories[1],parentId:'shop-0'},{...categories[2],imageUrl:'https://external.invalid/p.png'},{...categories[3],imageUrl:'/api/storefront/recommendation-images/a?secret=bad'},categories[4]]);
 expect(document.querySelectorAll('link[data-category-icon]')).toHaveLength(0);preloadCategoryIcons([categories[4]]);expect(document.querySelector('link[data-category-icon]')?.getAttribute('href')).toBe(categories[4].imageUrl);
});
