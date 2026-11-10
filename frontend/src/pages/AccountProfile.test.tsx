import {render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import {AccountProfile} from './AccountProfile';
import type {SelfProfile} from '../api';

const mocks=vi.hoisted(()=>({profile:vi.fn(),save:vi.fn(),me:vi.fn(),session:vi.fn(),id:1,token:'session-a'}));
vi.mock('../api',()=>({api:{auth:{me:mocks.me}},storefrontApi:{profile:mocks.profile,saveProfile:mocks.save}}));
vi.mock('../authStorage',()=>({getStoredAccessToken:()=>mocks.token,getStoredUser:()=>({id:mocks.id}),getStoredAccessTokenExpiresAt:()=>null,getStoredRefreshTokenExpiresAt:()=>null,storeAuthSession:mocks.session}));
const account=(id=1):SelfProfile=>({id,username:'user-'+id,name:'Person '+id,email:'user'+id+'@example.com',emailVerified:false,phone:'123',defaultAddress:{city:'Tokyo',addressLine:'Street'},socialAccounts:[{platform:'Line',handle:'person',displayName:'Person',verified:true}]});
function mount(locale='en-US',id=1){localStorage.setItem('bobbuy_locale',locale);return render(<I18nProvider><AccountProfile key={id} userId={id} verification={(refresh,profile)=><button onClick={()=>void refresh()}>{profile.emailVerified?'Verified test':'Refresh test'}</button>}/></I18nProvider>);}
beforeEach(()=>{vi.clearAllMocks();localStorage.clear();mocks.id=1;mocks.token='session-a';mocks.profile.mockResolvedValue(account());mocks.me.mockResolvedValue({...account(),roles:['CUSTOMER']});mocks.save.mockResolvedValue(account());});

it.each(['en-US','ja-JP','zh-CN','zh-TW'])('loads and saves self details in %s',async locale=>{
 mount(locale);
 await screen.findByDisplayValue('Person 1');
 const name=screen.getByDisplayValue('Person 1');fireEvent.change(name,{target:{value:'Updated'}});
 mocks.profile.mockResolvedValue({...account(),name:'Updated'});mocks.me.mockResolvedValue({...account(),name:'Updated',roles:['CUSTOMER']});
 fireEvent.submit(document.querySelector('form')!);
 await waitFor(()=>expect(mocks.save).toHaveBeenCalledTimes(1));
 expect(mocks.save.mock.calls[0][0]).toMatchObject({name:'Updated',email:'user1@example.com',phone:'123',defaultAddress:{city:'Tokyo'},socialAccounts:[{platform:'Line',handle:'person',displayName:'Person'}]});
 expect(mocks.save.mock.calls[0][0].socialAccounts[0]).not.toHaveProperty('verified');
 await waitFor(()=>expect(mocks.profile).toHaveBeenCalledTimes(2));
 await waitFor(()=>expect(mocks.session).toHaveBeenLastCalledWith(expect.objectContaining({user:expect.objectContaining({name:'Updated'})})));
});

it('clears optional details and reloads saved state on reopen',async()=>{
 const view=mount();await screen.findByDisplayValue('Person 1');
 fireEvent.change(screen.getByDisplayValue('123'),{target:{value:''}});
 fireEvent.click(screen.getByRole('button',{name:'Clear address'}));
 fireEvent.click(screen.getByRole('button',{name:'Remove account'}));
 mocks.profile.mockResolvedValue({...account(),phone:null,defaultAddress:null,socialAccounts:[]});
 fireEvent.submit(document.querySelector('form')!);
 await waitFor(()=>expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({phone:'',defaultAddress:null,socialAccounts:[]})));
 await waitFor(()=>expect(mocks.profile).toHaveBeenCalledTimes(2));
 view.unmount();mount();await screen.findByDisplayValue('Person 1');
 expect(screen.queryByDisplayValue('Tokyo')).not.toBeInTheDocument();
 expect(screen.queryByDisplayValue('person')).not.toBeInTheDocument();
});

