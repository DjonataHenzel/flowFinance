package com.flowfinance.backend.service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class NotificacaoAgendadaService {
    private static final Logger LOG = LoggerFactory.getLogger(NotificacaoAgendadaService.class);
    private final JdbcTemplate jdbc;
    private final ContaService contas;
    private final ZoneId zona;

    public NotificacaoAgendadaService(JdbcTemplate jdbc, ContaService contas,
            @Value("${app.time-zone:America/Sao_Paulo}") String timeZone) {
        this.jdbc = jdbc;
        this.contas = contas;
        this.zona = ZoneId.of(timeZone);
    }

    @Scheduled(cron = "0 0 8 * * *", zone = "${app.time-zone:America/Sao_Paulo}")
    public void enviarPendentes() {
        LocalDate hoje = LocalDate.now(zona);
        List<PessoaAgendada> pessoas = jdbc.query("""
                SELECT DISTINCT p.id,p.nome
                  FROM pessoas p
                  JOIN pessoas_ntfy n ON n.pessoa_id=p.id
                  JOIN contas_pessoas_notificacao cp ON cp.pessoa_id=p.id
                  JOIN contas c ON c.id=cp.conta_id
                  JOIN parcelas_contas pc ON pc.conta_id=c.id
                 WHERE p.canal_preferencial='NTFY' AND c.tipo='PAGAR'
                   AND pc.situacao='PENDENTE' AND pc.data_vencimento=?
                   AND NOT EXISTS(SELECT 1 FROM historico_notificacoes_contas_pessoa h
                                   WHERE h.pessoa_id=p.id AND h.data_referencia=? AND h.canal='NTFY')
                """, (r, n) -> new PessoaAgendada(r.getLong(1), r.getString(2)), hoje, hoje);
        for (PessoaAgendada pessoa : pessoas)
            try {
                ContaService.ResultadoNotificacao resultado = contas.enviarNotificacaoNtfy(pessoa.id(), hoje);
                if (resultado.enviado())
                    jdbc.update(
                            "INSERT INTO historico_notificacoes_contas_pessoa(pessoa_id,data_referencia,canal,quantidade,mensagem) VALUES(?,?,'NTFY',?,?) ON CONFLICT DO NOTHING",
                            pessoa.id(), hoje, resultado.quantidade(), resultado.mensagem());
            } catch (RuntimeException exception) {
                LOG.warn("Falha ao notificar a pessoa {} pelo ntfy: {}", pessoa.nome(), exception.getMessage());
            }
    }

    private record PessoaAgendada(long id, String nome) {
    }
}
