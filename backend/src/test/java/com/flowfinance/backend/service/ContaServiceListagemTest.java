package com.flowfinance.backend.service;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

@SuppressWarnings({ "unchecked", "null" })
class ContaServiceListagemTest {
    private JdbcTemplate jdbc;
    private ContaService service;

    @BeforeEach
    void preparar() {
        jdbc = mock(JdbcTemplate.class);
        service = new ContaService(jdbc, "https://ntfy.test");
    }

    @Test
    void deveSomarParcelasDoPeriodoSelecionado() {
        LocalDate inicio = LocalDate.of(2026, 8, 1);
        LocalDate fim = LocalDate.of(2026, 8, 31);
        when(jdbc.queryForObject(anyString(), eq(Boolean.class), eq("djonata"))).thenReturn(false);
        when(jdbc.query(anyString(), any(RowMapper.class), any(Object[].class))).thenReturn(List.of());

        service.listar("djonata", inicio, fim);

        ArgumentCaptor<String> sql = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Object[]> parametros = ArgumentCaptor.forClass(Object[].class);
        verify(jdbc).query(sql.capture(), any(RowMapper.class), parametros.capture());
        assertTrue(sql.getValue().contains("SELECT COALESCE(SUM(vp.valor),0)"));
        assertTrue(sql.getValue().contains("SELECT c.id,c.descricao,c.valor_total,"));
        assertTrue(sql.getValue().contains("pv.situacao='PENDENTE'"));
        assertArrayEquals(new Object[] { inicio, fim, "djonata", inicio, fim }, parametros.getValue());
    }
}