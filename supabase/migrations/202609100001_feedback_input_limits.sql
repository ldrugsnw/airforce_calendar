alter table public.leave_grants
  alter column acquired_date drop not null,
  drop constraint if exists leave_grants_days_check;

-- Preserve existing out-of-policy values; CHECK still applies to every new/updated row.
-- Validate these two constraints only after owner-confirmed corrections are complete.
alter table public.leave_grants
  add constraint leave_grants_days_range_check check (days between 1 and 365) not valid,
  add constraint leave_grants_acquired_date_range_check check (
    acquired_date is null
    or acquired_date between date '2000-01-01' and date '2999-12-31'
  ) not valid,
  add constraint leave_grants_reason_length_check check (char_length(reason) <= 100),
  add constraint leave_grants_memo_length_check check (char_length(memo) <= 1000);

alter table public.leave_usages
  add constraint leave_usages_date_range_check check (
    start_date between date '2000-01-01' and date '2999-12-31'
    and end_date between date '2000-01-01' and date '2999-12-31'
  );

alter table public.outings
  add constraint outings_date_range_check check (
    date between date '2000-01-01' and date '2999-12-31'
  ),
  add constraint outings_reason_length_check check (char_length(reason) <= 100);
