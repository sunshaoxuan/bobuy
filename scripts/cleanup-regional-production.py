"""Remove only explicitly identified PLAN63 acceptance fixtures; preserve real records."""
import json
import re
import subprocess
import sys

fixture = json.loads(sys.argv[1])
marker = fixture['marker']
if not re.fullmatch(r'PLAN63_[0-9]{13}', marker):
    raise ValueError('Invalid acceptance marker')
ids = fixture['trips']
customer = fixture.get('customer')
if not all(type(value) is int and value > 0 for value in ids + ([customer] if customer else [])):
    raise ValueError('Invalid fixture identity')
trip_ids = ','.join(map(str, ids)) or '0'
checks = [f"IF EXISTS (select 1 from bb_trip where id in ({trip_ids}) and delivery_area not like '{marker}%') THEN RAISE EXCEPTION 'Fixture scope mismatch'; END IF;",
    f"IF EXISTS (select 1 from bb_order_header where trip_id in ({trip_ids}) and (business_id <> '{marker}' or total_amount <> 0)) THEN RAISE EXCEPTION 'Order scope mismatch'; END IF;",
    f"IF EXISTS (select 1 from wallet_transactions where trip_id in ({trip_ids})) THEN RAISE EXCEPTION 'Unexpected financial transaction'; END IF;"]
if customer:
    checks.append(f"IF NOT EXISTS (select 1 from bb_user where id={customer} and username=lower('{marker}')) THEN RAISE EXCEPTION 'Customer scope mismatch'; END IF;")
query = 'BEGIN; DO $$ BEGIN ' + ' '.join(checks) + ' END $$;\n'
query += f'DELETE FROM bb_chat_message WHERE trip_id in ({trip_ids}) OR order_id in (select id from bb_order_header where trip_id in ({trip_ids}));\n'
for table in ['bb_financial_audit_log','bb_customer_payment_ledger','bb_trip_profit_share_config','bb_trip_logistics_tracking','bb_trip_expense','bb_procurement_receipt','bb_order_header','bb_trip']:
    query += f'DELETE FROM {table} WHERE ' + (f'id in ({trip_ids})' if table == 'bb_trip' else f'trip_id in ({trip_ids})') + ';\n'
if customer:
    for table, column in [('bb_refresh_token_session','user_id'),('bb_email_challenge','user_id'),('bb_merchant_customer','customer_id'),('bb_user','id')]:
        query += f'DELETE FROM {table} WHERE {column}={customer};\n'
query += 'COMMIT;\n'
query += f"select 'fixture_trips='||count(*) from bb_trip where id in ({trip_ids});\n"
if customer:
    query += f"select 'fixture_customers='||count(*) from bb_user where id={customer};\n"
result = subprocess.run(['docker','exec','-i','bobuy-postgres','sh','-c',
    'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -v ON_ERROR_STOP=1'],
    input=query, text=True, capture_output=True)
if result.returncode:
    print(result.stderr)
    raise SystemExit(result.returncode)
print(result.stdout)