it('ignores a prior account response after switching accounts',async()=>{
 let resolve!:(value:SelfProfile)=>void;
 mocks.profile.mockImplementationOnce(()=>new Promise<SelfProfile>(done=>{resolve=done;}));
 const first=mount();first.unmount();mocks.id=2;mocks.token='session-b';mocks.profile.mockResolvedValue(account(2));mocks.me.mockResolvedValue({...account(2),roles:['CUSTOMER']});
 mount('en-US',2);await screen.findByDisplayValue('Person 2');
 resolve(account(1));await waitFor(()=>expect(mocks.session).toHaveBeenCalledTimes(1));
 expect(screen.queryByDisplayValue('Person 1')).not.toBeInTheDocument();
 expect(mocks.session).toHaveBeenLastCalledWith(expect.objectContaining({accessToken:'session-b',user:expect.objectContaining({id:2})}));
});

it('refreshes both records after verification and keeps a rotated session token',async()=>{
 mount();await screen.findByDisplayValue('Person 1');
 mocks.token='rotated-token';mocks.profile.mockResolvedValue({...account(),emailVerified:true});mocks.me.mockResolvedValue({...account(),emailVerified:true,roles:['CUSTOMER']});
 fireEvent.click(screen.getByRole('button',{name:'Refresh test'}));
 await screen.findByRole('button',{name:'Verified test'});
 expect(mocks.me).toHaveBeenCalledTimes(2);
 expect(mocks.session).toHaveBeenLastCalledWith(expect.objectContaining({accessToken:'rotated-token',user:expect.objectContaining({emailVerified:true})}));
});

it('preserves the edit after a save failure without claiming success',async()=>{
 mount();await screen.findByDisplayValue('Person 1');mocks.save.mockRejectedValue(new Error('Save unavailable'));
 fireEvent.change(screen.getByDisplayValue('Person 1'),{target:{value:'Retry name'}});fireEvent.submit(document.querySelector('form')!);
 await screen.findByText('Save unavailable');expect(screen.getByDisplayValue('Retry name')).toBeInTheDocument();expect(screen.queryByText('Details saved')).not.toBeInTheDocument();
 expect(mocks.profile).toHaveBeenCalledTimes(1);
});

it('ignores an older refresh response when a later refresh already completed',async()=>{
 mount();await screen.findByDisplayValue('Person 1');
 let older!:(value:SelfProfile)=>void;
 mocks.profile.mockImplementationOnce(()=>new Promise<SelfProfile>(done=>{older=done;}));
 fireEvent.click(screen.getByRole('button',{name:'Refresh test'}));
 mocks.profile.mockResolvedValue({...account(),name:'Latest'});
 mocks.me.mockResolvedValue({...account(),name:'Latest',roles:['CUSTOMER']});
 fireEvent.click(screen.getByRole('button',{name:'Refresh test'}));
 await screen.findByDisplayValue('Latest');older({...account(),name:'Stale'});
 await waitFor(()=>expect(mocks.profile).toHaveBeenCalledTimes(3));
 expect(screen.queryByDisplayValue('Stale')).not.toBeInTheDocument();
 expect(screen.getByDisplayValue('Latest')).toBeInTheDocument();
});

