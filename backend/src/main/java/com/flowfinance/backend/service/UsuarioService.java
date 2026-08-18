package com.flowfinance.backend.service;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UsuarioService {
    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;

    public UsuarioService(JdbcTemplate jdbcTemplate, PasswordEncoder passwordEncoder) {
        this.jdbcTemplate = jdbcTemplate;
        this.passwordEncoder = passwordEncoder;
    }

    public void cadastrar(String usuario, String senha, long papelId) throws DuplicateKeyException {
        jdbcTemplate.update("INSERT INTO usuario (usuario, senha, papel_id) VALUES (?, ?, ?)",
                usuario.trim(), passwordEncoder.encode(senha), papelId);
    }

    public List<UsuarioResumo> listar() {
        return jdbcTemplate.query("SELECT u.id,u.usuario,u.ativo,u.criado_em,u.papel_id,p.nome FROM usuario u LEFT JOIN papeis p ON p.id=u.papel_id ORDER BY u.usuario",
                (resultado, linha) -> new UsuarioResumo(
                        resultado.getLong("id"), resultado.getString("usuario"),
                        resultado.getBoolean("ativo"), resultado.getObject("criado_em", OffsetDateTime.class),resultado.getObject("papel_id",Long.class),resultado.getString("nome")));
    }

    public boolean alterar(long id, String usuario, String senha, boolean ativo,long papelId) throws DuplicateKeyException {
        if (senha == null || senha.isBlank()) return jdbcTemplate.update("UPDATE usuario SET usuario = ?, ativo = ?, papel_id=? WHERE id = ?", usuario.trim(), ativo,papelId,id) > 0;
        return jdbcTemplate.update("UPDATE usuario SET usuario = ?, senha = ?, ativo = ?, papel_id=? WHERE id = ?", usuario.trim(), passwordEncoder.encode(senha), ativo,papelId,id) > 0;
    }

    @Transactional
    public boolean excluir(long id) {
        jdbcTemplate.update("UPDATE contas SET usuario_cadastro = NULL WHERE usuario_cadastro = ?", id);
        return jdbcTemplate.update("DELETE FROM usuario WHERE id = ?", id) > 0;
    }

    public record UsuarioResumo(long id, String usuario, boolean ativo, OffsetDateTime criadoEm,Long papelId,String papel) {}
}
