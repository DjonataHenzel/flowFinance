ALTER TABLE contas_bancarias ADD COLUMN pessoa_id BIGINT REFERENCES pessoas(id);
CREATE INDEX idx_contas_bancarias_pessoa ON contas_bancarias(pessoa_id);
