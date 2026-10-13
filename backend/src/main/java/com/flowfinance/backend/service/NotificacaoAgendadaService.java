package com.flowfinance.backend.service;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Collections;
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
    private final Clock clock;

    @org.springframework.beans.factory.annotation.Autowired
    public NotificacaoAgendadaService(JdbcTemplate jdbc, ContaService contas,
            @Value("${app.time-zone:America/Sao_Paulo}") String timeZone) {
        this(jdbc, contas, Clock.system(ZoneId.of(timeZone)));
    }

    NotificacaoAgendadaService(JdbcTemplate jdbc, ContaService contas, Clock clock) {
        this.jdbc = jdbc;
        this.contas = contas;
        this.clock = clock;
    }

    @Scheduled(cron = "0 0 9 * * *", zone = "${app.time-zone:America/Sao_Paulo}")
    public void enviarPendentes() {
        LocalDate hoje = LocalDate.now(clock);
        List<LocalDate> vencimentos = CalendarioDiasUteis.vencimentosParaNotificar(hoje);
        if (vencimentos.isEmpty())
            return;
        String sql = """
                SELECT DISTINCT p.id,p.nome
                  FROM pessoas p
                  JOIN pessoas_ntfy n ON n.pessoa_id=p.id
                  JOIN contas_pessoas_notificacao cp ON cp.pessoa_id=p.id
                  JOIN contas c ON c.id=cp.conta_id
                  JOIN parcelas_contas pc ON pc.conta_id=c.id
                 WHERE p.canal_preferencial='NTFY' AND c.tipo='PAGAR'
                   AND pc.situacao='PENDENTE' AND pc.data_vencimento IN (%s)
                   AND NOT EXISTS(SELECT 1 FROM historico_notificacoes_contas_pessoa h
                           WHERE h.pessoa_id=p.id AND h.data_referencia=? AND h.canal='NTFY')
                """.formatted(placeholders(vencimentos.size()));
        List<Object> parametros = new ArrayList<>(vencimentos);
        parametros.add(hoje);
        List<PessoaAgendada> pessoas = jdbc.query(sql,
                (r, n) -> new PessoaAgendada(r.getLong(1), r.getString(2)), parametros.toArray());
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

    private static String placeholders(int quantidade) {
        return String.join(",", Collections.nCopies(quantidade, "?"));
    }
}
