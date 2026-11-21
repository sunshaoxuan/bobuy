import { act, cleanup, render, screen, fireEvent, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { I18nProvider } from '../i18n';
import React from 'react';
import { api } from '../api';
vi.mock('antd',async()=>{const actual=await vi.importActual<typeof import('antd')>('antd');const {CategoryTreeSelectMock}=await import('../test/CategoryTreeSelectMock');return {...actual,TreeSelect:CategoryTreeSelectMock};});
import {message} from 'antd';
vi.mock('../components/ProductCatalogPanel',()=>({default:()=>null}));
vi.mock('../components/ProductMarkerEditor',()=>({default:({productId}:{productId:string})=><output data-testid="marker-product-id">{productId}</output>}));

vi.mock('../api', () => ({
  categoryTreeApi:{list:()=>Promise.resolve([])},
  merchantArchivePageSize:24,
  api: {
    stockCategories: () => Promise.resolve([
      {
        id: 'cat-1000',
        name: { 'zh-CN': '食品', 'ja-JP': '食品', 'en-US': 'Food' },
        description: {},
        attributeTemplate: []
      },
      {
        id: 'cat-1001',
        name: { 'zh-CN': '服装', 'ja-JP': '衣料品', 'en-US': 'Clothing' },
        description: {},
        attributeTemplate: [
          { key: 'size', labelKey: 'stock.dynamic.size', type: 'select', options: ['S', 'M'] },
          { key: 'material', labelKey: 'stock.dynamic.material', type: 'text' }
        ]
      }
    ]),
    suppliers: () => Promise.resolve([]),
    merchantArchive: vi.fn(),
    merchantArchiveExport:vi.fn(),
    product:vi.fn(),
    products: () => Promise.resolve([
      {
        product: {
          id: 'prd-1000',
          cartEnabled: false,
          name: { 'zh-CN': 'Organic Milk', 'ja-JP': 'Organic Milk', 'en-US': 'Organic Milk' },
          categoryId: 'cat-1000',
          basePrice: 12.99,
          itemNumber: 'SKU-20934',
          attributes: { netContent: '1L', packSize: '1pack' },
          mediaGallery: []
        },
        displayName: 'Organic Milk',
        displayDescription: 'Fresh milk'
      },
      {
        product: {
          id: 'prd-1001',
          cartEnabled: true,
          name: { 'zh-CN': 'Fresh Spinach', 'ja-JP': 'Fresh Spinach', 'en-US': 'Fresh Spinach' },
          categoryId: 'cat-1000',
          basePrice: 4.49,
          itemNumber: 'SKU-88210',
          mediaGallery: []
        },
        displayName: 'Fresh Spinach',
        displayDescription: 'Leafy greens'
      }
    ]),
    translate: () => Promise.resolve({ translatedText: '' }),
    deleteProduct: vi.fn().mockResolvedValue(undefined),
    patchProduct: vi.fn().mockResolvedValue({}),
    previewCartAvailability: vi.fn(),
    enableCartAvailability: vi.fn(),
    createProduct:vi.fn().mockResolvedValue({product:{id:"manual-saved",name:{"ja-JP":"手入力"},description:{}},displayName:"手入力",categoryPath:""}),
    onboardConfirm: vi.fn().mockResolvedValue({
      product: { id: 'prd-new', name: { 'zh-CN': 'X' }, basePrice: 1 },
      displayName: 'X',
      displayDescription: 'X',
      allocatedBusinessIds: []
    })
  }
}));

import StockMaster, {stockItemFromResponse} from './StockMaster';

it('saves the product cart switch independently and reflects the persisted response', async () => {
  setMatchMedia(false);
  localStorage.setItem('bobbuy_locale', 'en-US');
  const save = vi.mocked(api.patchProduct);
  save.mockClear();
  save.mockResolvedValueOnce({product: {id: 'prd-1000', cartEnabled: true, name: {}, basePrice: 0},
    displayName: 'Organic Milk', displayDescription: ''});
  renderWithI18n(<StockMaster embedded />);
  const toggle = await screen.findByRole('switch', {name: 'Allow adding to cart Organic Milk'});
  expect(toggle).not.toBeChecked();
  fireEvent.click(toggle);
  await waitFor(() => expect(toggle).toBeChecked());
  expect(save).toHaveBeenCalledTimes(1);
  expect(save).toHaveBeenCalledWith('prd-1000', {cartEnabled: true});
});

it('previews bulk changes without writing, cancels, confirms and shows the empty state', async () => {
  setMatchMedia(true);
  localStorage.setItem('bobbuy_locale', 'en-US');
  const preview = vi.mocked(api.previewCartAvailability);
  const enable = vi.mocked(api.enableCartAvailability);
  enable.mockClear();
  preview.mockResolvedValue({count: 1, items: [{id: 'prd-1000', name: {'en-US': 'Organic Milk'}, itemNumber: 'SKU-20934'}],
    revision: 'reviewed-revision'});
  enable.mockResolvedValueOnce({enabledIds: ['prd-1000']});
  renderWithI18n(<StockMaster embedded />);
  const toggle = await screen.findByRole('switch', {name: 'Allow adding to cart Organic Milk'});
  const bulk = screen.getByRole('button', {name: 'Enable cart for all products'});
  fireEvent.click(bulk);
  let dialog = await screen.findByRole('dialog');
  await waitFor(() => expect(within(dialog).getByText('Products to enable: 1')).toBeVisible());
  expect(within(dialog).getByText('SKU-20934')).toBeVisible();
  expect(enable).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', {name: 'Cancel'}));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(enable).not.toHaveBeenCalled();
  expect(toggle).not.toBeChecked();

  fireEvent.click(bulk);
  dialog = await screen.findByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', {name: 'Confirm enablement'}));
  await waitFor(() => expect(toggle).toBeChecked());
  expect(enable).toHaveBeenCalledTimes(1);
  expect(enable).toHaveBeenCalledWith('reviewed-revision');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  preview.mockResolvedValueOnce({count: 0, items: [], revision: 'empty'});
  fireEvent.click(screen.getByRole('button', {name: 'All products are enabled'}));
  dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('status')).toHaveTextContent('All products are enabled');
  expect(within(dialog).getByRole('button', {name: 'Confirm enablement'})).toBeDisabled();
});

