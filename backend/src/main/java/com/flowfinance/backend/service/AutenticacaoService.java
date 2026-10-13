package com.flowfinance.backend.service;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.flowfinance.backend.model.FuncionalidadeEnum;

@Service
public class AutenticacaoService {
    private final JdbcTemplate jdbc;
    private final PasswordEncoder codificadorSenha;

    public AutenticacaoService(JdbcTemplate jdbc, PasswordEncoder codificadorSenha) {
        this.jdbc = jdbc;
        this.codificadorSenha = codificadorSenha;
    }

    public boolean autenticar(String usuario, String senha) {
        List<String> hashes = jdbc.query(
                "SELECT senha FROM usuario WHERE usuario = ? AND ativo = TRUE",
                (resultado, linha) -> resultado.getString("senha"), usuario);
        return hashes.size() == 1 && codificadorSenha.matches(senha, hashes.getFirst());
    }

    public UsuarioAutenticado dadosUsuario(String usuario) {
        return jdbc.query("""
                SELECT u.papel_id, p.nome, COALESCE(p.ativo, FALSE)
                  FROM usuario u
                  LEFT JOIN papeis p ON p.id = u.papel_id
                 WHERE u.usuario = ? AND u.ativo = TRUE
                """, (resultado, linha) -> {
            Long papelId = resultado.getObject(1, Long.class);
            List<FuncionalidadeEnum> funcionalidades;

            if (papelId == null) {
                funcionalidades = Arrays.stream(FuncionalidadeEnum.values())
                        .filter(funcionalidade -> funcionalidade != FuncionalidadeEnum.PERFIL_CONVIDADO)
                        .toList();
            } else if (resultado.getBoolean(3)) {
                funcionalidades = jdbc.query("""
                        SELECT funcionalidade
                          FROM papel_funcionalidades
                         WHERE papel_id = ?
                        """, (linhaFuncionalidade, numeroLinha) -> FuncionalidadeEnum.valueOf(
                        linhaFuncionalidade.getString(1)), papelId);
            } else {
                funcionalidades = Collections.emptyList();
            }

            if (funcionalidades.contains(FuncionalidadeEnum.PERFIL_CONVIDADO)) {
                funcionalidades = List.of(
                        FuncionalidadeEnum.PERFIL_CONVIDADO,
                        FuncionalidadeEnum.VISUALIZAR_DASHBOARD,
                        FuncionalidadeEnum.CONSULTAR_CONTAS,
                        FuncionalidadeEnum.CONSULTAR_CONTAS_BANCARIAS,
                        FuncionalidadeEnum.CONSULTAR_CATEGORIAS,
                        FuncionalidadeEnum.CONSULTAR_SUBCATEGORIAS,
                        FuncionalidadeEnum.CONSULTAR_USUARIOS,
                        FuncionalidadeEnum.GERENCIAR_PERMISSOES,
                        FuncionalidadeEnum.CONSULTAR_PESSOAS,
                        FuncionalidadeEnum.CONSULTAR_COMPROMISSOS);
            }

            return new UsuarioAutenticado(
                    usuario, papelId, resultado.getString(2), funcionalidades);
        }, usuario).stream().findFirst().orElse(null);
    }

    public boolean temPermissao(String usuario, FuncionalidadeEnum funcionalidade) {
        Integer quantidade = jdbc.queryForObject("""
                SELECT COUNT(*) FROM usuario u
                 LEFT JOIN papeis p ON p.id=u.papel_id AND p.ativo=TRUE
                 LEFT JOIN papel_funcionalidades pf ON pf.papel_id=p.id AND pf.funcionalidade=?
                WHERE u.usuario=? AND u.ativo=TRUE AND (u.papel_id IS NULL OR pf.funcionalidade IS NOT NULL)
                """, Integer.class, funcionalidade.name(), usuario);
        return quantidade != null && quantidade > 0;
    }

    public boolean ehConvidado(String usuario) {
        Integer quantidade = jdbc.queryForObject("""
                SELECT COUNT(*) FROM usuario u
                  JOIN papeis p ON p.id=u.papel_id AND p.ativo=TRUE
                  JOIN papel_funcionalidades pf ON pf.papel_id=p.id
                 WHERE u.usuario=? AND u.ativo=TRUE AND pf.funcionalidade=?
                """, Integer.class, usuario, FuncionalidadeEnum.PERFIL_CONVIDADO.name());
        return quantidade != null && quantidade > 0;
    }

    public record UsuarioAutenticado(String usuario, Long papelId, String papel,
            List<FuncionalidadeEnum> funcionalidades) {
    }
}
