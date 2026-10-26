import {useEffect,useMemo,useState} from 'react';
import {Alert,Button,Checkbox,Input,Modal,Popconfirm,Select,Table,Tag} from 'antd';
import {Link} from 'react-router-dom';
import {api,recommendationTaxonomyApi as taxonomy,type RecommendationChoice,type RecommendationDetail} from '../api';
import {localizedContent,useI18n} from '../i18n';

export default function RecommendationClassification({detail,onChanged,onPendingChange}:{detail:RecommendationDetail;onChanged:(value:RecommendationDetail)=>void;onPendingChange:(value:boolean)=>void}) {
 const {t,locale}=useI18n();
 const [choices,setChoices]=useState<{categories:RecommendationChoice[];suppliers:RecommendationChoice[]}>({categories:[],suppliers:[]});
 const [selected,setSelected]=useState<React.Key[]>([]),[search,setSearch]=useState(''),[categoryIds,setCategoryIds]=useState<string[]>([]);
 const [updateCategories,setUpdateCategories]=useState(false),[mode,setMode]=useState<'add'|'remove'|'replace'>('add');
 const [supplierId,setSupplierId]=useState<string|null>(null),[updateSupplier,setUpdateSupplier]=useState(false),[showSupplier,setShowSupplier]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [manage,setManage]=useState(false),[kind,setKind]=useState<'category'|'supplier'>('category'),[editId,setEditId]=useState<string>(),[label,setLabel]=useState('');
 const locked=detail.post.published;
 useEffect(()=>onPendingChange(selected.length>0&&(updateCategories||updateSupplier)),[selected.length,updateCategories,updateSupplier,onPendingChange]);
 async function load(){setChoices(await taxonomy.options());}
 useEffect(()=>{void load().catch(e=>setError((e as Error).message));},[]);
 const rows=useMemo(()=>detail.items.filter(item=>(item.name+' '+(item.itemNumber??'')).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),[detail.items,search]);
 const options=(values:RecommendationChoice[])=>values.map(value=>({value:value.id,label:localizedContent(value.name,locale)})).sort((a,b)=>a.label.localeCompare(b.label,locale));
 async function run(action:()=>Promise<void>){setBusy(true);setError('');setNotice('');try{await action();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="rec-classification">
  <div className="rec-section-heading"><h2>{t('class.title')}</h2><div className="rec-action-group">
   <Button onClick={()=>{setKind('category');setEditId(undefined);setLabel('');setManage(true);}}>{t('class.manage_categories')}</Button>
   <Link to="/admin/suppliers" target="_blank">{t('class.manage_suppliers')}</Link><Button onClick={()=>{setKind('supplier');setEditId(undefined);setLabel('');setManage(true);}}>{t('class.new_supplier')}</Button>
   <Button loading={busy} onClick={()=>void run(load)}>{t('rec.reload')}</Button>
  </div></div>
  {error&&<Alert type="error" message={error} showIcon/>}{notice&&<Alert type="success" message={notice} showIcon/>}
  <p>{t('class.help')}</p>
  <Input aria-label={t('class.search')} placeholder={t('class.search')} value={search} onChange={e=>{setSearch(e.target.value);setSelected([]);}} allowClear/>
  <div className="rec-classify-selection"><Button disabled={locked||busy||!rows.length} onClick={()=>setSelected(rows.map(item=>item.id))}>{t('class.select_results',{count:rows.length})}</Button><Button disabled={!selected.length||busy} onClick={()=>setSelected([])}>{t('class.clear')}</Button><strong>{t('class.selected',{count:selected.length})}</strong></div>
  <Table rowKey="id" size="small" dataSource={rows} pagination={{pageSize:12,showSizeChanger:false}} scroll={{x:620}}
   rowSelection={{selectedRowKeys:selected,preserveSelectedRowKeys:true,onChange:keys=>setSelected(keys),getCheckboxProps:()=>({disabled:locked||busy})}}
   columns={[
    {title:t('rec.name'),render:(_,item)=><span className="rec-classify-name"><img src={item.imageUrl} alt=""/><span>{item.name}<small>{item.itemNumber}</small></span></span>},
    {title:t('class.categories'),render:(_,item)=>item.categories?.length?item.categories.map(category=><Tag key={category.id}>{localizedContent(category.name,locale)}</Tag>):t('class.unclassified')},
    {title:t('class.supplier'),render:(_,item)=><span>{item.supplierName?localizedContent(item.supplierName,locale):t('class.unassigned')}<small>{t(item.showSupplier?'class.shown':'class.hidden')}</small></span>}
   ]}/>
  {!locked&&<div className="rec-classify-controls">
   <div><Checkbox checked={updateCategories} onChange={e=>setUpdateCategories(e.target.checked)}>{t('class.update_categories')}</Checkbox>
    <Select aria-label={t('class.category_mode')} value={mode} disabled={!updateCategories||busy} onChange={setMode} options={['add','remove','replace'].map(value=>({value,label:t('class.'+value)}))}/>
    <Select aria-label={t('class.categories')} mode="multiple" optionFilterProp="label" value={categoryIds} disabled={!updateCategories||busy} options={options(choices.categories)} onChange={setCategoryIds} placeholder={t('class.choose_categories')}/>
   </div><div><Checkbox checked={updateSupplier} onChange={e=>setUpdateSupplier(e.target.checked)}>{t('class.update_supplier')}</Checkbox>
    <Select aria-label={t('class.supplier')} showSearch optionFilterProp="label" allowClear value={supplierId} disabled={!updateSupplier||busy} options={options(choices.suppliers)} onChange={value=>{setSupplierId(value??null);if(!value)setShowSupplier(false);}} placeholder={t('class.choose_supplier')}/>
    <Checkbox disabled={!updateSupplier||!supplierId||busy} checked={showSupplier} onChange={e=>setShowSupplier(e.target.checked)}>{t('class.show_supplier')}</Checkbox>
   </div>
   <Popconfirm title={t('class.confirm',{count:selected.length})} onConfirm={()=>void run(async()=>{
    const next=await taxonomy.assign(detail.post.id,{itemIds:selected.map(Number),categoryIds,categoryMode:mode,updateCategories,supplierId,updateSupplier,showSupplier,version:detail.post.version});
    onChanged(next);setSelected([]);setNotice(t('class.saved'));
   })}><Button type="primary" loading={busy} disabled={!selected.length||(!updateCategories&&!updateSupplier)}>{t('class.apply')}</Button></Popconfirm>
  </div>}
  <Modal open={manage} title={t(kind==='category'?'class.manage_categories':'class.new_supplier')} onCancel={()=>setManage(false)} confirmLoading={busy} okText={t('class.save_label')} onOk={()=>void run(async()=>{
   if(!label.trim())throw new Error(t('class.label_required'));
   if(kind==='category') {const value=await taxonomy.category(editId,label.trim(),locale);await load();setCategoryIds(ids=>[...new Set([...ids,value.id])]);}
   else {const value=await api.createSupplier({id:'supplier-'+crypto.randomUUID(),name:{[locale]:label.trim()},description:{},onboardingRules:{},contactInfo:''});await load();setSupplierId(value.id);setShowSupplier(false);}
   setManage(false);
  })}>
   {error&&<Alert type="error" message={error} showIcon/>}
   {kind==='category'&&<Select aria-label={t('class.edit_category')} showSearch optionFilterProp="label" allowClear value={editId} options={options(choices.categories.filter(value=>value.editable))} onChange={id=>{setEditId(id);setLabel(id?localizedContent(choices.categories.find(value=>value.id===id)!.name,locale):'');}} placeholder={t('class.new_category')}/>}
   <Input aria-label={t('class.label')} value={label} maxLength={100} onChange={e=>setLabel(e.target.value)} placeholder={t('class.label')}/>
   <p>{t('class.no_inference')}</p>
  </Modal>
 </section>;
}
