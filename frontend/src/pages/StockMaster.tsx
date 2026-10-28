import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Table,
  Input,
  InputNumber,
  Button,
  Space,
  Typography,
  Tag,
  message,
  notification,
  Breadcrumb,
  Card,
  Drawer,
  Form,
  Grid,
  Select,
  Radio,
  Tabs,
  Row,
  Col,
  Checkbox
  ,Segmented
} from 'antd';
import {
  PlusOutlined,
  SaveOutlined,
  DeleteOutlined,
  InboxOutlined,
  EditOutlined,
  SearchOutlined,
  DollarOutlined,
  DatabaseOutlined,
  CameraOutlined,PictureOutlined
} from '@ant-design/icons';
import { useI18n } from '../i18n';
import L10nInput, { type L10nValues } from '../components/L10nInput';
import MediaGallery, { type MediaItem } from '../components/MediaGallery';
import AiQuickAddModal from '../components/AiQuickAddModal';
import ProductCatalogPanel from '../components/ProductCatalogPanel';
import ProductPricingPanel from '../components/ProductPricingPanel';
import { api, type CategoryAttributeTemplateField, type MobileCategory, type MobileSupplier, type AiOnboardingSuggestion } from '../api';
import './productRecords.css';

const { Title, Text } = Typography;

interface StockItem {
  catalogDriven?:boolean;
  key: string;
  name: string;
  nameL10n?: L10nValues;
  category: string;
  price: number;
  actualSale?:import('../api').ProductSale;
  stock: number;
  unit: string;
  description?: string;
  descriptionL10n?: L10nValues;
  brand?: string;
  sku?: string;
  mediaGallery?: MediaItem[];
  dynamicAttributes?: Record<string, string | number>;
  merchantSkus?: Record<string, string>;
  storageCondition?: 'AMBIENT' | 'CHILLED';
  orderMethod?: 'PRE_ORDER' | 'DIRECT_BUY';
  priceTiers?: { tierName: string; price: number; currency: string; agentOnly: boolean }[];
  isNew?: boolean;
  suggestion?: AiOnboardingSuggestion;
}

type MerchantSkuEntry = {
  merchant?: string;
  sku?: string;
};

type ReconcileResponse = {
  reconciledQuantity?: number;
  reconciledTripId?: number;
  allocatedBusinessIds?: string[];
};

const AUTOSAVE_DELAY_MS = 500;
const MOBILE_DRAWER_HEIGHT = '82vh';
const MOBILE_TOOLBAR_COMPACT_SCROLL_THRESHOLD = 24;
const MOBILE_DYNAMIC_GUTTER = 16;
const DESKTOP_DYNAMIC_GUTTER = 8;
const DEFAULT_STOCK_THUMBNAIL = '/assets/products/milk.png';

const PRICE_FRACTION_DIGITS = 2;
const MOBILE_BOTTOM_PADDING = '7rem';
const DESKTOP_BOTTOM_PADDING = '5rem';
const normalizeTokens = (value: string) => value.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/i).filter(Boolean);

const matchesByName = (input: string, candidate: string) => {
  const normalizedInput = input.trim().toLowerCase();
  const normalizedCandidate = candidate.trim().toLowerCase();
  if (!normalizedInput || !normalizedCandidate) {
    return false;
  }
  if (normalizedInput === normalizedCandidate || normalizedInput.includes(normalizedCandidate)) {
    return true;
  }
  const inputTokens = normalizeTokens(normalizedInput);
  const candidateTokens = normalizeTokens(normalizedCandidate);
  return candidateTokens.every((token) => inputTokens.includes(token));
};

const resolveCategoryTemplate = (categoryInput: string | undefined, categories: MobileCategory[]): CategoryAttributeTemplateField[] => {
  if (!categoryInput) {
    return [];
  }
  const normalized = categoryInput.trim().toLowerCase();
  const matchedCategory = categories.find((category) => {
    if (category.id.toLowerCase() === normalized) {
      return true;
    }
    return Object.values(category.name ?? {}).some((name) => matchesByName(normalized, name));
  });
  return matchedCategory?.attributeTemplate ?? [];
};

const mapMerchantSkusToEntries = (merchantSkus?: Record<string, string>): MerchantSkuEntry[] => {
  if (!merchantSkus) {
    return [];
  }
  return Object.entries(merchantSkus).map(([merchant, sku]) => ({ merchant, sku }));
};

const mapEntriesToMerchantSkus = (entries?: MerchantSkuEntry[]): Record<string, string> => {
  if (!entries) {
    return {};
  }
  return entries.reduce<Record<string, string>>((acc, entry) => {
    const merchant = entry.merchant?.trim();
    const sku = entry.sku?.trim();
    if (merchant && sku) {
      acc[merchant] = sku;
    }
    return acc;
  }, {});
};

const getFieldLabel = (field: CategoryAttributeTemplateField, translate: (key: string) => string) => {
  if (field.labelKey) {
    return translate(field.labelKey);
  }
  return field.label ?? field.key;
};

const CATEGORY_FIELD_TYPE_OPTIONS: readonly CategoryAttributeTemplateField['type'][] = ['text', 'number', 'select'];

const normalizeStructuredAttributes = (attributes?: Record<string, string | number | undefined | null>): Record<string, string> =>
  Object.entries(attributes ?? {}).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value === undefined || value === null) {
      return acc;
    }
    const normalized = String(value).trim();
    if (!normalized) {
      return acc;
    }
    acc[key] = normalized;
    return acc;
  }, {});

