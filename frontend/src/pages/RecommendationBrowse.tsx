import {ProductStars} from '../components/ProductRating';
import SafeArticleText from '../components/SafeArticleText';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {Alert,Button,Empty,Spin} from 'antd';
import {Link,useLocation,useParams,useSearchParams} from 'react-router-dom';
import {storefrontApi,recommendationApi,type RecommendationOccurrence,type RecommendationItem,type RecommendationDetail,type StoreProduct,type ServiceBrowseCard} from '../api';
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
import IssueDirectory from '../components/IssueDirectory';
import ReservationAdd from '../components/ReservationAdd';
import {useDetailReturnFocus} from '../components/useDetailReturnFocus';
import {openCardDetail} from '../components/openCardDetail';
import type {ShoppingProps} from './PublicRecommendations';
import '../public-catalog.css';
import '../browse-pages.css';

type Props=ShoppingProps&{renderProduct:(item:RecommendationItem|undefined,product:StoreProduct|undefined,close:()=>void,pending:boolean)=>ReactNode};
export function ServiceSummary({offer}:{offer:ServiceBrowseCard}){const {t,locale}=useI18n();return <div className="service-summary"><p>{t('service.provider')}: {offer.provider}</p><p>{t('service.staff')}: {offer.staff??t('rec.not_stated')} · {t('service.hours')}: {offer.hours??t('rec.not_stated')}</p><p>{offer.originalPrice!=null&&<del>{offer.originalPrice.toLocaleString(locale)} {offer.currency} </del>}<strong>{t('browse.service_price')}: {offer.price?.toLocaleString(locale)??t('rec.not_stated')} {offer.currency}</strong> · {t(offer.taxIncluded===true?'browse.tax_included':offer.taxIncluded===false?'browse.tax_excluded':'rec.not_stated')}</p><p>{t('service.fees')}: {offer.noExtraFees?t('service.noExtraFees'):offer.fees.length?'':t('rec.not_stated')}</p>{offer.fees.map(fee=><p key={fee.key}>{localizedContent(fee.descriptions,locale)}: {fee.amount?.toLocaleString(locale)??t('rec.not_stated')} {offer.currency}</p>)}<p>{t('service.applicationStart')}: {offer.applicationStart??'?'} — {offer.applicationEnd??'?'}</p><p>{t('service.serviceStart')}: {offer.serviceStart??'?'} — {offer.serviceEnd??'?'}</p></div>;}

