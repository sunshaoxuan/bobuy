import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {I18nProvider,translate} from '../i18n';
import {storeAuthSession} from '../authStorage';
import RecommendationFromProduct from './RecommendationFromProduct';
const mocks=vi.hoisted(()=>({products:vi.fn(),fromProduct:vi.fn(),get:vi.fn()}));
vi.mock('../api',()=>({api:{products:mocks.products},recommendationApi:{fromProduct:mocks.fromProduct,get:mocks.get}}));
// jsdom cannot parse Ant Design's generated :not/:has selector; browser QA covers the real Select.
vi.mock('antd',async importOriginal=>{const actual=await importOriginal<typeof import('antd')>();return {...actual,Select:({options,onChange,value,...props}:any)=><select aria-label={props['aria-label']} value={value??''} onChange={e=>onChange(e.target.value)}><option value=""/>{options.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>};});
const detail={post:{id:4,version:2,published:false},body:'',items:[]} as any;
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();mocks.fromProduct.mockReset();mocks.get.mockReset();mocks.products.mockResolvedValue([{product:{id:'master',name:{'ja-JP':'ごま油','zh-CN':'芝麻油'},itemNumber:'00123',recordVersion:7,catalogData:{}}}]);});
it('selects master before registration, keeps identity read-only and requires review',async()=>{
 const onChange=vi.fn(),pending=vi.fn();mocks.fromProduct.mockResolvedValue({...detail,items:[{productId:'master'}]});
 const view=render(<I18nProvider><RecommendationFromProduct detail={detail} onChange={onChange} onPendingChange={pending}/></I18nProvider>);
 await screen.findByText(/00123 · 芝麻油/);fireEvent.change(screen.getByRole('combobox'),{target:{value:'master'}});
 expect(screen.getByDisplayValue('ごま油')).toBeDisabled();expect(screen.getByDisplayValue('00123')).toBeDisabled();
 const submit=screen.getByRole('button',{name:'使用所选主档登记本期'});expect(submit).toBeDisabled();
 fireEvent.click(screen.getByRole('checkbox',{name:'已核对同一 ITEM、规格、完整官方图集及本期优惠条件。'}));fireEvent.click(submit);await waitFor(()=>expect(mocks.fromProduct).toHaveBeenCalledWith(4,{productId:'master',productVersion:7,facts:{name:'ごま油',itemNumber:'00123'},version:2,reviewed:true}));
 await waitFor(()=>expect(onChange).toHaveBeenCalled());expect(pending).toHaveBeenCalledWith(false);expect(view.container.querySelector('input[type=file]')).toBeNull();
});
it('offers pending registration in an already published issue',()=>{render(<I18nProvider><RecommendationFromProduct detail={{...detail,post:{...detail.post,published:true}}} onChange={vi.fn()} onPendingChange={vi.fn()}/></I18nProvider>);expect(screen.getByRole('combobox')).toBeEnabled();});

