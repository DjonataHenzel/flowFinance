package com.flowfinance.backend.service;

import com.flowfinance.backend.controller.CompromissoController.CompromissoRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.net.URI;
import java.net.http.*;
import java.time.*;
import java.util.*;

@Service
public class CompromissoService {
    private final JdbcTemplate jdbc; private final String ntfyBaseUrl;
    public CompromissoService(JdbcTemplate jdbc,@Value("${ntfy.base-url}") String ntfyBaseUrl){this.jdbc=jdbc;this.ntfyBaseUrl=ntfyBaseUrl.replaceAll("/+$","");}
    public List<CompromissoResumo> listar(){return jdbc.query("SELECT c.id,c.data_hora,c.descricao,c.pessoa_id,p.nome,c.hora_notificacao,c.situacao FROM compromissos c JOIN pessoas p ON p.id=c.pessoa_id ORDER BY c.data_hora",(r,n)->new CompromissoResumo(r.getLong(1),r.getObject(2,OffsetDateTime.class),r.getString(3),r.getLong(4),r.getString(5),r.getObject(6,LocalTime.class),r.getString(7)));}
    @Transactional public long cadastrar(CompromissoRequest r){validar(r);return jdbc.queryForObject("INSERT INTO compromissos(data_hora,descricao,pessoa_id,hora_notificacao,situacao) VALUES(?,?,?,?,?) RETURNING id",Long.class,r.dataHora(),r.descricao().trim(),r.pessoaId(),r.horaNotificacao().withSecond(0).withNano(0),r.situacao());}
    @Transactional public boolean alterar(long id,CompromissoRequest r){validar(r);return jdbc.update("UPDATE compromissos SET data_hora=?,descricao=?,pessoa_id=?,hora_notificacao=?,situacao=?,ultima_notificacao=NULL WHERE id=?",r.dataHora(),r.descricao().trim(),r.pessoaId(),r.horaNotificacao().withSecond(0).withNano(0),r.situacao(),id)>0;}
    public Long duplicar(long id){return jdbc.query("SELECT data_hora,descricao,pessoa_id,hora_notificacao FROM compromissos WHERE id=?",(r,n)->jdbc.queryForObject("INSERT INTO compromissos(data_hora,descricao,pessoa_id,hora_notificacao,situacao) VALUES(?,?,?,?, 'PENDENTE') RETURNING id",Long.class,r.getObject(1,OffsetDateTime.class),r.getString(2),r.getLong(3),r.getObject(4,LocalTime.class)),id).stream().findFirst().orElse(null);}
    public boolean excluir(long id){return jdbc.update("DELETE FROM compromissos WHERE id=?",id)>0;}
    private void validar(CompromissoRequest r){if(!Set.of("PENDENTE","RESOLVIDO","REAGENDADO").contains(r.situacao()))throw new IllegalArgumentException("Situação inválida");if(jdbc.queryForObject("SELECT COUNT(*) FROM pessoas WHERE id=?",Integer.class,r.pessoaId())==0)throw new IllegalArgumentException("Pessoa não encontrada");}

    public void notificarPendentes(){LocalDateTime agora=LocalDateTime.now();List<Destino> destinos=jdbc.query("SELECT c.id,c.data_hora,c.descricao,p.nome,n.topico FROM compromissos c JOIN pessoas p ON p.id=c.pessoa_id JOIN pessoas_ntfy n ON n.pessoa_id=p.id WHERE p.canal_preferencial='NTFY' AND c.situacao IN ('PENDENTE','REAGENDADO') AND c.data_hora<=CURRENT_TIMESTAMP AND c.hora_notificacao<=CURRENT_TIME AND (c.ultima_notificacao IS NULL OR c.ultima_notificacao<CURRENT_TIMESTAMP-INTERVAL '1 day')",(r,n)->new Destino(r.getLong(1),r.getObject(2,OffsetDateTime.class),r.getString(3),r.getString(4),r.getString(5)));for(Destino d:destinos)try{HttpRequest req=HttpRequest.newBuilder(URI.create(ntfyBaseUrl+"/"+d.topico())).header("Title","Compromisso - "+d.nome()).POST(HttpRequest.BodyPublishers.ofString(d.descricao()+" em "+d.dataHora())).build();HttpResponse<String> res=HttpClient.newHttpClient().send(req,HttpResponse.BodyHandlers.ofString());if(res.statusCode()<300)jdbc.update("UPDATE compromissos SET ultima_notificacao=CURRENT_TIMESTAMP WHERE id=?",d.id());}catch(Exception ignored){}}
    private record Destino(long id,OffsetDateTime dataHora,String descricao,String nome,String topico){}
    public record CompromissoResumo(long id,OffsetDateTime dataHora,String descricao,long pessoaId,String pessoa,LocalTime horaNotificacao,String situacao){}
}