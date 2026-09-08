package com.flowfinance.backend.service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
public class NotificacaoAgendadaService {
    private static final Logger LOG=LoggerFactory.getLogger(NotificacaoAgendadaService.class);
    private final JdbcTemplate jdbc;
    private final ContaService contas;
    private final ZoneId zona;

    public NotificacaoAgendadaService(JdbcTemplate jdbc, ContaService contas,
            @Value("${app.time-zone:America/Sao_Paulo}") String timeZone) {
        this.jdbc=jdbc;
        this.contas=contas;
        this.zona=ZoneId.of(timeZone);
    }

    @Scheduled(cron = "0 * * * * *", zone = "${app.time-zone:America/Sao_Paulo}")
    public void enviarPendentes() {
        LocalDate hoje=LocalDate.now(zona);
        LocalTime agora=LocalTime.now(zona).withSecond(0).withNano(0);
        List<UsuarioAgendado> usuarios=jdbc.query("""
                SELECT u.id,u.usuario FROM usuario u
                 WHERE u.ativo=TRUE AND u.notificar_conta_vencendo_ntfy=TRUE AND u.topico_ntfy IS NOT NULL
                   AND u.hora_notificacao<=?
                   AND NOT EXISTS(SELECT 1 FROM historico_notificacoes h WHERE h.usuario_id=u.id AND h.data_referencia=? AND h.canal='NTFY')
                """,(r,n)->new UsuarioAgendado(r.getLong(1),r.getString(2)),agora,hoje);
        for(UsuarioAgendado usuario:usuarios) try {
            ContaService.ResultadoNotificacao resultado=contas.enviarNotificacaoNtfy(usuario.nome());
            if(resultado.enviado())jdbc.update("INSERT INTO historico_notificacoes(usuario_id,data_referencia,canal,quantidade,mensagem) VALUES(?,?,'NTFY',?,?) ON CONFLICT DO NOTHING",
                    usuario.id(),hoje,resultado.quantidade(),resultado.mensagem());
        } catch (RuntimeException exception) {
            // Uma falha temporária será tentada novamente no próximo minuto.
            LOG.warn("Falha ao notificar o usuário {} pelo ntfy: {}",usuario.nome(),exception.getMessage());
        }
    }

    private record UsuarioAgendado(long id,String nome) {}
}
