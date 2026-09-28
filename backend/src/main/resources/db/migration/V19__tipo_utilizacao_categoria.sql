ALTER TABLE categorias
    ADD COLUMN tipo_utilizacao VARCHAR(20) NOT NULL DEFAULT 'CONTAS';

UPDATE categorias c
   SET tipo_utilizacao = 'COMPROMISSOS'
 WHERE EXISTS (SELECT 1 FROM compromissos co WHERE co.categoria_id = c.id)
   AND NOT EXISTS (SELECT 1 FROM contas conta WHERE conta.categoria_id = c.id);

ALTER TABLE categorias
    ADD CONSTRAINT categorias_tipo_utilizacao_check
    CHECK (tipo_utilizacao IN ('CONTAS', 'COMPROMISSOS'));
