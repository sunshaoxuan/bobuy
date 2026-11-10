import {act,fireEvent,render,screen} from '@testing-library/react';
import {useEffect} from 'react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {ImageLightbox,IMAGE_TAP_DELAY} from './ImageLightbox';
vi.mock('antd',()=>({Modal:({open,children,afterOpenChange}:any)=>{useEffect(()=>afterOpenChange?.(!!open),[open]);return open?<div role="dialog">{children}</div>:null;}}));
vi.mock('../i18n',()=>({useI18n:()=>({t:(key:string)=>key})}));
const pictures=[{id:'one',url:'/synthetic.png',label:'Synthetic'}];
beforeEach(()=>{
 vi.useFakeTimers();
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
 vi.stubGlobal('PointerEvent',class extends MouseEvent{pointerId:number;pointerType:string;isPrimary:boolean;constructor(type:string,init:any){super(type,init);this.pointerId=init.pointerId??1;this.pointerType=init.pointerType??'mouse';this.isPrimary=init.isPrimary??true;}});
 HTMLElement.prototype.setPointerCapture=vi.fn();
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(500);vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(400);
});
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllGlobals();});
function setup(w=1500,h=900){const close=vi.fn(),change=vi.fn();const result=render(<ImageLightbox pictures={pictures} index={0} open name="Synthetic" onIndexChange={change} onClose={close}/>);const image=result.container.querySelector('.rec-gallery-native')!;Object.defineProperties(image,{naturalWidth:{value:w},naturalHeight:{value:h}});fireEvent.load(image);return {...result,close,change,stage:screen.getByRole('group'),image};}
function tap(stage:HTMLElement,type='mouse'){fireEvent.pointerDown(stage,{pointerId:1,pointerType:type,isPrimary:true,button:0,clientX:200,clientY:180});fireEvent.pointerUp(stage,{pointerId:1,pointerType:type,isPrimary:true,button:0,clientX:200,clientY:180});}
it.each(['mouse','touch'])('separates %s single-close from double-tap native zoom',type=>{
 const {stage,close}=setup();tap(stage,type);act(()=>vi.advanceTimersByTime(90));expect(close).not.toHaveBeenCalled();tap(stage,type);expect(stage).toHaveAttribute('data-zoom','true');act(()=>vi.advanceTimersByTime(IMAGE_TAP_DELAY+1));expect(close).not.toHaveBeenCalled();
 tap(stage,type);act(()=>vi.advanceTimersByTime(90));tap(stage,type);expect(stage).toHaveAttribute('data-zoom','false');act(()=>vi.advanceTimersByTime(IMAGE_TAP_DELAY+1));expect(close).not.toHaveBeenCalled();tap(stage,type);act(()=>vi.advanceTimersByTime(IMAGE_TAP_DELAY+1));expect(close).toHaveBeenCalledTimes(1);
});
it('bounds native dragging and suppresses drag-generated close or gallery navigation',()=>{
 const {stage,image,close,change}=setup();fireEvent.click(screen.getByRole('button',{name:'gallery.native'}));fireEvent.pointerDown(stage,{pointerId:1,isPrimary:true,button:0,clientX:200,clientY:180});fireEvent.pointerMove(stage,{pointerId:1,isPrimary:true,button:0,clientX:2200,clientY:2000});fireEvent.pointerUp(stage,{pointerId:1,isPrimary:true,button:0,clientX:2200,clientY:2000});fireEvent.click(stage);
 expect((image as HTMLElement).style.transform).toContain('500px');expect((image as HTMLElement).style.transform).toContain('250px');act(()=>vi.advanceTimersByTime(600));expect(close).not.toHaveBeenCalled();expect(change).not.toHaveBeenCalled();
});
it('does not upscale a small source and cancels pending close timers on unmount',()=>{
 const {stage,close,unmount}=setup(200,100);expect(screen.getByRole('button',{name:'gallery.native'})).toBeDisabled();tap(stage,'touch');unmount();act(()=>vi.advanceTimersByTime(IMAGE_TAP_DELAY+1));expect(close).not.toHaveBeenCalled();
});
it('handles Escape before an underlying editor receives it',()=>{
 const {stage,close}=setup();const underlying=vi.fn();document.addEventListener('keydown',underlying);
 fireEvent.keyDown(stage,{key:'Escape'});expect(close).toHaveBeenCalledTimes(1);expect(underlying).not.toHaveBeenCalled();document.removeEventListener('keydown',underlying);
});
