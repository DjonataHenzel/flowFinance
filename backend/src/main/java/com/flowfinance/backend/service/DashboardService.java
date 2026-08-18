package com.flowfinance.backend.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import com.flowfinance.backend.model.SituacaoContaEnum;

@Service
public class DashboardService {
    private static final DateTimeFormatter DATA_BRASILEIRA = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private final JdbcTemplate jdbc;

    public DashboardService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public ResumoFinanceiro buscarResumoMesAtual() {
        LocalDate hoje = LocalDate.now();
        return buscarResumo(hoje.withDayOfMonth(1), hoje.withDayOfMonth(hoje.lengthOfMonth()), null);
    }

    public ResumoFinanceiro buscarResumo(LocalDate dataInicio, LocalDate dataFim, SituacaoContaEnum situacao) {
        if (dataFim.isBefore(dataInicio))
            throw new IllegalArgumentException("A data final não pode ser anterior à data inicial.");
        Totais totais = jdbc.queryForObject("""
                SELECT COALESCE(SUM(p.valor) FILTER (WHERE c.tipo = 'RECEBER'), 0),
                       COALESCE(SUM(p.valor) FILTER (WHERE c.tipo = 'PAGAR'), 0)
                 FROM parcelas_contas p
                  JOIN contas c ON c.id = p.conta_id
                 WHERE p.data_vencimento BETWEEN ? AND ?
                   AND (CAST(? AS VARCHAR) IS NULL OR c.situacao = ?)
                """, (resultado, linha) -> new Totais(resultado.getBigDecimal(1), resultado.getBigDecimal(2)),
                dataInicio, dataFim, situacao == null ? null : situacao.name(), situacao == null ? null : situacao.name());
        BigDecimal receitas = totais == null ? BigDecimal.ZERO : totais.receitas();
        BigDecimal despesas = totais == null ? BigDecimal.ZERO : totais.despesas();
        String periodo = dataInicio.format(DATA_BRASILEIRA) + " a " + dataFim.format(DATA_BRASILEIRA);
        return new ResumoFinanceiro(periodo, receitas, despesas, receitas.subtract(despesas));
    }

    private record Totais(BigDecimal receitas, BigDecimal despesas) {
    }

    public record ResumoFinanceiro(String month, BigDecimal totalIncome, BigDecimal totalExpenses,
            BigDecimal balance) {
    }
}
