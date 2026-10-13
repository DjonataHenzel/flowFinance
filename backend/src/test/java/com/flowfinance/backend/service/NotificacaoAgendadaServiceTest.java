package com.flowfinance.backend.service;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.sql.ResultSet;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.scheduling.annotation.Scheduled;

class NotificacaoAgendadaServiceTest {
    @Test
    void deveAgendarContasAsNoveNoFusoConfigurado() throws Exception {
        Scheduled agendamento = NotificacaoAgendadaService.class.getMethod("enviarPendentes")
                .getAnnotation(Scheduled.class);

        org.junit.jupiter.api.Assertions.assertEquals("0 0 9 * * *", agendamento.cron());
        org.junit.jupiter.api.Assertions.assertEquals("${app.time-zone:America/Sao_Paulo}", agendamento.zone());
    }

    @SuppressWarnings({ "rawtypes", "unchecked" })
    @Test
    void deveConsultarVencimentosDeFimDeSemanaNaSegundaFeira() throws Exception {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ContaService contas = mock(ContaService.class);
        LocalDate segunda = LocalDate.of(2026, 8, 24);
        NotificacaoAgendadaService service = criarService(jdbc, contas, "2026-08-24T12:00:00Z");
        ResultSet pessoa = mock(ResultSet.class);
        when(pessoa.getLong(1)).thenReturn(17L);
        when(pessoa.getString(2)).thenReturn("Ana");
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class)))
                .thenAnswer(invocacao -> List.of(((RowMapper) invocacao.getArgument(1)).mapRow(pessoa, 0)));
        when(contas.enviarNotificacaoNtfy(17L, segunda))
                .thenReturn(new ContaService.ResultadoNotificacao(true, 1, "enviada"));

        service.enviarPendentes();

        verify(jdbc).query(contains("pc.data_vencimento IN"), any(RowMapper.class), any(Object[].class));
        verify(contas).enviarNotificacaoNtfy(17L, segunda);
        verify(jdbc).update(contains("historico_notificacoes_contas_pessoa"), eq(17L), eq(segunda), eq(1),
                eq("enviada"));
    }

    @Test
    void naoDeveConsultarContasEmDomingo() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        ContaService contas = mock(ContaService.class);
        NotificacaoAgendadaService service = criarService(jdbc, contas, "2026-08-23T12:00:00Z");

        service.enviarPendentes();

        verifyNoInteractions(jdbc, contas);
    }

    private static NotificacaoAgendadaService criarService(JdbcTemplate jdbc, ContaService contas, String instante) {
        Clock clock = Clock.fixed(Instant.parse(instante), ZoneId.of("America/Sao_Paulo"));
        return new NotificacaoAgendadaService(jdbc, contas, clock);
    }
}