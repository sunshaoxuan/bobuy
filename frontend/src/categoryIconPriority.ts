import type {BrowseFacet} from './api';

/** Match the existing 88px shortcut + 8px gap; include the partially visible entry. */
export function visibleCategoryIconCount(width:number){return Math.max(1,Math.ceil((width-(width<=767?32:64))/96));}
export function preloadCategoryIcons(categories:BrowseFacet[]){
 if(typeof document==='undefined')return;
 const visible=categories.filter(c=>c.id.startsWith('shop-')&&!c.parentId&&c.count>0).slice(0,visibleCategoryIconCount(window.innerWidth));
 preloadCategoryIconUrls(visible.map(c=>c.imageUrl??''));
}
export function preloadCategoryIconUrls(urls:string[]){
 if(typeof document==='undefined')return;
 for(const url of urls.slice(0,2)){
  if(!url||!/^\/api\/storefront\/recommendation-images\/[a-zA-Z0-9-]+$/.test(url))continue;
  if([...document.querySelectorAll<HTMLLinkElement>('link[data-category-icon]')].some(link=>link.getAttribute('href')===url))continue;
  const link=document.createElement('link');link.rel='preload';link.as='image';link.href=url;link.setAttribute('fetchpriority','high');link.dataset.categoryIcon='';document.head.appendChild(link);
  // Warm the tiny bitmap while the independent product request is in flight.
  // Neither loading nor decoding is awaited by the catalog render path.
  const image=new Image();image.fetchPriority='high';image.src=url;
  if(typeof image.decode==='function')void image.decode().catch(()=>{});
 }
}
