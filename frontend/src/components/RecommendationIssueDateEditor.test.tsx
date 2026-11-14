import type {ComponentProps} from 'react';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import Editor,{recommendationIssueDateDraftError,type RecommendationIssueDateCopy,type RecommendationIssueDateReview as Review} from './RecommendationIssueDateEditor';

const copy:RecommendationIssueDateCopy={title:'Source-reviewed issue date',help:'Read the actual source before confirming its issue date.',current:'Stored review',date:'Issue date',reference:'Source reference',hash:'Source SHA256',hashHelp:'Raw-byte SHA-256',automaticHash:'Automatically computed',manualHash:'Source unavailable',reviewer:'Server reviewer',reviewedAt:'Server review time',unknown:'Unknown',unknownHint:'No reviewed issue date is stored; no date is inferred.',reviewedState:'Reviewed source',reviewed:'I checked the date against this exact source',save:'Save issue date',reload:'Re-read stored review',useSaved:'Use stored values',loading:'Loading stored review',loadFailed:'Could not read the stored review.',saveFailed:'Save result is unknown. Draft kept; re-read before retrying.',conflict:'The issue changed. Draft kept; re-read and review again.',invalidResponse:'The server review response is inconsistent. Re-read.',saved:'Issue date saved',reloaded:'Stored review re-read; check your retained draft.',invalidDate:'Enter a real calendar date.',invalidReference:'Enter an HTTPS or stable message source reference.',invalidHash:'Enter the exact 64-character source hash.',unavailable:'A current merchant session and issue are required.'};
const hash='a'.repeat(64),otherHash='b'.repeat(64);
const unknown=(version=3):Review=>({issueDate:null,sourceRef:null,sourceHash:null,reviewedBy:null,reviewedAt:null,source:'UNKNOWN',version});
const reviewed=(patch:Partial<Review>={}):Review=>({issueDate:'2026-11-02',sourceRef:'message:source-1',sourceHash:hash,reviewedBy:42,reviewedAt:'2026-11-09T14:00:00Z',source:'REVIEWED_SOURCE',version:4,...patch});
const deferred=<T,>()=>{let resolve!:(value:T)=>void;const promise=new Promise<T>(r=>resolve=r);return{resolve,promise};};
let get=vi.fn(),save=vi.fn(),onSaved=vi.fn(),onDirtyChange=vi.fn();
const props=(patch:Partial<ComponentProps<typeof Editor>>={}):ComponentProps<typeof Editor>=>({post:{id:8,version:3},actorKey:'merchant-a',sessionKey:'session-a',copy,get,save,onSaved,onDirtyChange,...patch});
const tree=(patch:Partial<ComponentProps<typeof Editor>>={})=><Editor {...props(patch)}/>;
async function ready(){await screen.findByLabelText(copy.date);}
function fill({issueDate='2026-11-02',sourceRef='message:source-1',sourceHash=hash}={}){fireEvent.change(screen.getByLabelText(copy.date),{target:{value:issueDate}});fireEvent.change(screen.getByLabelText(copy.reference),{target:{value:sourceRef}});fireEvent.change(screen.getByLabelText(copy.hash),{target:{value:sourceHash}});}
function confirm(){fireEvent.click(screen.getByRole('checkbox',{name:copy.reviewed}));}
function submit(){fireEvent.click(screen.getByRole('button',{name:copy.save}));}
beforeEach(()=>{get=vi.fn().mockResolvedValue(unknown());save=vi.fn().mockResolvedValue(reviewed());onSaved=vi.fn();onDirtyChange=vi.fn();});

