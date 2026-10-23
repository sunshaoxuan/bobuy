import React, { useEffect, useState } from 'react';
import { Table, Button, Card, Modal, Form, Input, Space, Typography, message, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined, EditOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { api, type MobileSupplier } from '../api';
import { localizedContent, useI18n } from '../i18n';

const { Text, Paragraph } = Typography;

const Suppliers: React.FC = () => {
  const { t, locale } = useI18n();
  const [suppliers, setSuppliers] = useState<MobileSupplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<MobileSupplier | null>(null);
  const [form] = Form.useForm();

  const loadSuppliers = async () => {
    setLoading(true);
    try {
      const data = await api.suppliers();
      setSuppliers(data);
    } catch (error) {
      console.error('Failed to load suppliers:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const handleAdd = () => {
    setEditingSupplier(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (record: MobileSupplier) => {
    setEditingSupplier(record);
    form.setFieldsValue({
      id: record.id,
      name_zh: record.name['zh-CN'],
      name_en: record.name['en-US'],
      description_zh: record.description?.['zh-CN'],
      contactInfo: record.contactInfo,
      onboardingRules: record.onboardingRules ? JSON.stringify(record.onboardingRules, null, 2) : ''
    });
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      let rulesObj = {};
      if (values.onboardingRules) {
        try {
          rulesObj = JSON.parse(values.onboardingRules);
        } catch (e) {
          message.error(t('suppliers.invalid_json'));
          return;
        }
      }

      const payload: MobileSupplier = {
        id: values.id,
        name: { 'zh-CN': values.name_zh, 'en-US': values.name_en || values.name_zh },
        description: { 'zh-CN': values.description_zh || '' },
        contactInfo: values.contactInfo,
        onboardingRules: rulesObj
      };

      if (editingSupplier) {
        await api.updateSupplier(editingSupplier.id, payload);
        message.success(t('suppliers.updated'));
      } else {
        await api.createSupplier(payload);
        message.success(t('suppliers.created'));
      }
      setIsModalVisible(false);
      loadSuppliers();
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  const columns: ColumnsType<MobileSupplier> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
    },
    {
      title: t('stock.item.brand'),
      key: 'name',
      render: (_, record) => localizedContent(record.name,locale) || record.id,
    },
    {
      title: t('suppliers.rules_column'),
      key: 'rules',
      render: (_, record) => (
        record.onboardingRules && Object.keys(record.onboardingRules).length > 0 ? (
          <Tag color="blue" icon={<SafetyCertificateOutlined />}>
            {t('suppliers.rule_count',{count:Object.keys(record.onboardingRules).length})}
          </Tag>
        ) : <Text type="secondary">-</Text>
      )
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>
          {t('common.edit')}
        </Button>
      ),
    },
  ];

  return (
    <div className="page-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div className="section-title" data-testid="suppliers-title">{t('suppliers.title')}</div>
          <Text type="secondary">{t('suppliers.helper')}</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} data-testid="suppliers-submit">

          {t('suppliers.add')}
        </Button>
      </div>

      <Table
        dataSource={suppliers}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        scroll={{ x: 'max-content' }}
      />

      <Modal
        title={editingSupplier ? t('suppliers.edit') : t('suppliers.add')}
        open={isModalVisible}
        onOk={handleSave}
        onCancel={handleCancel}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="id" label={t('suppliers.id')} rules={[{ required: true }]}>
            <Input placeholder={t('suppliers.id_example')} disabled={!!editingSupplier} />
          </Form.Item>
          <Space style={{ display: 'flex' }} align="baseline">
            <Form.Item name="name_zh" label={t('suppliers.name_zh')} rules={[{ required: true }]}>
              <Input placeholder={t('suppliers.name_example')} />
            </Form.Item>
            <Form.Item name="name_en" label={t('suppliers.name_en')}>
              <Input placeholder="Costco Wholesale" />
            </Form.Item>
          </Space>
          <Form.Item name="description_zh" label={t('suppliers.description')}>
            <Input />
          </Form.Item>
          <Form.Item name="contactInfo" label={t('suppliers.contact')}>
            <Input />
          </Form.Item>
          <Form.Item
            name="onboardingRules"
            label={t('suppliers.rules')}
            extra={t('suppliers.rules_example')}
          >
            <Input.TextArea rows={6} placeholder='{ "itemNumberRule": "Must be 5 or 6 digits" }' />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Suppliers;
