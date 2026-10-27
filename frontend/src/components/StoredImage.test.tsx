import { render,screen,waitFor } from '@testing-library/react';
import StoredImage from './StoredImage';
const mocks=vi.hoisted(()=>({fetch:vi.fn()}));vi.mock('../api',()=>({api:{privateMedia:mocks.fetch}}));
beforeEach(()=>{mocks.fetch.mockResolvedValue(new Blob(['test'],{type:'image/png'}));URL.createObjectURL=vi.fn(()=> 'blob:synthetic');URL.revokeObjectURL=vi.fn();});
it('uses authenticated bytes for private receipts and revokes the browser URL',async()=>{
 const {unmount}=render(<StoredImage src="/api/merchant/media/test-id" alt="receipt" />);
 await waitFor(()=>expect(screen.getByAltText('receipt')).toHaveAttribute('src','blob:synthetic'));
 expect(mocks.fetch).toHaveBeenCalledWith('/api/merchant/media/test-id');unmount();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic');
});
it('keeps public product image URLs unchanged without a credentialed fetch',()=>{
 mocks.fetch.mockClear();render(<StoredImage src="/api/storefront/recommendation-images/test-id" alt="product" />);
 expect(screen.getByAltText('product')).toHaveAttribute('src','/api/storefront/recommendation-images/test-id');expect(mocks.fetch).not.toHaveBeenCalled();
});
