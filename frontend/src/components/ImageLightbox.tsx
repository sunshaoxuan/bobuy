import {useEffect,useRef,useState,type PointerEvent,type RefObject} from 'react';
import {Modal} from 'antd';
import {useI18n} from '../i18n';
import {boundPan,dragOffset,swipeDirection} from './imageGestures';
import './recommendationImageViewer.css';

export type LightboxPicture={id:string;url:string;label?:string};
export const IMAGE_TAP_DELAY=340;

/** Shared customer/admin viewer. A tap waits for a possible second tap; drags never close. */
export function ImageLightbox({pictures,index,open,name,onIndexChange,onClose,returnFocus}:{pictures:LightboxPicture[];index:number;open:boolean;name:string;onIndexChange:(index:number)=>void;onClose:()=>void;returnFocus?:RefObject<HTMLElement>}){
 const {t}=useI18n();const picture=pictures[index];
 const [zoom,setZoom]=useState(false),[dimensions,setDimensions]=useState({url:'',w:0,h:0}),[viewport,setViewport]=useState({w:0,h:0}),[pan,setPan]=useState({x:0,y:0});
 const [stage,setStage]=useState<HTMLDivElement|null>(null),[motion,setMotion]=useState({offset:0,settling:false}),[ready,setReady]=useState(false);
 const natural=dimensions.url===picture?.url?dimensions:{w:0,h:0};
 const gesture=useRef<{id:number;x:number;y:number;px:number;py:number;width:number;axis:''|'x'|'y';moved:boolean}|null>(null);
 const tap=useRef<{time:number;x:number;y:number}|null>(null),tapTimer=useRef<ReturnType<typeof setTimeout>|null>(null),settlement=useRef<ReturnType<typeof setTimeout>|null>(null),suppress=useRef(0);
 function clearTap(){if(tapTimer.current!==null)clearTimeout(tapTimer.current);tapTimer.current=null;tap.current=null;}
 function resetMotion(){if(settlement.current!==null)clearTimeout(settlement.current);settlement.current=null;gesture.current=null;setMotion({offset:0,settling:false});}
 function close(){clearTap();resetMotion();onClose();}
 const canZoom=natural.w>viewport.w||natural.h>viewport.h;
 function toggleZoom(){clearTap();resetMotion();if(canZoom)setZoom(value=>!value);setPan({x:0,y:0});}
 function change(next:number){clearTap();resetMotion();onIndexChange(Math.max(0,Math.min(pictures.length-1,next)));setZoom(false);setPan({x:0,y:0});}
 useEffect(()=>{clearTap();resetMotion();setZoom(false);setPan({x:0,y:0});suppress.current=0;},[open,picture?.url]);
 useEffect(()=>{if(!open)setReady(false);},[open]);
 useEffect(()=>()=>{if(tapTimer.current!==null)clearTimeout(tapTimer.current);if(settlement.current!==null)clearTimeout(settlement.current);},[]);
 useEffect(()=>{if(!open||!stage)return;const measure=()=>{setViewport({w:stage.clientWidth,h:stage.clientHeight});setPan({x:0,y:0});};measure();const observer=new ResizeObserver(measure);observer.observe(stage);return()=>observer.disconnect();},[open,stage]);
 useEffect(()=>{if(!open)return;const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}else if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();change(index+(event.key==='ArrowLeft'?-1:1));}else if(event.key==='0'){event.preventDefault();clearTap();setZoom(false);setPan({x:0,y:0});}else if(event.key==='1'&&canZoom){event.preventDefault();clearTap();setZoom(true);setPan({x:0,y:0});}};window.addEventListener('keydown',key,true);return()=>window.removeEventListener('keydown',key,true);},[open,index,canZoom,pictures.length]);
 function settle(direction:number,width:number){
  const next=Math.max(0,Math.min(pictures.length-1,index+direction)),delta=next-index;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){change(next);return;}
  setMotion({offset:-delta*width,settling:true});settlement.current=setTimeout(()=>{settlement.current=null;onIndexChange(next);setMotion({offset:0,settling:false});},240);
 }
 function down(event:PointerEvent<HTMLDivElement>){
  if(!ready)return;
  if(!event.isPrimary||event.button!==0){cancel();return;}
  if(motion.settling){clearTap();suppress.current=Date.now()+500;return;}
  if(tapTimer.current!==null){clearTimeout(tapTimer.current);tapTimer.current=null;}
  gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,px:pan.x,py:pan.y,width:event.currentTarget.clientWidth,axis:'',moved:false};event.currentTarget.setPointerCapture(event.pointerId);
 }
 function move(event:PointerEvent<HTMLDivElement>){
  const g=gesture.current;if(!g||g.id!==event.pointerId)return;const dx=event.clientX-g.x,dy=event.clientY-g.y;
  if(Math.hypot(dx,dy)>8){g.moved=true;clearTap();suppress.current=Date.now()+500;if(!g.axis)g.axis=Math.abs(dx)>Math.abs(dy)*1.35?'x':'y';}
  if(zoom)setPan({x:boundPan(g.px+dx,natural.w,viewport.w),y:boundPan(g.py+dy,natural.h,viewport.h)});
  else if(g.axis==='x'){if(event.cancelable)event.preventDefault();setMotion({offset:dragOffset(dx,g.width,index===0,index===pictures.length-1),settling:false});}
 }
 function up(event:PointerEvent<HTMLDivElement>){
  const g=gesture.current;if(!g||g.id!==event.pointerId)return;gesture.current=null;const dx=event.clientX-g.x,dy=event.clientY-g.y;
  if(g.moved){clearTap();suppress.current=Date.now()+500;if(!zoom&&g.axis==='x')settle(swipeDirection(dx,dy),g.width);return;}
  if(Date.now()<suppress.current)return;
  const now=Date.now(),previous=tap.current;
  if(previous&&now-previous.time<IMAGE_TAP_DELAY&&Math.hypot(event.clientX-previous.x,event.clientY-previous.y)<24){toggleZoom();return;}
  clearTap();tap.current={time:now,x:event.clientX,y:event.clientY};tapTimer.current=setTimeout(()=>{tapTimer.current=null;tap.current=null;close();},IMAGE_TAP_DELAY);
 }
 function cancel(){const g=gesture.current;if(!g)return;gesture.current=null;clearTap();suppress.current=Date.now()+500;if(g.axis==='x'&&!zoom)settle(0,g.width);}
 const fit=natural.w&&viewport.w?Math.min(1,viewport.w/natural.w,viewport.h/natural.h):0;
 const rail=<div className="rec-gallery-rail" data-settling={motion.settling} style={{transform:`translateX(${motion.offset}px)`}}>{[-1,0,1].map(slot=>{const p=pictures[index+slot];return <div className="rec-gallery-slide" key={slot} style={{left:`${slot*100}%`}} aria-hidden={slot!==0}>{p&&<img src={p.url} alt={slot===0?(p.label||name):''} draggable={false}/>}</div>;})}</div>;
 return <Modal open={open&&!!picture} onCancel={close} afterOpenChange={setReady} afterClose={()=>returnFocus?.current?.focus()} footer={null} title={t('gallery.fullscreen')} rootClassName="rec-gallery-fullscreen" width="100vw" centered destroyOnClose zIndex={1400}>
  <div className="rec-gallery-tools"><button type="button" disabled={index===0} onClick={()=>change(index-1)} aria-label={t('gallery.previous')}>‹</button><span aria-live="polite">{index+1} / {pictures.length}</span><button type="button" disabled={index===pictures.length-1} onClick={()=>change(index+1)} aria-label={t('gallery.next')}>›</button><button type="button" disabled={!canZoom} aria-pressed={zoom} onClick={toggleZoom}>{zoom?t('gallery.fit'):t('gallery.native')}</button></div>
  <div ref={setStage} className="rec-gallery-stage" data-ready={ready} data-zoom={zoom} role="group" aria-label={name} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} onDoubleClick={event=>event.preventDefault()}>
   {!zoom&&rail}{picture&&<img className="rec-gallery-native" key={picture.url} src={picture.url} alt={zoom?(picture.label||name):''} aria-hidden={!zoom} draggable={false} onLoad={event=>setDimensions({url:picture.url,w:event.currentTarget.naturalWidth,h:event.currentTarget.naturalHeight})} style={{width:natural.w?(zoom?natural.w:natural.w*fit):undefined,height:natural.h?(zoom?natural.h:natural.h*fit):undefined,visibility:zoom&&fit?'visible':'hidden',transform:`translate(calc(-50% + ${pan.x}px),calc(-50% + ${pan.y}px))`}}/>}
  </div><p className="rec-gallery-hint">{t('gallery.inspect_hint')}</p>
 </Modal>;
}
