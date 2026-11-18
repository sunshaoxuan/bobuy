import {useState} from 'react';
/** Decorative category art keeps its reserved space when an asset is absent or fails. */
export default function CategoryImage({src,className}:{src?:string|null;className:string}){
 const [failed,setFailed]=useState<string>();
 return src?.startsWith('/api/storefront/recommendation-images/')&&src!==failed
  ?<img className={className} src={src} alt="" onError={()=>setFailed(src)}/>
  :<span className={className} aria-hidden="true"/>;
}
