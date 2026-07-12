create extension if not exists pgcrypto;

create type processing_state as enum (
  'discovered', 'downloading', 'parsing', 'processed', 'failed', 'needs_review', 'superseded'
);
create type change_classification as enum ('NEW', 'INCREASED', 'REDUCED', 'EXITED', 'UNCHANGED');

create table managers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cik text not null unique check (cik ~ '^[0-9]{10}$'),
  created_at timestamptz not null default now()
);

create table filings (
  id uuid primary key default gen_random_uuid(),
  manager_id uuid not null references managers(id) on delete cascade,
  accession_number text not null unique check (accession_number ~ '^[0-9]{10}-[0-9]{2}-[0-9]{6}$'),
  form_type text not null,
  filing_date date not null,
  report_period date,
  primary_document text,
  sec_url text not null,
  status processing_state not null default 'discovered',
  error_message text,
  raw_metadata jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index filings_manager_date_idx on filings(manager_id, filing_date desc);

create table positions (
  id uuid primary key default gen_random_uuid(),
  filing_id uuid not null references filings(id) on delete cascade,
  issuer_name text not null,
  title_of_class text not null,
  cusip text not null,
  value_usd numeric(20, 2) not null check (value_usd >= 0),
  quantity numeric(24, 4) not null check (quantity >= 0),
  share_principal_type text not null,
  put_call text not null default '',
  investment_discretion text,
  voting_sole numeric(24, 4),
  voting_shared numeric(24, 4),
  voting_none numeric(24, 4),
  raw_data jsonb not null default '{}'::jsonb,
  unique(filing_id, cusip, title_of_class, put_call, share_principal_type)
);
create index positions_filing_idx on positions(filing_id);

create table position_changes (
  id uuid primary key default gen_random_uuid(),
  filing_id uuid not null references filings(id) on delete cascade,
  previous_filing_id uuid references filings(id) on delete set null,
  cusip text not null,
  title_of_class text not null,
  put_call text not null default '',
  share_principal_type text not null,
  issuer_name text not null,
  current_position_id uuid references positions(id) on delete cascade,
  previous_position_id uuid references positions(id) on delete set null,
  current_quantity numeric(24, 4) not null default 0,
  previous_quantity numeric(24, 4) not null default 0,
  quantity_change numeric(24, 4) not null,
  classification change_classification not null,
  unique(filing_id, cusip, title_of_class, put_call, share_principal_type)
);
create index position_changes_filing_idx on position_changes(filing_id, classification);

create table ticker_mappings (
  cusip text primary key,
  ticker text not null,
  issuer_name text,
  source text not null default 'manual',
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into managers (name, cik) values ('Situational Awareness LP', '0002045724')
on conflict (cik) do update set name = excluded.name;

alter table managers enable row level security;
alter table filings enable row level security;
alter table positions enable row level security;
alter table position_changes enable row level security;
alter table ticker_mappings enable row level security;

-- No anon/authenticated policies are intentional. The MVP reads through Server
-- Components with the service role and never exposes that credential to browsers.

create or replace function process_13f_filing(p_filing jsonb, p_positions jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_manager_id uuid;
  v_filing_id uuid;
  v_previous_id uuid;
begin
  select id into v_manager_id from managers where cik = p_filing->>'cik';
  if v_manager_id is null then raise exception 'Unknown manager CIK'; end if;

  insert into filings (manager_id, accession_number, form_type, filing_date, report_period,
    primary_document, sec_url, status, raw_metadata, error_message)
  values (v_manager_id, p_filing->>'accession_number', p_filing->>'form_type',
    (p_filing->>'filing_date')::date, nullif(p_filing->>'report_period','')::date,
    p_filing->>'primary_document', p_filing->>'sec_url', 'parsing',
    coalesce(p_filing->'raw_metadata', '{}'::jsonb), null)
  on conflict (accession_number) do update set
    form_type = excluded.form_type, filing_date = excluded.filing_date,
    report_period = excluded.report_period, primary_document = excluded.primary_document,
    sec_url = excluded.sec_url, status = 'parsing', raw_metadata = excluded.raw_metadata,
    error_message = null, updated_at = now()
  returning id into v_filing_id;

  delete from position_changes where filing_id = v_filing_id;
  delete from positions where filing_id = v_filing_id;

  insert into positions (filing_id, issuer_name, title_of_class, cusip, value_usd,
    quantity, share_principal_type, put_call, investment_discretion,
    voting_sole, voting_shared, voting_none, raw_data)
  select v_filing_id, x.issuer_name, x.title_of_class, x.cusip, x.value_usd,
    x.quantity, x.share_principal_type, coalesce(x.put_call, ''), x.investment_discretion,
    x.voting_sole, x.voting_shared, x.voting_none, coalesce(x.raw_data, '{}'::jsonb)
  from jsonb_to_recordset(p_positions) as x(
    issuer_name text, title_of_class text, cusip text, value_usd numeric,
    quantity numeric, share_principal_type text, put_call text,
    investment_discretion text, voting_sole numeric, voting_shared numeric,
    voting_none numeric, raw_data jsonb
  );

  select id into v_previous_id from filings
  where manager_id = v_manager_id and status = 'processed' and form_type in ('13F-HR','13F-HR/A')
    and report_period < (p_filing->>'report_period')::date and id <> v_filing_id
  order by report_period desc, filing_date desc limit 1;

  insert into position_changes (filing_id, previous_filing_id, cusip, title_of_class,
    put_call, share_principal_type, issuer_name, current_position_id, previous_position_id,
    current_quantity, previous_quantity, quantity_change, classification)
  select v_filing_id, v_previous_id, coalesce(c.cusip,p.cusip),
    coalesce(c.title_of_class,p.title_of_class), coalesce(c.put_call,p.put_call),
    coalesce(c.share_principal_type,p.share_principal_type), coalesce(c.issuer_name,p.issuer_name),
    c.id, p.id, coalesce(c.quantity,0), coalesce(p.quantity,0),
    coalesce(c.quantity,0)-coalesce(p.quantity,0),
    case when p.id is null then 'NEW'::change_classification
         when c.id is null then 'EXITED'::change_classification
         when c.quantity > p.quantity then 'INCREASED'::change_classification
         when c.quantity < p.quantity then 'REDUCED'::change_classification
         else 'UNCHANGED'::change_classification end
  from (select * from positions where filing_id=v_filing_id) c
  full outer join (select * from positions where filing_id=v_previous_id) p
    on c.cusip=p.cusip and c.title_of_class=p.title_of_class
    and c.put_call=p.put_call and c.share_principal_type=p.share_principal_type
  ;

  update filings set status='processed', processed_at=now(), updated_at=now(), error_message=null
  where id=v_filing_id;
  return v_filing_id;
end $$;

create or replace function record_filing(p_filing jsonb, p_status processing_state, p_error text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_manager_id uuid; v_id uuid;
begin
  select id into v_manager_id from managers where cik=p_filing->>'cik';
  insert into filings(manager_id, accession_number, form_type, filing_date, report_period,
    primary_document, sec_url, status, error_message, raw_metadata)
  values(v_manager_id, p_filing->>'accession_number', p_filing->>'form_type',
    (p_filing->>'filing_date')::date, nullif(p_filing->>'report_period','')::date,
    p_filing->>'primary_document', p_filing->>'sec_url', p_status, p_error,
    coalesce(p_filing->'raw_metadata','{}'::jsonb))
  on conflict(accession_number) do update set status=excluded.status,
    error_message=excluded.error_message, raw_metadata=excluded.raw_metadata, updated_at=now()
  returning id into v_id;
  return v_id;
end $$;

revoke all on function process_13f_filing(jsonb,jsonb) from public, anon, authenticated;
revoke all on function record_filing(jsonb,processing_state,text) from public, anon, authenticated;
grant execute on function process_13f_filing(jsonb,jsonb) to service_role;
grant execute on function record_filing(jsonb,processing_state,text) to service_role;
