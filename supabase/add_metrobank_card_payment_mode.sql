-- Add Debit/Credit Card (Metrobank) as an order payment mode (run in Supabase SQL editor)

alter table public.flower_orders
  drop constraint if exists flower_orders_payment_mode_check;

alter table public.flower_orders
  add constraint flower_orders_payment_mode_check
  check (
    payment_mode in (
      'cash',
      'gcash',
      'metrobank',
      'metrobank_card',
      'bpi',
      'eastwest',
      'bank'
    )
  );

alter table public.flower_orders
  drop constraint if exists flower_orders_balance_payment_mode_check;

alter table public.flower_orders
  add constraint flower_orders_balance_payment_mode_check
  check (
    balance_payment_mode in (
      '',
      'cash',
      'gcash',
      'metrobank',
      'metrobank_card',
      'bpi',
      'eastwest',
      'bank'
    )
  );
