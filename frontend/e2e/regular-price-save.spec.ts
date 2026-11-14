import {expect,test} from '@playwright/test';
import {setAgentContext,setupCommonMocks} from './responsive_helpers';

for(const viewport of [{width:390,height:844},{width:1280,height:800}])test(`regular price persists after reload at ${viewport.width}px`,async({page})=>{
 await page.setViewportSize(viewport);await setupCommonMocks(page);await setAgentContext(page);
 let sale:any=null;
 await page.route('**/api/merchant/currencies',route=>route.fulfill({json:{status:'success',data:[{code:'JPY',fractionDigits:0,saleEnabled:true}]}}));
 await page.route('**/api/merchant/product-pricing/SKU-001',async route=>{
  if(route.request().method()==='PUT')sale={amount:1200,currency:'JPY',unit:'1 pack',revision:1,enabled:true};
  const sheet={productId:'SKU-001',regular:sale,visibility:'PUBLIC',orderMethod:sale?'PRE_ORDER':null,now:'2026-11-14T00:00:00Z',timezone:'Asia/Tokyo',effective:sale?{...sale,regularAmount:sale.amount}:null,history:[]};
  await route.fulfill({json:{status:'success',data:sheet}});
 });
 await page.goto('/admin/products');await page.getByRole('button',{name:/Selling prices and adjustments Matcha Kit/}).click();await page.getByText('Set regular selling price').click();
 await page.getByLabel('Regular amount').fill('1200');await page.getByLabel('Price unit').fill('1 pack');await page.getByLabel('Regular price change reason (required)').fill('Synthetic E2E confirmation');await page.getByRole('checkbox',{name:/reviewed the products/}).check();
 await expect(page.getByRole('button',{name:'Confirm regular price'})).toBeEnabled();await page.getByRole('button',{name:'Confirm regular price'}).click();await expect(page.getByText(/¥1,200/)).toBeVisible();
 await page.reload();await expect(page.getByText(/¥1,200/).first()).toBeVisible();await expect(page.getByText('Selling price pending')).toHaveCount(0);
});
