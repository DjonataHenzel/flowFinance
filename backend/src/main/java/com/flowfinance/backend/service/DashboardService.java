package com.flowfinance.backend.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

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

    public ResumoFinanceiro buscarResumoMesAtual(String usuario) {
        LocalDate hoje = LocalDate.now();
        return buscarResumo(hoje.withDayOfMonth(1), hoje.withDayOfMonth(hoje.lengthOfMonth()), null, usuario);
    }

    public ResumoFinanceiro buscarResumo(LocalDate dataInicio, LocalDate dataFim, SituacaoContaEnum situacao,
            String usuario) {
        if (dataFim.isBefore(dataInicio))
            throw new IllegalArgumentException("A data final não pode ser anterior à data inicial.");
        Totais totais = jdbc.queryForObject("""
                SELECT COALESCE(SUM(p.valor) FILTER (WHERE c.tipo = 'RECEBER'), 0),
                       COALESCE(SUM(p.valor) FILTER (WHERE c.tipo = 'PAGAR'), 0)
                 FROM parcelas_contas p
                  JOIN contas c ON c.id = p.conta_id
                  JOIN usuario u ON u.id = c.usuario_cadastro
                 WHERE COALESCE(CAST(p.baixada_em AS DATE), p.data_vencimento) BETWEEN ? AND ?
                   AND (CAST(? AS VARCHAR) IS NULL OR c.situacao = ?)
                   AND (u.usuario = ? OR (SELECT visualizar_cadastros_todos_usuarios FROM usuario WHERE usuario=?))
                """, (resultado, linha) -> new Totais(resultado.getBigDecimal(1), resultado.getBigDecimal(2)),
                dataInicio, dataFim, situacao == null ? null : situacao.name(),
                situacao == null ? null : situacao.name(), usuario, usuario);
        BigDecimal receitas = totais == null ? BigDecimal.ZERO : totais.receitas();
        BigDecimal despesas = totais == null ? BigDecimal.ZERO : totais.despesas();
        List<ResumoCategoria> categorias = jdbc.query("""
                SELECT COALESCE(cat.nome, 'Sem categoria'),
                       COALESCE(sub.nome, 'Sem subcategoria'),
                       COALESCE(SUM(p.valor) FILTER (WHERE c.tipo='RECEBER'), 0),
                       COALESCE(SUM(p.valor) FILTER (WHERE c.tipo='PAGAR'), 0),
                       COUNT(*)
                  FROM parcelas_contas p
                  JOIN contas c ON c.id=p.conta_id
                  JOIN usuario u ON u.id=c.usuario_cadastro
                  LEFT JOIN categorias cat ON cat.id=c.categoria_id
                  LEFT JOIN subcategorias sub ON sub.id=c.subcategoria_id
                 WHERE COALESCE(CAST(p.baixada_em AS DATE),p.data_vencimento) BETWEEN ? AND ?
                   AND (CAST(? AS VARCHAR) IS NULL OR c.situacao=?)
                   AND (u.usuario=? OR (SELECT visualizar_cadastros_todos_usuarios FROM usuario WHERE usuario=?))
                   AND (cat.id IS NULL OR cat.tipo_utilizacao='CONTAS')
                 GROUP BY cat.nome,sub.nome
                 ORDER BY SUM(p.valor) DESC,cat.nome,sub.nome
                """, (r, n) -> new ResumoCategoria(r.getString(1), r.getString(2), r.getBigDecimal(3),
                r.getBigDecimal(4), r.getInt(5)), dataInicio, dataFim,
                situacao == null ? null : situacao.name(), situacao == null ? null : situacao.name(), usuario, usuario);
        String periodo = dataInicio.format(DATA_BRASILEIRA) + " a " + dataFim.format(DATA_BRASILEIRA);
        return new ResumoFinanceiro(periodo, receitas, despesas, receitas.subtract(despesas), categorias);
    }

    public List<ResumoMensal> buscarSerieMensal(LocalDate dataInicio, LocalDate dataFim, String usuario) {
        if (dataFim.isBefore(dataInicio))
            throw new IllegalArgumentException("A data final não pode ser anterior à data inicial.");
        return jdbc.query("""
                SELECT TO_CHAR(DATE_TRUNC('month', COALESCE(CAST(p.baixada_em AS DATE), p.data_vencimento)), 'YYYY-MM'),
                       COALESCE(SUM(p.valor) FILTER (WHERE c.tipo='RECEBER'), 0),
                       COALESCE(SUM(p.valor) FILTER (WHERE c.tipo='PAGAR'), 0)
                  FROM parcelas_contas p
                  JOIN contas c ON c.id=p.conta_id
                  JOIN usuario u ON u.id=c.usuario_cadastro
                 WHERE COALESCE(CAST(p.baixada_em AS DATE), p.data_vencimento) BETWEEN ? AND ?
                   AND (u.usuario=? OR (SELECT visualizar_cadastros_todos_usuarios FROM usuario WHERE usuario=?))
                 GROUP BY DATE_TRUNC('month', COALESCE(CAST(p.baixada_em AS DATE), p.data_vencimento))
                 ORDER BY DATE_TRUNC('month', COALESCE(CAST(p.baixada_em AS DATE), p.data_vencimento))
                """, (r, n) -> new ResumoMensal(r.getString(1), r.getBigDecimal(2), r.getBigDecimal(3)),
                dataInicio, dataFim, usuario, usuario);
    }

    private record Totais(BigDecimal receitas, BigDecimal despesas) {
    }

    public record ResumoCategoria(String categoria, String subcategoria, BigDecimal receitas,
            BigDecimal despesas, int movimentacoes) {
    }

    public record ResumoMensal(String mes, BigDecimal receitas, BigDecimal despesas) {
    }

    public record ResumoFinanceiro(String month, BigDecimal totalIncome, BigDecimal totalExpenses,
            BigDecimal balance, List<ResumoCategoria> categorias) {
        public ResumoFinanceiro(String month, BigDecimal totalIncome, BigDecimal totalExpenses,
                BigDecimal balance) {
            this(month, totalIncome, totalExpenses, balance, List.of());
        }
    }
}
