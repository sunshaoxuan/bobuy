import React from'react';
import{cleanup,fireEvent,render,screen,waitFor}from'@testing-library/react';
import{afterEach,expect,it,vi}from'vitest';
import{I18nProvider}from'../i18n';
import AiQuickAddModal from'./AiQuickAddModal';
const legacy=vi.hoisted(()=>({scan:vi.fn(),confirm:vi.fn()}));
vi.mock('../api',()=>({api:{onboardScan:(...args:unknown[])=>legacy.scan(...args),onboardConfirm:(...args:unknown[])=>legacy.confirm(...args)}}));
afterEach(cleanup);
it('queues the original photo once through shared durable input without legacy product confirmation',async()=>{
 let resolve!:(job:{id:string;state:'QUEUED';revision:number})=>void;const enqueuePhoto=vi.fn((_file:File)=>new Promise<{id:string;state:'QUEUED';revision:number}>(r=>{resolve=r;}));const onQueued=vi.fn(),onSuccess=vi.fn();
 render(<I18nProvider><AiQuickAddModal visible onCancel={vi.fn()} onSuccess={onSuccess} durable={{ready:true,enqueuePhoto,onQueued}}/></I18nProvider>);
 const input=document.querySelector('input[type=file]') as HTMLInputElement;expect(input).toBeTruthy();
 const photo=new File(['unit-fixture'],'photo.png',{type:'image/png'});fireEvent.change(input,{target:{files:[photo]}});fireEvent.change(input,{target:{files:[photo]}});
 await waitFor(()=>expect(enqueuePhoto).toHaveBeenCalledTimes(1));expect(enqueuePhoto.mock.calls[0][0].name).toBe('photo.png');
 resolve({id:'queued-photo',state:'QUEUED',revision:0});await waitFor(()=>expect(onQueued).toHaveBeenCalledWith({id:'queued-photo',state:'QUEUED',revision:0}));
 expect(legacy.scan).not.toHaveBeenCalled();expect(legacy.confirm).not.toHaveBeenCalled();expect(onSuccess).not.toHaveBeenCalled();
});