function Occurrences({period,topic,refresh,paused,checkDataset,onChanged,onSales,purchasePending,query='',quantities,onAdd,canBuy,openItem,openIssue,authKey,onReady}:ShoppingProps&{period:'current'|'history'|'all';topic?:number;refresh:number;paused:boolean;checkDataset:(key:string,token:string)=>boolean;onChanged:()=>void;openItem:(post:number,item:number,trigger:HTMLElement)=>void;openIssue:(post:number)=>void;onReady?:()=>void}){
 const {t,locale}=useI18n(),location=useLocation(),[params,setParams]=useSearchParams(),node=selectedNode(location.search),category=params.get('category')??'';
 const identity=JSON.stringify([location.pathname,node,topic,period,query,category,locale,refresh,authKey]);
 const activation=useSectionActivation(identity);
 const data=useBrowsePages<RecommendationOccurrence>(identity,(page,revision)=>storefrontApi.browseItems({page,revision,merchantId:node,issueId:topic,period,query,category,locale}),row=>row.key,activation.active&&node!==-1,token=>checkDataset(period,token),24,paused);
 const sale=useBoundedSales([...new Set(data.items.flatMap(row=>row.item?.productId?[row.item.productId]:[]))],identity,onSales);
 const sentinel=useNextBrowsePage(identity,!!data.page?.hasNext&&!data.busy&&!data.error,paused,data.next);
 useEffect(()=>{if(data.page)onReady?.();},[data.page?.revision,identity]);
 function choose(value:string){const next=new URLSearchParams(params);next.delete('item');if(value)next.set('category',value);else next.delete('category');setParams(next);}
 return <section ref={activation.element} aria-label={t(period==='history'?'rec.history':topic?'browse.entries':'browse.current')} aria-busy={data.busy} data-detail-list-ready={!!data.page||!!data.error}>
  <h2>{t(period==='history'?'rec.history':topic?'browse.entries':'browse.current')}</h2>
  {data.page&&<span role="status">{t('browse.result_count',{shown:data.items.length,total:data.page.matchedTotal})}</span>}
  <BrowseFilters page={data.page} category={category} onChoose={choose}/><BrowseError error={data.error} changed={data.changed} retry={data.retry} refresh={onChanged}/><BrowseError error={sale.error} retry={sale.retry} refresh={sale.retry}/>
  {!data.page&&!data.error?<Spin/>:!data.items.length?<Empty description={t('store.no_matches')}/>:<div className="catalog-master-grid server-browse-cards">{data.items.map((row,index)=>{
   const item=row.item?{...row.item,imageUrl:row.item.image?.url??''} as RecommendationItem:undefined;
   const text=item?recommendationText(item,locale):undefined,quote=item?.productId?sale.quotes[item.productId]:undefined,pending=!!item?.productId&&(!sale.done.has(item.productId)||!!purchasePending),buyable=!pending&&!!quote&&canBuy(quote);
   return <article className="store-product rec-pin" key={row.key} data-occurrence-key={row.key} data-card-detail={item?true:undefined} onClick={event=>{if(item)openCardDetail(event,trigger=>openItem(row.post.id,item.id,trigger));}}>
    {item&&<ReservationAdd allowed={buyable} quote={quote} name={text?.name??item.name} count={item.productId?quantities[item.productId]:undefined} onAdd={()=>{if(quote&&buyable)onAdd(quote);}}/>}

    {row.service&&row.serviceSummary?<><h3>{row.title}</h3><span>{t('service.kind')}</span><ServiceSummary offer={row.serviceSummary}/><Button onClick={()=>openIssue(row.post.id)}>{t('rec.conditions_detail')}</Button></>:item&&text?<>
     <div className="product-tile"><button type="button" className="product-photo" data-detail-trigger="photo" aria-label={t('store.detail_label',{name:text.name})} onClick={event=>openItem(row.post.id,item.id,event.currentTarget)}>{row.item?.image?.url?<img src={row.item.image.url} alt={text.name} loading={index<2?'eager':'lazy'} onError={event=>{event.currentTarget.style.display='none';}}/>:<span>{t('gallery.pending')}</span>}</button><div className="product-body"><ProductBrand brand={item.brand}/><button type="button" className="product-name" data-detail-trigger="name" onClick={event=>openItem(row.post.id,item.id,event.currentTarget)}><h3 title={text.name}><RecommendationName text={text}/></h3></button>{text.specification&&<p className="catalog-card-spec" title={text.specification}>{text.specification}</p>}</div></div>
     <p>{t('rec.code')}: {item.itemNumber||t('rec.not_stated')}</p><ProductVariant model={item.model} packaging={item.packaging}/><OfferInfo facts={{...item,offerNotes:text.offerNotes}} today={data.page?.japanDay} compact/>
     <ProductStars value={row.item?.rating}/>{quote&&!pending&&<SellingPrice product={quote} compact/>}
    </>:null}
    <footer className="product-card-source"><button type="button" className="catalog-offer-link" onClick={()=>openIssue(row.post.id)}>{row.title}</button><div className="rec-publication">{row.post.publisherName&&<span>{t('detail.published_signature')}: {row.post.publisherName}</span>}{row.post.publishedAt&&<time dateTime={row.post.publishedAt}>{new Date(row.post.publishedAt).toLocaleDateString(locale)}</time>}</div>{row.history&&<small>{t('rec.past_issue')}</small>}</footer>
   </article>;
  })}</div>}
  {data.page?.hasNext&&<div className="feed-loader" ref={sentinel}><Button loading={data.busy} disabled={paused||data.changed||!!data.error} onClick={data.next}>{t('store.load_more')} ({data.items.length}/{data.page.matchedTotal})</Button></div>}
 </section>;
}

