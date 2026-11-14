import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {createMemoryRouter,RouterProvider,useNavigate} from 'react-router-dom';
import {I18nProvider,translate} from '../i18n';
import {serviceFixture} from '../serviceOffer.fixture';
import {storeAuthSession} from '../authStorage';
import Recommendations from './Recommendations';
const mocks=vi.hoisted(()=>({get:vi.fn(),list:vi.fn(),publishItem:vi.fn(),publish:vi.fn(),save:vi.fn(),products:vi.fn(),sourceRepairPreview:vi.fn(),sourceRepairApply:vi.fn(),localeRepairPreview:vi.fn(),localeRepairApply:vi.fn()}));
// Select injects CSS selectors unsupported by jsdom/nwsapi even with its dropdown closed.
// Keep FactsForm and the real confirmation modal so draft retention and consent are exercised.
vi.mock('antd',async()=>{
 const actual=await vi.importActual<typeof import('antd')>('antd');
 return {...actual,Select:({id,options=[],value,onChange,disabled,'aria-label':label}:any)=>(
  <select id={id} aria-label={label} disabled={disabled} value={value??''} onChange={event=>onChange?.(event.target.value)}>
   <option value=""/>{options.map((option:any)=><option key={option.value} value={option.value}>{option.label}</option>)}
  </select>
 )};
});
vi.mock('../api',()=>({api:{products:mocks.products},recommendationApi:mocks,storefrontApi:{products:mocks.products}}));
vi.mock('../components/RecommendationList',()=>({default:()=>null}));
vi.mock('../components/RecommendationClassification',()=>({default:({detail}:any)=><div data-testid="classification-items">{detail.items.map((item:any)=>item.id).join(',')}</div>}));
vi.mock('../components/RecommendationCatalog',()=>({default:()=>null}));
vi.mock('../components/RecommendationFromProduct',()=>({default:()=>null}));
vi.mock('../components/RecommendationLocalization',()=>({default:()=>null}));
vi.mock('../components/RecommendationGallery',()=>({default:()=>null}));
vi.mock('../components/ReferenceQuoteHistory',()=>({default:()=>null}));
vi.mock('../components/RecommendationServiceEditor',()=>({default:()=>null}));
vi.mock('../components/ArticleLanguages',()=>({default:({title,body,disabled,onTitle,onBody}:any)=><><input aria-label="Title" value={title} disabled={disabled} onChange={e=>onTitle(e.target.value)}/><textarea aria-label="Body" value={body} disabled={disabled} onChange={e=>onBody(e.target.value)}/></>}));
const ready={id:801,name:'Ready Tea',itemNumber:'READY',productId:'product-ready',referencePrice:100,imageUrl:'/synthetic-ready.png',publicationState:'PENDING',publicationReviewHash:'a'.repeat(64),publicationProductVersion:2};
const missing={id:802,name:'Missing 1731065',itemNumber:'1731065',referencePrice:200,imageUrl:'/synthetic-gap.png',publicationState:'PENDING'};
const draft={post:{id:8,title:'Original issue',version:4,published:false,updatedAt:'2026-11-09'},body:'Saved article body',items:[ready,missing]};
const clone=<T,>(value:T):T=>structuredClone(value);
const originalScrollIntoView=HTMLElement.prototype.scrollIntoView;
function published(value:any,itemId=801){return {...clone(value),post:{...value.post,published:true,version:value.post.version+1},items:value.items.map((item:any)=>item.id===itemId?{...item,publicationState:'PUBLISHED'}:{...item})};}
function RouteControl(){const navigate=useNavigate();return <button onClick={()=>navigate('/admin/recommendations?post=2')}>Other issue</button>;}
function show(postId=8){const router=createMemoryRouter([{path:'*',element:<><RouteControl/><Recommendations/></>}],{initialEntries:['/admin/recommendations?post='+postId]});return render(<I18nProvider><RouterProvider router={router}/></I18nProvider>);}
const card=(name:string)=>within(screen.getByRole('heading',{name}).closest('article')!);
function review(name='Ready Tea'){fireEvent.click(card(name).getByRole('checkbox',{name:/I checked this item/}));}
const publishButton=(name='Ready Tea')=>card(name).getByRole('button',{name:'Publish this item: '+name});
it.each([
 {target:'SOURCE_CONTEXT',action:'Preview source fix',title:'Review source-context suggestions'},
 {target:'PRODUCT_MASTER',action:'Generate AI suggestion',title:'Review AI locale suggestions'}
])('opens the $target repair directly from the missing-items panel without saving',async({target,action,title})=>{
 mocks.publishItem.mockRejectedValue(Object.assign(new Error('Missing facts'),{status:400,conditions:[{code:'MISSING',message:'Repair this missing field',target}]}));
 mocks.sourceRepairPreview.mockResolvedValue({postId:8,version:4,items:[]});mocks.localeRepairPreview.mockResolvedValue({postId:8,version:4,suggestions:[]});
 show();await screen.findByDisplayValue('Original issue');review();fireEvent.click(publishButton());await card('Ready Tea').findByRole('alert',{name:'Publication requirements'});
 fireEvent.click(card('Ready Tea').getByRole('button',{name:action}));await screen.findByRole('dialog',{name:title});
 await waitFor(()=>expect(target==='SOURCE_CONTEXT'?mocks.sourceRepairPreview:mocks.localeRepairPreview).toHaveBeenCalled());
 expect(mocks.sourceRepairApply).not.toHaveBeenCalled();expect(mocks.localeRepairApply).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Cancel edit'}));
});
beforeEach(async()=>{localStorage.clear();localStorage.setItem('bobbuy_locale','en-US');vi.resetAllMocks();mocks.products.mockResolvedValue([]);mocks.get.mockResolvedValue(clone(draft));const {transferableAbortController}=await vi.importActual<{transferableAbortController:()=>AbortController}>('node:util');vi.stubGlobal('AbortController',class {constructor(){return transferableAbortController();}});});
afterEach(()=>{vi.unstubAllGlobals();HTMLElement.prototype.scrollIntoView=originalScrollIntoView;});

