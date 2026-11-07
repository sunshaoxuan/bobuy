import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Alert,Button,Empty,Spin} from 'antd';
import {Link,useLocation,useParams,useSearchParams} from 'react-router-dom';
import {storefrontApi,recommendationApi,type BrowsePage,type IssueDirectoryEntry,type RecommendationOccurrence,type RecommendationItem,type RecommendationDetail,type StoreProduct,type ServiceBrowseCard} from '../api';
import {useBoundedSales,useBrowsePages,useSectionActivation,useNextBrowsePage} from '../browsePaging';
import {BrowseError,BrowseFilters} from '../components/BrowseSupport';
import {useI18n,localizedContent} from '../i18n';
import {selectedNode,scopedPath} from '../storeNavigation';
import {useJapaneseDay} from '../recommendationSchedule';
import {recommendationText} from '../recommendationText';
import {articleText} from '../recommendationArticle';
import {ProductBrand,ProductVariant} from '../components/ProductMetadata';
import {RecommendationName} from '../components/RecommendationName';
import {OfferInfo} from '../components/RecommendationFacts';
import SellingPrice from '../components/SellingPrice';
import type {ShoppingProps} from './PublicRecommendations';
import '../public-catalog.css';
import '../browse-pages.css';

type Props=ShoppingProps&{renderProduct:(item:RecommendationItem|undefined,product:StoreProduct|undefined,close:()=>void,pending:boolean)=>ReactNode};
export function ServiceSummary({offer}:{offer:ServiceBrowseCard}){const {t,locale}=useI18n();return <div className="service-summary"><p>{t('service.provider')}: {offer.provider}</p><p>{t('service.staff')}: {offer.staff??t('rec.not_stated')} · {t('service.hours')}: {offer.hours??t('rec.not_stated')}</p><p>{offer.originalPrice!=null&&<del>{offer.originalPrice.toLocaleString(locale)} {offer.currency} </del>}<strong>{t('browse.service_price')}: {offer.price?.toLocaleString(locale)??t('rec.not_stated')} {offer.currency}</strong> · {t(offer.taxIncluded===true?'browse.tax_included':offer.taxIncluded===false?'browse.tax_excluded':'rec.not_stated')}</p><p>{t('service.fees')}: {offer.noExtraFees?t('service.noExtraFees'):offer.fees.length?'':t('rec.not_stated')}</p>{offer.fees.map(fee=><p key={fee.key}>{localizedContent(fee.descriptions,locale)}: {fee.amount?.toLocaleString(locale)??t('rec.not_stated')} {offer.currency}</p>)}<p>{t('service.applicationStart')}: {offer.applicationStart??'?'} — {offer.applicationEnd??'?'}</p><p>{t('service.serviceStart')}: {offer.serviceStart??'?'} — {offer.serviceEnd??'?'}</p></div>;}