const detailsById=new Map<string,Awaited<ReturnType<typeof api.product>>>();
beforeEach(()=>{
 detailsById.clear();
 vi.mocked(api.merchantArchive).mockReset();
 vi.mocked(api.product).mockReset();
 vi.mocked(api.product).mockImplementation(async id=>detailsById.get(id)!);
 vi.mocked(api.merchantArchive).mockImplementation(async(page,query)=>{
  const details=await api.products();
  details.forEach(row=>detailsById.set(row.product.id,row));
  const rows=details.filter(row=>[row.displayName,row.product.itemNumber].some(text=>text?.toLowerCase().includes(query.toLowerCase())));
  return {total:rows.length,rows:rows.slice(page*24,(page+1)*24).map(({product,displayName,categoryPath,currentRegular})=>({
   id:product.id,name:displayName,itemNumber:product.itemNumber,categoryId:product.categoryId,categoryPath,currentRegular,
   cartEnabled:product.cartEnabled,
   catalogDriven:!!product.catalogData,privateDraft:product.visibilityStatus==='DRAFTER_ONLY',
   mediaCount:product.mediaGallery?.length??0,image:product.mediaGallery?.find(media=>media.type?.toLowerCase()==='image')?.url
  }))};
 });
});
// Top-level cases must have the same isolation as the grouped cases. A timed
// out async body must never later call cleanup() on the next case's mounted UI.
afterEach(()=>{message.destroy();vi.restoreAllMocks();window.localStorage.clear();});

