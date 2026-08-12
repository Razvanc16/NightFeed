-- Tabelul notifications a fost creat cu RLS, dar nu a fost niciodată adăugat
-- la publicația de Realtime a Supabase — asta înseamnă că niciun INSERT pe
-- el nu ajungea vreodată la clienți prin websocket (postgres_changes), deci
-- toast-ul din aplicație și bulina de necitite de pe profil/setări nu se
-- actualizau niciodată live (doar la refresh de pagină, când se face un
-- query direct). Adăugarea la publicație e pasul care lipsea.

alter publication supabase_realtime add table public.notifications;
