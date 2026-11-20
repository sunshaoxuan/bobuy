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
