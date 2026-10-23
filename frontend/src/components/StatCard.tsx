import { Card, Typography } from 'antd';

const { Text, Title } = Typography;

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
};

export default function StatCard({ label, value, helper }: StatCardProps) {
  return (
    <Card bordered={false}>
      <Text type="secondary">{label}</Text>
      <Title level={3} style={{ marginTop: 8, marginBottom: 4 }}>
        {value}
      </Title>
      {helper ? <Text className="helper-text">{helper}</Text> : null}
    </Card>
  );
}
