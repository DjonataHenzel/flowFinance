ALTER TABLE compromissos ADD COLUMN whatsapp VARCHAR(15);

CREATE TABLE anexos_compromissos (
    id BIGSERIAL PRIMARY KEY,
    compromisso_id BIGINT NOT NULL REFERENCES compromissos(id) ON DELETE CASCADE,
    nome_arquivo VARCHAR(255) NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    tipo_arquivo VARCHAR(255),
    tamanho BIGINT NOT NULL,
    conteudo BYTEA NOT NULL
);

CREATE INDEX idx_anexos_compromissos_compromisso ON anexos_compromissos(compromisso_id);