it('publishes a ready post8 item alone while 1731065 stays pending; synchronous double clicks send once',async()=>{
 let finish!:(value:any)=>void;mocks.publishItem.mockImplementation(()=>new Promise(resolve=>finish=resolve));
 show();await screen.findByDisplayValue('Original issue');
 expect(screen.queryByRole('button',{name:new RegExp(translate('en-US','rec.publish')+'$')})).toBeNull();
 review();fireEvent.click(publishButton());fireEvent.click(publishButton());
 expect(mocks.publishItem).toHaveBeenCalledTimes(1);
 const [postId,itemId,input]=mocks.publishItem.mock.calls[0];expect([postId,itemId]).toEqual([8,801]);
 expect(input).toEqual({requestId:expect.stringMatching(/^[0-9a-f-]{36}$/),version:4,productVersion:2,sourceHash:'a'.repeat(64),reviewed:true});
 await act(async()=>finish(published(draft)));
 expect(card('Ready Tea').getByText('Published')).toBeInTheDocument();expect(card('Missing 1731065').getByText('Pending review')).toBeInTheDocument();
 expect(publishButton('Missing 1731065')).toBeDisabled();expect(card('Ready Tea').queryByRole('button',{name:/Edit item facts/})).toBeNull();
 expect(screen.getByTestId('classification-items')).toHaveTextContent('802');expect(mocks.publish).not.toHaveBeenCalled();
});

it('publishes the eighth post9 item while all seven previously public items remain displayed',async()=>{
 const seven=Array.from({length:7},(_,i)=>({...ready,id:901+i,name:'Existing '+(i+1),publicationState:'PUBLISHED'}));
 const eighth={...ready,id:908,name:'Eighth item'};const value={...draft,post:{...draft.post,id:9,published:true},items:[...seven,eighth]};
 mocks.get.mockResolvedValue(value);mocks.publishItem.mockResolvedValue(published(value,908));show(9);await screen.findByDisplayValue('Original issue');
 expect(screen.queryByRole('button',{name:new RegExp(translate('en-US','rec.withdraw')+'$')})).toBeNull();
 review('Eighth item');fireEvent.click(publishButton('Eighth item'));await waitFor(()=>expect(card('Eighth item').getByText('Published')).toBeInTheDocument());
 for(const item of seven)expect(card(item.name).getByText('Published')).toBeInTheDocument();
 expect(mocks.publish).not.toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled();
});

