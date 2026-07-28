ALTER TABLE users DROP CONSTRAINT users_phone_e164_check;
ALTER TABLE users ADD CONSTRAINT users_phone_e164_check
CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{1,14}$');
