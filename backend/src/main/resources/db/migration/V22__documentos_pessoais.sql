CREATE TABLE documentos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    pessoa_id BIGINT NOT NULL REFERENCES pessoas(id),
    usuario_id BIGINT NOT NULL REFERENCES usuario(id),
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_documentos_pessoa ON documentos(pessoa_id);
CREATE INDEX idx_documentos_usuario ON documentos(usuario_id);

CREATE TABLE anexos_documentos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    documento_id BIGINT NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
    nome_arquivo VARCHAR(255) NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    tipo_documento VARCHAR(20) NOT NULL CHECK (tipo_documento IN ('PESSOAIS', 'RECEITAS', 'EXAMES')),
    tipo_arquivo VARCHAR(150),
    tamanho BIGINT NOT NULL,
    conteudo BYTEA NOT NULL
);

CREATE INDEX idx_anexos_documentos_documento ON anexos_documentos(documento_id);

INSERT INTO papel_funcionalidades (papel_id, funcionalidade)
SELECT p.id, f.funcionalidade
FROM papeis p
CROSS JOIN (VALUES
    ('CONSULTAR_DOCUMENTOS'), ('CADASTRAR_DOCUMENTOS'),
    ('ALTERAR_DOCUMENTOS'), ('EXCLUIR_DOCUMENTOS')
) AS f(funcionalidade)
WHERE EXISTS (
    SELECT 1 FROM papel_funcionalidades existente
    WHERE existente.papel_id = p.id
      AND existente.funcionalidade = 'GERENCIAR_PERMISSOES'
)
ON CONFLICT (papel_id, funcionalidade) DO NOTHING;