it('does not enable publication with absent or malformed review/version metadata',async()=>{
 mocks.get.mockResolvedValue({...draft,items:[missing,{...ready,id:803,name:'Bad hash',publicationReviewHash:'short'},{...ready,id:804,name:'Bad version',publicationProductVersion:-1}]});
 show();await screen.findByDisplayValue('Original issue');
 for(const name of ['Missing 1731065','Bad hash','Bad version']){review(name);expect(publishButton(name)).toBeDisabled();}
 expect(mocks.publishItem).not.toHaveBeenCalled();
});

it('lists the issue11 supplier gap beside the item, keeps review checked and opens source editing',async()=>{
 mocks.publishItem.mockRejectedValue(Object.assign(new Error('Complete each listed item before publishing.'),{status:400,conditions:[{code:'REFERENCE_SUPPLIER_KEY_MISSING',message:'The source supplier identifier is missing. Open the item source context and complete it.',target:'SOURCE_CONTEXT'}]}));
 show();await screen.findByDisplayValue('Original issue');review();fireEvent.click(publishButton());
 expect(await card('Ready Tea').findByText(/source supplier identifier is missing/)).toBeInTheDocument();
 expect(card('Ready Tea').queryByText(/title, body and at least one linked product/i)).toBeNull();
 expect(card('Ready Tea').getByRole('checkbox',{name:/I checked this item/})).toBeChecked();
 expect(card('Ready Tea').getByRole('button',{name:'Edit source context'})).toBeEnabled();
});

it('lists every issue12 source and localized-master gap with product-master jump targets',async()=>{
 const conditions=[
  ['REFERENCE_CHANNEL_MISSING','The source channel is missing.','SOURCE_CONTEXT'],['REFERENCE_SOURCE_MESSAGE_KEY_MISSING','The source email or campaign identifier is missing.','SOURCE_CONTEXT'],['REFERENCE_SOURCE_URL_INVALID','The source URL is missing or invalid.','SOURCE_CONTEXT'],
  ['PRODUCT_NAME_ZH_TW_MISSING','The product-master zh-TW name is missing.','PRODUCT_MASTER'],['PRODUCT_SPECIFICATION_ZH_TW_MISSING','The product-master zh-TW specification is missing.','PRODUCT_MASTER'],['PRODUCT_SPECIFICATION_EN_US_MISSING','The product-master en-US specification is missing.','PRODUCT_MASTER']
 ].map(([code,message,target])=>({code,message,target}));
 mocks.publishItem.mockRejectedValue(Object.assign(new Error('Complete each listed item before publishing.'),{status:400,conditions}));show();await screen.findByDisplayValue('Original issue');review();fireEvent.click(publishButton());
 const failureList=await card('Ready Tea').findByRole('alert',{name:'Publication requirements'});for(const value of conditions)expect(failureList).toHaveTextContent(value.message);
 expect(card('Ready Tea').getAllByRole('link',{name:'Open product master'})).toHaveLength(3);expect(card('Ready Tea').getAllByRole('link',{name:'Open product master'})[0]).toHaveAttribute('href','/admin/products?product=product-ready#editor');
 expect(card('Ready Tea').getByRole('checkbox',{name:/I checked this item/})).toBeChecked();
});

it('retries an uncertain response with exactly the same request key and facts',async()=>{
 mocks.publishItem.mockRejectedValueOnce(new TypeError('Response lost')).mockResolvedValueOnce(published(draft));
 show();await screen.findByDisplayValue('Original issue');review();fireEvent.click(publishButton());
 const retry=await screen.findByRole('button',{name:'Retry this publication: Ready Tea'});fireEvent.click(retry);
 await waitFor(()=>expect(mocks.publishItem).toHaveBeenCalledTimes(2));expect(mocks.publishItem.mock.calls[1]).toEqual(mocks.publishItem.mock.calls[0]);
 await waitFor(()=>expect(card('Ready Tea').getByText('Published')).toBeInTheDocument());
});

