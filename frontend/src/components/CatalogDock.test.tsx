import {act,render,waitFor} from '@testing-library/react';
import CatalogDock from './CatalogDock';
import {vi,it,expect} from 'vitest';
it('tracks the real header height and scroll anchor without changing the reserved navigation slot',async()=>{
 let height=120,anchorTop=140;
 const spy=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){return {height:this.classList.contains('store-header')?height:0,top:this.classList.contains('catalog-dock-anchor')?anchorTop:0,left:0,right:0,bottom:0,width:0,x:0,y:0,toJSON(){}};});
 const view=render(<div className="storefront"><header className="store-header"/><CatalogDock heading={<h1>Product Picks</h1>} hasNavigation><nav>Categories</nav></CatalogDock></div>);
 const dock=view.container.querySelector('.catalog-dock')!;expect(dock).toHaveStyle({top:'120px'});expect(dock).toHaveAttribute('data-compact','false');
 anchorTop=60;act(()=>window.dispatchEvent(new Event('scroll')));await waitFor(()=>expect(dock).toHaveAttribute('data-compact','true'));expect(dock).toHaveAttribute('data-navigation','true');
 height=76;act(()=>window.dispatchEvent(new Event('resize')));await waitFor(()=>expect(dock).toHaveStyle({top:'76px'}));
 anchorTop=100;act(()=>window.dispatchEvent(new Event('scroll')));await waitFor(()=>expect(dock).toHaveAttribute('data-compact','false'));
 view.unmount();spy.mockRestore();
});

function selectionFixture(mobile:boolean,initialScroll:number){
 let anchorTop=140;
 const rect=(left:number,width:number,top=0,height=0)=>({x:left,y:top,left,right:left+width,top,bottom:top+height,width,height,toJSON(){}});
 const media=vi.spyOn(window,'matchMedia').mockReturnValue({matches:mobile} as MediaQueryList);
 const geometry=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(function(this:HTMLElement){
  if(this.classList.contains('store-header'))return rect(0,360,0,120);
  if(this.classList.contains('catalog-dock-anchor'))return rect(0,0,anchorTop);
  if(this.classList.contains('category-shortcuts-track'))return rect(0,328);
  if(this.hasAttribute('aria-current')){
   const compact=this.closest('.catalog-dock')?.getAttribute('data-compact')==='true';
   const track=this.closest('.category-shortcuts-track')!;
   return rect((mobile&&compact?1562:1828)-track.scrollLeft,mobile&&compact?76:88);
  }
  return rect(0,0);
 });
 const view=render(<div className="storefront"><header className="store-header"/><CatalogDock heading={<h1>Product Picks</h1>} hasNavigation><ul className="category-shortcuts-track"><li><a aria-current="true">Late category</a></li></ul></CatalogDock></div>);
 const track=view.container.querySelector<HTMLElement>('.category-shortcuts-track')!;
 track.scrollLeft=initialScroll;
 return {track,async transition(compact:boolean){anchorTop=compact?60:140;act(()=>window.dispatchEvent(new Event('scroll')));await waitFor(()=>expect(view.container.querySelector('.catalog-dock')).toHaveAttribute('data-compact',String(compact)));},close(){view.unmount();geometry.mockRestore();media.mockRestore();}};
}
it.each([
 ['visible mobile selection',true,1592,1558],
 ['hidden mobile selection',true,0,0],
 ['partially visible mobile selection',true,1850,1850],
 ['desktop selection',false,1592,1592],
] as const)('preserves only the %s during a size transition',async(_name,mobile,initial,expected)=>{
 const fixture=selectionFixture(mobile,initial);
 try{await fixture.transition(true);expect(fixture.track.scrollLeft).toBe(expected);await fixture.transition(false);expect(fixture.track.scrollLeft).toBe(initial);}finally{fixture.close();}
});
it('leaves subsequent horizontal exploration alone on scroll and expansion',async()=>{
 const fixture=selectionFixture(true,1592);
 try{await fixture.transition(true);expect(fixture.track.scrollLeft).toBe(1558);fixture.track.scrollLeft=0;act(()=>window.dispatchEvent(new Event('scroll')));await new Promise(resolve=>requestAnimationFrame(resolve));expect(fixture.track.scrollLeft).toBe(0);await fixture.transition(false);expect(fixture.track.scrollLeft).toBe(0);}finally{fixture.close();}
});