const isValidCategoryFieldType = (value: string): value is CategoryAttributeTemplateField['type'] =>
  CATEGORY_FIELD_TYPE_OPTIONS.includes(value as CategoryAttributeTemplateField['type']);

const normalizeCategoryTemplate = (template: any[] | undefined): CategoryAttributeTemplateField[] => {
  if (!Array.isArray(template)) return [];
  return template
    .filter(f => f && f.key && f.type)
    .map(f => ({
      key: f.key,
      type: f.type,
      labelKey: f.labelKey,
      label: f.label,
      options: Array.isArray(f.options) ? f.options : undefined
    }));
};

const normalizeCategories = (categories: MobileCategory[]): MobileCategory[] =>
  categories?.map(category => ({
    ...category,
    attributeTemplate: normalizeCategoryTemplate(category.attributeTemplate)
  })) || [];

export default function StockMaster({embedded=false,refreshKey=0,onDeleted}:{embedded?:boolean;refreshKey?:number;onDeleted?:()=>void}={}) {
  const { t, locale } = useI18n();
  const [categories, setCategories] = useState<MobileCategory[]>([]);
  const [suppliers, setSuppliers] = useState<MobileSupplier[]>([]);
  const [searchText, setSearchText] = useState('');
  const [recordView,setRecordView]=useState<'gallery'|'manage'>(embedded?'gallery':'manage');
  const [toolbarCompact, setToolbarCompact] = useState(false);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [isQuickAddVisible, setIsQuickAddVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [activeTabKey, setActiveTabKey] = useState<string>('basic');
  const [form] = Form.useForm();
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDrawerOpenRef = useRef(false);
  const watchedCategory = Form.useWatch('category', form);
  const activeCategoryAttributes = useMemo(
    () => resolveCategoryTemplate(watchedCategory, categories),
    [watchedCategory, categories]
  );

  useEffect(() => {
    let cancelled = false;
    api.stockCategories().then((result) => {
      if (cancelled) {
        return;
      }
      setCategories(normalizeCategories(result));
    });
    api.suppliers().then((result) => {
      if (cancelled) {
        return;
      }
      setSuppliers(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const clearAutosaveTimer = () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  };

  useEffect(() => {
    isDrawerOpenRef.current = isDrawerVisible;
  }, [isDrawerVisible]);

  useEffect(() => {
    if (!isMobile) {
      setToolbarCompact(false);
      return;
    }
    const onScroll = () => setToolbarCompact(window.scrollY > MOBILE_TOOLBAR_COMPACT_SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isMobile]);

  const [dataSource, setDataSource] = useState<StockItem[]>([]);
  const [catalogId,setCatalogId]=useState<string|undefined>(()=>new URLSearchParams(window.location.search).get('product')||undefined);
  const [pricingId,setPricingId]=useState<string>();

  useEffect(() => {
    let cancelled = false;
    api.products().then((result) => {
      if (cancelled) return;
      const mapped: StockItem[] = result.map(res => ({
        key: res.product.id,
        catalogDriven:!!(res.product as unknown as {catalogData?:unknown}).catalogData,
        name: res.displayName,
        nameL10n: res.product.name,
        category: res.product.categoryId || '',
        price: res.product.basePrice,
        actualSale:(res.product as unknown as {sale?:import('../api').ProductSale}).sale,
        stock: 0, // Placeholder
        unit: 'pc',
        description: res.displayDescription,
        descriptionL10n: res.product.description,
        brand: res.product.brand,
        sku: res.product.itemNumber,
        mediaGallery: res.product.mediaGallery?.map((m, i) => ({
          id: `${res.product.id}-${i}`,
          url: m.url,
          type: m.type?.toLowerCase()==='video'?'video':'image',
          title: m.title
        })) || [],
        priceTiers: res.product.priceTiers || [],
        dynamicAttributes: normalizeStructuredAttributes(res.product.attributes),
        isNew: false
      }));
      setDataSource(mapped);
    });
    return () => { cancelled = true; };
  }, [refreshKey]);


  const getLocalizedFallback = (values?: L10nValues, fallback?: string) => {
    if (!values) {
      return fallback ?? '';
    }
    return values[locale] || values['zh-CN'] || values['ja-JP'] || values['en-US'] || Object.values(values).find(Boolean) || fallback || '';
  };

  const formatPrice = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'JPY',
        minimumFractionDigits: PRICE_FRACTION_DIGITS,
        maximumFractionDigits: PRICE_FRACTION_DIGITS
      }),
    [locale]
  );

  const getStockThumbnail = (item: StockItem): string => item.mediaGallery?.find((media) => media.type === 'image')?.url ?? DEFAULT_STOCK_THUMBNAIL;

  const requestTranslationSuggestion = async (sourceText: string, _sourceLocale: string, targetLocale: string) => {
    if (!sourceText.trim()) {
      return '';
    }
    try {
      const result = await api.translate(sourceText, targetLocale);
      return result.translatedText;
    } catch {
      return `[Fallback] ${sourceText}`;
    }
  };

  const handleAddRow = () => {
    setRecordView('manage');
    const newData: StockItem = {
      key: Date.now().toString(),
      name: '',
      category: '',
      price: 0,
      stock: 0,
      unit: 'pc',
      isNew: true
    };
    setDataSource([...dataSource, newData]);
    if (isMobile) {
      openDrawer(newData);
    }
  };

  const handleDelete = async (key: string) => {
    try {
      await api.deleteProduct(key);
      setDataSource(dataSource.filter((item) => item.key !== key));
      onDeleted?.();
      message.success(t('stock.msg.deleted'));
    } catch (err) {
      console.error('Delete failed:', err);
      message.error(t('stock.msg.delete_failed'));
    }
  };

  const handleFieldChange = (key: string, field: keyof StockItem, value: any) => {
    const newData = [...dataSource];
    const index = newData.findIndex((item) => key === item.key);
    if (index > -1) {
      const updatedItem = { ...newData[index], [field]: value };
      newData[index] = updatedItem;
      setDataSource(newData);
      
      // Auto-save on table change
      clearAutosaveTimer();
      autosaveTimerRef.current = setTimeout(() => {
        syncItemToBackend(updatedItem);
      }, AUTOSAVE_DELAY_MS);
    }
  };

  const handleQuickAddSuccess = async (suggestion: AiOnboardingSuggestion) => {
    // 1. Immediately call backend to confirm/persist to prevent data loss
    const hide = message.loading(t('stock.master.publishing'), 0);
    try {
      const response = await api.onboardConfirm(suggestion) as any;
      const product = response.product;
      handleReconcileFeedback(response);

      // 2. Map the response (now with real DB ID) back to the UI
      const newItem: StockItem = {
        key: product.id,
        name: response.displayName,
        nameL10n: product.name,
        category: product.categoryId || '',
        price: product.basePrice,
        stock: 0,
        unit: 'pc',
        description: response.displayDescription,
        descriptionL10n: product.description,
        brand: product.brand,
        sku: product.itemNumber,
        // @ts-ignore
        mediaGallery: (product.mediaGallery?.map((m: any, i: number) => ({
           id: `${product.id}-${i}`,
           url: m.url,
           type: (m.type as 'image' | 'video') || 'image',
           title: m.title || {}
        })) || []) as MediaItem[],
        priceTiers: product.priceTiers || [],
        dynamicAttributes: normalizeStructuredAttributes(product.attributes),
        isNew: false // Mark as NOT new (already synced)
      };
      
      setDataSource([newItem, ...dataSource]);
      message.success(t('stock.msg.published'));
      
      // Open drawer for further refinement if needed
      openDrawer(newItem);
    } catch (err) {
      console.error('[Auto-save] Failed:', err);
      message.error(t('stock.master.publish_failed'));
      
      // Fallback: add to local state as 'New' so user can try again
      const fallbackItem: StockItem = {
        key: `suggest-${Date.now()}`,
        name: suggestion.name,
        category: suggestion.categoryId || '',
        price: suggestion.price || 0,
        stock: 0,
        unit: 'pc',
        description: suggestion.description,
        brand: suggestion.brand,
        sku: suggestion.itemNumber,
        // @ts-ignore
        mediaGallery: (suggestion.mediaGallery?.map((m: any, i: number) => ({
           id: `media-${i}`,
           url: m.url,
           type: (m.type as 'image' | 'video') || 'image',
           title: m.title || { 'zh-CN': '', 'ja-JP': '', 'en-US': '' },
           visible: true
        })) || []) as MediaItem[],
        priceTiers: suggestion.detectedPriceTiers || [],
        dynamicAttributes: normalizeStructuredAttributes(suggestion.attributes),
        isNew: true,
        suggestion: suggestion
      };
      setDataSource([fallbackItem, ...dataSource]);
      openDrawer(fallbackItem);
    } finally {
      hide();
      setIsQuickAddVisible(false);
    }
  };

  const syncItemToBackend = async (item: StockItem) => {
    setSyncStatus('saving');
    // Preparation: Map current UI state to a suggestion/patch object
    const suggestion: AiOnboardingSuggestion = {
      name: item.name,
      price: item.price,
      itemNumber: item.sku,
      categoryId: item.category,
      brand: item.brand,
      description: item.description,
      attributes: normalizeStructuredAttributes(item.dynamicAttributes),
      // @ts-ignore
      mediaGallery: item.mediaGallery?.map(m => ({ url: m.url, type: m.type, title: m.title, visible: m.visible !== false })),
      detectedPriceTiers: item.priceTiers,
      storageCondition: item.storageCondition,
      orderMethod: item.orderMethod,
      originalPhotoBase64: item.suggestion?.originalPhotoBase64
    };

    try {
      if (item.isNew) { 
        const response = await api.onboardConfirm(suggestion) as any;
        handleReconcileFeedback(response);
        // Update item key and status in background
        setDataSource(prev => prev.map(it => it.key === item.key ? { ...it, key: response.product?.id || item.key, isNew: false } : it));
        setSyncStatus('saved');
      } else {
        // Existing product update via Patch
        await api.onboardConfirm({ ...suggestion, existingProductFound: true, existingProductId: item.key });
        setSyncStatus('saved');
      }
    } catch (err) {
      console.error('[Sync] Failed:', err);
      setSyncStatus('idle');
      // message.error('Background sync failed');
    }
  };

  const hasReconciliationToNotify = (response: ReconcileResponse, ids: string[]) =>
    (response?.reconciledQuantity ?? 0) > 0 && ids.length > 0;

  const handleReconcileFeedback = (response: ReconcileResponse) => {
    const ids = response?.allocatedBusinessIds ?? [];
    if (!hasReconciliationToNotify(response, ids)) {
      return;
    }
    notification.success({
      message: `${t('procurement.reconcile_notice_prefix')} [${ids.join(', ')}]`
    });
    window.dispatchEvent(new CustomEvent('procurement:reconciled', { detail: { tripId: response.reconciledTripId } }));
  };

  const openDrawer = (record: StockItem, defaultTab?: string) => {
    setEditingItem(record);
    form.setFieldsValue({
      ...record,
      nameL10n: record.nameL10n ?? { 'zh-CN': record.name, 'ja-JP': record.name, 'en-US': record.name },
      descriptionL10n: record.descriptionL10n ?? { 'zh-CN': record.description ?? '', 'ja-JP': record.description ?? '', 'en-US': record.description ?? '' },
      mediaGallery: record.mediaGallery ?? [],
      dynamicAttributes: record.dynamicAttributes ?? {},
      merchantSkuEntries: mapMerchantSkusToEntries(record.merchantSkus)
    });
    setActiveTabKey(defaultTab ?? 'basic');
    setIsDrawerVisible(true);
    setSyncStatus('idle');
  };

  const closeDrawer = () => {
    clearAutosaveTimer();
    setIsDrawerVisible(false);
    setEditingItem(null);
    setSyncStatus('idle');
    form.resetFields();
  };

  const saveEditingItem = (values: Partial<StockItem>, options: { closeAfterSave: boolean; showMessage: boolean }) => {
    if (!editingItem) {
      return;
    }
    setDataSource((prevData) => {
      const index = prevData.findIndex((item) => editingItem.key === item.key);
      if (index < 0) return prevData;
      
      const nextData = [...prevData];
      const currentItem = nextData[index];
      const rawValues = values as Partial<StockItem> & { merchantSkuEntries?: MerchantSkuEntry[] };
      const { merchantSkuEntries, ...safeValues } = rawValues;
      const merchantSkus = mapEntriesToMerchantSkus(merchantSkuEntries);
      const nextNameL10n: L10nValues = values.nameL10n ?? currentItem.nameL10n ?? {};
      const nextDescriptionL10n: L10nValues = values.descriptionL10n ?? currentItem.descriptionL10n ?? {};
      
      const updatedItem = {
        ...currentItem,
        ...safeValues,
        nameL10n: nextNameL10n,
        descriptionL10n: nextDescriptionL10n,
        name: getLocalizedFallback(nextNameL10n, currentItem.name),
        description: getLocalizedFallback(nextDescriptionL10n, currentItem.description),
        mediaGallery: values.mediaGallery ?? currentItem.mediaGallery ?? [],
        priceTiers: values.priceTiers ?? currentItem.priceTiers ?? [],
        dynamicAttributes: values.dynamicAttributes ?? currentItem.dynamicAttributes ?? {},
        merchantSkus
      };
      
      nextData[index] = updatedItem;
      
      // Background sync to backend
      syncItemToBackend(updatedItem);
      
      return nextData;
    });

    if (options.showMessage) {
      message.success(t('stock.drawer.update_success'));
    }
    
    if (options.closeAfterSave) {
      closeDrawer();
    }
  };

  const handleDrawerSave = () => {
    form.validateFields().then((values) => {
      saveEditingItem(values, { closeAfterSave: true, showMessage: true });
    });
  };

  const handleDrawerValuesChange = (_changedValues: Record<string, unknown>, _allValues: Record<string, unknown>) => {
    if (!isMobile || !editingItem) {
      return;
    }
    setSyncStatus('saving');
    clearAutosaveTimer();
    autosaveTimerRef.current = setTimeout(() => {
      if (!isDrawerOpenRef.current) {
        clearAutosaveTimer();
        return;
      }
      saveEditingItem(form.getFieldsValue(true), { closeAfterSave: false, showMessage: false });
      setSyncStatus('saved');
      clearAutosaveTimer();
    }, AUTOSAVE_DELAY_MS);
  };

  useEffect(() => {
    return () => {
      clearAutosaveTimer();
    };
  }, []);

  const filteredData = dataSource.filter(
    (item) => item.name.toLowerCase().includes(searchText.toLowerCase()) || (item.sku && item.sku.toLowerCase().includes(searchText.toLowerCase()))
  );

  const columns = [
    {
      title: t('stock.item.name'),
      dataIndex: 'name',
      width: 220,
      render: (text: string, record: StockItem) => (
        <Input value={text} placeholder={t('stock.item.name_input_placeholder')} onChange={(e) => handleFieldChange(record.key, 'name', e.target.value)} />
      )
    },
    {
      title: t('stock.item.sku'),
      dataIndex: 'sku',
      width: '8rem',
      render: (text: string, record: StockItem) => (
        <Input value={text} placeholder={t('stock.item.sku_placeholder')} onChange={(e) => handleFieldChange(record.key, 'sku', e.target.value)} />
      )
    },
    {
      title: t('stock.item.category'),
      dataIndex: 'category',
      width: 150,
      render: (text: string, record: StockItem) => (
        <Input value={text} placeholder={t('stock.item.category_input_placeholder')} onChange={(e) => handleFieldChange(record.key, 'category', e.target.value)} />
      )
    },
    {
      title: t('stock.item.price')+' (JPY)',
      dataIndex: 'price',
      width: '8rem',
      render: (val: number, record: StockItem) => (
        <InputNumber value={val} prefix="JPY ¥" style={{ width: '100%' }} onChange={(v) => handleFieldChange(record.key, 'price', v)} />
      )
    },
    {
      title: t('sale.actual'),
      key:'actualSale',
      render:(_:unknown,record:StockItem)=>record.actualSale?<span>{record.actualSale.currency} {record.actualSale.amount.toLocaleString(locale)} / {record.actualSale.unit}</span>:<span>{t('sale.pending')}</span>
    },
    {
      title: t('stock.item.quantity'),
      dataIndex: 'stock',
      width: '7rem',
      render: (val: number, record: StockItem) => (
        <InputNumber value={val} style={{ width: '100%' }} onChange={(v) => handleFieldChange(record.key, 'stock', v)} />
      )
    },
    {
      title: t('stock.table.status'),
      key: 'status',
      width: '7rem',
      render: (_: any, record: StockItem) =>
        record.isNew ? <Tag color="orange">{t('stock.status.new')}</Tag> : <Tag color="blue">{t('stock.status.modified')}</Tag>
    },
    {
      title: t('stock.table.action'),
      key: 'action',
      width: '8rem',
      render: (_: any, record: StockItem) => (
        <Space>
          <Button size="small" disabled={record.isNew} onClick={()=>setCatalogId(record.key)}>{t('master.title')}</Button>
          <Button size="small" disabled={record.isNew} onClick={()=>setPricingId(record.key)}>{t('pricing.title')}</Button>
          <Button type="text" icon={<EditOutlined />} onClick={() => record.catalogDriven?setCatalogId(record.key):openDrawer(record)} />
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.key)} />
        </Space>
      )
    }
  ];

  const renderMobileCards = () => (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      {filteredData.map((item) => {
        const image = getStockThumbnail(item);
        const localizedTitle = getLocalizedFallback(item.nameL10n, item.name);
        return (
          <Card key={item.key} className="stock-mobile-card app-shadow-low">
            <div className="stock-mobile-card-body">
              <img src={image} alt={localizedTitle} className="stock-mobile-thumb" />
              <div className="stock-mobile-main">
                <Text strong className="stock-mobile-title">
                  {localizedTitle}
                </Text>
                  <Space size={8} wrap>
                    <Tag color={item.isNew ? 'orange' : 'blue'}>{item.isNew ? t('stock.status.new') : t('stock.status.modified')}</Tag>
                    {item.sku ? <Text type="secondary">{t('stock.item.sku')}: {item.sku}</Text> : null}
                    {item.dynamicAttributes?.netContent ? <Tag>{`${t('stock.item.net_content')}: ${item.dynamicAttributes.netContent}`}</Tag> : null}
                    {item.dynamicAttributes?.packSize ? <Tag>{`${t('stock.item.pack_size')}: ${item.dynamicAttributes.packSize}`}</Tag> : null}
                  </Space>
              </div>
              <div className="stock-mobile-side">
                <Text className="stock-mobile-metric">
                  <DollarOutlined /> {formatPrice.format(item.price)}
                </Text>
                <Text className="stock-mobile-metric">
                  <DatabaseOutlined /> {item.stock}
                </Text>
                <Space size={4}>
                  <Button size="small" disabled={item.isNew} onClick={()=>setCatalogId(item.key)}>{t('master.title')}</Button>
                  <Button size="small" disabled={item.isNew} onClick={()=>setPricingId(item.key)}>{t('pricing.title')}</Button>
                  <Button type="text" icon={<EditOutlined />} onClick={() => item.catalogDriven?setCatalogId(item.key):openDrawer(item)} aria-label={t('stock.master.edit_detail')} />
                  <Button type="text" danger icon={<DeleteOutlined />} onClick={() => handleDelete(item.key)} aria-label={t('stock.master.discard')} />
                </Space>
              </div>
            </div>
          </Card>
        );
      })}
      {filteredData.length === 0 ? (
        <Card className="stock-mobile-card app-shadow-low">
          <Space direction="vertical" align="center" style={{ width: '100%', padding: '1.5rem 0' }}>
            <InboxOutlined style={{ fontSize: '1.75rem', color: '#d9d9d9' }} />
            <Text type="secondary">{t('stock.empty')}</Text>
          </Space>
        </Card>
      ) : null}
    </Space>
  );

  return (
    <div className={embedded?'product-records-workspace':undefined} style={{ padding: isMobile ? `0 0 ${MOBILE_BOTTOM_PADDING} 0` : `0 0 ${DESKTOP_BOTTOM_PADDING} 0` }}>
      {!embedded&&<Breadcrumb style={{ marginBottom: '1rem' }} items={[{ title: t('nav.dashboard') }, { title: t('products.title') }]} />}
      <ProductCatalogPanel id={catalogId} onChoose={setCatalogId} entries={dataSource.filter(row=>!row.isNew)} onSaved={values=>setDataSource(prior=>prior.map(row=>{const value=values.find(v=>v.productId===row.key);return value?{...row,catalogDriven:true,name:getLocalizedFallback(value.name,row.name),nameL10n:value.name,description:getLocalizedFallback(value.description,''),descriptionL10n:value.description,brand:value.brand??undefined,sku:value.itemNumber??undefined,category:value.categoryIds[0]??'',mediaGallery:value.gallery.map(p=>({id:p.sha256||p.url,url:p.url,type:p.type==='VIDEO'?'video' as const:'image' as const,title:p.title,visible:p.visible}))}:row;}))}/>

      <div className={`stock-toolbar ${isMobile ? 'stock-toolbar-mobile' : ''} ${toolbarCompact ? 'stock-toolbar-compact' : ''}`}>
        <div style={{ minWidth: 0 }}>
          <Title level={3} style={{ margin: 0 }} className="stock-page-title" data-testid="stock-master-title">
            {t(embedded?'products.collection':'stock.master.title')}{embedded&&<span className="record-count">{filteredData.length}</span>}
          </Title>
          <Text type="secondary">{t(embedded?'products.collection_hint':'stock.master.subtitle')}</Text>
        </div>

        {isMobile ? (
          <Space direction="vertical" style={{ width: '100%' }} size={8}>
            <Input
              placeholder={t('stock.master.search_placeholder')}
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <Space style={{ width: '100%' }}>
              <Space style={{ width: '100%' }}>
                <Button type="default" icon={<PlusOutlined />} onClick={handleAddRow} block data-testid="stock-master-add-row">
                  {t('stock.master.add_row')}
                </Button>
                <Button data-testid="ai-quick-snap-button" type="primary" icon={<CameraOutlined />} onClick={() => setIsQuickAddVisible(true)} block>
                  {t('stock.master.quick_snap')}
                </Button>
              </Space>
            </Space>
          </Space>
        ) : (
          <Space direction={embedded?'horizontal':'vertical'} align={embedded?'center':'end'} size={12} wrap={embedded}>
            <Input
              placeholder={t('stock.master.search_placeholder')}
              prefix={<SearchOutlined />}
              style={{ width: 'min(20rem, 100%)' }}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
              <Space wrap>
                <Text type="secondary" style={{ marginRight: 12 }}>
                  {syncStatus === 'saving' ? t('stock.drawer.sync.saving') : 
                   syncStatus === 'saved' ? t('stock.drawer.sync.saved') : ''}
                </Text>
                <Button type="default" icon={<PlusOutlined />} onClick={handleAddRow} data-testid="stock-master-add-row">
                  {t('stock.master.add_row')}
                </Button>
                <Button data-testid="ai-quick-snap-button" type="primary" icon={<CameraOutlined />} onClick={() => setIsQuickAddVisible(true)}>
                  {t('stock.master.quick_snap')}
                </Button>
              </Space>
          </Space>
        )}
      </div>

      {embedded&&<div className="record-view-bar"><Segmented aria-label={t('products.view')} value={recordView} onChange={value=>setRecordView(value as 'gallery'|'manage')} options={[{label:t('products.gallery'),value:'gallery'},{label:t('products.manage'),value:'manage'}]}/><span>{t('products.original_images')}</span></div>}

      <ProductPricingPanel id={pricingId} onClose={()=>setPricingId(undefined)} onSaved={sheet=>setDataSource(prior=>prior.map(row=>row.key===sheet.productId?{...row,actualSale:sheet.regular??undefined}:row))}/>
      {embedded&&recordView==='gallery'?<div className="product-record-grid">{filteredData.map(item=>{
        const image=item.mediaGallery?.find(media=>media.type==='image')?.url;
        const name=getLocalizedFallback(item.nameL10n,item.name);
        const category=categories.find(c=>c.id===item.category);
        return <article className="product-record-pin" key={item.key}>
          <button className="record-cover" onClick={()=>setCatalogId(item.key)} aria-label={t('store.detail_label',{name})}>
            {image?<img src={image} alt={name} loading="lazy"/>:<span className="record-no-image"><InboxOutlined/>{t('gallery.pending')}</span>}
            {!!item.mediaGallery?.length&&<span className="record-image-count"><PictureOutlined/> {item.mediaGallery.length}</span>}
          </button>
          <div className="record-caption"><div className="record-meta"><span>{item.sku||t('rec.not_stated')}</span><span>{t(item.isNew?'stock.status.new':'stock.status.modified')}</span></div>
            <button className="record-title" onClick={()=>setCatalogId(item.key)}><h3>{name}</h3></button>
            <p>{category?getLocalizedFallback(category.name):item.brand||t('master.title')}</p>
            <div className="record-sale-state">{item.actualSale?`${item.actualSale.currency} ${item.actualSale.amount}`:t('sale.pending')}</div>
            <div className="record-card-actions"><Button onClick={()=>setCatalogId(item.key)}>{t('master.title')}</Button><Button type="text" onClick={()=>setPricingId(item.key)}>{t('pricing.title')}</Button><Button type="text" danger icon={<DeleteOutlined/>} aria-label={t('trash.remove')+' '+name} onClick={()=>handleDelete(item.key)}/></div>
          </div>
        </article>;
      })}{filteredData.length===0&&<div className="record-empty"><InboxOutlined/><p>{t('stock.empty')}</p></div>}</div>:isMobile ? (
        renderMobileCards()
      ) : (
        <Card styles={{ body: { padding: 0 } }} style={{ overflow: 'hidden', borderRadius: '0.75rem' }} className="app-shadow-medium">
          <Table
            dataSource={filteredData}
            columns={columns}
            scroll={{x:1400}}
            pagination={false}
            locale={{
              emptyText: (
                <div style={{ padding: '2.5rem' }}>
                  <InboxOutlined style={{ fontSize: '2rem', color: '#d9d9d9' }} />
                  <p>{t('stock.empty')}</p>
                </div>
              )
            }}
          />
        </Card>
      )}

      <Drawer
        rootClassName="stock-drawer"
        title={
          <Space direction="vertical" size={0}>
            <span>{t('stock.drawer.title')}</span>
            {isMobile && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {syncStatus === 'saving'
                  ? t('stock.drawer.sync.saving')
                  : syncStatus === 'saved'
                  ? t('stock.drawer.sync.saved')
                  : t('stock.drawer.sync.ready')}
              </Text>
            )}
          </Space>
        }
        width={isMobile ? undefined : 400}
        height={isMobile ? MOBILE_DRAWER_HEIGHT : undefined}
        placement={isMobile ? 'bottom' : 'right'}
        onClose={closeDrawer}
        open={isDrawerVisible}
        destroyOnClose={true}
        extra={
          isMobile ? null : (
            <Space>
               <Button onClick={closeDrawer}>{t('common.cancel')}</Button>
              <Button onClick={handleDrawerSave} type="primary">
                {t('stock.drawer.save')}
              </Button>
            </Space>
          )
        }
      >
        <Form form={form} layout="vertical" onValuesChange={handleDrawerValuesChange}>
          {isMobile && (
            <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
              {t('stock.drawer.autosave_hint')}
            </Text>
          )}
          <Tabs
            activeKey={activeTabKey}
            onChange={setActiveTabKey}
            items={[
              {
                key: 'basic',
                label: t('stock.tabs.basic'),
                children: (
                  <>
                    <Form.Item name="nameL10n" label={`${t('stock.item.name')} (L10n)`} rules={[{ required: true }]}>
                      <L10nInput
                         locales={['zh-CN', 'ja-JP', 'en-US']}
                        requestTranslation={requestTranslationSuggestion}
                        placeholder={t('stock.l10n.name_placeholder')}
                        loadingSuggestionText={t('stock.l10n.ai_loading')}
                        suggestionPrefixText={t('stock.l10n.ai_prefix')}
                        applySuggestionText={t('stock.l10n.ai_apply')}
                      />
                    </Form.Item>
                    <Form.Item name="sku" label={t('stock.item.sku')}>
                       <Input placeholder={t('stock.item.sku_placeholder')} />
                    </Form.Item>
                    <Form.Item name="brand" label={t('stock.item.brand')}>
                       <Input placeholder={t('stock.item.brand_placeholder')} />
                    </Form.Item>
                    <Form.Item name="category" label={t('stock.item.category')}>
                      <Input />
                    </Form.Item>
                    {activeCategoryAttributes.length > 0 && (
                      <Text strong style={{ display: 'block', marginBottom: 8 }}>
                        {t('stock.dynamic.section')}
                      </Text>
                    )}
                    {activeCategoryAttributes.length > 0 ? (
                      <Row gutter={[MOBILE_DYNAMIC_GUTTER, isMobile ? MOBILE_DYNAMIC_GUTTER : DESKTOP_DYNAMIC_GUTTER]}>
                        {activeCategoryAttributes.map((field) => (
                          <Col key={field.key} xs={24} sm={24} md={12} lg={12}>
                            <Form.Item name={['dynamicAttributes', field.key]} label={getFieldLabel(field, t)}>
                              {field.type === 'number' ? (
                                <InputNumber style={{ width: '100%' }} />
                              ) : field.type === 'select' ? (
                                <Select options={field.options?.map((option) => ({ value: option, label: option }))} />
                              ) : (
                                <Input />
                              )}
                            </Form.Item>
                          </Col>
                        ))}
                      </Row>
                    ) : null}
                    <Text strong style={{ display: 'block', marginBottom: 8 }}>
                      {t('stock.dynamic.ai_section')}
                    </Text>
                    <Row gutter={[MOBILE_DYNAMIC_GUTTER, isMobile ? MOBILE_DYNAMIC_GUTTER : DESKTOP_DYNAMIC_GUTTER]}>
                      <Col key="netContent" xs={24} sm={24} md={12} lg={12}>
                        <Form.Item name={['dynamicAttributes', 'netContent']} label={t('stock.item.net_content')}>
                          <Input placeholder={t('stock.item.net_content_placeholder')} />
                        </Form.Item>
                      </Col>
                      <Col key="pricePerUnit" xs={24} sm={24} md={12} lg={12}>
                        <Form.Item name={['dynamicAttributes', 'pricePerUnit']} label={t('stock.item.price_per_unit')}>
                          <Input placeholder={t('stock.item.price_per_unit_placeholder')} />
                        </Form.Item>
                      </Col>
                      <Col key="packSize" xs={24} sm={24} md={12} lg={12}>
                        <Form.Item name={['dynamicAttributes', 'packSize']} label={t('stock.item.pack_size')}>
                          <Input placeholder={t('stock.item.pack_size_placeholder')} />
                        </Form.Item>
                      </Col>
                      <Col key="storageHint" xs={24} sm={24} md={12} lg={12}>
                        <Form.Item name={['dynamicAttributes', 'storageHint']} label={t('stock.item.storage_hint')}>
                          <Input placeholder={t('stock.item.storage_hint_placeholder')} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name="storageCondition" label={t('stock.item.storage_condition')}>
                      <Radio.Group
                        optionType="button"
                        options={[
                          { value: 'AMBIENT', label: t('stock.storage.ambient') },
                          { value: 'CHILLED', label: t('stock.storage.chilled') }
                        ]}
                      />
                    </Form.Item>
                    <Form.Item name="orderMethod" label={t('stock.item.order_method')}>
                      <Radio.Group
                        optionType="button"
                        options={[
                          { value: 'PRE_ORDER', label: t('stock.order.pre_order') },
                          { value: 'DIRECT_BUY', label: t('stock.order.direct_buy') }
                        ]}
                      />
                    </Form.Item>
                    <Form.Item name="price" label={t('stock.item.price')}>
                      <InputNumber prefix="JPY ¥" style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="stock" label={t('stock.item.quantity')}>
                      <InputNumber style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item name="descriptionL10n" label={`${t('stock.item.description')} (L10n)`}>
                      <L10nInput
                         locales={['zh-CN', 'ja-JP', 'en-US']}
                        requestTranslation={requestTranslationSuggestion}
                        placeholder={t('stock.l10n.description_placeholder')}
                        loadingSuggestionText={t('stock.l10n.ai_loading')}
                        suggestionPrefixText={t('stock.l10n.ai_prefix')}
                        applySuggestionText={t('stock.l10n.ai_apply')}
                      />
                    </Form.Item>
                    <Form.Item name="mediaGallery" label={t('stock.media.label')}>
                      <MediaGallery
                         locales={['zh-CN', 'ja-JP', 'en-US']}
                        requestTranslation={requestTranslationSuggestion}
                        emptyDescriptionText={t('stock.media.empty')}
                        mediaTitlePrefixText={t('stock.media.item_prefix')}
                        addMediaText={t('stock.media.add')}
                        urlPlaceholderText={t('stock.media.url_placeholder')}
                        imageLabelText={t('stock.media.image')}
                        videoLabelText={t('stock.media.video')}
                        titlePlaceholderText={t('stock.media.title_placeholder')}
                      />
                    </Form.Item>
                  </>
                )
              },
              {
                key: 'priceTiers',
                label: t('stock.tabs.price_tiers'),
                children: (
                  <Form.List name="priceTiers">
                    {(fields, { add, remove }) => (
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {fields.map((field) => (
                          <Card key={field.key} size="small" className="price-tier-card">
                            <Row gutter={8} align="middle">
                              <Col span={10}>
                                <Form.Item
                                  name={[field.name, 'tierName']}
                                  label={t('stock.price_tier.tier_name')}
                                  style={{ marginBottom: 8 }}
                                >
                                  <Input placeholder={t('stock.price_tier.tier_placeholder')} />
                                </Form.Item>
                              </Col>
                              <Col span={10}>
                                <Form.Item
                                  name={[field.name, 'price']}
                                  label={t('stock.price_tier.price')}
                                  style={{ marginBottom: 8 }}
                                >
                                  <InputNumber style={{ width: '100%' }} />
                                </Form.Item>
                              </Col>
                              <Col span={4} style={{ textAlign: 'right', paddingBottom: 8 }}>
                                <Button onClick={() => remove(field.name)} danger size="small" icon={<DeleteOutlined />} />
                              </Col>
                            </Row>
                            <Form.Item
                              name={[field.name, 'agentOnly']}
                              valuePropName="checked"
                              style={{ marginBottom: 0 }}
                            >
                              <Checkbox>{t('stock.price_tier.agent_only')}</Checkbox>
                            </Form.Item>
                          </Card>
                        ))}
                        <Button onClick={() => add()} type="dashed" block icon={<PlusOutlined />}>
                          {t('stock.price_tier.add')}
                        </Button>
                      </Space>
                    )}
                  </Form.List>
                )
              },
              {
                key: 'merchantCodes',
                label: t('stock.tabs.merchant_codes'),
                children: (
                  <Form.List name="merchantSkuEntries">
                    {(fields, { add, remove }) => (
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {fields.map((field) => (
                          <Row key={field.key} gutter={8} align="middle">
                            <Col span={10}>
                              <Form.Item
                                name={[field.name, 'merchant']}
                                label={t('stock.merchant_codes.merchant')}
                                style={{ marginBottom: 8 }}
                              >
                                <Select
                                  placeholder={t('stock.merchant_codes.merchant_placeholder')}
                                  options={suppliers.map(s => ({
                                    value: s.id,
                                    label: getLocalizedFallback(s.name, s.id)
                                  }))}
                                />
                              </Form.Item>
                            </Col>
                            <Col span={10}>
                              <Form.Item
                                name={[field.name, 'sku']}
                                label={t('stock.merchant_codes.sku')}
                                style={{ marginBottom: 8 }}
                              >
                                <Input placeholder={t('stock.merchant_codes.sku_placeholder')} />
                              </Form.Item>
                            </Col>
                            <Col span={4} style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 8 }}>
                              <Button onClick={() => remove(field.name)} danger icon={<DeleteOutlined />} />
                            </Col>
                          </Row>
                        ))}
                        <Button onClick={() => add()} type="dashed" block>
                          {t('stock.merchant_codes.add')}
                        </Button>
                      </Space>
                    )}
                  </Form.List>
                )
              }
            ]}
          />
        </Form>
      </Drawer>
        {(!embedded||recordView==='manage')&&<div className="stock-mobile-fab-group">
          <Button
            shape="circle"
            icon={<PlusOutlined />}
            aria-label={t('stock.master.add_row')}
            size="large"
            className="app-shadow-medium"
            onClick={handleAddRow}
          />
        </div>}
      <AiQuickAddModal
        visible={isQuickAddVisible}
        onCancel={() => setIsQuickAddVisible(false)}
        onSuccess={handleQuickAddSuccess}
      />
    </div>
  );
}
