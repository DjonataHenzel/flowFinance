INSERT INTO papel_funcionalidades (papel_id, funcionalidade)
SELECT p.id, f.funcionalidade
FROM papeis p
CROSS JOIN (VALUES
    ('CONSULTAR_PESSOAS'), ('CADASTRAR_PESSOAS'), ('ALTERAR_PESSOAS'), ('EXCLUIR_PESSOAS'),
    ('CONSULTAR_COMPROMISSOS'), ('CADASTRAR_COMPROMISSOS'), ('ALTERAR_COMPROMISSOS'), ('EXCLUIR_COMPROMISSOS')
) AS f(funcionalidade)
WHERE EXISTS (
    SELECT 1 FROM papel_funcionalidades existente
    WHERE existente.papel_id = p.id
      AND existente.funcionalidade = 'GERENCIAR_PERMISSOES'
)
ON CONFLICT (papel_id, funcionalidade) DO NOTHING;
