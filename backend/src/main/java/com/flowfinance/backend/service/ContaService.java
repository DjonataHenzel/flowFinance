package com.flowfinance.backend.service;

import com.flowfinance.backend.controller.ContaController.*;
import com.flowfinance.backend.model.SituacaoContaEnum;
import com.flowfinance.backend.model.SituacaoParcelaEnum;
import com.flowfinance.backend.model.TipoContaEnum;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.*;
import java.util.*;

@Service
public class ContaService {
    private final JdbcTemplate jdbc;
    private final HttpClient httpClient;
    private final String ntfyBaseUrl;

    public ContaService(JdbcTemplate jdbc, @Value("${ntfy.base-url}") String ntfyBaseUrl) {
        this.jdbc = jdbc;
        this.httpClient = HttpClient.newHttpClient();
        this.ntfyBaseUrl = ntfyBaseUrl.replaceAll("/+$", "");
    }

    public List<ContaResumo> listar(String usuario) {
        return jdbc.query(
                "SELECT c.id,c.descricao,c.valor_total,c.tipo,c.situacao,c.criado_em,c.baixada_em,c.pessoa_id,(c.situacao IN ('PAGA','RECEBIDA') OR EXISTS(SELECT 1 FROM parcelas_contas p WHERE p.conta_id=c.id AND p.situacao<>'PENDENTE')) FROM contas c JOIN usuario u ON u.id=c.usuario_cadastro WHERE u.usuario=? ORDER BY c.criado_em DESC,c.id DESC",
                (r, n) -> new ContaResumo(r.getLong(1), r.getString(2), r.getBigDecimal(3),
                        TipoContaEnum.valueOf(r.getString(4)), SituacaoContaEnum.valueOf(r.getString(5)),
                        r.getObject(6, OffsetDateTime.class), r.getObject(7, OffsetDateTime.class), r.getBoolean(9), r.getObject(8, Long.class)),usuario);
    }

    public NotificacaoWhatsapp buscarNotificacaoWhatsapp(String usuario) {
        List<DestinoWhatsapp> destinos = jdbc.query(
                "SELECT DISTINCT w.numero FROM pessoas_whatsapp w JOIN pessoas p ON p.id=w.pessoa_id JOIN contas c ON c.pessoa_id=p.id JOIN usuario u ON u.id=c.usuario_cadastro WHERE u.usuario=? ORDER BY w.numero",
                (r, n) -> new DestinoWhatsapp(r.getString(1)), usuario);
        if (destinos.isEmpty()) throw new IllegalArgumentException("Associe uma pessoa com WhatsApp às contas vencendo hoje");
        List<String> contatos = destinos.stream().map(DestinoWhatsapp::numero).filter(Objects::nonNull).toList();
        List<ContaVencendo> contas = jdbc.query("""
                SELECT c.descricao,p.numero,c.qtd_parcelas,p.valor
                  FROM contas c
                  JOIN parcelas_contas p ON p.conta_id=c.id
                 JOIN usuario u ON u.id=c.usuario_cadastro
                 WHERE u.usuario=? AND c.pessoa_id IS NOT NULL AND c.tipo='PAGAR' AND p.situacao='PENDENTE'
                   AND p.data_vencimento=CURRENT_DATE
                 ORDER BY c.descricao,p.numero
                """, (r, n) -> new ContaVencendo(r.getString(1),r.getInt(2),r.getInt(3),r.getBigDecimal(4)), usuario);
        String mensagem = contas.isEmpty() ? "Nenhuma conta pendente vence hoje."
                : montarMensagemVencimentos(contas,0);
        return new NotificacaoWhatsapp(contatos, mensagem, contas.size());
    }

    public ResultadoNotificacao enviarNotificacaoNtfy(String usuario) {
        List<String> topicos = jdbc.query("SELECT DISTINCT n.topico FROM pessoas_ntfy n JOIN pessoas p ON p.id=n.pessoa_id JOIN contas c ON c.pessoa_id=p.id JOIN usuario u ON u.id=c.usuario_cadastro WHERE u.usuario=? AND p.canal_preferencial='NTFY'",(r,n)->r.getString(1),usuario);
        if (topicos.isEmpty()) throw new IllegalArgumentException("Associe uma pessoa com ntfy às contas vencendo hoje");
        List<ContaVencendo> contas = buscarContasVencendo(usuario,0);
        if (contas.isEmpty()) return new ResultadoNotificacao(false, 0, "Nenhuma conta pendente foi encontrada para a data configurada.");
        String mensagem = montarMensagemVencimentos(contas,0);
        HttpRequest requisicao = HttpRequest.newBuilder(URI.create(ntfyBaseUrl + "/" + topicos.getFirst()))
                .header("Content-Type", "text/plain; charset=utf-8")
                .header("Title", "FlowFinance - vencimentos de hoje")
                .header("Priority", "high")
                .header("Tags", "money_with_wings,calendar")
                .POST(HttpRequest.BodyPublishers.ofString(mensagem)).build();
        try {
            HttpResponse<String> resposta = httpClient.send(requisicao, HttpResponse.BodyHandlers.ofString());
            if (resposta.statusCode() < 200 || resposta.statusCode() >= 300)
                throw new IllegalArgumentException("O ntfy recusou a notificação (HTTP " + resposta.statusCode() + ")");
            return new ResultadoNotificacao(true, contas.size(), "Notificação enviada para o celular.");
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalArgumentException("O envio da notificação foi interrompido");
        } catch (IOException exception) {
            throw new IllegalArgumentException("Não foi possível conectar ao serviço ntfy");
        }
    }

