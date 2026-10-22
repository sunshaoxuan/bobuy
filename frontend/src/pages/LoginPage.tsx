import { Alert, Button, Card, Form, Input, Space, Typography } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { isLocalAuthOverrideEnabled } from '../authStorage';
import { useUserRole } from '../context/UserRoleContext';

const { Paragraph, Title, Text } = Typography;

export default function LoginPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { login } = useUserRole();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFinish = async (values: { username: string; password: string }) => {
    setSubmitting(true);
    setError(null);
    try {
      const user = await login(values.username, values.password);
      navigate(user.role === 'AGENT' ? '/admin/dashboard' : '/', { replace: true });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : t('errors.request_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <Card style={{ width: '100%', maxWidth: 420 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={3}>{t('auth.login_title')}</Title>
            <Paragraph type="secondary">{t('auth.login_subtitle')}</Paragraph>
          </div>
          {isLocalAuthOverrideEnabled() ? (
            <Alert
              type="info"
              showIcon
              message={t('auth.demo_hint')}
              description={
                <Space direction="vertical" size={0}>
                  <Text>{t('auth.demo_agent')}</Text>
                  <Text>{t('auth.demo_customer')}</Text>
                </Space>
              }
            />
          ) : null}
          {error ? <Alert type="error" showIcon message={error} /> : null}
          <Form layout="vertical" onFinish={onFinish} autoComplete="off">
            <Form.Item
              label={t('auth.username')}
              name="username"
              rules={[{ required: true, message: t('auth.username_required') }]}
            >
              <Input autoFocus />
            </Form.Item>
            <Form.Item
              label={t('auth.password')}
              name="password"
              rules={[{ required: true, message: t('auth.password_required') }]}
            >
              <Input.Password />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={submitting}>
              {t('auth.login_action')}
            </Button>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
