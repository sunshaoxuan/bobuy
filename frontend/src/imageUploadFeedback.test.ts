import {afterEach,expect,it,vi} from 'vitest';
import {copyFileList,imageUploadSha256,validCatalogImageSource} from './imageUpload';
const {webcrypto}=await vi.importActual<{webcrypto:Crypto}>('node:crypto');
afterEach(()=>{vi.unstubAllGlobals();});
it('snapshots a live FileList before clearing the input',()=>{const file=new File(['x'],'x.png');const live={0:file,length:1,[Symbol.iterator]:function*(){if(this.length)yield this[0];}};const copied=copyFileList(live as unknown as FileList);live.length=0;expect(copied).toEqual([file]);expect(copyFileList(null)).toEqual([]);});
it('accepts source shape only without silently stripping meaningful queries',()=>{expect(validCatalogImageSource('https://official.example/product')).toBe(true);for(const value of ['https://official.example/product?variant=2','https://official.example/product#detail','http://official.example/p','https://user:pass@official.example/p',' https://official.example/p','not-url'])expect(validCatalogImageSource(value)).toBe(false);});
it('hashes exact prepared bytes and refuses unavailable verification without uploading',async()=>{vi.stubGlobal('crypto',{subtle:webcrypto.subtle});const file=new File(['abc'],'a.png');Object.defineProperty(file,'arrayBuffer',{value:async()=>new TextEncoder().encode('abc').buffer});await expect(imageUploadSha256(file)).resolves.toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');vi.stubGlobal('crypto',{});await expect(imageUploadSha256(file)).rejects.toThrow('gallery.hash_unavailable');});
it('rejects sources whose normalized URL cannot pass the existing master save rule',()=>{
 expect(validCatalogImageSource('https://official.example/'+ 'あ'.repeat(700))).toBe(false);
});
