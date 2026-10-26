CREATE TABLE bb_currency (
 code varchar(3) PRIMARY KEY, symbol varchar(8) NOT NULL,
 fraction_digits integer NOT NULL CHECK (fraction_digits BETWEEN 0 AND 4),
 name varchar(80) NOT NULL, sale_enabled boolean NOT NULL DEFAULT false
);
INSERT INTO bb_currency(code,symbol,fraction_digits,name,sale_enabled) VALUES
 ('JPY','¥',0,'日本円',true),('USD','$',2,'US Dollar',false),
 ('CNY','¥',2,'人民币',false),('TWD','NT$',2,'新臺幣',false);
ALTER TABLE bb_product ADD COLUMN sale jsonb;
ALTER TABLE bb_product ADD COLUMN currency varchar(3) NOT NULL DEFAULT 'JPY' REFERENCES bb_currency(code);
ALTER TABLE bb_order_header ADD COLUMN currency varchar(3) NOT NULL DEFAULT 'JPY' REFERENCES bb_currency(code);
ALTER TABLE bb_product ADD COLUMN record_version bigint NOT NULL DEFAULT 0;
