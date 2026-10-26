import {useEffect, useRef, useState, type PointerEvent} from 'react';
import {Modal} from 'antd';
import type {RecommendationPicture} from '../api';
import {useI18n} from '../i18n';
import './recommendationImageViewer.css';

export const boundPan=(value:number,image:number,viewport:number)=>Math.max(-Math.max(0,(image-viewport)/2),Math.min(Math.max(0,(image-viewport)/2),value))||0;
export const swipeDirection=(dx:number,dy:number)=>Math.abs(dx)>=45&&Math.abs(dx)>Math.abs(dy)*1.35?(dx<0?1:-1):0;

/** One gesture owner: fit swipes navigate; native-size drags only pan. */
export function RecommendationImageViewer({pictures,name}:{pictures:RecommendationPicture[];name:string}){
 const {t}=useI18n();const [index,setIndex]=useState(0),[open,setOpen]=useState(false),[zoom,setZoom]=useState(false);
 const [natural,setNatural]=useState({w:0,h:0}),[viewport,setViewport]=useState({w:0,h:0}),[pan,setPan]=useState({x:0,y:0});
 const [stage,setStage]=useState<HTMLDivElement|null>(null);const opener=useRef<HTMLDivElement>(null),pointerKind=useRef('mouse');
 const gesture=useRef<{id:number;x:number;y:number;px:number;py:number;moved:boolean}|null>(null),suppress=useRef(0),lastTap=useRef(0);
 const picture=pictures[index];
 useEffect(()=>{setIndex(0);setOpen(false);},[pictures]);
 useEffect(()=>{setNatural({w:0,h:0});setZoom(false);setPan({x:0,y:0});lastTap.current=0;},[picture?.url]);
 useEffect(()=>{if(!open||!stage)return;const observer=new ResizeObserver(()=>{setViewport({w:stage.clientWidth,h:stage.clientHeight});setPan({x:0,y:0});});observer.observe(stage);return()=>observer.disconnect();},[open,stage]);
 const canZoom=natural.w>viewport.w||natural.h>viewport.h;
 function toggleZoom(){if(!canZoom)return;setZoom(value=>!value);setPan({x:0,y:0});}
 function change(delta:number){setIndex(value=>Math.max(0,Math.min(pictures.length-1,value+delta)));setZoom(false);setPan({x:0,y:0});lastTap.current=0;}
 useEffect(()=>{if(!open)return;const key=(event:KeyboardEvent)=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();change(event.key==='ArrowLeft'?-1:1);}else if(event.key==='0'){event.preventDefault();setZoom(false);setPan({x:0,y:0});}else if(event.key==='1'){event.preventDefault();if(canZoom){setZoom(true);setPan({x:0,y:0});}}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[open,canZoom,pictures.length]);
 function down(event:PointerEvent<HTMLDivElement>){pointerKind.current=event.pointerType;if(!event.isPrimary||event.button!==0){gesture.current=null;return;}gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,px:pan.x,py:pan.y,moved:false};event.currentTarget.setPointerCapture(event.pointerId);}
 function move(event:PointerEvent<HTMLDivElement>){const g=gesture.current;if(!g||g.id!==event.pointerId)return;const dx=event.clientX-g.x,dy=event.clientY-g.y;if(Math.hypot(dx,dy)>8){g.moved=true;suppress.current=Date.now()+500;}if(open&&zoom)setPan({x:boundPan(g.px+dx,natural.w,viewport.w),y:boundPan(g.py+dy,natural.h,viewport.h)});}
 function up(event:PointerEvent<HTMLDivElement>){const g=gesture.current;gesture.current=null;if(!g||g.id!==event.pointerId)return;const dx=event.clientX-g.x,dy=event.clientY-g.y;
  if(g.moved){suppress.current=Date.now()+500;if(!zoom){const direction=swipeDirection(dx,dy);if(direction)change(direction);}lastTap.current=0;}
  else if(open&&event.pointerType!=='mouse'){const now=Date.now();if(now-lastTap.current<300){toggleZoom();lastTap.current=0;}else lastTap.current=now;}
 }
 function cancel(){gesture.current=null;lastTap.current=0;suppress.current=Date.now()+500;}
 function activate(){if(Date.now()<suppress.current)return;setOpen(true);}
 if(!picture)return <div className="rec-no-product-image">{t('gallery.pending')}</div>;
 const fit=natural.w&&viewport.w?Math.min(1,viewport.w/natural.w,viewport.h/natural.h):0;
 return <div className="rec-detail-gallery">
  <div ref={opener} className="rec-gallery-inline" role="button" tabIndex={0} aria-label={t('gallery.fullscreen')}
   onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel}
   onClick={activate} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();change(e.key==='ArrowLeft'?-1:1);}}}>
   <img src={picture.url} alt={picture.label||name} draggable={false}/>
  </div>
  <div className="rec-gallery-navigation"><button type="button" disabled={index===0} onClick={()=>change(-1)} aria-label={t('gallery.previous')}>‹</button><span aria-live="polite">{index+1} / {pictures.length}</span><button type="button" disabled={index===pictures.length-1} onClick={()=>change(1)} aria-label={t('gallery.next')}>›</button></div>
  <div className="rec-detail-thumbs">{pictures.map((p,i)=><button type="button" key={p.id} aria-label={t('gallery.view',{number:i+1})} aria-pressed={i===index} onClick={()=>setIndex(i)}><img src={p.url} alt={p.label||name} draggable={false}/></button>)}</div>
  <Modal open={open} onCancel={()=>{setOpen(false);setZoom(false);}} afterClose={()=>opener.current?.focus()} footer={null} title={t('gallery.fullscreen')} rootClassName="rec-gallery-fullscreen" width="100vw" centered destroyOnClose>
   <div className="rec-gallery-tools"><button type="button" disabled={index===0} onClick={()=>change(-1)} aria-label={t('gallery.previous')}>‹</button><span aria-live="polite">{index+1} / {pictures.length}</span><button type="button" disabled={index===pictures.length-1} onClick={()=>change(1)} aria-label={t('gallery.next')}>›</button><button type="button" disabled={!canZoom} aria-pressed={zoom} onClick={toggleZoom}>{zoom?t('gallery.fit'):t('gallery.native')}</button></div>
   <div ref={setStage} className="rec-gallery-stage" data-zoom={zoom} role="group" aria-label={name} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onDoubleClick={e=>{if(e.detail===2&&pointerKind.current==='mouse')toggleZoom();}}>
    <img key={picture.url} src={picture.url} alt={picture.label||name} draggable={false} onLoad={e=>setNatural({w:e.currentTarget.naturalWidth,h:e.currentTarget.naturalHeight})} style={{width:natural.w?(zoom?natural.w:natural.w*fit):undefined,height:natural.h?(zoom?natural.h:natural.h*fit):undefined,visibility:fit?'visible':'hidden',transform:`translate(calc(-50% + ${pan.x}px),calc(-50% + ${pan.y}px))`}}/>
   </div><p className="rec-gallery-hint">{t(zoom?'gallery.pan_hint':'gallery.swipe_hint')}</p>
  </Modal>
 </div>;
}
