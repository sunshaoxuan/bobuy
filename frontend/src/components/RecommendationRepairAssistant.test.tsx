import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {beforeEach,expect,it,vi} from 'vitest';
import {I18nProvider} from '../i18n';
import RecommendationRepairAssistant from './RecommendationRepairAssistant';
const api=vi.hoisted(()=>({sourceRepairPreview:vi.fn(),sourceRepairApply:vi.fn(),localeRepairPreview:vi.fn(),localeRepairApply:vi.fn()}));
vi.mock('../api',()=>({recommendationApi:api}));
const source=(count=20)=>({postId:12,version:4,items:Array.from({length:count},(_,i)=>({itemId:i+1,productId:'p'+i,productVersion:2,itemVersion:4,fields:[
 {field:'supplierKey',currentValue:null,suggestedValue:'costco-jp',evidence:'product master'},
 {field:'channel',currentValue:'COSTCO_WAREHOUSE',suggestedValue:null},
 {field:'sourceUrl',currentValue:null,suggestedValue:null,unresolvedReason:'not uniquely derivable'}]}))});
function show(mode:'source'|'locale'='source',postId=12){const onClose=vi.fn(),onApplied=vi.fn();render(<I18nProvider><RecommendationRepairAssistant postId={postId} mode={mode} open onClose={onClose} onApplied={onApplied}/></I18nProvider>);return {onClose,onApplied};}
beforeEach(()=>{vi.resetAllMocks();localStorage.setItem('bobbuy_locale','en-US');});
it('issue12 batch preview writes only on confirmation and submits exactly the reviewed snapshot',async()=>{
 const preview=source();api.sourceRepairPreview.mockResolvedValue(preview);api.sourceRepairApply.mockResolvedValue(preview);const callbacks=show();
 await screen.findByText('#20');expect(api.sourceRepairApply).not.toHaveBeenCalled();expect(screen.getAllByText('not uniquely derivable')).toHaveLength(20);
 fireEvent.click(screen.getByRole('button',{name:'Confirm and save'}));await waitFor(()=>expect(callbacks.onApplied).toHaveBeenCalledTimes(1));expect(api.sourceRepairApply).toHaveBeenCalledWith(12,preview,false);expect(callbacks.onClose).toHaveBeenCalledTimes(1);
});
it('canceling a batch preview does not write',async()=>{
 api.sourceRepairPreview.mockResolvedValue(source());const {onClose,onApplied}=show();await screen.findByText('#20');fireEvent.click(screen.getByRole('button',{name:'Cancel edit'}));expect(onClose).toHaveBeenCalled();expect(onApplied).not.toHaveBeenCalled();expect(api.sourceRepairApply).not.toHaveBeenCalled();
});
it('issue11 supplier-only fill retains existing context and blank-only default',async()=>{
 const preview={...source(1),postId:11};api.sourceRepairPreview.mockResolvedValue(preview);api.sourceRepairApply.mockResolvedValue(preview);show('source',11);await screen.findByText('costco-jp');expect(screen.getByText('COSTCO_WAREHOUSE')).toBeInTheDocument();expect(screen.getByRole('checkbox',{name:'Overwrite existing values'})).not.toBeChecked();
 fireEvent.click(screen.getByRole('button',{name:'Confirm and save'}));await waitFor(()=>expect(api.sourceRepairApply).toHaveBeenCalledWith(11,preview,false));
});
it('AI suggestions remain labeled and editable and only confirmed edits are saved',async()=>{
 api.localeRepairPreview.mockResolvedValue({postId:12,version:4,suggestions:[{productId:'p',productVersion:2,field:'name',locale:'en-US',suggestion:'AI tea',aiSuggested:true}]});api.localeRepairApply.mockResolvedValue(null);show('locale');
 const input=await screen.findByRole('textbox',{name:'p name en-US'});expect(screen.getByText('AI suggestion')).toBeInTheDocument();expect(api.localeRepairApply).not.toHaveBeenCalled();fireEvent.change(input,{target:{value:'Reviewed tea'}});expect(screen.getByText('AI suggestion')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Confirm and save'}));
 await waitFor(()=>expect(api.localeRepairApply).toHaveBeenCalledWith(12,4,[{productId:'p',productVersion:2,field:'name',locale:'en-US',value:'Reviewed tea'}]));
});
it('AI failure leaves a blank field and cannot save generated content',async()=>{
 api.localeRepairPreview.mockResolvedValue({postId:12,version:4,suggestions:[{productId:'p',productVersion:2,field:'name',locale:'en-US',suggestion:null,error:'AI translation unavailable',aiSuggested:false}]});show('locale');await screen.findByText('AI translation unavailable');expect(screen.queryByRole('textbox')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'Confirm and save'}));await screen.findByText('No valid suggestions to save');expect(api.localeRepairApply).not.toHaveBeenCalled();
});
it('a rejected stale confirmation keeps the preview open and reports failure',async()=>{
 api.sourceRepairPreview.mockResolvedValue(source(1));api.sourceRepairApply.mockRejectedValue(new Error('Preview changed'));const callbacks=show();await screen.findByText('#1');fireEvent.click(screen.getByRole('button',{name:'Confirm and save'}));await screen.findByText('Preview changed');expect(callbacks.onApplied).not.toHaveBeenCalled();expect(callbacks.onClose).not.toHaveBeenCalled();
});