function Occurrences({period,topic,refresh,paused,checkDataset,onChanged,onSales,purchasePending,query='',quantities,onAdd,canBuy,openItem,openIssue,authKey}:ShoppingProps&{period:'current'|'history'|'all';topic?:number;refresh:number;paused:boolean;checkDataset:(key:string,token:string)=>boolean;onChanged:()=>void;openItem:(post:number,item:number)=>void;openIssue:(post:number)=>void}){
 const {t,locale}=useI18n(),location=useLocation(),[params,setParams]=useSearchParams(),node=selectedNode(location.search),category=params.get('category')??'';
 const identity=JSON.stringify([location.pathname,node,topic,period,query,category,locale,refresh,authKey]);
 const activation=useSectionActivation(identity);
 const data=useBrowsePages<RecommendationOccurrence>(identity,(page,revision)=>storefrontApi.browseItems({page,revision,merchantId:node,issueId:topic,period,query,category,locale}),row=>row.key,activation.active&&node!==-1,token=>checkDataset(period,token),24,paused);
 const sale=useBoundedSales([...new Set(data.items.flatMap(row=>row.item?.productId?[row.item.productId]:[]))],identity,onSales);
 const sentinel=useNextBrowsePage(identity,!!data.page?.hasNext&&!data.busy&&!data.error,paused,data.next);
 function choose(value:string){const next=new URLSearchParams(params);next.delete('item');if(value)next.set('category',value);else next.delete('category');setParams(next);}
 return <section ref={activation.element} aria-label={t(period==='history'?'rec.history':topic?'browse.entries':'browse.current')} aria-busy={data.busy}>
  <h2>{t(period==='history'?'rec.history':topic?'browse.entries':'browse.current')}</h2>
  {data.page&&<span role="status">{t('browse.result_count',{shown:data.items.length,total:data.page.matchedTotal})}</span>}
  <BrowseFilters page={data.page} category={category} onChoose={choose}/><BrowseError error={data.error} changed={data.changed} retry={data.retry} refresh={onChanged}/><BrowseError error={sale.error} retry={sale.retry} refresh={sale.retry}/>
  {!data.page&&!data.error?<Spin/>:!data.items.length?<Empty description={t('store.no_matches')}/>:<div className="catalog-master-grid server-browse-cards">{data.items.map((row,index)=>{
   const item=row.item?{...row.item,imageUrl:row.item.image?.url??''} as RecommendationItem:undefined;
   const text=item?recommendationText(item,locale):undefined,quote=item?.productId?sale.quotes[item.productId]:undefined,pending=!!item?.productId&&(!sale.done.has(item.productId)||!!purchasePending),buyable=!pending&&!!quote&&canBuy(quote);
   return <article className="store-product rec-pin" key={row.key} data-occurrence-key={row.key}>
    <button type="button" className="catalog-offer-link" onClick={()=>openIssue(row.post.id)}>{row.title}</button><div className="rec-publication">{row.post.publisherName&&<span>{row.post.publisherName}</span>}{row.post.publishedAt&&<time dateTime={row.post.publishedAt}>{new Date(row.post.publishedAt).toLocaleDateString(locale)}</time>}</div>{row.history&&<small>{t('rec.past_issue')}</small>}
    {row.service&&row.serviceSummary?<><h3>{row.title}</h3><span>{t('service.kind')}</span><ServiceSummary offer={row.serviceSummary}/><Button onClick={()=>openIssue(row.post.id)}>{t('rec.conditions_detail')}</Button></>:item&&text?<>
     <div className="product-tile"><button type="button" className="product-photo" aria-label={t('store.detail_label',{name:text.name})} onClick={()=>openItem(row.post.id,item.id)}>{row.item?.image?.url?<img src={row.item.image.url} alt={text.name} loading={index<2?'eager':'lazy'} onError={event=>{event.currentTarget.style.display='none';}}/>:<span>{t('gallery.pending')}</span>}</button><div className="product-body"><ProductBrand brand={item.brand}/><button type="button" className="product-name" onClick={()=>openItem(row.post.id,item.id)}><h3><RecommendationName text={text}/></h3></button>{text.specification&&<p>{text.specification}</p>}</div></div>
     <p>{t('rec.code')}: {item.itemNumber||t('rec.not_stated')}</p><ProductVariant model={item.model} packaging={item.packaging}/><OfferInfo facts={{...item,offerNotes:text.offerNotes}} today={data.page?.japanDay} compact/>
     <Button onClick={()=>openItem(row.post.id,item.id)}>{t('rec.conditions_detail')}</Button>{quote&&!pending&&<SellingPrice product={quote}/>}
     <Button disabled={!buyable} aria-label={t('store.add_label',{name:item.name})} onClick={()=>{if(quote&&buyable)onAdd(quote);}}>{t(pending?'browse.sales_pending':buyable?'store.add_cart':item.productId?'catalog.not_available':'rec.reference_only')}</Button>{!!(item.productId&&quantities[item.productId])&&<span>{quantities[item.productId!]}</span>}
    </>:null}
   </article>;
  })}</div>}
  {data.page?.hasNext&&<div className="feed-loader" ref={sentinel}><Button loading={data.busy} disabled={paused||data.changed||!!data.error} onClick={data.next}>{t('store.load_more')} ({data.items.length}/{data.page.matchedTotal})</Button></div>}
 </section>;
}

function Directory({refresh,checkDataset,onRefresh,query='',authKey}:ShoppingProps&{refresh:number;checkDataset:(key:string,token:string)=>boolean;onRefresh:()=>void}){
 const {t,locale}=useI18n(),location=useLocation(),node=selectedNode(location.search);
 const data=useBrowsePages<IssueDirectoryEntry>(JSON.stringify([node,locale,query,refresh,authKey]),async(page,revision)=>{const result=await storefrontApi.browseIssues({page,revision,merchantId:node,locale,query,period:'all'});return {...result,scopeTotal:result.total,matchedTotal:result.total,categories:[],unclassified:0} as BrowsePage<IssueDirectoryEntry>;},row=>String(row.post.id),node!==-1,token=>checkDataset('directory',token),20);
 function path(id:number){const params=new URLSearchParams(location.search);params.set('topic',String(id));params.delete('item');return '/recommendations?'+params;}
 return <nav className="rec-issue-directory" aria-label={t('rec.contents')}><BrowseError error={data.error} changed={data.changed} retry={data.retry} refresh={onRefresh}/>{data.items.map(row=><Link key={row.post.id} to={path(row.post.id)}>{row.title} ({row.itemCount}){row.history?' · '+t('rec.past_issue'):''}</Link>)}{data.busy&&<Spin/>}{data.page?.hasNext&&<Button disabled={!!data.error} onClick={data.next}>{t('store.load_more')}</Button>}</nav>;
}

