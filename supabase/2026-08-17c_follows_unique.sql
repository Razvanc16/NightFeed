-- Aceeași familie de bug ca attendances/attendance_requests: "Urmărește"
-- apăsat rapid/repetat (sau dublu-tap accidental) putea crea mai multe
-- rânduri în follows pentru aceeași pereche follower/following, fără nicio
-- constrângere unică în bază care să o prevină — clientul folosea insert
-- simplu, acum upsert cu onConflict pe (follower_id, following_id).

begin;

delete from public.follows a
using public.follows b
where a.follower_id = b.follower_id
  and a.following_id = b.following_id
  and a.id > b.id;

alter table public.follows
  drop constraint if exists follows_follower_following_unique;

alter table public.follows
  add constraint follows_follower_following_unique unique (follower_id, following_id);

commit;
