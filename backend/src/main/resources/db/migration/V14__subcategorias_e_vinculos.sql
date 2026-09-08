ALTER TABLE categorias
    ADD CONSTRAINT uq_categorias_id_usuario UNIQUE (id, usuario_id);

CREATE TABLE subcategorias (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    categoria_id BIGINT NOT NULL,
    nome VARCHAR(100) NOT NULL,
    descricao VARCHAR(255),
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_subcategorias_categoria_usuario
        FOREIGN KEY (categoria_id, usuario_id)
        REFERENCES categorias(id, usuario_id)
);

CREATE INDEX idx_subcategorias_usuario ON subcategorias(usuario_id);
CREATE INDEX idx_subcategorias_categoria ON subcategorias(categoria_id);
CREATE UNIQUE INDEX uq_subcategorias_usuario_categoria_nome
    ON subcategorias(usuario_id, categoria_id, LOWER(nome));
CREATE UNIQUE INDEX uq_subcategorias_id_categoria
    ON subcategorias(id, categoria_id);

ALTER TABLE contas ADD COLUMN subcategoria_id BIGINT;
ALTER TABLE contas
    ADD CONSTRAINT fk_contas_subcategoria_categoria
    FOREIGN KEY (subcategoria_id, categoria_id)
    REFERENCES subcategorias(id, categoria_id);
CREATE INDEX idx_contas_subcategoria ON contas(subcategoria_id);

ALTER TABLE compromissos ADD COLUMN subcategoria_id BIGINT;
ALTER TABLE compromissos
    ADD CONSTRAINT fk_compromissos_subcategoria_categoria
    FOREIGN KEY (subcategoria_id, categoria_id)
    REFERENCES subcategorias(id, categoria_id);
CREATE INDEX idx_compromissos_subcategoria ON compromissos(subcategoria_id);

INSERT INTO papel_funcionalidades (papel_id, funcionalidade)
SELECT p.id, f.funcionalidade
  FROM papeis p
 CROSS JOIN (VALUES
    ('CONSULTAR_SUBCATEGORIAS'),
    ('CADASTRAR_SUBCATEGORIAS'),
    ('ALTERAR_SUBCATEGORIAS'),
    ('EXCLUIR_SUBCATEGORIAS')
 ) f(funcionalidade)
 WHERE EXISTS (
    SELECT 1
      FROM papel_funcionalidades pf
     WHERE pf.papel_id = p.id
       AND pf.funcionalidade = 'GERENCIAR_PERMISSOES'
 )
ON CONFLICT (papel_id, funcionalidade) DO NOTHING;

INSERT INTO papel_funcionalidades (papel_id, funcionalidade)
SELECT DISTINCT pf.papel_id, m.destino
  FROM papel_funcionalidades pf
  JOIN (VALUES
    ('CONSULTAR_CATEGORIAS', 'CONSULTAR_SUBCATEGORIAS'),
    ('CADASTRAR_CATEGORIAS', 'CADASTRAR_SUBCATEGORIAS'),
    ('ALTERAR_CATEGORIAS', 'ALTERAR_SUBCATEGORIAS'),
    ('EXCLUIR_CATEGORIAS', 'EXCLUIR_SUBCATEGORIAS')
  ) m(origem, destino) ON m.origem = pf.funcionalidade
ON CONFLICT (papel_id, funcionalidade) DO NOTHING;
