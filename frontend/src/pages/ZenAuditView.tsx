import React, { useEffect, useState } from 'react';
import { Card, Result, Space, Spin, Tag, Typography, Button, Input, Select } from 'antd';
import { AuditOutlined, CheckCircleOutlined, WarningOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ChatMessage, FinancialAuditLog } from '../api';
import { useI18n } from '../i18n';

const { Title, Text } = Typography;

export default function ZenAuditView() {
    const { tripId } = useParams<{ tripId: string }>();
    const navigate = useNavigate();
    const { t, locale } = useI18n();
    const [loading, setLoading] = useState(true);
    const [logs, setLogs] = useState<FinancialAuditLog[]>([]);
    const [chatRecords, setChatRecords] = useState<ChatMessage[]>([]);
    const [integrity, setIntegrity] = useState<{ isValid: boolean } | null>(null);
    const [operatorFilter, setOperatorFilter] = useState('');
    const [publishStatusFilter, setPublishStatusFilter] = useState('ALL');
    const [candidateDecisionFilter, setCandidateDecisionFilter] = useState('ALL');
    const [recordLimit, setRecordLimit] = useState(20);

    useEffect(() => {
        if (tripId) {
            const id = parseInt(tripId);
            Promise.all([
                api.getFinancialAuditLogs(id),
                api.checkFinancialAuditIntegrity(id),
                api.getTripChat(id)
            ]).then(([l, i, c]) => {
                setLogs(l);
                setIntegrity(i);
                setChatRecords(c);
                setLoading(false);
            }).catch(() => setLoading(false));
        }
    }, [tripId]);

    const chatClosureRecords = chatRecords.filter((record) => record.type === 'IMAGE' && Boolean(record.metadata?.imageFlowStatus));
    const filteredChatClosureRecords = chatClosureRecords.filter((record) => {
        const operatorMatches = operatorFilter.trim()
            ? String(record.metadata?.operatorId ?? record.senderId ?? '').toLowerCase().includes(operatorFilter.trim().toLowerCase())
            : true;
        const publishMatches = publishStatusFilter === 'ALL'
            ? true
            : String(record.metadata?.imageFlowStatus ?? '') === publishStatusFilter;
        const decisionMatches = candidateDecisionFilter === 'ALL'
            ? true
            : String(record.metadata?.candidateSelectionResult ?? '') === candidateDecisionFilter;
        return operatorMatches && publishMatches && decisionMatches;
    });

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div className="zen-audit-container">
            <header className="zen-audit-header">
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Button 
                        type="text" 
                        icon={<ArrowLeftOutlined />} 
                        onClick={() => navigate(-1)} 
                        className="zen-back-button"
                    />
                    <Title level={2} className="zen-audit-title serif-font" data-testid="zen-audit-title">
                        {t('zen_audit.scroll_title')}
                    </Title>
                    {integrity?.isValid ? (
                        <Tag color="success" icon={<CheckCircleOutlined />} className="zen-status-tag">
                            {t('zen_audit.integrity_verified')}
                        </Tag>
                    ) : (
                        <Tag color="error" icon={<WarningOutlined />} className="zen-status-tag">
                            {t('zen_audit.broken')}
                        </Tag>
                    )}
                </Space>
            </header>

            <main className="zen-audit-scroll">
                <Card className="zen-audit-pill-card">
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Text strong>{t('audit.search_title',{id:tripId ?? ''})}</Text>
                        <Space wrap>
                            <Input
                                placeholder={t('audit.operator')}
                                value={operatorFilter}
                                onChange={(event) => setOperatorFilter(event.target.value)}
                                style={{ width: 160 }}
                                data-testid="zen-audit-operator-filter"
                            />
                            <Select
                                value={publishStatusFilter}
                                onChange={setPublishStatusFilter}
                                style={{ width: 220 }}
                                options={[
                                    { label: t('audit.all_statuses'), value: 'ALL' },
                                    ...['PENDING_CONFIRMATION', 'MATCHED_EXISTING_PRODUCT', 'CANDIDATE_SELECTED', 'TEMP_PRODUCT_CREATED', 'PUBLISHED_TO_MARKET', 'PUBLISH_FAILED'].map(value => ({ label:t(`chat.image_status.${value}`), value }))
                                ]}
                            />
                            <Select
                                value={candidateDecisionFilter}
                                onChange={setCandidateDecisionFilter}
                                style={{ width: 220 }}
                                options={[
                                    { label: t('audit.all_decisions'), value: 'ALL' },
                                    ...['EXACT_MATCH', 'SELECTED_CANDIDATE', 'CREATED_TEMP_PRODUCT'].map(value => ({ label:t(`audit.decision.${value}`), value }))
                                ]}
                            />
                            <Select
                                value={recordLimit}
                                onChange={setRecordLimit}
                                style={{ width: 140 }}
                                options={[
                                    { label: t('audit.limit',{count:20}), value: 20 },
                                    { label: t('audit.limit',{count:50}), value: 50 },
                                    { label: t('audit.limit',{count:100}), value: 100 }
                                ]}
                            />
                        </Space>
                        <Text type="secondary">
                            {t('audit.hits',{count:filteredChatClosureRecords.length,total:chatClosureRecords.length})}
                        </Text>
                        {filteredChatClosureRecords.slice(0, recordLimit).map((record, index) => (
                            <div key={record.id ?? `chat-closure-${index}`} className="zen-val-block">
                                <Space wrap>
                                    <Tag>{record.metadata?.imageFlowStatus ? t(`chat.image_status.${record.metadata.imageFlowStatus}`) : t('common.unknown')}</Tag>
                                    <Tag>{record.metadata?.candidateSelectionResult ? t(`audit.decision.${record.metadata.candidateSelectionResult}`) : t('common.not_applicable')}</Tag>
                                    <Tag>{record.metadata?.operatorId ?? record.senderId}</Tag>
                                    <Tag>{record.metadata?.productId ?? t('audit.no_product')}</Tag>
                                </Space>
                            </div>
                        ))}
                    </Space>
                </Card>
                {logs.length === 0 ? (
                    <Result title={t('audit.empty')} />
                ) : (
                    logs.map((log) => (
                        <Card key={log.id} className="zen-audit-pill-card">
                            <div className="zen-audit-card-inner">
                                <header>
                                    <Space direction="vertical" size={2}>
                                        <Text type="secondary" style={{ fontSize: '10px' }}>
                                            {new Date(log.createdAt).toLocaleString(locale)}
                                        </Text>
                                        <Text strong className="serif-font" style={{ fontSize: '16px' }}>
                                            {log.actionType.replace(/_/g, ' ')}
                                        </Text>
                                    </Space>
                                    <Tag className="zen-hash-tag">
                                        <AuditOutlined style={{ marginRight: 4 }} />
                                        {log.currentHash.substring(0, 8)}...
                                    </Tag>
                                </header>
                                <div className="zen-audit-values">
                                    {log.originalValue && (
                                        <div className="zen-val-block">
                                            <Text type="secondary" delete>{log.originalValue}</Text>
                                        </div>
                                    )}
                                    <div className="zen-val-block">
                                        <Text>{log.modifiedValue}</Text>
                                    </div>
                                </div>
                                <footer>
                                    <Text type="secondary" italic style={{ fontSize: '11px' }}>
                                        {t('audit.by',{name:log.operatorName})}
                                    </Text>
                                </footer>
                            </div>
                        </Card>
                    ))
                )}
            </main>

            <style>{`
                .zen-audit-container {
                    max-width: 600px;
                    width: 100%;
                    margin: 0 auto;
                    background: var(--zen-bg);
                    min-height: 100vh;
                    padding: 2rem 1rem;
                    overflow-x: hidden;
                    box-sizing: border-box;
                }
                .zen-audit-header {
                    margin-bottom: 2.5rem;
                    text-align: center;
                }
                .zen-audit-title {
                    font-weight: 300 !important;
                    letter-spacing: 0.15em;
                    margin-bottom: 0.5rem !important;
                }
                .serif-font {
                    font-family: 'Playfair Display', "Noto Serif SC", serif;
                }
                .zen-status-tag {
                    border: none;
                    background: transparent;
                    font-size: 13px;
                }
                .zen-audit-scroll {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .zen-audit-pill-card {
                    background: #fffafa !important; /* Washi white */
                    border: none !important;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.03);
                    border-left: 2px solid #2d2926 !important;
                    border-radius: 2px !important;
                }
                .zen-audit-card-inner {
                    display: flex;
                    flex-direction: column;
                    gap: 0.8rem;
                }
                .zen-audit-card-inner header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    flex-wrap: wrap;
                    gap: 0.5rem;
                }
                .zen-hash-tag {
                    font-family: monospace;
                    font-size: 10px;
                    background: #f1efe8;
                    border: none;
                    max-width: 100%;
                    word-break: break-all;
                }
                .zen-audit-values {
                    padding: 0.5rem 0;
                    border-top: 1px dotted #e0e0e0;
                    border-bottom: 1px dotted #e0e0e0;
                    overflow-wrap: anywhere;
                }
                .zen-back-button {
                    position: absolute;
                    left: 0;
                    top: 0;
                }
            `}</style>
        </div>
    );
}
