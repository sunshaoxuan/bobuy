import {useEffect,useRef,useState} from 'react';
import {Button,Space} from 'antd';
import {useI18n} from '../i18n';

export default function ProductPhotoSave({file,stored,showPreview=false}: {file:File;stored:boolean;showPreview?:boolean}) {
 const {t}=useI18n();
 const preview=useRef<HTMLImageElement>(null);
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
  const image=preview.current;
  if(image)image.src=url;
  setDownloadUrl(url);
  return ()=>{
   image?.removeAttribute('src');
   URL.revokeObjectURL(url);
  };
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
  {showPreview&&<img ref={preview} className="photo-evidence" alt={t('photo.evidence')}/>}
  <Space wrap>
   {canShare&&<Button loading={sharing} onClick={()=>void share()}>{t('photo.save_photo')}</Button>}
   {downloadUrl&&<Button href={downloadUrl} download={file.name}>{t('photo.download_photo')}</Button>}
  </Space>
  <p>{t(canShare?'photo.share_hint':'photo.download_hint')}</p>
  {stored&&<p>{t('photo.stored_version')}</p>}
  {message&&<p role="status">{t(message)}</p>}
 </div>;
}
