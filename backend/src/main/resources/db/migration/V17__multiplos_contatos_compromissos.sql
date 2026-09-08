CREATE TABLE contatos_whatsapp_compromissos (
    id BIGSERIAL PRIMARY KEY,
    compromisso_id BIGINT NOT NULL REFERENCES compromissos(id) ON DELETE CASCADE,
    numero VARCHAR(15) NOT NULL,
    CONSTRAINT uk_whatsapp_compromisso UNIQUE (compromisso_id, numero)
);

INSERT INTO contatos_whatsapp_compromissos(compromisso_id, numero)
SELECT id, whatsapp FROM compromissos WHERE whatsapp IS NOT NULL AND whatsapp <> '';

ALTER TABLE compromissos DROP COLUMN whatsapp;

CREATE INDEX idx_whatsapp_compromissos_compromisso ON contatos_whatsapp_compromissos(compromisso_id);
