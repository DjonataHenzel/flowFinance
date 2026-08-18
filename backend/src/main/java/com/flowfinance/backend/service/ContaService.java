package com.flowfinance.backend.service;

import com.flowfinance.backend.controller.ContaController.*;
import com.flowfinance.backend.model.SituacaoContaEnum;
import com.flowfinance.backend.model.SituacaoParcelaEnum;
import com.flowfinance.backend.model.TipoContaEnum;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

@Service
public class ContaService {
    private final JdbcTemplate jdbc;

    public ContaService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<ContaResumo> listar() {
        return jdbc.query(
                "SELECT c.id, c.descricao, c.valor_total, c.tipo, c.situacao, c.criado_em, c.baixada_em, (c.situacao IN ('PAGA','RECEBIDA') OR EXISTS(SELECT 1 FROM parcelas_contas p WHERE p.conta_id=c.id AND p.situacao<>'PENDENTE')) FROM contas c ORDER BY c.criado_em DESC, c.id DESC",
                (r, n) -> new ContaResumo(r.getLong(1), r.getString(2), r.getBigDecimal(3),
                        TipoContaEnum.valueOf(r.getString(4)), SituacaoContaEnum.valueOf(r.getString(5)),
                        r.getObject(6, OffsetDateTime.class), r.getObject(7, OffsetDateTime.class), r.getBoolean(8)));
    }

    public Optional<ContaDetalhe> buscar(long id) {
        List<ContaDetalhe> contas = jdbc.query(
                "SELECT id, descricao, valor_total, tipo, situacao, criado_em, baixada_em FROM contas WHERE id=?",
                (r, n) -> new ContaDetalhe(r.getLong(1), r.getString(2), r.getBigDecimal(3),
                        TipoContaEnum.valueOf(r.getString(4)), SituacaoContaEnum.valueOf(r.getString(5)),
                        r.getObject(6, OffsetDateTime.class), r.getObject(7, OffsetDateTime.class),
                        jdbc.query(
                                "SELECT numero, valor, data_vencimento, situacao, baixada_em, observacao_baixa FROM parcelas_contas WHERE conta_id=? ORDER BY numero",
                                (p, x) -> new ParcelaContaDetalhe(p.getInt(1), p.getBigDecimal(2),
                                        p.getObject(3, LocalDate.class), SituacaoParcelaEnum.valueOf(p.getString(4)),
                                        p.getObject(5, OffsetDateTime.class), p.getString(6)),
                                id),
                        jdbc.query(
                                "SELECT id, nome_arquivo, descricao, tamanho FROM anexos_contas WHERE conta_id=? ORDER BY id",
                                (a, x) -> new AnexoResumo(a.getLong(1), a.getString(2), a.getString(3), a.getLong(4)),
                                id)),
                id);
        return contas.stream().findFirst();
    }

    public Optional<AnexoConteudo> buscarAnexo(long contaId, long anexoId) {
        return jdbc
                .query("SELECT nome_arquivo, tipo_arquivo, conteudo FROM anexos_contas WHERE id=? AND conta_id=?",
                        (r, n) -> new AnexoConteudo(r.getString(1), r.getString(2), r.getBytes(3)), anexoId, contaId)
                .stream().findFirst();
    }

    @Transactional(rollbackFor = IOException.class)
    public long cadastrar(NovaContaRequest c, MultipartFile[] anexos, List<String> descricoes,
            List<AnexoExistenteRequest> anexosCopiados) throws IOException {
        Long id = jdbc.queryForObject(
                "INSERT INTO contas (descricao, valor_total, qtd_parcelas, usuario_cadastro, tipo, situacao) VALUES (?,?,?,(SELECT MIN(id) FROM usuario),?,?) RETURNING id",
                Long.class, c.descricao().trim(), c.valorTotal(), c.parcelas().size(), c.tipo().name(),
                c.parcelas().size() > 1 ? SituacaoContaEnum.PARCELADA.name() : SituacaoContaEnum.ABERTA.name());
        gravarParcelas(id, c.parcelas());
        gravarAnexos(id, anexos, descricoes);
        for (AnexoExistenteRequest a : anexosCopiados)
            jdbc.update(
                    "INSERT INTO anexos_contas (conta_id,nome_arquivo,descricao,tipo_arquivo,tamanho,conteudo) SELECT ?,nome_arquivo,?,tipo_arquivo,tamanho,conteudo FROM anexos_contas WHERE id=?",
                    id, a.descricao().trim(), a.id());
        return id;
    }

