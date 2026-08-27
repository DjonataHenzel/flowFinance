ALTER TABLE compromissos_pessoas_notificacao
    ADD COLUMN IF NOT EXISTS notificado_em TIMESTAMP WITH TIME ZONE;

-- Registros processados antes desta migração não devem ser reenviados.
UPDATE compromissos_pessoas_notificacao cp
   SET notificado_em = COALESCE(c.ultima_notificacao, CURRENT_TIMESTAMP)
  FROM compromissos c
 WHERE c.id = cp.compromisso_id
   AND c.situacao = 'NOTIFICADO'
   AND cp.notificado_em IS NULL;
