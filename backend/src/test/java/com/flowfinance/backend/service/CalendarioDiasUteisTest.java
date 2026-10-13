package com.flowfinance.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class CalendarioDiasUteisTest {
    @Test
    void deveNotificarVencimentoDeFimDeSemanaNaSegundaFeira() {
        assertEquals(List.of(LocalDate.of(2026, 8, 24), LocalDate.of(2026, 8, 23), LocalDate.of(2026, 8, 22)),
                CalendarioDiasUteis.vencimentosParaNotificar(LocalDate.of(2026, 8, 24)));
    }

    @Test
    void deveNotificarVencimentoDeFeriadoNacionalNoProximoDiaUtil() {
        assertEquals(List.of(LocalDate.of(2026, 11, 23), LocalDate.of(2026, 11, 22),
                LocalDate.of(2026, 11, 21), LocalDate.of(2026, 11, 20)),
                CalendarioDiasUteis.vencimentosParaNotificar(LocalDate.of(2026, 11, 23)));
    }

    @Test
    void deveAdiarSextaFeiraSantaAteSegundaFeira() {
        assertEquals(List.of(LocalDate.of(2026, 4, 6), LocalDate.of(2026, 4, 5),
                LocalDate.of(2026, 4, 4), LocalDate.of(2026, 4, 3)),
                CalendarioDiasUteis.vencimentosParaNotificar(LocalDate.of(2026, 4, 6)));
    }

    @Test
    void naoDeveRetornarDatasEmDiaNaoUtil() {
        assertEquals(List.of(), CalendarioDiasUteis.vencimentosParaNotificar(LocalDate.of(2026, 11, 20)));
    }
}