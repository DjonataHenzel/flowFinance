ALTER TABLE compromissos ADD COLUMN categoria_id BIGINT REFERENCES categorias(id);
ALTER TABLE compromissos ADD COLUMN cep VARCHAR(8);
ALTER TABLE compromissos ADD COLUMN logradouro VARCHAR(150);
ALTER TABLE compromissos ADD COLUMN numero VARCHAR(20);
ALTER TABLE compromissos ADD COLUMN complemento VARCHAR(100);
ALTER TABLE compromissos ADD COLUMN bairro VARCHAR(100);
ALTER TABLE compromissos ADD COLUMN cidade VARCHAR(100);
ALTER TABLE compromissos ADD COLUMN uf VARCHAR(2);

CREATE INDEX idx_compromissos_categoria ON compromissos(categoria_id);

INSERT INTO papel_funcionalidades (papel_id, funcionalidade)
SELECT DISTINCT pf.papel_id, 'CONSULTAR_CATEGORIAS'
FROM papel_funcionalidades pf
WHERE pf.funcionalidade = 'CONSULTAR_COMPROMISSOS'
ON CONFLICT (papel_id, funcionalidade) DO NOTHING;