const syntheticProduct={product:{id:'master',name:{'ja-JP':'Synthetic Master','en-US':'Synthetic Master'},itemNumber:'123',recordVersion:7,catalogData:{}}};
async function selected(viewDetail:any=detail,onChange=vi.fn()){
 localStorage.setItem('bobbuy_locale','en-US');mocks.products.mockResolvedValue([structuredClone(syntheticProduct)]);
 const view=render(<I18nProvider><RecommendationFromProduct detail={viewDetail} onChange={onChange} onPendingChange={vi.fn()}/></I18nProvider>);
 await screen.findByRole('option',{name:/123.*Synthetic Master/});fireEvent.change(screen.getByRole('combobox'),{target:{value:'master'}});return {...view,onChange};
}
const reviewChoice=()=>screen.getByRole('checkbox',{name:translate('en-US','catalog.from_product_review')});
const submitChoice=()=>screen.getByRole('button',{name:translate('en-US','catalog.from_product_add')});
it('adds a pending eighth item without withdrawing the seven already public',async()=>{
 const online={...detail,post:{...detail.post,published:true},items:Array.from({length:7},(_,i)=>({id:i+1,name:'Existing '+i,publicationState:'PUBLISHED'}))};
 const value={...online,items:[...online.items,{id:8,name:'Synthetic Master',publicationState:'PENDING'}]};mocks.fromProduct.mockResolvedValue(value);
 const view=await selected(online);fireEvent.click(reviewChoice());fireEvent.click(submitChoice());await waitFor(()=>expect(view.onChange).toHaveBeenCalledWith(value));
 expect(mocks.fromProduct.mock.calls[0][1]).toEqual({productId:'master',productVersion:7,facts:{name:'Synthetic Master',itemNumber:'123'},version:2,reviewed:true});
 expect(value.items.filter((i:{publicationState:string})=>i.publicationState==='PUBLISHED')).toHaveLength(7);
});
it('prevents double submission and retries the exact body after an uncertain response',async()=>{
 mocks.fromProduct.mockRejectedValueOnce(new TypeError('Response lost')).mockResolvedValueOnce(detail);await selected();fireEvent.click(reviewChoice());const button=submitChoice();fireEvent.click(button);fireEvent.click(button);
 expect(mocks.fromProduct).toHaveBeenCalledTimes(1);await screen.findByText('Response lost');fireEvent.click(submitChoice());await waitFor(()=>expect(mocks.fromProduct).toHaveBeenCalledTimes(2));expect(mocks.fromProduct.mock.calls[1]).toEqual(mocks.fromProduct.mock.calls[0]);
});
it('keeps offer text on version conflict and rebinds the current product only after explicit reload',async()=>{
 mocks.fromProduct.mockRejectedValueOnce(Object.assign(new Error('Product changed'),{status:409}));const view=await selected();
 fireEvent.change(screen.getByLabelText(translate('en-US','rec.fact.offerNotes')),{target:{value:'Keep this offer note'}});fireEvent.change(screen.getByLabelText(translate('en-US','ref.variantKey')),{target:{value:'Original source variant'}});fireEvent.click(reviewChoice());fireEvent.click(submitChoice());
 await screen.findByText('Product changed');expect(submitChoice()).toBeDisabled();expect(screen.getByDisplayValue('Keep this offer note')).toBeInTheDocument();
 const fresh={...detail,post:{...detail.post,version:5}};mocks.get.mockResolvedValue(fresh);mocks.products.mockResolvedValue([{product:{...syntheticProduct.product,recordVersion:8,name:{'ja-JP':'Updated Master','en-US':'Updated Master'},catalogData:{specification:{'en-US':'Updated 24 cartons','ja-JP':'Updated 24 cartons'}}}}]);
 fireEvent.click(screen.getByRole('button',{name:'Reload'}));await waitFor(()=>expect(view.onChange).toHaveBeenCalledWith(fresh));view.rerender(<I18nProvider><RecommendationFromProduct detail={fresh} onChange={view.onChange} onPendingChange={vi.fn()}/></I18nProvider>);
 expect(screen.getByDisplayValue('Keep this offer note')).toBeInTheDocument();expect(screen.getByDisplayValue('Original source variant')).toBeInTheDocument();expect(screen.getByText('Updated 24 cartons')).toBeInTheDocument();expect(screen.getByDisplayValue('Updated Master')).toBeDisabled();expect(reviewChoice()).not.toBeChecked();expect(submitChoice()).toBeDisabled();
 mocks.fromProduct.mockResolvedValue(fresh);fireEvent.click(reviewChoice());fireEvent.click(submitChoice());await waitFor(()=>expect(mocks.fromProduct).toHaveBeenCalledTimes(2));expect(mocks.fromProduct.mock.calls[1][1]).toMatchObject({version:5,productVersion:8,facts:{name:'Updated Master',offerNotes:'Keep this offer note',referenceContext:{variantKey:'Original source variant'}}});
});
it('does not apply a late append response to a different issue',async()=>{
 let finish!:(value:any)=>void;mocks.fromProduct.mockImplementation(()=>new Promise(resolve=>finish=resolve));const view=await selected();fireEvent.click(reviewChoice());fireEvent.click(submitChoice());
 view.rerender(<I18nProvider><RecommendationFromProduct detail={{...detail,post:{...detail.post,id:9}}} onChange={view.onChange} onPendingChange={vi.fn()}/></I18nProvider>);await act(async()=>finish(detail));expect(view.onChange).not.toHaveBeenCalled();
});
it('does not apply a late append result after an account/token change',async()=>{
 storeAuthSession({accessToken:'synthetic-a',user:{id:10,username:'a',name:'A',roles:['AGENT']}});let finish!:(value:any)=>void;mocks.fromProduct.mockImplementation(()=>new Promise(resolve=>finish=resolve));const view=await selected();fireEvent.click(reviewChoice());fireEvent.click(submitChoice());
 act(()=>storeAuthSession({accessToken:'synthetic-b',user:{id:20,username:'b',name:'B',roles:['AGENT']}}));await waitFor(()=>expect(screen.queryByDisplayValue('Synthetic Master')).toBeNull());await act(async()=>finish(detail));expect(view.onChange).not.toHaveBeenCalled();
});
it('does not apply a late append response after the editor unmounts',async()=>{
 let finish!:(value:any)=>void;mocks.fromProduct.mockImplementation(()=>new Promise(resolve=>finish=resolve));const view=await selected();fireEvent.click(reviewChoice());fireEvent.click(submitChoice());view.unmount();await act(async()=>finish(detail));expect(view.onChange).not.toHaveBeenCalled();
});
it('requires an actual product revision instead of substituting an unknown version with zero',async()=>{
 localStorage.setItem('bobbuy_locale','en-US');mocks.products.mockResolvedValue([{product:{...syntheticProduct.product,recordVersion:undefined}}]);render(<I18nProvider><RecommendationFromProduct detail={detail} onChange={vi.fn()} onPendingChange={vi.fn()}/></I18nProvider>);
 await screen.findByRole('option',{name:/123.*Synthetic Master/});fireEvent.change(screen.getByRole('combobox'),{target:{value:'master'}});fireEvent.click(reviewChoice());expect(submitChoice()).toBeDisabled();expect(mocks.fromProduct).not.toHaveBeenCalled();
});
