import React from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const mocks=vi.hoisted(()=>({suppliers:vi.fn(),status:vi.fn(),photo:vi.fn(),get:vi.fn(),review:vi.fn(),confirm:vi.fn()}));
vi.mock('../api',()=>({api:{suppliers:mocks.suppliers,costcoOnboarding:{status:mocks.status,photo:mocks.photo,get:mocks.get}},photoIntakeApi:{image:()=>Promise.resolve(new Blob()),review:mocks.review,confirm:mocks.confirm,photo:()=>Promise.resolve(new Blob())},categoryTreeApi:{list:()=>Promise.resolve([])},masterDataApi:{currencies:()=>Promise.resolve([{code:'JPY'}])}}));
vi.mock('../imageUpload',()=>({prepareImageUpload:(f:File)=>f.name==='bad.txt'?Promise.reject(Error('photo.file_invalid')):Promise.resolve(f)}));
vi.mock('../i18n',()=>({useI18n:()=>({locale:'en-US',t:(k:string)=>k})}));
vi.mock('./CategoryTreePicker',()=>({default:()=>null}));
vi.mock('antd',()=>({Alert:({message,description,action}:any)=><div role="alert">{message}{description}{action}</div>,Button:({children,loading,type,...p}:any)=><button {...p}>{children}</button>,Checkbox:({children,onChange,...p}:any)=><label><input type="checkbox" {...p} onChange={onChange}/>{children}</label>,Input:Object.assign((p:any)=><input {...p}/>,{TextArea:(p:any)=><textarea {...p}/>}),Modal:({children,title}:any)=><div role="dialog">{title}{children}</div>,Select:({options,onChange,loading,...p}:any)=><select {...p} onChange={e=>onChange(e.target.value)}><option value=""/>{options.map((o:any)=><option key={o.value} {...o}>{o.label}</option>)}</select>,Space:({children}:any)=><div>{children}</div>,Typography:{Title:({children}:any)=><h2>{children}</h2>}}));
import ProductPhotoIntakeModal from './ProductPhotoIntakeModal';
const job={id:'job1',state:'NEEDS_INPUT' as const,revision:7,photo:true,supplierId:'s1'};
const review=()=>({jobId:'job1',revision:7,supplierId:'s1',market:'JP',itemNumber:'123',status:'MATCH',matches:[{id:'p1',version:2,name:{'en-US':'Synthetic item'},specification:{'ja-JP':'80 × 2'},packaging:'80 × 2',eligible:true}],history:[],saved:null,photoFacts:{amount:999,currency:'JPY',unit:'80 × 2',conditions:'',priceKind:'WAREHOUSE',productVisible:true}});
const props={open:true,onClose:vi.fn(),onQueued:vi.fn(),onSaved:vi.fn()};
beforeEach(()=>{vi.clearAllMocks();mocks.suppliers.mockResolvedValue([{id:'s1',name:{'en-US':'Supplier'}}]);mocks.status.mockResolvedValue({workerEnabled:true});mocks.get.mockResolvedValue(job);mocks.review.mockResolvedValue(review());vi.stubGlobal('URL',Object.assign(URL,{createObjectURL:()=> 'blob:fixture',revokeObjectURL:vi.fn()}));});
afterEach(cleanup);
it('preselects one supplier, offers separate rear-camera and library inputs, and queues only after submit',async()=>{
 render(<ProductPhotoIntakeModal {...props}/>);await waitFor(()=>expect(screen.getByLabelText('onboarding.supplier')).toHaveValue('s1'));
 const inputs=document.querySelectorAll<HTMLInputElement>('input[type=file]');expect(inputs[0]).toHaveAttribute('capture','environment');expect(inputs[1]).not.toHaveAttribute('capture');
 fireEvent.change(inputs[1],{target:{files:[new File(['test'],'fixture.png',{type:'image/png'})]}});await screen.findByAltText('photo.evidence');expect(mocks.photo).not.toHaveBeenCalled();
 mocks.photo.mockResolvedValue(job);fireEvent.click(screen.getByText('photo.recognize'));await waitFor(()=>expect(mocks.photo).toHaveBeenCalledTimes(1));expect(mocks.photo.mock.calls[0][0]).toMatchObject({supplierId:'s1',market:'JP'});
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
 mocks.suppliers.mockRejectedValueOnce(Error('offline'));const v=render(<ProductPhotoIntakeModal {...props}/>);await screen.findByText('photo.suppliers_failed');v.unmount();mocks.suppliers.mockResolvedValue([]);render(<ProductPhotoIntakeModal {...props}/>);await screen.findByText('photo.no_suppliers');expect(screen.getByText('photo.recognize')).toBeDisabled();
});

it('keeps confirmed review inputs when a replacement file is invalid',async()=>{
 render(<ProductPhotoIntakeModal {...props} job={job}/>);await screen.findByDisplayValue('999');fireEvent.click(screen.getByLabelText('photo.identity_confirm'));
 fireEvent.change(document.querySelectorAll('input[type=file]')[1],{target:{files:[new File(['bad'],'bad.txt',{type:'text/plain'})]}});
 await screen.findByText('photo.file_invalid');expect(screen.getByDisplayValue('999')).toBeTruthy();expect(screen.getByLabelText('photo.identity_confirm')).toBeChecked();
});

it('explains missing AI configuration without exposing an internal protocol code',async()=>{
 mocks.get.mockResolvedValue({...job,failureCode:'ai.pinned_endpoint'});render(<ProductPhotoIntakeModal {...props} job={job}/>);await screen.findByText(/photo.ai_unavailable/);expect(screen.queryByText(/ai.pinned_endpoint/)).toBeNull();expect(screen.getByText('photo.retry_recognition')).toBeTruthy();
});

it('shows retrieved sources and keeps the verified official image opt-in unchecked',async()=>{
 mocks.review.mockResolvedValue({...review(),status:'NEW',matches:[],officialImageAvailable:true,sources:[{sha256:'fixture',canonicalUrl:'https://example.test/product.png',mediaType:'image/png'}],candidate:{translatedNames:{'ja-JP':'合成商品'},unknownFields:['nutrition']}});
 render(<ProductPhotoIntakeModal {...props} job={job}/>);await screen.findByAltText('photo.official_image');expect(screen.getByLabelText('photo.use_official_image')).not.toBeChecked();expect(screen.getByRole('link')).toHaveAttribute('href','https://example.test/product.png');expect(screen.getByText('photo.unknown_fields')).toBeTruthy();
});
