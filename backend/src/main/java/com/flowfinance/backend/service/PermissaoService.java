package com.flowfinance.backend.service;

import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import com.flowfinance.backend.model.FuncionalidadeEnum;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PermissaoService {
    private final JdbcTemplate jdbc;

    public PermissaoService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<PapelResumo> listar() {
        return jdbc.query("""
                SELECT p.id, p.nome, p.descricao, p.ativo, p.criado_em, COUNT(pf.funcionalidade)
                  FROM papeis p
                  LEFT JOIN papel_funcionalidades pf ON pf.papel_id = p.id
                 GROUP BY p.id
                 ORDER BY p.nome
                """, (resultado, linha) -> new PapelResumo(
                        resultado.getLong(1),
                        resultado.getString(2),
                        resultado.getString(3),
                        resultado.getBoolean(4),
                        resultado.getObject(5, OffsetDateTime.class),
                        resultado.getInt(6),
                        FuncionalidadeEnum.values().length));
    }

    public Optional<PapelDetalhe> buscar(long id) {
        return jdbc.query("SELECT id, nome, descricao, ativo, criado_em FROM papeis WHERE id = ?",
                (resultado, linha) -> new PapelDetalhe(
                        resultado.getLong(1),
                        resultado.getString(2),
                        resultado.getString(3),
                        resultado.getBoolean(4),
                        resultado.getObject(5, OffsetDateTime.class),
                        buscarFuncionalidades(id)),
                id).stream().findFirst();
    }

    @Transactional
    public long cadastrar(String nome, String descricao, boolean ativo,
            Set<FuncionalidadeEnum> funcionalidades) {
        Long id = jdbc.queryForObject(
                "INSERT INTO papeis (nome, descricao, ativo) VALUES (?, ?, ?) RETURNING id",
                Long.class, nome.trim(), normalizar(descricao), ativo);
        gravarFuncionalidades(id, funcionalidades);
        return id;
    }

    @Transactional
    public boolean alterar(long id, String nome, String descricao, boolean ativo,
            Set<FuncionalidadeEnum> funcionalidades) {
        int alterados = jdbc.update("UPDATE papeis SET nome = ?, descricao = ?, ativo = ? WHERE id = ?",
                nome.trim(), normalizar(descricao), ativo, id);
        if (alterados == 0) {
            return false;
        }
        jdbc.update("DELETE FROM papel_funcionalidades WHERE papel_id = ?", id);
        gravarFuncionalidades(id, funcionalidades);
        return true;
    }

    public boolean excluir(long id) {
        return jdbc.update("DELETE FROM papeis WHERE id = ?", id) > 0;
    }

    private Set<FuncionalidadeEnum> buscarFuncionalidades(long papelId) {
        return new HashSet<>(jdbc.query(
                "SELECT funcionalidade FROM papel_funcionalidades WHERE papel_id = ?",
                (resultado, linha) -> FuncionalidadeEnum.valueOf(resultado.getString(1)), papelId));
    }

    private void gravarFuncionalidades(long papelId, Set<FuncionalidadeEnum> funcionalidades) {
        for (FuncionalidadeEnum funcionalidade : funcionalidades) {
            jdbc.update("INSERT INTO papel_funcionalidades (papel_id, funcionalidade) VALUES (?, ?)",
                    papelId, funcionalidade.name());
        }
    }

    private String normalizar(String texto) {
        return texto == null || texto.isBlank() ? null : texto.trim();
    }

    public record PapelResumo(long id, String nome, String descricao, boolean ativo,
            OffsetDateTime criadoEm, int habilitadas, int totalFuncionalidades) {
    }

    public record PapelDetalhe(long id, String nome, String descricao, boolean ativo,
            OffsetDateTime criadoEm, Set<FuncionalidadeEnum> funcionalidades) {
    }
}
