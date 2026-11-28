import {Alert,Button,Space} from 'antd';
import {useEffect,useRef,useState} from 'react';
import {liveCartApi} from '../api';
import {useI18n} from '../i18n';

type Capability={enabled:boolean;mimeTypes:string[];maxDurationSeconds:number;maxBytes:number};
type Phase='idle'|'recording'|'ready'|'sending';

export default function PurchaseRequestRecorder({onTranscript}:{onTranscript:(text:string)=>void}){
 const {locale,t}=useI18n();const [capability,setCapability]=useState<Capability>();const [phase,setPhase]=useState<Phase>('idle');const [error,setError]=useState('');const [elapsed,setElapsed]=useState(0);const recorder=useRef<MediaRecorder>();const stream=useRef<MediaStream>();const chunks=useRef<Blob[]>([]);const clip=useRef<{blob:Blob;seconds:number}>();const started=useRef(0);const timer=useRef<number>();const request=useRef<AbortController>();
 const release=()=>{if(timer.current)window.clearInterval(timer.current);timer.current=undefined;stream.current?.getTracks().forEach(track=>track.stop());stream.current=undefined;recorder.current=undefined;};
 const clear=()=>{request.current?.abort();request.current=undefined;release();chunks.current=[];clip.current=undefined;setElapsed(0);setPhase('idle');setError('');};
 useEffect(()=>{let current=true;void liveCartApi.audioCapability().then(value=>{if(current)setCapability(value);}).catch(()=>{if(current)setCapability({enabled:false,mimeTypes:[],maxDurationSeconds:60,maxBytes:0});});const leave=()=>{request.current?.abort();if(recorder.current?.state==='recording')recorder.current.stop();release();};window.addEventListener('pagehide',leave);document.addEventListener('visibilitychange',leave);return()=>{current=false;window.removeEventListener('pagehide',leave);document.removeEventListener('visibilitychange',leave);request.current?.abort();release();chunks.current=[];clip.current=undefined;};},[]);
 if(!capability?.enabled)return null;const config=capability;
 const stop=()=>{if(recorder.current?.state==='recording')recorder.current.stop();};
 async function start(){
  clear();if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){setError(t('purchase.audio_unsupported'));return;}
  const mime=config.mimeTypes.find(type=>MediaRecorder.isTypeSupported(type));if(!mime){setError(t('purchase.audio_format'));return;}
  try{const media=await navigator.mediaDevices.getUserMedia({audio:true});stream.current=media;const active=new MediaRecorder(media,{mimeType:mime});recorder.current=active;chunks.current=[];started.current=performance.now();active.ondataavailable=event=>{if(event.data.size)chunks.current.push(event.data);};active.onerror=()=>{release();setPhase('idle');setError(t('purchase.audio_failed'));};active.onstop=()=>{const seconds=Math.min(config.maxDurationSeconds,(performance.now()-started.current)/1000);const blob=new Blob(chunks.current,{type:mime});release();if(!blob.size||blob.size>config.maxBytes){chunks.current=[];setPhase('idle');setError(t('purchase.audio_size'));return;}clip.current={blob,seconds};chunks.current=[];setElapsed(Math.ceil(seconds));setPhase('ready');};active.start(250);setPhase('recording');timer.current=window.setInterval(()=>{const seconds=Math.ceil((performance.now()-started.current)/1000);setElapsed(seconds);if(seconds>=config.maxDurationSeconds)stop();},250);
  }catch{release();setPhase('idle');setError(t('purchase.audio_permission'));}
 }
 async function send(){if(!clip.current)return;setPhase('sending');setError('');const controller=new AbortController();request.current=controller;try{const result=await liveCartApi.transcribe(clip.current.blob,clip.current.seconds,locale,controller.signal);if(!controller.signal.aborted){onTranscript(result.text);clear();}}catch{if(!controller.signal.aborted){setPhase('ready');setError(t('purchase.audio_failed'));}}finally{if(request.current===controller)request.current=undefined;}}
 return <div className="purchase-recorder">{error&&<Alert type="warning" message={error}/>}<p>{t('purchase.audio_disclosure')}</p><Space wrap>{phase==='idle'&&<Button onClick={()=>void start()}>{t('purchase.audio_start')}</Button>}{phase==='recording'&&<Button danger onClick={stop}>{t('purchase.audio_stop')} ({elapsed}s)</Button>}{phase==='ready'&&<><Button type="primary" onClick={()=>void send()}>{t('purchase.audio_send')} ({elapsed}s)</Button><Button onClick={clear}>{t('purchase.audio_cancel')}</Button></>}{phase==='sending'&&<><Button loading disabled>{t('purchase.audio_sending')}</Button><Button onClick={clear}>{t('purchase.audio_cancel')}</Button></>}</Space></div>;
}
