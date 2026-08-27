package com.flowfinance.backend.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

class ContaServiceEstornoTest {
    private JdbcTemplate jdbc;
    private ContaService service;

    @BeforeEach
    void configurar() {
        jdbc = mock(JdbcTemplate.class);
        service = new ContaService(jdbc, "https://ntfy.test");
        when(jdbc.queryForObject(anyString(), eq(Integer.class), eq("admin"), eq(10L), eq("admin")))
                .thenReturn(1);
    }

    @Test
    @SuppressWarnings({"rawtypes", "unchecked"})
    void deveRestaurarSituacaoParceladaAoEstornarContaComVariasParcelas() throws Exception {
        ResultSet resultado = mock(ResultSet.class);
        when(resultado.getBoolean(1)).thenReturn(true);
        when(resultado.getInt(2)).thenReturn(3);
        when(jdbc.query(anyString(), any(RowMapper.class), eq(10L), eq(10L)))
                .thenAnswer(invocacao -> List.of(
                        ((RowMapper) invocacao.getArgument(1)).mapRow(resultado, 0)));

        service.estornarBaixa(10L, "admin");

        verify(jdbc).update("UPDATE contas SET situacao=?, baixada_em=NULL WHERE id=?", "PARCELADA", 10L);
    }
}
