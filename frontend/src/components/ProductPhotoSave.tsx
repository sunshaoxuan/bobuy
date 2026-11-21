import {useEffect,useRef,useState} from 'react';
import {Button,Space} from 'antd';
import {useI18n} from '../i18n';

export default function ProductPhotoSave({file,stored,showPreview=false}: {file:File;stored:boolean;showPreview?:boolean}) {
 const {t}=useI18n();
 const preview=useRef<HTMLCanvasElement>(null);
 const [downloadUrl,setDownloadUrl]=useState('');
 const [message,setMessage]=useState('');
 const [sharing,setSharing]=useState(false);
 const shareData={files:[file]};
 let canShare=false;
 try {
  canShare=typeof navigator.share==='function' && navigator.canShare?.(shareData)===true;
 } catch {
  // Unsupported file or browser policy. The download is still available.
 }

 useEffect(()=>{
  setMessage('');
  const url=URL.createObjectURL(file);
  setDownloadUrl(url);
  return ()=>URL.revokeObjectURL(url);
 },[file]);

 useEffect(()=>{
  const canvas=preview.current;
  if(!showPreview||!canvas||typeof createImageBitmap!=='function')return;
  let active=true;
  canvas.hidden=true;
  void createImageBitmap(file).then(bitmap=>{
   try {
    if(!active)return;
    const context=canvas.getContext('2d');
    if(!context)return;
    const scale=Math.min(1,720/Math.max(bitmap.width,bitmap.height));
    canvas.width=Math.max(1,Math.round(bitmap.width*scale));
    canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    canvas.hidden=false;
   } finally {
    bitmap.close();
   }
  }).catch(()=>{/* A file can still be uploaded or saved if preview decoding fails. */});
  return ()=>{active=false;};
 },[file,showPreview]);

 const share=async()=>{
  setMessage('');setSharing(true);
  try {
   await navigator.share(shareData);
   // The browser does not report which destination was selected.
  } catch(error) {
   if(!(error instanceof DOMException && error.name==='AbortError'))setMessage('photo.share_failed');
  } finally {
   setSharing(false);
  }
 };

 return <div>
  {showPreview&&<canvas ref={preview} hidden className="photo-evidence" role="img" aria-label={t('photo.evidence')}/>}
  <Space wrap>
   {canShare&&<Button loading={sharing} onClick={()=>void share()}>{t('photo.save_photo')}</Button>}
   {downloadUrl&&<Button href={downloadUrl} download={file.name}>{t('photo.download_photo')}</Button>}
  </Space>
  <p>{t(canShare?'photo.share_hint':'photo.download_hint')}</p>
  {stored&&<p>{t('photo.stored_version')}</p>}
  {message&&<p role="status">{t(message)}</p>}
 </div>;
}
