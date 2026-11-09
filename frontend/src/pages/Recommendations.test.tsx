// Public first-batch/body/service/cart/XSS cases now live in RecommendationHistory.test.tsx.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider } from '../i18n';
import Recommendations from './Recommendations';
const preparation = vi.hoisted(()=>({prepare:vi.fn()}));
vi.mock('../imageUpload',()=>({IMAGE_UPLOAD_ACCEPT:'image/png,image/jpeg,image/webp,image/avif',prepareImageUpload:preparation.prepare}));
vi.mock('../components/RecommendationClassification',()=>({default:()=>null}));
// jsdom selector engine cannot parse Ant Select's generated :has selector.
vi.mock('antd',async importOriginal=>{const actual=await importOriginal<typeof import('antd')>();return {...actual,Select:({options=[],onChange,value,...props}:any)=><select aria-label={props['aria-label']} value={value??''} onChange={e=>onChange?.(e.target.value)}><option value=""/>{options.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>};});
vi.mock('../components/RecommendationCatalog',()=>({default:()=>null}));
vi.mock('../components/RecommendationFromProduct',()=>({default:()=>null}));
vi.mock('../components/RecommendationGallery',()=>({default:()=>null}));
vi.mock('../components/RecommendationLocalization',()=>({default:()=>null}));
import PublicRecommendations from './PublicRecommendations';
import {serviceFixture} from '../serviceOffer.fixture';
const mocks = vi.hoisted(() => ({ get:vi.fn(),list:vi.fn(),feed:vi.fn(),create:vi.fn(),save:vi.fn(),publish:vi.fn(),write:vi.fn(),upload:vi.fn(),remove:vi.fn() }));
vi.mock('../api', () => ({ recommendationApi:mocks,storefrontApi:{products:vi.fn().mockResolvedValue([])} }));
const detail = { post:{id:1,title:'Tea picks',published:false,version:2,updatedAt:'2026-10-26T10:00:00'},body:'Original body',items:[
  {id:1,productId:'p1',name:'Tea',itemNumber:'TEA',referencePrice:100,imageUrl:'/source-tea.png',gallery:[{id:'img1',url:'/tea.png',hash:'fixture1',sourceUrl:'https://www.costco.co.jp/p/tea',assetKey:'tea',label:'Tea'}]},
  {id:2,productId:'p2',name:'Coffee',itemNumber:'COFFEE',referencePrice:200,imageUrl:'/source-coffee.png',gallery:[{id:'img2',url:'/coffee.png',hash:'fixture2',sourceUrl:'https://www.costco.co.jp/p/coffee',assetKey:'coffee',label:'Coffee'}]}] };
function show() { return render(<I18nProvider><MemoryRouter initialEntries={['/admin/recommendations?post=1']}><Recommendations /></MemoryRouter></I18nProvider>); }
const shopping = { products:[{id:'p1',merchantId:1000,name:{'zh-CN':'Tea'},description:{},brand:'',price:120,categoryId:'',images:['/tea.png']}], quantities:{p1:2}, onDetail:vi.fn(), onAdd:vi.fn(), canBuy:()=>true };
function publicFeed() { return render(<I18nProvider><MemoryRouter><PublicRecommendations {...shopping} /></MemoryRouter></I18nProvider>); }
describe('Recommendations', () => {
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); mocks.get.mockResolvedValue(structuredClone(detail)); mocks.feed.mockResolvedValue([structuredClone(detail)]);
    preparation.prepare.mockImplementation(async(file:File)=>file);
    URL.createObjectURL=vi.fn(()=>'blob:fixture'); URL.revokeObjectURL=vi.fn();
  });
  it('keeps a multi-page image batch and validates per-image metadata', async () => {
    const view = show(); await screen.findByDisplayValue('Tea picks');
    const files = Array.from({length:25},(_,i)=>new File(['png'],'image'+i+'.png',{type:'image/png'}));
    fireEvent.change(view.container.querySelector('input[type=file]')!, {target:{files}});
    await waitFor(()=>expect(view.container.querySelectorAll('.rec-upload-row')).toHaveLength(6));
    for (const input of view.container.querySelectorAll('.rec-facts-form label:first-child input')) fireEvent.change(input,{target:{value:''}});
    fireEvent.click(screen.getByRole('button',{name:/登记全部/}));
    expect(await screen.findAllByText('请填写商品名称，其他信息仅在来源注明时填写。')).toHaveLength(6);
    expect(view.container.querySelector('.ant-pagination-item-5')).toBeInTheDocument();
  });
  it('saves the returned article version without publishing the whole product issue',async()=>{
    localStorage.setItem('bobbuy_locale','en-US');mocks.save.mockResolvedValue({...detail,post:{...detail.post,title:'Updated picks',version:3}});
    show();await screen.findByDisplayValue('Tea picks');fireEvent.change(screen.getByLabelText('Title'),{target:{value:'Updated picks'}});fireEvent.click(screen.getByRole('button',{name:/Save Draft$/}));
    await waitFor(()=>expect(mocks.save).toHaveBeenCalledWith(1,'Updated picks','Original body',2));expect(mocks.publish).not.toHaveBeenCalled();expect(screen.queryByRole('button',{name:'Publish Recommendation'})).toBeNull();
  });
  it('prepares modern picker images before registration and submits the normalized PNG',async()=>{
    const converted=new File(['decoded pixels'],'official.png',{type:'image/png'});
    preparation.prepare.mockResolvedValue(converted);
    mocks.upload.mockResolvedValue({detail});
    const view=show();await screen.findByDisplayValue('Tea picks');
    const input=view.container.querySelector('input[type=file]')!;
    expect(input.getAttribute('accept')).toContain('image/avif');
    fireEvent.change(input,{target:{files:[new File(['avif'],'official.avif',{type:'image/avif'})]}});
    await waitFor(()=>expect(view.container.querySelectorAll('.rec-upload-row')).toHaveLength(1));
    fireEvent.click(view.container.querySelector('.rec-uploads .rec-action-group button:last-child')!);
    await waitFor(()=>expect(mocks.upload).toHaveBeenCalled());
    expect(mocks.upload.mock.calls[0][1]).toBe(converted);
    expect(mocks.upload.mock.calls[0][2]).toBe('official');
  });
  it('does not enqueue an image that finishes preparing after the editor unmounts',async()=>{
    let finish!:(file:File)=>void;
    preparation.prepare.mockImplementation(()=>new Promise<File>(resolve=>{finish=resolve;}));
    const view=show();await screen.findByDisplayValue('Tea picks');
    fireEvent.change(view.container.querySelector('input[type=file]')!,{target:{files:[new File(['avif'],'late.avif',{type:'image/avif'})]}});
    view.unmount();finish(new File(['png'],'late.png',{type:'image/png'}));
    await Promise.resolve();await Promise.resolve();
    expect(URL.createObjectURL).not.toHaveBeenCalled();expect(mocks.upload).not.toHaveBeenCalled();
  });
});
