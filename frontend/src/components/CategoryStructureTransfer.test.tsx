import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import CategoryStructureTransfer from './CategoryStructureTransfer';
const api=vi.hoisted(()=>({post:vi.fn(),download:vi.fn()}));
vi.mock('../api',()=>({authenticatedFormPost:api.post,authenticatedDownload:api.download}));
const preview={revision:'revision',fileHash:'hash',valid:true,rows:[{row:2,id:'a',parentId:null,name:{'ja-JP':'Example'},sortOrder:0,imageUrl:null,action:'CREATE',errors:[]}]};
beforeEach(()=>{vi.clearAllMocks();localStorage.setItem('bobbuy_locale','en-US');});
it.each([true,false])('validates and confirms only valid previews: %s',async valid=>{
 api.post.mockResolvedValue({...preview,valid,rows:[{...preview.rows[0],errors:valid?[]:['Duplicate ID']}]});const saved=vi.fn().mockResolvedValue(undefined);const {container}=render(<I18nProvider><CategoryStructureTransfer onSaved={saved}/></I18nProvider>);
 fireEvent.click(screen.getByRole('button',{name:'Export current categories'}));await waitFor(()=>expect(api.download).toHaveBeenCalled());
 fireEvent.change(container.querySelector('input[type=file]')!,{target:{files:[new File(['fixture'],'tree.csv',{type:'text/csv'})]}});
 await waitFor(()=>expect(screen.getByRole('button',{name:'Preview import'})).toBeEnabled());fireEvent.click(screen.getByRole('button',{name:'Preview import'}));await screen.findByText('Example');
 expect(screen.getByRole('button',{name:'Confirm import'})).toBeDisabled();fireEvent.click(screen.getByRole('checkbox'));
 if(valid){fireEvent.click(screen.getByRole('button',{name:'Confirm import'}));await waitFor(()=>expect(saved).toHaveBeenCalledOnce());expect(api.post.mock.calls[1][1].get('revision')).toBe('revision');expect(api.post.mock.calls[1][1].get('confirmed')).toBe('true');}
 else {expect(screen.getByText('Duplicate ID')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Confirm import'})).toBeDisabled();expect(saved).not.toHaveBeenCalled();}
});
