package com.flowfinance.backend.service;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.ResultSet;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class CompromissoServiceNotificacaoTest {
    private JdbcTemplate jdbc;
    private HttpClient http;
    private CompromissoService service;

    @BeforeEach
    void preparar() {
        jdbc = mock(JdbcTemplate.class);
        http = mock(HttpClient.class);
        service = new CompromissoService(jdbc, "https://ntfy.test", http);
    }

    @Test
    void deveNotificarCadaPessoaEConcluirSomenteDepoisDaUltima() throws Exception {
        prepararDestinos(destino(7L, "ana"), destino(8L, "bia"));
        HttpResponse<String> resposta = resposta(200);
        when(http.send(any(HttpRequest.class), anyHandler())).thenReturn(resposta);
        when(jdbc.queryForObject(contains("notificado_em IS NULL"), eq(Integer.class), eq(44L)))
                .thenReturn(1, 0);

        service.notificarPendentes();

        verify(http, times(2)).send(any(HttpRequest.class), anyHandler());
        verify(jdbc).query(contains("c.situacao IN ('PENDENTE','REAGENDADO','NOTIFICADO')"), any(RowMapper.class));
        verify(jdbc).query(contains("cp.notificado_em IS NULL OR cp.notificado_em<CURRENT_DATE"), any(RowMapper.class));
        verify(jdbc).update(contains("compromisso_id=? AND pessoa_id=?"), eq(44L), eq(7L));
        verify(jdbc).update(contains("compromisso_id=? AND pessoa_id=?"), eq(44L), eq(8L));
        verify(jdbc, times(1)).update(contains("situacao IN ('PENDENTE','REAGENDADO','NOTIFICADO')"), eq(44L));
    }

    @Test
    void deveManterDestinoComFalhaPendenteParaNovaTentativa() throws Exception {
        prepararDestinos(destino(7L, "ana"), destino(8L, "bia"));
        HttpResponse<String> sucesso = resposta(200);
        HttpResponse<String> indisponivel = resposta(503);
        when(http.send(any(HttpRequest.class), anyHandler()))
                .thenReturn(sucesso, indisponivel);
        when(jdbc.queryForObject(contains("notificado_em IS NULL"), eq(Integer.class), eq(44L)))
                .thenReturn(1);

        service.notificarPendentes();

        verify(jdbc).update(contains("compromisso_id=? AND pessoa_id=?"), eq(44L), eq(7L));
        verify(jdbc, never()).update(contains("compromisso_id=? AND pessoa_id=?"), eq(44L), eq(8L));
        verify(jdbc, never()).update(contains("situacao='NOTIFICADO'"), anyLong());
    }

    @SuppressWarnings({ "rawtypes", "unchecked" })
    private void prepararDestinos(ResultSet... resultados) {
        when(jdbc.query(anyString(), any(RowMapper.class))).thenAnswer(invocacao -> {
            RowMapper mapper = invocacao.getArgument(1);
            return java.util.stream.IntStream.range(0, resultados.length)
                    .mapToObj(i -> {
                        try {
                            return mapper.mapRow(resultados[i], i);
                        } catch (Exception e) {
                            throw new RuntimeException(e);
                        }
                    }).toList();
        });
    }

    private ResultSet destino(long pessoaId, String topico) throws Exception {
        ResultSet r = mock(ResultSet.class);
        when(r.getLong(1)).thenReturn(44L);
        when(r.getLong(2)).thenReturn(pessoaId);
        when(r.getObject(3, OffsetDateTime.class)).thenReturn(OffsetDateTime.parse("2026-08-25T10:00:00-03:00"));
        when(r.getString(4)).thenReturn("Reunião");
        when(r.getString(5)).thenReturn("Pessoa " + pessoaId);
        when(r.getString(6)).thenReturn(topico);
        return r;
    }

    @SuppressWarnings("unchecked")
    private HttpResponse<String> resposta(int status) {
        HttpResponse<String> resposta = mock(HttpResponse.class);
        when(resposta.statusCode()).thenReturn(status);
        return resposta;
    }

    @SuppressWarnings("unchecked")
    private static HttpResponse.BodyHandler<String> anyHandler() {
        return any(HttpResponse.BodyHandler.class);
    }
}
