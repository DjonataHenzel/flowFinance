package com.flowfinance.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;

import com.flowfinance.backend.model.FrequenciaRecorrenciaEnum;

class ContaServiceRecorrenciaTest {
    @Test
    void deveCalcularRecorrenciaMensalSempreAPartirDaDataOriginal() {
        LocalDate inicio = LocalDate.of(2026, 1, 31);

        assertEquals(LocalDate.of(2026, 2, 28),
                ContaService.avancar(inicio, FrequenciaRecorrenciaEnum.MENSAL, 1));
        assertEquals(LocalDate.of(2026, 3, 31),
                ContaService.avancar(inicio, FrequenciaRecorrenciaEnum.MENSAL, 2));
    }

    @Test
    void deveCalcularFrequenciasDiariaSemanalEAnual() {
        LocalDate inicio = LocalDate.of(2026, 8, 21);

        assertEquals(LocalDate.of(2026, 8, 24),
                ContaService.avancar(inicio, FrequenciaRecorrenciaEnum.DIARIA, 3));
        assertEquals(LocalDate.of(2026, 9, 4),
                ContaService.avancar(inicio, FrequenciaRecorrenciaEnum.SEMANAL, 2));
        assertEquals(LocalDate.of(2028, 8, 21),
                ContaService.avancar(inicio, FrequenciaRecorrenciaEnum.ANUAL, 2));
    }
}