it('preserves source corrections across repair buttons and requires consent before switching items',async()=>{
 const conditions=['REFERENCE_SUPPLIER_KEY_MISSING','REFERENCE_VARIANT_KEY_MISSING'].map(code=>({code,message:code,target:'SOURCE_CONTEXT'}));
 mocks.get.mockResolvedValue({...clone(draft),items:[ready,{...ready,...missing,productId:'product-other'}]});
 mocks.publishItem.mockRejectedValue(Object.assign(new Error('Missing source facts'),{status:400,conditions}));
 show();await screen.findByDisplayValue('Original issue');review();fireEvent.click(publishButton());
 await card('Ready Tea').findByRole('alert',{name:'Publication requirements'});
 review('Missing 1731065');fireEvent.click(publishButton('Missing 1731065'));
 await card('Missing 1731065').findByRole('alert',{name:'Publication requirements'});
 HTMLElement.prototype.scrollIntoView=vi.fn();
 fireEvent.click(card('Ready Tea').getAllByRole('button',{name:'Edit source context'})[0]);
 const supplier=()=>card('Ready Tea').getByLabelText(translate('en-US','ref.supplierKey'));
 fireEvent.change(supplier(),{target:{value:'Unsaved supplier correction'}});
 fireEvent.click(card('Ready Tea').getAllByRole('button',{name:'Edit source context'})[1]);
 expect(supplier()).toHaveValue('Unsaved supplier correction');
 fireEvent.click(card('Ready Tea').getByRole('button',{name:'Edit item facts: Ready Tea'}));
 expect(supplier()).toHaveValue('Unsaved supplier correction');
 fireEvent.click(card('Missing 1731065').getAllByRole('button',{name:'Edit source context'})[0]);
 let dialog=await screen.findByRole('dialog');
 fireEvent.click(within(dialog).getByRole('button',{name:translate('en-US','article.leave_stay')}));
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 expect(supplier()).toHaveValue('Unsaved supplier correction');
 fireEvent.click(card('Missing 1731065').getByRole('button',{name:'Edit item facts: Missing 1731065'}));
 dialog=await screen.findByRole('dialog');
 fireEvent.click(within(dialog).getByRole('button',{name:'Discard changes'}));
 await waitFor(()=>expect(card('Missing 1731065').getByLabelText(translate('en-US','ref.supplierKey'))).toBeInTheDocument());
 expect(card('Ready Tea').queryByLabelText(translate('en-US','ref.supplierKey'))).toBeNull();
 await waitFor(()=>expect(screen.queryByRole('dialog')).toBeNull());
 fireEvent.click(card('Ready Tea').getByRole('button',{name:'Edit item facts: Ready Tea'}));
 expect(supplier()).toHaveValue('');
 expect(screen.queryByRole('dialog')).toBeNull();
});

it('lists catalog pending review with a product-master jump and keeps the item review checked',async()=>{
 mocks.publishItem.mockRejectedValue(Object.assign(new Error('Complete each listed item before publishing.'),{status:400,conditions:[{code:'CATALOG_REVIEW_REQUIRED',message:'The product master is awaiting review. Open the product master, verify it and save the review.',target:'PRODUCT_MASTER'}]}));
 show();await screen.findByDisplayValue('Original issue');review();fireEvent.click(publishButton());
 const failures=await card('Ready Tea').findByRole('alert',{name:'Publication requirements'});
 expect(failures).toHaveTextContent('The product master is awaiting review.');
 expect(within(failures).getByRole('link',{name:'Open product master'})).toHaveAttribute('href','/admin/products?product=product-ready#editor');
 expect(card('Ready Tea').getByRole('checkbox',{name:/I checked this item/})).toBeChecked();
});

