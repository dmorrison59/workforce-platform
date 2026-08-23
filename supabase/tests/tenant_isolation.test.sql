begin;
select plan(22);

-- Create two fictional authenticated users. The profile trigger runs for each.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) values
  ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner-a@tenant-test.example', null, now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Alex","last_name":"A"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'b0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'owner-b@tenant-test.example', null, now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Blair","last_name":"B"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

set local role authenticated;
set local "request.jwt.claim.sub" = 'a0000000-0000-0000-0000-000000000001';
select public.create_organization('Company A', 'tenant-test-company-a', 'America/New_York');
select ok(
  public.has_permission((select id from public.organizations where slug = 'tenant-test-company-a'), 'settings.manage'),
  'Company A creator becomes an owner with settings.manage'
);

insert into public.locations (organization_id, name, address, city, state, postal_code)
select id, 'Company A Location', '1 A Street', 'Example', 'NY', '10001'
from public.organizations where slug = 'tenant-test-company-a';
insert into public.departments (organization_id, name)
select id, 'Company A Department' from public.organizations where slug = 'tenant-test-company-a';
select public.create_employee(
  target_organization_id => (select id from public.organizations where slug = 'tenant-test-company-a'),
  employee_first_name => 'Employee',
  employee_last_name => 'A',
  employee_email => 'employee-a@tenant-test.example',
  employee_street_address => '1 Employee Way',
  employee_city => 'Example',
  employee_state_province => 'NY',
  employee_postal_code => '10001',
  employee_country => 'United States'
);

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'b0000000-0000-0000-0000-000000000001';
select public.create_organization('Company B', 'tenant-test-company-b', 'America/Chicago');
select ok(
  public.has_permission((select id from public.organizations where slug = 'tenant-test-company-b'), 'settings.manage'),
  'Company B creator becomes an owner with settings.manage'
);

insert into public.locations (id, organization_id, name, address, city, state, postal_code)
select 'b1000000-0000-0000-0000-000000000001', id, 'Company B Location', '2 B Street', 'Example', 'IL', '60007'
from public.organizations where slug = 'tenant-test-company-b';
insert into public.departments (id, organization_id, name)
select 'b2000000-0000-0000-0000-000000000001', id, 'Company B Department'
from public.organizations where slug = 'tenant-test-company-b';
insert into public.employees (id, organization_id, first_name, last_name, email, street_address, city, state_province, postal_code, country)
select 'b3000000-0000-0000-0000-000000000001', id, 'Employee', 'B', 'employee-b@tenant-test.example', '2 Employee Way', 'Example', 'IL', '60007', 'United States'
from public.organizations where slug = 'tenant-test-company-b';

reset role;
set local role authenticated;
set local "request.jwt.claim.sub" = 'a0000000-0000-0000-0000-000000000001';

select is(
  (select street_address from public.employees where email = 'employee-a@tenant-test.example'),
  '1 Employee Way', 'Company A can create and read its structured employee address'
);
select is(
  (select street_address from public.employees where id = 'b3000000-0000-0000-0000-000000000001'),
  null::text, 'Company A cannot read a Company B employee address'
);

select is(
  (select count(*)::integer from public.employees where id = 'b3000000-0000-0000-0000-000000000001'),
  0, 'Company A cannot read a known Company B employee UUID'
);
select is(
  (select count(*)::integer from public.locations where id = 'b1000000-0000-0000-0000-000000000001'),
  0, 'Company A cannot read a known Company B location UUID'
);
select is(
  (select count(*)::integer from public.departments where id = 'b2000000-0000-0000-0000-000000000001'),
  0, 'Company A cannot read a known Company B department UUID'
);

select is_empty(
  $$ update public.employees set first_name = 'Compromised' where id = 'b3000000-0000-0000-0000-000000000001' returning id $$,
  'Company A cannot update a Company B employee'
);
select is_empty(
  $$ update public.employees set street_address = 'Compromised' where id = 'b3000000-0000-0000-0000-000000000001' returning id $$,
  'Company A cannot update a Company B employee address'
);
select is_empty(
  $$ update public.locations set name = 'Compromised' where id = 'b1000000-0000-0000-0000-000000000001' returning id $$,
  'Company A cannot update a Company B location'
);
select is_empty(
  $$ update public.departments set name = 'Compromised' where id = 'b2000000-0000-0000-0000-000000000001' returning id $$,
  'Company A cannot update a Company B department'
);
select is_empty(
  $$ delete from public.employees where id = 'b3000000-0000-0000-0000-000000000001' returning id $$,
  'Company A cannot delete a Company B employee'
);
select is_empty(
  $$ delete from public.locations where id = 'b1000000-0000-0000-0000-000000000001' returning id $$,
  'Company A cannot delete a Company B location'
);
select is_empty(
  $$ delete from public.departments where id = 'b2000000-0000-0000-0000-000000000001' returning id $$,
  'Company A cannot delete a Company B department'
);

select is(
  (select count(*)::integer from public.employees), 1,
  'Company A employee query returns only Company A rows'
);
select is(
  (select count(*)::integer from public.locations), 1,
  'Company A location query returns only Company A rows'
);
select is(
  (select count(*)::integer from public.departments), 1,
  'Company A department query returns only Company A rows'
);

reset role;
select is(
  (select first_name from public.employees where id = 'b3000000-0000-0000-0000-000000000001'),
  'Employee', 'Company B employee remained unchanged after cross-tenant attempts'
);
select is(
  (select street_address from public.employees where id = 'b3000000-0000-0000-0000-000000000001'),
  '2 Employee Way', 'Company B employee address remained unchanged after cross-tenant attempts'
);
select is(
  (select name from public.locations where id = 'b1000000-0000-0000-0000-000000000001'),
  'Company B Location', 'Company B location remained unchanged after cross-tenant attempts'
);
select is(
  (select name from public.departments where id = 'b2000000-0000-0000-0000-000000000001'),
  'Company B Department', 'Company B department remained unchanged after cross-tenant attempts'
);

set local role anon;
select throws_ok(
  $$ select * from public.employees $$,
  '42501', null, 'Unauthenticated users cannot query business data'
);

select * from finish();
rollback;
