import {useEffect, useRef, useState, type PointerEvent} from 'react';
import {Modal} from 'antd';
import type {RecommendationPicture} from '../api';
import {useI18n} from '../i18n';
import './recommendationImageViewer.css';

export const boundPan=(value:number,image:number,viewport:number)=>Math.max(-Math.max(0,(image-viewport)/2),Math.min(Math.max(0,(image-viewport)/2),value))||0;
export const swipeDirection=(dx:number,dy:number)=>Math.abs(dx)>=45&&Math.abs(dx)>Math.abs(dy)*1.35?(dx<0?1:-1):0;
export const dragOffset=(dx:number,width:number,atStart:boolean,atEnd:boolean)=>Math.max(-width,Math.min(width,dx*((dx>0&&atStart)||(dx<0&&atEnd)?.25:1)));

/** One gesture owner: fit swipes navigate; native-size drags only pan. */
export function RecommendationImageViewer({pictures,name}:{pictures:RecommendationPicture[];name:string}){
 const {t}=useI18n();const [index,setIndex]=useState(0),[open,setOpen]=useState(false),[zoom,setZoom]=useState(false);
 const [natural,setNatural]=useState({w:0,h:0}),[viewport,setViewport]=useState({w:0,h:0}),[pan,setPan]=useState({x:0,y:0});
 const [stage,setStage]=useState<HTMLDivElement|null>(null);const opener=useRef<HTMLDivElement>(null),pointerKind=useRef('mouse');
 const [motion,setMotion]=useState({offset:0,settling:false});
 const settlement=useRef<ReturnType<typeof setTimeout>|null>(null);
 const gesture=useRef<{id:number;x:number;y:number;px:number;py:number;width:number;axis:''|'x'|'y';moved:boolean}|null>(null),suppress=useRef(0),lastTap=useRef(0);
 function resetMotion(){if(settlement.current!==null)clearTimeout(settlement.current);settlement.current=null;gesture.current=null;setMotion({offset:0,settling:false});}
 const picture=pictures[index];
 useEffect(()=>{resetMotion();setIndex(0);setOpen(false);},[pictures]);
 useEffect(()=>()=>{if(settlement.current!==null)clearTimeout(settlement.current);},[]);
 useEffect(()=>{setNatural({w:0,h:0});setZoom(false);setPan({x:0,y:0});lastTap.current=0;},[picture?.url]);
 useEffect(()=>{if(!open||!stage)return;const observer=new ResizeObserver(()=>{setViewport({w:stage.clientWidth,h:stage.clientHeight});setPan({x:0,y:0});});observer.observe(stage);return()=>observer.disconnect();},[open,stage]);
 const canZoom=natural.w>viewport.w||natural.h>viewport.h;
 function toggleZoom(){if(!canZoom)return;resetMotion();setZoom(value=>!value);setPan({x:0,y:0});}
 function change(delta:number){resetMotion();setIndex(value=>Math.max(0,Math.min(pictures.length-1,value+delta)));setZoom(false);setPan({x:0,y:0});lastTap.current=0;}
 useEffect(()=>{if(!open)return;const key=(event:KeyboardEvent)=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();change(event.key==='ArrowLeft'?-1:1);}else if(event.key==='0'){event.preventDefault();setZoom(false);setPan({x:0,y:0});}else if(event.key==='1'){event.preventDefault();if(canZoom){setZoom(true);setPan({x:0,y:0});}}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[open,canZoom,pictures.length]);
 function settle(direction:number,width:number){
  const next=Math.max(0,Math.min(pictures.length-1,index+direction)),delta=next-index;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced){change(delta);return;}
  setMotion({offset:-delta*width,settling:true});
  settlement.current=setTimeout(()=>{settlement.current=null;setIndex(next);setMotion({offset:0,settling:false});},240);
 }
 function down(event:PointerEvent<HTMLDivElement>){pointerKind.current=event.pointerType;if(motion.settling){suppress.current=Date.now()+500;return;}if(!event.isPrimary||event.button!==0){cancel();return;}gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,px:pan.x,py:pan.y,width:event.currentTarget.clientWidth,axis:'',moved:false};event.currentTarget.setPointerCapture(event.pointerId);}
 function move(event:PointerEvent<HTMLDivElement>){const g=gesture.current;if(!g||g.id!==event.pointerId)return;const dx=event.clientX-g.x,dy=event.clientY-g.y;if(Math.hypot(dx,dy)>8){g.moved=true;suppress.current=Date.now()+500;if(!g.axis)g.axis=Math.abs(dx)>Math.abs(dy)*1.35?'x':'y';}
  if(open&&zoom)setPan({x:boundPan(g.px+dx,natural.w,viewport.w),y:boundPan(g.py+dy,natural.h,viewport.h)});
  else if(g.axis==='x'){if(event.cancelable)event.preventDefault();setMotion({offset:dragOffset(dx,g.width,index===0,index===pictures.length-1),settling:false});}
 }
 function up(event:PointerEvent<HTMLDivElement>){const g=gesture.current;if(!g||g.id!==event.pointerId)return;gesture.current=null;const dx=event.clientX-g.x,dy=event.clientY-g.y;
  if(g.moved){suppress.current=Date.now()+500;if(!zoom&&g.axis==='x')settle(swipeDirection(dx,dy),g.width);lastTap.current=0;}
  else if(open&&event.pointerType!=='mouse'){const now=Date.now();if(now-lastTap.current<300){toggleZoom();lastTap.current=0;}else lastTap.current=now;}
 }
 function cancel(){const g=gesture.current;if(!g)return;gesture.current=null;if(g.axis==='x'&&!zoom)settle(0,g.width);lastTap.current=0;suppress.current=Date.now()+500;}
 function activate(){if(Date.now()<suppress.current)return;setOpen(true);}
 if(!picture)return <div className="rec-no-product-image">{t('gallery.pending')}</div>;
 const fit=natural.w&&viewport.w?Math.min(1,viewport.w/natural.w,viewport.h/natural.h):0;
 const rail=<div className="rec-gallery-rail" data-settling={motion.settling} style={{transform:`translateX(${motion.offset}px)`}}>{[-1,0,1].map(slot=>{const p=pictures[index+slot];return <div className="rec-gallery-slide" key={slot} style={{left:`${slot*100}%`}} aria-hidden={slot!==0}>{p&&<img src={p.url} alt={slot===0?(p.label||name):''} draggable={false}/>}</div>;})}</div>;
 return <div className="rec-detail-gallery">
  <div ref={opener} className="rec-gallery-inline" role="button" tabIndex={0} aria-label={t('gallery.fullscreen')}
   onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel}
   onClick={activate} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();change(e.key==='ArrowLeft'?-1:1);}}}>
   <img className="rec-gallery-sizer" src={picture.url} alt="" aria-hidden="true" draggable={false}/>{rail}
  </div>
  <div className="rec-gallery-navigation"><button type="button" disabled={index===0} onClick={()=>change(-1)} aria-label={t('gallery.previous')}>‹</button><span aria-live="polite">{index+1} / {pictures.length}</span><button type="button" disabled={index===pictures.length-1} onClick={()=>change(1)} aria-label={t('gallery.next')}>›</button></div>
  <div className="rec-detail-thumbs">{pictures.map((p,i)=><button type="button" key={p.id} aria-label={t('gallery.view',{number:i+1})} aria-pressed={i===index} onClick={()=>change(i-index)}><img src={p.url} alt={p.label||name} draggable={false}/></button>)}</div>
  <Modal open={open} onCancel={()=>{resetMotion();setOpen(false);setZoom(false);}} afterClose={()=>opener.current?.focus()} footer={null} title={t('gallery.fullscreen')} rootClassName="rec-gallery-fullscreen" width="100vw" centered destroyOnClose>
   <div className="rec-gallery-tools"><button type="button" disabled={index===0} onClick={()=>change(-1)} aria-label={t('gallery.previous')}>‹</button><span aria-live="polite">{index+1} / {pictures.length}</span><button type="button" disabled={index===pictures.length-1} onClick={()=>change(1)} aria-label={t('gallery.next')}>›</button><button type="button" disabled={!canZoom} aria-pressed={zoom} onClick={toggleZoom}>{zoom?t('gallery.fit'):t('gallery.native')}</button></div>
   <div ref={setStage} className="rec-gallery-stage" data-zoom={zoom} role="group" aria-label={name} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} onDoubleClick={e=>{if(e.detail===2&&pointerKind.current==='mouse'&&Date.now()>=suppress.current)toggleZoom();}}>
    {!zoom&&rail}<img key={picture.url} src={picture.url} alt={zoom?(picture.label||name):''} aria-hidden={!zoom} draggable={false} onLoad={e=>setNatural({w:e.currentTarget.naturalWidth,h:e.currentTarget.naturalHeight})} style={{width:natural.w?(zoom?natural.w:natural.w*fit):undefined,height:natural.h?(zoom?natural.h:natural.h*fit):undefined,visibility:zoom&&fit?'visible':'hidden',transform:`translate(calc(-50% + ${pan.x}px),calc(-50% + ${pan.y}px))`}}/>
   </div><p className="rec-gallery-hint">{t(zoom?'gallery.pan_hint':'gallery.swipe_hint')}</p>
  </Modal>
 </div>;
}
