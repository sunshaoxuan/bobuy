import { useEffect,useState,type ImgHTMLAttributes } from 'react';
import { api } from '../api';
/** Private receipts use bearer-authenticated bytes and revocable browser blob URLs. */
export default function StoredImage({src,...props}:ImgHTMLAttributes<HTMLImageElement>){
 const [resolved,setResolved]=useState<string>();
 const privateSource=typeof src==='string' && src.startsWith('/api/merchant/media/');
 useEffect(()=>{
  if(!privateSource)return;
  let active=true,url:string|undefined;setResolved(undefined);
  void api.privateMedia(src!).then(blob=>{if(active){url=URL.createObjectURL(blob);setResolved(url);}}).catch(()=>{if(active)setResolved(undefined);});
  return ()=>{active=false;if(url)URL.revokeObjectURL(url);};
 },[src,privateSource]);
 return <img {...props} src={privateSource?resolved:src} />;
}
