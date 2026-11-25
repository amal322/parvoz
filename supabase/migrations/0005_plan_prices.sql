-- Parvoz · 0005 · subscription prices
-- The entry price drops to 500 000 UZS a month so a first hire is an easy yes; the placement fee stays at three salaries.
-- Only the three price values change. Limits, subscriptions and invoices already issued are untouched.
begin;
update parvoz.plans set monthly_price_uzs =  500000 where code = 'scout';
update parvoz.plans set monthly_price_uzs = 1500000 where code = 'team';
update parvoz.plans set monthly_price_uzs = 4000000 where code = 'partner';
commit;
