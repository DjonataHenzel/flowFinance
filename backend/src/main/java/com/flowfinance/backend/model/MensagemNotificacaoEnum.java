package com.flowfinance.backend.model;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * Tipos de mensagem enviados pelos canais de notificação do FlowFinance.
 * A montagem dos textos fica centralizada aqui para manter todos os canais
 * consistentes.
 */
public enum MensagemNotificacaoEnum {
    CONTA,
    COMPROMISSO;

    private static final Locale LOCALE_BRASIL = Locale.of("pt", "BR");
    private static final DateTimeFormatter DATA_HORA = DateTimeFormatter.ofPattern("dd/MM/yyyy 'às' HH:mm");

    public static String montarMensagemConta(List<ContaNotificacao> contas, int diasAntecedencia) {
        if (contas == null || contas.isEmpty()) {
            return diasAntecedencia == 0
                    ? "Nenhuma conta pendente vence hoje."
                    : "Nenhuma conta pendente vence na data configurada.";
        }

        String titulo = diasAntecedencia == 0
                ? "*Contas vencendo hoje*"
                : "*Contas vencendo em " + diasAntecedencia + " dia(s)*";
        StringBuilder mensagem = new StringBuilder(titulo).append("\n\n");
        BigDecimal valorTotal = BigDecimal.ZERO;
        for (ContaNotificacao conta : contas) {
            mensagem.append("• ").append(conta.descricao());
            if (conta.totalParcelas() > 1) {
                mensagem.append(" — parcela ").append(conta.parcela()).append('/').append(conta.totalParcelas());
            }
            mensagem.append(" — R$ ")
                    .append(String.format(LOCALE_BRASIL, "%,.2f", conta.valor()))
                    .append('\n');
            valorTotal = valorTotal.add(conta.valor());
        }
        mensagem.append("\nTotal de contas: ").append(contas.size());
        mensagem.append("\nValor total: R$ ")
                .append(String.format(LOCALE_BRASIL, "%,.2f", valorTotal));
        return mensagem.toString();
    }

    public static String montarMensagemCompromisso(String descricao, OffsetDateTime dataHora,
            String categoria, String subcategoria, String endereco) {
        StringBuilder mensagem = new StringBuilder(descricao.trim())
                .append(" em ").append(DATA_HORA.format(dataHora));
        if (categoria != null && !categoria.isBlank()) {
            mensagem.append("\nCategoria: ").append(categoria.trim());
        }
        if (subcategoria != null && !subcategoria.isBlank()) {
            mensagem.append("\nSubcategoria: ").append(subcategoria.trim());
        }
        if (endereco != null && !endereco.isBlank()) {
            mensagem.append("\nEndereço: ").append(endereco.trim());
        }
        return mensagem.toString();
    }

    public record ContaNotificacao(String descricao, int parcela, int totalParcelas, BigDecimal valor) {
    }
}
