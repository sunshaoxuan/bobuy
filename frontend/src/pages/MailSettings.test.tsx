import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '../i18n';
import MailSettings from './MailSettings';
const mocks=vi.hoisted(()=>({get:vi.fn(),save:vi.fn(),test:vi.fn()}));
// jsdom cannot parse Ant Design's generated select selector; real browser acceptance covers it.
vi.mock('antd',async()=>{const actual=await vi.importActual<typeof import('antd')>('antd');return {...actual,
 Select:({options,onChange,value,disabled,...rest}:any)=><select aria-label={rest['aria-label']} disabled={disabled} value={value} onChange={e=>onChange?.(e.target.value)}>{options.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>};});
vi.mock('../api',()=>({api:{mailSettings:mocks.get,saveMailSettings:mocks.save,testMailSettings:mocks.test}}));
const saved={version:4,enabled:false,host:'mail.briconbric.com',port:587,tlsMode:'STARTTLS',username:'postmaster@bobuy.cc',fromAddress:'postmaster@bobuy.cc',replyTo:'postmaster@bobuy.cc',passwordStored:true,keyId:'v1',keyReady:true,updatedAt:null,allowedHosts:['mail.briconbric.com'],testRecipients:[]};
beforeEach(()=>{vi.clearAllMocks();localStorage.setItem('bobbuy_locale','en-US');mocks.get.mockResolvedValue(saved);mocks.save.mockImplementation(async input=>({...saved,...input,version:5,password:undefined}));mocks.test.mockReset();});
it('reopens without password, preserves blank password and clears typed password after save',async()=>{
 render(<I18nProvider><MailSettings /></I18nProvider>);
 const password=await screen.findByLabelText('SMTP password');
 expect(password).toHaveValue('');expect(password).toHaveAttribute('type','password');
 fireEvent.change(password,{target:{value:'synthetic-only'}});
 fireEvent.click(screen.getByRole('button',{name:'Save mail settings'}));
 await waitFor(()=>expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({version:4,password:'synthetic-only'})));
 await waitFor(()=>expect(password).toHaveValue(''));
 expect(screen.getByRole('button',{name:'Send test message'})).toBeDisabled();expect(mocks.test).not.toHaveBeenCalled();
});
it('missing key disables credential entry and activation, and never offers unapproved recipients',async()=>{
 mocks.get.mockResolvedValue({...saved,passwordStored:false,keyReady:false});
 render(<I18nProvider><MailSettings /></I18nProvider>);
 expect(await screen.findByLabelText('SMTP password')).toBeDisabled();
 expect(screen.getByRole('switch')).toBeDisabled();
 expect(screen.getByRole('button',{name:'Send test message'})).toBeDisabled();
 expect(screen.getByText('Server encryption is required to save a password and test delivery.')).toBeInTheDocument();
});
it('validates basic fields without sending or saving when encryption is missing',async()=>{
 mocks.get.mockResolvedValue({...saved,passwordStored:false,keyReady:false});
 render(<I18nProvider><MailSettings /></I18nProvider>);
 const sender=await screen.findByLabelText('From address');
 fireEvent.change(sender,{target:{value:'invalid'}});
 fireEvent.click(screen.getByRole('button',{name:'Check form'}));
 await screen.findByText('Enter a valid email address.');
 expect(mocks.save).not.toHaveBeenCalled();expect(mocks.test).not.toHaveBeenCalled();
 fireEvent.change(sender,{target:{value:'fixture@example.test'}});
 fireEvent.click(screen.getByRole('button',{name:'Check form'}));
 await screen.findByText('Form validation passed. SMTP connection and delivery have not been tested.');
 fireEvent.click(screen.getByRole('button',{name:'Save mail settings'}));
 await waitFor(()=>expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({enabled:false,fromAddress:'fixture@example.test',password:''})));
});
it('requires a new password when the stored SMTP identity changes',async()=>{
 render(<I18nProvider><MailSettings /></I18nProvider>);
 fireEvent.change(await screen.findByLabelText('From address'),{target:{value:'changed@example.test'}});
 fireEvent.click(screen.getByRole('button',{name:'Save mail settings'}));
 await screen.findAllByText('Re-enter the SMTP password after changing the server, connection or sender.');
 expect(mocks.save).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('SMTP password'),{target:{value:'synthetic-only'}});
 fireEvent.click(screen.getByRole('button',{name:'Save mail settings'}));
 await waitFor(()=>expect(mocks.save).toHaveBeenCalledOnce());
});
it('tests the saved configuration with the sole approved recipient and prevents repeated sends',async()=>{
 mocks.get.mockResolvedValue({...saved,updatedAt:'2026-11-12T00:00:00Z',testRecipients:['self@example.test']});mocks.test.mockResolvedValue('ok');
 render(<I18nProvider><MailSettings /></I18nProvider>);
 const send=await screen.findByRole('button',{name:'Send test message'});
 await waitFor(()=>expect(send).toBeEnabled());fireEvent.click(send);
 await screen.findByText('SMTP server accepted the test message. Confirm delivery in the mailbox.');
 expect(mocks.test).toHaveBeenCalledWith('self@example.test');expect(send).toBeDisabled();
 expect(screen.getByText(/Wait 60 seconds/)).toBeInTheDocument();
});
it('blocks test delivery for unsaved changes and retains a failed save draft without retaining a password',async()=>{
 mocks.get.mockResolvedValue({...saved,testRecipients:['self@example.test']});mocks.save.mockRejectedValue(new Error('failure'));
 render(<I18nProvider><MailSettings /></I18nProvider>);
 fireEvent.change(await screen.findByLabelText('From address'),{target:{value:'changed@example.test'}});
 fireEvent.change(screen.getByLabelText('SMTP password'),{target:{value:'synthetic-only'}});
 expect(screen.getByRole('button',{name:'Send test message'})).toBeDisabled();
 fireEvent.click(screen.getByRole('button',{name:'Save mail settings'}));
 await screen.findByText(/Settings could not be saved/);
 expect(screen.getByLabelText('From address')).toHaveValue('changed@example.test');expect(screen.getByLabelText('SMTP password')).toHaveValue('');
 expect(mocks.test).not.toHaveBeenCalled();
});
it('shows a retryable loading failure and recovers',async()=>{
 mocks.get.mockResolvedValueOnce(null);
 render(<I18nProvider><MailSettings /></I18nProvider>);
 fireEvent.click(await screen.findByRole('button',{name:'Retry'}));
 await screen.findByLabelText('SMTP password');expect(mocks.get).toHaveBeenCalledTimes(2);
});
it('keeps a failed test visible without claiming success',async()=>{
 mocks.get.mockResolvedValue({...saved,testRecipients:['self@example.test']});mocks.test.mockRejectedValue(new Error('failure'));
 render(<I18nProvider><MailSettings /></I18nProvider>);
 const send=await screen.findByRole('button',{name:'Send test message'});await waitFor(()=>expect(send).toBeEnabled());fireEvent.click(send);
 await screen.findByText(/Test message could not be sent/);expect(screen.queryByText('SMTP server accepted the test message. Confirm delivery in the mailbox.')).not.toBeInTheDocument();
});