it('waits for persistence and keeps the drawer and entered values when saving fails',async()=>{
 localStorage.setItem('bobbuy_locale','en-US');setMatchMedia(false);
 const success=vi.spyOn(message,'success');success.mockClear();
 let reject!: (reason:Error)=>void;
 vi.mocked(api.patchProduct).mockImplementationOnce(()=>new Promise((_,fail)=>{reject=fail;}));
 renderWithI18n(<StockMaster/>);
 await screen.findByText('Organic Milk');
 fireEvent.click(screen.getAllByRole('button').find(button=>button.querySelector('.anticon-edit'))!);
 const drawer=await screen.findByRole('dialog');
 const sku=within(drawer).getByDisplayValue('SKU-20934');fireEvent.change(sku,{target:{value:'SYNTHETIC-RETRY'}});
 const saveButton=within(drawer).getByRole('button',{name:'Save & Close'});
 fireEvent.click(saveButton);
 await waitFor(()=>expect(reject).toBeTypeOf('function'));
 expect(screen.getByRole('dialog')).toBeInTheDocument();expect(success).not.toHaveBeenCalled();
 await act(async()=>{reject(new Error('Synthetic rejected save'));});
 // Ant's loading icon changes the accessible name while pending. Observe the
 // original control instead of re-querying a temporarily different name.
 await waitFor(()=>expect(saveButton).not.toHaveClass('ant-btn-loading'),{timeout:5000});
 expect(within(drawer).getByDisplayValue('SYNTHETIC-RETRY')).toBeInTheDocument();expect(success).not.toHaveBeenCalled();
 expect(screen.getAllByText('SKU-20934').length).toBeGreaterThan(0);
 fireEvent.click(saveButton);
 await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());expect(success).toHaveBeenCalledTimes(1);
 // Two persistence attempts plus Drawer close animation can exceed five seconds
 // under the hosted four-worker gate. Keep every state/assertion, with a bound.
},15000);

it('uses the real uppercase IMAGE gallery in embedded browsing and retains editable management',async()=>{
 setMatchMedia(false);
 const spy=vi.spyOn(api,'products').mockResolvedValueOnce([{product:{id:'visual-uppercase',name:{'zh-CN':'官方图片商品'},categoryId:'cat-1000',basePrice:0,itemNumber:'000123',mediaGallery:[{url:'/official-synthetic.png',type:'IMAGE'}]},displayName:'官方图片商品',displayDescription:''}] as Awaited<ReturnType<typeof api.products>>);
 window.localStorage.setItem('bobbuy_locale','zh-CN');
 try{
  render(<I18nProvider><StockMaster embedded/></I18nProvider>);
  const image=await screen.findByRole('img',{name:'官方图片商品'});expect(image).toHaveAttribute('src','/official-synthetic.png');
  fireEvent.click(screen.getByText('紧凑管理',{exact:true}));await screen.findByText('000123');
 }finally{spy.mockRestore();}
});

it('preserves gallery visibility and uppercases media types when patching an existing product',async()=>{
 setMatchMedia(false);window.localStorage.setItem('bobbuy_locale','en-US');
 const products=vi.spyOn(api,'products').mockResolvedValueOnce([{product:{id:'gallery-patch',name:{'en-US':'Hidden gallery product'},categoryId:'cat-1000',basePrice:0,itemNumber:'000124',mediaGallery:[{url:'/hidden.png',type:'IMAGE',visible:false}]},displayName:'Hidden gallery product',displayDescription:''}] as Awaited<ReturnType<typeof api.products>>);
 renderWithI18n(<StockMaster/>);await screen.findByText('Hidden gallery product');
 fireEvent.click(screen.getAllByRole('button').find(button=>button.querySelector('.anticon-edit'))!);
 const drawer=await screen.findByRole('dialog');expect(within(drawer).getByRole('checkbox')).not.toBeChecked();
 fireEvent.click(within(drawer).getByRole('button',{name:'Save & Close'}));
 await waitFor(()=>expect(api.patchProduct).toHaveBeenCalledWith('gallery-patch',expect.objectContaining({mediaGallery:[expect.objectContaining({url:'/hidden.png',type:'IMAGE',visible:false})]})));
 products.mockRestore();
});

