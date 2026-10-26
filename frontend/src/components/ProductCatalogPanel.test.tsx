import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import ProductCatalogPanel from './ProductCatalogPanel';
import {I18nProvider} from '../i18n';
// jsdom's selector engine cannot parse Ant Select's :has sibling selector.
// Exercise the panel contract here; real Select behavior is covered in browser acceptance.
vi.mock('antd',async()=>{const actual=await vi.importActual<typeof import('antd')>('antd');return {...actual,Select:({options=[],value,onChange,...props}:any)=><select aria-label={props['aria-label']} value={value??''} onChange={event=>onChange?.(event.target.value)}><option value=""/>{options.map((option:any)=><option key={option.value} value={option.value}>{option.label}</option>)}</select>};});
const mock=vi.hoisted(()=>({get:vi.fn(),proposals:vi.fn(),preview:vi.fn(),save:vi.fn(),upload:vi.fn(),options:vi.fn()}));
vi.mock('../api',()=>({productCatalogApi:mock,recommendationTaxonomyApi:{options:mock.options}}));
const value={productId:'p1',version:7,name:{'ja-JP':'日本商品','zh-CN':'中文商品','zh-TW':'繁體商品','en-US':'Product'},description:{},itemNumber:'000123',brand:null,specification:{'ja-JP':'2個'},model:null,packaging:null,categoryIds:[],supplierId:null,gallery:[],translationsReviewed:true};
beforeEach(()=>{vi.clearAllMocks();localStorage.setItem('bobbuy_locale','en-US');mock.get.mockResolvedValue({value,canonical:false,sourceItemIds:[1]});mock.options.mockResolvedValue({categories:[],suppliers:[]});mock.proposals.mockResolvedValue([{value,changes:['master.canonical_save'],warnings:[]}]);mock.preview.mockImplementation(async rows=>rows.map((value:unknown)=>({value,changes:[],warnings:[]})));mock.save.mockResolvedValue([{value:{...value,version:8},canonical:true}]);});
it('edits four languages and requires review before versioned preview/save',async()=>{
 const onSaved=vi.fn();render(<I18nProvider><ProductCatalogPanel entries={[]} id="p1" onChoose={vi.fn()} onSaved={onSaved}/></I18nProvider>);
 await screen.findByDisplayValue('日本商品');expect(screen.getByRole('tab',{name:'繁體中文'})).toBeInTheDocument();
 const save=screen.getByRole('button',{name:/confirm and save/i});expect(save).toBeDisabled();
 const checks=screen.getAllByRole('checkbox');fireEvent.click(checks[checks.length-1]);fireEvent.click(save);
 await waitFor(()=>expect(onSaved).toHaveBeenCalled());expect(mock.preview).toHaveBeenCalledWith([value]);expect(mock.save).toHaveBeenCalledWith([value]);
 expect(mock.save.mock.calls[0][0][0]).not.toHaveProperty('basePrice');expect(mock.save.mock.calls[0][0][0]).not.toHaveProperty('sale');
});
it('requires a successful preview again after bulk JSON correction',async()=>{
 mock.proposals.mockResolvedValue([{value,changes:['master.canonical_save'],warnings:[]},{value:{...value,productId:'unrelated-no-source'},changes:[],warnings:['master.no_source']}]);
 render(<I18nProvider><ProductCatalogPanel entries={[]} onChoose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);
 fireEvent.click(screen.getByRole('button',{name:/review and complete/i}));fireEvent.click(await screen.findByRole('button',{name:/suggest/i}));
 const input=await screen.findByRole('textbox',{name:/json/i});await waitFor(()=>expect((input as HTMLTextAreaElement).value).toContain('p1'));
 expect((input as HTMLTextAreaElement).value).not.toContain('unrelated-no-source');
 fireEvent.change(input,{target:{value:'invalid'}});fireEvent.click(screen.getByRole('button',{name:/preview/i}));
 await waitFor(()=>expect(screen.getByRole('button',{name:/confirm and save/i})).toBeDisabled());expect(mock.save).not.toHaveBeenCalled();
});
