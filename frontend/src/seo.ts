export const SITE_URL='https://bobuy.cc';
export const SITE_NAME='宝宝败';
export const SITE_TITLE='宝宝败 Bobuy | 随行好物';
export const SITE_DESCRIPTION='宝宝败（Bobuy）独立整理日本 Costco 商品资料与优惠资讯，提供行程购物入口。浏览好物推荐与可预订行程，认准官方网站 bobuy.cc。';
export const HOME_STRUCTURED_DATA={'@context':'https://schema.org','@graph':[
 {'@type':'WebSite','@id':SITE_URL+'/#website',url:SITE_URL+'/',name:SITE_NAME,alternateName:'Bobuy',publisher:{'@id':SITE_URL+'/#organization'}},
 {'@type':'Organization','@id':SITE_URL+'/#organization',name:SITE_NAME,alternateName:'Bobuy',url:SITE_URL+'/'}
]};
export function publicCanonical(path:string):string|undefined {
 if(['/','/products','/recommendations','/trips'].includes(path)||/^\/recommendations\/[1-9]\d*$/.test(path))return SITE_URL+path;
 return undefined;
}
