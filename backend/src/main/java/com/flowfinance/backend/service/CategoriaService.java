package com.flowfinance.backend.service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CategoriaService {
    private final JdbcTemplate jdbc;

    public CategoriaService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<CategoriaResumo> listar(String usuario) {
        Boolean visualizarTodos = jdbc.queryForObject(
                "SELECT visualizar_cadastros_todos_usuarios FROM usuario WHERE usuario=?", Boolean.class, usuario);
        return jdbc.query("""
                SELECT c.id, c.nome, c.descricao, c.criado_em,
                      (SELECT COUNT(*) FROM contas m WHERE m.categoria_id = c.id)
                        + (SELECT COUNT(*) FROM compromissos co WHERE co.categoria_id = c.id),
                      (SELECT COUNT(*) FROM subcategorias s WHERE s.categoria_id = c.id),
                      c.tipo_utilizacao
                  FROM categorias c
                  JOIN usuario u ON u.id = c.usuario_id
                 WHERE u.usuario = ? OR ?
                 ORDER BY LOWER(c.nome), c.id
                """, (r, n) -> new CategoriaResumo(r.getLong(1), r.getString(2), r.getString(3),
                r.getObject(4, OffsetDateTime.class), r.getInt(5), r.getInt(6), r.getString(7)), usuario,
                Boolean.TRUE.equals(visualizarTodos));
    }

    public Optional<CategoriaResumo> buscar(long id, String usuario) {
        return jdbc.query("""
                SELECT c.id, c.nome, c.descricao, c.criado_em,
                      (SELECT COUNT(*) FROM contas m WHERE m.categoria_id = c.id)
                        + (SELECT COUNT(*) FROM compromissos co WHERE co.categoria_id = c.id),
                      (SELECT COUNT(*) FROM subcategorias s WHERE s.categoria_id = c.id),
                      c.tipo_utilizacao
                  FROM categorias c
                  JOIN usuario autor ON autor.id = c.usuario_id
                  JOIN usuario atual ON atual.usuario = ?
                 WHERE c.id = ?
                   AND (autor.usuario = ? OR atual.visualizar_cadastros_todos_usuarios)
                """, (r, n) -> new CategoriaResumo(r.getLong(1), r.getString(2), r.getString(3),
                r.getObject(4, OffsetDateTime.class), r.getInt(5), r.getInt(6), r.getString(7)), usuario, id, usuario)
                .stream().findFirst();
    }

    @Transactional
    public long cadastrar(String nome, String descricao, String tipoUtilizacao, String usuario) {
        validarTipo(tipoUtilizacao);
        try {
            return jdbc.queryForObject(
                    "INSERT INTO categorias (usuario_id,nome,descricao,tipo_utilizacao) VALUES ((SELECT id FROM usuario WHERE usuario=?),?,?,?) RETURNING id",
                    Long.class, usuario, nome.trim(), normalizar(descricao), tipoUtilizacao);
        } catch (DuplicateKeyException e) {
            throw new IllegalArgumentException("Já existe uma categoria com este nome");
        }
    }

    @Transactional
    public boolean alterar(long id, String nome, String descricao, String tipoUtilizacao, String usuario) {
        validarTipo(tipoUtilizacao);
        Integer incompatíveis = jdbc.queryForObject(tipoUtilizacao.equals("CONTAS")
                ? "SELECT COUNT(*) FROM compromissos WHERE categoria_id=?"
                : "SELECT COUNT(*) FROM contas WHERE categoria_id=?", Integer.class, id);
        if (incompatíveis != null && incompatíveis > 0)
            throw new IllegalArgumentException(
                    "A utilização da categoria não pode ser alterada enquanto houver registros vinculados");
        try {
            return jdbc.update(
                    "UPDATE categorias SET nome=?,descricao=?,tipo_utilizacao=? WHERE id=? AND usuario_id=(SELECT id FROM usuario WHERE usuario=?)",
                    nome.trim(), normalizar(descricao), tipoUtilizacao, id, usuario) > 0;
        } catch (DuplicateKeyException e) {
            throw new IllegalArgumentException("Já existe uma categoria com este nome");
        }
    }

    @Transactional
    public boolean excluir(long id, String usuario) {
        Integer pertenceAoUsuario = jdbc.queryForObject("""
                SELECT COUNT(*) FROM categorias c
                JOIN usuario u ON u.id=c.usuario_id
                WHERE c.id=? AND u.usuario=?
                """, Integer.class, id, usuario);
        if (pertenceAoUsuario == null || pertenceAoUsuario == 0) {
            return false;
        }
        Integer vinculadas = jdbc.queryForObject("""
                SELECT (SELECT COUNT(*) FROM contas WHERE categoria_id=?)
                     + (SELECT COUNT(*) FROM compromissos WHERE categoria_id=?)
                """, Integer.class, id, id);
        if (vinculadas != null && vinculadas > 0)
            throw new IllegalArgumentException(
                    "A categoria está vinculada a contas ou compromissos e não pode ser excluída");
        jdbc.update("DELETE FROM subcategorias WHERE categoria_id=?", id);
        return jdbc.update("DELETE FROM categorias WHERE id=? AND usuario_id=(SELECT id FROM usuario WHERE usuario=?)",
                id, usuario) > 0;
    }

    private String normalizar(String descricao) {
        return descricao == null || descricao.isBlank() ? null : descricao.trim();
    }

    private void validarTipo(String tipoUtilizacao) {
        if (!"CONTAS".equals(tipoUtilizacao) && !"COMPROMISSOS".equals(tipoUtilizacao))
            throw new IllegalArgumentException("Informe onde a categoria será utilizada");
    }

    public record CategoriaResumo(long id, String nome, String descricao, OffsetDateTime criadoEm,
            int quantidadeMovimentacoes, int quantidadeSubcategorias, String tipoUtilizacao) {
    }
}
