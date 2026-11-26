vi.mock('./ProductPhotoHistory',()=>({default:()=>null}));
import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import ProductCatalogPanel from './ProductCatalogPanel';
import {I18nProvider} from '../i18n';
import {clearAuthSession,storeAuthSession} from '../authStorage';
// Use the real Node runtime crypto without adding @types/node to the browser app.
const {createHash,webcrypto}=await vi.importActual<{webcrypto:Crypto;createHash:(algorithm:string)=>{update:(bytes:Uint8Array)=>{digest:(encoding:'hex')=>string}}}>('node:crypto');
const {Buffer:RuntimeBuffer}=await vi.importActual<{Buffer:{from:(bytes:Uint8Array)=>{buffer:ArrayBuffer;byteOffset:number;byteLength:number}}}>('node:buffer');
vi.mock('antd',async()=>{const actual=await vi.importActual<typeof import('antd')>('antd');return {...actual,TreeSelect:(await import('../test/CategoryTreeSelectMock')).CategoryTreeSelectMock,Select:({options=[],value,onChange,...props}:any)=><select aria-label={props['aria-label']} value={value??''} onChange={e=>onChange?.(e.target.value)}><option value=""/>{options.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>};});
const mock=vi.hoisted(()=>({get:vi.fn(),restore:vi.fn(),audit:vi.fn(),proposals:vi.fn(),preview:vi.fn(),save:vi.fn(),upload:vi.fn(),options:vi.fn()}));
const tree=vi.hoisted(()=>({list:vi.fn(),product:vi.fn(),assign:vi.fn()}));
vi.mock('../api',()=>({productCatalogApi:mock,recommendationTaxonomyApi:{options:mock.options},categoryTreeApi:tree}));
const value={productId:'p1',version:7,name:{'ja-JP':'Fixture product','en-US':'Fixture product'},description:{},itemNumber:'SKU-P1',brand:null,specification:{},model:null,packaging:null,categoryIds:[],supplierId:null,gallery:[],translationsReviewed:true};
function file(name:string,tail=1){const bytes=new Uint8Array([137,80,78,71,13,10,26,10,tail]);const runtime=RuntimeBuffer.from(bytes),buffer=runtime.buffer.slice(runtime.byteOffset,runtime.byteOffset+runtime.byteLength);const result=new File([bytes],name,{type:'image/png'});Object.defineProperty(result,'arrayBuffer',{value:async()=>buffer});Object.defineProperty(result,'slice',{value:()=>({arrayBuffer:async()=>buffer})});return {file:result,sha:createHash('sha256').update(bytes).digest('hex')};}
function picture(name:string,sha:string){return {url:'/api/storefront/recommendation-images/'+name,type:'IMAGE',title:{'ja-JP':name},visible:true,sha256:sha,sourceUrl:'https://manufacturer.example/product'};}
const input=()=>screen.getByLabelText('Select verified official image files') as HTMLInputElement;
async function openMedia(){await screen.findByDisplayValue('SKU-P1');fireEvent.click(screen.getByRole('tab',{name:'Images & sources'}));}
function select(files:File[]){const group=document.querySelector('.catalog-upload-group')!;const source=within(group as HTMLElement).getByLabelText('Default official image source');fireEvent.change(source,{target:{value:'https://manufacturer.example/product'}});const review=within(group as HTMLElement).getByRole('checkbox') as HTMLInputElement;if(!review.checked)fireEvent.click(review);const element=input();Object.defineProperty(element,'value',{value:'C:\\fakepath\\'+files[0].name,writable:true,configurable:true});fireEvent.change(element,{target:{files}});fireEvent.click(screen.getByRole('button',{name:'Upload selected images'}));return element;}
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();localStorage.setItem('bobbuy_locale','en-US');vi.stubGlobal('crypto',{subtle:webcrypto.subtle,randomUUID:()=> '00000000-0000-0000-0000-000000000001'});mock.get.mockImplementation(async(id:string)=>({value:{...value,productId:id,itemNumber:id==='p1'?'SKU-P1':'SKU-P2'},canonical:true,sourceItemIds:[]}));mock.options.mockResolvedValue({categories:[],suppliers:[]});tree.list.mockResolvedValue([]);tree.product.mockResolvedValue({productId:'p1',categoryNodeId:null,categoryNodeIds:[],revision:0});tree.assign.mockResolvedValue({productId:'p1',categoryNodeId:null,categoryNodeIds:[],revision:1});mock.preview.mockImplementation(async rows=>rows.map((v:any)=>({value:v,changes:[],warnings:[]})));mock.save.mockRejectedValue(new Error('master.conflict'));});
afterEach(()=>{vi.unstubAllGlobals();});
it('suppresses a bulk save callback after the editor has unmounted',async()=>{
 let finish!:(rows:unknown[])=>void;mock.save.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const onSaved=vi.fn();const view=render(<I18nProvider><ProductCatalogPanel entries={[]} onChoose={vi.fn()} onSaved={onSaved}/></I18nProvider>);
 fireEvent.click(screen.getByRole('button',{name:'Review and complete product masters'}));
 fireEvent.change(screen.getByRole('textbox',{name:'Product-master batch JSON'}),{target:{value:JSON.stringify([value])}});
 fireEvent.click(screen.getByRole('button',{name:'Validate and preview'}));
 await screen.findByRole('checkbox',{name:'Select all'});fireEvent.click(screen.getByRole('checkbox',{name:'Select all'}));
 fireEvent.click(screen.getByRole('checkbox',{name:/I reviewed the data/}));
 fireEvent.click(screen.getByRole('button',{name:'Confirm and save masters (1)'}));
 await waitFor(()=>expect(mock.save).toHaveBeenCalledOnce());view.unmount();
 await act(async()=>{finish([{value:{...value,version:8},canonical:true}]);await new Promise(resolve=>setTimeout(resolve,0));});
 expect(onSaved).not.toHaveBeenCalled();
});
it('opens the picker once per add action even before source review, including after cancel',async()=>{
 render(<I18nProvider><ProductCatalogPanel id="p1" entries={[]} onChoose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);
 await openMedia();
 const picker=input();
 const open=vi.spyOn(picker,'click').mockImplementation(()=>{});
 const add=screen.getByRole('button',{name:'Add images'});
 fireEvent.click(add);
 expect(open).toHaveBeenCalledOnce();
 fireEvent.change(picker,{target:{files:[]}});
 fireEvent.click(add);
 expect(open).toHaveBeenCalledTimes(2);
 fireEvent.change(picker,{target:{files:[file('unreviewed.png').file]}});
 expect(screen.getByText('unreviewed.png')).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Upload selected images'})).toBeDisabled();
 expect(mock.upload).not.toHaveBeenCalled();
});
it('explains the first-image stages from provenance through uploaded draft',async()=>{
 const selected=file('first-cover.png');let finish!:(asset:ReturnType<typeof picture>)=>void;
 mock.upload.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 render(<I18nProvider><ProductCatalogPanel id="p1" entries={[]} onChoose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);
 await openMedia();
 const source=screen.getByLabelText('Default official image source');
 fireEvent.change(source,{target:{value:'https://manufacturer.example/first-cover'}});
 expect(screen.getByText('This URL is the image source record. Select local image files to upload.')).toBeInTheDocument();
 expect(screen.getByText('Next: choose Add images above to select one or more local files.')).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Upload selected images'})).not.toBeInTheDocument();
 fireEvent.change(input(),{target:{files:[selected.file]}});
 expect(screen.getByText('first-cover.png')).toBeInTheDocument();
 expect(screen.getByText('Next: verify the selected files and source to enable upload.')).toBeInTheDocument();
 expect(screen.getByRole('button',{name:'Upload selected images'})).toBeDisabled();
 fireEvent.click(screen.getByRole('checkbox',{name:/I verified the exact item/}));
 expect(screen.getByText('Next: choose Upload selected images. Then review and Confirm and save masters.')).toBeInTheDocument();
 const upload=screen.getByRole('button',{name:'Upload selected images'});expect(upload).toBeEnabled();fireEvent.click(upload);
 await waitFor(()=>expect(mock.upload).toHaveBeenCalledOnce());
 expect(screen.getByText('Uploading selected images… Keep this editor open.')).toBeInTheDocument();
 await act(async()=>finish(picture('first-cover-asset',selected.sha)));
 expect(await screen.findByText('Uploaded images are in this draft. Save the master to associate them.')).toBeInTheDocument();
 expect(screen.queryByText('Next: choose Add images above to select one or more local files.')).not.toBeInTheDocument();
 expect(mock.save).not.toHaveBeenCalled();
});
it('clears staged files, temporary source and approval when closing A and opening B',async()=>{
 const savedSource='https://manufacturer.example/saved-source';
 const override='https://manufacturer.example/only-for-a';
 const original=picture('original',file('original.png').sha);
 mock.get.mockImplementation(async(id:string)=>({
  value:{...value,productId:id,itemNumber:id==='p1'?'SKU-P1':'SKU-P2',
   defaultImageSourceUrl:savedSource,gallery:[original]},canonical:true,sourceItemIds:[]
 }));
 const onChoose=vi.fn(),onSaved=vi.fn();
 const editor=(id?:string)=><I18nProvider><ProductCatalogPanel id={id} entries={[]} onChoose={onChoose} onSaved={onSaved}/></I18nProvider>;
 const view=render(editor('p1'));
 await openMedia();
 const source=()=>screen.getByLabelText('Source for selected images');
 const approval=()=>screen.getByRole('checkbox',{name:/I verified the exact item/});
 fireEvent.change(source(),{target:{value:override}});
 fireEvent.click(approval());
 fireEvent.change(input(),{target:{files:[file('private-a.png').file]}});
 expect(screen.getByText('private-a.png')).toBeInTheDocument();
 fireEvent.change(input(),{target:{files:[]}});
 expect(screen.getByText('private-a.png')).toBeInTheDocument();
 expect(source()).toHaveValue(override);
 expect(approval()).toBeChecked();
 fireEvent.click(screen.getByRole('button',{name:'Close'}));
 expect(onChoose).toHaveBeenCalledWith(undefined);
 view.rerender(editor());
 view.rerender(editor('p2'));
 await screen.findByDisplayValue('SKU-P2');
 fireEvent.click(screen.getByRole('tab',{name:'Images & sources'}));
 expect(screen.queryByText('private-a.png')).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Upload selected images'})).not.toBeInTheDocument();
 expect(source()).toHaveValue(savedSource);
 expect(approval()).not.toBeChecked();
 view.rerender(editor('p1'));
 await openMedia();
 expect(screen.queryByText('private-a.png')).not.toBeInTheDocument();
 expect(source()).toHaveValue(savedSource);
 expect(approval()).not.toBeChecked();
 expect(mock.upload).not.toHaveBeenCalled();
});
it('allows recovering the per-upload source after removing the last existing image',async()=>{
 const original=picture('original',file('original.png').sha);
 mock.get.mockResolvedValue({value:{...value,defaultImageSourceUrl:'https://manufacturer.example/default',gallery:[original]},canonical:true});
 render(<I18nProvider><ProductCatalogPanel id="p1" entries={[]} onChoose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);
 await openMedia();
 fireEvent.change(screen.getByLabelText('Source for selected images'),{target:{value:''}});
 fireEvent.click(screen.getByRole('button',{name:'Remove'}));
 fireEvent.change(input(),{target:{files:[file('replacement.png').file]}});
 const source=screen.getByLabelText('Source for selected images');
 fireEvent.change(source,{target:{value:'https://manufacturer.example/replacement'}});
 fireEvent.click(screen.getByRole('checkbox',{name:/I verified the exact item/}));
 expect(screen.getByRole('button',{name:'Upload selected images'})).toBeEnabled();
 expect(screen.getByLabelText('Default official image source')).toHaveValue('https://manufacturer.example/default');
});
it('first-file failure remains visible and clears the picker so the same file can be chosen again',async()=>{
 const a=file('first.png');mock.upload.mockRejectedValueOnce(new Error('gallery.invalid')).mockResolvedValueOnce(picture('asset-first',a.sha));
 render(<I18nProvider><ProductCatalogPanel id="p1" entries={[]} onChoose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);await openMedia();const picker=select([a.file]);
 await waitFor(()=>expect(mock.upload,screen.queryByRole('list',{name:'Image upload status'})?.textContent??'No upload status').toHaveBeenCalledTimes(1));await waitFor(()=>expect(picker.value).toBe(''));
 expect(screen.getByRole('list',{name:'Image upload status'})).toHaveTextContent('first.png');expect(screen.getByRole('list',{name:'Image upload status'})).toHaveTextContent('Failed');
 expect(screen.getByText('Earlier confirmed uploads are kept. Pending files have not been uploaded. Check the failure, then select files again.')).toBeInTheDocument();
 expect(screen.queryByText('Next: verify the selected files and source to enable upload.')).not.toBeInTheDocument();
 select([a.file]);await waitFor(()=>expect(mock.upload).toHaveBeenCalledTimes(2));await waitFor(()=>expect(document.querySelector('img[src="/api/storefront/recommendation-images/asset-first"]')).not.toBeNull());await waitFor(()=>expect(input()).not.toBeDisabled());const history=screen.getByRole('list',{name:'Image upload status'});expect(within(history).getAllByText('first.png')).toHaveLength(2);expect(history).toHaveTextContent('Failed');expect(history).toHaveTextContent('Uploaded');expect(mock.save).not.toHaveBeenCalled();
});
it('keeps an earlier successful receipt while guiding an active new batch',async()=>{
 const first=file('earlier.png',1),next=file('active.png',2);mock.upload.mockResolvedValueOnce(picture('earlier-asset',first.sha)).mockResolvedValueOnce(picture('active-asset',next.sha));
 render(<I18nProvider><ProductCatalogPanel id="p1" entries={[]} onChoose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);await openMedia();select([first.file]);
 await waitFor(()=>expect(document.querySelector('img[src="/api/storefront/recommendation-images/earlier-asset"]')).not.toBeNull());await waitFor(()=>expect(input()).not.toBeDisabled());
 fireEvent.change(input(),{target:{files:[next.file]}});
 expect(screen.getByText('Next: verify the selected files and source to enable upload.')).toBeInTheDocument();
 expect(screen.getByRole('list',{name:'Image upload status'})).toHaveTextContent('earlier.png');
 fireEvent.click(screen.getByRole('checkbox',{name:/I verified the exact item/}));fireEvent.click(screen.getByRole('button',{name:'Upload selected images'}));
 await waitFor(()=>expect(document.querySelector('img[src="/api/storefront/recommendation-images/active-asset"]')).not.toBeNull());await waitFor(()=>expect(input()).not.toBeDisabled());const history=screen.getByRole('list',{name:'Image upload status'});expect(history).toHaveTextContent('earlier.png');expect(history).toHaveTextContent('active.png');
});
it('a middle failure retains the first uploaded asset/preview, leaves later files pending and never partially saves',async()=>{
 const a=file('one.png',1),b=file('two.png',2),c=file('three.png',3);mock.upload.mockResolvedValueOnce(picture('asset-one',a.sha)).mockRejectedValueOnce(new Error('gallery.invalid'));
 render(<I18nProvider><ProductCatalogPanel id="p1" entries={[]} onChoose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);await openMedia();select([a.file,b.file,c.file]);
 await waitFor(()=>expect(mock.upload).toHaveBeenCalledTimes(2));await waitFor(()=>expect(document.querySelector('img[src="/api/storefront/recommendation-images/asset-one"]')).not.toBeNull());await waitFor(()=>expect(input()).not.toBeDisabled());
 const statuses=screen.getByRole('list',{name:'Image upload status'});expect(statuses).toHaveTextContent('one.png');expect(statuses).toHaveTextContent('two.png');expect(statuses).toHaveTextContent('three.png');expect(statuses).toHaveTextContent('Pending');expect(statuses).toHaveTextContent('Failed');expect(screen.getByText('Uploaded images are in this draft. Save the master to associate them.')).toBeInTheDocument();expect(screen.queryByText('Next: verify the selected files and source to enable upload.')).not.toBeInTheDocument();expect(mock.save).not.toHaveBeenCalled();
});
it('duplicate bytes under different names or a reselected successful file reuse the SHA/asset without a second upload',async()=>{
 const a=file('same-a.png',1),b=file('same-b.png',1);mock.upload.mockImplementation(async()=>picture('same-asset',a.sha));
 render(<I18nProvider><ProductCatalogPanel id="p1" entries={[]} onChoose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);await openMedia();select([a.file,b.file]);
 await waitFor(()=>expect(input().disabled).toBe(true));await waitFor(()=>expect(input().value).toBe(''));select([b.file]);await waitFor(()=>expect(input().value).toBe(''));expect(mock.upload).toHaveBeenCalledTimes(1);expect(document.querySelectorAll('.catalog-filmstrip button')).toHaveLength(1);
});
it('a slow response cannot append to another product or clear its loading state',async()=>{
 const a=file('late.png');let resolve!:(v:ReturnType<typeof picture>)=>void;mock.upload.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 const {rerender}=render(<I18nProvider><ProductCatalogPanel id="p1" entries={[]} onChoose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);await openMedia();select([a.file]);await waitFor(()=>expect(mock.upload).toHaveBeenCalledOnce());
 rerender(<I18nProvider><ProductCatalogPanel id="p2" entries={[]} onChoose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);await screen.findByDisplayValue('SKU-P2');resolve(picture('late-old-product',a.sha));await new Promise(r=>setTimeout(r,0));expect(document.querySelector('img[src="/api/storefront/recommendation-images/late-old-product"]')).toBeNull();expect(screen.getByDisplayValue('SKU-P2')).toBeInTheDocument();
});
it('save failure preserves uploaded draft assets and a retry does not re-upload files',async()=>{
 const a=file('keep.png');const asset=picture('kept-asset',a.sha);mock.upload.mockResolvedValue(asset);
 const onSaved=vi.fn();render(<I18nProvider><ProductCatalogPanel id="p1" entries={[]} onChoose={vi.fn()} onSaved={onSaved}/></I18nProvider>);await openMedia();select([a.file]);await waitFor(()=>expect(document.querySelector('img[src="/api/storefront/recommendation-images/kept-asset"]')).not.toBeNull());
 fireEvent.click(screen.getByRole('checkbox',{name:/I reviewed the data/}));fireEvent.click(screen.getByRole('button',{name:'Confirm and save masters'}));await waitFor(()=>expect(mock.save).toHaveBeenCalledOnce());expect(onSaved).not.toHaveBeenCalled();expect(document.querySelector('img[src="/api/storefront/recommendation-images/kept-asset"]')).not.toBeNull();expect(mock.save.mock.calls[0][0][0].gallery).toEqual([asset]);
 const retry = await screen.findByRole('button',{name:'Confirm and save masters'});
 await waitFor(()=>expect(retry).toBeEnabled());
 mock.save.mockResolvedValue([{value:{...value,version:8,gallery:[asset]},canonical:true}]);
 fireEvent.click(retry);await waitFor(()=>expect(onSaved).toHaveBeenCalledOnce());expect(mock.upload).toHaveBeenCalledOnce();
});
it('reopens an uploaded and saved image as persisted without losing its receipt before close',async()=>{
 const selected=file('persist.png'),asset=picture('persisted-asset',selected.sha);mock.upload.mockResolvedValue(asset);mock.save.mockResolvedValue([{value:{...value,version:8,gallery:[asset]},canonical:true}]);
 const editor=(id?:string)=><I18nProvider><ProductCatalogPanel id={id} entries={[]} onChoose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>;const view=render(editor('p1'));await openMedia();select([selected.file]);await waitFor(()=>expect(document.querySelector('img[src="/api/storefront/recommendation-images/persisted-asset"]')).not.toBeNull());
 fireEvent.click(screen.getByRole('checkbox',{name:/I reviewed the data/}));fireEvent.click(screen.getByRole('button',{name:'Confirm and save masters'}));await waitFor(()=>expect(screen.getByRole('list',{name:'Image upload status'})).toHaveTextContent('Saved'));
 mock.get.mockResolvedValue({value:{...value,version:8,gallery:[asset]},canonical:true,sourceItemIds:[]});view.rerender(editor());view.rerender(editor('p1'));await openMedia();expect(document.querySelector('img[src="/api/storefront/recommendation-images/persisted-asset"]')).not.toBeNull();expect(screen.queryByRole('list',{name:'Image upload status'})).toBeNull();expect(mock.upload).toHaveBeenCalledOnce();
});
it('an account/session switch suppresses the prior upload and drops its private draft/status',async()=>{
 const a=file('private.png');let resolve!:(v:ReturnType<typeof picture>)=>void;mock.upload.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 render(<I18nProvider><ProductCatalogPanel id="p1" entries={[]} onChoose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);await openMedia();select([a.file]);await waitFor(()=>expect(mock.upload).toHaveBeenCalledOnce());
 await act(async()=>{storeAuthSession({accessToken:'synthetic-other-session',user:{id:22,username:'other',name:'other',roles:['AGENT']}});resolve(picture('private-old-account',a.sha));await new Promise(r=>setTimeout(r,0));});expect(document.querySelector('img[src="/api/storefront/recommendation-images/private-old-account"]')).toBeNull();expect(mock.save).not.toHaveBeenCalled();
});
it('same-principal token refresh preserves the pending upload and unsaved assets',async()=>{
 const user={id:22,username:'operator',name:'operator',roles:['AGENT' as const]};storeAuthSession({accessToken:'synthetic-token-1',user});
 const a=file('refresh.png');let resolve!:(v:ReturnType<typeof picture>)=>void;mock.upload.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 render(<I18nProvider><ProductCatalogPanel id="p1" entries={[]} onChoose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);await openMedia();select([a.file]);await waitFor(()=>expect(mock.upload).toHaveBeenCalledOnce());
 await act(async()=>{storeAuthSession({accessToken:'synthetic-token-2',user});resolve(picture('same-principal',a.sha));});
 await waitFor(()=>expect(document.querySelector('img[src="/api/storefront/recommendation-images/same-principal"]')).not.toBeNull());expect(mock.get).toHaveBeenCalledOnce();expect(screen.getByText('Uploaded images are in this draft. Save the master to associate them.')).toBeInTheDocument();
});
it('logout and same-user login in one render batch still invalidate the old upload operation',async()=>{
 const user={id:22,username:'operator',name:'operator',roles:['AGENT' as const]};storeAuthSession({accessToken:'synthetic-before',user});
 const a=file('before-logout.png');let resolve!:(v:ReturnType<typeof picture>)=>void;mock.upload.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 render(<I18nProvider><ProductCatalogPanel id="p1" entries={[]} onChoose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);await openMedia();select([a.file]);await waitFor(()=>expect(mock.upload).toHaveBeenCalledOnce());
 await act(async()=>{clearAuthSession();storeAuthSession({accessToken:'synthetic-after',user});resolve(picture('logged-out-operation',a.sha));});
 await waitFor(()=>expect(mock.get).toHaveBeenCalledTimes(2));expect(document.querySelector('img[src="/api/storefront/recommendation-images/logged-out-operation"]')).toBeNull();expect(screen.queryByRole('list',{name:'Image upload status'})).toBeNull();expect(mock.save).not.toHaveBeenCalled();
});
it('a source URL with a query blocks uploading and still clears the captured picker',async()=>{
 render(<I18nProvider><ProductCatalogPanel id="p1" entries={[]} onChoose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);await openMedia();
 const group=document.querySelector('.catalog-upload-group')!;fireEvent.change(within(group as HTMLElement).getByLabelText('Default official image source'),{target:{value:'https://manufacturer.example/product?source=search'}});fireEvent.click(within(group as HTMLElement).getByRole('checkbox'));
 const picker=input();Object.defineProperty(picker,'value',{value:'C:\\fakepath\\query.png',writable:true,configurable:true});fireEvent.change(picker,{target:{files:[file('query.png').file]}});
 await waitFor(()=>expect(picker.value).toBe(''));expect(mock.upload).not.toHaveBeenCalled();expect(screen.getByRole('button',{name:'Upload selected images'})).toBeDisabled();expect(mock.save).not.toHaveBeenCalled();
});
it('a late preview cannot start a save under a different principal',async()=>{
 let resolve!:(v:any[])=>void;mock.preview.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 render(<I18nProvider><ProductCatalogPanel id="p1" entries={[]} onChoose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);await openMedia();
 fireEvent.click(screen.getByRole('checkbox',{name:/I reviewed the data/}));fireEvent.click(screen.getByRole('button',{name:'Confirm and save masters'}));await waitFor(()=>expect(mock.preview).toHaveBeenCalledOnce());
 await act(async()=>{storeAuthSession({accessToken:'synthetic-other-session',user:{id:23,username:'other',name:'other',roles:['AGENT']}});resolve([]);});
 await waitFor(()=>expect(mock.get).toHaveBeenCalledTimes(2));expect(mock.save).not.toHaveBeenCalled();
});
