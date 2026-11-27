import{act,fireEvent,render,screen,waitFor}from'@testing-library/react';
import{I18nProvider}from'../i18n';
import type{LiveCart,LiveCartLine}from'../api';
import TextPurchaseRequest from'./TextPurchaseRequest';
const mocks=vi.hoisted(()=>({customer:vi.fn(),audioCapability:vi.fn(),transcribe:vi.fn(),addText:vi.fn(),change:vi.fn(),link:vi.fn(),unlink:vi.fn(),undo:vi.fn()}));
vi.mock('../api',()=>({liveCartApi:mocks}));
vi.mock('./PurchaseProductPicker',()=>({default:({onChoose,onCancel}:{onChoose:(id:string)=>void;onCancel:()=>void})=><div><button onClick={()=>onChoose('catalog-2')}>Choose catalog fixture</button><button onClick={onCancel}>Cancel picker</button></div>}));
const submission='无糖豆浆 两箱\n草莓 1盒（不要太熟）';
const line=(id:number,over:Partial<LiveCartLine>={}):LiveCartLine=>({id,productId:null,quantity:1,unitPrice:null,currency:'JPY',ready:false,settlementId:null,version:0,requestBatchId:'batch-1',originalRequest:'草莓 1盒（不要太熟）',originalSubmission:submission,requestedName:'草莓',requestedUnit:'盒',requestConstraints:'不要太熟',quantityConfirmed:true,productName:{},itemNumber:null,productSpecification:{},...over});
const cart=(version:number,openLines:LiveCartLine[]):LiveCart=>({id:4,merchantId:1,version,openLines,openTotal:{amount:0,unpricedLineCount:openLines.filter(x=>x.unitPrice===null).length}});
const view=(identity='user:7')=><I18nProvider><TextPurchaseRequest key={identity} merchantId={1} enabled/></I18nProvider>;
beforeEach(()=>{vi.resetAllMocks();localStorage.setItem('bobbuy_locale','en-US');mocks.customer.mockResolvedValue([]);mocks.audioCapability.mockResolvedValue({enabled:false,mimeTypes:[],maxDurationSeconds:60,maxBytes:0});});

it('adds a mixed empty-cart request, preserves the complete submission after reload, and shows linked and pending lines together',async()=>{
 const pending=line(1);const linked=line(2,{productId:'catalog-1',originalRequest:'无糖豆浆 两箱',requestedName:'无糖豆浆',quantity:2,productName:{'en-US':'Unsweetened soy milk'},itemNumber:'SKU-1',productSpecification:{'en-US':'12 x 1 L'},unitPrice:20});
 mocks.addText.mockResolvedValue({batchId:'batch-1',cart:cart(1,[pending,linked]),replayed:false});
 const first=render(view());await waitFor(()=>expect(mocks.customer).toHaveBeenCalled());fireEvent.change(screen.getByLabelText('Original request'),{target:{value:submission}});fireEvent.click(screen.getByRole('button',{name:'Recognize and add'}));
 await screen.findByText('Unsweetened soy milk');expect(screen.getByText('Buyer confirmation needed')).toBeInTheDocument();expect(screen.getByText('Product linked')).toBeInTheDocument();fireEvent.click(screen.getAllByText('View full submitted text')[0]);expect(screen.getAllByText((_,element)=>element?.tagName==='P'&&element.textContent===submission).length).toBeGreaterThan(0);expect(mocks.addText.mock.calls[0][0]).toMatchObject({merchantId:1,expectedVersion:0,text:submission,recognize:true});
 first.unmount();mocks.customer.mockResolvedValue([cart(1,[pending,linked])]);render(view());expect(await screen.findByText('Unsweetened soy milk')).toBeInTheDocument();fireEvent.click(screen.getAllByText('View full submitted text')[0]);expect(screen.getAllByText((_,element)=>element?.tagName==='P'&&element.textContent===submission).length).toBeGreaterThan(0);
});

