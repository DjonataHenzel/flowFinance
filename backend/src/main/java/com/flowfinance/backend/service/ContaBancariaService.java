package com.flowfinance.backend.service;

import java.util.List;
import java.util.Optional;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.flowfinance.backend.model.BancoEnum;

@Service
public class ContaBancariaService {
    private final JdbcTemplate jdbc;
    public ContaBancariaService(JdbcTemplate jdbc) { this.jdbc=jdbc; }

    public List<ContaBancariaResumo> listar(String usuario) {
        Boolean visualizarTodos=jdbc.queryForObject("SELECT visualizar_cadastros_todos_usuarios FROM usuario WHERE usuario=?",Boolean.class,usuario);
        return jdbc.query("SELECT cb.id,cb.banco,cb.agencia,cb.numero_conta,cb.pessoa_id,p.nome FROM contas_bancarias cb JOIN usuario u ON u.id=cb.usuario_id LEFT JOIN pessoas p ON p.id=cb.pessoa_id WHERE u.usuario=? OR ? ORDER BY cb.banco,cb.agencia,cb.numero_conta",
                (r,n)->new ContaBancariaResumo(r.getLong(1),BancoEnum.valueOf(r.getString(2)),r.getString(3),r.getString(4),r.getObject(5,Long.class),r.getString(6)),usuario,Boolean.TRUE.equals(visualizarTodos));
    }
    public List<TitularResumo> listarTitulares() {
        return jdbc.query("SELECT id,nome,cpf FROM pessoas ORDER BY nome",(r,n)->new TitularResumo(r.getLong(1),r.getString(2),r.getString(3)));
    }
    public Optional<ContaBancariaResumo> buscar(long id,String usuario) {
        return jdbc.query("SELECT cb.id,cb.banco,cb.agencia,cb.numero_conta,cb.pessoa_id,p.nome FROM contas_bancarias cb JOIN usuario u ON u.id=cb.usuario_id LEFT JOIN pessoas p ON p.id=cb.pessoa_id WHERE cb.id=? AND u.usuario=?",
                (r,n)->new ContaBancariaResumo(r.getLong(1),BancoEnum.valueOf(r.getString(2)),r.getString(3),r.getString(4),r.getObject(5,Long.class),r.getString(6)),id,usuario).stream().findFirst();
    }
    @Transactional
    public long cadastrar(BancoEnum banco,String agencia,String numeroConta,long pessoaId,String usuario) {
        validarDuplicidade(null,banco,agencia,numeroConta,usuario);
        validarPessoa(pessoaId);
        return jdbc.queryForObject("INSERT INTO contas_bancarias(usuario_id,banco,agencia,numero_conta,pessoa_id) VALUES((SELECT id FROM usuario WHERE usuario=?),?,?,?,?) RETURNING id",Long.class,usuario,banco.name(),agencia.trim(),numeroConta.trim(),pessoaId);
    }
    @Transactional
    public boolean alterar(long id,BancoEnum banco,String agencia,String numeroConta,long pessoaId,String usuario) {
        validarDuplicidade(id,banco,agencia,numeroConta,usuario);
        validarPessoa(pessoaId);
        return jdbc.update("UPDATE contas_bancarias SET banco=?,agencia=?,numero_conta=?,pessoa_id=? WHERE id=? AND usuario_id=(SELECT id FROM usuario WHERE usuario=?)",banco.name(),agencia.trim(),numeroConta.trim(),pessoaId,id,usuario)>0;
    }
    @Transactional
    public boolean excluir(long id,String usuario) {
        Integer vinculadas=jdbc.queryForObject("SELECT COUNT(*) FROM contas c JOIN usuario u ON u.id=c.usuario_cadastro WHERE c.conta_bancaria_id=? AND u.usuario=?",Integer.class,id,usuario);
        if(vinculadas!=null&&vinculadas>0) throw new IllegalArgumentException("A conta bancária está vinculada a lançamentos e não pode ser excluída");
        return jdbc.update("DELETE FROM contas_bancarias WHERE id=? AND usuario_id=(SELECT id FROM usuario WHERE usuario=?)",id,usuario)>0;
    }
    private void validarDuplicidade(Long id,BancoEnum banco,String agencia,String numeroConta,String usuario) {
        Integer quantidade=jdbc.queryForObject("SELECT COUNT(*) FROM contas_bancarias cb JOIN usuario u ON u.id=cb.usuario_id WHERE u.usuario=? AND cb.banco=? AND cb.agencia=? AND cb.numero_conta=? AND cb.id<>COALESCE(?, -1)",Integer.class,usuario,banco.name(),agencia.trim(),numeroConta.trim(),id);
        if(quantidade!=null&&quantidade>0) throw new IllegalArgumentException("Já existe uma conta bancária com o mesmo banco, agência e número da conta");
    }
    private void validarPessoa(long pessoaId) {
        Integer quantidade=jdbc.queryForObject("SELECT COUNT(*) FROM pessoas WHERE id=?",Integer.class,pessoaId);
        if(quantidade==null||quantidade==0) throw new IllegalArgumentException("Titular não encontrado");
    }
    public record ContaBancariaResumo(long id,BancoEnum banco,String agencia,String numeroConta,Long pessoaId,String titular) {}
    public record TitularResumo(long id,String nome,String cpf) {}
}
