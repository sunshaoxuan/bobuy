import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor,within} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({suppliers:vi.fn(),status:vi.fn(),photo:vi.fn(),get:vi.fn(),review:vi.fn(),confirm:vi.fn(),retry:vi.fn()}));
vi.mock('../api',()=>({api:{suppliers:mocks.suppliers,costcoOnboarding:{status:mocks.status,photo:mocks.photo,get:mocks.get}},photoIntakeApi:{retry:mocks.retry,image:()=>Promise.resolve(new Blob()),review:mocks.review,confirm:mocks.confirm,photo:()=>Promise.resolve(new Blob())},categoryTreeApi:{list:()=>Promise.resolve([])},masterDataApi:{currencies:()=>Promise.resolve([{code:'JPY'}])}}));
vi.mock('../productPhotoUpload',()=>({prepareProductPhotoUpload:(f:File)=>f.name==='bad.txt'?Promise.reject(Error('gallery.invalid')):Promise.resolve(f)}));
vi.mock('../i18n',()=>({useI18n:()=>({locale:'en-US',t:(k:string)=>k})}));
vi.mock('./CategoryTreePicker',()=>({default:({value,onChange}:{value:string|null;onChange:(id:string|null)=>void})=><select aria-label="test-category" value={value??''} onChange={e=>onChange(e.target.value||null)}><option value="">Uncategorized</option><option value="category-1">First category</option></select>}));
vi.mock('antd',()=>({Alert:({message,description,action}:any)=><div role="alert">{message}{description}{action}</div>,Button:({children,loading,type,...p}:any)=><button {...p}>{children}</button>,Checkbox:({children,onChange,...p}:any)=><label><input type="checkbox" {...p} onChange={onChange}/>{children}</label>,Input:Object.assign((p:any)=><input {...p}/>,{TextArea:(p:any)=><textarea {...p}/>}),Modal:({children,title,footer}:any)=><div role="dialog">{title}{children}{footer}</div>,Select:({options,onChange,loading,allowClear,...p}:any)=><select {...p} onChange={e=>onChange(e.target.value)}><option value=""/>{options.map((o:any)=><option key={o.value} {...o}>{o.label}</option>)}</select>,Space:({children}:any)=><div>{children}</div>,Tag:({children}:any)=><span>{children}</span>,Typography:{Title:({children}:any)=><h2>{children}</h2>}}));
import ProductPhotoIntakeModal from './ProductPhotoIntakeModal';
const job={id:'job1',state:'NEEDS_INPUT' as const,revision:7,photo:true,supplierId:'s1'};
const review=()=>({jobId:'job1',revision:7,supplierId:'s1',market:'JP',itemNumber:'123',status:'MATCH',matches:[{id:'p1',version:2,name:{'en-US':'Synthetic item'},specification:{'ja-JP':'80 × 2'},packaging:'80 × 2',eligible:true}],history:[],saved:null,photoFacts:{amount:999,currency:'JPY',unit:'80 × 2',conditions:'',priceKind:'WAREHOUSE',productVisible:true}});
const props={open:true,onClose:vi.fn(),onQueued:vi.fn(),onSaved:vi.fn()};
beforeEach(()=>{vi.clearAllMocks();mocks.suppliers.mockResolvedValue([{id:'s1',name:{'en-US':'Supplier'}}]);mocks.status.mockResolvedValue({workerEnabled:true});mocks.get.mockResolvedValue(job);mocks.review.mockResolvedValue(review());vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:()=> 'blob:fixture',revokeObjectURL:vi.fn()}));});
afterEach(cleanup);
it('queues each selected file immediately and accepts a new capture while uploads are pending',async()=>{
 let finish!:(value:unknown)=>void;
 mocks.photo.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 render(<ProductPhotoIntakeModal {...props}/>);
 await waitFor(()=>expect(screen.getByLabelText('onboarding.supplier')).toHaveValue('s1'));
 const [camera,library]=document.querySelectorAll<HTMLInputElement>('input[type=file]');
 expect(camera).toHaveAttribute('capture','environment');expect(library).not.toHaveAttribute('capture');expect(library.multiple).toBe(true);
 const image=(name:string)=>new File(['test'],name,{type:'image/png'});
 fireEvent.change(library,{target:{files:[image('first.png'),image('second.png')]}});
 await waitFor(()=>expect(mocks.photo).toHaveBeenCalledTimes(2));
 expect(screen.getByText('photo.camera')).toBeEnabled();
 fireEvent.change(camera,{target:{files:[image('third.png')]}});
 await waitFor(()=>expect(mocks.photo).toHaveBeenCalledTimes(3));
 expect(new Set(mocks.photo.mock.calls.map(([input])=>input.requestId)).size).toBe(3);
 expect(mocks.photo.mock.calls.map(([,file])=>file.name)).toEqual(['first.png','second.png','third.png']);
 await act(()=>finish({...job,state:'QUEUED'}));
 expect(props.onQueued).toHaveBeenCalledWith(expect.objectContaining({state:'QUEUED'}));
});
it('does not auto-confirm availability and retains input after save failure for exact retry',async()=>{
 render(<ProductPhotoIntakeModal {...props} job={job}/>);await screen.findByDisplayValue('999');expect(screen.getByLabelText('photo.in_stock')).not.toBeChecked();
 fireEvent.click(screen.getByLabelText('photo.identity_confirm'));fireEvent.click(screen.getByLabelText('photo.price_confirm'));fireEvent.click(screen.getByLabelText('photo.in_stock'));
 mocks.confirm.mockRejectedValueOnce(Error('photo.conflict')).mockResolvedValueOnce({id:'o1',productId:'p1',amount:999,currency:'JPY',unit:'80 × 2',inStock:true,priceChanged:false,observedAt:new Date().toISOString()});
 fireEvent.click(screen.getByText('photo.save'));await screen.findByText('photo.conflict');expect(screen.getByDisplayValue('999')).toBeTruthy();expect(screen.getByLabelText('photo.in_stock')).toBeChecked();
 fireEvent.click(screen.getByText('photo.save'));await screen.findByText(/photo.price_unchanged/);expect(mocks.confirm.mock.calls[0][1]).toEqual(mocks.confirm.mock.calls[1][1]);fireEvent.click(screen.getByText('onboarding.open_product'));expect(props.onSaved).toHaveBeenCalledWith('p1');
});
it('suppresses late recognition after unmount and leaves no-match creation gated by Japanese name',async()=>{
 let finish!:(v:unknown)=>void;mocks.review.mockReturnValue(new Promise(r=>{finish=r;}));const v=render(<ProductPhotoIntakeModal {...props} job={job}/>);await waitFor(()=>expect(mocks.review).toHaveBeenCalled());v.unmount();await act(async()=>finish(review()));expect(props.onSaved).not.toHaveBeenCalled();
 mocks.review.mockResolvedValue({...review(),status:'NEW',matches:[],candidate:{translatedNames:{},name:''}});render(<ProductPhotoIntakeModal {...props} job={job}/>);await screen.findByText('photo.new');fireEvent.click(screen.getByLabelText('photo.identity_confirm'));expect(screen.getByText('photo.create')).toBeDisabled();expect(screen.getByText('master.japanese_required')).toBeTruthy();
});
it('reports supplier failure and empty list in place',async()=>{
 mocks.suppliers.mockRejectedValueOnce(Error('offline'));const v=render(<ProductPhotoIntakeModal {...props}/>);await screen.findByText('photo.suppliers_failed');v.unmount();mocks.suppliers.mockResolvedValue([]);render(<ProductPhotoIntakeModal {...props}/>);await screen.findByText('photo.no_suppliers');expect(screen.getByText('photo.upload')).toBeDisabled();
});