export default function RecommendationBrowse(props:Props){
 const {t,locale}=useI18n(),location=useLocation(),{id}=useParams(),[params,setParams]=useSearchParams();
 const node=selectedNode(location.search),rawTopic=id??params.get('topic'),topic=rawTopic&&/^[1-9]\d*$/.test(rawTopic)?Number(rawTopic):undefined;
 const [directory,setDirectory]=useState(false),[history,setHistory]=useState(false),[refresh,setRefresh]=useState(0),[changed,setChanged]=useState(false),day=useJapaneseDay();
 const dataset=useRef<{identity:string;tokens:Record<string,string>}>({identity:'',tokens:{}}),identity=JSON.stringify([node,props.query??'',locale,refresh,day,props.authKey]);
 if(dataset.current.identity!==identity)dataset.current={identity,tokens:{}};
 useEffect(()=>{setChanged(false);},[identity]);
 function checkDataset(key:string,token:string){if(Object.entries(dataset.current.tokens).some(([other,value])=>other!==key&&value!==token)){setChanged(true);return false;}dataset.current.tokens[key]=token;return true;}
 function restart(){setChanged(false);setRefresh(value=>value+1);}
 useEffect(()=>{const update=()=>{if(document.visibilityState==='visible')restart();};document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
 const selectedKey=JSON.stringify([location.pathname,topic,node,props.query??'',params.get('category'),locale,refresh,day,props.authKey]);
 const [selected,setSelected]=useState<{key:string;detail?:RecommendationDetail;error:string}>({key:'',error:''});
 useEffect(()=>{if(!topic||node===-1)return;let active=true;setSelected({key:selectedKey,error:''});void recommendationApi.get(topic,true,node).then(detail=>{if(active){if(detail.post.id!==topic||node!==undefined&&detail.post.merchantId!==node)throw Error('browse.invalid');setSelected({key:selectedKey,detail,error:''});}}).catch(error=>{if(active)setSelected({key:selectedKey,error:error.message});});return()=>{active=false;};},[selectedKey]);
 const full=selected.key===selectedKey?selected.detail:undefined,itemId=params.get('item'),opened=full?.items.find(item=>String(item.id)===itemId);
 const sales=useBoundedSales(opened?.productId?[opened.productId]:[],selectedKey+':'+(itemId??''),props.onSales);
 function select(post:number,item?:number){const next=new URLSearchParams(params);next.set('topic',String(post));if(item!==undefined)next.set('item',String(item));else next.delete('item');setParams(next);}
 function close(){const next=new URLSearchParams(params);next.delete('item');setParams(next,{replace:true});}
 const paused=!!props.autoPaused||!!itemId||changed;
 const common={...props,authKey:JSON.stringify([props.authKey,day]),refresh,paused,checkDataset,onChanged:restart,openItem:select,openIssue:(post:number)=>select(post)};
 const article=full?articleText(full,locale):undefined;
 const allTopics=new URLSearchParams(params);allTopics.delete('topic');allTopics.delete('item');
 const backPath=topic?'/recommendations'+(allTopics.size?'?'+allTopics.toString():''):scopedPath('/products',location.search);
 return <section className="recommendations rec-public"><Link className="rec-back" to={backPath}>{t(topic?'rec.title':'store.catalog')}</Link><header className="rec-feed-heading"><h1>{article?.title??t('rec.title')}</h1></header>
  {changed&&<BrowseError error="browse.changed" changed retry={restart} refresh={restart}/>}
  <details open={directory} onToggle={event=>setDirectory(event.currentTarget.open)}><summary>{t('rec.contents')}</summary>{directory&&<Directory {...props} authKey={common.authKey} refresh={common.refresh} checkDataset={checkDataset} onRefresh={restart}/>}</details>
  {node===-1||rawTopic&&!topic?<Alert type="error" message={t('browse.invalid')}/>:<>
   {topic&&(selected.error?<BrowseError error={selected.error} retry={restart} refresh={restart}/>:!full?<Spin/>:<article>{(article?.missingTitle||article?.missingBody)&&<Alert type="info" message={t(article.sourceKnown?'article.source_fallback':'article.legacy')}/>}<div className="rec-publication">{full.post.publisherName&&<span>{full.post.publisherName}</span>}{full.post.publishedAt&&<time dateTime={full.post.publishedAt}>{new Date(full.post.publishedAt).toLocaleDateString(locale)}</time>}</div><div className="rec-public-body">{article?.body.split('\n').map((text,index)=><p key={index}>{text}</p>)}</div>{full.serviceOffer&&<><ServiceSummary offer={full.serviceOffer}/>{Object.entries(full.serviceOffer.terms[locale]??full.serviceOffer.terms['ja-JP']??{}).map(([key,value])=><section key={key}><h2>{t('service.'+key)}</h2>{Array.isArray(value)?value.map((line,i)=><p key={i}>{line}</p>):<p>{value}</p>}</section>)}</>}</article>)}
   <Occurrences {...common} period={topic?'all':'current'} topic={topic}/>
   {!topic&&<details open={history} onToggle={event=>setHistory(event.currentTarget.open)}><summary>{t('rec.history')}</summary>{history&&<Occurrences {...common} period="history"/>}</details>}
  </>}
  <BrowseError error={sales.error} retry={sales.retry} refresh={sales.retry}/>
  {itemId&&(!full?(selected.error?<BrowseError error={selected.error} retry={restart} refresh={restart}/>:<Spin/>):!opened?<Alert type="error" message={t('browse.detail_missing')}/>:props.renderProduct(opened,opened.productId&&sales.done.has(opened.productId)?sales.quotes[opened.productId]:undefined,close,!!props.purchasePending||!!opened.productId&&!sales.done.has(opened.productId)))}
 </section>;
}
