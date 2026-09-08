package com.flowfinance.backend.service;

import com.flowfinance.backend.controller.CompromissoController.CompromissoRequest;
import com.flowfinance.backend.controller.CompromissoController.AnexoExistenteRequest;
import com.flowfinance.backend.controller.CompromissoController.ContatoWhatsappRequest;
import com.flowfinance.backend.model.MensagemNotificacaoEnum;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.io.IOException;
import java.util.*;
import java.util.logging.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class CompromissoService {
    private static final Logger LOGGER=Logger.getLogger(CompromissoService.class.getName());
    private final JdbcTemplate jdbc; private final String ntfyBaseUrl; private final HttpClient httpClient;
    @Autowired
    public CompromissoService(JdbcTemplate jdbc,@Value("${ntfy.base-url}") String url){this(jdbc,url,HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build());}
    CompromissoService(JdbcTemplate jdbc,String url,HttpClient httpClient){this.jdbc=jdbc;ntfyBaseUrl=url.replaceAll("/+$","");this.httpClient=httpClient;}

    public List<CompromissoResumo> listar(String usuario){return jdbc.query("""
        SELECT c.id,c.data_hora,c.descricao,c.hora_notificacao,c.situacao,
               c.categoria_id,cat.nome,c.subcategoria_id,sub.nome,
               c.cep,c.logradouro,c.numero,c.complemento,c.bairro,c.cidade,c.uf,
               COALESCE((SELECT json_agg(json_build_object('numero',w.numero,'descricao',w.descricao) ORDER BY w.id)::text FROM contatos_whatsapp_compromissos w WHERE w.compromisso_id=c.id),'[]'),
               ARRAY(SELECT p.id FROM compromissos_pessoas_notificacao cp JOIN pessoas p ON p.id=cp.pessoa_id WHERE cp.compromisso_id=c.id ORDER BY p.nome),
               ARRAY(SELECT p.nome FROM compromissos_pessoas_notificacao cp JOIN pessoas p ON p.id=cp.pessoa_id WHERE cp.compromisso_id=c.id ORDER BY p.nome)
        FROM compromissos c
        LEFT JOIN categorias cat ON cat.id=c.categoria_id
        LEFT JOIN subcategorias sub ON sub.id=c.subcategoria_id
        LEFT JOIN usuario autor ON autor.id=cat.usuario_id
        JOIN usuario atual ON atual.usuario=?
        WHERE autor.usuario=? OR atual.visualizar_cadastros_todos_usuarios
        ORDER BY c.data_hora
        """,(r,n)->new CompromissoResumo(r.getLong(1),r.getObject(2,OffsetDateTime.class),r.getString(3),
            List.of((Long[])r.getArray(18).getArray()),List.of((String[])r.getArray(19).getArray()),
            r.getObject(4,LocalTime.class),r.getString(5),r.getObject(6,Long.class),r.getString(7),
            r.getObject(8,Long.class),r.getString(9),r.getString(10),r.getString(11),r.getString(12),
            r.getString(13),r.getString(14),r.getString(15),r.getString(16),lerContatos(r.getString(17)),
            jdbc.query("SELECT id,nome_arquivo,descricao,tamanho FROM anexos_compromissos WHERE compromisso_id=? ORDER BY id",(a,x)->new AnexoResumo(a.getLong(1),a.getString(2),a.getString(3),a.getLong(4)),r.getLong(1))),usuario,usuario);}

    @Transactional(rollbackFor=IOException.class) public long cadastrar(CompromissoRequest r,MultipartFile[] anexos,List<String> descricoes,String usuario) throws IOException {validar(r,usuario);Long id=jdbc.queryForObject("""
        INSERT INTO compromissos(data_hora,descricao,pessoa_id,hora_notificacao,situacao,categoria_id,subcategoria_id,cep,logradouro,numero,complemento,bairro,cidade,uf)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id
        """,Long.class,r.dataHora(),r.descricao().trim(),r.pessoaIds().getFirst(),hora(r),r.situacao().name(),r.categoriaId(),r.subcategoriaId(),limpar(r.cep()),limpar(r.logradouro()),limpar(r.numero()),limpar(r.complemento()),limpar(r.bairro()),limpar(r.cidade()),limpar(r.uf()));salvarPessoas(id,r.pessoaIds());salvarWhatsapp(id,r.whatsapp());gravarAnexos(id,anexos,descricoes);return id;}

    @Transactional(rollbackFor=IOException.class) public boolean alterar(long id,CompromissoRequest r,MultipartFile[] anexos,List<String> descricoes,List<AnexoExistenteRequest> existentes,String usuario) throws IOException {if(!podeAcessarClassificacao(id,usuario))return false;validar(r,usuario);validarAnexosExistentes(id,existentes);boolean alterado=jdbc.update("""
        UPDATE compromissos SET data_hora=?,descricao=?,pessoa_id=?,hora_notificacao=?,situacao=?,categoria_id=?,subcategoria_id=?,
        cep=?,logradouro=?,numero=?,complemento=?,bairro=?,cidade=?,uf=?,ultima_notificacao=NULL WHERE id=?
        """,r.dataHora(),r.descricao().trim(),r.pessoaIds().getFirst(),hora(r),r.situacao().name(),r.categoriaId(),r.subcategoriaId(),limpar(r.cep()),limpar(r.logradouro()),limpar(r.numero()),limpar(r.complemento()),limpar(r.bairro()),limpar(r.cidade()),limpar(r.uf()),id)>0;if(alterado){salvarPessoas(id,r.pessoaIds());salvarWhatsapp(id,r.whatsapp());for(AnexoExistenteRequest a:existentes)jdbc.update("UPDATE anexos_compromissos SET descricao=? WHERE id=? AND compromisso_id=?",a.descricao().trim(),a.id(),id);Set<Long> mantidos=new HashSet<>();for(AnexoExistenteRequest a:existentes)mantidos.add(a.id());for(Long atual:jdbc.query("SELECT id FROM anexos_compromissos WHERE compromisso_id=?",(x,n)->x.getLong(1),id))if(!mantidos.contains(atual))jdbc.update("DELETE FROM anexos_compromissos WHERE id=?",atual);gravarAnexos(id,anexos,descricoes);}return alterado;}

    @Transactional public Long duplicar(long id,String usuario){if(!podeAcessarClassificacao(id,usuario))return null;Long novo=jdbc.query("SELECT data_hora,descricao,pessoa_id,hora_notificacao,categoria_id,subcategoria_id,cep,logradouro,numero,complemento,bairro,cidade,uf FROM compromissos WHERE id=?",(r,n)->jdbc.queryForObject("""
        INSERT INTO compromissos(data_hora,descricao,pessoa_id,hora_notificacao,situacao,categoria_id,subcategoria_id,cep,logradouro,numero,complemento,bairro,cidade,uf)
        VALUES(?,?,?,?, 'PENDENTE',?,?,?,?,?,?,?,?,?) RETURNING id
        """,Long.class,r.getObject(1,OffsetDateTime.class),r.getString(2),r.getLong(3),r.getObject(4,LocalTime.class),r.getObject(5,Long.class),r.getObject(6,Long.class),r.getString(7),r.getString(8),r.getString(9),r.getString(10),r.getString(11),r.getString(12),r.getString(13)),id).stream().findFirst().orElse(null);if(novo!=null){jdbc.update("INSERT INTO compromissos_pessoas_notificacao(compromisso_id,pessoa_id) SELECT ?,pessoa_id FROM compromissos_pessoas_notificacao WHERE compromisso_id=?",novo,id);jdbc.update("INSERT INTO contatos_whatsapp_compromissos(compromisso_id,numero) SELECT ?,numero FROM contatos_whatsapp_compromissos WHERE compromisso_id=?",novo,id);jdbc.update("INSERT INTO anexos_compromissos(compromisso_id,nome_arquivo,descricao,tipo_arquivo,tamanho,conteudo) SELECT ?,nome_arquivo,descricao,tipo_arquivo,tamanho,conteudo FROM anexos_compromissos WHERE compromisso_id=?",novo,id);}return novo;}
    public boolean excluir(long id,String usuario){if(!podeAcessarClassificacao(id,usuario))return false;return jdbc.update("DELETE FROM compromissos WHERE id=?",id)>0;}

    private void validar(CompromissoRequest r,String usuario){if(r.pessoaIds()==null||r.pessoaIds().isEmpty())throw new IllegalArgumentException("Selecione ao menos uma pessoa");if(r.pessoaIds().stream().filter(java.util.Objects::nonNull).distinct().count()!=r.pessoaIds().size())throw new IllegalArgumentException("A lista de pessoas possui itens inválidos ou repetidos");for(Long id:r.pessoaIds()){if(jdbc.queryForObject("SELECT COUNT(*) FROM pessoas WHERE id=?",Integer.class,id)==0)throw new IllegalArgumentException("Pessoa não encontrada");if(jdbc.queryForObject("SELECT COUNT(*) FROM pessoas p JOIN pessoas_ntfy n ON n.pessoa_id=p.id WHERE p.id=? AND p.canal_preferencial='NTFY'",Integer.class,id)==0)throw new IllegalArgumentException("A pessoa selecionada precisa possuir um canal ntfy para receber notificações automáticas");}Boolean visualizarTodos=jdbc.queryForObject("SELECT visualizar_cadastros_todos_usuarios FROM usuario WHERE usuario=?",Boolean.class,usuario);if(jdbc.queryForObject("SELECT COUNT(*) FROM categorias c JOIN usuario u ON u.id=c.usuario_id WHERE c.id=? AND (u.usuario=? OR ?)",Integer.class,r.categoriaId(),usuario,Boolean.TRUE.equals(visualizarTodos))==0)throw new IllegalArgumentException("Categoria não encontrada");if(r.subcategoriaId()!=null&&jdbc.queryForObject("SELECT COUNT(*) FROM subcategorias s JOIN usuario u ON u.id=s.usuario_id WHERE s.id=? AND s.categoria_id=? AND (u.usuario=? OR ?)",Integer.class,r.subcategoriaId(),r.categoriaId(),usuario,Boolean.TRUE.equals(visualizarTodos))==0)throw new IllegalArgumentException("Subcategoria não encontrada ou não relacionada à categoria selecionada");if(r.cep()!=null&&!r.cep().isBlank()&&!r.cep().matches("\\d{8}"))throw new IllegalArgumentException("Informe um CEP válido com 8 dígitos");}

    private boolean podeAcessarClassificacao(long compromissoId,String usuario){Integer quantidade=jdbc.queryForObject("""
        SELECT COUNT(*) FROM compromissos c
        LEFT JOIN categorias cat ON cat.id=c.categoria_id
        LEFT JOIN usuario autor ON autor.id=cat.usuario_id
        JOIN usuario atual ON atual.usuario=?
        WHERE c.id=? AND (cat.id IS NULL OR autor.usuario=? OR atual.visualizar_cadastros_todos_usuarios)
        """,Integer.class,usuario,compromissoId,usuario);return quantidade!=null&&quantidade>0;}

    private void salvarPessoas(long compromissoId,List<Long> pessoaIds){jdbc.update("DELETE FROM compromissos_pessoas_notificacao WHERE compromisso_id=?",compromissoId);for(Long pessoaId:pessoaIds)jdbc.update("INSERT INTO compromissos_pessoas_notificacao(compromisso_id,pessoa_id) VALUES(?,?)",compromissoId,pessoaId);}
    private void salvarWhatsapp(long compromissoId,List<ContatoWhatsappRequest> contatos){jdbc.update("DELETE FROM contatos_whatsapp_compromissos WHERE compromisso_id=?",compromissoId);if(contatos==null)return;Set<String> unicos=new LinkedHashSet<>();for(ContatoWhatsappRequest contato:contatos){String numero=normalizarWhatsapp(contato.numero());if(!unicos.add(numero))throw new IllegalArgumentException("A lista de WhatsApp possui contatos repetidos");jdbc.update("INSERT INTO contatos_whatsapp_compromissos(compromisso_id,numero,descricao) VALUES(?,?,?)",compromissoId,numero,contato.descricao().trim());}}

    public Optional<AnexoConteudo> buscarAnexo(long compromissoId,long anexoId,String usuario){if(!podeAcessarClassificacao(compromissoId,usuario))return Optional.empty();return jdbc.query("SELECT nome_arquivo,tipo_arquivo,conteudo FROM anexos_compromissos WHERE id=? AND compromisso_id=?",(r,n)->new AnexoConteudo(r.getString(1),r.getString(2),r.getBytes(3)),anexoId,compromissoId).stream().findFirst();}

    private void gravarAnexos(long compromissoId,MultipartFile[] anexos,List<String> descricoes) throws IOException {if(anexos==null)return;for(int i=0;i<anexos.length;i++)if(!anexos[i].isEmpty()){String descricao=i<descricoes.size()&&descricoes.get(i)!=null?descricoes.get(i).trim():"";if(descricao.isBlank()||descricao.length()>255)throw new IllegalArgumentException("Informe uma descrição de até 255 caracteres para todos os anexos");MultipartFile anexo=anexos[i];String nome=anexo.getOriginalFilename();if(nome==null||nome.isBlank()||nome.length()>255)throw new IllegalArgumentException("O nome do arquivo deve possuir entre 1 e 255 caracteres");jdbc.update("INSERT INTO anexos_compromissos(compromisso_id,nome_arquivo,descricao,tipo_arquivo,tamanho,conteudo) VALUES(?,?,?,?,?,?)",compromissoId,nome,descricao,anexo.getContentType(),anexo.getSize(),anexo.getBytes());}}

    private void validarAnexosExistentes(long compromissoId,List<AnexoExistenteRequest> anexos){if(anexos==null)throw new IllegalArgumentException("A lista de anexos existentes é inválida");Set<Long> ids=new HashSet<>();for(AnexoExistenteRequest anexo:anexos)if(anexo==null||anexo.id()<=0||anexo.descricao()==null||anexo.descricao().isBlank()||anexo.descricao().trim().length()>255||!ids.add(anexo.id())||jdbc.queryForObject("SELECT COUNT(*) FROM anexos_compromissos WHERE id=? AND compromisso_id=?",Integer.class,anexo.id(),compromissoId)==0)throw new IllegalArgumentException("Verifique os anexos existentes informados");}

    public void notificarPendentes(){List<Destino> destinos=jdbc.query("""
        SELECT DISTINCT ON (c.id,p.id) c.id,p.id,c.data_hora,c.descricao,p.nome,n.topico,cat.nome,sub.nome,c.cep,c.logradouro,c.numero,c.complemento,c.bairro,c.cidade,c.uf
        FROM compromissos c JOIN compromissos_pessoas_notificacao cp ON cp.compromisso_id=c.id JOIN pessoas p ON p.id=cp.pessoa_id JOIN pessoas_ntfy n ON n.pessoa_id=p.id LEFT JOIN categorias cat ON cat.id=c.categoria_id LEFT JOIN subcategorias sub ON sub.id=c.subcategoria_id
        WHERE p.canal_preferencial='NTFY' AND c.situacao IN ('PENDENTE','REAGENDADO')
        AND CAST(c.data_hora AS DATE)<=CURRENT_DATE AND c.hora_notificacao<=CURRENT_TIME AND cp.notificado_em IS NULL
        ORDER BY c.id,p.id,n.id
        """,(r,n)->new Destino(r.getLong(1),r.getLong(2),r.getObject(3,OffsetDateTime.class),r.getString(4),r.getString(5),r.getString(6),r.getString(7),r.getString(8),r.getString(9),r.getString(10),r.getString(11),r.getString(12),r.getString(13),r.getString(14),r.getString(15)));for(Destino d:destinos)notificar(d);}

    private void notificar(Destino d) {
        try {
            String mensagem = MensagemNotificacaoEnum.montarMensagemCompromisso(
                    d.descricao(), d.dataHora(), d.categoria(), d.subcategoria(), endereco(d));
            HttpRequest req = HttpRequest.newBuilder(URI.create(ntfyBaseUrl + "/" + d.topico()))
                    .timeout(Duration.ofSeconds(20))
                    .header("Content-Type", "text/plain; charset=utf-8")
                    .header("Title", "Compromisso - " + d.nome())
                    .POST(HttpRequest.BodyPublishers.ofString(mensagem)).build();
            HttpResponse<String> res = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() >= 200 && res.statusCode() < 300) {
                jdbc.update("UPDATE compromissos_pessoas_notificacao SET notificado_em=CURRENT_TIMESTAMP WHERE compromisso_id=? AND pessoa_id=? AND notificado_em IS NULL",
                        d.id(), d.pessoaId());
                concluirSeTodosNotificados(d.id());
            } else {
                LOGGER.warning("Falha ao notificar compromisso " + d.id() + " para a pessoa "
                        + d.pessoaId() + ": HTTP " + res.statusCode());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            LOGGER.log(Level.WARNING, "Notificação interrompida", e);
        } catch (Exception e) {
            LOGGER.log(Level.WARNING,
                    "Falha ao notificar compromisso " + d.id() + " para a pessoa " + d.pessoaId(), e);
        }
    }

    private void concluirSeTodosNotificados(long compromissoId){Integer pendentes=jdbc.queryForObject("SELECT COUNT(*) FROM compromissos_pessoas_notificacao WHERE compromisso_id=? AND notificado_em IS NULL",Integer.class,compromissoId);if(pendentes!=null&&pendentes==0)jdbc.update("UPDATE compromissos SET ultima_notificacao=CURRENT_TIMESTAMP,situacao='NOTIFICADO' WHERE id=?",compromissoId);}

    private static LocalTime hora(CompromissoRequest r){return r.horaNotificacao().withSecond(0).withNano(0);}
    private static String limpar(String v){return v==null||v.isBlank()?null:v.trim();}
    private static String normalizarWhatsapp(String valor){String numero=valor==null?"":valor.replaceAll("\\D","");if(numero.length()==10||numero.length()==11)numero="55"+numero;if(!numero.matches("[1-9]\\d{9,14}"))throw new IllegalArgumentException("Informe um WhatsApp válido com DDD e código do país");return numero;}
    private static List<ContatoWhatsapp> lerContatos(String json){try{com.fasterxml.jackson.databind.JsonNode itens=new com.fasterxml.jackson.databind.ObjectMapper().readTree(json);List<ContatoWhatsapp> contatos=new ArrayList<>();for(com.fasterxml.jackson.databind.JsonNode item:itens)contatos.add(new ContatoWhatsapp(item.path("numero").asText(),item.path("descricao").asText()));return contatos;}catch(Exception e){throw new IllegalStateException("Não foi possível ler os contatos do compromisso",e);}}
    private static String endereco(Destino d){if(d.logradouro()==null&&d.cidade()==null)return "";StringBuilder e=new StringBuilder();if(d.logradouro()!=null)e.append(d.logradouro());if(d.numero()!=null)e.append(", ").append(d.numero());if(d.complemento()!=null)e.append(" - ").append(d.complemento());if(d.bairro()!=null)e.append(" - ").append(d.bairro());if(d.cidade()!=null)e.append(" - ").append(d.cidade());if(d.uf()!=null)e.append('/').append(d.uf());if(d.cep()!=null)e.append(" · CEP ").append(d.cep(),0,5).append('-').append(d.cep().substring(5));return e.toString();}
    private record Destino(long id,long pessoaId,OffsetDateTime dataHora,String descricao,String nome,String topico,String categoria,String subcategoria,String cep,String logradouro,String numero,String complemento,String bairro,String cidade,String uf){}
    public record AnexoResumo(long id,String nomeArquivo,String descricao,long tamanho){}
    public record AnexoConteudo(String nomeArquivo,String tipoArquivo,byte[] conteudo){}
    public record ContatoWhatsapp(String numero,String descricao){}
    public record CompromissoResumo(long id,OffsetDateTime dataHora,String descricao,List<Long> pessoaIds,List<String> pessoas,LocalTime horaNotificacao,String situacao,Long categoriaId,String categoria,Long subcategoriaId,String subcategoria,String cep,String logradouro,String numero,String complemento,String bairro,String cidade,String uf,List<ContatoWhatsapp> whatsapp,List<AnexoResumo> anexos){}
}
