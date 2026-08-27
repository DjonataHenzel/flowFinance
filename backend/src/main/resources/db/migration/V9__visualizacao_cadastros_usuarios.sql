ALTER TABLE usuario
    ADD COLUMN IF NOT EXISTS visualizar_cadastros_todos_usuarios BOOLEAN NOT NULL DEFAULT FALSE;