it('keeps confirmed review inputs when a replacement file is invalid',async()=>{
 render(<ProductPhotoIntakeModal {...props} job={job}/>);await screen.findByDisplayValue('999');fireEvent.click(screen.getByLabelText('photo.identity_confirm'));
 fireEvent.change(document.querySelectorAll('input[type=file]')[1],{target:{files:[new File(['bad'],'bad.txt',{type:'text/plain'})]}});
 await screen.findByText(/photo.file_type/);expect(screen.getByDisplayValue('999')).toBeTruthy();expect(screen.getByLabelText('photo.identity_confirm')).toBeChecked();
});

it('keeps edits on retry and clears #190 suggestions when opening a different queue item',async()=>{
 const candidate={...review(),status:'NEW',matches:[],candidate:{translatedNames:{'ja-JP':'候補'}}};
 mocks.review.mockResolvedValue({...candidate,archiveDetails:{descriptionJa:'AI suggested description',categoryNodeId:'category-1',storageCondition:'FROZEN'}});
 mocks.retry.mockResolvedValue(job);
 const screenRoot=render(<ProductPhotoIntakeModal {...props} job={job}/>);
 const description=await screen.findByLabelText('photo.description');
 expect(description).toHaveValue('AI suggested description');
 expect(screen.getByLabelText('test-category')).toHaveValue('category-1');
 expect(screen.getByRole('combobox',{name:'stock.item.storage_condition'})).toHaveValue('FROZEN');
 fireEvent.change(description,{target:{value:'First product only'}});
 fireEvent.change(screen.getByLabelText(/photo.observed_at/),{target:{value:'2026-11-10T08:30'}});
 fireEvent.change(screen.getByLabelText('test-category'),{target:{value:''}});
 fireEvent.click(screen.getByText('photo.retry_recognition'));
 await waitFor(()=>expect(mocks.retry).toHaveBeenCalledWith(job.id,job.revision));
 expect(await screen.findByLabelText('photo.description')).toHaveValue('First product only');
 expect(screen.getByLabelText(/photo.observed_at/)).toHaveValue('2026-11-10T08:30');
 expect(screen.getByLabelText('test-category')).toHaveValue('');
 expect(mocks.photo).not.toHaveBeenCalled();

 const replacement={...job,id:'job2'};
 mocks.get.mockResolvedValue(replacement);
 mocks.review.mockResolvedValue({...candidate,jobId:replacement.id});
 screenRoot.rerender(<ProductPhotoIntakeModal {...props} job={replacement}/>);
 expect(await screen.findByLabelText('photo.description')).toHaveValue('');
 expect(screen.getByLabelText(/photo.observed_at/)).not.toHaveValue('2026-11-10T08:30');
 expect(screen.getByLabelText('test-category')).toHaveValue('');
 expect(screen.getByRole('combobox',{name:'stock.item.storage_condition'})).toHaveValue('');
});

