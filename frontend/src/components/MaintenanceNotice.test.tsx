import {fireEvent,render,screen} from '@testing-library/react';
import {I18nProvider,supportedLocales,translate} from '../i18n';
import {api,storefrontApi} from '../api';
import {BrowseError} from './BrowseSupport';
import {message} from 'antd';
import {isMaintenanceError} from './MaintenanceNotice';

beforeEach(()=>{localStorage.setItem('bobbuy_locale','en-US');vi.spyOn(message,'error').mockImplementation(()=>({then:vi.fn()}) as any);});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});

it.each(supportedLocales)('keeps the real release503 rejected after read recovery and renders a readable, manual retry in %s',async locale=>{
 localStorage.setItem('bobbuy_locale',locale);
 const fetcher=vi.fn().mockImplementation(async()=>new Response(JSON.stringify({message:'Release maintenance in progress'}),{status:503}));
 vi.stubGlobal('fetch',fetcher);
 let error='';try{await storefrontApi.trips();}catch(cause){error=(cause as Error).message;}
 expect(error).toBe(translate(locale,'maintenance.title'));
 expect(message.error).not.toHaveBeenCalled();
 const retry=vi.fn(),refresh=vi.fn();render(<I18nProvider><BrowseError error={error} retry={retry} refresh={refresh}/></I18nProvider>);
 expect(screen.getByRole('status')).toHaveTextContent(translate(locale,'maintenance.description'));
 expect(screen.queryByRole('alert')).not.toBeInTheDocument();
 expect(fetcher).toHaveBeenCalledTimes(3);expect(retry).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:translate(locale,'maintenance.retry')}));
 expect(retry).toHaveBeenCalledTimes(1);expect(refresh).not.toHaveBeenCalled();
});

it.each([502,503,504])('routes HTTP %s to the maintenance notice without a toast',async status=>{
 localStorage.setItem('bobbuy_locale','en-US');
 vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>new Response(JSON.stringify({message:'Upstream unavailable'}),{status})));
 await expect(api.trips()).rejects.toThrow(translate('en-US','maintenance.title'));
 expect(message.error).not.toHaveBeenCalled();
});

it.each(['Failed to fetch','Network error','NetworkError when attempting to fetch resource.'])('hands %s to MaintenanceNotice without a toast',async detail=>{
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError(detail)));
 await expect(api.trips()).rejects.toThrow(translate('en-US','maintenance.title'));
 expect(message.error).not.toHaveBeenCalled();
});

it('recognizes the maintenance code even with a different message',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>new Response(JSON.stringify({errorCode:'RELEASE_MAINTENANCE',message:'Updating'}),{status:500})));
 await expect(api.trips()).rejects.toThrow(translate('en-US','maintenance.title'));
 expect(message.error).not.toHaveBeenCalled();
});

it.each([401,403])('keeps HTTP %s authentication errors and their toast',async status=>{
 vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>new Response(JSON.stringify({message:'Access denied'}),{status})));
 await expect(api.trips()).rejects.toThrow('Access denied');
 expect(message.error).toHaveBeenCalledWith('Access denied');
 expect(isMaintenanceError('Access denied')).toBe(false);
});

it('keeps unrelated fetch failures as ordinary errors',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('Invalid request configuration')));
 await expect(api.trips()).rejects.toThrow('Invalid request configuration');
 expect(message.error).toHaveBeenCalledWith('Invalid request configuration');
});

it('continues to distinguish a catalog revision conflict from a release notice',()=>{
 localStorage.setItem('bobbuy_locale','en-US');const retry=vi.fn(),refresh=vi.fn();
 render(<I18nProvider><BrowseError error="browse.changed" changed retry={retry} refresh={refresh}/></I18nProvider>);
 fireEvent.click(screen.getByRole('button',{name:translate('en-US','browse.refresh')}));
 expect(refresh).toHaveBeenCalledTimes(1);expect(retry).not.toHaveBeenCalled();
});

it('preserves an unrelated storefront503 reason and ordinary retry',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockImplementation(async()=>new Response(JSON.stringify({message:'Public registration is unavailable'}),{status:503})));
 await expect(storefrontApi.trips()).rejects.toThrow('Public registration is unavailable');
 render(<I18nProvider><BrowseError error="Public registration is unavailable" retry={vi.fn()} refresh={vi.fn()}/></I18nProvider>);
 expect(screen.getByRole('alert')).toHaveTextContent('Public registration is unavailable');
 expect(screen.queryByText(translate('en-US','maintenance.title'))).not.toBeInTheDocument();
});
