-- Private bucket for expense receipt photos, referenced by
-- expenses.receipt_storage_path. Files are stored at "<user_id>/<filename>"
-- so ownership can be checked from the path's first folder segment.
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

create policy "receipts_select_own" on storage.objects
for select to authenticated
using (
  bucket_id = 'receipts'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

create policy "receipts_insert_own" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'receipts'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

-- Upsert (replacing a receipt photo) needs UPDATE in addition to INSERT.
create policy "receipts_update_own" on storage.objects
for update to authenticated
using (
  bucket_id = 'receipts'
  and (select auth.uid())::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'receipts'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);

create policy "receipts_delete_own" on storage.objects
for delete to authenticated
using (
  bucket_id = 'receipts'
  and (select auth.uid())::text = (storage.foldername(name))[1]
);
