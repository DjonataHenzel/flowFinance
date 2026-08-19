package com.flowfinance.backend.service;

import com.flowfinance.backend.controller.PessoaController.PessoaRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.OffsetDateTime;
import java.util.*;

@Service
public class PessoaService {
    private final JdbcTemplate jdbc;
    public PessoaService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    public List<PessoaResumo> listar() { return jdbc.query("SELECT id,nome,cpf,cidade,uf,canal_preferencial FROM pessoas ORDER BY nome",(r,n)->new PessoaResumo(r.getLong(1),r.getString(2),r.getString(3),r.getString(4),r.getString(5),r.getString(6))); }
    public Optional<PessoaDetalhe> buscar(long id) { List<PessoaDetalhe> itens=jdbc.query("SELECT id,nome,cpf,cep,logradouro,numero,complemento,bairro,cidade,uf,canal_preferencial,criado_em FROM pessoas WHERE id=?",(r,n)->new PessoaDetalhe(r.getLong(1),r.getString(2),r.getString(3),r.getString(4),r.getString(5),r.getString(6),r.getString(7),r.getString(8),r.getString(9),r.getString(10),r.getString(11),r.getObject(12,OffsetDateTime.class),jdbc.query("SELECT numero FROM pessoas_whatsapp WHERE pessoa_id=? ORDER BY id",(x,y)->x.getString(1),id),jdbc.query("SELECT topico FROM pessoas_ntfy WHERE pessoa_id=? ORDER BY id",(x,y)->x.getString(1),id)),id); return itens.stream().findFirst(); }

    @Transactional public long cadastrar(PessoaRequest p) { validar(p); Long id=jdbc.queryForObject("INSERT INTO pessoas(nome,cpf,cep,logradouro,numero,complemento,bairro,cidade,uf,canal_preferencial) VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING id",Long.class,dados(p)); salvarCanais(id,p); return id; }
    @Transactional public boolean alterar(long id,PessoaRequest p) { validar(p); Object[] valores=dados(p); Object[] parametros=Arrays.copyOf(valores,valores.length+1); parametros[valores.length]=id; int n=jdbc.update("UPDATE pessoas SET nome=?,cpf=?,cep=?,logradouro=?,numero=?,complemento=?,bairro=?,cidade=?,uf=?,canal_preferencial=? WHERE id=?",parametros); if(n==0)return false; jdbc.update("DELETE FROM pessoas_whatsapp WHERE pessoa_id=?",id);jdbc.update("DELETE FROM pessoas_ntfy WHERE pessoa_id=?",id);salvarCanais(id,p);return true; }
    @Transactional public boolean excluir(long id) { return jdbc.update("DELETE FROM pessoas WHERE id=?",id)>0; }

    private Object[] dados(PessoaRequest p){return new Object[]{p.nome().trim(),cpf(p.cpf()),cep(p.cep()),limpar(p.logradouro()),limpar(p.numero()),limpar(p.complemento()),limpar(p.bairro()),limpar(p.cidade()),uf(p.uf()),canal(p)};}
    private void salvarCanais(long id,PessoaRequest p){for(String n:normalizarWhatsapp(p.whatsapp()))jdbc.update("INSERT INTO pessoas_whatsapp(pessoa_id,numero) VALUES(?,?)",id,n);for(String t:normalizarNtfy(p.ntfy()))jdbc.update("INSERT INTO pessoas_ntfy(pessoa_id,topico) VALUES(?,?)",id,t);}
    private void validar(PessoaRequest p){if(!normalizarWhatsapp(p.whatsapp()).isEmpty()&&!normalizarNtfy(p.ntfy()).isEmpty())throw new IllegalArgumentException("Selecione somente um canal de notificação por pessoa");if(p.cpf()!=null&&!p.cpf().isBlank()&&!cpfValido(p.cpf()))throw new IllegalArgumentException("CPF inválido");cep(p.cep());canal(p);}
    private String canal(PessoaRequest p){String c=p.canalPreferencial()==null?"WHATSAPP":p.canalPreferencial().trim().toUpperCase();if(!Set.of("WHATSAPP","NTFY").contains(c))throw new IllegalArgumentException("Canal de notificação inválido");return c;}
    private String cpf(String v){if(v==null||v.isBlank())return null;return v.replaceAll("\\D","");}
    private String cep(String v){String d=v==null?"":v.replaceAll("\\D","");if(d.isBlank())return null;if(d.length()!=8)throw new IllegalArgumentException("CEP inválido; informe 8 dígitos");return d;}
    private String uf(String v){String valor=limpar(v);return valor==null?null:valor.toUpperCase(Locale.ROOT);}
    private boolean cpfValido(String v){String d=cpf(v);if(d.length()!=11||d.chars().distinct().count()==1)return false;int soma=0;for(int i=0;i<9;i++)soma+=(d.charAt(i)-48)*(10-i);int dig=11-(soma%11);if(dig>=10)dig=0;if(dig!=d.charAt(9)-48)return false;soma=0;for(int i=0;i<10;i++)soma+=(d.charAt(i)-48)*(11-i);dig=11-(soma%11);if(dig>=10)dig=0;return dig==d.charAt(10)-48;}
    private List<String> normalizarWhatsapp(List<String> vs){LinkedHashSet<String>s=new LinkedHashSet<>();if(vs!=null)for(String v:vs){String d=v==null?"":v.replaceAll("\\D","");if(d.matches("[1-9]\\d{9,10}"))d="55"+d;if(!d.isBlank()&&!d.matches("55[1-9]\\d{9,10}"))throw new IllegalArgumentException("Informe números de WhatsApp brasileiros com DDD");if(!d.isBlank())s.add(d);}return List.copyOf(s);}
    private List<String> normalizarNtfy(List<String> vs){LinkedHashSet<String>s=new LinkedHashSet<>();if(vs!=null)for(String v:vs){String t=v==null?"":v.trim();if(!t.isBlank()&&!t.matches("flowfinance-[a-f0-9]{32}"))throw new IllegalArgumentException("Tópico ntfy inválido");if(!t.isBlank())s.add(t);}return List.copyOf(s);}
    private String limpar(String v){return v==null||v.isBlank()?null:v.trim();}
    public record PessoaResumo(long id,String nome,String cpf,String cidade,String uf,String canalPreferencial){}
    public record PessoaDetalhe(long id,String nome,String cpf,String cep,String logradouro,String numero,String complemento,String bairro,String cidade,String uf,String canalPreferencial,OffsetDateTime criadoEm,List<String> whatsapp,List<String> ntfy){}
}