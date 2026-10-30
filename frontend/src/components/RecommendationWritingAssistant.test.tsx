import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {describe,it,expect,vi,beforeEach} from 'vitest';
import {I18nProvider} from '../i18n';
import RecommendationWritingAssistant from './RecommendationWritingAssistant';
import type {RecommendationDetail} from '../api';
const assist=vi.fn();vi.mock('../api',()=>({api:{recommendationWriting:(input:unknown)=>assist(input)}}));
const detail={post:{id:4,title:'Draft',version:1,published:false,updatedAt:''},body:'original',items:[]} as RecommendationDetail;
function mount(){const apply=vi.fn();render(<I18nProvider><RecommendationWritingAssistant detail={detail} onApply={apply} onPendingChange={()=>{}}/></I18nProvider>);return apply;}
describe('writing confirmation flow',()=>{
 beforeEach(()=>{assist.mockReset();localStorage.setItem('bobbuy_locale','en-US');});
 it('requires three deliberate stages and applies without saving',async()=>{
  assist.mockResolvedValueOnce({text:'Audience and tone'}).mockResolvedValueOnce({text:'Editable writing prompt'}).mockResolvedValueOnce({text:'Draft article'});
  const apply=mount();fireEvent.change(screen.getByLabelText('What would you like to recommend?'),{target:{value:'Weekend groceries'}});fireEvent.click(screen.getByText('Clarify my idea'));
  await screen.findByDisplayValue('Audience and tone');expect(screen.getByRole('button',{name:'Help write the prompt'})).toBeDisabled();
  fireEvent.click(screen.getByText('I confirm this brief'));fireEvent.click(screen.getByText('Help write the prompt'));await screen.findByDisplayValue('Editable writing prompt');
  expect(screen.getByRole('button',{name:'Generate article'})).toBeDisabled();fireEvent.click(screen.getByText('I confirm this writing prompt'));fireEvent.click(screen.getByText('Generate article'));await screen.findByDisplayValue('Draft article');
  expect(apply).not.toHaveBeenCalled();fireEvent.click(screen.getByText('Use in editor (not saved)'));expect(apply).toHaveBeenCalledWith('Draft article');expect(assist.mock.calls.map(c=>c[0].step)).toEqual(['intent','prompt','draft']);
 });
 it('preserves input and ignores a cancelled late response',async()=>{
  let done:(value:unknown)=>void=()=>{};assist.mockReturnValue(new Promise(resolve=>{done=resolve;}));mount();fireEvent.change(screen.getByLabelText('What would you like to recommend?'),{target:{value:'Keep this idea'}});fireEvent.click(screen.getByText('Clarify my idea'));fireEvent.click(screen.getByText('Cancel'));done({text:'Late result'});
  await waitFor(()=>expect(screen.queryByDisplayValue('Late result')).not.toBeInTheDocument());expect(screen.getByDisplayValue('Keep this idea')).toBeInTheDocument();
 });
 it('shows real failure and allows retry without fake output',async()=>{
  assist.mockRejectedValue(new Error('Service unavailable'));mount();fireEvent.change(screen.getByLabelText('What would you like to recommend?'),{target:{value:'Idea'}});fireEvent.click(screen.getByText('Clarify my idea'));await screen.findByText('Service unavailable');expect(screen.queryByLabelText('Editable brief')).not.toBeInTheDocument();expect(screen.getByDisplayValue('Idea')).toBeInTheDocument();
 });
});