    @Transactional(rollbackFor = IOException.class)
    public boolean alterar(long id, NovaContaRequest c, MultipartFile[] anexos, List<String> descricoes,
            List<AnexoExistenteRequest> existentes) throws IOException {
        if (jdbc.update(
                "UPDATE contas SET descricao=?, valor_total=?, qtd_parcelas=?, tipo=?, situacao=CASE WHEN situacao IN ('PAGA','RECEBIDA') THEN situacao ELSE ? END WHERE id=?",
                c.descricao().trim(), c.valorTotal(), c.parcelas().size(), c.tipo().name(),
                c.parcelas().size() > 1 ? SituacaoContaEnum.PARCELADA.name() : SituacaoContaEnum.ABERTA.name(),
                id) == 0)
            return false;
        jdbc.update("DELETE FROM parcelas_contas WHERE conta_id=?", id);
        gravarParcelas(id, c.parcelas());
        Set<Long> mantidos = new HashSet<>();
        for (AnexoExistenteRequest a : existentes) {
            jdbc.update("UPDATE anexos_contas SET descricao=? WHERE id=? AND conta_id=?", a.descricao().trim(), a.id(),
                    id);
            mantidos.add(a.id());
        }
        List<Long> atuais = jdbc.query("SELECT id FROM anexos_contas WHERE conta_id=?", (r, n) -> r.getLong(1), id);
        for (Long atual : atuais)
            if (!mantidos.contains(atual))
                jdbc.update("DELETE FROM anexos_contas WHERE id=?", atual);
        gravarAnexos(id, anexos, descricoes);
        return true;
    }

    @Transactional
    public Long duplicar(long id) {
        Optional<ContaDetalhe> original = buscar(id);
        if (original.isEmpty())
            return null;
        Long novo = jdbc.queryForObject(
                "INSERT INTO contas (descricao, valor_total, qtd_parcelas, usuario_cadastro, tipo, situacao) SELECT descricao, valor_total, qtd_parcelas, usuario_cadastro, tipo, CASE WHEN qtd_parcelas>1 THEN 'PARCELADA' ELSE 'ABERTA' END FROM contas WHERE id=? RETURNING id",
                Long.class, id);
        jdbc.update(
                "INSERT INTO parcelas_contas (conta_id,numero,valor,data_vencimento) SELECT ?,numero,valor,data_vencimento FROM parcelas_contas WHERE conta_id=?",
                novo, id);
        jdbc.update(
                "INSERT INTO anexos_contas (conta_id,nome_arquivo,descricao,tipo_arquivo,tamanho,conteudo) SELECT ?,nome_arquivo,descricao,tipo_arquivo,tamanho,conteudo FROM anexos_contas WHERE conta_id=?",
                novo, id);
        return novo;
    }

    @Transactional
    public boolean excluir(long id) {
        return jdbc.update("DELETE FROM contas WHERE id=?", id) > 0;
    }

    @Transactional
    public void baixar(long id, boolean total, Integer numeroParcela, String observacao) {
        List<EstadoBaixa> estados = jdbc.query("SELECT tipo, situacao, qtd_parcelas FROM contas WHERE id=?",
                (r, n) -> new EstadoBaixa(TipoContaEnum.valueOf(r.getString(1)),
                        SituacaoContaEnum.valueOf(r.getString(2)), r.getInt(3)),
                id);
        if (estados.isEmpty())
            throw new IllegalArgumentException("Conta não encontrada");
        EstadoBaixa estado = estados.getFirst();
        if (estado.situacao() == SituacaoContaEnum.PAGA || estado.situacao() == SituacaoContaEnum.RECEBIDA)
            throw new IllegalArgumentException("A conta já foi baixada");
        String obs = observacao == null || observacao.isBlank() ? null : observacao.trim();
        int alteradas;
        String situacaoParcela = estado.tipo() == TipoContaEnum.PAGAR ? SituacaoParcelaEnum.PAGA.name()
                : SituacaoParcelaEnum.RECEBIDA.name();
        if (total)
            alteradas = jdbc.update(
                    "UPDATE parcelas_contas SET situacao=?, baixada_em=CURRENT_TIMESTAMP, observacao_baixa=? WHERE conta_id=? AND situacao='PENDENTE'",
                    situacaoParcela, obs, id);
        else {
            if (estado.quantidadeParcelas() < 2)
                throw new IllegalArgumentException("A baixa parcial exige uma conta com mais de uma parcela");
            if (numeroParcela == null)
                throw new IllegalArgumentException("Selecione a parcela que deseja baixar");
            alteradas = jdbc.update(
                    "UPDATE parcelas_contas SET situacao=?, baixada_em=CURRENT_TIMESTAMP, observacao_baixa=? WHERE conta_id=? AND numero=? AND situacao='PENDENTE'",
                    situacaoParcela, obs, id, numeroParcela);
        }
        if (alteradas == 0)
            throw new IllegalArgumentException("A parcela selecionada já foi baixada ou não existe");
        Integer pendentes = jdbc.queryForObject(
                "SELECT COUNT(*) FROM parcelas_contas WHERE conta_id=? AND situacao='PENDENTE'", Integer.class, id);
        boolean concluida = pendentes != null && pendentes == 0;
        jdbc.update(
                "UPDATE contas SET situacao=?, baixada_em=CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END WHERE id=?",
                concluida ? (estado.tipo() == TipoContaEnum.PAGAR ? SituacaoContaEnum.PAGA.name()
                        : SituacaoContaEnum.RECEBIDA.name()) : SituacaoContaEnum.PARCELADA.name(),
                concluida, id);
    }

