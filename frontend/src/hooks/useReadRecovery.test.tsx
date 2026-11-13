import {act,renderHook} from '@testing-library/react';
import {useReadRecovery} from './useReadRecovery';
const online=(value:boolean)=>Object.defineProperty(navigator,'onLine',{configurable:true,value});
const visible=(value:string)=>Object.defineProperty(document,'visibilityState',{configurable:true,value});
const events=()=>{window.dispatchEvent(new Event('online'));window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'));};
const tick=async(ms=250)=>act(async()=>{await vi.advanceTimersByTimeAsync(ms);});
beforeEach(()=>{vi.useFakeTimers();online(true);visible('visible');});
afterEach(()=>{vi.useRealTimers();online(true);visible('visible');});
it('has no mount request, coalesces events, blocks in-flight work and retains cooldown',async()=>{
 let finish!:()=>void;const task=vi.fn().mockImplementationOnce(()=>new Promise<void>(done=>{finish=done;})).mockResolvedValue(undefined);
 const view=renderHook(({enabled})=>useReadRecovery(task,enabled,'same'),{initialProps:{enabled:true}});expect(task).not.toHaveBeenCalled();act(events);await tick();expect(task).toHaveBeenCalledTimes(1);
 act(events);await tick(6000);expect(task).toHaveBeenCalledTimes(1);await act(async()=>finish());
 act(events);await tick();expect(task).toHaveBeenCalledTimes(2);view.rerender({enabled:false});view.rerender({enabled:true});act(events);await tick();expect(task).toHaveBeenCalledTimes(2);
 await tick(5000);act(events);await tick();expect(task).toHaveBeenCalledTimes(3);
});
it('does not read while hidden or offline, including a queued event that becomes hidden',async()=>{
 const task=vi.fn();renderHook(()=>useReadRecovery(task,true,'a'));visible('hidden');act(events);await tick();online(false);visible('visible');act(events);await tick();expect(task).not.toHaveBeenCalled();online(true);act(events);visible('hidden');await tick();expect(task).not.toHaveBeenCalled();visible('visible');act(events);await tick();expect(task).toHaveBeenCalledTimes(1);
});
it('uses the latest callback and cancels queued work at unmount or identity change',async()=>{
 const a=vi.fn(),b=vi.fn();const view=renderHook(({task,id,enabled})=>useReadRecovery(task,enabled,id),{initialProps:{task:a,id:'a',enabled:true}});
 act(events);view.rerender({task:b,id:'b',enabled:true});await tick();expect(a).not.toHaveBeenCalled();expect(b).not.toHaveBeenCalled();act(events);await tick();expect(b).toHaveBeenCalledTimes(1);
 view.rerender({task:a,id:'c',enabled:true});act(events);view.unmount();await tick();act(events);await tick();expect(a).not.toHaveBeenCalled();
});
it('cleans pending recovery when disabled and absorbs owned task failures without looping',async()=>{
 const task=vi.fn().mockRejectedValue(Error('still offline'));const view=renderHook(({enabled})=>useReadRecovery(task,enabled,'a'),{initialProps:{enabled:true}});act(events);view.rerender({enabled:false});await tick();expect(task).not.toHaveBeenCalled();view.rerender({enabled:true});act(events);await tick();expect(task).toHaveBeenCalledTimes(1);await tick(60000);expect(task).toHaveBeenCalledTimes(1);
});
