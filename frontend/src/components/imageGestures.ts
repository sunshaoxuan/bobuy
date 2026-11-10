export const boundPan=(value:number,image:number,viewport:number)=>Math.max(-Math.max(0,(image-viewport)/2),Math.min(Math.max(0,(image-viewport)/2),value))||0;
export const swipeDirection=(dx:number,dy:number)=>Math.abs(dx)>=45&&Math.abs(dx)>Math.abs(dy)*1.35?(dx<0?1:-1):0;
export const dragOffset=(dx:number,width:number,atStart:boolean,atEnd:boolean)=>Math.max(-width,Math.min(width,dx*((dx>0&&atStart)||(dx<0&&atEnd)?.25:1)));
