import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nProvider } from '../i18n';
import MailSettings from './MailSettings';
const mocks=vi.hoisted(()=>({get:vi.fn(),save:vi.fn(),test:vi.fn()}));
// jsdom cannot parse Ant Design's generated select selector; real browser acceptance covers it.
vi.mock('antd',async()=>{const actual=await vi.importActual<typeof import('antd')>('antd');return {...actual,
 Select:({options,onChange,value,disabled,...rest}:any)=><select aria-label={rest['aria-label']} disabled={disabled} value={value} onChange={e=>onChange?.(e.target.value)}>{options.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>};});
vi.mock('../api',()=>({api:{mailSettings:mocks.get,saveMailSettings:mocks.save,testMailSettings:mocks.test}}));
const saved={version:4,enabled:false,host:'mail.briconbric.com',port:587,tlsMode:'STARTTLS',username:'postmaster@bobuy.cc',fromAddress:'postmaster@bobuy.cc',replyTo:'postmaster@bobuy.cc',passwordStored:true,keyId:'v1',keyReady:true,updatedAt:null,allowedHosts:['mail.briconbric.com'],testRecipients:[]};
beforeEach(()=>{localStorage.setItem('bobbuy_locale','en-US');mocks.get.mockResolvedValue(saved);mocks.save.mockImplementation(async input=>({...saved,...input,version:5,password:undefined}));mocks.test.mockReset();});
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
 expect(screen.getByText('No test recipient has been approved. Sending is unavailable.')).toBeInTheDocument();
});
