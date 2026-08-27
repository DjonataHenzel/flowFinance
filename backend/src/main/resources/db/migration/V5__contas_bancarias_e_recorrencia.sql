CREATE TABLE contas_bancarias (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    banco VARCHAR(30) NOT NULL CHECK (banco IN ('NUBANK','SICREDI','SICOOB','BANCO_DO_BRASIL','CAIXA','PLUXE')),
    agencia VARCHAR(20) NOT NULL,
    numero_conta VARCHAR(30) NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(usuario_id,banco,agencia,numero_conta)
);
ALTER TABLE contas ADD COLUMN conta_bancaria_id BIGINT REFERENCES contas_bancarias(id);
ALTER TABLE contas ADD COLUMN debito_automatico BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE contas ADD COLUMN recorrente BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE contas ADD COLUMN frequencia_recorrencia VARCHAR(10)
    CHECK (frequencia_recorrencia IN ('DIARIA','SEMANAL','MENSAL','ANUAL'));
ALTER TABLE contas ADD CONSTRAINT ck_contas_debito_banco
    CHECK (NOT debito_automatico OR conta_bancaria_id IS NOT NULL);
ALTER TABLE contas ADD CONSTRAINT ck_contas_recorrencia
    CHECK ((NOT recorrente AND frequencia_recorrencia IS NULL) OR
           (recorrente AND frequencia_recorrencia IS NOT NULL));
CREATE INDEX idx_contas_bancarias_usuario ON contas_bancarias(usuario_id);
CREATE INDEX idx_contas_conta_bancaria ON contas(conta_bancaria_id);
ALTER TABLE compromissos DROP CONSTRAINT IF EXISTS compromissos_situacao_check;
ALTER TABLE compromissos ADD CONSTRAINT compromissos_situacao_check
    CHECK (situacao IN ('PENDENTE','RESOLVIDO','REAGENDADO','CONCLUIDO'));

INSERT INTO papel_funcionalidades (papel_id,funcionalidade)
SELECT p.id,f.funcionalidade FROM papeis p
CROSS JOIN (VALUES ('CONSULTAR_CONTAS_BANCARIAS'),('CADASTRAR_CONTAS_BANCARIAS'),
    ('ALTERAR_CONTAS_BANCARIAS'),('EXCLUIR_CONTAS_BANCARIAS')) f(funcionalidade)
WHERE EXISTS (SELECT 1 FROM papel_funcionalidades pf WHERE pf.papel_id=p.id AND pf.funcionalidade='GERENCIAR_PERMISSOES')
ON CONFLICT (papel_id,funcionalidade) DO NOTHING;
