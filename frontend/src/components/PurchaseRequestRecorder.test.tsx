import{act,fireEvent,render,screen,waitFor}from'@testing-library/react';
import{I18nProvider}from'../i18n';
import PurchaseRequestRecorder from'./PurchaseRequestRecorder';
const mocks=vi.hoisted(()=>({audioCapability:vi.fn(),transcribe:vi.fn()}));
vi.mock('../api',()=>({liveCartApi:mocks}));

class Recorder {
 static isTypeSupported=(type:string)=>type==='audio/mp4';
 state:'inactive'|'recording'='inactive';mimeType:string;ondataavailable?:({data}:{data:Blob})=>void;onstop?:()=>void;onerror?:()=>void;
 constructor(_stream:MediaStream,options:{mimeType:string}){this.mimeType=options.mimeType;}
 start(){this.state='recording';}
 stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['voice'],{type:this.mimeType})});this.onstop?.();}
}
const view=(onTranscript=vi.fn())=><I18nProvider><PurchaseRequestRecorder onTranscript={onTranscript}/></I18nProvider>;
beforeEach(()=>{vi.resetAllMocks();localStorage.setItem('bobbuy_locale','en-US');mocks.audioCapability.mockResolvedValue({enabled:true,mimeTypes:['audio/webm','audio/mp4'],maxDurationSeconds:60,maxBytes:1024});Object.defineProperty(globalThis,'MediaRecorder',{configurable:true,value:Recorder});});

it('uses the server/browser format intersection, releases tracks, and only returns editable text after explicit send',async()=>{
 const stop=vi.fn();Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:vi.fn().mockResolvedValue({getTracks:()=>[{stop}]})}});mocks.transcribe.mockResolvedValue({text:'two cartons of milk'});const onTranscript=vi.fn();render(view(onTranscript));
 fireEvent.click(await screen.findByRole('button',{name:'Record'}));await waitFor(()=>expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({audio:true}));fireEvent.click(screen.getByRole('button',{name:/Stop/}));expect(stop).toHaveBeenCalled();expect(onTranscript).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:/Send for transcription/}));await waitFor(()=>expect(onTranscript).toHaveBeenCalledWith('two cartons of milk'));expect(mocks.transcribe.mock.calls[0][0].type).toBe('audio/mp4');
});

it('keeps the text path available when permission is rejected and hides controls when no provider is approved',async()=>{
 Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:vi.fn().mockRejectedValue(Error('denied'))}});const rendered=render(view());fireEvent.click(await screen.findByRole('button',{name:'Record'}));expect(await screen.findByText(/Microphone access was not granted/)).toBeInTheDocument();
 rendered.unmount();mocks.audioCapability.mockResolvedValue({enabled:false,mimeTypes:[],maxDurationSeconds:60,maxBytes:0});await act(async()=>{render(view());});expect(screen.queryByRole('button',{name:'Record'})).not.toBeInTheDocument();
});
