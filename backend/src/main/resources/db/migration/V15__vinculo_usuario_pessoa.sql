ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS pessoa_id BIGINT REFERENCES pessoas(id) ON DELETE SET NULL;

-- Preserva instalações existentes associando automaticamente somente nomes
-- idênticos e sem ambiguidade dos dois lados.
WITH correspondencias AS (
    SELECT u.id AS usuario_id, MIN(p.id) AS pessoa_id
      FROM usuario u
      JOIN pessoas p ON LOWER(TRIM(p.nome)) = LOWER(TRIM(u.usuario))
     WHERE u.pessoa_id IS NULL
     GROUP BY u.id
    HAVING COUNT(*) = 1
), unicas AS (
    SELECT MIN(usuario_id) AS usuario_id, pessoa_id
      FROM correspondencias
     GROUP BY pessoa_id
    HAVING COUNT(*) = 1
)
UPDATE usuario u
   SET pessoa_id = unicas.pessoa_id
  FROM unicas
 WHERE u.id = unicas.usuario_id
   AND u.pessoa_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_pessoa
    ON usuario(pessoa_id)
    WHERE pessoa_id IS NOT NULL;
