import {act,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import ProductCatalogPanel from './ProductCatalogPanel';
import {I18nProvider} from '../i18n';
import {clearAuthSession,storeAuthSession} from '../authStorage';
// Use the real Node runtime crypto without adding @types/node to the browser app.
const {createHash,webcrypto}=await vi.importActual<{webcrypto:Crypto;createHash:(algorithm:string)=>{update:(bytes:Uint8Array)=>{digest:(encoding:'hex')=>string}}}>('node:crypto');
const {Buffer:RuntimeBuffer}=await vi.importActual<{Buffer:{from:(bytes:Uint8Array)=>{buffer:ArrayBuffer;byteOffset:number;byteLength:number}}}>('node:buffer');
vi.mock('antd',async()=>{const actual=await vi.importActual<typeof import('antd')>('antd');return {...actual,Select:({options=[],value,onChange,...props}:any)=><select aria-label={props['aria-label']} value={value??''} onChange={e=>onChange?.(e.target.value)}><option value=""/>{options.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>};});
const mock=vi.hoisted(()=>({get:vi.fn(),restore:vi.fn(),audit:vi.fn(),proposals:vi.fn(),preview:vi.fn(),save:vi.fn(),upload:vi.fn(),options:vi.fn()}));
vi.mock('../api',()=>({productCatalogApi:mock,recommendationTaxonomyApi:{options:mock.options}}));
const value={productId:'p1',version:7,name:{'ja-JP':'Fixture product','en-US':'Fixture product'},description:{},itemNumber:'SKU-P1',brand:null,specification:{},model:null,packaging:null,categoryIds:[],supplierId:null,gallery:[],translationsReviewed:true};
function file(name:string,tail=1){const bytes=new Uint8Array([137,80,78,71,13,10,26,10,tail]);const runtime=RuntimeBuffer.from(bytes),buffer=runtime.buffer.slice(runtime.byteOffset,runtime.byteOffset+runtime.byteLength);const result=new File([bytes],name,{type:'image/png'});Object.defineProperty(result,'arrayBuffer',{value:async()=>buffer});Object.defineProperty(result,'slice',{value:()=>({arrayBuffer:async()=>buffer})});return {file:result,sha:createHash('sha256').update(bytes).digest('hex')};}
function picture(name:string,sha:string){return {url:'/api/storefront/recommendation-images/'+name,type:'IMAGE',title:{'ja-JP':name},visible:true,sha256:sha,sourceUrl:'https://manufacturer.example/product'};}
const input=()=>screen.getByLabelText('Select verified official image files') as HTMLInputElement;
async function openMedia(){await screen.findByDisplayValue('SKU-P1');fireEvent.click(screen.getByRole('tab',{name:'Images & sources'}));}
function select(files:File[]){const group=document.querySelector('.catalog-upload-group')!;const source=within(group as HTMLElement).getByRole('textbox');fireEvent.change(source,{target:{value:'https://manufacturer.example/product'}});const review=within(group as HTMLElement).getByRole('checkbox') as HTMLInputElement;if(!review.checked)fireEvent.click(review);const element=input();Object.defineProperty(element,'value',{value:'C:\\fakepath\\'+files[0].name,writable:true,configurable:true});fireEvent.change(element,{target:{files}});return element;}
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();localStorage.setItem('bobbuy_locale','en-US');vi.stubGlobal('crypto',{subtle:webcrypto.subtle,randomUUID:()=> '00000000-0000-0000-0000-000000000001'});mock.get.mockImplementation(async(id:string)=>({value:{...value,productId:id,itemNumber:id==='p1'?'SKU-P1':'SKU-P2'},canonical:true,sourceItemIds:[]}));mock.options.mockResolvedValue({categories:[],suppliers:[]});mock.preview.mockImplementation(async rows=>rows.map((v:any)=>({value:v,changes:[],warnings:[]})));mock.save.mockRejectedValue(new Error('master.conflict'));});
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
it('first-file failure remains visible and clears the picker so the same file can be chosen again',async()=>{
 const a=file('first.png');mock.upload.mockRejectedValueOnce(new Error('gallery.invalid')).mockResolvedValueOnce(picture('asset-first',a.sha));
 render(<I18nProvider><ProductCatalogPanel id="p1" entries={[]} onChoose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);await openMedia();const picker=select([a.file]);
 expect(screen.getAllByRole('button',{name:/Select verified official image files/})).toHaveLength(1);
 await waitFor(()=>expect(mock.upload,screen.queryByRole('list',{name:'Image upload status'})?.textContent??'No upload status').toHaveBeenCalledTimes(1));await waitFor(()=>expect(picker.value).toBe(''));
 expect(screen.getByRole('list',{name:'Image upload status'})).toHaveTextContent('first.png');expect(screen.getByRole('list',{name:'Image upload status'})).toHaveTextContent('Failed');
 select([a.file]);await waitFor(()=>expect(mock.upload).toHaveBeenCalledTimes(2));await waitFor(()=>expect(document.querySelector('img[src="/api/storefront/recommendation-images/asset-first"]')).not.toBeNull());expect(mock.save).not.toHaveBeenCalled();
});
it('a middle failure retains the first uploaded asset/preview, leaves later files pending and never partially saves',async()=>{
 const a=file('one.png',1),b=file('two.png',2),c=file('three.png',3);mock.upload.mockResolvedValueOnce(picture('asset-one',a.sha)).mockRejectedValueOnce(new Error('gallery.invalid'));
 render(<I18nProvider><ProductCatalogPanel id="p1" entries={[]} onChoose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);await openMedia();select([a.file,b.file,c.file]);
 await waitFor(()=>expect(mock.upload).toHaveBeenCalledTimes(2));await waitFor(()=>expect(document.querySelector('img[src="/api/storefront/recommendation-images/asset-one"]')).not.toBeNull());
 const statuses=screen.getByRole('list',{name:'Image upload status'});expect(statuses).toHaveTextContent('one.png');expect(statuses).toHaveTextContent('two.png');expect(statuses).toHaveTextContent('three.png');expect(statuses).toHaveTextContent('Pending');expect(statuses).toHaveTextContent('Failed');expect(screen.getByText('Uploaded images are in this draft. Save the master to associate them.')).toBeInTheDocument();expect(mock.save).not.toHaveBeenCalled();
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
 mock.save.mockResolvedValue([{value:{...value,version:8,gallery:[asset]},canonical:true}]);fireEvent.click(screen.getByRole('button',{name:'Confirm and save masters'}));await waitFor(()=>expect(onSaved).toHaveBeenCalledOnce());expect(mock.upload).toHaveBeenCalledOnce();
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
it('a source URL with a query fails visibly before uploading and still clears the captured picker',async()=>{
 render(<I18nProvider><ProductCatalogPanel id="p1" entries={[]} onChoose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);await openMedia();
 const group=document.querySelector('.catalog-upload-group')!;fireEvent.change(within(group as HTMLElement).getByRole('textbox'),{target:{value:'https://manufacturer.example/product?source=search'}});fireEvent.click(within(group as HTMLElement).getByRole('checkbox'));
 const picker=input();Object.defineProperty(picker,'value',{value:'C:\\fakepath\\query.png',writable:true,configurable:true});fireEvent.change(picker,{target:{files:[file('query.png').file]}});
 await waitFor(()=>expect(picker.value).toBe(''));expect(mock.upload).not.toHaveBeenCalled();expect(screen.getByRole('list',{name:'Image upload status'})).toHaveTextContent('Failed');expect(mock.save).not.toHaveBeenCalled();
});
it('a late preview cannot start a save under a different principal',async()=>{
 let resolve!:(v:any[])=>void;mock.preview.mockImplementation(()=>new Promise(r=>{resolve=r;}));
 render(<I18nProvider><ProductCatalogPanel id="p1" entries={[]} onChoose={vi.fn()} onSaved={vi.fn()}/></I18nProvider>);await openMedia();
 fireEvent.click(screen.getByRole('checkbox',{name:/I reviewed the data/}));fireEvent.click(screen.getByRole('button',{name:'Confirm and save masters'}));await waitFor(()=>expect(mock.preview).toHaveBeenCalledOnce());
 await act(async()=>{storeAuthSession({accessToken:'synthetic-other-session',user:{id:23,username:'other',name:'other',roles:['AGENT']}});resolve([]);});
 await waitFor(()=>expect(mock.get).toHaveBeenCalledTimes(2));expect(mock.save).not.toHaveBeenCalled();
});
