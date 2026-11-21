import React from 'react';
import{cleanup,fireEvent,render,screen,waitFor}from'@testing-library/react';
import{afterEach,beforeEach,describe,expect,it,vi}from'vitest';
const fixture=vi.hoisted(()=>({user:{id:1,roles:['AGENT']},workerEnabled:true,listener:undefined as undefined|(()=>void),list:vi.fn(),number:vi.fn(),photo:vi.fn(),queue:vi.fn()}));
vi.mock('../authStorage',()=>({getStoredUser:()=>fixture.user,subscribeToAuthChanges:(f:()=>void)=>{fixture.listener=f;return()=>{fixture.listener=undefined;};}}));
vi.mock('../api',()=>({api:{costcoOnboarding:{status:()=>Promise.resolve({workerEnabled:fixture.workerEnabled}),list:(...args:unknown[])=>fixture.list(...args),number:(...args:unknown[])=>fixture.number(...args),photo:(...args:unknown[])=>fixture.photo(...args)}},photoIntakeApi:{queue:fixture.queue,photo:async()=>{throw new Error("synthetic thumbnail unavailable");}}}));
vi.mock('../i18n',()=>({useI18n:()=>({locale:'en-US',t:(key:string)=>key})}));
vi.mock('antd',()=>({Alert:({message}:{message:string})=><p role="alert">{message}</p>,Button:({children,...p}:React.ButtonHTMLAttributes<HTMLButtonElement>)=><button {...p}>{children}</button>,Space:({children}:{children:React.ReactNode})=><div>{children}</div>,Tag:({children}:{children:React.ReactNode})=><span>{children}</span>,Typography:{Text:({children}:{children:React.ReactNode})=><span>{children}</span>},Select:({options,onChange,...p}:{options:{value:string;label:string}[];onChange:(v:string)=>void})=><select {...p} onChange={e=>onChange(e.target.value)}><option value=""/>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>}));
vi.mock('./ProductPhotoIntakeModal',()=>({default:({job,queue}:{job?:{id:string};queue:unknown[]})=>job?<output>{job.id}<span data-testid="modal-queue-count">{queue.length}</span></output>:null}));
import CostcoOnboardingPanel from './CostcoOnboardingPanel';
const props={suppliers:[{id:'supplier-jp',name:{'en-US':'Synthetic supplier'}}],photoOpen:false,onPhotoClose:vi.fn(),onOpenProduct:vi.fn()};
afterEach(cleanup);beforeEach(()=>{fixture.user={id:1,roles:['AGENT']};fixture.workerEnabled=true;fixture.queue.mockReset().mockResolvedValue([]);fixture.list.mockReset().mockResolvedValue([]);fixture.number.mockReset().mockResolvedValue({id:'job',state:'QUEUED',revision:0});});
describe('owned durable task panel',()=>{
 it('shows separate photo queue counts and opens an older photo for confirmation',async()=>{
  const target=document.createElement('div');
  document.body.appendChild(target);
  const createdAt='2026-11-21T08:00:00Z';
  fixture.queue.mockResolvedValue([
   {id:'queue-one',state:'QUEUED',revision:0,createdAt},
   {id:'queue-two',state:'AI_REVIEW',revision:2,createdAt},
   {id:'older-photo',state:'NEEDS_INPUT',revision:4,createdAt,itemNumber:'93963',reviewReady:true},
  ]);
  const view=render(<CostcoOnboardingPanel {...props} photoQueueTarget={target}/>);
  try{
   expect(await screen.findByText('photo.state.queued 1')).toBeVisible();
   expect(screen.getByText('photo.state.running 1')).toBeVisible();
   expect(screen.getByText('photo.state.confirm 1')).toBeVisible();
   fireEvent.click(screen.getByRole('button',{name:'photo.queue'}));
   fireEvent.click(screen.getByRole('button',{name:'photo.queue_review'}));
   expect(screen.getByText('older-photo')).toBeVisible();
   expect(screen.getByTestId('modal-queue-count')).toHaveTextContent('3');
  }finally{view.unmount();target.remove();}
 });
 it('queues the selected supplier and shows real state without merchant fields or fake completion',async()=>{
  render(<CostcoOnboardingPanel {...props}/>);await waitFor(()=>expect(fixture.list).toHaveBeenCalled());
  fireEvent.change(screen.getByLabelText('onboarding.supplier'),{target:{value:'supplier-jp'}});fireEvent.click(screen.getByText('onboarding.number_title'));
  fireEvent.change(screen.getByLabelText('onboarding.item'),{target:{value:'００１４１１０'}});fireEvent.click(screen.getByText('onboarding.start'));
  await screen.findByText('onboarding.state.QUEUED');expect(fixture.number).toHaveBeenCalledTimes(1);
  expect(Object.keys(fixture.number.mock.calls[0][0]).sort()).toEqual(['itemNumber','market','requestId','supplierId']);
  expect(fixture.number.mock.calls[0][0].supplierId).toBe('supplier-jp');expect(screen.queryByText('onboarding.state.COMPLETED')).toBeNull();
 });
 it('does not accept a prior account poll after an account switch',async()=>{
  let resolve!:(value:unknown[])=>void;fixture.list.mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  render(<CostcoOnboardingPanel {...props}/>);await waitFor(()=>expect(fixture.list).toHaveBeenCalledTimes(1));
  fixture.user={id:2,roles:['AGENT']};fixture.listener?.();resolve([{id:'other-account-job',state:'COMPLETED',revision:7,itemNumber:'private-item',productId:'private-product'}]);
  await waitFor(()=>expect(fixture.list).toHaveBeenCalledTimes(2));expect(screen.queryByText('private-item')).toBeNull();
 });
 it('keeps pending task reads valid when auth refresh announces the same principal',async()=>{
  let resolve!:(v:unknown[])=>void;fixture.list.mockReturnValue(new Promise(r=>{resolve=r;}));render(<CostcoOnboardingPanel {...props}/>);
  fixture.listener?.();resolve([{id:'same-user-job',state:'NEEDS_INPUT',revision:7,itemNumber:'same-user-item'}]);await screen.findByText('same-user-item');
 });
 it('retains saved candidate details and blocks new work when the worker is disabled',async()=>{
  fixture.workerEnabled=false;fixture.list.mockResolvedValue([{id:'draft',state:'NEEDS_INPUT',revision:9,failureCode:'onboarding.new_master_needs_price_policy',candidate:{itemNumber:'14110',name:'Synthetic product',brand:'Synthetic brand',packaging:'80 × 2',translatedNames:{'en-US':'Synthetic product'},referencePrices:[]}}]);
  render(<CostcoOnboardingPanel {...props}/>);await screen.findByText('onboarding.worker_disabled');
  fireEvent.change(screen.getByLabelText('onboarding.supplier'),{target:{value:'supplier-jp'}});
  expect((screen.getByText('onboarding.number_title') as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText('onboarding.master_pending')).toBeTruthy();expect(screen.getByText('80 × 2')).toBeTruthy();expect(screen.queryByText('onboarding.state.COMPLETED')).toBeNull();
 });
 it('does not render management intake or read tasks for a customer session',()=>{
  fixture.user={id:2,roles:['CUSTOMER']};render(<CostcoOnboardingPanel {...props}/>);expect(screen.queryByLabelText('onboarding.title')).toBeNull();expect(fixture.list).not.toHaveBeenCalled();
 });
 it('shows discount kind, channel, tax and timezone as reference facts rather than a selling quote',async()=>{
  fixture.list.mockResolvedValue([{id:'facts',state:'NEEDS_INPUT',revision:9,candidate:{itemNumber:'14110',name:'Synthetic product',translatedNames:{'en-US':'Synthetic product'},referencePrices:[{kind:'DISCOUNT',amount:300,currency:'JPY',channel:'WAREHOUSE',taxStatus:'INCLUDED',timeZone:'Asia/Tokyo',validFrom:'2026-11-09',validUntil:'2026-11-15',conditions:'Synthetic condition',sourceUrl:'https://example.test/product',sourceSha256:'a'.repeat(64)}]}}]);
  render(<CostcoOnboardingPanel {...props}/>);await screen.findByText(/onboarding.reference_kind.DISCOUNT/);expect(screen.queryByText(/onboarding.reference_kind.OFFER/)).toBeNull();expect(screen.getByText(/WAREHOUSE/)).toBeTruthy();expect(screen.getByText(/INCLUDED/)).toBeTruthy();expect(screen.getByText(/Asia\/Tokyo/).textContent).toContain('Asia/Tokyo');expect(screen.getByRole('link',{name:'onboarding.source'}).getAttribute('href')).toBe('https://example.test/product');
 });
});
