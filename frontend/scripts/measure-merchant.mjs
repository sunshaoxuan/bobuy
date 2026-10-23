// Runs inside the browser. Canvas ink metrics supplement DOM layout rectangles.
export function measureMerchantControls(customSelectors) {
  const rect = r => ({x:r.x,y:r.y,width:r.width,height:r.height});
  const selectors = '.merchant-header button,.merchant-store-link,.merchant-sidebar .ant-menu-item,.merchant-drawer .ant-menu-item,.merchant-drawer .ant-drawer-close,.trip-editor .ant-btn,.trip-editor .ant-input,.trip-editor .ant-input-number,.trip-editor .ant-picker,.trip-editor .ant-select-selector,.merchant-content .ant-pagination-item,.merchant-content .ant-pagination-prev,.merchant-content .ant-pagination-next,.merchant-login-main .ant-btn,.merchant-login-main .ant-input,.language-switcher';
  return [...document.querySelectorAll(customSelectors || selectors)].flatMap(element => {
    if(element.matches('.ant-input') && element.closest('.ant-picker')) return [];
    const boxElement = element.matches('.ant-input') ? element.closest('.ant-input-affix-wrapper') || element : element;
    const box = boxElement.getBoundingClientRect();
    if(!box.height || !box.width || box.x < 0 || box.right > innerWidth + .5 || getComputedStyle(element).visibility === 'hidden') return [];
    const glyphs = [];
    const context = document.createElement('canvas').getContext('2d');
    const ink = (text, style, bounds) => {
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const m = context.measureText(text);
      const baseline = bounds.y + (bounds.height-m.fontBoundingBoxAscent-m.fontBoundingBoxDescent)/2 + m.fontBoundingBoxAscent;
      return {x:bounds.x-m.actualBoundingBoxLeft,y:baseline-m.actualBoundingBoxAscent,width:m.actualBoundingBoxLeft+m.actualBoundingBoxRight,height:m.actualBoundingBoxAscent+m.actualBoundingBoxDescent};
    };
    const walker = document.createTreeWalker(element,NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())) {
      const style = getComputedStyle(node.parentElement);
      for(let index=0;index<node.length;index++) {
        const character=node.textContent[index]; if(!character.trim()) continue;
        const range=document.createRange();range.setStart(node,index);range.setEnd(node,index+1);
        const bounds=range.getBoundingClientRect(); if(!bounds.width || !bounds.height) continue;
        glyphs.push(ink(character,style,bounds));
      }
    }
    for(const input of element.matches('input') ? [element] : element.querySelectorAll('input')) {
      if (['checkbox', 'radio', 'hidden'].includes(input.type)) continue;
      const text=input.value || input.placeholder; if(!text) continue;
      const style=getComputedStyle(input), bounds=input.getBoundingClientRect();
      const paddingTop=parseFloat(style.paddingTop),paddingBottom=parseFloat(style.paddingBottom);
      const left=bounds.x+parseFloat(style.paddingLeft), right=bounds.right-parseFloat(style.paddingRight);
      let advance=0;
      for(const character of text) {
        const g=ink(character,style,{x:left+advance-input.scrollLeft,y:bounds.y+paddingTop,width:bounds.width,height:bounds.height-paddingTop-paddingBottom});
        const clippedLeft=Math.max(left,g.x), clippedRight=Math.min(right,g.x+g.width);
        if(character.trim() && clippedRight>clippedLeft) glyphs.push({...g,x:clippedLeft,width:clippedRight-clippedLeft});
        advance+=context.measureText(character).width;
      }
    }
    for(const shape of element.querySelectorAll('svg path,svg rect,svg circle,svg polygon,svg polyline,svg line')) {
      const b=shape.getBBox(),matrix=shape.getScreenCTM();if(!matrix || !b.width || !b.height) continue;
      const points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix));
      glyphs.push({x:Math.min(...points.map(p=>p.x)),y:Math.min(...points.map(p=>p.y)),width:Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)),height:Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))});
    }
    const inner={x:box.x+1,y:box.y+1,width:box.width-2,height:box.height-2};
    const name=element.getAttribute('aria-label') || element.textContent.trim() || element.getAttribute('placeholder') || element.id || element.className;
    if(!glyphs.length) return [{name,background:rect(box),inner,hitArea:rect(box),glyph:null}];
    const left=Math.min(...glyphs.map(g=>g.x)),top=Math.min(...glyphs.map(g=>g.y)),right=Math.max(...glyphs.map(g=>g.x+g.width)),bottom=Math.max(...glyphs.map(g=>g.y+g.height));
    const centered=element.matches('button,.merchant-content .ant-pagination-item,.merchant-content .ant-pagination-prev,.merchant-content .ant-pagination-next');
    return [{name,background:rect(box),inner,hitArea:rect(box),glyph:{x:left,y:top,width:right-left,height:bottom-top},alignment:centered?'center':'start',centerError:{x:(left+right)/2-(inner.x+inner.width/2),y:(top+bottom)/2-(inner.y+inner.height/2)},margins:{left:left-inner.x,right:inner.x+inner.width-right,top:top-inner.y,bottom:inner.y+inner.height-bottom}}];
  });
}