it.each([
 ['new profile with old verified session','new@example.com',false,'old@example.com',true,'new@example.com',false],
 ['old verified profile with new session','old@example.com',true,'new@example.com',false,'new@example.com',false],
 ['same email profile unverified session verified','same@example.com',false,'same@example.com',true,'same@example.com',true],
 ['same email profile verified session unverified','same@example.com',true,'same@example.com',false,'same@example.com',false]
] as const)('reconciles same-user snapshot mismatch: %s',async(_name,profileEmail,profileVerified,sessionEmail,sessionVerified,currentEmail,currentVerified)=>{
 const latest={...account(),email:currentEmail,emailVerified:currentVerified};
 mocks.profile.mockResolvedValueOnce({...account(),email:profileEmail,emailVerified:profileVerified}).mockResolvedValue(latest);
 mocks.me.mockResolvedValueOnce({...account(),email:sessionEmail,emailVerified:sessionVerified,roles:['CUSTOMER']}).mockResolvedValue({...latest,roles:['CUSTOMER']});
 mount();
 await waitFor(()=>expect(mocks.session).toHaveBeenLastCalledWith(expect.objectContaining({user:expect.objectContaining({email:currentEmail,emailVerified:currentVerified})})));
 expect(mocks.session).toHaveBeenCalledTimes(1);expect(mocks.profile).toHaveBeenCalledTimes(2);expect(mocks.me).toHaveBeenCalledTimes(2);
 expect(screen.getByDisplayValue(currentEmail)).toBeInTheDocument();
 expect(screen.getByRole('button',{name:currentVerified?'Verified test':'Refresh test'})).toBeInTheDocument();
});

it('bounds inconsistent rereads, shows an error without a verified summary, and allows an explicit retry',async()=>{
 mocks.profile.mockResolvedValue({...account(),email:'new@example.com',emailVerified:false});
 mocks.me.mockResolvedValue({...account(),email:'old@example.com',emailVerified:true,roles:['CUSTOMER']});
 mount();await screen.findByText('Request failed, please try again later.');
 expect(mocks.profile).toHaveBeenCalledTimes(2);expect(mocks.me).toHaveBeenCalledTimes(2);expect(mocks.session).not.toHaveBeenCalled();
 expect(screen.queryByRole('button',{name:'Verified test'})).not.toBeInTheDocument();expect(screen.queryByDisplayValue('new@example.com')).not.toBeInTheDocument();
 mocks.me.mockResolvedValue({...account(),email:'new@example.com',emailVerified:false,roles:['CUSTOMER']});
 fireEvent.click(screen.getByRole('button',{name:'Reload'}));await screen.findByDisplayValue('new@example.com');
 expect(mocks.session).toHaveBeenCalledTimes(1);expect(mocks.profile).toHaveBeenCalledTimes(3);expect(screen.queryByText('Request failed, please try again later.')).not.toBeInTheDocument();
});

it('does not report a successful save or retain verified UI when the post-save snapshots disagree',async()=>{
 mocks.profile.mockResolvedValue({...account(),emailVerified:true});mocks.me.mockResolvedValue({...account(),emailVerified:true,roles:['CUSTOMER']});
 mount();await screen.findByRole('button',{name:'Verified test'});
 fireEvent.change(screen.getByDisplayValue('user1@example.com'),{target:{value:'new@example.com'}});
 mocks.profile.mockResolvedValue({...account(),email:'new@example.com',emailVerified:false});
 fireEvent.submit(document.querySelector('form')!);await screen.findByText('Request failed, please try again later.');
 expect(mocks.session).toHaveBeenCalledTimes(1);expect(screen.queryByRole('button',{name:'Verified test'})).not.toBeInTheDocument();expect(screen.queryByText('Details saved')).not.toBeInTheDocument();
 expect(mocks.profile).toHaveBeenCalledTimes(3);
});

it('keeps a rotated token during a same-owner consistency reread',async()=>{
 mocks.profile.mockResolvedValueOnce({...account(),email:'new@example.com'}).mockImplementation(async()=>{mocks.token='rotated-on-reread';return account();});
 mount();await screen.findByDisplayValue('Person 1');
 expect(mocks.session).toHaveBeenCalledTimes(1);expect(mocks.session).toHaveBeenLastCalledWith(expect.objectContaining({accessToken:'rotated-on-reread'}));
});

