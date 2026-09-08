package com.flowfinance.backend.service;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import java.time.OffsetDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.LinkedHashSet;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UsuarioService {
    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;

    public UsuarioService(JdbcTemplate jdbcTemplate, PasswordEncoder passwordEncoder) {
        this.jdbcTemplate = jdbcTemplate;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public void cadastrar(String usuario, String senha, long papelId, Long pessoaId, boolean notificar, List<String> contatos,
            boolean notificarNtfy, String topicoNtfy,LocalTime horaNotificacao,Integer diasAntecedencia,
            boolean visualizarCadastrosTodosUsuarios) throws DuplicateKeyException {
        List<String> numeros = normalizarContatos(contatos, notificar);
        String topico = validarTopicoNtfy(topicoNtfy, notificarNtfy);
        validarPessoaVinculada(pessoaId, null);
        Long id = jdbcTemplate.queryForObject("INSERT INTO usuario (usuario,senha,papel_id,pessoa_id,notificar_conta_vencendo_whatsapp,notificar_conta_vencendo_ntfy,topico_ntfy,hora_notificacao,dias_antecedencia,visualizar_cadastros_todos_usuarios) VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id",
                Long.class, usuario.trim(), passwordEncoder.encode(senha), papelId, pessoaId, notificar, notificarNtfy, topico,normalizarHora(horaNotificacao),normalizarDias(diasAntecedencia),visualizarCadastrosTodosUsuarios);
        salvarContatos(id, numeros);
    }

    public List<UsuarioResumo> listar() {
        return jdbcTemplate.query("SELECT u.id,u.usuario,u.ativo,u.criado_em,u.papel_id,p.nome,u.pessoa_id,pessoa.nome AS pessoa,u.notificar_conta_vencendo_whatsapp,COALESCE(array_agg(c.numero ORDER BY c.id) FILTER (WHERE c.id IS NOT NULL),ARRAY[]::VARCHAR[]) contatos,u.notificar_conta_vencendo_ntfy,u.topico_ntfy,u.hora_notificacao,u.dias_antecedencia,u.visualizar_cadastros_todos_usuarios FROM usuario u LEFT JOIN papeis p ON p.id=u.papel_id LEFT JOIN pessoas pessoa ON pessoa.id=u.pessoa_id LEFT JOIN contatos_whatsapp_usuario c ON c.usuario_id=u.id GROUP BY u.id,p.nome,pessoa.nome ORDER BY u.usuario",
                (resultado, linha) -> new UsuarioResumo(
                        resultado.getLong("id"), resultado.getString("usuario"),
                        resultado.getBoolean("ativo"), resultado.getObject("criado_em", OffsetDateTime.class),resultado.getObject("papel_id",Long.class),resultado.getString("nome"),
                        resultado.getObject("pessoa_id",Long.class),resultado.getString("pessoa"),
                        resultado.getBoolean("notificar_conta_vencendo_whatsapp"), List.of((String[]) resultado.getArray("contatos").getArray()),
                        resultado.getBoolean("notificar_conta_vencendo_ntfy"), resultado.getString("topico_ntfy"),resultado.getObject("hora_notificacao",LocalTime.class),resultado.getInt("dias_antecedencia"),resultado.getBoolean("visualizar_cadastros_todos_usuarios")));
    }

    public List<PessoaVinculavel> listarPessoasVinculaveis(Long usuarioId) {
        return jdbcTemplate.query("""
                SELECT p.id,p.nome
                  FROM pessoas p
                  LEFT JOIN usuario u ON u.pessoa_id=p.id
                 WHERE u.id IS NULL OR u.id=?
                 ORDER BY LOWER(p.nome),p.id
                """, (r, n) -> new PessoaVinculavel(r.getLong(1), r.getString(2)), usuarioId);
    }

    @Transactional
    public boolean alterar(long id, String usuario, String senha, boolean ativo,long papelId, Long pessoaId, boolean notificar, List<String> contatos,
            boolean notificarNtfy, String topicoNtfy,LocalTime horaNotificacao,Integer diasAntecedencia,
            boolean visualizarCadastrosTodosUsuarios) throws DuplicateKeyException {
        List<String> numeros = normalizarContatos(contatos, notificar);
        String topico = validarTopicoNtfy(topicoNtfy, notificarNtfy);
        validarPessoaVinculada(pessoaId, id);
        int alterados = senha == null || senha.isBlank()
                ? jdbcTemplate.update("UPDATE usuario SET usuario=?,ativo=?,papel_id=?,pessoa_id=?,notificar_conta_vencendo_whatsapp=?,notificar_conta_vencendo_ntfy=?,topico_ntfy=?,hora_notificacao=?,dias_antecedencia=?,visualizar_cadastros_todos_usuarios=? WHERE id=?", usuario.trim(),ativo,papelId,pessoaId,notificar,notificarNtfy,topico,normalizarHora(horaNotificacao),normalizarDias(diasAntecedencia),visualizarCadastrosTodosUsuarios,id)
                : jdbcTemplate.update("UPDATE usuario SET usuario=?,senha=?,ativo=?,papel_id=?,pessoa_id=?,notificar_conta_vencendo_whatsapp=?,notificar_conta_vencendo_ntfy=?,topico_ntfy=?,hora_notificacao=?,dias_antecedencia=?,visualizar_cadastros_todos_usuarios=? WHERE id=?", usuario.trim(),passwordEncoder.encode(senha),ativo,papelId,pessoaId,notificar,notificarNtfy,topico,normalizarHora(horaNotificacao),normalizarDias(diasAntecedencia),visualizarCadastrosTodosUsuarios,id);
        if (alterados == 0) return false;
        jdbcTemplate.update("DELETE FROM contatos_whatsapp_usuario WHERE usuario_id=?", id);
        salvarContatos(id, numeros);
        return true;
    }

    private List<String> normalizarContatos(List<String> contatos, boolean notificar) {
        LinkedHashSet<String> numeros = new LinkedHashSet<>();
        if (contatos != null) for (String contato : contatos) {
            String numero = contato == null ? "" : contato.replaceAll("\\D", "");
            if (numero.matches("[1-9]\\d{9,10}")) numero = "55" + numero;
            if (!numero.isBlank() && !numero.matches("55[1-9]\\d{9,10}"))
                throw new IllegalArgumentException("Informe um número brasileiro com DDD");
            if (!numero.isBlank()) numeros.add(numero);
        }
        if (notificar && numeros.isEmpty())
            throw new IllegalArgumentException("Adicione pelo menos um contato de WhatsApp para ativar as notificações");
        return List.copyOf(numeros);
    }

    private void salvarContatos(Long usuarioId, List<String> contatos) {
        for (String numero : contatos)
            jdbcTemplate.update("INSERT INTO contatos_whatsapp_usuario (usuario_id,numero) VALUES (?,?)", usuarioId, numero);
    }

    private String validarTopicoNtfy(String topico, boolean notificar) {
        String valor = topico == null ? "" : topico.trim();
        if (notificar && !valor.matches("flowfinance-[a-f0-9]{32}"))
            throw new IllegalArgumentException("Tópico ntfy inválido; gere um novo tópico no cadastro do usuário");
        return valor.isBlank() ? null : valor;
    }
    private LocalTime normalizarHora(LocalTime hora) { return hora == null ? LocalTime.of(8,0) : hora.withSecond(0).withNano(0); }
    private int normalizarDias(Integer dias) { if(dias==null)return 0;if(dias<0||dias>30)throw new IllegalArgumentException("A antecedência deve estar entre 0 e 30 dias");return dias; }

    private void validarPessoaVinculada(Long pessoaId, Long usuarioId) {
        if (pessoaId == null) return;
        Integer existente = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM pessoas WHERE id=?", Integer.class, pessoaId);
        if (existente == null || existente == 0)
            throw new IllegalArgumentException("Pessoa vinculada não encontrada");
        Integer vinculada = usuarioId == null
                ? jdbcTemplate.queryForObject("SELECT COUNT(*) FROM usuario WHERE pessoa_id=?", Integer.class, pessoaId)
                : jdbcTemplate.queryForObject("SELECT COUNT(*) FROM usuario WHERE pessoa_id=? AND id<>?", Integer.class, pessoaId, usuarioId);
        if (vinculada != null && vinculada > 0)
            throw new IllegalArgumentException("A pessoa selecionada já está vinculada a outro usuário");
    }

    @Transactional
    public boolean excluir(long id) {
        jdbcTemplate.update("UPDATE contas SET usuario_cadastro = NULL WHERE usuario_cadastro = ?", id);
        return jdbcTemplate.update("DELETE FROM usuario WHERE id = ?", id) > 0;
    }

    public record UsuarioResumo(long id, String usuario, boolean ativo, OffsetDateTime criadoEm,Long papelId,String papel,
            Long pessoaId, String pessoa,
            boolean notificarContaVencendoWhatsapp, List<String> contatosWhatsapp,
            boolean notificarContaVencendoNtfy, String topicoNtfy,LocalTime horaNotificacao,int diasAntecedencia,
            boolean visualizarCadastrosTodosUsuarios) {}
    public record PessoaVinculavel(long id, String nome) {}
}
