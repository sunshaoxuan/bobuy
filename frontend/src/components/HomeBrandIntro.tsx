import {Link} from 'react-router-dom';
import {useI18n} from '../i18n';
import './home-brand.css';
const copy={
 'zh-CN':{tagline:'随行好物',description:'独立整理日本 Costco 商品资料与优惠资讯，提供行程购物入口。',recommendations:'浏览好物推荐',products:'浏览本程好物',trips:'查看可预订行程'},
 'zh-TW':{tagline:'隨行好物',description:'獨立整理日本 Costco 商品資料與優惠資訊，提供行程購物入口。',recommendations:'瀏覽好物推薦',products:'瀏覽本程好物',trips:'查看可預訂行程'},
 'ja-JP':{tagline:'旅とつながる、いいもの',description:'日本のCostco商品情報とお得な情報を独自に整理し、お買い物と配送行程につなげます。',recommendations:'おすすめ商品を見る',products:'商品を見る',trips:'予約可能な行程を見る'},
 'en-US':{tagline:'Good finds, along the way',description:'Independent information about Costco Japan products and offers, with links to shopping and delivery trips.',recommendations:'Explore recommendations',products:'Browse products',trips:'View bookable trips'}
};
export default function HomeBrandIntro(){const {locale}=useI18n(),c=copy[locale];return <section className="home-brand-intro" aria-label="宝宝败 Bobuy"><span>bobuy.cc</span><h1>宝宝败 <small>Bobuy</small></h1><p className="home-brand-tagline">{c.tagline}</p><p>{c.description}</p><nav><Link to="/recommendations">{c.recommendations}</Link><Link to="/products">{c.products}</Link><Link to="/trips">{c.trips}</Link></nav></section>;}
