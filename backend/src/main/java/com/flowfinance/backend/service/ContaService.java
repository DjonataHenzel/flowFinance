package com.flowfinance.backend.service;

import com.flowfinance.backend.controller.ContaController.*;
import com.flowfinance.backend.model.SituacaoContaEnum;
import com.flowfinance.backend.model.SituacaoParcelaEnum;
import com.flowfinance.backend.model.TipoContaEnum;
import com.flowfinance.backend.model.FrequenciaRecorrenciaEnum;
import com.flowfinance.backend.model.MensagemNotificacaoEnum;
import com.flowfinance.backend.model.MensagemNotificacaoEnum.ContaNotificacao;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
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
    private final String publicUrl;

    @Autowired
    public ContaService(JdbcTemplate jdbc, @Value("${ntfy.base-url}") String ntfyBaseUrl,
            @Value("${app.public-url:http://flowfinance.ddns.net}") String publicUrl) {
        this(jdbc, ntfyBaseUrl, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build(), publicUrl);
    }

    public ContaService(JdbcTemplate jdbc, String ntfyBaseUrl) {
        this(jdbc, ntfyBaseUrl, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build(), "http://localhost:8080");
    }

    ContaService(JdbcTemplate jdbc, String ntfyBaseUrl, HttpClient httpClient) {
        this(jdbc, ntfyBaseUrl, httpClient, "http://localhost:8080");
    }

    private ContaService(JdbcTemplate jdbc, String ntfyBaseUrl, HttpClient httpClient, String publicUrl) {
        this.jdbc = jdbc;
        this.httpClient = httpClient;
        this.ntfyBaseUrl = ntfyBaseUrl.replaceAll("/+$", "");
        this.publicUrl = publicUrl.replaceAll("/+$", "");
    }

    public List<ContaResumo> listar(String usuario) {
        return listar(usuario, null, null);
    }

    public List<ContaResumo> listar(String usuario, LocalDate dataInicial, LocalDate dataFinal) {
        boolean visualizarTodos = visualizarCadastrosTodosUsuarios(usuario);
        StringBuilder sql = new StringBuilder("SELECT c.id,c.descricao,c.valor_total,c.tipo,c.situacao,c.criado_em,c.baixada_em,c.pessoa_id,(c.situacao IN ('PAGA','RECEBIDA') OR EXISTS(SELECT 1 FROM parcelas_contas p WHERE p.conta_id=c.id AND p.situacao<>'PENDENTE')),c.categoria_id,cat.nome,c.subcategoria_id,sub.nome,(SELECT MIN(pv.data_vencimento) FROM parcelas_contas pv WHERE pv.conta_id=c.id) data_vencimento,COALESCE((SELECT MIN(pp.numero) FROM parcelas_contas pp WHERE pp.conta_id=c.id AND pp.situacao='PENDENTE'),c.qtd_parcelas) proxima_parcela,c.qtd_parcelas FROM contas c LEFT JOIN usuario u ON u.id=c.usuario_cadastro LEFT JOIN categorias cat ON cat.id=c.categoria_id LEFT JOIN subcategorias sub ON sub.id=c.subcategoria_id WHERE 1=1");
        List<Object> parametros = new ArrayList<>();
        if (!visualizarTodos) {
            sql.append(" AND u.usuario=?");
            parametros.add(usuario);
        }
        if (dataInicial != null || dataFinal != null) {
            sql.append(" AND EXISTS(SELECT 1 FROM parcelas_contas pv WHERE pv.conta_id=c.id");
            if (dataInicial != null) {
                sql.append(" AND pv.data_vencimento>=?");
                parametros.add(dataInicial);
            }
            if (dataFinal != null) {
                sql.append(" AND pv.data_vencimento<=?");
                parametros.add(dataFinal);
            }
            sql.append(')');
        }
        sql.append(" ORDER BY c.criado_em DESC,c.id DESC");
        return jdbc.query(
                sql.toString(),
                (r, n) -> new ContaResumo(r.getLong(1), r.getString(2), r.getBigDecimal(3),
                        TipoContaEnum.valueOf(r.getString(4)), SituacaoContaEnum.valueOf(r.getString(5)),
                        r.getObject(6, OffsetDateTime.class), r.getObject(7, OffsetDateTime.class), r.getBoolean(9),
                        r.getObject(8, Long.class), r.getObject(10, Long.class), r.getString(11),
                        r.getObject(12, Long.class), r.getString(13), r.getObject(14, LocalDate.class),
                        r.getInt(15), r.getInt(16)),
                parametros.toArray());
    }

    public NotificacaoWhatsapp buscarNotificacaoWhatsapp(String usuario) {
        List<DestinoWhatsapp> destinos = jdbc.query(
            "SELECT DISTINCT w.numero FROM pessoas_whatsapp w JOIN pessoas p ON p.id=w.pessoa_id JOIN contas c ON c.pessoa_id=p.id OR EXISTS (SELECT 1 FROM contas_pessoas_notificacao cp WHERE cp.conta_id=c.id AND cp.pessoa_id=p.id) JOIN parcelas_contas pc ON pc.conta_id=c.id JOIN usuario u ON u.id=c.usuario_cadastro WHERE u.usuario=? AND p.canal_preferencial='WHATSAPP' AND c.tipo='PAGAR' AND pc.situacao='PENDENTE' AND pc.data_vencimento<=CURRENT_DATE ORDER BY w.numero",
                (r, n) -> new DestinoWhatsapp(r.getString(1)), usuario);
        if (destinos.isEmpty()) throw new IllegalArgumentException("Associe uma pessoa com WhatsApp às contas vencidas ou vencendo hoje");
        List<String> contatos = destinos.stream().map(DestinoWhatsapp::numero).filter(Objects::nonNull).toList();
        List<ContaNotificacao> contas = buscarContasPendentesDoCanal(usuario, "WHATSAPP");
        String mensagem = MensagemNotificacaoEnum.montarMensagemContasPendentes(contas);
        return new NotificacaoWhatsapp(contatos, mensagem, contas.size());
    }

    public ResultadoNotificacao enviarNotificacaoNtfy(String usuario) {
        List<String> topicos = jdbc.query("SELECT DISTINCT n.topico FROM pessoas_ntfy n JOIN pessoas p ON p.id=n.pessoa_id JOIN contas c ON c.pessoa_id=p.id OR EXISTS (SELECT 1 FROM contas_pessoas_notificacao cp WHERE cp.conta_id=c.id AND cp.pessoa_id=p.id) JOIN parcelas_contas pc ON pc.conta_id=c.id JOIN usuario u ON u.id=c.usuario_cadastro WHERE u.usuario=? AND p.canal_preferencial='NTFY' AND c.tipo='PAGAR' AND pc.situacao='PENDENTE' AND pc.data_vencimento<=CURRENT_DATE",(r,n)->r.getString(1),usuario);
        if (topicos.isEmpty()) {
            boolean possuiTopico = jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM pessoas_ntfy n JOIN pessoas p ON p.id=n.pessoa_id JOIN contas c ON c.pessoa_id=p.id OR EXISTS (SELECT 1 FROM contas_pessoas_notificacao cp WHERE cp.conta_id=c.id AND cp.pessoa_id=p.id) JOIN usuario u ON u.id=c.usuario_cadastro WHERE u.usuario=? AND p.canal_preferencial='NTFY')", Boolean.class, usuario);
            throw new IllegalArgumentException(possuiTopico
                    ? "O tópico ntfy está cadastrado, mas nenhuma conta a pagar vencida ou vencendo hoje está vinculada a essa pessoa."
                    : "Cadastre um tópico ntfy e vincule a pessoa às contas a pagar vencidas ou vencendo hoje.");
        }
        List<ContaNotificacao> contas = buscarContasPendentesDoCanal(usuario, "NTFY");
        if (contas.isEmpty()) return new ResultadoNotificacao(false, 0, "Nenhuma conta vencida ou vencendo hoje foi encontrada.");
        String mensagem = MensagemNotificacaoEnum.montarMensagemContasPendentes(contas);
        HttpRequest requisicao = HttpRequest.newBuilder(URI.create(ntfyBaseUrl + "/" + topicos.getFirst()))
                .timeout(Duration.ofSeconds(20))
                .header("Content-Type", "text/plain; charset=utf-8")
                .header("Title", "FlowFinance - vencimentos de hoje")
                .header("Priority", "high")
                .header("Tags", "money_with_wings,calendar")
                .POST(HttpRequest.BodyPublishers.ofString(mensagem)).build();
        try {
            HttpResponse<String> resposta = httpClient.send(requisicao, HttpResponse.BodyHandlers.ofString());
            enviarTopicosAdicionais(topicos,mensagem);
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

    public ResultadoNotificacao enviarNotificacaoNtfy(long pessoaId,LocalDate dataReferencia) {
        List<String> topicos=jdbc.query("SELECT topico FROM pessoas_ntfy WHERE pessoa_id=? ORDER BY id",
                (r,n)->r.getString(1),pessoaId);
        List<ContaNotificacao> contas=jdbc.query("""
                SELECT c.id,c.descricao,pc.numero,c.qtd_parcelas,pc.valor
                  FROM contas c
                  JOIN parcelas_contas pc ON pc.conta_id=c.id
                  JOIN contas_pessoas_notificacao cp ON cp.conta_id=c.id
                 WHERE cp.pessoa_id=? AND c.tipo='PAGAR' AND pc.situacao='PENDENTE'
                   AND pc.data_vencimento<=?
                 ORDER BY pc.data_vencimento,c.descricao,pc.numero
                """,(r,n)->criarContaNotificacao(r.getLong(1),r.getString(2),r.getInt(3),r.getInt(4),r.getBigDecimal(5)),
                pessoaId,dataReferencia);
        if(topicos.isEmpty()||contas.isEmpty())
            return new ResultadoNotificacao(false,0,"Nenhuma conta pendente para notificar.");
        String mensagem=MensagemNotificacaoEnum.montarMensagemContasPendentes(contas);
        for(String topico:topicos) enviarNtfy(topico,mensagem,"FlowFinance - contas pendentes");
        return new ResultadoNotificacao(true,contas.size(),mensagem);
    }

    private void enviarNtfy(String topico,String mensagem,String titulo) {
        HttpRequest requisicao=HttpRequest.newBuilder(URI.create(ntfyBaseUrl+"/"+topico))
                .timeout(Duration.ofSeconds(20)).header("Content-Type","text/plain; charset=utf-8")
                .header("Title",titulo).header("Priority","high").header("Tags","money_with_wings,calendar")
                .POST(HttpRequest.BodyPublishers.ofString(mensagem)).build();
        try {
            HttpResponse<String> resposta=httpClient.send(requisicao,HttpResponse.BodyHandlers.ofString());
            if(resposta.statusCode()<200||resposta.statusCode()>=300)
                throw new IllegalArgumentException("O ntfy recusou a notificação (HTTP "+resposta.statusCode()+")");
        } catch(InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalArgumentException("O envio da notificação foi interrompido");
        } catch(IOException e) {
            throw new IllegalArgumentException("Não foi possível conectar ao serviço ntfy");
        }
    }

    private void enviarTopicosAdicionais(List<String> topicos,String mensagem) throws IOException,InterruptedException {
        for(String topico:topicos.stream().skip(1).toList()){
            HttpRequest requisicao=HttpRequest.newBuilder(URI.create(ntfyBaseUrl+"/"+topico))
                    .timeout(Duration.ofSeconds(20)).header("Content-Type","text/plain; charset=utf-8")
                    .header("Title","FlowFinance - vencimentos de hoje").header("Priority","high")
                    .header("Tags","money_with_wings,calendar").POST(HttpRequest.BodyPublishers.ofString(mensagem)).build();
            HttpResponse<String> resposta=httpClient.send(requisicao,HttpResponse.BodyHandlers.ofString());
            if(resposta.statusCode()<200||resposta.statusCode()>=300)
                throw new IllegalArgumentException("O ntfy recusou a notificação (HTTP "+resposta.statusCode()+")");
        }
    }

        private List<ContaNotificacao> buscarContasPendentesDoCanal(String usuario, String canal) {
                String tabela = "NTFY".equals(canal) ? "pessoas_ntfy" : "pessoas_whatsapp";
                                return jdbc.query("""
                                SELECT DISTINCT c.id,c.descricao,pc.numero,c.qtd_parcelas,pc.valor
                                    FROM contas c
                                    JOIN parcelas_contas pc ON pc.conta_id=c.id
                                    JOIN pessoas p ON p.id=c.pessoa_id OR EXISTS (SELECT 1 FROM contas_pessoas_notificacao cp WHERE cp.conta_id=c.id AND cp.pessoa_id=p.id)
                                    JOIN %s destino ON destino.pessoa_id=p.id
                                    JOIN usuario u ON u.id=c.usuario_cadastro
                                 WHERE u.usuario=? AND p.canal_preferencial=? AND c.tipo='PAGAR'
                                     AND pc.situacao='PENDENTE' AND pc.data_vencimento<=CURRENT_DATE
                                 ORDER BY c.descricao,pc.numero
                                """.formatted(tabela),
                                (r, n) -> criarContaNotificacao(r.getLong(1),r.getString(2),r.getInt(3),r.getInt(4),r.getBigDecimal(5)), usuario, canal);
        }

                    private ContaNotificacao criarContaNotificacao(long id, String descricao, int parcela, int totalParcelas, BigDecimal valor) {
                        return new ContaNotificacao(id, descricao, parcela, totalParcelas, valor, contatosConta(id), anexosConta(id));
                    }

                    private List<MensagemNotificacaoEnum.Link> contatosConta(long contaId) {
                        return jdbc.query("SELECT DISTINCT w.numero,p.nome FROM pessoas p JOIN pessoas_whatsapp w ON w.pessoa_id=p.id WHERE EXISTS (SELECT 1 FROM contas c WHERE c.id=? AND (c.pessoa_id=p.id OR EXISTS (SELECT 1 FROM contas_pessoas_notificacao cp WHERE cp.conta_id=c.id AND cp.pessoa_id=p.id))) ORDER BY p.nome,w.numero",
                            (r,n)->new MensagemNotificacaoEnum.Link(r.getString(2), "https://wa.me/" + r.getString(1)), contaId);
                    }

                    private List<MensagemNotificacaoEnum.Link> anexosConta(long contaId) {
                        return jdbc.query("SELECT id,nome_arquivo FROM anexos_contas WHERE conta_id=? ORDER BY id",
                            (r,n)->new MensagemNotificacaoEnum.Link(r.getString(2), publicUrl + "/api/contas/" + contaId + "/anexos/" + r.getLong(1) + "/download"), contaId);
                    }

    public Optional<ContaDetalhe> buscar(long id,String usuario) {
        if(!podeAcessarConta(id,usuario)) return Optional.empty();
        List<ContaDetalhe> contas = jdbc.query(
                "SELECT c.id,c.descricao,c.valor_total,c.tipo,c.situacao,c.criado_em,c.baixada_em,c.pessoa_id,c.categoria_id,c.subcategoria_id,c.conta_bancaria_id,c.debito_automatico,c.recorrente,c.frequencia_recorrencia FROM contas c WHERE c.id=?",
                (r, n) -> new ContaDetalhe(r.getLong(1), r.getString(2), r.getBigDecimal(3),
                        TipoContaEnum.valueOf(r.getString(4)), SituacaoContaEnum.valueOf(r.getString(5)),
                        r.getObject(6, OffsetDateTime.class), r.getObject(7, OffsetDateTime.class), r.getObject(8, Long.class),
                        jdbc.query("SELECT pessoa_id FROM contas_pessoas_notificacao WHERE conta_id=? ORDER BY pessoa_id",(p,x)->p.getLong(1),id),
                        r.getObject(9,Long.class),r.getObject(10,Long.class),r.getObject(11,Long.class),
                        r.getBoolean(12),r.getBoolean(13),
                        r.getString(14)==null?null:FrequenciaRecorrenciaEnum.valueOf(r.getString(14)),
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

    public Optional<AnexoConteudo> buscarAnexo(long contaId, long anexoId,String usuario) {
        if(!podeAcessarConta(contaId,usuario)) return Optional.empty();
        return jdbc
                .query("SELECT a.nome_arquivo,a.tipo_arquivo,a.conteudo FROM anexos_contas a WHERE a.id=? AND a.conta_id=?",
                        (r, n) -> new AnexoConteudo(r.getString(1), r.getString(2), r.getBytes(3)), anexoId, contaId)
                .stream().findFirst();
    }

    @Transactional(rollbackFor = IOException.class)
    public long cadastrar(NovaContaRequest c, MultipartFile[] anexos, List<String> descricoes,
            List<AnexoExistenteRequest> anexosCopiados,String usuario) throws IOException {
        validarDadosBancarios(c,usuario);
        validarAnexosExistentes(anexosCopiados);
        Long id = inserirConta(c,usuario,c.parcelas());
        salvarPessoas(id,c.pessoaIds());
        gravarParcelas(id, c.parcelas());
        gravarAnexos(id, anexos, descricoes);
        for (AnexoExistenteRequest a : anexosCopiados) {
            int copiados=jdbc.update("""
                    INSERT INTO anexos_contas (conta_id,nome_arquivo,descricao,tipo_arquivo,tamanho,conteudo)
                    SELECT ?,a.nome_arquivo,?,a.tipo_arquivo,a.tamanho,a.conteudo
                      FROM anexos_contas a JOIN contas origem ON origem.id=a.conta_id
                      LEFT JOIN usuario autor ON autor.id=origem.usuario_cadastro
                      JOIN usuario atual ON atual.usuario=?
                     WHERE a.id=? AND (autor.usuario=? OR atual.visualizar_cadastros_todos_usuarios)
                    """,id,a.descricao().trim(),usuario,a.id(),usuario);
            if(copiados==0)throw new IllegalArgumentException("Anexo de origem não encontrado ou sem permissão de acesso");
        }
        return id;
    }

    @Transactional(rollbackFor = IOException.class)
    public boolean alterar(long id, NovaContaRequest c, MultipartFile[] anexos, List<String> descricoes,
            List<AnexoExistenteRequest> existentes,String usuario) throws IOException {
        if(!podeAcessarConta(id,usuario)) return false;
        validarDadosBancarios(c,usuario);
        validarAnexosExistentes(existentes);
        Integer baixadas = jdbc.queryForObject("SELECT COUNT(*) FROM parcelas_contas p WHERE p.conta_id=? AND p.situacao<>'PENDENTE'",Integer.class,id);
        if (baixadas != null && baixadas > 0) throw new IllegalArgumentException("Contas com parcelas baixadas não podem ser alteradas");
        if (jdbc.update(
                "UPDATE contas SET descricao=?,valor_total=?,qtd_parcelas=?,pessoa_id=?,tipo=?,situacao=?,categoria_id=?,subcategoria_id=?,conta_bancaria_id=?,debito_automatico=?,recorrente=?,frequencia_recorrencia=? WHERE id=?",
                c.descricao().trim(), c.valorTotal(), c.parcelas().size(), primeiraPessoa(c.pessoaIds()), c.tipo().name(),
                c.parcelas().size() > 1 ? SituacaoContaEnum.PARCELADA.name() : SituacaoContaEnum.ABERTA.name(),
                c.categoriaId(),c.subcategoriaId(),c.contaBancariaId(),c.debitoAutomatico(),c.recorrente(),
                c.recorrente()?c.frequenciaRecorrencia().name():null,id) == 0)
            return false;
        salvarPessoas(id,c.pessoaIds());
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
        if(!podeAcessarConta(id,usuario)) return null;
        Optional<ContaDetalhe> original = buscar(id,usuario);
        if (original.isEmpty())
            return null;
        Long novo = jdbc.queryForObject(
                "INSERT INTO contas (descricao,valor_total,qtd_parcelas,usuario_cadastro,pessoa_id,tipo,situacao,categoria_id,subcategoria_id,conta_bancaria_id,debito_automatico) SELECT c.descricao,c.valor_total,c.qtd_parcelas,(SELECT id FROM usuario WHERE usuario=?),c.pessoa_id,c.tipo,CASE WHEN c.qtd_parcelas>1 THEN 'PARCELADA' ELSE 'ABERTA' END,c.categoria_id,c.subcategoria_id,c.conta_bancaria_id,c.debito_automatico FROM contas c WHERE c.id=? RETURNING id",
                Long.class,usuario,id);
        jdbc.update(
                "INSERT INTO parcelas_contas (conta_id,numero,valor,data_vencimento) SELECT ?,numero,valor,data_vencimento FROM parcelas_contas WHERE conta_id=?",
                novo, id);
        jdbc.update("INSERT INTO contas_pessoas_notificacao(conta_id,pessoa_id) SELECT ?,pessoa_id FROM contas_pessoas_notificacao WHERE conta_id=?",novo,id);
        jdbc.update(
                "INSERT INTO anexos_contas (conta_id,nome_arquivo,descricao,tipo_arquivo,tamanho,conteudo) SELECT ?,nome_arquivo,descricao,tipo_arquivo,tamanho,conteudo FROM anexos_contas WHERE conta_id=?",
                novo, id);
        return novo;
    }

    @Transactional
    public boolean excluir(long id,String usuario) {
        return podeAcessarConta(id,usuario)&&jdbc.update("DELETE FROM contas WHERE id=?",id)>0;
    }

    @Transactional
    public void baixar(long id, boolean total, Integer numeroParcela, String observacao,String usuario) {
        if(!podeAcessarConta(id,usuario)) throw new IllegalArgumentException("Conta não encontrada");
        List<EstadoBaixa> estados = jdbc.query("SELECT c.tipo,c.situacao,c.qtd_parcelas FROM contas c WHERE c.id=?",
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
    public void estornarBaixa(long id,String usuario) {
        if(!podeAcessarConta(id,usuario)) throw new IllegalArgumentException("Conta não encontrada");
        List<EstadoEstorno> resultados = jdbc.query(
                "SELECT c.situacao IN ('PAGA','RECEBIDA') OR EXISTS(SELECT 1 FROM parcelas_contas WHERE conta_id=? AND situacao<>'PENDENTE'),c.qtd_parcelas FROM contas c WHERE c.id=?",
                (r, n) -> new EstadoEstorno(r.getBoolean(1), r.getInt(2)), id, id);
        if (resultados.isEmpty() || !resultados.getFirst().possuiBaixa())
            throw new IllegalArgumentException("A conta não possui baixa para estornar");
        jdbc.update(
                "UPDATE parcelas_contas SET situacao='PENDENTE', baixada_em=NULL, observacao_baixa=NULL WHERE conta_id=?",
                id);
        String situacao = resultados.getFirst().quantidadeParcelas() > 1
                ? SituacaoContaEnum.PARCELADA.name()
                : SituacaoContaEnum.ABERTA.name();
        jdbc.update("UPDATE contas SET situacao=?, baixada_em=NULL WHERE id=?", situacao, id);
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
                if (d.length()>255)
                    throw new IllegalArgumentException("A descrição do anexo deve possuir no máximo 255 caracteres");
                MultipartFile a = anexos[i];
                if(a.getOriginalFilename()==null||a.getOriginalFilename().isBlank()||a.getOriginalFilename().length()>255)
                    throw new IllegalArgumentException("O nome do arquivo deve possuir entre 1 e 255 caracteres");
                jdbc.update(
                        "INSERT INTO anexos_contas (conta_id,nome_arquivo,descricao,tipo_arquivo,tamanho,conteudo) VALUES (?,?,?,?,?,?)",
                        id, a.getOriginalFilename(), d, a.getContentType(), a.getSize(), a.getBytes());
            }
    }

    private void validarAnexosExistentes(List<AnexoExistenteRequest> anexos) {
        if(anexos==null)throw new IllegalArgumentException("A lista de anexos existentes é inválida");
        Set<Long> ids=new HashSet<>();
        for(AnexoExistenteRequest anexo:anexos) {
            if(anexo==null||anexo.id()<=0||anexo.descricao()==null||anexo.descricao().isBlank()||anexo.descricao().trim().length()>255)
                throw new IllegalArgumentException("Verifique os anexos existentes informados");
            if(!ids.add(anexo.id()))throw new IllegalArgumentException("A lista de anexos existentes possui itens repetidos");
        }
    }

        public record ContaResumo(long id, String descricao, BigDecimal valorTotal, TipoContaEnum tipo,
            SituacaoContaEnum situacao, OffsetDateTime criadoEm, OffsetDateTime baixadaEm,
            boolean possuiBaixas, Long pessoaId, Long categoriaId, String categoria,
            Long subcategoriaId, String subcategoria, LocalDate dataVencimento,
            int proximaParcela, int totalParcelas) {
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
            List<Long> pessoaIds,
            Long categoriaId, Long subcategoriaId, Long contaBancariaId, boolean debitoAutomatico,
            boolean recorrente, FrequenciaRecorrenciaEnum frequenciaRecorrencia,
            List<ParcelaContaDetalhe> parcelas, List<AnexoResumo> anexos) {
    }

    private void validarDadosBancarios(NovaContaRequest c,String usuario) {
        validarPessoas(c.pessoaIds());
        if(c.debitoAutomatico()&&c.contaBancariaId()==null) throw new IllegalArgumentException("Selecione uma conta bancária para o débito automático");
        if(c.recorrente()&&c.frequenciaRecorrencia()==null) throw new IllegalArgumentException("Selecione a frequência da recorrência");
        boolean visualizarTodos=visualizarCadastrosTodosUsuarios(usuario);
        Integer categorias=jdbc.queryForObject("SELECT COUNT(*) FROM categorias c JOIN usuario u ON u.id=c.usuario_id WHERE c.id=? AND c.tipo_utilizacao='CONTAS' AND (u.usuario=? OR ?)",Integer.class,c.categoriaId(),usuario,visualizarTodos);
        if(categorias==null||categorias==0) throw new IllegalArgumentException("Categoria não encontrada");
        if(c.subcategoriaId()!=null) {
            Integer subcategorias=jdbc.queryForObject("""
                    SELECT COUNT(*)
                      FROM subcategorias s
                      JOIN usuario u ON u.id=s.usuario_id
                     WHERE s.id=? AND s.categoria_id=? AND (u.usuario=? OR ?)
                    """,Integer.class,c.subcategoriaId(),c.categoriaId(),usuario,visualizarTodos);
            if(subcategorias==null||subcategorias==0)
                throw new IllegalArgumentException("Subcategoria não encontrada ou não relacionada à categoria selecionada");
        }
        if(c.contaBancariaId()!=null) {
            Integer quantidade=jdbc.queryForObject("SELECT COUNT(*) FROM contas_bancarias cb JOIN usuario u ON u.id=cb.usuario_id WHERE cb.id=? AND (u.usuario=? OR ?)",Integer.class,c.contaBancariaId(),usuario,visualizarTodos);
            if(quantidade==null||quantidade==0) throw new IllegalArgumentException("Conta bancária não encontrada");
        }
    }

    private Long inserirConta(NovaContaRequest c,String usuario,List<ParcelaContaRequest> parcelas) {
        return jdbc.queryForObject("INSERT INTO contas (descricao,valor_total,qtd_parcelas,usuario_cadastro,pessoa_id,tipo,situacao,categoria_id,subcategoria_id,conta_bancaria_id,debito_automatico,recorrente,frequencia_recorrencia) VALUES (?,?,?,(SELECT id FROM usuario WHERE usuario=?),?,?,?,?,?,?,?,?,?) RETURNING id",
                Long.class,c.descricao().trim(),c.valorTotal(),parcelas.size(),usuario,primeiraPessoa(c.pessoaIds()),c.tipo().name(),
                parcelas.size()>1?SituacaoContaEnum.PARCELADA.name():SituacaoContaEnum.ABERTA.name(),
                c.categoriaId(),c.subcategoriaId(),c.contaBancariaId(),c.debitoAutomatico(),c.recorrente(),
                c.recorrente()?c.frequenciaRecorrencia().name():null);
    }

    private Long primeiraPessoa(List<Long> pessoaIds) {
        return pessoaIds==null||pessoaIds.isEmpty()?null:pessoaIds.getFirst();
    }

    private void validarPessoas(List<Long> pessoaIds) {
        if(pessoaIds==null)return;
        List<Long> ids=pessoaIds.stream().filter(Objects::nonNull).distinct().toList();
        if(ids.size()!=pessoaIds.size())throw new IllegalArgumentException("A lista de pessoas possui itens inválidos ou repetidos");
        for(Long pessoaId:ids){
            Integer quantidade=jdbc.queryForObject("SELECT COUNT(*) FROM pessoas WHERE id=?",Integer.class,pessoaId);
            if(quantidade==null||quantidade==0)throw new IllegalArgumentException("Pessoa não encontrada");
        }
    }

    private void salvarPessoas(long contaId,List<Long> pessoaIds) {
        jdbc.update("DELETE FROM contas_pessoas_notificacao WHERE conta_id=?",contaId);
        if(pessoaIds!=null)for(Long pessoaId:pessoaIds)
            jdbc.update("INSERT INTO contas_pessoas_notificacao(conta_id,pessoa_id) VALUES(?,?)",contaId,pessoaId);
    }

    private boolean visualizarCadastrosTodosUsuarios(String usuario) {
        Boolean permitido = jdbc.queryForObject("SELECT visualizar_cadastros_todos_usuarios FROM usuario WHERE usuario=?",Boolean.class,usuario);
        return Boolean.TRUE.equals(permitido);
    }

    private boolean podeAcessarConta(long id,String usuario) {
        Integer quantidade=jdbc.queryForObject("SELECT COUNT(*) FROM contas c LEFT JOIN usuario autor ON autor.id=c.usuario_cadastro JOIN usuario atual ON atual.usuario=? WHERE c.id=? AND (autor.usuario=? OR atual.visualizar_cadastros_todos_usuarios)",Integer.class,usuario,id,usuario);
        return quantidade!=null&&quantidade>0;
    }

    static LocalDate avancar(LocalDate data,FrequenciaRecorrenciaEnum frequencia,int ocorrencias) {
        return switch(frequencia){case DIARIA->data.plusDays(ocorrencias);case SEMANAL->data.plusWeeks(ocorrencias);case MENSAL->data.plusMonths(ocorrencias);case ANUAL->data.plusYears(ocorrencias);};
    }

    private record EstadoBaixa(TipoContaEnum tipo, SituacaoContaEnum situacao, int quantidadeParcelas) {
    }

    private record EstadoEstorno(boolean possuiBaixa, int quantidadeParcelas) {
    }

    private record DestinoWhatsapp(String numero) {}
    private record ConfiguracaoNtfy(boolean ativa, String topico,int diasAntecedencia) {}
    public record NotificacaoWhatsapp(List<String> contatos, String mensagem, int quantidade) {}
    public record ResultadoNotificacao(boolean enviado, int quantidade, String mensagem) {}
}
