import {readFileSync} from 'node:fs';
import postcss from 'postcss';

// Pure CSS cascade contract. jsdom matches selectors; it does not measure layout.
// JavaScript keeps this Node-only test independent of application Node typings.
const files=['product-feed.css','browse.css','recommendations.css'];
const sheets=Object.fromEntries(files.map(name=>[name,readFileSync('src/'+name,'utf8')]));
const relevant=new Set(['position','inset','left','right','top','bottom']);
function body(preview){
 const root=document.createElement('div');
 root.className=preview?'storefront browse-preview':'storefront browse-shell';
 root.innerHTML='<section class="recommendations rec-public"><div class="product-masonry rec-public-products"><article class="rec-pin"><div class="product-tile"><div class="product-body">Name</div></div></article></div></section>';
 return root.querySelector('.product-body');
}
function cascade(width,preview,order,removeFix=false){
 const element=body(preview),result={},winning=new Map();let ordinal=0;
 for(const name of order){
  const ast=postcss.parse(sheets[name]);
  ast.walkRules(rule=>{
   let active=true;
   for(let parent=rule.parent;parent;parent=parent.parent){
    if(parent.type==='atrule'&&parent.name==='media'){
     for(const match of parent.params.matchAll(/(max|min)-width\s*:\s*(\d+)px/g))if(match[1]==='max'?width>+match[2]:width<+match[2])active=false;
    }
   }
   if(!active)return;
   for(const selector of rule.selectors){
    if(!element.matches(selector))continue;
    if(removeFix&&selector==='.storefront.browse-preview .rec-pin .product-body')continue;
    rule.walkDecls(declaration=>{
     if(!relevant.has(declaration.prop))return;
     // Reject unsupported specificity rather than silently mis-model a new rule.
     expect(selector.split(/\s+/).every(part=>/^(?:\.[\w-]+)+$/.test(part))).toBe(true);
     const priority=[declaration.important?1:0,(selector.match(/\./g)??[]).length,++ordinal];
     const properties=declaration.prop==='inset'?['top','right','bottom','left']:[declaration.prop];
     for(const property of properties){
      const prior=winning.get(property);
      if(!prior||priority[0]>prior[0]||priority[0]===prior[0]&&(priority[1]>prior[1]||priority[1]===prior[1]&&priority[2]>prior[2])){
       winning.set(property,priority);result[property]=declaration.value;
      }
     }
    });
   }
  });
 }
 return result;
}
const lateRecommendation=['product-feed.css','browse.css','recommendations.css'];
const earlyRecommendation=['product-feed.css','recommendations.css','browse.css'];
it.each([358,390])('removes the evidenced relative offset at %spx, including late-loaded recommendation CSS',width=>{
 const previous=cascade(width,true,lateRecommendation,true);
 expect(previous.position).toBe('relative');expect(previous.left).toBe('12px');expect(previous.bottom).toBe('12px');
 for(const order of [lateRecommendation,earlyRecommendation])expect(cascade(width,true,order)).toMatchObject({position:'relative',top:'auto',right:'auto',bottom:'auto',left:'auto'});
 // Independent 390px fixture: the body previously ended at 184.5 > 181.5.
 if(width===390){
  const tile={left:42,width:130.5},cardRight=181.5;
  expect(tile.left+tile.width+parseFloat(previous.left)).toBe(184.5);
  expect(tile.left+tile.width).toBeLessThan(cardRight);
 }
});
it.each([358,390,600,601,767,2022])('preserves public card positioning at %spx',width=>{
 for(const order of [lateRecommendation,earlyRecommendation])expect(cascade(width,false,order)).toEqual(cascade(width,false,order,true));
});
it('keeps desktop preview in normal flow without adding clipping or pointer changes',()=>{
 expect(cascade(2022,true,lateRecommendation)).toMatchObject({position:'relative',top:'auto',right:'auto',bottom:'auto',left:'auto'});
 const ast=postcss.parse(sheets['browse.css']);
 const fix=ast.nodes.find(node=>node.type==='rule'&&node.selector==='.storefront.browse-preview .rec-pin .product-body');
 expect(fix?.type==='rule'&&fix.nodes.map(node=>node.type==='decl'?node.prop:null)).toEqual(['inset']);
});
