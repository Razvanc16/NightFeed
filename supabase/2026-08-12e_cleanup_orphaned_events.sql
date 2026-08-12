-- Curățare manuală, unică — nu e o migrare de schemă. Două evenimente
-- postate înainte să existe câmpul event_date (deadline-ul care le scoate
-- automat din feed la expirare): "Priveghi Ravzan Chiceanu" și "Ziua
-- Sofiei". Conturile care le-au postat nu mai sunt accesibile, deci nu pot
-- fi șterse din aplicație pe calea normală (Profil → Postate → Șterge).
--
-- IDs confirmate direct din baza de date înainte de a scrie acest script:
--   4cab58e5-7d53-4aba-a260-37f92e94a858  Priveghi Ravzan Chiceanu
--   d0918f22-2148-4e01-8864-4659b7db9c34  Ziua Sofiei
--
-- Șterge și rândurile dependente din celelalte tabele, ca să nu rămână
-- comentarii/like-uri/cereri orfane. event_id e stocat cu prefix "posted_"
-- în comments/likes/attendances, dar ca uuid brut în attendance_requests și
-- event_locations — de-asta apar ambele formate mai jos.

begin;

delete from public.comment_likes
where comment_id in (
  select id from public.comments
  where event_id in ('posted_4cab58e5-7d53-4aba-a260-37f92e94a858', 'posted_d0918f22-2148-4e01-8864-4659b7db9c34')
);

delete from public.comments
where event_id in ('posted_4cab58e5-7d53-4aba-a260-37f92e94a858', 'posted_d0918f22-2148-4e01-8864-4659b7db9c34');

delete from public.likes
where event_id in ('posted_4cab58e5-7d53-4aba-a260-37f92e94a858', 'posted_d0918f22-2148-4e01-8864-4659b7db9c34');

delete from public.attendances
where event_id in ('posted_4cab58e5-7d53-4aba-a260-37f92e94a858', 'posted_d0918f22-2148-4e01-8864-4659b7db9c34');

delete from public.attendance_requests
where event_id in ('4cab58e5-7d53-4aba-a260-37f92e94a858', 'd0918f22-2148-4e01-8864-4659b7db9c34');

delete from public.event_locations
where event_id in ('4cab58e5-7d53-4aba-a260-37f92e94a858', 'd0918f22-2148-4e01-8864-4659b7db9c34');

delete from public.posted_events
where id in ('4cab58e5-7d53-4aba-a260-37f92e94a858', 'd0918f22-2148-4e01-8864-4659b7db9c34');

commit;
