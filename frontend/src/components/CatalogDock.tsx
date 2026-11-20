import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';

/** Keep the expanded flow slot: collapsing the surface never moves product content. */
export default function CatalogDock({heading,children,hasNavigation}:{heading:ReactNode;children:ReactNode;hasNavigation:boolean}){
 const anchor=useRef<HTMLDivElement>(null),[top,setTop]=useState(0),[compact,setCompact]=useState(false);
 useLayoutEffect(()=>{
  const header=anchor.current?.closest('.storefront')?.querySelector<HTMLElement>('.store-header');
  let frame=0;
  const measure=()=>{frame=0;const height=header?.getBoundingClientRect().height??0;setTop(height);setCompact((anchor.current?.getBoundingClientRect().top??height)<height-16);};
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(measure);};
  const observer=new ResizeObserver(schedule);if(header)observer.observe(header);
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);measure();
  return()=>{observer.disconnect();cancelAnimationFrame(frame);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);};
 },[]);
 return <><div ref={anchor} className="catalog-dock-anchor" aria-hidden="true"/><div className="catalog-dock" data-compact={compact} data-navigation={hasNavigation} style={{top}}>
  <div className="catalog-dock-surface">{heading}{children}</div>
 </div></>;
}