export default function RecommendationBrowse(props:Props){
 const {t,locale}=useI18n(),location=useLocation(),{id}=useParams(),[params,setParams]=useSearchParams();
 const node=selectedNode(location.search),rawTopic=id??params.get('topic'),topic=rawTopic&&/^[1-9]\d*$/.test(rawTopic)?Number(rawTopic):undefined;
 const [history,setHistory]=useState(false),[refresh,setRefresh]=useState(0),[changed,setChanged]=useState(false),day=useJapaneseDay();
 const layout=useRef<HTMLDivElement>(null),[wide,setWide]=useState(false),[primaryReady,setPrimaryReady]=useState('');
 const detailOrigin=useRef<{scope:string;topic?:number;search:string}>();
 useEffect(()=>{const element=layout.current;if(!element)return;const measure=()=>setWide(window.innerWidth>=1280&&element.clientWidth>=1060);measure();const observer=typeof ResizeObserver==='undefined'?undefined:new ResizeObserver(measure);observer?.observe(element);window.addEventListener('resize',measure);return()=>{observer?.disconnect();window.removeEventListener('resize',measure);};},[]);
 const dataset=useRef<{identity:string;tokens:Record<string,string>}>({identity:'',tokens:{}}),identity=JSON.stringify([node,props.query??'',locale,refresh,day,props.authKey]);
 if(dataset.current.identity!==identity)dataset.current={identity,tokens:{}};
 useEffect(()=>{setChanged(false);},[identity]);
 function checkDataset(key:string,token:string){if(Object.entries(dataset.current.tokens).some(([other,value])=>other!==key&&value!==token)){setChanged(true);return false;}dataset.current.tokens[key]=token;return true;}
 function restart(){setChanged(false);setRefresh(value=>value+1);}
 // Visibility alone is not a dataset change. Explicit refresh, identity and Japanese-day changes remain authoritative.
 const selectedKey=JSON.stringify([location.pathname,topic,node,props.query??'',params.get('category'),locale,refresh,day,props.authKey]);
 const [selected,setSelected]=useState<{key:string;detail?:RecommendationDetail;error:string}>({key:'',error:''});
 useEffect(()=>{if(!topic||node===-1)return;let active=true;setSelected({key:selectedKey,error:''});void recommendationApi.get(topic,true,node).then(detail=>{if(active){if(detail.post.id!==topic||node!==undefined&&detail.post.merchantId!==node)throw Error('browse.invalid');setSelected({key:selectedKey,detail,error:''});}}).catch(error=>{if(active)setSelected({key:selectedKey,error:error.message});});return()=>{active=false;};},[selectedKey]);
 const full=selected.key===selectedKey?selected.detail:undefined,itemId=params.get('item'),opened=full?.items.find(item=>String(item.id)===itemId);
 const focusScope=JSON.stringify([location.pathname,node,props.query??'',params.get('category'),locale,props.authKey]);
 const origin=detailOrigin.current?.scope===focusScope?detailOrigin.current:undefined;
 const listTopic=itemId&&origin?origin.topic:topic,displayFull=listTopic===topic?full:undefined;
 const rememberFocus=useDetailReturnFocus(layout,itemId?`${topic}:${itemId}`:undefined,focusScope);
 const sales=useBoundedSales(opened?.productId?[opened.productId]:[],selectedKey+':'+(itemId??''),props.onSales);
 function select(post:number,item?:number,trigger?:HTMLElement){if(item!==undefined&&trigger){detailOrigin.current={scope:focusScope,topic,search:location.search};rememberFocus(trigger,`${post}:${item}`);}else detailOrigin.current=undefined;const next=new URLSearchParams(params);next.set('topic',String(post));if(item!==undefined)next.set('item',String(item));else next.delete('item');setParams(next);}
 function close(){const next=new URLSearchParams(params);next.delete('item');if(origin){const prior=new URLSearchParams(origin.search).get('topic');if(prior)next.set('topic',prior);else next.delete('topic');}detailOrigin.current=undefined;setParams(next,{replace:true});}
 const paused=!!props.autoPaused||!!itemId||changed;
 const common={...props,authKey:JSON.stringify([props.authKey,day]),refresh,paused,checkDataset,onChanged:restart,openItem:select,openIssue:(post:number)=>select(post)};
 const article=displayFull?articleText(displayFull,locale):undefined;
 const allTopics=new URLSearchParams(params);allTopics.delete('topic');allTopics.delete('item');
 const backPath=listTopic?'/recommendations'+(allTopics.size?'?'+allTopics.toString():''):scopedPath('/products',location.search);
 // The article is usable before its below-fold item list activates; its navigation can preload a light directory page.
 const directory=<IssueDirectory wide={wide} primaryReady={primaryReady===identity||!!displayFull} obscured={!!itemId||!!props.autoPaused} refresh={refresh} query={props.query} authKey={common.authKey} checkDataset={checkDataset} onRefresh={restart} selected={displayFull?{id:displayFull.post.id,title:article?.title??displayFull.post.title,publishedAt:displayFull.post.publishedAt}:undefined}/>;
 return <div ref={layout} className="recommendation-directory-layout" data-wide={wide}><section className="recommendations rec-public recommendation-primary"><Link className="rec-back" to={backPath}>{t(listTopic?'rec.title':'store.catalog')}</Link><header className="rec-feed-heading"><h1 tabIndex={-1} data-detail-focus-fallback>{article?.title??t('rec.title')}</h1></header>
  {changed&&<BrowseError error="browse.changed" changed retry={restart} refresh={restart}/>}
  {node===-1||rawTopic&&!topic?<Alert type="error" message={t('browse.invalid')}/>:<>
   {listTopic&&(selected.error?<BrowseError error={selected.error} retry={restart} refresh={restart}/>:!displayFull?<Spin/>:<article>{(article?.missingTitle||article?.missingBody)&&<Alert type="info" message={t(article.sourceKnown?'article.source_fallback':'article.legacy')}/>}<div className="rec-publication">{displayFull.post.publisherName&&<span>{t('detail.published_signature')}: {displayFull.post.publisherName}</span>}{displayFull.post.publishedAt&&<time dateTime={displayFull.post.publishedAt}>{new Date(displayFull.post.publishedAt).toLocaleDateString(locale)}</time>}</div><div className="rec-public-body">{article?.body.split('\n').map((text,index)=><p key={index} style={{overflowWrap:'anywhere'}}><SafeArticleText text={text}/></p>)}</div>{displayFull.serviceOffer&&<><ServiceSummary offer={displayFull.serviceOffer}/>{Object.entries(displayFull.serviceOffer.terms[locale]??displayFull.serviceOffer.terms['ja-JP']??{}).map(([key,value])=><section key={key}><h2>{t('service.'+key)}</h2>{Array.isArray(value)?value.map((line,i)=><p key={i}>{line}</p>):<p>{value}</p>}</section>)}</>}</article>)}
   <Occurrences {...common} period={listTopic?'all':'current'} topic={listTopic} onReady={()=>setPrimaryReady(identity)}/>
   {!listTopic&&<details open={history} onToggle={event=>setHistory(event.currentTarget.open)}><summary>{t('rec.history')}</summary>{history&&<Occurrences {...common} period="history"/>}</details>}
  </>}
  <BrowseError error={sales.error} retry={sales.retry} refresh={sales.retry}/>
  {itemId&&(!full?(selected.error?<BrowseError error={selected.error} retry={restart} refresh={restart}/>:<Spin/>):!opened?<Alert type="error" message={t('browse.detail_missing')}/>:props.renderProduct(opened,opened.productId&&sales.done.has(opened.productId)?sales.quotes[opened.productId]:undefined,close,!!props.purchasePending||!!opened.productId&&!sales.done.has(opened.productId)))}
 </section>{directory}</div>;
}
