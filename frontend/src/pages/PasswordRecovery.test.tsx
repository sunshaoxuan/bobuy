import React from 'react';
import {fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {I18nProvider} from '../i18n';
import {ForgotPassword,ResetPassword,takePasswordResetToken} from './PasswordRecovery';

const mount=(node:React.ReactNode)=>render(<I18nProvider><MemoryRouter>{node}</MemoryRouter></I18nProvider>);
beforeEach(()=>{vi.stubEnv('VITE_ACCOUNT_PASSWORD_RESET_ENABLED','true');localStorage.clear();localStorage.setItem('bobbuy_locale','en-US');vi.restoreAllMocks();history.replaceState(null,'','/');});
afterEach(()=>{vi.unstubAllEnvs();});

it('shows the same request success copy without exposing account existence',async()=>{
 const fetch=vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response(JSON.stringify({status:'success',data:{accepted:true}}),{status:200}));mount(<ForgotPassword/>);
 fireEvent.change(screen.getByLabelText('Email address'),{target:{value:'person@example.test'}});fireEvent.click(screen.getByRole('button',{name:'Send reset instructions'}));
 expect(await screen.findByRole('heading',{name:'Check your email'})).toBeInTheDocument();expect(screen.getByText(/If an eligible account/)).toBeInTheDocument();expect(fetch).toHaveBeenCalledWith('/api/auth/forgot-password',expect.objectContaining({referrerPolicy:'no-referrer'}));
});
it('removes the fragment before rendering and never puts the token in DOM or storage',()=>{
 history.replaceState(null,'','/reset-password#token=synthetic-secret');const token=takePasswordResetToken();mount(<React.StrictMode><ResetPassword token={token}/></React.StrictMode>);
 expect(location.hash).toBe('');expect(document.body).not.toHaveTextContent('synthetic-secret');expect(JSON.stringify(localStorage)).not.toContain('synthetic-secret');expect(screen.getByRole('heading',{name:'Choose a new password'})).toBeInTheDocument();
});
it('maps an invalid or used token to a recoverable localized state',async()=>{
 history.replaceState(null,'','/reset-password#token=synthetic-invalid');const token=takePasswordResetToken();vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('{}',{status:400}));mount(<ResetPassword token={token}/>);
 fireEvent.change(screen.getByLabelText('New password'),{target:{value:'safe-example-password'}});fireEvent.change(screen.getByLabelText('Confirm new password'),{target:{value:'safe-example-password'}});fireEvent.click(screen.getByRole('button',{name:'Save new password'}));
 expect(await screen.findByRole('heading',{name:'This link is no longer available'})).toBeInTheDocument();expect(screen.getByRole('link',{name:'Request a new link'})).toBeInTheDocument();
});
it('shows completion without carrying the token into the next URL',async()=>{
 history.replaceState(null,'','/reset-password#token=synthetic-complete');const token=takePasswordResetToken();vi.spyOn(globalThis,'fetch').mockResolvedValue(new Response('{}',{status:200}));mount(<ResetPassword token={token}/>);
 fireEvent.change(screen.getByLabelText('New password'),{target:{value:'safe-example-password'}});fireEvent.change(screen.getByLabelText('Confirm new password'),{target:{value:'safe-example-password'}});fireEvent.click(screen.getByRole('button',{name:'Save new password'}));
 await waitFor(()=>expect(screen.getByRole('heading',{name:'Password updated'})).toBeInTheDocument());expect(screen.getByRole('link',{name:'Sign in'})).toHaveAttribute('href','/login');expect(location.href).not.toContain('synthetic-complete');
});
it('does not show a stale network error while a request is pending or retried',async()=>{
 let reject!:(reason:Error)=>void;const pending=new Promise<Response>((_,fail)=>{reject=fail;});vi.spyOn(globalThis,'fetch').mockReturnValueOnce(pending).mockResolvedValueOnce(new Response('{}',{status:200}));mount(<ResetPassword token="synthetic-pending"/>);
 for(const label of ['New password','Confirm new password'])fireEvent.change(screen.getByLabelText(label),{target:{value:'safe-example-password'}});
 fireEvent.click(screen.getByRole('button',{name:'Save new password'}));expect(screen.queryByText(/connect/i)).not.toBeInTheDocument();reject(new Error('offline'));
 expect(await screen.findByRole('alert')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Try again'}));expect(screen.queryByRole('alert')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Save new password'}));
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(await screen.findByRole('heading',{name:'Password updated'})).toBeInTheDocument();
});
it('redirects recovery pages when the build-time feature flag is disabled',()=>{
 vi.stubEnv('VITE_ACCOUNT_PASSWORD_RESET_ENABLED','false');mount(<ForgotPassword/>);expect(screen.queryByRole('heading',{name:'Reset your password'})).not.toBeInTheDocument();
});
