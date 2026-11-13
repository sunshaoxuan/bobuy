from pathlib import Path
r=Path(__file__).parent
p=r/'frontend/src/components/PriceAdjustmentWorkspace.tsx';s=p.read_text(encoding='utf-8')
s=s.replace('Modal,Select,Table,Tag','Modal,Select,Tag')
a=s.index('  <Table rowKey=');b=s.index('  <Drawer title=',a)
s=s[:a]+'''  <div className="price-document-history" aria-busy={busy&&!draft&&!action}>{!visible.length&&<div className="price-document-empty">{busy?t('browse.loading'):c.unknown}</div>}{visible.map(r=><article className="price-document-record" key={r.value.id}>
   <header><div><small>{c[r.value.type]}</small><strong>{r.value.documentNumber}</strong></div><Tag color={r.state==='ACTIVE'?'green':r.state==='DRAFT'?'gold':undefined}>{c[r.state as 'DRAFT']??r.state}</Tag></header>
   <div className="price-document-record-meta"><span>{c[r.value.channel as 'STOREFRONT']??r.value.channel}</span><span>{date(r.value.startsAt)} · {r.value.type==='PERMANENT'?c.openEnd:date(r.value.endsAt)}</span></div>
   <ul className="price-document-lines">{r.value.lines.map((l,n)=><li key={l.id??n}><span>{label(l.productId)}</span><div><small>{c.before}: {l.beforeAmount==null?c.unknown:formatMoney(l.beforeAmount,r.value.currency,locale)}</small><strong>{l.amount==null?c.unknown:formatMoney(l.amount,r.value.currency,locale)} <small>/ {l.unit||c.unknown}</small></strong></div></li>)}</ul>
   <footer><div className="price-document-reason"><p>{r.value.sourceNote}{r.value.cancellationReason&&<small>{c.cancelReason}: {r.value.cancellationReason}</small>}</p>{Boolean(r.value.evidence.sourceItemId||r.value.evidence.sourcePrice)&&<details><summary>{c.source}</summary><small>{c.sourceHint}</small><pre tabIndex={0} aria-label={c.source}>{JSON.stringify(r.value.evidence,null,2)}</pre></details>}</div>{controls(r)}</footer>
  </article>)}</div>
'''+s[b:]
s=s.replace('aria-labelledby={titleId} width=', 'className="price-document-editor" aria-labelledby={titleId} footer={draft?<div className="price-document-actions price-document-footer"><Button disabled={busy} onClick={()=>setDraft(undefined)}>{c.close}</Button><Button type="primary" htmlType="submit" form={titleId+\'-form\'} loading={busy} disabled={busy||!draft.reason.trim()||!draft.lines.length}>{c.save}</Button></div>:undefined} width=')
s=s.replace('<form className="price-document-form" onSubmit=', '<form id={titleId+\'-form\'} className="price-document-form" onSubmit=')
s=s.replace('<div className="price-document-grid"><label>{c.type}', '<section className="price-document-form-section"><h3>{c.type}</h3><div className="price-document-grid"><label>{c.type}')
s=s.replace('    <label>{c.start}', '    </div></section><section className="price-document-form-section"><h3>{c.period}</h3><div className="price-document-grid"><label>{c.start}')
s=s.replace('</label>}</div>\n    <label>{c.reason}', '</label>}</div></section>\n    <section className="price-document-form-section"><h3>{c.reason}</h3><label>{c.reason}')
s=s.replace('value:draft.reason','value:draft.reason')
a=s.index('    <label>{c.products}');b=s.index('{editing&&Boolean',a)
s=s[:a]+'''    </section><section className="price-document-form-section"><h3>{c.lines}</h3><div className="price-document-edit-lines">{draft.lines.map((l,index)=><article key={l.productId||index}><h4>{label(l.productId)}</h4><div className="price-document-grid price-document-money-grid">
     <label>{c.amount}<InputNumber aria-label={`${c.amount}: ${label(l.productId)}`} min={0} max={1000000000} precision={draft.channel==='STOREFRONT'?currencies.find(p=>p.code===draft.currency)?.fractionDigits??0:2} value={l.amount||undefined} onChange={value=>setDraft({...draft,lines:draft.lines.map(x=>x===l?{...x,amount:value??0}:x)})}/></label>
     <label>{c.before}<InputNumber aria-label={`${c.before}: ${label(l.productId)}`} min={0} max={1000000000} value={l.beforeAmount} disabled={draft.channel==='STOREFRONT'} onChange={value=>setDraft({...draft,lines:draft.lines.map(x=>x===l?{...x,beforeAmount:value}:x)})}/></label>
     <label>{c.unit}<Input aria-label={`${c.unit}: ${label(l.productId)}`} maxLength={100} value={l.unit} onChange={e=>setDraft({...draft,lines:draft.lines.map(x=>x===l?{...x,unit:e.target.value}:x)})}/></label>
    </div></article>)}</div></section>'''+s[b:]
a=s.index('   </fieldset><div className="price-document-actions">');b=s.index('</form>}',a)
s=s[:a]+'   </fieldset>'+s[b:]
s=s.replace('<Alert type="info" message={c.hint}/>','<p className="price-document-hint">{c.hint}</p>')
p.write_text(s,encoding='utf-8')
p=r/'frontend/src/components/ProductPricingPanel.tsx';s=p.read_text(encoding='utf-8').replace('<Drawer title={c.title}', '<Drawer className="product-pricing-drawer" title={c.title}')
s=s.replace("{sheet&&<p>{t('pricing.current')}: {sheet.effective?formatMoney(sheet.effective.amount,sheet.effective.currency,locale):t('sale.pending')}</p>}","{sheet&&<div className=\"price-document-summary\"><span>{t('pricing.current')}</span><strong>{sheet.effective?formatMoney(sheet.effective.amount,sheet.effective.currency,locale):t('sale.pending')}</strong>{sheet.effective?.unit&&<small>/ {sheet.effective.unit}</small>}</div>}")
p.write_text(s,encoding='utf-8')
