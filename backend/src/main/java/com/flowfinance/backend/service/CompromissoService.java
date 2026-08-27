package com.flowfinance.backend.service;

import com.flowfinance.backend.controller.CompromissoController.CompromissoRequest;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.List;
import java.util.logging.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CompromissoService {
    private static final Logger LOGGER=Logger.getLogger(CompromissoService.class.getName());
    private final JdbcTemplate jdbc; private final String ntfyBaseUrl; private final HttpClient httpClient;
    @Autowired
    public CompromissoService(JdbcTemplate jdbc,@Value("${ntfy.base-url}") String url){this(jdbc,url,HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build());}
    CompromissoService(JdbcTemplate jdbc,String url,HttpClient httpClient){this.jdbc=jdbc;ntfyBaseUrl=url.replaceAll("/+$","");this.httpClient=httpClient;}

    public List<CompromissoResumo> listar(){return jdbc.query("""
        SELECT c.id,c.data_hora,c.descricao,c.hora_notificacao,c.situacao,
               c.categoria_id,cat.nome,c.cep,c.logradouro,c.numero,c.complemento,c.bairro,c.cidade,c.uf,
               ARRAY(SELECT p.id FROM compromissos_pessoas_notificacao cp JOIN pessoas p ON p.id=cp.pessoa_id WHERE cp.compromisso_id=c.id ORDER BY p.nome),
               ARRAY(SELECT p.nome FROM compromissos_pessoas_notificacao cp JOIN pessoas p ON p.id=cp.pessoa_id WHERE cp.compromisso_id=c.id ORDER BY p.nome)
        FROM compromissos c LEFT JOIN categorias cat ON cat.id=c.categoria_id
        ORDER BY c.data_hora
        """,(r,n)->new CompromissoResumo(r.getLong(1),r.getObject(2,OffsetDateTime.class),r.getString(3),
            List.of((Long[])r.getArray(15).getArray()),List.of((String[])r.getArray(16).getArray()),
            r.getObject(4,LocalTime.class),r.getString(5),r.getObject(6,Long.class),r.getString(7),r.getString(8),r.getString(9),r.getString(10),r.getString(11),r.getString(12),r.getString(13),r.getString(14)));}

    @Transactional public long cadastrar(CompromissoRequest r){validar(r);Long id=jdbc.queryForObject("""
        INSERT INTO compromissos(data_hora,descricao,pessoa_id,hora_notificacao,situacao,categoria_id,cep,logradouro,numero,complemento,bairro,cidade,uf)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id
        """,Long.class,r.dataHora(),r.descricao().trim(),r.pessoaIds().getFirst(),hora(r),r.situacao().name(),r.categoriaId(),limpar(r.cep()),limpar(r.logradouro()),limpar(r.numero()),limpar(r.complemento()),limpar(r.bairro()),limpar(r.cidade()),limpar(r.uf()));salvarPessoas(id,r.pessoaIds());return id;}

    @Transactional public boolean alterar(long id,CompromissoRequest r){validar(r);boolean alterado=jdbc.update("""
        UPDATE compromissos SET data_hora=?,descricao=?,pessoa_id=?,hora_notificacao=?,situacao=?,categoria_id=?,
        cep=?,logradouro=?,numero=?,complemento=?,bairro=?,cidade=?,uf=?,ultima_notificacao=NULL WHERE id=?
        """,r.dataHora(),r.descricao().trim(),r.pessoaIds().getFirst(),hora(r),r.situacao().name(),r.categoriaId(),limpar(r.cep()),limpar(r.logradouro()),limpar(r.numero()),limpar(r.complemento()),limpar(r.bairro()),limpar(r.cidade()),limpar(r.uf()),id)>0;if(alterado)salvarPessoas(id,r.pessoaIds());return alterado;}

    @Transactional public Long duplicar(long id){Long novo=jdbc.query("SELECT data_hora,descricao,pessoa_id,hora_notificacao,categoria_id,cep,logradouro,numero,complemento,bairro,cidade,uf FROM compromissos WHERE id=?",(r,n)->jdbc.queryForObject("""
        INSERT INTO compromissos(data_hora,descricao,pessoa_id,hora_notificacao,situacao,categoria_id,cep,logradouro,numero,complemento,bairro,cidade,uf)
        VALUES(?,?,?,?, 'PENDENTE',?,?,?,?,?,?,?,?) RETURNING id
        """,Long.class,r.getObject(1,OffsetDateTime.class),r.getString(2),r.getLong(3),r.getObject(4,LocalTime.class),r.getObject(5,Long.class),r.getString(6),r.getString(7),r.getString(8),r.getString(9),r.getString(10),r.getString(11),r.getString(12)),id).stream().findFirst().orElse(null);if(novo!=null)jdbc.update("INSERT INTO compromissos_pessoas_notificacao(compromisso_id,pessoa_id) SELECT ?,pessoa_id FROM compromissos_pessoas_notificacao WHERE compromisso_id=?",novo,id);return novo;}
    public boolean excluir(long id){return jdbc.update("DELETE FROM compromissos WHERE id=?",id)>0;}

    private void validar(CompromissoRequest r){if(r.pessoaIds()==null||r.pessoaIds().isEmpty())throw new IllegalArgumentException("Selecione ao menos uma pessoa");if(r.pessoaIds().stream().filter(java.util.Objects::nonNull).distinct().count()!=r.pessoaIds().size())throw new IllegalArgumentException("A lista de pessoas possui itens inválidos ou repetidos");for(Long id:r.pessoaIds()){if(jdbc.queryForObject("SELECT COUNT(*) FROM pessoas WHERE id=?",Integer.class,id)==0)throw new IllegalArgumentException("Pessoa não encontrada");if(jdbc.queryForObject("SELECT COUNT(*) FROM pessoas p JOIN pessoas_ntfy n ON n.pessoa_id=p.id WHERE p.id=? AND p.canal_preferencial='NTFY'",Integer.class,id)==0)throw new IllegalArgumentException("A pessoa selecionada precisa possuir um canal ntfy para receber notificações automáticas");}if(jdbc.queryForObject("SELECT COUNT(*) FROM categorias WHERE id=?",Integer.class,r.categoriaId())==0)throw new IllegalArgumentException("Categoria não encontrada");if(r.cep()!=null&&!r.cep().isBlank()&&!r.cep().matches("\\d{8}"))throw new IllegalArgumentException("Informe um CEP válido com 8 dígitos");}

    private void salvarPessoas(long compromissoId,List<Long> pessoaIds){jdbc.update("DELETE FROM compromissos_pessoas_notificacao WHERE compromisso_id=?",compromissoId);for(Long pessoaId:pessoaIds)jdbc.update("INSERT INTO compromissos_pessoas_notificacao(compromisso_id,pessoa_id) VALUES(?,?)",compromissoId,pessoaId);}

    public void notificarPendentes(){List<Destino> destinos=jdbc.query("""
        SELECT DISTINCT ON (c.id,p.id) c.id,p.id,c.data_hora,c.descricao,p.nome,n.topico,cat.nome,c.cep,c.logradouro,c.numero,c.complemento,c.bairro,c.cidade,c.uf
        FROM compromissos c JOIN compromissos_pessoas_notificacao cp ON cp.compromisso_id=c.id JOIN pessoas p ON p.id=cp.pessoa_id JOIN pessoas_ntfy n ON n.pessoa_id=p.id LEFT JOIN categorias cat ON cat.id=c.categoria_id
        WHERE p.canal_preferencial='NTFY' AND c.situacao IN ('PENDENTE','REAGENDADO')
        AND CAST(c.data_hora AS DATE)<=CURRENT_DATE AND c.hora_notificacao<=CURRENT_TIME AND cp.notificado_em IS NULL
        ORDER BY c.id,p.id,n.id
        """,(r,n)->new Destino(r.getLong(1),r.getLong(2),r.getObject(3,OffsetDateTime.class),r.getString(4),r.getString(5),r.getString(6),r.getString(7),r.getString(8),r.getString(9),r.getString(10),r.getString(11),r.getString(12),r.getString(13),r.getString(14)));for(Destino d:destinos)notificar(d);}

    private void notificar(Destino d){try{String mensagem=d.descricao()+" em "+d.dataHora();if(d.categoria()!=null)mensagem+="\nCategoria: "+d.categoria();String endereco=endereco(d);if(!endereco.isBlank())mensagem+="\nEndereço: "+endereco;HttpRequest req=HttpRequest.newBuilder(URI.create(ntfyBaseUrl+"/"+d.topico())).timeout(Duration.ofSeconds(20)).header("Content-Type","text/plain; charset=utf-8").header("Title","Compromisso - "+d.nome()).POST(HttpRequest.BodyPublishers.ofString(mensagem)).build();HttpResponse<String> res=httpClient.send(req,HttpResponse.BodyHandlers.ofString());if(res.statusCode()>=200&&res.statusCode()<300){jdbc.update("UPDATE compromissos_pessoas_notificacao SET notificado_em=CURRENT_TIMESTAMP WHERE compromisso_id=? AND pessoa_id=? AND notificado_em IS NULL",d.id(),d.pessoaId());concluirSeTodosNotificados(d.id());}else LOGGER.warning("Falha ao notificar compromisso "+d.id()+" para a pessoa "+d.pessoaId()+": HTTP "+res.statusCode());}catch(InterruptedException e){Thread.currentThread().interrupt();LOGGER.log(Level.WARNING,"Notificação interrompida",e);}catch(Exception e){LOGGER.log(Level.WARNING,"Falha ao notificar compromisso "+d.id()+" para a pessoa "+d.pessoaId(),e);}}

    private void concluirSeTodosNotificados(long compromissoId){Integer pendentes=jdbc.queryForObject("SELECT COUNT(*) FROM compromissos_pessoas_notificacao WHERE compromisso_id=? AND notificado_em IS NULL",Integer.class,compromissoId);if(pendentes!=null&&pendentes==0)jdbc.update("UPDATE compromissos SET ultima_notificacao=CURRENT_TIMESTAMP,situacao='NOTIFICADO' WHERE id=?",compromissoId);}

    private static LocalTime hora(CompromissoRequest r){return r.horaNotificacao().withSecond(0).withNano(0);}
    private static String limpar(String v){return v==null||v.isBlank()?null:v.trim();}
    private static String endereco(Destino d){if(d.logradouro()==null&&d.cidade()==null)return "";StringBuilder e=new StringBuilder();if(d.logradouro()!=null)e.append(d.logradouro());if(d.numero()!=null)e.append(", ").append(d.numero());if(d.complemento()!=null)e.append(" - ").append(d.complemento());if(d.bairro()!=null)e.append(" - ").append(d.bairro());if(d.cidade()!=null)e.append(" - ").append(d.cidade());if(d.uf()!=null)e.append('/').append(d.uf());if(d.cep()!=null)e.append(" · CEP ").append(d.cep(),0,5).append('-').append(d.cep().substring(5));return e.toString();}
    private record Destino(long id,long pessoaId,OffsetDateTime dataHora,String descricao,String nome,String topico,String categoria,String cep,String logradouro,String numero,String complemento,String bairro,String cidade,String uf){}
    public record CompromissoResumo(long id,OffsetDateTime dataHora,String descricao,List<Long> pessoaIds,List<String> pessoas,LocalTime horaNotificacao,String situacao,Long categoriaId,String categoria,String cep,String logradouro,String numero,String complemento,String bairro,String cidade,String uf){}
}