it('loads only the injected owned endpoint and keeps UNKNOWN empty without guessing publication dates',async()=>{
 const post={id:8,version:3,publishedAt:'2026-11-09T12:00:00Z',title:'2026-11-08'};render(tree({post}));await ready();expect(get).toHaveBeenCalledTimes(1);expect(get).toHaveBeenCalledWith(8);expect(screen.getByText(copy.unknown)).toBeVisible();expect(screen.getByLabelText(copy.date)).toHaveValue('');expect(screen.getByLabelText(copy.reference)).toHaveValue('');expect(screen.getByRole('button',{name:copy.save})).toBeDisabled();expect(save).not.toHaveBeenCalled();
});
it('displays actual stored date/evidence/server reviewer read-only and never auto-confirms it',async()=>{
 get.mockResolvedValue(reviewed());const view=render(tree());await ready();expect(view.container.querySelector('time[datetime="2026-11-02"]')).toHaveTextContent('2026-11-02');expect(view.container.querySelector('dl')).toHaveTextContent('42');expect(view.container.querySelector('dl')).toHaveTextContent('2026-11-09T14:00:00Z');expect(screen.getByRole('checkbox',{name:copy.reviewed})).not.toBeChecked();expect(save).not.toHaveBeenCalled();expect(view.container.querySelectorAll('input')).toHaveLength(4);
});
it('renders an available artifact hash as read-only and omits it from the save request',async()=>{
 get.mockResolvedValue(reviewed({sourceAvailable:true,computedHash:hash,algorithm:'recommendation-issue-date-source-v1',hashEditable:false}));save.mockResolvedValue(reviewed({sourceAvailable:true,computedHash:hash,algorithm:'recommendation-issue-date-source-v1',hashEditable:false}));render(tree({post:{id:8,version:4}}));await ready();expect(screen.getByRole('textbox',{name:copy.hash})).toHaveAttribute('aria-readonly','true');confirm();submit();await screen.findByText(copy.saved);expect(save.mock.calls[0][1]).not.toHaveProperty('sourceHash');
});
it('restores an automatic source after clearing the draft hash and submits the displayed value',async()=>{
 get.mockResolvedValue(reviewed({sourceAvailable:true,computedHash:hash,algorithm:'recommendation-issue-date-source-v1',hashEditable:false}));render(tree({post:{id:8,version:4}}));await ready();
 fireEvent.change(screen.getByLabelText(copy.reference),{target:{value:'message:other'}});fireEvent.change(screen.getByLabelText(copy.hash),{target:{value:''}});
 fireEvent.change(screen.getByLabelText(copy.reference),{target:{value:'message:source-1'}});expect(screen.getByRole('textbox',{name:copy.hash})).toHaveTextContent(hash);confirm();submit();await screen.findByText(copy.saved);expect(save).toHaveBeenCalledTimes(1);expect(save.mock.calls[0][1]).not.toHaveProperty('sourceHash');
});
it('looks up the draft reference for UNKNOWN posts and attaches a file before first review',async()=>{
 const source={sourceRef:'message:source-1',sourceHash:hash,algorithm:'recommendation-issue-date-source-v1',sourceAvailable:true,hashEditable:false};
 const lookupSource=vi.fn().mockResolvedValue({...source,sourceAvailable:false,hashEditable:true,sourceHash:null,algorithm:null}),uploadSource=vi.fn().mockResolvedValue(source);
 const rendered=render(tree({lookupSource,uploadSource,copy:{...copy,attach:'Attach source',attachHelp:'EML or HTML, up to 10 MiB'}}));await ready();
 fireEvent.change(screen.getByLabelText(copy.date),{target:{value:'2026-11-02'}});fireEvent.change(screen.getByLabelText(copy.reference),{target:{value:source.sourceRef}});
 await waitFor(()=>expect(screen.getByRole('button',{name:'Attach source'})).toBeEnabled());expect(lookupSource).toHaveBeenCalledWith(8,source.sourceRef);
 const file=new File(['Subject: Test\r\n\r\nメール'],'source.eml',{type:'message/rfc822'});
 fireEvent.change(rendered.container.querySelector('input[type=file]')!,{target:{files:[file]}});
 await waitFor(()=>expect(screen.getByRole('textbox',{name:copy.hash})).toHaveAttribute('aria-readonly','true'));expect(uploadSource).toHaveBeenCalledWith(8,source.sourceRef,file);
 expect(screen.getByRole('checkbox',{name:copy.reviewed})).not.toBeChecked();confirm();submit();await screen.findByText(copy.saved);expect(save.mock.calls[0][1]).not.toHaveProperty('sourceHash');
});
it('uses a pre-stored artifact for a draft ref and ignores a stale lookup after another ref',async()=>{
 const old=deferred<any>();const source={sourceRef:'message:new',sourceHash:otherHash,algorithm:'recommendation-issue-date-source-html-utf8-v1',sourceAvailable:true,hashEditable:false};
 const lookupSource=vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue(source);render(tree({lookupSource}));await ready();
 fireEvent.change(screen.getByLabelText(copy.reference),{target:{value:'message:old'}});fireEvent.change(screen.getByLabelText(copy.reference),{target:{value:'message:new'}});
 await waitFor(()=>expect(screen.getByRole('textbox',{name:copy.hash})).toHaveTextContent(otherHash));await act(async()=>old.resolve({...source,sourceRef:'message:old',sourceHash:hash}));expect(screen.getByRole('textbox',{name:copy.hash})).toHaveTextContent(otherHash);
});
it('resets confirmation during a replacement file upload and ignores it after source ref changes',async()=>{
 const pending=deferred<any>(),source={sourceRef:'message:source-1',sourceHash:hash,algorithm:'recommendation-issue-date-source-v1',sourceAvailable:true,hashEditable:false};
 const lookupSource=vi.fn().mockImplementation((_id,ref)=>Promise.resolve(ref===source.sourceRef?source:{sourceRef:ref,sourceHash:null,algorithm:null,sourceAvailable:false,hashEditable:true}));
 const rendered=render(tree({lookupSource,uploadSource:vi.fn().mockReturnValue(pending.promise),copy:{...copy,attach:'Attach source'}}));await ready();fireEvent.change(screen.getByLabelText(copy.date),{target:{value:'2026-11-02'}});fireEvent.change(screen.getByLabelText(copy.reference),{target:{value:source.sourceRef}});
 await waitFor(()=>expect(screen.getByRole('checkbox',{name:copy.reviewed})).toBeEnabled());confirm();fireEvent.change(rendered.container.querySelector('input[type=file]')!,{target:{files:[new File(['bytes'],'source.eml',{type:'message/rfc822'})]}});
 await waitFor(()=>expect(screen.getByRole('checkbox',{name:copy.reviewed})).not.toBeChecked());expect(screen.getByRole('button',{name:copy.save})).toBeDisabled();fireEvent.change(screen.getByLabelText(copy.reference),{target:{value:'message:new'}});
 await act(async()=>pending.resolve(source));await waitFor(()=>expect(screen.getByLabelText(copy.hash)).toHaveValue(''));expect(screen.getByRole('checkbox',{name:copy.reviewed})).not.toBeChecked();
});
it('sends exactly the five allowed fields and accepts the matching server-owned save result',async()=>{
 render(tree());await ready();fill({sourceHash:hash.toUpperCase()});confirm();submit();await screen.findByText(copy.saved);expect(save).toHaveBeenCalledTimes(1);expect(save).toHaveBeenCalledWith(8,{issueDate:'2026-11-02',sourceRef:'message:source-1',sourceHash:hash,version:3,reviewed:true});expect(Object.keys(save.mock.calls[0][1]).sort()).toEqual(['issueDate','reviewed','sourceHash','sourceRef','version']);expect(onSaved).toHaveBeenCalledTimes(1);expect(onSaved).toHaveBeenCalledWith(reviewed());expect(screen.getByRole('checkbox',{name:copy.reviewed})).not.toBeChecked();expect(onDirtyChange).toHaveBeenLastCalledWith(false);
});
it('clears human confirmation whenever any source fact changes',async()=>{
 render(tree());await ready();fill();confirm();expect(screen.getByRole('button',{name:copy.save})).toBeEnabled();fireEvent.change(screen.getByLabelText(copy.hash),{target:{value:otherHash}});expect(screen.getByRole('checkbox',{name:copy.reviewed})).not.toBeChecked();expect(screen.getByRole('button',{name:copy.save})).toBeDisabled();
});
it('retains a 409 draft, requires explicit re-read, shows new server evidence and saves only after fresh review',async()=>{
 get.mockResolvedValueOnce(unknown()).mockResolvedValueOnce(reviewed({version:7,issueDate:'2026-10-01',sourceRef:'message:changed-on-server',sourceHash:otherHash}));save.mockRejectedValueOnce({status:409,errorCode:'RECOMMENDATION_CHANGED'}).mockResolvedValueOnce(reviewed({version:8}));const view=render(tree());await ready();fill();confirm();submit();await screen.findByText(copy.conflict);
 expect(screen.getByLabelText(copy.date)).toHaveValue('2026-11-02');expect(screen.getByLabelText(copy.reference)).toHaveValue('message:source-1');expect(screen.getByRole('checkbox',{name:copy.reviewed})).not.toBeChecked();expect(screen.getByRole('checkbox',{name:copy.reviewed})).toBeDisabled();expect(screen.getByRole('button',{name:copy.save})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:copy.reload}));await screen.findByText(copy.reloaded);expect(view.container.querySelector('dl')).toHaveTextContent('2026-10-01');expect(view.container.querySelector('dl')).toHaveTextContent('message:changed-on-server');expect(screen.getByLabelText(copy.date)).toHaveValue('2026-11-02');expect(screen.getByRole('checkbox',{name:copy.reviewed})).not.toBeChecked();confirm();submit();await screen.findByText(copy.saved);expect(save.mock.calls[1][1].version).toBe(7);
});
it('keeps an uncertain save draft and prevents blind resubmission until a successful re-read',async()=>{
 save.mockRejectedValue(Error('network'));render(tree());await ready();fill();confirm();submit();await screen.findByText(copy.saveFailed);expect(screen.getByLabelText(copy.hash)).toHaveValue(hash);expect(screen.getByRole('checkbox',{name:copy.reviewed})).toBeDisabled();submit();expect(save).toHaveBeenCalledTimes(1);expect(onSaved).not.toHaveBeenCalled();
});
it('rejects a mismatched save response rather than displaying another set of facts as saved',async()=>{
 save.mockResolvedValue(reviewed({issueDate:'2026-11-03'}));render(tree());await ready();fill();confirm();submit();await screen.findByText(copy.invalidResponse);expect(onSaved).not.toHaveBeenCalled();expect(screen.getByLabelText(copy.date)).toHaveValue('2026-11-02');expect(screen.getByRole('button',{name:copy.save})).toBeDisabled();
});
it.each(['post','actor','session'] as const)('ignores a late GET after changing %s and removes previous private data immediately',async kind=>{
 const old=deferred<Review>();get.mockReturnValueOnce(old.promise).mockResolvedValueOnce(reviewed({sourceRef:'message:new-private'}));const next=kind==='post'?{post:{id:9,version:3}}:kind==='actor'?{actorKey:'merchant-b'}:{sessionKey:'session-b'};const view=render(tree());await waitFor(()=>expect(get).toHaveBeenCalledTimes(1));view.rerender(tree(next));await ready();await act(async()=>old.resolve(reviewed({sourceRef:'message:old-private',version:99})));expect(screen.getByLabelText(copy.reference)).toHaveValue('message:new-private');expect(view.container).not.toHaveTextContent('message:old-private');expect(onSaved).not.toHaveBeenCalled();
});
it.each(['post','actor','session'] as const)('ignores a late SAVE after changing %s, including callbacks',async kind=>{
 const old=deferred<Review>();get.mockResolvedValueOnce(unknown()).mockResolvedValueOnce(reviewed({sourceRef:'message:new-private'}));save.mockReturnValueOnce(old.promise);const view=render(tree());await ready();fill();confirm();submit();await waitFor(()=>expect(save).toHaveBeenCalledTimes(1));const next=kind==='post'?{post:{id:9,version:3}}:kind==='actor'?{actorKey:'merchant-b'}:{sessionKey:'session-b'};view.rerender(tree(next));await ready();await act(async()=>old.resolve(reviewed()));expect(onSaved).not.toHaveBeenCalled();expect(screen.getByLabelText(copy.reference)).toHaveValue('message:new-private');expect(screen.queryByText(copy.saved)).not.toBeInTheDocument();
});
it('can return to the same identity while an obsolete save is still pending without adopting its result',async()=>{
 const old=deferred<Review>();save.mockReturnValueOnce(old.promise);get.mockResolvedValueOnce(unknown()).mockResolvedValueOnce(reviewed({sourceRef:'message:other'})).mockResolvedValueOnce(reviewed({sourceRef:'message:latest-a',version:5}));const view=render(tree());await ready();fill();confirm();submit();view.rerender(tree({actorKey:'merchant-b'}));await waitFor(()=>expect(screen.getByLabelText(copy.reference)).toHaveValue('message:other'));view.rerender(tree());await waitFor(()=>expect(screen.getByLabelText(copy.reference)).toHaveValue('message:latest-a'));await act(async()=>old.resolve(reviewed()));expect(get).toHaveBeenCalledTimes(3);expect(onSaved).not.toHaveBeenCalled();expect(screen.getByLabelText(copy.reference)).toHaveValue('message:latest-a');
});
it('uses operation order for overlapping re-reads even if an old response reports a larger version',async()=>{
 const old=deferred<Review>();get.mockReturnValueOnce(old.promise).mockResolvedValueOnce(reviewed({sourceRef:'message:fresh'}));render(tree());await waitFor(()=>expect(get).toHaveBeenCalledTimes(1));fireEvent.click(screen.getByRole('button',{name:copy.reload}));await ready();await act(async()=>old.resolve(reviewed({sourceRef:'message:stale',version:99})));expect(screen.getByLabelText(copy.reference)).toHaveValue('message:fresh');
});
it('keeps a draft when the current post version changes, and uses the explicit re-read version',async()=>{
 get.mockResolvedValueOnce(unknown()).mockResolvedValueOnce(unknown(7));save.mockResolvedValueOnce(reviewed({version:8}));const view=render(tree());await ready();fill();confirm();view.rerender(tree({post:{id:8,version:7}}));await screen.findByText(copy.conflict);expect(screen.getByLabelText(copy.reference)).toHaveValue('message:source-1');expect(screen.getByRole('checkbox',{name:copy.reviewed})).not.toBeChecked();expect(screen.getByRole('button',{name:copy.save})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:copy.reload}));await screen.findByText(copy.reloaded);confirm();submit();await screen.findByText(copy.saved);expect(save.mock.calls[0][1].version).toBe(7);
});
it('does not accept a response older than the already known post version',async()=>{
 get.mockResolvedValueOnce(unknown(3)).mockResolvedValueOnce(unknown(5));render(tree({post:{id:8,version:5}}));await screen.findByText(copy.conflict);expect(screen.queryByLabelText(copy.date)).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:copy.reload}));await ready();expect(screen.getByText(copy.unknown)).toBeVisible();
});
it('does not double-submit during an unresolved write',async()=>{
 const pending=deferred<Review>();save.mockReturnValue(pending.promise);render(tree());await ready();fill();confirm();const button=screen.getByRole('button',{name:copy.save});fireEvent.click(button);fireEvent.click(button);expect(save).toHaveBeenCalledTimes(1);await act(async()=>pending.resolve(reviewed()));await screen.findByText(copy.saved);
});
it('does not emit a save callback after unmount',async()=>{
 const pending=deferred<Review>();save.mockReturnValue(pending.promise);const view=render(tree());await ready();fill();confirm();submit();view.unmount();await act(async()=>pending.resolve(reviewed()));expect(onSaved).not.toHaveBeenCalled();expect(onDirtyChange).toHaveBeenLastCalledWith(false);
});
it('recovers a failed initial read without inventing a stored date',async()=>{
 get.mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce(unknown());render(tree());await screen.findByText(copy.loadFailed);expect(screen.queryByLabelText(copy.date)).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:copy.reload}));await ready();expect(screen.getByLabelText(copy.date)).toHaveValue('');
});
it('rejects an inconsistent UNKNOWN response with non-null date facts',async()=>{
 get.mockResolvedValue({...unknown(),issueDate:'2026-11-02'});render(tree());await screen.findByText(copy.invalidResponse);expect(screen.queryByLabelText(copy.date)).not.toBeInTheDocument();expect(save).not.toHaveBeenCalled();
});
it('requires an explicit action to discard a draft in favor of the latest stored values',async()=>{
 get.mockResolvedValue(reviewed());render(tree());await ready();fill({sourceRef:'message:my-draft'});expect(screen.getByLabelText(copy.reference)).toHaveValue('message:my-draft');fireEvent.click(screen.getByRole('button',{name:copy.useSaved}));expect(screen.getByLabelText(copy.reference)).toHaveValue('message:source-1');expect(screen.getByRole('checkbox',{name:copy.reviewed})).not.toBeChecked();expect(save).not.toHaveBeenCalled();
});
it('does not invoke owned callbacks with an absent current actor/session',()=>{render(tree({sessionKey:''}));expect(screen.getByText(copy.unavailable)).toBeVisible();expect(get).not.toHaveBeenCalled();expect(save).not.toHaveBeenCalled();});

it.each(['2026-02-29','0000-01-01','2026-11-02T00:00:00Z',''])('rejects non-calendar date %s',issueDate=>{expect(recommendationIssueDateDraftError({issueDate,sourceRef:'message:source',sourceHash:hash})).toBe('invalidDate');});
it.each(['http://example.com/source','https://example.com/#','https://user@example.com/','https://@example.com/','https:example.com','message:','message:/unstable','message:key#fragment','message:has space','https://example.com/%ZZ'])('rejects an invalid evidence reference %s',sourceRef=>{expect(recommendationIssueDateDraftError({issueDate:'2026-11-02',sourceRef,sourceHash:hash})).toBe('invalidReference');});
it.each(['message:stable-key','MESSAGE:source%2Fmessage','https://example.com/source?edition=2026-11-02'])('accepts deterministic reference syntax without fetching %s',sourceRef=>{expect(recommendationIssueDateDraftError({issueDate:'2026-11-02',sourceRef,sourceHash:hash})).toBeUndefined();});
it('rejects a fabricated or incomplete source hash',()=>{expect(recommendationIssueDateDraftError({issueDate:'2026-11-02',sourceRef:'message:key',sourceHash:'a'.repeat(63)})).toBe('invalidHash');});
