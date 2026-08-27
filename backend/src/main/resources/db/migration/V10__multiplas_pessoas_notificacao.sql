CREATE TABLE IF NOT EXISTS contas_pessoas_notificacao (
    conta_id BIGINT NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
    pessoa_id BIGINT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
    PRIMARY KEY (conta_id, pessoa_id)
);

INSERT INTO contas_pessoas_notificacao (conta_id, pessoa_id)
SELECT id, pessoa_id FROM contas WHERE pessoa_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS compromissos_pessoas_notificacao (
    compromisso_id BIGINT NOT NULL REFERENCES compromissos(id) ON DELETE CASCADE,
    pessoa_id BIGINT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
    PRIMARY KEY (compromisso_id, pessoa_id)
);

INSERT INTO compromissos_pessoas_notificacao (compromisso_id, pessoa_id)
SELECT id, pessoa_id FROM compromissos WHERE pessoa_id IS NOT NULL
ON CONFLICT DO NOTHING;