    private List<ContaVencendo> buscarContasVencendo(String usuario,int diasAntecedencia) {
        return jdbc.query("""
                SELECT c.descricao,p.numero,c.qtd_parcelas,p.valor
                  FROM contas c
                  JOIN parcelas_contas p ON p.conta_id=c.id
                  JOIN usuario u ON u.id=c.usuario_cadastro
                 WHERE u.usuario=? AND c.tipo='PAGAR' AND p.situacao='PENDENTE'
                   AND p.data_vencimento=CURRENT_DATE + ?
                 ORDER BY c.descricao,p.numero
                """, (r, n) -> new ContaVencendo(r.getString(1),r.getInt(2),r.getInt(3),r.getBigDecimal(4)), usuario,diasAntecedencia);
    }

    private String montarMensagemVencimentos(List<ContaVencendo> contas,int diasAntecedencia) {
        String titulo=diasAntecedencia==0?"*Contas vencendo hoje*":"*Contas vencendo em "+diasAntecedencia+" dia(s)*";
        StringBuilder mensagem = new StringBuilder(titulo+"\n\n");
        BigDecimal valorTotal = BigDecimal.ZERO;
        for (ContaVencendo conta : contas) {
            mensagem.append("• ").append(conta.descricao());
            if (conta.totalParcelas() > 1) mensagem.append(" — parcela ").append(conta.parcela()).append('/').append(conta.totalParcelas());
            mensagem.append(" — R$ ").append(String.format(new Locale("pt", "BR"), "%,.2f", conta.valor())).append('\n');
            valorTotal = valorTotal.add(conta.valor());
        }
        mensagem.append("\nTotal de contas: ").append(contas.size());
        mensagem.append("\nValor total: R$ ").append(String.format(new Locale("pt", "BR"), "%,.2f", valorTotal));
        return mensagem.toString();
    }

