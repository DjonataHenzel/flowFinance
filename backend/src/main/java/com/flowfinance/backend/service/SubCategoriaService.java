package com.flowfinance.backend.service;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SubCategoriaService {
    private final JdbcTemplate jdbc;

    public SubCategoriaService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<SubCategoriaResumo> listar(String usuario) {
        return jdbc.query("""
                SELECT s.id, s.nome, s.descricao, s.categoria_id, c.nome, s.criado_em,
                       (SELECT COUNT(*) FROM contas conta WHERE conta.subcategoria_id = s.id)
                  FROM subcategorias s
                  JOIN categorias c ON c.id = s.categoria_id
                  JOIN usuario autor ON autor.id = s.usuario_id
                  JOIN usuario atual ON atual.usuario = ?
                 WHERE autor.usuario = ? OR atual.visualizar_cadastros_todos_usuarios
                 ORDER BY LOWER(c.nome), LOWER(s.nome), s.id
                """, (r, n) -> resumo(r), usuario, usuario);
    }

    public List<CategoriaOpcao> listarCategoriasVinculaveis(String usuario) {
        return jdbc.query("""
                SELECT c.id,c.nome,c.tipo_utilizacao
                  FROM categorias c
                  JOIN usuario u ON u.id=c.usuario_id
                 WHERE u.usuario=?
                 ORDER BY LOWER(c.nome),c.id
                """, (r, n) -> new CategoriaOpcao(r.getLong(1), r.getString(2), r.getString(3)), usuario);
    }

    public Optional<SubCategoriaResumo> buscar(long id, String usuario) {
        return jdbc.query("""
                SELECT s.id, s.nome, s.descricao, s.categoria_id, c.nome, s.criado_em,
                       (SELECT COUNT(*) FROM contas conta WHERE conta.subcategoria_id = s.id)
                  FROM subcategorias s
                  JOIN categorias c ON c.id = s.categoria_id
                  JOIN usuario autor ON autor.id = s.usuario_id
                  JOIN usuario atual ON atual.usuario = ?
                 WHERE s.id = ?
                   AND (autor.usuario = ? OR atual.visualizar_cadastros_todos_usuarios)
                """, (r, n) -> resumo(r), usuario, id, usuario).stream().findFirst();
    }

    @Transactional
    public long cadastrar(String nome, String descricao, long categoriaId, String usuario) {
        validarCategoriaDoUsuario(categoriaId, usuario);
        try {
            return jdbc.queryForObject("""
                    INSERT INTO subcategorias (usuario_id, categoria_id, nome, descricao)
                    VALUES ((SELECT id FROM usuario WHERE usuario = ?), ?, ?, ?)
                    RETURNING id
                    """, Long.class, usuario, categoriaId, nome.trim(), normalizar(descricao));
        } catch (DuplicateKeyException e) {
            throw new IllegalArgumentException("Já existe uma subcategoria com este nome para a categoria selecionada");
        }
    }

    @Transactional
    public boolean alterar(long id, String nome, String descricao, long categoriaId, String usuario) {
        validarCategoriaDoUsuario(categoriaId, usuario);
        Long categoriaAtual = jdbc.query("""
                SELECT s.categoria_id
                  FROM subcategorias s
                  JOIN usuario u ON u.id = s.usuario_id
                 WHERE s.id = ? AND u.usuario = ?
                """, (r, n) -> r.getLong(1), id, usuario).stream().findFirst().orElse(null);
        if (categoriaAtual == null) {
            return false;
        }
        if (categoriaAtual != categoriaId && possuiVinculos(id)) {
            throw new IllegalArgumentException(
                    "A categoria da subcategoria não pode ser alterada enquanto houver contas ou compromissos vinculados");
        }
        try {
            return jdbc.update("""
                    UPDATE subcategorias
                       SET nome = ?, descricao = ?, categoria_id = ?
                     WHERE id = ?
                       AND usuario_id = (SELECT id FROM usuario WHERE usuario = ?)
                    """, nome.trim(), normalizar(descricao), categoriaId, id, usuario) > 0;
        } catch (DuplicateKeyException e) {
            throw new IllegalArgumentException("Já existe uma subcategoria com este nome para a categoria selecionada");
        }
    }

    @Transactional
    public boolean excluir(long id, String usuario) {
        Integer pertenceAoUsuario = jdbc.queryForObject("""
                SELECT COUNT(*)
                  FROM subcategorias s
                  JOIN usuario u ON u.id = s.usuario_id
                 WHERE s.id = ? AND u.usuario = ?
                """, Integer.class, id, usuario);
        if (pertenceAoUsuario == null || pertenceAoUsuario == 0) {
            return false;
        }
        if (possuiVinculos(id)) {
            throw new IllegalArgumentException(
                    "A subcategoria está vinculada a contas ou compromissos e não pode ser excluída");
        }
        return jdbc.update("""
                DELETE FROM subcategorias
                 WHERE id = ?
                   AND usuario_id = (SELECT id FROM usuario WHERE usuario = ?)
                """, id, usuario) > 0;
    }

    private void validarCategoriaDoUsuario(long categoriaId, String usuario) {
        Integer quantidade = jdbc.queryForObject("""
                SELECT COUNT(*)
                  FROM categorias c
                  JOIN usuario u ON u.id = c.usuario_id
                 WHERE c.id = ? AND u.usuario = ?
                """, Integer.class, categoriaId, usuario);
        if (quantidade == null || quantidade == 0) {
            throw new IllegalArgumentException("Categoria não encontrada ou pertencente a outro usuário");
        }
    }

    private boolean possuiVinculos(long id) {
        Integer quantidade = jdbc.queryForObject("""
                SELECT (SELECT COUNT(*) FROM contas WHERE subcategoria_id = ?)
                     + (SELECT COUNT(*) FROM compromissos WHERE subcategoria_id = ?)
                """, Integer.class, id, id);
        return quantidade != null && quantidade > 0;
    }

    private SubCategoriaResumo resumo(java.sql.ResultSet r) throws java.sql.SQLException {
        return new SubCategoriaResumo(r.getLong(1), r.getString(2), r.getString(3), r.getLong(4),
                r.getString(5), r.getObject(6, OffsetDateTime.class), r.getInt(7));
    }

    private String normalizar(String descricao) {
        return descricao == null || descricao.isBlank() ? null : descricao.trim();
    }

    public record SubCategoriaResumo(long id, String nome, String descricao, long categoriaId,
            String categoria, OffsetDateTime criadoEm, int quantidadeMovimentacoes) {
    }

    public record CategoriaOpcao(long id, String nome, String tipoUtilizacao) {
    }
}