it('keeps an article draft through conflict/reload and requires a fresh review and new attempt',async()=>{
 mocks.publishItem.mockRejectedValueOnce(Object.assign(new Error('Changed'),{status:409}));
 show();await screen.findByDisplayValue('Original issue');review();fireEvent.click(publishButton());
 await screen.findAllByText(/The issue or product changed/);expect(publishButton()).toBeDisabled();
 fireEvent.change(screen.getByLabelText('Title'),{target:{value:'Kept local draft'}});
 const fresh={...clone(draft),post:{...draft.post,version:7},items:[{...ready,publicationReviewHash:'b'.repeat(64)},missing]};mocks.get.mockResolvedValueOnce(fresh);
 fireEvent.click(screen.getByRole('button',{name:/Reload$/}));await waitFor(()=>expect(mocks.get).toHaveBeenCalledTimes(2));
 expect(screen.getByDisplayValue('Kept local draft')).toBeInTheDocument();expect(mocks.publishItem).toHaveBeenCalledTimes(1);
 // The GET spy advances when reload starts; Ant's loading button still swallows clicks until it settles.
 await waitFor(()=>{const save=screen.getByRole('button',{name:/Save Draft$/});expect(save).toBeEnabled();expect(save).not.toHaveClass('ant-btn-loading');});
 const saved={...fresh,post:{...fresh.post,title:'Kept local draft',version:8}};mocks.save.mockResolvedValue(saved);
 fireEvent.click(screen.getByRole('button',{name:/Save Draft$/}));await waitFor(()=>expect(mocks.save).toHaveBeenCalledWith(8,'Kept local draft','Saved article body',7));
 await waitFor(()=>expect(card('Ready Tea').getByRole('checkbox',{name:/I checked this item/})).toBeEnabled());
 await waitFor(()=>expect(publishButton()).toBeDisabled());mocks.publishItem.mockResolvedValue(published(saved));review();fireEvent.click(publishButton());
 await waitFor(()=>expect(mocks.publishItem).toHaveBeenCalledTimes(2));
 expect(mocks.publishItem.mock.calls[1][2]).toMatchObject({version:8,sourceHash:'b'.repeat(64),reviewed:true});expect(mocks.publishItem.mock.calls[1][2].requestId).not.toBe(mocks.publishItem.mock.calls[0][2].requestId);
});

it('ignores a late publish response after navigating to another issue',async()=>{
 let finish!:(value:any)=>void;mocks.publishItem.mockImplementation(()=>new Promise(resolve=>finish=resolve));
 show();await screen.findByDisplayValue('Original issue');review();fireEvent.click(publishButton());
 mocks.get.mockResolvedValue({...clone(draft),post:{...draft.post,id:2,title:'Other current issue'}});fireEvent.click(screen.getByRole('button',{name:'Other issue'}));
 await screen.findByDisplayValue('Other current issue');await act(async()=>finish(published(draft)));
 expect(screen.getByDisplayValue('Other current issue')).toBeInTheDocument();expect(screen.queryByText('This item is published. Other pending items remain private.')).toBeNull();
});

it('discards a late response after an account/token change and does not reveal the previous issue',async()=>{
 storeAuthSession({accessToken:'synthetic-a',user:{id:100,username:'a',name:'A',roles:['AGENT']}});
 let finish!:(value:any)=>void;mocks.publishItem.mockImplementation(()=>new Promise(resolve=>finish=resolve));
 show();await screen.findByDisplayValue('Original issue');review();fireEvent.click(publishButton());mocks.get.mockRejectedValue(new Error('No access to this issue'));
 act(()=>storeAuthSession({accessToken:'synthetic-b',user:{id:200,username:'b',name:'B',roles:['AGENT']}}));
 await screen.findByText('No access to this issue');await act(async()=>finish(published(draft)));
 expect(screen.queryByDisplayValue('Original issue')).toBeNull();expect(screen.queryByText('This item is published. Other pending items remain private.')).toBeNull();
});

it('keeps the existing whole-article publication path for service offers',async()=>{
 const value={...clone(draft),items:[],serviceOffer:serviceFixture()};mocks.get.mockResolvedValue(value);mocks.publish.mockResolvedValue({...value,post:{...value.post,published:true,version:5}});
 show();await screen.findByText('Saved article body');fireEvent.click(screen.getByRole('button',{name:new RegExp(translate('en-US','rec.publish')+'$')}));
 await waitFor(()=>expect(mocks.publish).toHaveBeenCalledWith(8,4,true));expect(mocks.publishItem).not.toHaveBeenCalled();expect(await screen.findByRole('button',{name:new RegExp(translate('en-US','rec.withdraw')+'$')})).toBeInTheDocument();
});

it.each([{name:'an unpublished issue',postPublished:false,version:5},{name:'an older response',postPublished:true,version:3}])('does not declare success for $name even when its item flag says public',async({postPublished,version})=>{
 const contradictory=published(draft);contradictory.post.published=postPublished;contradictory.post.version=version;mocks.publishItem.mockResolvedValue(contradictory);
 show();await screen.findByDisplayValue('Original issue');review();fireEvent.click(publishButton());await screen.findByRole('button',{name:'Retry this publication: Ready Tea'});
 expect(card('Ready Tea').getByText('Pending review')).toBeInTheDocument();expect(screen.queryByText('This item is published. Other pending items remain private.')).toBeNull();expect(mocks.publishItem).toHaveBeenCalledTimes(1);
});
