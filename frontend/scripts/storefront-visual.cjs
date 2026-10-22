const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(__dirname, '../../docs/reports/evidence', process.env.BOBUY_VISUAL_EVIDENCE || 'PLAN59-pinterest-refined');

function measureControls() {
  const rect = r => ({x:r.x,y:r.y,width:r.width,height:r.height});
  const controls = [...document.querySelectorAll('.store-header-actions a,.journey-trigger,.catalog-toolbar input,.product-add,.product-name,.feed-loader button,.store-bottom>a,.quantity-sheet .ant-btn,.quantity-sheet .ant-drawer-close,.quantity-sheet input')];
  return controls.flatMap(element => {
    const inputBox = element.getBoundingClientRect();
    const box = element.matches('.catalog-toolbar input') ? element.closest('.ant-input-affix-wrapper').getBoundingClientRect() : inputBox;
    if (!box.height || box.x < 0 || box.right > innerWidth || box.y < 0 || box.bottom > innerHeight) return [];
    const glyphs = [];
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (!node.textContent.trim() || node.parentElement.closest('.ant-badge-count,.product-count')) continue;
      const style = getComputedStyle(node.parentElement);
      const canvas = document.createElement('canvas').getContext('2d');
      canvas.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      for (let i=0;i<node.length;i++) {
        if (!node.textContent[i].trim()) continue;
        const range = document.createRange(); range.setStart(node,i); range.setEnd(node,i+1);
        const r = range.getBoundingClientRect(), m = canvas.measureText(node.textContent[i]);
        const clipping=node.parentElement.closest('h2');
        if (clipping && getComputedStyle(clipping).overflow==='hidden' && r.top>=clipping.getBoundingClientRect().bottom) continue;
        const baseline = r.y + (r.height - m.fontBoundingBoxAscent - m.fontBoundingBoxDescent)/2 + m.fontBoundingBoxAscent;
        const glyph={x:r.x + Math.max(0,(r.width-m.width)/2) - m.actualBoundingBoxLeft,y:baseline-m.actualBoundingBoxAscent,width:m.actualBoundingBoxLeft+m.actualBoundingBoxRight,height:m.actualBoundingBoxAscent+m.actualBoundingBoxDescent};
        const stroke=(parseFloat(style.webkitTextStrokeWidth)||0)/2;
        glyph.x-=stroke;glyph.y-=stroke;glyph.width+=stroke*2;glyph.height+=stroke*2;
        // Range rectangles can include a clamped line whose glyph ink is fully hidden.
        if (clipping && getComputedStyle(clipping).overflow==='hidden') {
          const clip=clipping.getBoundingClientRect();
          if(glyph.y>=clip.bottom || glyph.y+glyph.height<=clip.top) continue;
          const bottom=Math.min(glyph.y+glyph.height,clip.bottom);
          glyph.y=Math.max(glyph.y,clip.top);glyph.height=bottom-glyph.y;
        }
        glyphs.push(glyph);
      }
    }
    for (const svg of element.querySelectorAll('svg')) {
      if (svg.closest('.ant-badge-count,.product-count')) continue;
      for (const shape of svg.querySelectorAll('path,rect,circle,line,polyline,polygon')) {
        const b=shape.getBBox(), matrix=shape.getScreenCTM(); if (!matrix || !b.width || !b.height) continue;
        const points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(matrix));
        glyphs.push({x:Math.min(...points.map(p=>p.x)),y:Math.min(...points.map(p=>p.y)),width:Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)),height:Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))});
      }
    }
    if (element.tagName === 'INPUT') {
      const style=getComputedStyle(element), ctx=document.createElement('canvas').getContext('2d');
      ctx.font=`${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const m=ctx.measureText(element.value || element.placeholder || '');
      const baseline=inputBox.y+(inputBox.height-m.fontBoundingBoxAscent-m.fontBoundingBoxDescent)/2+m.fontBoundingBoxAscent;
      const x=style.textAlign==='center' ? inputBox.x+(inputBox.width-m.width)/2 : inputBox.x+parseFloat(style.paddingLeft);
      glyphs.push({x:x-m.actualBoundingBoxLeft,y:baseline-m.actualBoundingBoxAscent,width:m.actualBoundingBoxLeft+m.actualBoundingBoxRight,height:m.actualBoundingBoxAscent+m.actualBoundingBoxDescent});
    }
    if (!glyphs.length) return [{name:element.getAttribute('aria-label'),background:rect(box),hitArea:rect(box),glyph:null}];
    const left=Math.min(...glyphs.map(r=>r.x)),top=Math.min(...glyphs.map(r=>r.y)),right=Math.max(...glyphs.map(r=>r.x+r.width)),bottom=Math.max(...glyphs.map(r=>r.y+r.height));
    const circular=element.matches('.product-add');
    const faceInset=circular ? parseFloat(getComputedStyle(element,'::before').top) : 0;
    const background={x:box.x+faceInset,y:box.y+faceInset,width:box.width-2*faceInset,height:box.height-2*faceInset};
    const inset=circular ? (background.width-(background.width-2)/Math.sqrt(2))/2 : 1;
    const inner={x:background.x+inset,y:background.y+inset,width:background.width-2*inset,height:background.height-2*inset};
    return [{name:element.getAttribute('aria-label') || element.textContent.trim(),background,inner,hitArea:rect(box),glyph:{x:left,y:top,width:right-left,height:bottom-top},centerError:{x:(left+right)/2-(inner.x+inner.width/2),y:(top+bottom)/2-(inner.y+inner.height/2)},margins:{left:left-inner.x,right:inner.x+inner.width-right,top:top-inner.y,bottom:inner.y+inner.height-bottom},alignment:element.matches('.journey-trigger,.catalog-toolbar input,.product-name')?'start':'center'}];
  });
}

(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.BOBUY_BROWSER_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const measurements=[];
  try {
    for (const [width,height] of [[360,800],[390,844],[768,1024],[1440,1000]]) {
      const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:width<768,hasTouch:width<768});
      const page=await context.newPage(); page.setDefaultTimeout(10000);
      await page.goto('http://127.0.0.1:18080',{waitUntil:'networkidle'});
      await page.locator('.product-photo img').first().evaluate(i=>i.decode());
      await page.waitForTimeout(300);
      await page.screenshot({path:path.join(output,`storefront-${width}.png`)});
      measurements.push({viewport:{width,height},state:'catalog',controls:await page.evaluate(measureControls),cards:await page.locator('.product-tile').evaluateAll(elements=>elements.map(element=>{const r=element.getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height,radius:getComputedStyle(element).borderRadius,overflow:getComputedStyle(element).overflow};}))});
      const plus=await page.locator('.product-add').first().boundingBox();
      if(width===390) {
        await page.screenshot({path:path.join(output,'plus-detail.png'),clip:{x:plus.x-8,y:plus.y-8,width:plus.width+16,height:plus.height+16}});
        await page.locator('.product-tile').first().screenshot({path:path.join(output,'card-detail.png')});
        await page.locator('.catalog-toolbar').screenshot({path:path.join(output,'toolbar-detail.png')});
        await page.locator('.store-header').screenshot({path:path.join(output,'header-detail.png')});
        await page.locator('.journey-strip').screenshot({path:path.join(output,'journey-detail.png')});
        await page.locator('.product-add').first().hover();
        await page.screenshot({path:path.join(output,'plus-hover-detail.png'),clip:{x:plus.x-8,y:plus.y-8,width:plus.width+16,height:plus.height+16}});
        await page.mouse.move(0,0);
      }
      for(let i=0;i<7;i++) {
        await page.locator('.store-product').nth(Math.min(i,5)).scrollIntoViewIfNeeded();
        await page.locator('.store-product').nth(i).scrollIntoViewIfNeeded();
        await page.locator('.product-photo img').nth(i).evaluate(image=>image.decode());
        await page.waitForTimeout(100);
      }
      await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:path.join(output,`feed-full-${width}.png`),fullPage:true});
      if(width===390) {
        await page.locator('.product-tile').filter({hasText:'厨房纸巾'}).screenshot({path:path.join(output,'light-package-detail.png')});
        await page.locator('.product-tile').filter({hasText:'全脂鲜牛奶'}).screenshot({path:path.join(output,'milk-detail.png')});
        await page.evaluate(()=>scrollTo(0,0));
      }
      await page.locator('.product-add').first().click();
      await page.getByRole('spinbutton',{name:'购买数量',exact:true}).fill('99');
      await page.getByRole('spinbutton',{name:'购买数量',exact:true}).blur();
      await page.waitForTimeout(400);
      await page.screenshot({path:path.join(output,`quantity-${width}.png`)});
      measurements.push({viewport:{width,height},state:'quantity-99',controls:await page.evaluate(measureControls)});
      if(width===390) { const box=await page.locator('.quantity-sheet-content').boundingBox();await page.screenshot({path:path.join(output,'quantity-detail.png'),clip:box}); }
      await context.close();
    }
    const context=await browser.newContext({viewport:{width:360,height:800}});
    const page=await context.newPage();
    await page.route('**/api/storefront/products',async route=>{
      const response=await route.fetch();const data=await response.json();
      data.data[0].name={'zh-CN':'日本限定精选家庭分享组合礼盒超长商品名称测试'};data.data[0].price=999999;
      await route.fulfill({response,json:data});
    });
    await page.goto('http://127.0.0.1:18080',{waitUntil:'networkidle'});
    await page.locator('.product-photo img').first().evaluate(i=>i.decode());
    await page.screenshot({path:path.join(output,'synthetic-long-title-360.png')});
    await page.locator('.product-add').first().click();await page.getByRole('spinbutton',{name:'购买数量',exact:true}).fill('99');await page.getByRole('spinbutton',{name:'购买数量',exact:true}).blur();await page.waitForTimeout(400);
    await page.screenshot({path:path.join(output,'synthetic-max-price-360.png')});
    measurements.push({viewport:{width:360,height:800},state:'synthetic-long-title-max-price',controls:await page.evaluate(measureControls)});
    const button=page.locator('.quantity-sheet-content>.ant-btn');
    const positive=(await button.boundingBox()).height>=44;
    await button.evaluate(element=>{element.style.transition='none';element.style.minHeight='20px';element.style.height='20px';});
    const negativeRejected=(await button.boundingBox()).height<44;
    await button.evaluate(element=>{element.style.removeProperty('min-height');element.style.removeProperty('height');element.style.removeProperty('transition');});
    await page.waitForTimeout(300);
    if(!positive || !negativeRejected) throw new Error('Hit-area budget positive/negative check failed');
    const restoredHeight=(await button.boundingBox()).height;
    if(restoredHeight<44) throw new Error('Hit-area negative fixture was not restored');
    fs.writeFileSync(path.join(output,'budget-negative.json'),JSON.stringify({positive,negativeRejected,restoredHeight},null,2));
    await context.close();
    fs.writeFileSync(path.join(output,'geometry.json'),JSON.stringify(measurements,null,2));
    const failures=measurements.flatMap(state=>state.controls.flatMap(control=>{
      if(!control.glyph) return [];
      const budget=Math.min(2,control.glyph.height*.1);
      const invalid=control.hitArea.height<44 || Math.min(...Object.values(control.margins))<3 || (control.alignment==='center' && (Math.abs(control.centerError.x)>budget || Math.abs(control.centerError.y)>budget));
      return invalid ? [{viewport:state.viewport,state:state.state,control:control.name}] : [];
    }));
    fs.writeFileSync(path.join(output,'geometry-check.json'),JSON.stringify({states:measurements.length,controls:measurements.reduce((total,state)=>total+state.controls.length,0),failures},null,2));
    if(failures.length) throw new Error(`Control geometry failed: ${JSON.stringify(failures)}`);
    console.log(`Saved ${measurements.length} geometry states and screenshots to ${output}`);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