it('shows confirmed regular prices and pending status instead of base prices in compact management',async()=>{
 setMatchMedia(false);window.localStorage.setItem('bobbuy_locale','en-US');
 vi.spyOn(api,'products').mockResolvedValueOnce([
  {product:{id:'confirmed',name:{'en-US':'Confirmed'},categoryId:'cat-1000',basePrice:0,itemNumber:'C'},displayName:'Confirmed',displayDescription:'',currentRegular:{amount:1200,currency:'JPY',unit:'pack',revision:1,enabled:true}},
  {product:{id:'pending',name:{'en-US':'Pending'},categoryId:'cat-1000',basePrice:999,itemNumber:'P'},displayName:'Pending',displayDescription:'',currentRegular:null}
 ] as Awaited<ReturnType<typeof api.products>>);
 renderWithI18n(<StockMaster/>);await screen.findByText('Confirmed');
 expect(screen.getByText('JPY ¥1,200')).toBeInTheDocument();expect(screen.getByText('Selling price pending')).toBeInTheDocument();expect(screen.queryByText('JPY ¥999')).not.toBeInTheDocument();
});

const MOBILE_VIEWPORT_WIDTH = 375;
it.each([false,true])('opens markers for the saved product at mobile=%s',async mobile=>{
 setMatchMedia(mobile);window.localStorage.setItem('bobbuy_locale','en-US');
 render(<I18nProvider><StockMaster/></I18nProvider>);
 const entry=await screen.findByRole('button',{name:'Product markers Organic Milk'});
 fireEvent.click(entry);expect(await screen.findByTestId('marker-product-id')).toHaveTextContent('prd-1000');
});

const DESKTOP_VIEWPORT_WIDTH = 1280;

const createMatchMedia = (isMobile: boolean, desktopWidth = DESKTOP_VIEWPORT_WIDTH) => vi.fn().mockImplementation((query: string) => {
  const viewportWidth = isMobile ? MOBILE_VIEWPORT_WIDTH : desktopWidth;
  const min = /min-width:\s*(\d+)px/.exec(query);
  const max = /max-width:\s*(\d+)px/.exec(query);
  let matches = true;
  if (min) {
    matches = matches && viewportWidth >= Number(min[1]);
  }
  if (max) {
    matches = matches && viewportWidth <= Number(max[1]);
  }
  return {
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
});

const setMatchMedia = (isMobile: boolean, desktopWidth = DESKTOP_VIEWPORT_WIDTH) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: createMatchMedia(isMobile, desktopWidth),
  });
};

const renderWithI18n = (ui: React.ReactElement) => {
  return render(<I18nProvider>{ui}</I18nProvider>);
};

