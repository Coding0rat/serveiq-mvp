-- Apply this migration to an existing project before production deployment.
-- Reception staff can settle only reception bills; online bills are settled by
-- the verified Razorpay Edge Functions or signed Razorpay webhooks.
create or replace function public.admin_mark_bill_paid(p_order_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare v_payment_method text;
begin
  if public.current_user_role() <> 'admin' then raise exception 'Administrator access required'; end if;
  select payment_method into v_payment_method from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_payment_method <> 'pay_at_reception' then raise exception 'Online payments are confirmed only by the payment gateway'; end if;
  update public.orders set payment_status='paid',paid_at=now() where id=p_order_id;
end;
$$;
revoke all on function public.admin_mark_bill_paid(uuid) from public;
grant execute on function public.admin_mark_bill_paid(uuid) to authenticated;
