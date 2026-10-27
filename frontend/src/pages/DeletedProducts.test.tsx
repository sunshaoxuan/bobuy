import {fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import DeletedProducts from './DeletedProducts';
const mocks=vi.hoisted(()=>({list:vi.fn(),remove:vi.fn(),restore:vi.fn(),admin:true}));
vi.mock('../api',()=>({productTrashApi:{list:mocks.list,remove:mocks.remove,restore:mocks.restore}}));
vi.mock('../context/UserRoleContext',()=>({useUserRole:()=>({user:{platformAdmin:mocks.admin}})}));
const row={id:'synthetic-no-image',name:{'ja-JP':'試験商品','en-US':'Synthetic no image'},itemNumber:'000123',merchantId:1000,deletedAt:null,deletedBy:null,version:7,imageCount:0,recommendationIds:[12]};
beforeEach(()=>{localStorage.setItem('bobbuy_locale','en-US');mocks.admin=true;vi.clearAllMocks();mocks.list.mockImplementation(async deleted=>deleted?[]:[row,{...row,id:'with-image',name:{'en-US':'Keep photography'},imageCount:2}]);});
it('reviews no-image selection, uses versioned logical delete and reloads without duplicate submission',async()=>{
 render(<I18nProvider><DeletedProducts/></I18nProvider>);
 await waitFor(()=>expect(mocks.list).toHaveBeenCalledWith(true));
 fireEvent.click(screen.getByRole('button',{name:'Review products without images'}));
 const name=await screen.findByText('Synthetic no image');expect(screen.queryByText('Keep photography')).not.toBeInTheDocument();
 const submit=screen.getByRole('button',{name:/Logically delete selected products/});expect(submit).toBeDisabled();
 const tableRow=name.closest('tr')||name.closest('article')!;fireEvent.click(within(tableRow).getByRole('checkbox'));
 fireEvent.click(screen.getByRole('checkbox',{name:/I reviewed the selected products/}));expect(submit).toBeEnabled();
 fireEvent.click(submit);await waitFor(()=>expect(mocks.remove).toHaveBeenCalledTimes(1));expect(mocks.remove).toHaveBeenCalledWith([{id:row.id,version:7}]);
 await waitFor(()=>expect(screen.getByRole('button',{name:/Logically delete selected products/})).toBeDisabled());
});
it('restores the exact deleted row and retains a reload path after conflict',async()=>{
 mocks.list.mockResolvedValue([{...row,deletedAt:'2026-10-27T00:00:00Z',version:8}]);mocks.restore.mockRejectedValueOnce(new Error('conflict'));
 render(<I18nProvider><DeletedProducts/></I18nProvider>);
 fireEvent.click(await screen.findByRole('button',{name:'Restore product and recommendations'}));
 expect(await screen.findByText('The data changed or could not be saved. Reload and review the selection again.')).toBeInTheDocument();
 expect(mocks.restore).toHaveBeenCalledWith({id:row.id,version:8});
 fireEvent.click(screen.getByRole('button',{name:'Reload'}));await waitFor(()=>expect(mocks.list).toHaveBeenCalledTimes(2));
});
it('does not load or display deleted data for a nonadministrator',()=>{
 mocks.admin=false;render(<I18nProvider><DeletedProducts/></I18nProvider>);
 expect(screen.getByText('Platform administrator access required.')).toBeInTheDocument();expect(mocks.list).not.toHaveBeenCalled();
});
