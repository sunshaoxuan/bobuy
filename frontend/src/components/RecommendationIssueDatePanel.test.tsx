import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import Panel,{applyRecommendationIssueDate} from './RecommendationIssueDatePanel';
import {I18nProvider} from '../i18n';
import {clearAuthSession,storeAuthSession} from '../authStorage';
import type {RecommendationDetail} from '../api';
import type {RecommendationIssueDateReview as Review} from './RecommendationIssueDateEditor';
import en from '../locales/en-US';import ja from '../locales/ja-JP';import cn from '../locales/zh-CN';import tw from '../locales/zh-TW';
const mocks=vi.hoisted(()=>({getIssueDate:vi.fn(),saveIssueDate:vi.fn()}));vi.mock('../api',()=>({recommendationApi:mocks}));
const unknown=(version=3):Review=>({issueDate:null,sourceRef:null,sourceHash:null,reviewedBy:null,reviewedAt:null,source:'UNKNOWN',version});
const reviewed=(version=4):Review=>({issueDate:'2026-10-31',sourceRef:'message:private-source',sourceHash:'a'.repeat(64),reviewedBy:42,reviewedAt:'2026-11-09T14:00:00Z',source:'REVIEWED_SOURCE',version});
const post={id:8,merchantId:42,title:'Synthetic issue',published:true,version:3,updatedAt:'2026-11-01T00:00:00',publishedAt:'2026-11-01T00:00:00Z'};
const auth=(id=42,token='synthetic-token-a',roles:('AGENT'|'CUSTOMER')[]=['AGENT'])=>storeAuthSession({accessToken:token,user:{id,username:'synthetic-'+id,name:'Synthetic',roles}});
const tree=(props:Partial<Parameters<typeof Panel>[0]>={})=><I18nProvider><Panel post={post} onSaved={vi.fn()} {...props}/></I18nProvider>;
beforeEach(()=>{localStorage.clear();localStorage.setItem('bobbuy_locale','en-US');auth();mocks.getIssueDate.mockReset().mockResolvedValue(unknown());mocks.saveIssueDate.mockReset().mockResolvedValue(reviewed());});
it.each(['anonymous','customer','foreign merchant','missing owner'] as const)('hides the date entry and makes no private request for %s',kind=>{
 if(kind==='anonymous')clearAuthSession();if(kind==='customer')auth(42,'synthetic-token-a',['CUSTOMER']);if(kind==='foreign merchant')auth(99);render(tree(kind==='missing owner'?{post:{...post,merchantId:undefined}}:{}));expect(screen.queryByRole('button',{name:en['issueDate.title']})).not.toBeInTheDocument();expect(mocks.getIssueDate).not.toHaveBeenCalled();
});
it.each([['en-US',en],['ja-JP',ja],['zh-CN',cn],['zh-TW',tw]] as const)('uses complete real locale copy in the normal %s entry',async(locale,messages)=>{
 localStorage.setItem('bobbuy_locale',locale);render(tree());fireEvent.click(screen.getByRole('button',{name:messages['issueDate.title']}));await screen.findByLabelText(messages['issueDate.date']);expect(screen.getByRole('checkbox',{name:messages['issueDate.reviewed']})).not.toBeChecked();expect(screen.getByText(messages['issueDate.unknownHint'])).toBeVisible();expect(mocks.getIssueDate).toHaveBeenCalledWith(8,'synthetic-token-a');
});
it('does not elevate an old parent article baseline when the private GET is a newer version',async()=>{
 const changed=vi.fn();mocks.getIssueDate.mockResolvedValue(unknown(7));render(tree({onVersionConflict:changed}));fireEvent.click(screen.getByRole('button',{name:en['issueDate.title']}));await screen.findByText(en['issueDate.conflict']);expect(changed).toHaveBeenCalledTimes(1);expect(screen.queryByLabelText(en['issueDate.date'])).not.toBeInTheDocument();expect(mocks.saveIssueDate).not.toHaveBeenCalled();
});
it('a late old-account read cannot display its private evidence after owner changes',async()=>{
 let finish!:(v:Review)=>void;mocks.getIssueDate.mockReturnValueOnce(new Promise<Review>(resolve=>{finish=resolve;}));const saved=vi.fn();const view=render(tree({onSaved:saved}));fireEvent.click(screen.getByRole('button',{name:en['issueDate.title']}));await waitFor(()=>expect(mocks.getIssueDate).toHaveBeenCalledTimes(1));act(()=>auth(99,'synthetic-token-b'));await waitFor(()=>expect(screen.queryByRole('button',{name:en['issueDate.title']})).not.toBeInTheDocument());await act(async()=>finish(reviewed()));expect(view.container).not.toHaveTextContent('message:private-source');expect(saved).not.toHaveBeenCalled();
});
it('same-owner token rotation creates a fresh session and never accepts its late old read',async()=>{
 let finish!:(v:Review)=>void;mocks.getIssueDate.mockReturnValueOnce(new Promise<Review>(resolve=>{finish=resolve;})).mockResolvedValueOnce(unknown());const view=render(tree());fireEvent.click(screen.getByRole('button',{name:en['issueDate.title']}));await waitFor(()=>expect(mocks.getIssueDate).toHaveBeenCalledTimes(1));act(()=>auth(42,'synthetic-token-b'));await waitFor(()=>expect(screen.getByRole('button',{name:en['issueDate.title']})).toHaveAttribute('aria-expanded','false'));fireEvent.click(screen.getByRole('button',{name:en['issueDate.title']}));await screen.findByLabelText(en['issueDate.date']);await act(async()=>finish(reviewed()));expect(mocks.getIssueDate).toHaveBeenLastCalledWith(8,'synthetic-token-b');expect(view.container).not.toHaveTextContent('message:private-source');
});
function detail():RecommendationDetail{return{post:{...post},body:'Original article',articleSourceHash:'original-source-hash',items:Array.from({length:111},(_,id)=>({id,name:'Synthetic '+id,imageUrl:'/synthetic.png'}))} as RecommendationDetail;}
it('a valid merge touches only public date metadata and retains article source, publication and all 111 item references',()=>{
 const before=detail(),next=applyRecommendationIssueDate(before,8,3,reviewed())!;expect(next.post).toMatchObject({...before.post,version:4,issueDate:'2026-10-31',issueDateSource:'REVIEWED_SOURCE'});expect(next.body).toBe(before.body);expect(next.articleSourceHash).toBe(before.articleSourceHash);expect(next.items).toBe(before.items);expect(next.post).not.toHaveProperty('sourceRef');expect(next.post).not.toHaveProperty('sourceHash');expect(next.post).not.toHaveProperty('reviewedBy');
});
it('another post, advanced parent or unexplained version jump cannot receive a date merge',()=>{
 expect(applyRecommendationIssueDate(detail(),9,3,reviewed())).toBeUndefined();expect(applyRecommendationIssueDate({...detail(),post:{...post,version:5}},8,3,reviewed())).toBeUndefined();expect(applyRecommendationIssueDate(detail(),8,3,reviewed(8))).toBeUndefined();expect(applyRecommendationIssueDate(detail(),8,3,unknown(3))).toBeUndefined();
});
it('a same-version no-op review remains a metadata-only merge',()=>{const before=detail(),next=applyRecommendationIssueDate(before,8,3,reviewed(3))!;expect(next.post.version).toBe(3);expect(next.items).toBe(before.items);expect(next.post.publishedAt).toBe(before.post.publishedAt);});
