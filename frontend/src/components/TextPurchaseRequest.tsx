import {Alert,Button,Input,InputNumber,Space,Tag} from 'antd';
import {useEffect,useState} from 'react';
import {liveCartApi,type LiveCart} from '../api';

export default function TextPurchaseRequest({merchantId,enabled}:{merchantId?:number;enabled:boolean}){
 const [cart,setCart]=useState<LiveCart>();const [text,setText]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [lastBatch,setLastBatch]=useState<string>();
 useEffect(()=>{if(!enabled||!merchantId)return;void liveCartApi.customer().then(all=>setCart(all.find(c=>c.merchantId===merchantId))).catch(()=>setError('请刷新后重试'));},[enabled,merchantId]);
 async function add(recognize:boolean){if(!merchantId||!text.trim())return;setBusy(true);setError('');try{const result=await liveCartApi.addText({operationId:crypto.randomUUID(),merchantId,expectedVersion:cart?.version??0,text:text.trim(),recognize});setCart(result.cart);setLastBatch(result.batchId);setText('');}catch(e){setError(String((e as Error).message));}finally{setBusy(false);}}
 if(!enabled)return <Alert type="info" message="登录顾客后可添加文字请购"/>;
 return <section className="text-purchase-request" aria-labelledby="text-request-title"><h2 id="text-request-title">添加请购</h2><p>可键入、粘贴或使用系统听写。录音上传将在后续批次提供。</p>
  {error&&<Alert type="error" message={error}/>}<Input.TextArea value={text} onChange={e=>setText(e.target.value)} maxLength={12000} autoSize={{minRows:3,maxRows:8}} placeholder="例如：无糖豆浆两箱，草莓一盒" aria-label="请购原文"/>
  <Space wrap><Button type="primary" loading={busy} disabled={!text.trim()} onClick={()=>void add(true)}>识别并加入</Button><Button loading={busy} disabled={!text.trim()} onClick={()=>void add(false)}>按原文加入</Button>{lastBatch&&<Button onClick={()=>void liveCartApi.undo(lastBatch,cart!.version).then(setCart).then(()=>setLastBatch(undefined)).catch(e=>setError(e.message))}>撤销本批</Button>}</Space>
  {lastBatch&&<Alert type="success" message="本次请购已加入"/>}
  {cart?.openLines.filter(l=>l.originalRequest).map(line=><article className="request-line" key={line.id}><div><Tag color={line.productId?'green':'gold'}>{line.productId?'已关联商品':'待采购员确认'}</Tag><strong>{line.requestedName||line.originalRequest}</strong><p>原始需求：{line.originalRequest}</p>{!line.quantityConfirmed&&<small>数量或单位待确认，已保留原文</small>}</div><InputNumber min={1} max={99} value={line.quantity} aria-label="请购数量"/><div>{line.productId?<><code>{line.productId}</code><Button onClick={()=>void liveCartApi.unlink(cart.id,line.id,cart.version).then(setCart).catch(e=>setError(e.message))}>取消关联</Button></>:<span>价格待确认，不计入合计</span>}</div></article>)}
 </section>;
}
