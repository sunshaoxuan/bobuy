import CategoryImage from '../components/CategoryImage';
import CategoryStructureTransfer from '../components/CategoryStructureTransfer';
import {useEffect, useState} from 'react';
import {Alert, Button, Empty, Input, Modal, Spin, TreeSelect, Upload} from 'antd';
import {categoryTreeApi, type CategoryTreeNode} from '../api';
import {useI18n} from '../i18n';
import {categoryName, categoryTreeData} from '../components/CategoryTreePicker';
import './categoryTreeManagement.css';

const locales = ['ja-JP', 'zh-CN', 'zh-TW', 'en-US'];
type Editor = {mode: 'add' | 'rename' | 'move'; node?: CategoryTreeNode; parent: string | null; names: Record<string, string>};

export default function CategoryTreeManagement() {
  const {t, locale} = useI18n();
  const [nodes, setNodes] = useState<CategoryTreeNode[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [editorError, setEditorError] = useState('');
  const [editor, setEditor] = useState<Editor>(), [deleting, setDeleting] = useState<CategoryTreeNode>();
  useEffect(() => {
    let active = true;
    categoryTreeApi.list().then(result => {if (active) setNodes(result);})
      .catch(() => {if (active) setError('categoryTree.loadFailed');}).finally(() => {if (active) setLoading(false);});
    return () => {active = false;};
  }, []);
  async function refresh() { setNodes(await categoryTreeApi.list()); }
  function open(next: Editor) { setEditor(next); setEditorError(''); setError(''); }
  async function save() {
    if (!editor || busy) return;
    setBusy(true); setEditorError('');
    try {
      const edit = {parentId: editor.parent, ...(editor.mode !== 'move' ? {name: editor.names} : {})};
      if (editor.node) await categoryTreeApi.update(editor.node.id, edit);
      else await categoryTreeApi.create({parentId: editor.parent, name: editor.names});
      setEditor(undefined);
      try {await refresh();} catch {setError('categoryTree.loadFailed');}
    } catch {setEditorError('categoryTree.failed');} finally {setBusy(false);}
  }
  async function reorder(node: CategoryTreeNode, position: number) {
    if (busy) return;
    setBusy(true); setError('');
    try {await categoryTreeApi.update(node.id, {parentId: node.parentId, sortOrder: position}); await refresh();}
    catch {setError('categoryTree.failed');} finally {setBusy(false);}
  }
  async function uploadImage(node:CategoryTreeNode,file:File) {
    if(busy)return;setBusy(true);setError('');
    try {const imageUrl=await categoryTreeApi.uploadImage(node.id,file);setNodes(current=>current.map(n=>n.id===node.id?{...n,imageUrl}:n));}
    catch {setError('categoryTree.imageFailed');} finally {setBusy(false);}
  }
  async function remove() {
    if (!deleting || busy) return;
    setBusy(true); setError('');
    try {await categoryTreeApi.remove(deleting.id); setDeleting(undefined); await refresh();}
    catch {setError('categoryTree.deleteBlocked'); setDeleting(undefined);} finally {setBusy(false);}
  }
  const ordered = [...nodes].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  const byId = new Map(nodes.map(node => [node.id, node]));
  const fullName = (node: CategoryTreeNode) => node.fullPath.map(id => byId.get(id)).filter((n): n is CategoryTreeNode => !!n).map(n => categoryName(n, locale)).join(' › ');
  function branch(parent: string | null, seen = new Set<string>()): React.ReactNode {
    const siblings = ordered.filter(node => node.parentId === parent && !seen.has(node.id));
    return <ul className="category-tree-branch">{siblings.map((node, index) => {
      const name = categoryName(node, locale);
      const blocked = node.deleteBlocked || node.productCount > 0 || nodes.some(n => n.parentId === node.id);
      return <li key={node.id}><article className="category-tree-row" aria-label={fullName(node)}>
        {node.parentId===null&&<div className="category-tree-image-editor">
          <CategoryImage src={node.imageUrl} className="category-tree-image-placeholder"/>
          <Upload accept="image/png,image/jpeg" showUploadList={false} disabled={busy} beforeUpload={file=>{void uploadImage(node,file);return false;}}><Button disabled={busy}>{t('categoryTree.imageUpload')}</Button></Upload>
          <p>{t('categoryTree.imageHelp')}</p>
        </div>}
        <div className="category-tree-label"><strong>{name}</strong><p>{fullName(node)}</p></div>
        <div className="category-tree-actions" role="group" aria-label={name}>
          <Button disabled={busy} onClick={() => open({mode: 'add', parent: node.id, names: {'ja-JP': ''}})}>{t('categoryTree.addChild')}</Button>
          <Button disabled={busy} onClick={() => open({mode: 'rename', node, parent: node.parentId, names: {...node.name}})}>{t('categoryTree.rename')}</Button>
          <Button disabled={busy} onClick={() => open({mode: 'move', node, parent: node.parentId, names: {...node.name}})}>{t('categoryTree.move')}</Button>
          <Button disabled={busy || index === 0} onClick={() => void reorder(node, index - 1)}>{t('categoryTree.moveUp')}</Button>
          <Button disabled={busy || index === siblings.length - 1} onClick={() => void reorder(node, index + 1)}>{t('categoryTree.moveDown')}</Button>
          <Button danger disabled={busy || blocked} onClick={() => setDeleting(node)}>{t('categoryTree.delete')}</Button>
        </div>
        {blocked && <p className="category-tree-blocked">{t('categoryTree.deleteBlocked')}</p>}
      </article>{nodes.some(n => n.parentId === node.id) && branch(node.id, new Set([...seen, node.id]))}</li>;
    })}</ul>;
  }
  const invalidName = editor?.mode !== 'move' && !editor?.names['ja-JP']?.trim();
  return <section className="category-tree-management">
    <header><div><h1>{t('categoryTree.title')}</h1><p>{t('categoryTree.help')}</p></div>
      <Button type="primary" disabled={busy || loading || !!error && nodes.length === 0} onClick={() => open({mode: 'add', parent: null, names: {'ja-JP': ''}})}>{t('categoryTree.addRoot')}</Button></header>
    <CategoryStructureTransfer onSaved={refresh} nodes={nodes}/>
    {error && <Alert type="error" showIcon message={t(error)} action={<Button disabled={busy} onClick={() => {setError(''); void refresh().catch(() => setError('categoryTree.loadFailed'));}}>{t('categoryTree.retry')}</Button>}/>}
    {loading ? <Spin aria-label={t('categoryTree.loading')}/> : nodes.length ? branch(null) : !error && <Empty description={t('categoryTree.empty')}/>}
    <Modal className="category-tree-dialog" open={!!editor} title={t(editor?.mode === 'move' ? 'categoryTree.move' : editor?.mode === 'rename' ? 'categoryTree.rename' : 'categoryTree.add')}
      okText={t('categoryTree.save')} cancelText={t('categoryTree.cancel')} confirmLoading={busy} closable={!busy} maskClosable={!busy}
      onOk={() => void save()} onCancel={() => {if (!busy) setEditor(undefined);}} okButtonProps={{disabled: !!invalidName}} cancelButtonProps={{disabled: busy}}>
      {editorError && <Alert type="error" message={t(editorError)}/>}
      {editor && editor.mode !== 'rename' && <label>{t('categoryTree.parent')}
        <TreeSelect aria-label={t('categoryTree.parent')} disabled={busy} allowClear treeDefaultExpandAll treeNodeLabelProp="label"
          treeData={categoryTreeData(nodes.filter(n => !editor.node || !n.fullPath.includes(editor.node.id)), locale)}
          value={editor.parent ?? undefined} placeholder={t('categoryTree.root')}
          onChange={value => setEditor({...editor, parent: value ?? null})}/></label>}
      {editor && editor.mode !== 'move' && <><p>{t('categoryTree.translationHelp')}</p>{locales.map(code => <label key={code}>{t('categoryTree.name.' + code)}
        <Input aria-label={t('categoryTree.name.' + code)} disabled={busy} maxLength={200} value={editor.names[code] ?? ''}
          onChange={event => setEditor({...editor, names: {...editor.names, [code]: event.target.value}})}/></label>)}</>}
      {invalidName && <p>{t('categoryTree.nameRequired')}</p>}
    </Modal>
    <Modal className="category-tree-dialog" open={!!deleting} title={t('categoryTree.deleteConfirm')} okText={t('categoryTree.delete')}
      cancelText={t('categoryTree.cancel')} okButtonProps={{danger: true}} confirmLoading={busy} cancelButtonProps={{disabled: busy}}
      closable={!busy} maskClosable={!busy} onOk={() => void remove()} onCancel={() => {if (!busy) setDeleting(undefined);}}><p>{deleting && fullName(deleting)}</p></Modal>
  </section>;
}
