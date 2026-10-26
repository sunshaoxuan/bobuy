import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { I18nProvider } from '../i18n';
import Recommendations from './Recommendations';
vi.mock('../components/RecommendationClassification',()=>({default:()=>null}));
vi.mock('../components/RecommendationCatalog',()=>({default:()=>null}));
import PublicRecommendations from './PublicRecommendations';
const mocks = vi.hoisted(() => ({ get:vi.fn(),list:vi.fn(),feed:vi.fn(),create:vi.fn(),save:vi.fn(),publish:vi.fn(),write:vi.fn(),upload:vi.fn(),remove:vi.fn() }));
vi.mock('../api', () => ({ recommendationApi:mocks }));
const detail = { post:{id:1,title:'Tea picks',published:false,version:2,updatedAt:'2026-10-26T10:00:00'},body:'Original body',items:[
  {id:1,productId:'p1',name:'Tea',itemNumber:'TEA',referencePrice:100,imageUrl:'/tea.png'},
  {id:2,productId:'p2',name:'Coffee',itemNumber:'COFFEE',referencePrice:200,imageUrl:'/coffee.png'}] };
function show() { return render(<I18nProvider><MemoryRouter initialEntries={['/admin/recommendations?post=1']}><Recommendations /></MemoryRouter></I18nProvider>); }
const shopping = { products:[{id:'p1',merchantId:1000,name:{'zh-CN':'Tea'},description:{},brand:'',price:120,categoryId:'',images:['/tea.png']}], quantities:{p1:2}, onDetail:vi.fn(), onAdd:vi.fn(), canBuy:()=>true };
function publicFeed() { return render(<I18nProvider><MemoryRouter><PublicRecommendations {...shopping} /></MemoryRouter></I18nProvider>); }
describe('Recommendations', () => {
  it('shows full image sets for multiple issues and independently expands their bodies', async () => {
    mocks.feed.mockResolvedValue([detail,{...detail,post:{...detail.post,id:2,title:'Second issue'},body:'Second body '.repeat(40)}].map((entry,index)=>({...entry,body:entry.body.repeat(index ? 1 : 50)+'END'+index})));
    const view=publicFeed(); await screen.findByRole('heading',{name:'Second issue'});
    expect(view.container.querySelectorAll('.rec-public-products .rec-pin')).toHaveLength(4);
    expect(screen.queryByText(/END0/)).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button',{name:/展开全文/})[0]);
    expect(screen.getByText(/END0/)).toBeInTheDocument();
    expect(screen.queryByText(/END1/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:/收起正文/}));
    expect(screen.queryByText(/END0/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('最新一期',{exact:true}));
    expect(screen.queryByRole('heading',{name:'Second issue'})).not.toBeInTheDocument();
    expect(view.container.querySelectorAll('.rec-public-products .rec-pin')).toHaveLength(2);
    fireEvent.click(screen.getByText('多期推荐',{exact:true}));
    expect(screen.getByRole('heading',{name:'Second issue'})).toBeInTheDocument();
    expect(view.container.querySelector('.rec-issue-directory a[href="#recommendation-2"]')).toBeInTheDocument();
  });
  it('uses the catalog product for details and cart, and disables missing products', async () => {
    mocks.feed.mockResolvedValue([detail]); const view=publicFeed(); await screen.findByRole('heading',{name:'Tea picks'});
    fireEvent.click(view.container.querySelectorAll('.product-photo')[0]);
    expect(shopping.onDetail).toHaveBeenCalledWith(shopping.products[0]);
    fireEvent.click(view.container.querySelectorAll('.product-add')[0]);
    expect(shopping.onAdd).toHaveBeenCalledWith(shopping.products[0]);
    expect(shopping.onAdd.mock.calls[0][0].price).toBe(120);
    expect(view.container.querySelectorAll('.product-add')[1]).toBeDisabled();
  });
  beforeEach(() => {
    vi.clearAllMocks(); localStorage.clear(); mocks.get.mockResolvedValue(structuredClone(detail));
    URL.createObjectURL=vi.fn(()=>'blob:fixture'); URL.revokeObjectURL=vi.fn();
  });
  it('keeps a multi-page image batch and validates per-image metadata', async () => {
    const view = show(); await screen.findByDisplayValue('Tea picks');
    const files = Array.from({length:25},(_,i)=>new File(['png'],'image'+i+'.png',{type:'image/png'}));
    fireEvent.change(view.container.querySelector('input[type=file]')!, {target:{files}});
    expect(screen.getAllByText('待登记')).toHaveLength(6);
    for (const input of view.container.querySelectorAll('.rec-facts-form label:first-child input')) fireEvent.change(input,{target:{value:''}});
    fireEvent.click(screen.getByRole('button',{name:/登记全部/}));
    expect(await screen.findAllByText('请填写商品名称，其他信息仅在来源注明时填写。')).toHaveLength(6);
    expect(view.container.querySelector('.ant-pagination-item-5')).toBeInTheDocument();
  });
  it('saves and publishes the returned version', async () => {
    mocks.save.mockResolvedValue({...detail,post:{...detail.post,title:'Updated picks',version:3}});
    mocks.publish.mockResolvedValue({...detail,post:{...detail.post,title:'Updated picks',version:4,published:true}});
    show(); await screen.findByDisplayValue('Tea picks');
    fireEvent.change(screen.getByLabelText('文章标题'),{target:{value:'Updated picks'}});
    fireEvent.click(screen.getByRole('button',{name:/发表文章/}));
    await waitFor(()=>expect(mocks.publish).toHaveBeenCalledWith(1,3,true));
    expect(mocks.save).toHaveBeenCalledWith(1,'Updated picks','Original body',2);
    expect(await screen.findByRole('button',{name:/撤回编辑/})).toBeInTheDocument();
  });
  it('public articles render text without executing HTML', async () => {
    mocks.feed.mockResolvedValue([{...detail,post:{...detail.post,published:true,title:'<script>alert(1)</script>',coverImageUrl:'/tea.png'}}]);
    const view=render(<I18nProvider><MemoryRouter><PublicRecommendations {...shopping} /></MemoryRouter></I18nProvider>);
    expect(await screen.findByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(view.container.querySelector('script')).toBeNull();
    expect(view.container.querySelector('.rec-products-heading a')).toHaveAttribute('href','/recommendations/1');
    expect(view.container.querySelector('.rec-public-products img')).toHaveAttribute('src','/tea.png');
  });
  it('shows the recorded publisher and server publication time with the article title', async () => {
    mocks.get.mockResolvedValue({...detail,post:{...detail.post,published:true,publisherName:'Publication fixture',publishedAt:'2026-10-26T01:00:00Z'}});
    const view=render(<I18nProvider><MemoryRouter initialEntries={['/recommendations/1']}><Routes><Route path="/recommendations/:id" element={<PublicRecommendations {...shopping} />} /></Routes></MemoryRouter></I18nProvider>);
    expect(await screen.findByRole('heading',{level:1,name:'Tea picks'})).toBeInTheDocument();
    expect(screen.getByText(/Publication fixture/)).toBeInTheDocument();
    expect(view.container.querySelector('time')).toHaveAttribute('datetime','2026-10-26T01:00:00Z');
    expect(view.container.querySelectorAll('.rec-public-products .product-tile')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button',{name:/查看原图: Tea/}));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
