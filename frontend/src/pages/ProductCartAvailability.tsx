import { useState } from 'react';
import { Alert, Button, Modal, Switch, message } from 'antd';
import { api, type CartAvailabilityPreview } from '../api';
import { useI18n } from '../i18n';

export function ProductCartSwitch({id, name, enabled, onChange}: {
  id: string;
  name: string;
  enabled?: boolean;
  onChange: (ids: string[], enabled: boolean) => void;
}) {
  const {t} = useI18n();
  const [saving, setSaving] = useState(false);
  const [notifications, notificationHolder] = message.useMessage();
  async function change(next: boolean) {
    setSaving(true);
    try {
      const response = await api.patchProduct(id, {cartEnabled: next});
      onChange([id], response.product.cartEnabled === true);
    } catch {
      notifications.error(t('cart.availability_save_error'));
    } finally {
      setSaving(false);
    }
  }

  return <span className="product-cart-field">
    {notificationHolder}
    <span>{t('cart.availability_label')}</span>
    <Switch className="product-cart-switch" aria-label={t('cart.availability_label') + ' ' + name}
      checked={enabled === true} disabled={enabled === undefined} loading={saving} onChange={change} />
  </span>;
}

export function ProductCartBulkAction({allEnabled, onPreview, onChange}: {
  allEnabled: boolean;
  onPreview: (count: number) => void;
  onChange: (ids: string[], enabled: boolean) => void;
}) {
  const {t, locale} = useI18n();
  const [preview, setPreview] = useState<CartAvailabilityPreview>();
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [needsPreview, setNeedsPreview] = useState(false);
  const [notifications, notificationHolder] = message.useMessage();

  async function loadPreview() {
    setOpening(true);
    try {
      const result = await api.previewCartAvailability();
      setPreview(result);
      onPreview(result.count);
      setNeedsPreview(false);
    } catch {
      notifications.error(t('cart.availability_preview_error'));
    } finally {
      setOpening(false);
    }
  }

  async function confirm() {
    if (!preview?.count || needsPreview) return;
    setSaving(true);
    try {
      const result = await api.enableCartAvailability(preview.revision);
      onChange(result.enabledIds, true);
      setPreview(undefined);
    } catch {
      setNeedsPreview(true);
    } finally {
      setSaving(false);
    }
  }

  return <>
    {notificationHolder}
    <Button className="product-cart-bulk" loading={opening && !preview} onClick={loadPreview}>
      {t(allEnabled ? 'cart.availability_none' : 'cart.availability_bulk')}
    </Button>
    <Modal title={t('cart.availability_bulk')} className="product-cart-preview"
      open={!!preview} onCancel={() => { if (!saving && !opening) setPreview(undefined); }}
      width={520} closable={!saving && !opening} keyboard={!saving && !opening} maskClosable={false}
      footer={<div className="product-cart-preview-actions">
        <Button disabled={saving || opening} onClick={() => setPreview(undefined)}>{t('common.cancel')}</Button>
        {needsPreview
          ? <Button type="primary" loading={opening} onClick={loadPreview}>{t('cart.availability_refresh')}</Button>
          : <Button type="primary" disabled={!preview?.count} loading={saving} onClick={confirm}>
              {t('cart.availability_confirm')}
            </Button>}
      </div>}>
      {needsPreview && <Alert type="warning" showIcon message={t('cart.availability_stale')} />}
      {preview && (preview.count ? <>
        <p>{t('cart.availability_preview_count', {count: preview.count})}</p>
        <ul className="product-cart-preview-items">{preview.items.map(item =>
          <li key={item.id}>
            <span>{item.name[locale] || Object.values(item.name).find(Boolean) || item.itemNumber || t('cart.availability_unnamed')}</span>
            {item.itemNumber && <small>{item.itemNumber}</small>}
          </li>
        )}</ul>
      </> : <p role="status">{t('cart.availability_none')}</p>)}
    </Modal>
  </>;
}
