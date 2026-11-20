import {useState} from 'react';
/** Decorative category art keeps its reserved space when an asset is absent or fails. */
export default function CategoryImage({src,className,priority}:{src?:string|null;className:string;priority?:boolean}){
 const [failed,setFailed]=useState<string>();
 return src?.startsWith('/api/storefront/recommendation-images/')&&src!==failed
  ?<img className={className} src={src} alt="" loading={priority===undefined?undefined:priority?'eager':'lazy'} {...{fetchpriority:priority===undefined?undefined:priority?'high':'low'}} onError={()=>setFailed(src)}/>
  :<span className={className} aria-hidden="true"/>;
}
