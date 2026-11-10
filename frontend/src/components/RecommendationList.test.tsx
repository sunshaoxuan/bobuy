import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { I18nProvider, translate, type Locale } from '../i18n';
import RecommendationList from './RecommendationList';
import type { RecommendationSummary } from '../api';

const published: RecommendationSummary = { id:6, title:'Costco-JP 新品（2026/11/3）', published:true, version:1, updatedAt:'2026-11-05T10:00:00Z', publishedAt:'2026-11-05T10:00:00Z', publisherName:'Bobuy Operator', coverImageUrl:'/verified-cover.png' };
beforeEach(()=>localStorage.clear());
function Location(){return <output aria-label="Location">{useLocation().search}</output>;}
function show(posts:RecommendationSummary[],hasError=false){
  return render(<I18nProvider><MemoryRouter><Routes><Route path="/" element={<><RecommendationList posts={posts} hasError={hasError} /><Location /></>} /></Routes></MemoryRouter></I18nProvider>);
}
it('keeps a single keyboard link per issue with full title, status, cover and publication metadata', async()=>{
  show([published,{...published,id:7,title:'Long title '.repeat(30),published:false,publishedAt:undefined,publisherName:undefined,coverImageUrl:undefined}]);
  const links=screen.getAllByRole('link');
  expect(links).toHaveLength(2);
  expect(links[0]).toHaveAttribute('href','/?post=6');
  expect(links[0]).toHaveAccessibleName(published.title);
  expect(links[0]).toHaveAccessibleDescription(translate('zh-CN','rec.published')+' '+translate('zh-CN','rec.edit_article'));
  expect(screen.getByText('Bobuy Operator')).toBeInTheDocument();
  expect(screen.getByRole('heading',{name:'Long title '.repeat(30).trim()})).toBeInTheDocument();
  expect(links[0].querySelectorAll('time')).toHaveLength(2);
  expect(links[1].querySelectorAll('time')).toHaveLength(1);
  expect(links[0].querySelector('img')).toHaveAttribute('alt','');
  const user=userEvent.setup();
  await user.tab(); expect(links[0]).toHaveFocus();
  await user.tab(); expect(links[1]).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(screen.getByLabelText('Location')).toHaveTextContent('?post=7');
});
it('falls back after a broken image and retries a changed cover URL',()=>{
  const view=show([published]);
  fireEvent.error(view.container.querySelector('img')!);
  expect(view.container.querySelector('img')).toBeNull();
  expect(view.container.querySelector('.rec-collection-placeholder')).toBeInTheDocument();
  view.rerender(<I18nProvider><MemoryRouter><RecommendationList posts={[{...published,coverImageUrl:'/new-cover.png'}]} /></MemoryRouter></I18nProvider>);
  expect(view.container.querySelector('img')).toHaveAttribute('src','/new-cover.png');
});
it('shows an untitled draft and empty state, and avoids a misleading empty state on load failure',()=>{
  const view=show([{...published,title:'',published:false,publishedAt:undefined,publisherName:undefined}]);
  expect(screen.getByRole('heading')).not.toHaveTextContent(published.title);
  view.unmount();
  const empty=show([]); expect(empty.container.querySelector('.ant-empty')).toBeInTheDocument();
  empty.unmount();
  const error=show([],true); expect(error.container.querySelector('.ant-empty')).toBeNull();
});
it.each<Locale>(['zh-CN','zh-TW','ja-JP','en-US'])('localizes management metadata and action descriptions in %s',locale=>{
  localStorage.setItem('bobbuy_locale',locale);
  const view=show([published]);
  expect(screen.getByText(translate(locale,'rec.updated_date'))).toBeInTheDocument();
  expect(screen.getByText(translate(locale,'rec.edit_article'))).toBeInTheDocument();
  expect(screen.getByRole('link')).toHaveAccessibleDescription(translate(locale,'rec.published')+' '+translate(locale,'rec.edit_article'));
  expect(view.container.textContent).not.toMatch(/rec\.(updated_date|edit_article)/);
  expect(view.container.querySelector('time')).toHaveTextContent(new Date(published.updatedAt).toLocaleString(locale,{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}));
});
