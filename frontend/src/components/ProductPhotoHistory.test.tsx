import {render,screen,waitFor} from '@testing-library/react';
import {it,expect,vi} from 'vitest';
const mock=vi.hoisted(()=>({history:vi.fn()}));
vi.mock('../api',()=>({photoIntakeApi:mock,api:{suppliers:()=>Promise.resolve([{id:'s1',name:{'en-US':'Synthetic supplier'}}])}}));
vi.mock('../i18n',()=>({useI18n:()=>({locale:'en-US',t:(k:string)=>k})}));
import ProductPhotoHistory from './ProductPhotoHistory';
it('shows saved scope, availability, time and explicitly unchanged/missing prices',async()=>{
 mock.history.mockResolvedValue([{id:'1',productId:'p',supplierId:'s1',market:'JP',inStock:true,amount:null,observedAt:'2026-11-20T00:00:00Z',priceChanged:false},{id:'2',productId:'p',supplierId:'s1',market:'JP',amount:999,currency:'JPY',unit:'pack',observedAt:'2026-11-19T00:00:00Z',priceChanged:false}]);
 render(<ProductPhotoHistory id="p"/>);await waitFor(()=>expect(screen.getByText(/photo.available/)).toBeTruthy());expect(screen.getByText(/photo.price_not_updated/)).toBeTruthy();expect(screen.getByText(/999 JPY \/ pack/)).toHaveTextContent('Synthetic supplier · JP');
});
