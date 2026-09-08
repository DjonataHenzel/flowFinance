package com.flowfinance.backend.model;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.flowfinance.backend.model.MensagemNotificacaoEnum.ContaNotificacao;

class MensagemNotificacaoEnumTest {
    @Test
    void deveMontarMensagemDeContasComParcelasETotal() {
        String mensagem = MensagemNotificacaoEnum.montarMensagemConta(List.of(
                new ContaNotificacao("Energia", 2, 3, new BigDecimal("125.50")),
                new ContaNotificacao("Internet", 1, 1, new BigDecimal("99.90"))), 0);

        assertThat(mensagem)
                .contains("Contas vencendo hoje")
                .contains("Energia — parcela 2/3 — R$ 125,50")
                .contains("Internet — R$ 99,90")
                .contains("Total de contas: 2")
                .contains("Valor total: R$ 225,40");
    }

    @Test
    void deveMontarMensagemDeCompromissoComClassificacaoEEndereco() {
        String mensagem = MensagemNotificacaoEnum.montarMensagemCompromisso(
                "Consulta", OffsetDateTime.parse("2026-09-03T14:30:00-03:00"),
                "Saúde", "Dentista", "Rua Central, 10");

        assertThat(mensagem)
                .isEqualTo("Consulta em 03/09/2026 às 14:30\nCategoria: Saúde\n"
                        + "Subcategoria: Dentista\nEndereço: Rua Central, 10");
    }
}
