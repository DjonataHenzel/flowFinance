ALTER TABLE compromissos DROP CONSTRAINT IF EXISTS compromissos_situacao_check;
ALTER TABLE compromissos ADD CONSTRAINT compromissos_situacao_check
    CHECK (situacao IN ('PENDENTE','RESOLVIDO','REAGENDADO','CONCLUIDO','NOTIFICADO'));
