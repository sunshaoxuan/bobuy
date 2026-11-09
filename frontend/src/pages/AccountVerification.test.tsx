import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import {EmailVerification} from './Storefront';
const mocks=vi.hoisted(()=>({verify:vi.fn(),resend:vi.fn(),refresh:vi.fn()}));
vi.mock('../api',()=>({api:{},storefrontApi:{verify:mocks.verify,resend:mocks.resend}}));
vi.mock('../context/UserRoleContext',()=>({useUserRole:()=>({user:{id:1,email:'pending@example.com',emailVerified:false}})}));
beforeEach(()=>{localStorage.clear();vi.clearAllMocks();mocks.verify.mockResolvedValue(true);mocks.refresh.mockResolvedValue(undefined);});
it.each(['en-US','ja-JP','zh-CN','zh-TW'])('verifies and refreshes authoritative records in %s',async locale=>{
 localStorage.setItem('bobbuy_locale',locale);render(<I18nProvider><EmailVerification refresh={mocks.refresh}/></I18nProvider>);
 fireEvent.change(document.querySelector('input[autocomplete=one-time-code]')!,{target:{value:'123456'}});fireEvent.submit(document.querySelector('form')!);
 await waitFor(()=>expect(mocks.refresh).toHaveBeenCalledTimes(1));expect(mocks.verify).toHaveBeenCalledWith('123456');
});
it('keeps failed verification unverified and does not refresh a successful result',async()=>{
 localStorage.setItem('bobbuy_locale','en-US');mocks.verify.mockRejectedValue(new Error('Code rejected'));
 render(<I18nProvider><EmailVerification refresh={mocks.refresh}/></I18nProvider>);
 fireEvent.change(document.querySelector('input[autocomplete=one-time-code]')!,{target:{value:'123456'}});fireEvent.submit(document.querySelector('form')!);
 await screen.findByText('Code rejected');expect(mocks.refresh).not.toHaveBeenCalled();
});