    public Optional<ContaDetalhe> buscar(long id,String usuario) {
        List<ContaDetalhe> contas = jdbc.query(
                "SELECT c.id,c.descricao,c.valor_total,c.tipo,c.situacao,c.criado_em,c.baixada_em,c.pessoa_id FROM contas c JOIN usuario u ON u.id=c.usuario_cadastro WHERE c.id=? AND u.usuario=?",
                (r, n) -> new ContaDetalhe(r.getLong(1), r.getString(2), r.getBigDecimal(3),
                        TipoContaEnum.valueOf(r.getString(4)), SituacaoContaEnum.valueOf(r.getString(5)),
                        r.getObject(6, OffsetDateTime.class), r.getObject(7, OffsetDateTime.class), r.getObject(8, Long.class),
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
                        id,usuario);
        return contas.stream().findFirst();
    }

    public Optional<AnexoConteudo> buscarAnexo(long contaId, long anexoId,String usuario) {
        return jdbc
                .query("SELECT a.nome_arquivo,a.tipo_arquivo,a.conteudo FROM anexos_contas a JOIN contas c ON c.id=a.conta_id JOIN usuario u ON u.id=c.usuario_cadastro WHERE a.id=? AND a.conta_id=? AND u.usuario=?",
                        (r, n) -> new AnexoConteudo(r.getString(1), r.getString(2), r.getBytes(3)), anexoId, contaId,usuario)
                .stream().findFirst();
    }

    @Transactional(rollbackFor = IOException.class)
    public long cadastrar(NovaContaRequest c, MultipartFile[] anexos, List<String> descricoes,
            List<AnexoExistenteRequest> anexosCopiados,String usuario) throws IOException {
        Long id = jdbc.queryForObject(
                "INSERT INTO contas (descricao, valor_total, qtd_parcelas, usuario_cadastro, pessoa_id, tipo, situacao) VALUES (?,?,?,(SELECT id FROM usuario WHERE usuario=?),?,?,?) RETURNING id",
                Long.class, c.descricao().trim(), c.valorTotal(), c.parcelas().size(), usuario, c.pessoaId(), c.tipo().name(),
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
            List<AnexoExistenteRequest> existentes,String usuario) throws IOException {
        Integer baixadas = jdbc.queryForObject("SELECT COUNT(*) FROM parcelas_contas p JOIN contas c ON c.id=p.conta_id JOIN usuario u ON u.id=c.usuario_cadastro WHERE c.id=? AND u.usuario=? AND p.situacao<>'PENDENTE'",Integer.class,id,usuario);
        if (baixadas != null && baixadas > 0) throw new IllegalArgumentException("Contas com parcelas baixadas não podem ser alteradas");
        if (jdbc.update(
                "UPDATE contas SET descricao=?,valor_total=?,qtd_parcelas=?,pessoa_id=?,tipo=?,situacao=? WHERE id=? AND usuario_cadastro=(SELECT id FROM usuario WHERE usuario=?)",
                c.descricao().trim(), c.valorTotal(), c.parcelas().size(), c.pessoaId(), c.tipo().name(),
                c.parcelas().size() > 1 ? SituacaoContaEnum.PARCELADA.name() : SituacaoContaEnum.ABERTA.name(),
                id,usuario) == 0)
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
    public Long duplicar(long id,String usuario) {
        Optional<ContaDetalhe> original = buscar(id,usuario);
        if (original.isEmpty())
            return null;
        Long novo = jdbc.queryForObject(
                "INSERT INTO contas (descricao,valor_total,qtd_parcelas,usuario_cadastro,pessoa_id,tipo,situacao) SELECT c.descricao,c.valor_total,c.qtd_parcelas,c.usuario_cadastro,c.pessoa_id,c.tipo,CASE WHEN c.qtd_parcelas>1 THEN 'PARCELADA' ELSE 'ABERTA' END FROM contas c JOIN usuario u ON u.id=c.usuario_cadastro WHERE c.id=? AND u.usuario=? RETURNING id",
                Long.class, id,usuario);
        jdbc.update(
                "INSERT INTO parcelas_contas (conta_id,numero,valor,data_vencimento) SELECT ?,numero,valor,data_vencimento FROM parcelas_contas WHERE conta_id=?",
                novo, id);
        jdbc.update(
                "INSERT INTO anexos_contas (conta_id,nome_arquivo,descricao,tipo_arquivo,tamanho,conteudo) SELECT ?,nome_arquivo,descricao,tipo_arquivo,tamanho,conteudo FROM anexos_contas WHERE conta_id=?",
                novo, id);
        return novo;
    }

    @Transactional
    public boolean excluir(long id,String usuario) {
        return jdbc.update("DELETE FROM contas WHERE id=? AND usuario_cadastro=(SELECT id FROM usuario WHERE usuario=?)", id,usuario) > 0;
    }

    @Transactional
    public void baixar(long id, boolean total, Integer numeroParcela, String observacao,String usuario) {
        List<EstadoBaixa> estados = jdbc.query("SELECT c.tipo,c.situacao,c.qtd_parcelas FROM contas c JOIN usuario u ON u.id=c.usuario_cadastro WHERE c.id=? AND u.usuario=?",
                (r, n) -> new EstadoBaixa(TipoContaEnum.valueOf(r.getString(1)),
                        SituacaoContaEnum.valueOf(r.getString(2)), r.getInt(3)),
                id,usuario);
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
    public void estornarBaixa(long id,String usuario) {
        List<Boolean> resultados = jdbc.query(
                "SELECT c.situacao IN ('PAGA','RECEBIDA') OR EXISTS(SELECT 1 FROM parcelas_contas WHERE conta_id=? AND situacao<>'PENDENTE') FROM contas c JOIN usuario u ON u.id=c.usuario_cadastro WHERE c.id=? AND u.usuario=?",
                (r, n) -> r.getBoolean(1), id, id,usuario);
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
            SituacaoContaEnum situacao, OffsetDateTime criadoEm, OffsetDateTime baixadaEm, boolean possuiBaixas, Long pessoaId) {
    }

    public record AnexoResumo(long id, String nomeArquivo, String descricao, long tamanho) {
    }

    public record AnexoConteudo(String nomeArquivo, String tipoArquivo, byte[] conteudo) {
    }

    public record ParcelaContaDetalhe(int numero, BigDecimal valor, LocalDate dataVencimento,
            SituacaoParcelaEnum situacao, OffsetDateTime baixadaEm, String observacaoBaixa) {
    }

        public record ContaDetalhe(long id, String descricao, BigDecimal valorTotal, TipoContaEnum tipo,
            SituacaoContaEnum situacao, OffsetDateTime criadoEm, OffsetDateTime baixadaEm, Long pessoaId,
            List<ParcelaContaDetalhe> parcelas, List<AnexoResumo> anexos) {
    }

    private record EstadoBaixa(TipoContaEnum tipo, SituacaoContaEnum situacao, int quantidadeParcelas) {
    }

    private record DestinoWhatsapp(String numero) {}
    private record ConfiguracaoNtfy(boolean ativa, String topico,int diasAntecedencia) {}
    private record ContaVencendo(String descricao, int parcela, int totalParcelas, BigDecimal valor) {}
    public record NotificacaoWhatsapp(List<String> contatos, String mensagem, int quantidade) {}
    public record ResultadoNotificacao(boolean enviado, int quantidade, String mensagem) {}
}