describe('StockMaster Component', () => {
  beforeEach(() => {
    window.localStorage.setItem('bobbuy_locale', 'zh-CN');
    setMatchMedia(false);
  });

  afterEach(async () => {
    cleanup();
    window.localStorage.clear();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('hides low-priority columns at the narrower desktop breakpoint', async () => {
    setMatchMedia(false, 1024);
    renderWithI18n(<StockMaster />);
    await screen.findByText('Organic Milk');
    expect(screen.queryByRole('columnheader', { name: /价格/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /状态/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button').some(button => button.querySelector('.anticon-edit'))).toBe(true);
  });

  it('uses a short price heading and exposes the JPY unit description', async () => {
    renderWithI18n(<StockMaster />);
    await screen.findByText(/Organic Milk/i);

    const priceHeading = screen.getByRole('columnheader', { name: '价格（日元 JPY）' });
    expect(priceHeading).toHaveTextContent(/^价格$/);
    expect(screen.queryByText('价格 (USD) (JPY)')).not.toBeInTheDocument();
  });


  it('renders the stock master page with title and initial data', async () => {
    renderWithI18n(<StockMaster />);
    expect(screen.getByText(/库存大师 - 批量上架/i)).toBeInTheDocument();
    expect(await screen.findByText(/Organic Milk/i)).toBeInTheDocument();
    expect(await screen.findByText(/Fresh Spinach/i)).toBeInTheDocument();
  });

  it('adds a new row when clicking "新增商品"', async () => {
    renderWithI18n(<StockMaster />);
    const addButton = screen.getByText(/新增商品/i);
    fireEvent.click(addButton);
    
    // Check for "待发布" status tag which indicates a new row
    const pendingTags = await screen.findAllByText(/待发布/i);
    expect(pendingTags.length).toBeGreaterThan(0);
  });

  it('keeps compact values read-only and edits them in the drawer', async () => {
    renderWithI18n(<StockMaster />);
    await screen.findByText(/Organic Milk/i);
    fireEvent.click(screen.getAllByRole('button').find(button => button.querySelector('.anticon-edit'))!);
    const drawer = await screen.findByRole('dialog');
    const nameInput = within(drawer).getByDisplayValue('Organic Milk');
    fireEvent.change(nameInput, { target: { value: 'Updated Milk' } });
    expect(nameInput).toHaveValue('Updated Milk');
  });

  it('filters table rows based on search input', async () => {
    renderWithI18n(<StockMaster />);
    const searchInput = screen.getByPlaceholderText(/搜索商品名称 or SKU.../i);
    fireEvent.change(searchInput, { target: { value: 'Milk' } });
    
    expect(await screen.findByText(/Organic Milk/i)).toBeInTheDocument();
    expect(screen.queryByText(/Fresh Spinach/i)).not.toBeInTheDocument();
  });

  it('opens editing drawer and updates values', async () => {
    renderWithI18n(<StockMaster />);
    await screen.findByText(/Organic Milk/i);
    const editButtons = screen.getAllByRole('button').filter(btn => btn.querySelector('.anticon-edit'));
    fireEvent.click(editButtons[0]);
    
    expect(await screen.findByText(/编辑商品详情/i)).toBeInTheDocument();
    // Use drawer-scoped SKU input to avoid matching table inline editors
    const drawer = await screen.findByRole('dialog');
    const skuInput = within(drawer).getByPlaceholderText(/输入唯一 SKU 编号/i);
    fireEvent.change(skuInput, { target: { value: 'NEW-SKU-999' } });
    
    const saveButton = screen.getByText(/保存并关闭/i);
    fireEvent.click(saveButton);
    
    await waitForElementToBeRemoved(() => screen.queryByRole('dialog'));
  });

  it('deletes a row when clicking the delete button', async () => {
    renderWithI18n(<StockMaster />);
    await screen.findByText(/Organic Milk/i);
    const initialRows = screen.getAllByRole('row');
    const deleteButtons = screen.getAllByRole('button').filter(btn => btn.querySelector('.anticon-delete'));
    
    fireEvent.click(deleteButtons[0]);
    
    await waitFor(() => {
      const finalRows = screen.getAllByRole('row');
      expect(finalRows.length).toBe(initialRows.length - 1);
    });
  });

  it('shows error message and does not remove row when delete fails', async () => {
    vi.mocked(api.deleteProduct).mockRejectedValueOnce(new Error('Server error'));
    renderWithI18n(<StockMaster />);
    await screen.findByText(/Organic Milk/i);
    const initialRows = screen.getAllByRole('row');
    const deleteButtons = screen.getAllByRole('button').filter(btn => btn.querySelector('.anticon-delete'));

    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      const finalRows = screen.getAllByRole('row');
      expect(finalRows.length).toBe(initialRows.length);
    });
  });

  it('labels the photo intake entry directly', async () => {
    renderWithI18n(<StockMaster />);
    await screen.findByText(/Organic Milk/i);
    expect(screen.getByRole('button', { name: /拍照识别商品/ })).toBeInTheDocument();
  });

  it('renders category-specific dynamic attributes in drawer', async () => {
    renderWithI18n(<StockMaster />);
    await screen.findByText(/Organic Milk/i);
    const editButtons = screen.getAllByRole('button').filter(btn => btn.querySelector('.anticon-edit'));
    fireEvent.click(editButtons[0]);

    const drawer = await screen.findByRole('dialog');
    const categoryInput = within(drawer).getByRole('textbox', { name: /类目|Category/i });
    fireEvent.change(categoryInput, { target: { value: '服装' } });

    await waitFor(() => {
      expect(within(drawer).getByText(/分类属性|Category Attributes/i)).toBeInTheDocument();
      expect(within(drawer).getByLabelText(/尺码|Size/i)).toBeInTheDocument();
      expect(within(drawer).getByLabelText(/材质|Material/i)).toBeInTheDocument();
    });
  });

});

it('shows the resolved primary category path instead of the legacy category label',async()=>{
 setMatchMedia(false);localStorage.setItem('bobbuy_locale','en-US');
 vi.spyOn(api,'products').mockResolvedValueOnce([{product:{id:'category-primary',name:{'en-US':'Synthetic juice'},categoryId:'cat-1000',basePrice:0,itemNumber:'PATH'},displayName:'Synthetic juice',displayDescription:'',categoryPath:'Drinks › Juice'}] as Awaited<ReturnType<typeof api.products>>);
 render(<I18nProvider><StockMaster embedded/></I18nProvider>);expect(await screen.findByText('Drinks › Juice')).toBeInTheDocument();
});


it.each([false,true])('manual creation saves translations without AI and keeps failed input for retry, mobile=%s',async mobile=>{
 setMatchMedia(mobile);localStorage.setItem('bobbuy_locale','en-US');
 const create=vi.mocked(api.createProduct);create.mockReset();create.mockResolvedValue({product:{id:'manual-saved',name:{'ja-JP':'手入力'},description:{},basePrice:0},displayName:'手入力',displayDescription:'',categoryPath:''} as Awaited<ReturnType<typeof api.createProduct>>);create.mockRejectedValueOnce(new Error('Synthetic save failure'));
 const ai=vi.mocked(api.onboardConfirm);ai.mockClear();const translate=vi.spyOn(api,'translate');
 renderWithI18n(<StockMaster/>);await screen.findByText('Organic Milk');
 fireEvent.click(screen.getByTestId('stock-master-add-row'));
 const drawer=screen.getByRole('dialog');const save=within(drawer).getByRole('button',{name:'Save & Close'});
 fireEvent.click(save);await screen.findByText(/Japanese source name is required/i);expect(create).not.toHaveBeenCalled();
 const firstItem=drawer.querySelector('.ant-form-item')!;
 fireEvent.change(within(firstItem as HTMLElement).getByRole('textbox'),{target:{value:'中文新商品'}});
 fireEvent.click(within(firstItem as HTMLElement).getByRole('button',{name:'ja-JP'}));
 fireEvent.change(within(firstItem as HTMLElement).getByRole('textbox'),{target:{value:'手入力'}});
 fireEvent.click(save);await waitFor(()=>expect(create).toHaveBeenCalledTimes(1));
 await waitFor(()=>expect(save).not.toHaveClass('ant-btn-loading'));
 expect(screen.getByRole('dialog')).toBeInTheDocument();expect(within(drawer).getByDisplayValue('手入力')).toBeInTheDocument();
 fireEvent.click(save);await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
 expect(create).toHaveBeenCalledTimes(2);expect(create.mock.calls[0][0].requestId).toEqual(create.mock.calls[1][0].requestId);
 expect(create.mock.calls[1][0]).toMatchObject({name:{'zh-CN':'中文新商品','ja-JP':'手入力'},categoryNodeId:null});
 expect(ai).not.toHaveBeenCalled();expect(translate).not.toHaveBeenCalled();
},15000);

it('maps retry and AI responses entirely from persisted fields and actual visibility',()=>{
 const response={product:{id:'server-id',name:{'ja-JP':'保存名'},description:{'en-US':'Saved'},basePrice:0,brand:'Saved brand',itemNumber:'SAVED-ITEM',categoryId:undefined,attributes:{packSize:'saved'},merchantSkus:{supplier:'SAVED-CODE'},storageCondition:'CHILLED',orderMethod:'PRE_ORDER',visibilityStatus:'PUBLIC',mediaGallery:[],priceTiers:[]},displayName:'保存名',displayDescription:'Saved',categoryPath:'Saved path'} as Awaited<ReturnType<typeof api.createProduct>>;
 expect(stockItemFromResponse(response)).toMatchObject({key:'server-id',brand:'Saved brand',sku:'SAVED-ITEM',categoryPath:'Saved path',category:'',catalogDriven:false,visibilityStatus:'PUBLIC',dynamicAttributes:{packSize:'saved'},merchantSkus:{supplier:'SAVED-CODE'},storageCondition:'CHILLED',orderMethod:'PRE_ORDER',isNew:false});
 response.product.catalogData={specification:{'ja-JP':'保存仕様'}};response.product.visibilityStatus='DRAFTER_ONLY';
 expect(stockItemFromResponse(response)).toMatchObject({specificationL10n:{'ja-JP':'保存仕様'},catalogDriven:true,visibilityStatus:'DRAFTER_ONLY'});
});


it('requests pages and searches the entire archive while ignoring an older slow response',async()=>{
 setMatchMedia(false);localStorage.setItem('bobbuy_locale','en-US');
 const result=(id:string,name:string,total=520)=>({total,rows:[{id,name,mediaCount:0,catalogDriven:true,privateDraft:true}]});
 const list=vi.mocked(api.merchantArchive);
 let late!:(response:Awaited<ReturnType<typeof api.merchantArchive>>)=>void;
 list.mockImplementation((page,query)=>{
  if(query==='slow')return new Promise(resolve=>{late=resolve;});
  if(query==='target')return Promise.resolve(result('520','Later record',1));
  if(page===1)return Promise.resolve(result('25','Page two'));
  return Promise.resolve(result('1','Page one'));
 });
 renderWithI18n(<StockMaster embedded/>);
 await screen.findByText('Page one');
 fireEvent.click(screen.getByRole('button',{name:'Next'}));
 await screen.findByText('Page two');
 const search=screen.getByPlaceholderText(/search.*SKU/i);
 fireEvent.change(search,{target:{value:'slow'}});
 await waitFor(()=>expect(late).toBeTypeOf('function'));
 fireEvent.change(search,{target:{value:'target'}});
 await screen.findByText('Later record');
 await act(async()=>late(result('2','Obsolete')));
 expect(screen.queryByText('Obsolete')).not.toBeInTheDocument();
 expect(list).toHaveBeenCalledWith(0,'target',expect.any(AbortSignal));
});

it('retries the failed archive page',async()=>{
 setMatchMedia(false);localStorage.setItem('bobbuy_locale','en-US');
 vi.mocked(api.merchantArchive).mockRejectedValueOnce(new Error('offline'));
 renderWithI18n(<StockMaster embedded/>);
 await screen.findByText('Product archive could not be loaded.');
 fireEvent.click(screen.getByRole('button',{name:'Retry'}));
 await screen.findByText('Organic Milk');
});

it('previews disabled products from other pages even when all visible products are enabled', async () => {
  setMatchMedia(false);
  localStorage.setItem('bobbuy_locale', 'en-US');
  let disabled = true;
  vi.mocked(api.merchantArchive).mockImplementation(async page => ({
    total: 25,
    allCartEnabled: !disabled,
    rows: [{id: page ? 'other-page' : 'first-page', name: page ? 'Other page' : 'First page',
      mediaCount: 0, catalogDriven: false, privateDraft: false, cartEnabled: page === 0 || !disabled}]
  }));
  vi.mocked(api.previewCartAvailability).mockResolvedValueOnce({
    count: 1, items: [{id: 'other-page', name: {'en-US': 'Other page'}, itemNumber: null}], revision: 'all-pages'
  });
  const enable = vi.mocked(api.enableCartAvailability);
  enable.mockImplementationOnce(async () => {
    disabled = false;
    return {enabledIds: ['other-page']};
  });
  renderWithI18n(<StockMaster embedded />);
  expect(await screen.findByRole('switch', {name: 'Allow adding to cart First page'})).toBeChecked();
  fireEvent.click(screen.getByRole('button', {name: 'Enable cart for all products'}));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByText('Other page')).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', {name: 'Confirm enablement'}));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(enable).toHaveBeenCalledWith('all-pages');
  fireEvent.click(screen.getByRole('button', {name: 'Next'}));
  expect(await screen.findByRole('switch', {name: 'Allow adding to cart Other page'})).toBeChecked();
});
