import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {beforeEach,describe,it,expect,vi} from 'vitest';
import {I18nProvider} from '../i18n';import {recommendationApi,type RecommendationDetail} from '../api';import ArticleLanguages from './ArticleLanguages';
vi.mock('../api',()=>({recommendationApi:{articleLanguage:vi.fn(),articleHistory:vi.fn()}}));
const detail:RecommendationDetail={post:{id:1,title:'Original',published:false,version:1,updatedAt:''},body:'Source',items:[],articleSourceLocale:'ja-JP',articleSourceHash:'hash',articleTranslations:{}};
beforeEach(()=>{vi.clearAllMocks();localStorage.setItem('bobbuy_locale','en-US');});
describe('ordinary article language editing',()=>{
 it('keeps drafts between tabs and sends only explicitly reviewed language',async()=>{
  const saved=vi.fn();vi.mocked(recommendationApi.articleLanguage).mockResolvedValue({...detail,post:{...detail.post,version:2},articleTranslations:{'zh-CN':{title:'Chinese',body:'Chinese body',sourceHash:'hash',reviewedAt:''}}});
  render(<I18nProvider><ArticleLanguages detail={detail} title="Original" body="Source" sourceDirty={false} disabled={false} onTitle={vi.fn()} onBody={vi.fn()} onChanged={saved} onPending={vi.fn()}/></I18nProvider>);
  fireEvent.click(screen.getByRole('tab',{name:'zh-CN'}));fireEvent.change(screen.getByLabelText('Title'),{target:{value:'Chinese'}});fireEvent.change(screen.getByLabelText('Body'),{target:{value:'Chinese body'}});
  fireEvent.click(screen.getByRole('tab',{name:'zh-TW'}));fireEvent.change(screen.getByLabelText('Title'),{target:{value:'Traditional draft'}});fireEvent.click(screen.getByRole('tab',{name:'zh-CN *'}));expect(screen.getByLabelText('Body')).toHaveValue('Chinese body');
  expect(screen.getByRole('button',{name:'Save this translation'})).toBeDisabled();fireEvent.click(screen.getByRole('checkbox',{name:'I checked this translation against the current source'}));fireEvent.click(screen.getByRole('button',{name:'Save this translation'}));await waitFor(()=>expect(saved).toHaveBeenCalled());
  expect(recommendationApi.articleLanguage).toHaveBeenCalledWith(1,{locale:'zh-CN',title:'Chinese',body:'Chinese body',sourceHash:'hash',version:1,reviewed:true});fireEvent.click(screen.getByRole('tab',{name:'zh-TW *'}));expect(screen.getByLabelText('Title')).toHaveValue('Traditional draft');
 });
 it('blocks translation until a dirty or unknown source is settled without inventing text',()=>{
  render(<I18nProvider><ArticleLanguages detail={{...detail,articleSourceLocale:null}} title="Mixed legacy" body="Retained" sourceDirty={false} disabled={false} onTitle={vi.fn()} onBody={vi.fn()} onChanged={vi.fn()} onPending={vi.fn()}/></I18nProvider>);
  expect(screen.getByText(/Legacy source language is unconfirmed/)).toBeVisible();fireEvent.click(screen.getByRole('tab',{name:'zh-CN'}));expect(screen.getByLabelText('Body')).toBeDisabled();expect(screen.getByLabelText('Body')).toHaveValue('');
 });
});
