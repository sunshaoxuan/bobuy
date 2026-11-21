import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {describe,it,expect,vi} from 'vitest';
import CatalogFileTransfer from './CatalogFileTransfer';
vi.mock('../i18n',()=>({useI18n:()=>({t:(k:string)=>k})}));
const get=vi.fn();vi.mock('../api',()=>({productCatalogApi:{get:(...args:unknown[])=>get(...args)}}));
describe('catalog file transfer',()=>{
 it('loads valid identities into preview without a save, and rejects duplicate identities',async()=>{
 const onLoad=vi.fn();const {container}=render(<CatalogFileTransfer ids={[]} disabled={false} onLoad={onLoad}/>);
 const input=container.querySelector('input[type=file]')!;
 const file=(text:string)=>{const f=new File([text],'records.json',{type:'application/json'});Object.defineProperty(f,'text',{value:async()=>text});return f;};
 fireEvent.change(input,{target:{files:[file('[{"productId":"one"},{"productId":"one"}]')]}});
 await screen.findByText('catalogTransfer.invalid');expect(onLoad).not.toHaveBeenCalled();
 fireEvent.change(container.querySelector('input[type=file]')!,{target:{files:[file('[{"productId":"one","version":2}]')]}});
 await waitFor(()=>expect(onLoad).toHaveBeenCalledWith('[{"productId":"one","version":2}]'));expect(get).not.toHaveBeenCalled();
 });
 it('asks for the whole archive at export time and rejects overflow without reading the current page',async()=>{
  const select=vi.fn().mockResolvedValue({ids:[],limitExceeded:true});
  render(<CatalogFileTransfer ids={['visible-product']} getExportIds={select} disabled={false} onLoad={vi.fn()}/>);
  expect(select).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'catalogTransfer.export'}));
  await screen.findByText('products.archive_export_limit');
  expect(select).toHaveBeenCalledOnce();
  expect(get).not.toHaveBeenCalled();
 });
});
