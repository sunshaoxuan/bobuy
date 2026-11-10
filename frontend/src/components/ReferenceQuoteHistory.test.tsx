import {fireEvent,render,screen} from '@testing-library/react';
import {I18nProvider} from '../i18n';
import ReferenceQuoteHistory from './ReferenceQuoteHistory';
const history=vi.hoisted(()=>vi.fn());vi.mock('../api',()=>({recommendationApi:{referenceHistory:history}}));
beforeEach(()=>{vi.clearAllMocks();localStorage.setItem('bobbuy_locale','en-US');});
it('loads retained source revisions only on explicit opening',async()=>{
 history.mockResolvedValue([{id:1,recordedAt:'2026-11-01T00:00:00Z',facts:{referencePrice:100,priceUnit:'100g',offerStart:'2026-11-01',offerEnd:'2026-11-08',offerNotes:'Original retained source'}},{id:2,recordedAt:'2026-11-02T00:00:00Z',facts:{referencePrice:80,priceUnit:'100g'}}]);
 render(<I18nProvider><ReferenceQuoteHistory post={5} item={166}/></I18nProvider>);expect(history).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Reference quote revision history'}));await screen.findByText('Original retained source');expect(history).toHaveBeenCalledWith(5,166);expect(screen.getByText('80 JPY / 100g')).toBeInTheDocument();
});
it('shows authorization failures instead of inventing history',async()=>{history.mockRejectedValue(new Error('Not authorized'));render(<I18nProvider><ReferenceQuoteHistory post={5} item={166}/></I18nProvider>);fireEvent.click(screen.getByRole('button',{name:'Reference quote revision history'}));await screen.findByText('Not authorized');});
