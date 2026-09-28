package com.flowfinance.backend.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Arrays;
import java.util.Collections;
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
        return jdbc.query(
                "SELECT u.papel_id,p.nome,COALESCE(p.ativo,FALSE) FROM usuario u LEFT JOIN papeis p ON p.id=u.papel_id WHERE u.usuario=? AND u.ativo=TRUE",
                (r, n) -> {
                    Long papelId = r.getObject(1, Long.class);
                    List<FuncionalidadeEnum> funcoes = papelId == null ? Arrays.asList(FuncionalidadeEnum.values())
                            : r.getBoolean(3)
                                    ? jdbc.query("SELECT funcionalidade FROM papel_funcionalidades WHERE papel_id=?",
                                            (f, x) -> FuncionalidadeEnum.valueOf(f.getString(1)), papelId)
                                    : Collections.emptyList();
                    return new UsuarioAutenticado(usuario, papelId, r.getString(2), funcoes);
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

    public record UsuarioAutenticado(String usuario, Long papelId, String papel,
            List<FuncionalidadeEnum> funcionalidades) {
    }
}
