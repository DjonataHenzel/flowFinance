package com.flowfinance.backend.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class RelatorioService {
    private final JdbcTemplate jdbc;

    public RelatorioService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<ContaRelatorio> contas(LocalDate inicio, LocalDate fim, String usuario) {
        return jdbc.query("""
                SELECT c.id,c.descricao,c.tipo,p.numero,c.qtd_parcelas,p.valor,
                       p.data_vencimento,p.situacao,p.baixada_em,c.debito_automatico,cb.banco
                  FROM contas c
                  JOIN parcelas_contas p ON p.conta_id=c.id
                  JOIN usuario u ON u.id=c.usuario_cadastro
                  LEFT JOIN contas_bancarias cb ON cb.id=c.conta_bancaria_id
                 WHERE (u.usuario=? OR (SELECT visualizar_cadastros_todos_usuarios FROM usuario WHERE usuario=?))
                   AND p.data_vencimento BETWEEN ? AND ?
                 ORDER BY CASE WHEN p.situacao='PENDENTE' THEN 1 ELSE 0 END,
                          p.data_vencimento,c.descricao,p.numero
                """, (r, n) -> new ContaRelatorio(r.getLong(1),r.getString(2),r.getString(3),
                        r.getInt(4),r.getInt(5),r.getBigDecimal(6),r.getObject(7,LocalDate.class),
                        r.getString(8),r.getObject(9,OffsetDateTime.class),r.getBoolean(10),r.getString(11)),usuario,usuario,inicio,fim);
    }

    public List<CompromissoRelatorio> compromissos(LocalDate inicio, LocalDate fim) {
        return jdbc.query("""
                SELECT c.id,c.data_hora,c.descricao,
                       (SELECT STRING_AGG(p.nome, ', ' ORDER BY p.nome) FROM compromissos_pessoas_notificacao cp JOIN pessoas p ON p.id=cp.pessoa_id WHERE cp.compromisso_id=c.id),
                       c.situacao,cat.nome
                  FROM compromissos c
                  LEFT JOIN categorias cat ON cat.id=c.categoria_id
                 WHERE c.data_hora>=? AND c.data_hora<?
                 ORDER BY c.situacao,c.data_hora,c.descricao
                """, (r, n) -> new CompromissoRelatorio(r.getLong(1),
                        r.getObject(2,OffsetDateTime.class),r.getString(3),r.getString(4),r.getString(5),r.getString(6)),
                inicio.atStartOfDay(),fim.plusDays(1).atStartOfDay());
    }

    public record ContaRelatorio(long id,String descricao,String tipo,int parcela,int totalParcelas,
            BigDecimal valor,LocalDate dataVencimento,String situacao,OffsetDateTime baixadaEm,
            boolean debitoAutomatico,String banco) {}
    public record CompromissoRelatorio(long id,OffsetDateTime dataHora,String descricao,String pessoa,String situacao,String categoria) {}
}
