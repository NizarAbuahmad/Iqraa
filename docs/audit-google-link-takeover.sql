-- Who could already have been taken over through the /auth/google linking bug.
-- Read-only. Paste into the Neon SQL editor, against PRODUCTION.
--
-- How it tells them apart: /register always issues a verification code, and
-- /auth/google never does. So a row holding BOTH a password and a Google link,
-- with verification tokens it never used, was registered by password, never
-- proved the address by code, and is verified today anyway. The only thing that
-- could have set that flag is the Google link.
--
-- 2026-09-10 is when email verification shipped. Password accounts older than
-- that were grandfathered to verified by the backfill in the deploy note on
-- lib/db/src/schema/users.ts, so their verified flag says nothing either way.
SELECT
  CASE
    WHEN (SELECT count(*) FROM email_verification_tokens t WHERE t.user_id = u.id AND t.used) > 0
      THEN 'OK - proved the address by code itself'
    WHEN (SELECT count(*) FROM password_reset_tokens p WHERE p.user_id = u.id AND p.used) > 0
      THEN 'OK - password set through a completed reset'
    WHEN (SELECT count(*) FROM email_verification_tokens t WHERE t.user_id = u.id) > 0
      THEN 'SUSPECT - registered by password, never verified by code, verified anyway'
    WHEN u.created_at < DATE '2026-09-10'
      THEN 'GRANDFATHERED - predates email verification; the backfill set the flag'
    ELSE 'ODD - created after verification shipped with no code ever issued'
  END AS verdict,
  u.email,
  u.role,
  u.created_at::date AS created,
  u.last_login::date AS last_login,
  (SELECT count(*) FROM email_verification_tokens t WHERE t.user_id = u.id AND t.used) AS verif_used,
  (SELECT count(*) FROM email_verification_tokens t WHERE t.user_id = u.id) AS verif_total,
  (SELECT count(*) FROM password_reset_tokens p WHERE p.user_id = u.id AND p.used) AS resets_used,
  u.id
FROM users u
WHERE u.google_id IS NOT NULL
  AND u.password_hash IS NOT NULL
ORDER BY 1, u.created_at;
