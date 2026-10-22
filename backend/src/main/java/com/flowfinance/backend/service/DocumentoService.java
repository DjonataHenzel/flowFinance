package com.flowfinance.backend.service;

import com.flowfinance.backend.controller.DocumentoController.DocumentoRequest;
import com.flowfinance.backend.controller.DocumentoController.AnexoExistenteRequest;
import com.flowfinance.backend.model.TipoDocumentoEnum;
import java.io.IOException;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class DocumentoService {
    private final JdbcTemplate jdbc;

    public DocumentoService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public List<PessoaDisponivel> listarPessoas() {
        return jdbc.query("SELECT id,nome FROM pessoas ORDER BY nome",
                (r, n) -> new PessoaDisponivel(r.getLong(1), r.getString(2)));
    }

    public List<DocumentoResumo> listar(String usuario) {
        return jdbc.query("""
                SELECT d.id,d.nome,d.pessoa_id,p.nome,d.criado_em
                  FROM documentos d
                  JOIN pessoas p ON p.id=d.pessoa_id
                  JOIN usuario atual ON atual.usuario=?
                 WHERE d.usuario_id=atual.id OR atual.visualizar_cadastros_todos_usuarios
                 ORDER BY p.nome,d.nome
                """, (r, n) -> criarResumo(r.getLong(1), r.getString(2), r.getLong(3), r.getString(4),
                r.getObject(5, OffsetDateTime.class)), usuario);
    }

    public Optional<DocumentoResumo> buscar(long id, String usuario) {
        return jdbc.query("""
                SELECT d.id,d.nome,d.pessoa_id,p.nome,d.criado_em
                  FROM documentos d
                  JOIN pessoas p ON p.id=d.pessoa_id
                  JOIN usuario atual ON atual.usuario=?
                 WHERE d.id=? AND (d.usuario_id=atual.id OR atual.visualizar_cadastros_todos_usuarios)
                """, (r, n) -> criarResumo(r.getLong(1), r.getString(2), r.getLong(3), r.getString(4),
                r.getObject(5, OffsetDateTime.class)), usuario, id).stream().findFirst();
    }

    public Optional<AnexoConteudo> buscarAnexo(long documentoId, long anexoId, String usuario) {
        if (!podeAcessar(documentoId, usuario))
            return Optional.empty();
        return jdbc.query("""
                SELECT nome_arquivo,tipo_arquivo,conteudo
                  FROM anexos_documentos
                 WHERE id=? AND documento_id=?
                """, (r, n) -> new AnexoConteudo(r.getString(1), r.getString(2), r.getBytes(3)),
                anexoId, documentoId).stream().findFirst();
    }

    @Transactional(rollbackFor = IOException.class)
    public long cadastrar(DocumentoRequest documento, MultipartFile[] anexos, List<String> descricoes,
            List<TipoDocumentoEnum> tipos, String usuario) throws IOException {
        validar(documento, anexos, descricoes, tipos);
        Long pessoaExiste = jdbc.queryForObject("SELECT COUNT(*) FROM pessoas WHERE id=?", Long.class,
                documento.pessoaId());
        if (pessoaExiste == null || pessoaExiste == 0)
            throw new IllegalArgumentException("A pessoa selecionada não foi encontrada.");
        Long id = jdbc.queryForObject("""
                INSERT INTO documentos(nome,pessoa_id,usuario_id)
                VALUES(?,?,(SELECT id FROM usuario WHERE usuario=?))
                RETURNING id
                """, Long.class, documento.nome().trim(), documento.pessoaId(), usuario);
        gravarAnexos(id, anexos, descricoes, tipos);
        return id;
    }

    @Transactional(rollbackFor = IOException.class)
    public boolean alterar(long id, DocumentoRequest documento, MultipartFile[] anexos, List<String> descricoes,
            List<TipoDocumentoEnum> tipos, List<AnexoExistenteRequest> existentes, String usuario)
            throws IOException {
        if (!podeAcessar(id, usuario))
            return false;
        validar(documento, anexos, descricoes, tipos);
        Long pessoaExiste = jdbc.queryForObject("SELECT COUNT(*) FROM pessoas WHERE id=?", Long.class,
                documento.pessoaId());
        if (pessoaExiste == null || pessoaExiste == 0)
            throw new IllegalArgumentException("A pessoa selecionada não foi encontrada.");
        Set<Long> idsMantidos = new HashSet<>();
        for (AnexoExistenteRequest anexo : existentes) {
            validarAnexo(anexo.descricao(), anexo.tipo());
            if (!idsMantidos.add(anexo.id()))
                throw new IllegalArgumentException("Um anexo foi informado mais de uma vez.");
            if (jdbc.update("""
                    UPDATE anexos_documentos
                       SET descricao=?,tipo_documento=?
                     WHERE id=? AND documento_id=?
                    """, anexo.descricao().trim(), anexo.tipo().name(), anexo.id(), id) == 0)
                throw new IllegalArgumentException("Um dos anexos informados não pertence a este documento.");
        }
        jdbc.update("UPDATE documentos SET nome=?,pessoa_id=? WHERE id=?", documento.nome().trim(),
                documento.pessoaId(), id);
        for (Long atual : jdbc.query("SELECT id FROM anexos_documentos WHERE documento_id=?",
                (r, n) -> r.getLong(1), id))
            if (!idsMantidos.contains(atual))
                jdbc.update("DELETE FROM anexos_documentos WHERE id=? AND documento_id=?", atual, id);
        gravarAnexos(id, anexos, descricoes, tipos);
        return true;
    }

    @Transactional
    public boolean excluir(long id, String usuario) {
        return podeAcessar(id, usuario)
                && jdbc.update("DELETE FROM documentos WHERE id=?", id) > 0;
    }

    private DocumentoResumo criarResumo(long id, String nome, long pessoaId, String pessoa, OffsetDateTime criadoEm) {
        List<AnexoResumo> anexos = jdbc.query("""
                SELECT id,nome_arquivo,descricao,tipo_documento,tamanho
                  FROM anexos_documentos
                 WHERE documento_id=?
                 ORDER BY id
                """, (r, n) -> new AnexoResumo(r.getLong(1), r.getString(2), r.getString(3),
                TipoDocumentoEnum.valueOf(r.getString(4)), r.getLong(5)), id);
        return new DocumentoResumo(id, nome, pessoaId, pessoa, criadoEm, anexos);
    }

    private boolean podeAcessar(long documentoId, String usuario) {
        Boolean permitido = jdbc.queryForObject("""
                SELECT EXISTS(
                    SELECT 1
                      FROM documentos d
                      JOIN usuario atual ON atual.usuario=?
                     WHERE d.id=? AND (d.usuario_id=atual.id OR atual.visualizar_cadastros_todos_usuarios)
                )
                """, Boolean.class, usuario, documentoId);
        return Boolean.TRUE.equals(permitido);
    }

    private void gravarAnexos(long documentoId, MultipartFile[] anexos, List<String> descricoes,
            List<TipoDocumentoEnum> tipos) throws IOException {
        if (anexos == null)
            return;
        for (int i = 0; i < anexos.length; i++) {
            MultipartFile arquivo = anexos[i];
            if (arquivo == null || arquivo.isEmpty())
                continue;
            validarAnexo(i < descricoes.size() ? descricoes.get(i) : null,
                    i < tipos.size() ? tipos.get(i) : null);
            String nome = nomeArquivo(arquivo.getOriginalFilename());
            if (nome.isBlank() || nome.length() > 255)
                throw new IllegalArgumentException("O nome do arquivo deve ter até 255 caracteres.");
            jdbc.update("""
                    INSERT INTO anexos_documentos
                        (documento_id,nome_arquivo,descricao,tipo_documento,tipo_arquivo,tamanho,conteudo)
                    VALUES(?,?,?,?,?,?,?)
                    """, documentoId, nome, descricoes.get(i).trim(), tipos.get(i).name(),
                    arquivo.getContentType(), arquivo.getSize(), arquivo.getBytes());
        }
    }

    private void validar(DocumentoRequest documento, MultipartFile[] anexos, List<String> descricoes,
            List<TipoDocumentoEnum> tipos) {
        if (documento == null || documento.pessoaId() == null || documento.pessoaId() <= 0)
            throw new IllegalArgumentException("Selecione a pessoa vinculada ao documento.");
        if (documento.nome() == null || documento.nome().isBlank() || documento.nome().trim().length() > 150)
            throw new IllegalArgumentException("Informe o nome do documento com até 150 caracteres.");
        if (anexos != null && (descricoes.size() < anexos.length || tipos.size() < anexos.length))
            throw new IllegalArgumentException("Informe a descrição e o tipo de cada anexo.");
        if (anexos != null)
            for (int i = 0; i < anexos.length; i++)
                if (anexos[i] != null && !anexos[i].isEmpty())
                    validarAnexo(descricoes.get(i), tipos.get(i));
    }

    private void validarAnexo(String descricao, TipoDocumentoEnum tipo) {
        if (descricao == null || descricao.isBlank() || descricao.trim().length() > 255)
            throw new IllegalArgumentException("Informe uma descrição de até 255 caracteres para cada anexo.");
        if (tipo == null)
            throw new IllegalArgumentException("Selecione o tipo de cada anexo.");
    }

    private String nomeArquivo(String original) {
        if (original == null)
            return "";
        String nomeSeguro = original.replace('\\', '/');
        return Path.of(nomeSeguro).getFileName().toString();
    }

    public record PessoaDisponivel(long id, String nome) {
    }

    public record AnexoResumo(long id, String nomeArquivo, String descricao, TipoDocumentoEnum tipo, long tamanho) {
    }

    public record DocumentoResumo(long id, String nome, long pessoaId, String pessoa, OffsetDateTime criadoEm,
            List<AnexoResumo> anexos) {
    }

    public record AnexoConteudo(String nomeArquivo, String tipoArquivo, byte[] conteudo) {
    }
}
