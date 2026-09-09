-- The switch stopped being a door (`0031`, amended): it never refused a sign-up
-- again, it decides whether confirming an address opens the account. Renamed so
-- the row says what it governs — a key that means something else than its name
-- is the bug this project just spent a day on.
UPDATE "app_settings" SET "key" = 'automatic_activation' WHERE "key" = 'registration_open';