it('loads a fresh review revision after retrying the open task from the queue',async()=>{
 const after={...job,revision:9,failureCode:'photo.confirm_required'};
 const r=review();
 mocks.get.mockResolvedValueOnce(job).mockResolvedValue(after);
 mocks.review.mockResolvedValueOnce(r).mockResolvedValue({...r,revision:9,photoFacts:{...r.photoFacts,amount:888}});
 mocks.retry.mockResolvedValue({...job,state:'QUEUED',revision:8});
 render(<ProductPhotoIntakeModal {...props} job={job} queue={[job]} onReview={vi.fn()} onQueueChanged={vi.fn()}/>);
 await screen.findByDisplayValue('999');
 const queue=within(screen.getByRole('region',{name:'photo.queue'}));
 fireEvent.click(queue.getByRole('button',{name:'photo.retry_recognition'}));
 expect(await screen.findByDisplayValue('888')).toBeTruthy();
 expect(screen.queryByDisplayValue('999')).toBeNull();
 expect(mocks.retry).toHaveBeenCalledWith(job.id,job.revision);
 expect(mocks.photo).not.toHaveBeenCalled();
});

it('explains missing AI configuration without exposing an internal protocol code',async()=>{
 mocks.get.mockResolvedValue({...job,failureCode:'ai.pinned_endpoint'});render(<ProductPhotoIntakeModal {...props} job={job}/>);await screen.findByText(/photo.ai_endpoint/);expect(screen.queryByText(/ai.pinned_endpoint/)).toBeNull();expect(screen.getByText('photo.retry_recognition')).toBeTruthy();
});

it('shows retrieved sources and keeps the verified official image opt-in unchecked',async()=>{
 mocks.review.mockResolvedValue({...review(),status:'NEW',matches:[],officialImageAvailable:true,sources:[{sha256:'fixture',canonicalUrl:'https://example.test/product.png',mediaType:'image/png'}],candidate:{translatedNames:{'ja-JP':'合成商品'},unknownFields:['nutrition']}});
 render(<ProductPhotoIntakeModal {...props} job={job}/>);await screen.findByAltText('photo.official_image');expect(screen.getByLabelText('photo.use_official_image')).not.toBeChecked();expect(screen.getByRole('link')).toHaveAttribute('href','https://example.test/product.png');expect(screen.getByText('photo.unknown_fields')).toBeTruthy();
});


it('shares the unconverted capture and keeps the explicit download path when sharing is cancelled', async()=>{
 const share=vi.fn().mockRejectedValue(new DOMException('cancelled','AbortError'));
 Object.defineProperties(navigator,{share:{value:share,configurable:true},canShare:{value:()=>true,configurable:true}});
 try {
  render(<ProductPhotoIntakeModal {...props}/>);
  await waitFor(()=>expect(screen.getByText('photo.camera')).toBeEnabled());
  mocks.photo.mockResolvedValue(job);
  const capture=new File(['test'],'capture.jpg',{type:'image/jpeg'});
  fireEvent.change(document.querySelector('input[capture]')!,{target:{files:[capture]}});
  fireEvent.click(await screen.findByText('photo.save_photo'));
  await waitFor(()=>expect(share).toHaveBeenCalledWith({files:[capture]}));
  expect(screen.getByText('photo.download_photo')).toHaveAttribute('download','capture.jpg');
  expect(screen.queryByText('photo.share_failed')).not.toBeInTheDocument();
  expect(mocks.photo).toHaveBeenCalledTimes(1);
 } finally {
  Reflect.deleteProperty(navigator,'share');Reflect.deleteProperty(navigator,'canShare');
 }
});

it('downloads the stored evidence with a storage-version notice',async()=>{
 render(<ProductPhotoIntakeModal {...props} job={job}/>);
 fireEvent.click(await screen.findByText('photo.open_evidence'));
 expect(await screen.findByText('photo.stored_version')).toBeInTheDocument();
 expect(await screen.findByText('photo.download_photo')).toHaveAttribute('download','product-photo.img');
});

it('reports missing credentials without preventing photo retention',async()=>{
 mocks.status.mockResolvedValue({workerEnabled:true,photoConfigurationIssue:'ai.pinned_credentials_missing'});
 render(<ProductPhotoIntakeModal {...props}/>);
 await screen.findByText('photo.ai_credentials');
 await waitFor(()=>expect(screen.getByText('photo.camera')).toBeEnabled());
 mocks.photo.mockResolvedValue(job);
 fireEvent.change(document.querySelector('input[capture]')!,{target:{files:[new File(['test'],'test.jpg',{type:'image/jpeg'})]}});
 await waitFor(()=>expect(mocks.photo).toHaveBeenCalledTimes(1));
});
