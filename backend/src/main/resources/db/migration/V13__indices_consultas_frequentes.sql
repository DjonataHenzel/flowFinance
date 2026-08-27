CREATE INDEX IF NOT EXISTS idx_anexos_conta ON anexos_contas(conta_id);
CREATE INDEX IF NOT EXISTS idx_contas_pessoas_pessoa ON contas_pessoas_notificacao(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_compromissos_pessoas_pessoa ON compromissos_pessoas_notificacao(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_compromissos_notificacao_pendente
    ON compromissos(data_hora, hora_notificacao)
    WHERE situacao IN ('PENDENTE', 'REAGENDADO');
CREATE INDEX IF NOT EXISTS idx_compromissos_destinos_pendentes
    ON compromissos_pessoas_notificacao(compromisso_id)
    WHERE notificado_em IS NULL;
