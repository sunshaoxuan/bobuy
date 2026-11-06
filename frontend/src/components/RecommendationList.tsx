import { useState } from 'react';
import { Empty } from 'antd';
import { ArrowRightOutlined, EditOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import type { RecommendationSummary } from '../api';
import { useI18n } from '../i18n';
import './recommendation-list.css';

function Cover({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  return <div className="rec-collection-cover" aria-hidden="true">
    {src && !failed ? <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
      : <div className="rec-collection-placeholder"><span>bobuy<span>.</span></span><i /><i /><i /></div>}
  </div>;
}

export default function RecommendationList({ posts, hasError = false, pending = false }: { posts: RecommendationSummary[]; hasError?: boolean; pending?: boolean }) {
  const { t, locale } = useI18n();
  const date = (value: string) => new Date(value).toLocaleString(locale, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  if (!posts.length) return hasError || pending ? null : <div className="rec-collection-empty"><Empty description={t('rec.empty')} /></div>;
  return <ul className="rec-collections">{posts.map(post => <li key={post.id}>
    <Link to={'?post=' + post.id} className="rec-collection" aria-labelledby={'rec-collection-title-' + post.id} aria-describedby={'rec-collection-status-' + post.id + ' rec-collection-action-' + post.id}>
      <Cover key={post.coverImageUrl} src={post.coverImageUrl} />
      <div className="rec-collection-body">
        <div className="rec-collection-eyebrow"><span id={'rec-collection-status-' + post.id} className={'rec-collection-status' + (post.published ? ' is-published' : '')}><i aria-hidden="true" />{t(post.published ? 'rec.published' : 'rec.draft')}</span><span className="rec-collection-number">#{String(post.id).padStart(2, '0')}</span></div>
        <h2 id={'rec-collection-title-' + post.id}>{post.title || t('rec.untitled')}</h2>
        <dl className="rec-collection-meta">
          <div><dt>{t('rec.updated_date')}</dt><dd><time dateTime={post.updatedAt}>{date(post.updatedAt)}</time></dd></div>
          {post.publishedAt && <div><dt>{t('rec.published_date')}</dt><dd><time dateTime={post.publishedAt}>{date(post.publishedAt)}</time></dd></div>}
          {post.publishedAt && post.publisherName && <div><dt>{t('rec.publisher')}</dt><dd>{post.publisherName}</dd></div>}
        </dl>
        <div className="rec-collection-footer"><span id={'rec-collection-action-' + post.id}><EditOutlined aria-hidden="true" />{t('rec.edit_article')}</span><ArrowRightOutlined aria-hidden="true" /></div>
      </div>
    </Link>
  </li>)}</ul>;
}