    @Transactional
    public void estornarBaixa(long id) {
        List<Boolean> resultados = jdbc.query(
                "SELECT situacao IN ('PAGA','RECEBIDA') OR EXISTS(SELECT 1 FROM parcelas_contas WHERE conta_id=? AND situacao<>'PENDENTE') FROM contas WHERE id=?",
                (r, n) -> r.getBoolean(1), id, id);
        if (resultados.isEmpty() || !resultados.getFirst())
            throw new IllegalArgumentException("A conta não possui baixa para estornar");
        jdbc.update(
                "UPDATE parcelas_contas SET situacao='PENDENTE', baixada_em=NULL, observacao_baixa=NULL WHERE conta_id=?",
                id);
        jdbc.update("UPDATE contas SET situacao='ABERTA', baixada_em=NULL WHERE id=?", id);
    }

    private void gravarParcelas(long id, List<ParcelaContaRequest> parcelas) {
        for (ParcelaContaRequest p : parcelas)
            jdbc.update("INSERT INTO parcelas_contas (conta_id,numero,valor,data_vencimento) VALUES (?,?,?,?)", id,
                    p.numero(), p.valor(), p.dataVencimento());
    }

    private void gravarAnexos(long id, MultipartFile[] anexos, List<String> descricoes) throws IOException {
        if (anexos == null)
            return;
        for (int i = 0; i < anexos.length; i++)
            if (!anexos[i].isEmpty()) {
                String d = i < descricoes.size() ? descricoes.get(i).trim() : "";
                if (d.isBlank())
                    throw new IllegalArgumentException("Informe a descrição de todos os anexos");
                MultipartFile a = anexos[i];
                jdbc.update(
                        "INSERT INTO anexos_contas (conta_id,nome_arquivo,descricao,tipo_arquivo,tamanho,conteudo) VALUES (?,?,?,?,?,?)",
                        id, a.getOriginalFilename(), d, a.getContentType(), a.getSize(), a.getBytes());
            }
    }

    public record ContaResumo(long id, String descricao, BigDecimal valorTotal, TipoContaEnum tipo,
            SituacaoContaEnum situacao, OffsetDateTime criadoEm, OffsetDateTime baixadaEm, boolean possuiBaixas) {
    }

    public record AnexoResumo(long id, String nomeArquivo, String descricao, long tamanho) {
    }

    public record AnexoConteudo(String nomeArquivo, String tipoArquivo, byte[] conteudo) {
    }

    public record ParcelaContaDetalhe(int numero, BigDecimal valor, LocalDate dataVencimento,
            SituacaoParcelaEnum situacao, OffsetDateTime baixadaEm, String observacaoBaixa) {
    }

    public record ContaDetalhe(long id, String descricao, BigDecimal valorTotal, TipoContaEnum tipo,
            SituacaoContaEnum situacao, OffsetDateTime criadoEm, OffsetDateTime baixadaEm,
            List<ParcelaContaDetalhe> parcelas, List<AnexoResumo> anexos) {
    }

    private record EstadoBaixa(TipoContaEnum tipo, SituacaoContaEnum situacao, int quantidadeParcelas) {
    }
}
