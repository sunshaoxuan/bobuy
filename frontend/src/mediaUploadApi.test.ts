import {afterEach,expect,it,vi} from 'vitest';
import {api,productCatalogApi} from './api';
afterEach(()=>{vi.unstubAllGlobals();});
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
 await expect(productCatalogApi.upload('fixture',file,'https://example.invalid/product','Synthetic')).rejects.toThrow('gallery.invalid');
 expect(fetch).not.toHaveBeenCalled();
});
