import React, { useState, useRef } from 'react';
import { Modal, Upload, Button, Steps, Result, Spin, message, Space, Typography, Alert, Card, Divider, Progress, Form, Input, InputNumber, Row, Col } from 'antd';
import type { RcFile } from 'antd/es/upload';
import { CameraOutlined, UploadOutlined, FileSearchOutlined, GlobalOutlined, CheckCircleOutlined, PictureOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { api, type AiOnboardingSuggestion } from '../api';
import { useI18n } from '../i18n';
import AttributeDiffTable from './AttributeDiffTable';

const { Text, Title, Paragraph } = Typography;
const FINAL_STEP = 4;

interface AiQuickAddModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: (suggestion: AiOnboardingSuggestion) => void;
  scan?: (file: File) => Promise<AiOnboardingSuggestion>;
  recommendation?: boolean;
}

const AiQuickAddModal: React.FC<AiQuickAddModalProps> = ({ visible, onCancel, onSuccess,scan,recommendation=false }) => {
  const { t } = useI18n();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<any[]>([]);

  const [suggestion, setSuggestion] = useState<AiOnboardingSuggestion | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [form] = Form.useForm();
  const scanEpoch = useRef(0);
  const readerRef = useRef<FileReader>();
  const submitted = useRef(false);
  const lowConfidence = (suggestion?.matchScore ?? 100) < 70;
  const historicalImage = suggestion?.verificationTarget?.mediaGallery?.find((item) => item.type === 'IMAGE' || item.type === 'image')?.url;
  const manualEntryMode = Boolean(scanError);

  React.useEffect(() => {
    scanEpoch.current++;
    readerRef.current?.abort?.();
    if (visible) {
      setCurrentStep(0);
      setLoading(false);
      setFileList([]);
      setSuggestion(null);
      setScanError(null);
      submitted.current=false;
      form.resetFields();
    }
    return () => { scanEpoch.current++; readerRef.current?.abort?.(); };
  }, [visible, form]);

  const handleUpload = (file: RcFile) => {
    if (!(recommendation?['image/jpeg','image/png']:['image/jpeg','image/png','image/webp']).includes(file.type) || !file.size || file.size>8*1024*1024) {
      message.error(t('rec.image_rule')); return false;
    }
    const epoch=++scanEpoch.current;
    submitted.current=false;
    readerRef.current?.abort?.();
    setLoading(true);
    setCurrentStep(1);

    const reader = new FileReader();
    readerRef.current=reader;
    reader.onload = async () => {
      const base64 = reader.result as string;
      if(epoch!==scanEpoch.current)return;
      try {
        setScanError(null);
        // Inject the original photo into the suggestion
        const result = scan ? await scan(file) : await api.onboardScan(base64, file.name);
        if(epoch!==scanEpoch.current)return;
        setSuggestion({ ...result, originalPhotoBase64: base64 });
        setCurrentStep(FINAL_STEP);
        form.setFieldsValue({
          name: result.name,
          brand: result.brand,
          itemNumber: result.itemNumber,
          price: result.price,
          categoryId: result.categoryId,
          attributes: {
            netContent: result.attributes?.netContent,
            pricePerUnit: result.attributes?.pricePerUnit,
            packSize: result.attributes?.packSize,
            storageHint: result.attributes?.storageHint
          }
        });
        setLoading(false);
      } catch (error) {
        if(epoch!==scanEpoch.current)return;
        logError(error);
        setLoading(false);
        const errorMessage = error instanceof Error ? error.message : t('stock.ai_quick_add.failed');
        setScanError(errorMessage);
        setSuggestion({
          name: '',
          brand: '',
          price: undefined,
          itemNumber: '',
          categoryId: '',
          existingProductFound: false,
          existingProductId: undefined,
          visibilityStatus: 'DRAFTER_ONLY',
          originalPhotoBase64: base64,
          inputSampleId: file.name,
          recognitionSummary: errorMessage,
          trace: {
            inputSampleId: file.name,
            inputRef: file.name,
            stage: 'MANUAL_REVIEW',
            recognitionStatus: 'FAILED_RECOGNITION',
            manualReviewRequired: true,
            errorCode: 'FAILED_RECOGNITION',
            errorMessage
          }
        });
        form.setFieldsValue({
          name: '',
          brand: '',
          itemNumber: '',
          price: undefined,
          categoryId: '',
          attributes: {
            netContent: '',
            pricePerUnit: '',
            packSize: '',
            storageHint: ''
          }
        });
        setCurrentStep(4);
        message.warning(errorMessage);
      }
    };
    reader.onerror = () => {
      if(epoch!==scanEpoch.current)return;
      setLoading(false);
      setCurrentStep(0);
      message.error(t('stock.ai_quick_add.failed'));
    };
    reader.readAsDataURL(file);
    return false; // Prevent automatic upload
  };

  const logError = (err: any) => {
    console.error('AI Onboarding Error:', err);
  };

  const handleFinish = () => {
    form.validateFields().then((values) => {
      if (suggestion) {
        if(submitted.current)return;
        submitted.current=true;
        const nextAttributes = Object.fromEntries(
          Object.entries({ ...suggestion.attributes, ...values.attributes })
            .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
        );
        onSuccess({
          ...suggestion,
          ...values,
          attributes: nextAttributes
        });
      }
    });
  };

  const handleSaveAsNew = () => {
    form.validateFields().then((values) => {
      if (suggestion) {
        if(submitted.current)return;
        submitted.current=true;
        const nextAttributes = Object.fromEntries(
          Object.entries({ ...suggestion.attributes, ...values.attributes })
            .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
        );
        onSuccess({
          ...suggestion,
          ...values,
          attributes: nextAttributes,
          existingProductFound: false,
          existingProductId: undefined,
          visibilityStatus: 'DRAFTER_ONLY',
        });
      }
    });
  };

  const steps = [
    { title: t('stock.ai_quick_add.step_upload'), icon: <CameraOutlined /> },
    { title: t('stock.ai_quick_add.step_scan'), icon: <FileSearchOutlined /> },
    { title: t('stock.ai_quick_add.step_research'), icon: <GlobalOutlined /> },
    { title: t('stock.ai_quick_add.step_enrich'), icon: <PictureOutlined /> },
    { title: t('stock.ai_quick_add.step_done'), icon: <CheckCircleOutlined /> },
  ];
  const stageByStep = ['UPLOAD', 'SCANNING', 'RESEARCHING', 'ENRICHING', 'SUCCESS'] as const;

  return (
    <Modal
      title={t('stock.ai_quick_add.title')}
      open={visible}
      onCancel={()=>{scanEpoch.current++;readerRef.current?.abort?.();setLoading(false);onCancel();}}
        footer={currentStep === FINAL_STEP ? [
        !recommendation && (suggestion?.verificationTarget || manualEntryMode) ? (
          <Button key="save-as-new" onClick={handleSaveAsNew}>
            {t('stock.ai_quick_add.save_as_new')}
          </Button>
        ) : null,
        <Button
          key="ok"
          type="primary"
          onClick={handleFinish}
          disabled={Boolean(suggestion?.verificationTarget) && lowConfidence}
        >
          {t(recommendation?'rec.intake.review':'stock.master.publish')}
        </Button>
      ].filter(Boolean) : null}
      width={880}
      centered
      destroyOnClose
    >
      <div style={{ padding: '24px 0' }}>
        <Steps
          current={recommendation?(currentStep===FINAL_STEP?2:currentStep):currentStep}
          items={(recommendation?[steps[0],steps[1],{title:t('rec.intake.review'),icon:<CheckCircleOutlined/>}]:steps).map(s => ({ title: s.title, icon: s.icon, status: scanError ? 'wait' as const : undefined }))}
          size="small"
          style={{ marginBottom: 32 }}
          data-testid="ai-onboarding-steps"
          data-stage={scanError?'MANUAL_REVIEW':recommendation&&currentStep===FINAL_STEP?'CANDIDATE_REVIEW':stageByStep[currentStep]}
        />

        {currentStep === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }} tabIndex={0} onPaste={e=>{const image=Array.from(e.clipboardData.files).find(file=>file.type.startsWith('image/'));if(image){e.preventDefault();handleUpload(image as RcFile);}}} aria-label={t('rec.ai.paste')}>
            <Upload.Dragger
              accept={recommendation?'image/png,image/jpeg':'image/png,image/jpeg,image/webp'}
              beforeUpload={handleUpload}
              showUploadList={false}
              multiple={false}
              disabled={loading}
            >
              <p className="ant-upload-drag-icon">
                <CameraOutlined style={{ fontSize: 48, color: '#1890ff' }} />
              </p>
              <p className="ant-upload-text">{t('stock.ai_quick_add.drag_tip')}</p>
              <p className="ant-upload-hint">{t('stock.ai_quick_add.hint')}</p>
              <div style={{ pointerEvents: 'none' }}>
                <Button type="primary" icon={<UploadOutlined />} style={{ marginTop: 16 }}>
                  {t('stock.ai_quick_add.select_btn')}
                </Button>
              </div>
            </Upload.Dragger>
          </div>
        )}

        {(currentStep > 0 && currentStep < 4) && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 24 }}>
              <Text strong style={{ fontSize: 18 }}>
                {currentStep === 1 && (
                  <span>
                    <FileSearchOutlined style={{ marginRight: 8 }} />
                    {t('stock.ai_quick_add.scanning_msg')}
                  </span>
                )}
                {currentStep === 2 && t('stock.ai_quick_add.researching_msg')}
                {currentStep === 3 && t('stock.ai_quick_add.enriching_msg')}
              </Text>
            </div>
            <div style={{ marginTop: 8, color: '#8c8c8c' }}>
              {t('stock.ai_quick_add.patience_tip')}
            </div>
          </div>
        )}

        {currentStep === FINAL_STEP && (
          <>
            {suggestion?.verificationTarget && (
              <Alert
                message={`${t('stock.ai_quick_add.compare_mode')}${suggestion.verificationTarget.displayName ? `：${suggestion.verificationTarget.displayName}` : ''}`}
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}
            {manualEntryMode ? (
              <Alert
                data-testid="ai-manual-entry-alert"
                message={t('stock.ai_quick_add.manual_review_needed')}
                description={`${scanError} · ${t('stock.ai_quick_add.manual_review_hint')}`}
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                action={
                  <Button size="small" onClick={() => {
                    setCurrentStep(0);
                    setSuggestion(null);
                    setScanError(null);
                    form.resetFields();
                  }}>
                    {t('chat.retry')}
                  </Button>
                }
              />
            ) : null}
            {suggestion?.existingProductFound && (
              <Alert
                data-testid="ai-existing-product-alert"
                message={`${t('stock.ai_quick_add.existing_found')}${suggestion.existingProductId ? `：${suggestion.existingProductId}` : ''}`}
                description={t('stock.ai_quick_add.existing_update_hint')}
                type="info"
                showIcon
                icon={<InfoCircleOutlined />}
                style={{ marginBottom: 24 }}
              />
            )}
            {lowConfidence && suggestion?.verificationTarget ? (
              <Alert
                data-testid="ai-low-match-warning"
                message={t('stock.ai_quick_add.low_match_warning')}
                description={t('stock.ai_quick_add.low_match_hint')}
                type="error"
                showIcon
                style={{ marginBottom: 24 }}
              />
            ) : null}
            {!suggestion?.existingProductFound && suggestion?.similarProductCandidates?.length ? (
              <Alert
                message={t('stock.ai_quick_add.candidate_found')}
                description={t('stock.ai_quick_add.candidate_hint')}
                type="warning"
                showIcon
                style={{ marginBottom: 24 }}
              />
            ) : null}
            {typeof suggestion?.matchScore === 'number' ? (
              <Card size="small" style={{ marginBottom: 16 }} data-testid="ai-match-score-card">
                <Space direction="vertical" style={{ width: '100%' }} size={12}>
                  <div>
                    <Text strong>{t('stock.ai_quick_add.match_score')}</Text>
                    <Title level={4} style={{ margin: '4px 0 0' }}>{`${Math.round(suggestion.matchScore)}%`}</Title>
                  </div>
                  <Progress
                    percent={Math.round(suggestion.matchScore)}
                    status={lowConfidence ? 'exception' : 'success'}
                    strokeColor={lowConfidence ? '#ff4d4f' : '#52c41a'}
                  />
                </Space>
              </Card>
            ) : null}
            {(historicalImage || suggestion?.originalPhotoBase64) && (
              <Card size="small" title={t('stock.ai_quick_add.visual_evidence')} style={{ marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                  <div>
                    <Text strong>{t('stock.ai_quick_add.history_image')}</Text>
                    <div style={{ marginTop: 8, border: '1px solid #f0f0f0', borderRadius: 8, minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#fafafa' }}>
                      {historicalImage ? (
                        <img src={historicalImage} alt={t('stock.ai_quick_add.history_image')} style={{ width: '100%', objectFit: 'contain' }} />
                      ) : (
                        <Text type="secondary">{t('stock.ai_quick_add.no_history_image')}</Text>
                      )}
                    </div>
                  </div>
                  <div>
                    <Text strong>{t('stock.ai_quick_add.current_image')}</Text>
                    <div style={{ marginTop: 8, border: '1px solid #f0f0f0', borderRadius: 8, minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#fafafa' }}>
                      {suggestion?.originalPhotoBase64 ? (
                        <img src={suggestion.originalPhotoBase64} alt={t('stock.ai_quick_add.current_image')} style={{ width: '100%', objectFit: 'contain' }} />
                      ) : (
                        <Text type="secondary">{t('stock.ai_quick_add.no_current_image')}</Text>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            )}
            {suggestion?.fieldDiffs?.length ? (
              <Card size="small" title={t('stock.ai_quick_add.diff_table')} style={{ marginBottom: 16 }}>
                <AttributeDiffTable diffs={suggestion.fieldDiffs} />
              </Card>
            ) : null}
            {suggestion?.semanticReasoning ? (
              <Card size="small" title={t('stock.ai_quick_add.reasoning_title')} style={{ marginBottom: 16 }}>
                <Paragraph style={{ marginBottom: 0 }}>{suggestion.semanticReasoning}</Paragraph>
              </Card>
            ) : null}

            <Card size="small" title={t('stock.ai_quick_add.identified_info')} style={{ marginBottom: 16 }}>
              <Form form={form} layout="vertical">
                <Row gutter={16}>
                  <Col span={14}>
                    <Form.Item name="name" label={t('stock.item.name')} rules={[{ required: true }]}>
                      <Input placeholder={t('stock.item.name_input_placeholder')} />
                    </Form.Item>
                  </Col>
                  <Col span={10}>
                    <Form.Item name="brand" label={t('stock.item.brand')}>
                      <Input placeholder={t('stock.item.brand_placeholder')} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="categoryId" label={t('stock.item.category')}>
                      <Input placeholder={t('stock.item.category_input_placeholder')} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name={['attributes', 'netContent']} label={t('stock.item.net_content')}>
                      <Input placeholder={t('stock.item.net_content_placeholder')} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="itemNumber" label={t('stock.item.sku')}>
                      <Input placeholder={t('stock.item.sku_placeholder')} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    {!recommendation&&<Form.Item name="price" label={t('stock.item.price')}>
                      <InputNumber prefix="$" style={{ width: '100%' }} placeholder="0.00" />
                    </Form.Item>}
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name={['attributes', 'pricePerUnit']} label={t('stock.item.price_per_unit')}>
                      <Input placeholder={t('stock.item.price_per_unit_placeholder')} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name={['attributes', 'packSize']} label={t('stock.item.pack_size')}>
                      <Input placeholder={t('stock.item.pack_size_placeholder')} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item name={['attributes', 'storageHint']} label={t('stock.item.storage_hint')}>
                      <Input placeholder={t('stock.item.storage_hint_placeholder')} />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Card>

            <Divider />
          </>
        )}
      </div>
    </Modal>
  );
};

export default AiQuickAddModal;
