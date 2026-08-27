CREATE TABLE categorias (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    nome VARCHAR(100) NOT NULL,
    descricao VARCHAR(255),
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE contas ADD COLUMN categoria_id BIGINT REFERENCES categorias(id);
CREATE INDEX idx_categorias_usuario ON categorias(usuario_id);
CREATE UNIQUE INDEX uq_categorias_usuario_nome ON categorias(usuario_id, LOWER(nome));
CREATE INDEX idx_contas_categoria ON contas(categoria_id);

INSERT INTO papel_funcionalidades (papel_id, funcionalidade)
SELECT p.id, f.funcionalidade
FROM papeis p
CROSS JOIN (VALUES ('CONSULTAR_CATEGORIAS'), ('CADASTRAR_CATEGORIAS'),
    ('ALTERAR_CATEGORIAS'), ('EXCLUIR_CATEGORIAS')) f(funcionalidade)
WHERE EXISTS (
    SELECT 1 FROM papel_funcionalidades pf
    WHERE pf.papel_id = p.id AND pf.funcionalidade = 'GERENCIAR_PERMISSOES'
)
ON CONFLICT (papel_id, funcionalidade) DO NOTHING;

INSERT INTO papel_funcionalidades (papel_id, funcionalidade)
SELECT DISTINCT pf.papel_id, m.destino
FROM papel_funcionalidades pf
JOIN (VALUES
    ('CONSULTAR_CONTAS', 'CONSULTAR_CATEGORIAS'),
    ('CADASTRAR_CONTAS', 'CADASTRAR_CATEGORIAS'),
    ('ALTERAR_CONTAS', 'ALTERAR_CATEGORIAS'),
    ('EXCLUIR_CONTAS', 'EXCLUIR_CATEGORIAS')
) m(origem, destino) ON m.origem = pf.funcionalidade
ON CONFLICT (papel_id, funcionalidade) DO NOTHING;
