import {expect,test} from '@playwright/test';
import {setAgentContext,setupCommonMocks} from './responsive_helpers';

for(const viewport of [{width:390,height:844},{width:1280,height:800}])test(`regular price persists after reload at ${viewport.width}px`,async({page})=>{
 await page.setViewportSize(viewport);await setupCommonMocks(page);await setAgentContext(page);
 const pageErrors:Error[]=[];page.on('pageerror',error=>pageErrors.push(error));
 let sale:any=null,regularSaved=false;
 await page.route('**/api/ai/costco-onboarding/status',route=>route.fulfill({json:{status:'success',data:{workerEnabled:false}}}));
 await page.route('**/api/ai/costco-onboarding',route=>route.fulfill({json:{status:'success',data:[]}}));
 await page.route('**/api/merchant/currencies',route=>route.fulfill({json:{status:'success',data:[{code:'JPY',fractionDigits:0,saleEnabled:true}]}}));
 await page.route('**/api/merchant/price-adjustments',route=>route.fulfill({json:{status:'success',data:[]}}));
 await page.route('**/api/merchant/price-adjustments/products',route=>route.fulfill({json:{status:'success',data:[]}}));
 await page.route('**/api/storefront/product-reviews/SKU-001',route=>route.fulfill({json:{status:'success',data:{average:null,count:0,sum:0,distribution:[1,2,3,4,5].map(stars=>({stars,count:0}))}}}));
 await page.route('**/api/mobile/products**',route=>route.fulfill({json:{status:'success',data:[{product:{id:'SKU-001',name:{'en-US':'Matcha Kit'},description:{'en-US':'Ready-to-buy matcha set'},brand:'BOBBuy',basePrice:32.5,categoryId:'cat-1000',itemNumber:'SKU-001',visibilityStatus:'PUBLIC',mediaGallery:[{url:'/assets/products/milk.png',type:'IMAGE'}],attributes:{},priceTiers:[]},displayName:'Matcha Kit',displayDescription:'Ready-to-buy matcha set',currentRegular:sale}]}}));
 await page.route('**/api/merchant/product-pricing/SKU-001',async route=>{
  const sheet={productId:'SKU-001',regular:sale,visibility:'PUBLIC',orderMethod:sale?'PRE_ORDER':null,now:'2026-11-14T00:00:00Z',timezone:'Asia/Tokyo',effective:sale?{...sale,regularAmount:sale.amount}:null,history:[]};
  await route.fulfill({json:{status:'success',data:sheet}});
 });
 await page.route('**/api/merchant/product-pricing/SKU-001/regular',async route=>{
  expect(route.request().method()).toBe('PUT');regularSaved=true;sale={amount:1200,currency:'JPY',unit:'1 pack',revision:1,enabled:true};
  await route.fulfill({json:{status:'success',data:{productId:'SKU-001',regular:sale,visibility:'PUBLIC',orderMethod:'PRE_ORDER',now:'2026-11-14T00:00:00Z',timezone:'Asia/Tokyo',effective:{...sale,regularAmount:sale.amount},history:[]}}});
 });
 await page.goto('/admin/products');await expect(page.getByText('Matcha Kit',{exact:true}).first()).toBeVisible();await page.getByRole('button',{name:'Selling prices and adjustments',exact:true}).click();await page.getByText('Set regular selling price').click();
 await page.getByLabel('Regular amount').fill('1200');await page.getByLabel('Price unit').fill('1 pack');await page.getByLabel('Regular price change reason (required)').fill('Synthetic E2E confirmation');await page.getByRole('checkbox',{name:/reviewed the products/}).check();
 await expect(page.getByRole('button',{name:'Confirm regular price'})).toBeEnabled();await page.getByRole('button',{name:'Confirm regular price'}).click();await expect(page.getByText(/¥1,200/).first()).toBeVisible();
 expect(regularSaved).toBe(true);await page.reload();await expect(page.getByText('Matcha Kit',{exact:true}).first()).toBeVisible();await expect(page.getByText(/¥1,200/).first()).toBeVisible();await expect(page.getByText(/Selling price pending|尚未确认售价/)).toHaveCount(0);expect(pageErrors).toEqual([]);
});
