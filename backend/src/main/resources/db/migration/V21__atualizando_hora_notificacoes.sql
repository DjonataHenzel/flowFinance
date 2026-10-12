ALTER TABLE usuario ADD COLUMN IF NOT EXISTS hora_notificacao TIME NOT NULL DEFAULT '09:00';
UPDATE usuario SET hora_notificacao = '09:00' WHERE hora_notificacao IS NULL;


