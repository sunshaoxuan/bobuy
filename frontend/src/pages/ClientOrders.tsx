import { Alert, Button, Card, Empty, Grid, Select, Space, Spin, Tag, Typography } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api, type Order, type Trip, type CustomerAmendmentView } from '../api';
import { useI18n } from '../i18n';
import {formatMoney} from '../currency';
import {getStoredAccessToken} from '../authStorage';
import {useUserRole} from '../context/UserRoleContext';
import CustomerOrderAmendment from '../components/CustomerOrderAmendment';
import {localizedContent} from '../i18n';

const { Title, Text } = Typography;

export default function ClientOrders({node}:{node?:number}) {
  const { t,locale } = useI18n();
  const {user}=useUserRole();
  const identity=JSON.stringify([user?.id,getStoredAccessToken()]);
  const currentIdentity=useRef(identity);currentIdentity.current=identity;
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md !== true;
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<number>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,setError]=useState('');
  const [editError,setEditError]=useState('');
  const [editing,setEditing]=useState<CustomerAmendmentView>();
  const [editBusy,setEditBusy]=useState<number>();
  const editGeneration=useRef(0);
  const generation=useRef(0);
  const formatAmount = (amount: number) =>
    formatMoney(amount,'JPY',locale);

  useEffect(() => {
    const request=++generation.current;
    let cancelled = false;
    setLoading(true);setOrders([]);setTrips([]);setSelectedTripId(undefined);setError('');setEditError('');setEditing(undefined);setEditBusy(undefined);editGeneration.current++;
    (async () => {
      try {
        const tripList = (await api.customerTrips()).filter(trip=>node===undefined||trip.agentId===node);
        if (cancelled||request!==generation.current) return;
        setTrips(tripList);
        const firstTripId = tripList[0]?.id;
        if (firstTripId) {
          setSelectedTripId(firstTripId);
          const next=await api.customerOrders(firstTripId);if(!cancelled&&request===generation.current)setOrders(next);
        }
      } catch(error) {if(!cancelled&&request===generation.current)setError((error as Error).message);
      } finally {
        if (!cancelled&&request===generation.current) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      generation.current++;
    };
  }, [node,identity]);

  const onTripChange = async (tripId: number) => {
    const request=++generation.current;
    setSelectedTripId(tripId);
    setEditing(undefined);setEditBusy(undefined);setEditError('');editGeneration.current++;
    setLoading(true);setOrders([]);setError('');
    try {
      const next=await api.customerOrders(tripId);if(request===generation.current)setOrders(next);
    } catch(error) {if(request===generation.current)setError((error as Error).message);
    } finally {
      if(request===generation.current)setLoading(false);
    }
  };

  async function openAmendment(orderId:number) {
    const request=generation.current,edit=++editGeneration.current,scope=identity;
    setEditing(undefined);setEditBusy(orderId);setEditError('');
    try{const view=await api.customerAmendment(orderId);if(request===generation.current&&edit===editGeneration.current&&scope===currentIdentity.current)setEditing(view);}
    catch(error){if(request===generation.current&&edit===editGeneration.current&&scope===currentIdentity.current)setEditError((error as Error).message);}
    finally{if(request===generation.current&&edit===editGeneration.current&&scope===currentIdentity.current)setEditBusy(undefined);}
  }
  async function refreshAmendment(orderId:number,request:number,edit:number,scope:string) {
    if(selectedTripId===undefined)throw new Error(t('amendment.failed'));
    // Finite fresh reads after save/replay. The replay receipt is not permission to edit a later state.
    const [view,list]=await Promise.all([api.customerAmendment(orderId),api.customerOrders(selectedTripId)]);
    if(request!==generation.current||edit!==editGeneration.current||scope!==currentIdentity.current)throw new Error(t('amendment.failed'));
    setEditing(view);setOrders(list);return{...view,id:view.orderId};
  }

  const summary = useMemo(
    () => ({
      totalOrders: orders.length,
      totalAmount: orders.reduce((sum, order) => sum + (order.totalAmount ?? 0), 0)
    }),
    [orders]
  );

  return (
    <div className="page-card client-page">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Space direction={isMobile ? 'vertical' : 'horizontal'} style={{ width: '100%', justifyContent: 'space-between' }}>
          <Title level={4} style={{ margin: 0 }} data-testid="client-orders-title">
            {t('nav.client_orders')}
          </Title>
          <Select
            value={selectedTripId}
            placeholder={t('orders.trip.select.placeholder')}
            onChange={onTripChange}
            style={{ minWidth: isMobile ? '100%' : 280 }}
            options={trips.map((trip) => ({
              value: trip.id,
              label: `${trip.deliveryArea} · ${trip.deliveryDate}`
            }))}
          />
        </Space>
        <Text type="secondary" data-testid="orders-summary">
          Orders: {summary.totalOrders} | Total: {formatAmount(summary.totalAmount)}
        </Text>
        {editError&&<Alert type="error" message={editError}/>}
        {error?<Alert type="error" message={error}/>:loading ? (
          <Spin />
        ) : orders.length === 0 ? (
          <Empty description={t('orders.empty')} />
        ) : (
          <div className="client-card-list">
            {orders.map((order) => (
              <Card key={order.id} className="client-list-card">
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                    <Text strong>#{order.id}</Text>
                    <Tag>{order.status}</Tag>
                  </Space>
                  <Text>{order.businessId}</Text>
                  <Text type="secondary">{order.deliverySnapshot?[order.deliverySnapshot.contactName,order.deliverySnapshot.countryRegion,order.deliverySnapshot.city,order.deliverySnapshot.addressLine,order.deliverySnapshot.postalCode].filter(Boolean).join(' · '):t('checkout.legacy_address')}</Text>
                  <Text type="secondary">
                    {t('orders.table.items')}: {order.lines?.length ?? 0}
                  </Text>
                  <Text strong>
                    {t('orders.table.total')}: {formatMoney(order.totalAmount,order.currency??'JPY',locale)}
                  </Text>
                  {order.status==='NEW'&&order.paymentStatus==='UNPAID'?<Button onClick={()=>void openAmendment(order.id)} loading={editBusy===order.id}>{t('amendment.edit')}</Button>:<Text type="secondary">{t('amendment.locked')}</Text>}
                  {editing?.orderId===order.id&&<>
                    <CustomerOrderAmendment subject={String(user?.id)} sessionKey={identity} order={{...editing,id:editing.orderId}}
                      labels={{title:t('amendment.title'),quantity:t('amendment.quantity'),save:t('amendment.save'),reload:t('amendment.reload'),conflict:t('amendment.conflict'),failed:t('amendment.failed'),locked:t('amendment.locked'),saved:t('amendment.saved'),remove:t('amendment.remove'),add:t('amendment.add'),select:t('amendment.select'),changeAddress:t('amendment.change_address'),contactName:t('amendment.contact_name'),phone:t('amendment.phone'),countryRegion:t('amendment.country'),city:t('amendment.city'),addressLine:t('amendment.address_line'),postalCode:t('amendment.postal_code'),unavailable:t('amendment.unavailable'),total:t('amendment.total')}}
                      name={names=>localizedContent(names,locale)} money={(amount,currency)=>formatMoney(amount,currency,locale)}
                      reload={()=>refreshAmendment(order.id,generation.current,editGeneration.current,identity)}
                      save={async(id,input)=>{const request=generation.current,edit=editGeneration.current,scope=identity;
                        await api.amendOwnOrder(id,input);
                        if(request!==generation.current||edit!==editGeneration.current||scope!==currentIdentity.current)throw new Error(t('amendment.failed'));
                        return refreshAmendment(id,request,edit,scope);
                      }}/>
                    <Button onClick={()=>{editGeneration.current++;setEditing(undefined);}}>{t('amendment.close')}</Button>
                  </>}
                </Space>
              </Card>
            ))}
          </div>
        )}
      </Space>
    </div>
  );
}
