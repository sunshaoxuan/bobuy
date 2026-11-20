import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';

/** Keep the expanded flow slot: collapsing the surface never moves product content. */
export default function CatalogDock({heading,children,hasNavigation}:{heading:ReactNode;children:ReactNode;hasNavigation:boolean}){
 const anchor=useRef<HTMLDivElement>(null),dock=useRef<HTMLDivElement>(null),[top,setTop]=useState(0),[compact,setCompact]=useState(false);
 const lastCompact=useRef(false);
 const pendingSelection=useRef<{track:HTMLElement;active:HTMLElement;compact:boolean}|null>(null);
 const manualGesture=useRef<{x:number;y:number;horizontal:boolean}|null>(null),cancelProtection=useRef<()=>void>(()=>{});
 useLayoutEffect(()=>{
  const header=anchor.current?.closest('.storefront')?.querySelector<HTMLElement>('.store-header');
  let frame=0;
  const measure=()=>{
   frame=0;
   const height=header?.getBoundingClientRect().height??0;
   setTop(height);
   const next=(anchor.current?.getBoundingClientRect().top??height)<height-16;
   if(next===lastCompact.current)return;
   pendingSelection.current=null;
   // Preserve only an already-visible selection across the mobile width change.
   // An item deliberately scrolled out of view must not pull the track back.
   if(!manualGesture.current?.horizontal&&window.matchMedia('(max-width: 767px)').matches){
    const track=dock.current?.querySelector<HTMLElement>('.category-shortcuts-track');
    const active=track?.querySelector<HTMLElement>('[aria-current]');
    if(track&&active){
     const viewport=track.getBoundingClientRect(),item=active.getBoundingClientRect();
     if(item.left>=viewport.left-0.5&&item.right<=viewport.right+0.5)pendingSelection.current={track,active,compact:next};
    }
   }
   lastCompact.current=next;
   setCompact(next);
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
  const observer=new ResizeObserver(schedule);if(header)observer.observe(header);
  const release=()=>{manualGesture.current=null;};
  window.addEventListener('pointerup',release);window.addEventListener('pointercancel',release);
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);measure();
  return()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);window.removeEventListener('pointerup',release);window.removeEventListener('pointercancel',release);};
 },[]);
 useLayoutEffect(()=>{
  const selection=pendingSelection.current;
  if(!selection||selection.compact!==compact)return;
  pendingSelection.current=null;
  const {track,active}=selection;
  let frame=0,stopped=false;
  const cancel=()=>{stopped=true;cancelAnimationFrame(frame);};
  cancelProtection.current=cancel;
  const keepVisible=()=>{
   if(stopped||!track.contains(active)||!window.matchMedia('(max-width: 767px)').matches)return;
   const viewport=track.getBoundingClientRect(),item=active.getBoundingClientRect();
   if(item.left<viewport.left-0.5)track.scrollLeft+=item.left-viewport.left-4;
   else if(item.right>viewport.right+0.5)track.scrollLeft+=item.right-viewport.right+4;
   // Only the horizontal layout transitions need continued protection.
   const animations=[...(track.getAnimations?.()??[]),...(active.parentElement?.getAnimations?.()??[])];
   if(animations.some(animation=>animation.playState==='running'))frame=requestAnimationFrame(keepVisible);
  };
  keepVisible();
  return cancel;
 },[compact]);
 return <><div ref={anchor} className="catalog-dock-anchor" aria-hidden="true"/><div ref={dock} onPointerDownCapture={event=>{if(event.target instanceof Element&&event.target.closest('.category-shortcuts-track')){manualGesture.current={x:event.clientX,y:event.clientY,horizontal:false};}}} onPointerMoveCapture={event=>{const gesture=manualGesture.current;if(gesture&&Math.abs(event.clientX-gesture.x)>6&&Math.abs(event.clientX-gesture.x)>Math.abs(event.clientY-gesture.y)){gesture.horizontal=true;cancelProtection.current();}}} onWheelCapture={event=>{if(Math.abs(event.deltaX)>Math.abs(event.deltaY))cancelProtection.current();}} onKeyDownCapture={()=>cancelProtection.current()} className="catalog-dock" data-compact={compact} data-navigation={hasNavigation} style={{top}}>
  <div className="catalog-dock-surface">{heading}{children}</div>
 </div></>;
}
