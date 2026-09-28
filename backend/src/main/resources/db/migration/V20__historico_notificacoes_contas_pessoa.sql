CREATE TABLE historico_notificacoes_contas_pessoa (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pessoa_id BIGINT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
    data_referencia DATE NOT NULL,
    canal VARCHAR(20) NOT NULL,
    quantidade INTEGER NOT NULL,
    mensagem TEXT NOT NULL,
    enviado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_notificacao_conta_pessoa_dia UNIQUE (pessoa_id, data_referencia, canal)
);
