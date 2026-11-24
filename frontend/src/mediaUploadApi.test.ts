import {afterEach,expect,it,vi} from 'vitest';
import {api,productCatalogApi} from './api';
import {imageUploadSha256} from './imageUpload';
const {webcrypto}=await vi.importActual<{webcrypto:Crypto}>('node:crypto');
afterEach(()=>{vi.unstubAllGlobals();});
const read=(blob:Blob)=>new Promise<ArrayBuffer>((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>resolve(reader.result as ArrayBuffer);reader.readAsArrayBuffer(blob);});
const fixture=(bytes:Uint8Array,name:string,type:string)=>{const value=new File([bytes],name,{type,lastModified:123});Object.defineProperty(value,'slice',{value:()=>({arrayBuffer:async()=>bytes.buffer})});return value;};
const base64=(value:string)=>Uint8Array.from(atob(value),character=>character.charCodeAt(0));
it('serializes UI media enums using the backend contract without dropping source metadata',async()=>{
 const fetch=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({data:{}})});vi.stubGlobal('fetch',fetch);
 const media={url:'/synthetic.png',type:'image',sourceUrl:'https://example.invalid/product',visible:false};
 await api.onboardConfirm({name:'Synthetic',mediaGallery:[media,{url:'/synthetic.mp4',type:'video'}]});
 const body=JSON.parse(fetch.mock.calls[0][1].body);
 expect(body.mediaGallery).toEqual([{...media,type:'IMAGE'},{url:'/synthetic.mp4',type:'VIDEO'}]);expect(media.type).toBe('image');
});
it('does not issue an upload request for forged or invalid image bytes',async()=>{
 const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
 const file=new File(['not an image'],'forged.webp',{type:'image/webp'});
 // jsdom has no Blob.arrayBuffer; use the same browser byte API explicitly.
 Object.defineProperty(file,'slice',{value:()=>({arrayBuffer:async()=>new TextEncoder().encode('not an image').buffer})});
 await expect(productCatalogApi.upload('fixture',file,'https://example.invalid/product','Synthetic')).rejects.toThrow('gallery.file_format');
 expect(fetch).not.toHaveBeenCalled();
});
it.each([
 ['JPEG',base64('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABAf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k='),'official.webp','image/webp','official.jpg','image/jpeg'],
 ['PNG',base64('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xw4AAAAASUVORK5CYII='),'official.jpg','image/jpeg','official.png','image/png']
])('submits signature-recognized %s bytes with normalized catalog metadata',async(_format,bytes,name,type,submittedName,submittedType)=>{
 vi.stubGlobal('crypto',{subtle:webcrypto.subtle});
 const fetch=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({data:{url:'/synthetic'}})});vi.stubGlobal('fetch',fetch);
 const original=fixture(bytes,name,type);const originalHash=await imageUploadSha256(original);
 await productCatalogApi.upload('fixture',original,'https://example.invalid/product',name);
 const [url,request]=fetch.mock.calls[0];const body=request.body as FormData;const submitted=body.get('file') as File;
 expect(url).toBe('/api/merchant/product-catalog/fixture/images');
 expect(submitted).toMatchObject({name:submittedName,type:submittedType});
 expect(await webcrypto.subtle.digest('SHA-256',await read(submitted)).then(value=>Array.from(new Uint8Array(value),byte=>byte.toString(16).padStart(2,'0')).join(''))).toBe(originalHash);
 expect(body.get('label')).toBe(name);expect(original).toMatchObject({name,type});
});
