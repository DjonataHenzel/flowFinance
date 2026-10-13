package com.flowfinance.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.net.http.HttpClient;
import java.net.http.HttpResponse;
import java.sql.ResultSet;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

@SuppressWarnings({ "rawtypes", "unchecked" })
class ContaServiceNotificacaoTest {
    private JdbcTemplate jdbc;
    private HttpClient http;
    private ContaService service;

    @BeforeEach
    void preparar() {
        jdbc = mock(JdbcTemplate.class);
        http = mock(HttpClient.class);
        service = new ContaService(jdbc, "https://ntfy.test", http,
                Clock.fixed(Instant.parse("2026-08-24T12:00:00Z"), ZoneId.of("America/Sao_Paulo")));
    }

    @Test
    void deveEncontrarCanalNtfyDaPessoaVinculadaEEnviarNotificacao() throws Exception {
        ResultSet topico = mock(ResultSet.class);
        when(topico.getString(1)).thenReturn("pessoa-topico");
        ResultSet conta = mock(ResultSet.class);
        when(conta.getString(2)).thenReturn("Seguro residencial");
        when(conta.getInt(3)).thenReturn(1);
        when(conta.getInt(4)).thenReturn(1);
        when(conta.getBigDecimal(5)).thenReturn(new BigDecimal("1771.52"));
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenAnswer(invocacao -> {
            String sql = invocacao.getArgument(0);
            ResultSet resultado = sql.contains("SELECT DISTINCT n.topico") ? topico
                    : sql.contains("SELECT DISTINCT c.id") ? conta : null;
            return resultado == null ? List.of()
                    : List.of(((RowMapper) invocacao.getArgument(1)).mapRow(resultado, 0));
        });
        HttpResponse resposta = mock(HttpResponse.class);
        when(resposta.statusCode()).thenReturn(200);
        when(http.send(any(), any())).thenReturn(resposta);

        ContaService.ResultadoNotificacao resultado = service.enviarNotificacaoNtfy("djonata");

        assertEquals(true, resultado.enviado());
        assertEquals(1, resultado.quantidade());
        verify(http).send(any(), any());
        verify(jdbc, org.mockito.Mockito.times(2)).query(contains("pc.data_vencimento IN"),
                any(RowMapper.class), any(Object[].class));
    }
}