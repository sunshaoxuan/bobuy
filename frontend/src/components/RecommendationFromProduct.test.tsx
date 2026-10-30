import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import RecommendationFromProduct from './RecommendationFromProduct';
const mocks=vi.hoisted(()=>({products:vi.fn(),fromProduct:vi.fn()}));
vi.mock('../api',()=>({api:{products:mocks.products},recommendationApi:{fromProduct:mocks.fromProduct}}));
// jsdom cannot parse Ant Design's generated :not/:has selector; browser QA covers the real Select.
vi.mock('antd',async importOriginal=>{const actual=await importOriginal<typeof import('antd')>();return {...actual,Select:({options,onChange,value,...props}:any)=><select aria-label={props['aria-label']} value={value??''} onChange={e=>onChange(e.target.value)}><option value=""/>{options.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>};});
const detail={post:{id:4,version:2,published:false},body:'',items:[]} as any;
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();mocks.products.mockResolvedValue([{product:{id:'master',name:{'ja-JP':'ごま油','zh-CN':'芝麻油'},itemNumber:'00123',recordVersion:7,catalogData:{}}}]);});
it('selects master before registration, keeps identity read-only and requires review',async()=>{
 const onChange=vi.fn(),pending=vi.fn();mocks.fromProduct.mockResolvedValue({...detail,items:[{productId:'master'}]});
 const view=render(<I18nProvider><RecommendationFromProduct detail={detail} onChange={onChange} onPendingChange={pending}/></I18nProvider>);
 await screen.findByText(/00123 · 芝麻油/);fireEvent.change(screen.getByRole('combobox'),{target:{value:'master'}});
 expect(screen.getByDisplayValue('ごま油')).toBeDisabled();expect(screen.getByDisplayValue('00123')).toBeDisabled();
 const submit=screen.getByRole('button',{name:'使用所选主档登记本期'});expect(submit).toBeDisabled();
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(submit);await waitFor(()=>expect(mocks.fromProduct).toHaveBeenCalledWith(4,{productId:'master',productVersion:7,facts:{name:'ごま油',itemNumber:'00123'},version:2,reviewed:true}));
 await waitFor(()=>expect(onChange).toHaveBeenCalled());expect(pending).toHaveBeenCalledWith(false);expect(view.container.querySelector('input[type=file]')).toBeNull();
});
it('does not offer registration for a published issue',()=>{render(<I18nProvider><RecommendationFromProduct detail={{...detail,post:{...detail.post,published:true}}} onChange={vi.fn()} onPendingChange={vi.fn()}/></I18nProvider>);expect(screen.queryByRole('combobox')).toBeNull();});
