import {useEffect,useRef,useState,type PointerEvent} from 'react';
import type {RecommendationPicture} from '../api';
import {useI18n} from '../i18n';
import {ImageLightbox} from './ImageLightbox';
import {dragOffset,swipeDirection} from './imageGestures';
export {boundPan,dragOffset,swipeDirection} from './imageGestures';
import './recommendationImageViewer.css';

/** Inline fit swipes navigate. The shared fullscreen viewer owns native-size panning. */
export function RecommendationImageViewer({pictures,name}:{pictures:RecommendationPicture[];name:string}){
 const {t}=useI18n();const [index,setIndex]=useState(0),[open,setOpen]=useState(false);
 const opener=useRef<HTMLDivElement>(null),[motion,setMotion]=useState({offset:0,settling:false});
 const settlement=useRef<ReturnType<typeof setTimeout>|null>(null),suppress=useRef(0);
 const gesture=useRef<{id:number;x:number;y:number;width:number;axis:''|'x'|'y';moved:boolean}|null>(null);
 function resetMotion(){if(settlement.current!==null)clearTimeout(settlement.current);settlement.current=null;gesture.current=null;setMotion({offset:0,settling:false});}
 const picture=pictures[index];
 useEffect(()=>{resetMotion();setIndex(0);setOpen(false);},[pictures]);
 useEffect(()=>()=>{if(settlement.current!==null)clearTimeout(settlement.current);},[]);
 function change(next:number){resetMotion();setIndex(Math.max(0,Math.min(pictures.length-1,next)));}
 function settle(direction:number,width:number){
  const next=Math.max(0,Math.min(pictures.length-1,index+direction)),delta=next-index;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){change(next);return;}
  setMotion({offset:-delta*width,settling:true});settlement.current=setTimeout(()=>{settlement.current=null;setIndex(next);setMotion({offset:0,settling:false});},240);
 }
 function down(event:PointerEvent<HTMLDivElement>){if(motion.settling){suppress.current=Date.now()+500;return;}if(!event.isPrimary||event.button!==0){cancel();return;}gesture.current={id:event.pointerId,x:event.clientX,y:event.clientY,width:event.currentTarget.clientWidth,axis:'',moved:false};event.currentTarget.setPointerCapture(event.pointerId);}
 function move(event:PointerEvent<HTMLDivElement>){const g=gesture.current;if(!g||g.id!==event.pointerId)return;const dx=event.clientX-g.x,dy=event.clientY-g.y;if(Math.hypot(dx,dy)>8){g.moved=true;suppress.current=Date.now()+500;if(!g.axis)g.axis=Math.abs(dx)>Math.abs(dy)*1.35?'x':'y';}if(g.axis==='x'){if(event.cancelable)event.preventDefault();setMotion({offset:dragOffset(dx,g.width,index===0,index===pictures.length-1),settling:false});}}
 function up(event:PointerEvent<HTMLDivElement>){const g=gesture.current;if(!g||g.id!==event.pointerId)return;gesture.current=null;if(g.moved){suppress.current=Date.now()+500;if(g.axis==='x')settle(swipeDirection(event.clientX-g.x,event.clientY-g.y),g.width);}}
 function cancel(){const g=gesture.current;if(!g)return;gesture.current=null;if(g.axis==='x')settle(0,g.width);suppress.current=Date.now()+500;}
 function activate(){if(Date.now()>=suppress.current)setOpen(true);}
 if(!picture)return <div className="rec-no-product-image">{t('gallery.pending')}</div>;
 const rail=<div className="rec-gallery-rail" data-settling={motion.settling} style={{transform:`translateX(${motion.offset}px)`}}>{[-1,0,1].map(slot=>{const p=pictures[index+slot];return <div className="rec-gallery-slide" key={slot} style={{left:`${slot*100}%`}} aria-hidden={slot!==0}>{p&&<img src={p.url} alt={slot===0?(p.label||name):''} draggable={false}/>}</div>;})}</div>;
 return <div className="rec-detail-gallery">
  <div ref={opener} className="rec-gallery-inline" role="button" tabIndex={0} aria-label={t('gallery.fullscreen')} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel} onClick={activate} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();change(index+(e.key==='ArrowLeft'?-1:1));}}}>
   <img className="rec-gallery-sizer" src={picture.url} alt="" aria-hidden="true" draggable={false}/>{rail}
  </div>
  <div className="rec-gallery-navigation"><button type="button" disabled={index===0} onClick={()=>change(index-1)} aria-label={t('gallery.previous')}>‹</button><span aria-live="polite">{index+1} / {pictures.length}</span><button type="button" disabled={index===pictures.length-1} onClick={()=>change(index+1)} aria-label={t('gallery.next')}>›</button></div>
  <div className="rec-detail-thumbs">{pictures.map((p,i)=><button type="button" key={p.id} aria-label={t('gallery.view',{number:i+1})} aria-pressed={i===index} onClick={()=>change(i)}><img src={p.url} alt={p.label||name} draggable={false}/></button>)}</div>
  <ImageLightbox pictures={pictures} index={index} open={open} name={name} onIndexChange={change} onClose={()=>{resetMotion();setOpen(false);}} returnFocus={opener}/>
 </div>;
}
