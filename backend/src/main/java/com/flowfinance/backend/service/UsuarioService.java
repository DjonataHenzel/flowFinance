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
    public void cadastrar(String usuario, String senha, long papelId, boolean notificar, List<String> contatos,
            boolean notificarNtfy, String topicoNtfy,LocalTime horaNotificacao,Integer diasAntecedencia) throws DuplicateKeyException {
        List<String> numeros = normalizarContatos(contatos, notificar);
        String topico = validarTopicoNtfy(topicoNtfy, notificarNtfy);
        Long id = jdbcTemplate.queryForObject("INSERT INTO usuario (usuario,senha,papel_id,notificar_conta_vencendo_whatsapp,notificar_conta_vencendo_ntfy,topico_ntfy,hora_notificacao,dias_antecedencia) VALUES (?,?,?,?,?,?,?,?) RETURNING id",
                Long.class, usuario.trim(), passwordEncoder.encode(senha), papelId, notificar, notificarNtfy, topico,normalizarHora(horaNotificacao),normalizarDias(diasAntecedencia));
        salvarContatos(id, numeros);
    }

    public List<UsuarioResumo> listar() {
        return jdbcTemplate.query("SELECT u.id,u.usuario,u.ativo,u.criado_em,u.papel_id,p.nome,u.notificar_conta_vencendo_whatsapp,COALESCE(array_agg(c.numero ORDER BY c.id) FILTER (WHERE c.id IS NOT NULL),ARRAY[]::VARCHAR[]) contatos,u.notificar_conta_vencendo_ntfy,u.topico_ntfy,u.hora_notificacao,u.dias_antecedencia FROM usuario u LEFT JOIN papeis p ON p.id=u.papel_id LEFT JOIN contatos_whatsapp_usuario c ON c.usuario_id=u.id GROUP BY u.id,p.nome ORDER BY u.usuario",
                (resultado, linha) -> new UsuarioResumo(
                        resultado.getLong("id"), resultado.getString("usuario"),
                        resultado.getBoolean("ativo"), resultado.getObject("criado_em", OffsetDateTime.class),resultado.getObject("papel_id",Long.class),resultado.getString("nome"),
                        resultado.getBoolean("notificar_conta_vencendo_whatsapp"), List.of((String[]) resultado.getArray("contatos").getArray()),
                        resultado.getBoolean("notificar_conta_vencendo_ntfy"), resultado.getString("topico_ntfy"),resultado.getObject("hora_notificacao",LocalTime.class),resultado.getInt("dias_antecedencia")));
    }

    @Transactional
    public boolean alterar(long id, String usuario, String senha, boolean ativo,long papelId, boolean notificar, List<String> contatos,
            boolean notificarNtfy, String topicoNtfy,LocalTime horaNotificacao,Integer diasAntecedencia) throws DuplicateKeyException {
        List<String> numeros = normalizarContatos(contatos, notificar);
        String topico = validarTopicoNtfy(topicoNtfy, notificarNtfy);
        int alterados = senha == null || senha.isBlank()
                ? jdbcTemplate.update("UPDATE usuario SET usuario=?,ativo=?,papel_id=?,notificar_conta_vencendo_whatsapp=?,notificar_conta_vencendo_ntfy=?,topico_ntfy=?,hora_notificacao=?,dias_antecedencia=? WHERE id=?", usuario.trim(),ativo,papelId,notificar,notificarNtfy,topico,normalizarHora(horaNotificacao),normalizarDias(diasAntecedencia),id)
                : jdbcTemplate.update("UPDATE usuario SET usuario=?,senha=?,ativo=?,papel_id=?,notificar_conta_vencendo_whatsapp=?,notificar_conta_vencendo_ntfy=?,topico_ntfy=?,hora_notificacao=?,dias_antecedencia=? WHERE id=?", usuario.trim(),passwordEncoder.encode(senha),ativo,papelId,notificar,notificarNtfy,topico,normalizarHora(horaNotificacao),normalizarDias(diasAntecedencia),id);
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

    @Transactional
    public boolean excluir(long id) {
        jdbcTemplate.update("UPDATE contas SET usuario_cadastro = NULL WHERE usuario_cadastro = ?", id);
        return jdbcTemplate.update("DELETE FROM usuario WHERE id = ?", id) > 0;
    }

    public record UsuarioResumo(long id, String usuario, boolean ativo, OffsetDateTime criadoEm,Long papelId,String papel,
            boolean notificarContaVencendoWhatsapp, List<String> contatosWhatsapp,
            boolean notificarContaVencendoNtfy, String topicoNtfy,LocalTime horaNotificacao,int diasAntecedencia) {}
}
