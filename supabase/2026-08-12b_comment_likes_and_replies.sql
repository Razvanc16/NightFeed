-- Comentariile puteau doar fi postate plat, fără a putea răspunde cuiva sau
-- aprecia un comentariu. Adăugăm threading pe un singur nivel (răspunzi la
-- comentariul de top, ca pe Instagram) și like-uri per comentariu/răspuns.

begin;

alter table public.comments
  add column if not exists parent_id uuid references public.comments(id) on delete cascade;

create index if not exists idx_comments_parent on public.comments (parent_id);

create table if not exists public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create index if not exists idx_comment_likes_comment on public.comment_likes (comment_id);

alter table public.comment_likes enable row level security;

-- Numărul de aprecieri trebuie vizibil oricui vede comentariile (la fel ca
-- like-urile de pe evenimente), dar poți insera/șterge doar propriul like.
drop policy if exists "comment_likes_select_all" on public.comment_likes;
create policy "comment_likes_select_all" on public.comment_likes
for select using (true);

drop policy if exists "comment_likes_insert_own" on public.comment_likes;
create policy "comment_likes_insert_own" on public.comment_likes
for insert with check (auth.uid() = user_id);

drop policy if exists "comment_likes_delete_own" on public.comment_likes;
create policy "comment_likes_delete_own" on public.comment_likes
for delete using (auth.uid() = user_id);

commit;
