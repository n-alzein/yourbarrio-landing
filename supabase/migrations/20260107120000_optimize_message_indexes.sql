create index if not exists conversations_business_last_message_idx
  on public.conversations (business_id, last_message_at desc);

create index if not exists conversations_customer_last_message_idx
  on public.conversations (customer_id, last_message_at desc);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at desc);

create or replace function public.unread_total(p_role text, p_uid uuid)
returns bigint
language sql
stable
as $$
  select coalesce(
    sum(
      case
        when p_role = 'business' then business_unread_count
        else customer_unread_count
      end
    ),
    0
  )::bigint
  from public.conversations
  where (p_role = 'business' and business_id = p_uid)
     or (p_role = 'customer' and customer_id = p_uid);
$$;
