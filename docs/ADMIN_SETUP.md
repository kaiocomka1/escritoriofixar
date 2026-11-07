# Fixar+ AI Office — administrative access

1. Verify Supabase schema using GET /api/supabase/verify.
2. In Supabase > Authentication > Users, create a dedicated administrator user using a unique email and strong password. Disable public signups if this is a private office.
3. Copy only the user's UUID from the dashboard.
4. In SQL Editor, run:
   insert into public.profiles(user_id,role)
   values ('REPLACE_WITH_USER_UUID','admin')
   on conflict(user_id) do update set role='admin';
5. Do not paste credentials or UUID into public GitHub issues.
6. The application login and session-protected API are NOT yet implemented.
7. Never call server-side Supabase secret-key APIs from the browser.
