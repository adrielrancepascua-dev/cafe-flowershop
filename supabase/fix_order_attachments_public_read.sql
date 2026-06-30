-- Run if order photos upload but don't display when viewing/editing orders.
-- Public bucket URLs are loaded by the browser without auth headers.

drop policy if exists "flower_order_attachments_public_read" on storage.objects;

create policy "flower_order_attachments_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'order-attachments');