it('ignores a prior account consistency reread after switching accounts',async()=>{
 let resolve!:(value:SelfProfile)=>void;
 mocks.profile.mockResolvedValueOnce({...account(),email:'new@example.com'}).mockImplementationOnce(()=>new Promise<SelfProfile>(done=>{resolve=done;}));
 const first=mount();await waitFor(()=>expect(mocks.profile).toHaveBeenCalledTimes(2));first.unmount();
 mocks.id=2;mocks.token='session-b';mocks.profile.mockResolvedValue(account(2));mocks.me.mockResolvedValue({...account(2),roles:['CUSTOMER']});
 mount('en-US',2);await screen.findByDisplayValue('Person 2');resolve(account());
 await waitFor(()=>expect(mocks.session).toHaveBeenCalledTimes(1));expect(mocks.session).toHaveBeenLastCalledWith(expect.objectContaining({user:expect.objectContaining({id:2})}));
});

it('ignores an unmounted consistency reread',async()=>{
 let resolve!:(value:SelfProfile)=>void;
 mocks.profile.mockResolvedValueOnce({...account(),email:'new@example.com'}).mockImplementationOnce(()=>new Promise<SelfProfile>(done=>{resolve=done;}));
 const view=mount();await waitFor(()=>expect(mocks.profile).toHaveBeenCalledTimes(2));view.unmount();resolve(account());
 await Promise.resolve();await Promise.resolve();expect(mocks.session).not.toHaveBeenCalled();
});

it('does not let an older mismatching reread overwrite a newer successful refresh or show an old error',async()=>{
 let refreshNow!:()=>Promise<void>;
 localStorage.setItem('bobbuy_locale','en-US');
 render(<I18nProvider><AccountProfile userId={1} verification={refresh=>{refreshNow=refresh;return null;}}/></I18nProvider>);
 await screen.findByDisplayValue('Person 1');
 let resolve!:(value:SelfProfile)=>void;
 mocks.profile.mockResolvedValueOnce({...account(),email:'new@example.com'}).mockImplementationOnce(()=>new Promise<SelfProfile>(done=>{resolve=done;}));
 let older!:Promise<void>;
 await act(async()=>{older=refreshNow();await Promise.resolve();await Promise.resolve();});
 await waitFor(()=>expect(mocks.profile).toHaveBeenCalledTimes(3));
 mocks.profile.mockResolvedValue({...account(),name:'Latest'});mocks.me.mockResolvedValue({...account(),name:'Latest',roles:['CUSTOMER']});
 await act(async()=>{await refreshNow();});await screen.findByDisplayValue('Latest');
 await act(async()=>{resolve({...account(),email:'still-different@example.com'});await older;});
 expect(screen.queryByText('Request failed, please try again later.')).not.toBeInTheDocument();expect(mocks.session).toHaveBeenCalledTimes(2);
 expect(screen.getByDisplayValue('Latest')).toBeInTheDocument();
});

it('does not announce a save after its refresh was superseded by a newer consistency failure',async()=>{
 let refreshNow!:()=>Promise<void>,resolve!:(value:SelfProfile)=>void;
 mocks.profile.mockResolvedValue({...account(),emailVerified:true});mocks.me.mockResolvedValue({...account(),emailVerified:true,roles:['CUSTOMER']});
 localStorage.setItem('bobbuy_locale','en-US');
 render(<I18nProvider><AccountProfile userId={1} verification={refresh=>{refreshNow=refresh;return null;}}/></I18nProvider>);
 await screen.findByDisplayValue('Person 1');fireEvent.change(screen.getByDisplayValue('user1@example.com'),{target:{value:'new@example.com'}});
 mocks.profile.mockImplementationOnce(()=>new Promise<SelfProfile>(done=>{resolve=done;})).mockResolvedValue({...account(),email:'new@example.com',emailVerified:false});
 fireEvent.submit(document.querySelector('form')!);await waitFor(()=>expect(mocks.profile).toHaveBeenCalledTimes(2));
 await act(async()=>{await refreshNow().catch(()=>{});});await screen.findByText('Request failed, please try again later.');
 await act(async()=>{resolve({...account(),emailVerified:true});});
 expect(screen.queryByText('Details saved')).not.toBeInTheDocument();expect(mocks.session).toHaveBeenCalledTimes(1);
 expect(screen.getByText('Request failed, please try again later.')).toBeInTheDocument();
});
