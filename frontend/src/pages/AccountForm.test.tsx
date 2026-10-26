import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import {AccountForm} from './Storefront';
const mocks=vi.hoisted(()=>({register:vi.fn(),account:vi.fn(),saved:vi.fn()}));
vi.mock('../api',()=>({api:{auth:{register:mocks.register},registerAccount:mocks.account}}));
vi.mock('../context/UserRoleContext',()=>({useUserRole:()=>({login:vi.fn()})}));
vi.mock('../authStorage',()=>({storeAuthSession:mocks.saved}));
beforeEach(()=>{localStorage.clear();localStorage.setItem('bobbuy_locale','en-US');vi.clearAllMocks();mocks.account.mockResolvedValue({});mocks.register.mockResolvedValue({});});
it.each([false,true])('self-service registration never displays or submits identity choices (checkout=%s)',async checkout=>{
 render(<I18nProvider><AccountForm checkout={checkout} afterLogin={()=>{}}/></I18nProvider>);
 expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();expect(document.querySelector('[name=roles]')).toBeNull();
 fireEvent.change(screen.getByLabelText(/username/i),{target:{value:'customer_only'}});fireEvent.change(screen.getByLabelText(/^email/i),{target:{value:'customer@example.com'}});fireEvent.change(screen.getByLabelText(/^password/i),{target:{value:'valid-password'}});fireEvent.submit(document.querySelector('form')!);
 const call=checkout?mocks.register:mocks.account;await waitFor(()=>expect(call).toHaveBeenCalledTimes(1));expect(call.mock.calls[0]).toEqual([{username:'customer_only',password:'valid-password',email:'customer@example.com'}]);
});