it('saves quantity, links, replaces and unlinks a real catalog association, then undoes only the added batch',async()=>{
 const pending=line(1);mocks.customer.mockResolvedValue([cart(1,[pending])]);mocks.change.mockResolvedValue(cart(2,[line(1,{quantity:3})]));mocks.link.mockResolvedValue(cart(3,[line(1,{productId:'catalog-2',productName:{'en-US':'Catalog product'},itemNumber:'REAL-2'})]));mocks.unlink.mockResolvedValue(cart(4,[pending]));mocks.addText.mockResolvedValue({batchId:'new-batch',cart:cart(5,[pending,line(9,{requestBatchId:'new-batch',originalRequest:'coffee'})]),replayed:false});mocks.undo.mockResolvedValue(cart(6,[pending]));
 render(view());await screen.findByText('Buyer confirmation needed');fireEvent.change(screen.getByLabelText('Requested quantity'),{target:{value:'3'}});await waitFor(()=>expect(mocks.change).toHaveBeenCalledWith(4,1,3,1));
 fireEvent.click(screen.getByRole('button',{name:'Link product'}));fireEvent.click(screen.getByRole('button',{name:'Choose catalog fixture'}));await screen.findByText('Catalog product');expect(mocks.link).toHaveBeenCalledWith(4,1,'catalog-2',2);
 fireEvent.click(screen.getByRole('button',{name:'Replace product'}));fireEvent.click(screen.getByRole('button',{name:'Choose catalog fixture'}));await waitFor(()=>expect(mocks.link).toHaveBeenLastCalledWith(4,1,'catalog-2',3));fireEvent.click(screen.getByRole('button',{name:'Unlink product'}));await waitFor(()=>expect(mocks.unlink).toHaveBeenCalledWith(4,1,3));
 fireEvent.change(screen.getByLabelText('Original request'),{target:{value:'coffee'}});fireEvent.click(screen.getByRole('button',{name:'Add as written'}));await screen.findByRole('button',{name:'Undo this batch'});fireEvent.click(screen.getByRole('button',{name:'Undo this batch'}));await waitFor(()=>expect(mocks.undo).toHaveBeenCalledWith('new-batch',5));expect(await screen.findByText('草莓')).toBeInTheDocument();
});

it('reuses the operation id after an uncertain result and ignores every late response from an old session',async()=>{
 let fail!:(e:Error)=>void;mocks.addText.mockImplementationOnce(()=>new Promise((_ok,no)=>{fail=no;}));const mounted=render(view('user:7'));await waitFor(()=>expect(mocks.customer).toHaveBeenCalled());fireEvent.change(screen.getByLabelText('Original request'),{target:{value:'oat milk'}});fireEvent.click(screen.getByRole('button',{name:'Add as written'}));await act(async()=>fail(Error('timeout')));await screen.findByText('timeout');const operationId=mocks.addText.mock.calls[0][0].operationId;mocks.addText.mockResolvedValue({batchId:'b',cart:cart(1,[line(1)]),replayed:true});fireEvent.click(screen.getByRole('button',{name:'Add as written'}));await waitFor(()=>expect(mocks.addText).toHaveBeenCalledTimes(2));expect(mocks.addText.mock.calls[1][0].operationId).toBe(operationId);
 mounted.unmount();const late:Array<(value:LiveCart[])=>void>=[];mocks.customer.mockImplementation(()=>new Promise(resolve=>{late.push(resolve);}));const session=render(view('user:7'));await waitFor(()=>expect(late).toHaveLength(1));session.rerender(view('user:8'));await waitFor(()=>expect(late).toHaveLength(2));await act(async()=>late[0]([cart(9,[line(8,{requestedName:'OLD ACCOUNT RESULT'})])]));expect(screen.queryByText('OLD ACCOUNT RESULT')).not.toBeInTheDocument();
});
