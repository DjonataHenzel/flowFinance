package com.flowfinance.backend.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowfinance.backend.model.TipoDocumentoEnum;
import com.flowfinance.backend.service.DocumentoService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Validator;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.http.HttpHeaders;
import org.springframework.http.InvalidMediaTypeException;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/documentos")
public class DocumentoController {
    private final DocumentoService service;
    private final ObjectMapper mapper;
    private final Validator validator;

    public DocumentoController(DocumentoService service, ObjectMapper mapper, Validator validator) {
        this.service = service;
        this.mapper = mapper;
        this.validator = validator;
    }

    @GetMapping
    public List<DocumentoService.DocumentoResumo> listar(HttpSession sessao) {
        return service.listar(usuario(sessao));
    }

    @GetMapping("/pessoas")
    public List<DocumentoService.PessoaDisponivel> listarPessoas() {
        return service.listarPessoas();
    }

    @GetMapping("/{id}")
    public ResponseEntity<DocumentoService.DocumentoResumo> buscar(@PathVariable long id, HttpSession sessao) {
        return service.buscar(id, usuario(sessao)).map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{documentoId}/anexos/{anexoId}/download")
    public ResponseEntity<byte[]> baixarAnexo(@PathVariable long documentoId, @PathVariable long anexoId,
            HttpSession sessao) {
        return service.buscarAnexo(documentoId, anexoId, usuario(sessao))
                .map(a -> ResponseEntity.ok().contentType(tipoArquivo(a.tipoArquivo()))
                        .header(HttpHeaders.CONTENT_DISPOSITION,
                                "attachment; filename*=UTF-8''"
                                        + java.net.URLEncoder.encode(a.nomeArquivo(), StandardCharsets.UTF_8))
                        .body(a.conteudo()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> cadastrar(@RequestPart("documento") String json,
            @RequestPart(value = "anexos", required = false) MultipartFile[] anexos,
            @RequestPart(value = "descricoesAnexos", required = false) String descricoesJson,
            @RequestPart(value = "tiposAnexos", required = false) String tiposJson, HttpSession sessao)
            throws IOException {
        long id = service.cadastrar(lerDocumento(json), anexos, lerDescricoes(descricoesJson),
                lerTipos(tiposJson), usuario(sessao));
        return ResponseEntity.created(URI.create("/api/documentos/" + id))
                .body(Map.of("id", id, "message", "Documento cadastrado com sucesso"));
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> alterar(@PathVariable long id,
            @RequestPart("documento") String json,
            @RequestPart(value = "anexos", required = false) MultipartFile[] anexos,
            @RequestPart(value = "descricoesAnexos", required = false) String descricoesJson,
            @RequestPart(value = "tiposAnexos", required = false) String tiposJson,
            @RequestPart(value = "anexosExistentes", required = false) String existentesJson, HttpSession sessao)
            throws IOException {
        List<AnexoExistenteRequest> existentes = lerExistentes(existentesJson);
        if (!service.alterar(id, lerDocumento(json), anexos, lerDescricoes(descricoesJson), lerTipos(tiposJson),
                existentes, usuario(sessao)))
            return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("id", id, "message", "Documento alterado com sucesso"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> excluir(@PathVariable long id, HttpSession sessao) {
        return service.excluir(id, usuario(sessao))
                ? ResponseEntity.ok(Map.of("id", id, "message", "Documento excluído com sucesso"))
                : ResponseEntity.notFound().build();
    }

    private DocumentoRequest lerDocumento(String json) throws IOException {
        DocumentoRequest documento = mapper.readValue(json, DocumentoRequest.class);
        if (documento == null || !validator.validate(documento).isEmpty())
            throw new IllegalArgumentException("Preencha o nome do documento e selecione uma pessoa.");
        return documento;
    }

    private List<String> lerDescricoes(String json) throws IOException {
        List<String> descricoes = json == null ? List.of() : mapper.readValue(json, new TypeReference<>() {
        });
        if (descricoes == null)
            throw new IllegalArgumentException("A lista de descrições dos anexos é inválida.");
        return descricoes;
    }

    private List<TipoDocumentoEnum> lerTipos(String json) throws IOException {
        List<TipoDocumentoEnum> tipos = json == null ? List.of() : mapper.readValue(json, new TypeReference<>() {
        });
        if (tipos == null)
            throw new IllegalArgumentException("A lista de tipos dos anexos é inválida.");
        return tipos;
    }

    private List<AnexoExistenteRequest> lerExistentes(String json) throws IOException {
        List<AnexoExistenteRequest> existentes = json == null ? List.of() : mapper.readValue(json,
                new TypeReference<>() {
                });
        if (existentes == null || existentes.stream().anyMatch(Objects::isNull))
            throw new IllegalArgumentException("A lista de anexos existentes é inválida.");
        return existentes;
    }

    private String usuario(HttpSession sessao) {
        return sessao.getAttribute("usuario").toString();
    }

    private MediaType tipoArquivo(String tipo) {
        try {
            return tipo == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(tipo);
        } catch (InvalidMediaTypeException e) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }

    public record DocumentoRequest(@NotNull Long pessoaId, @NotBlank @Size(max = 150) String nome) {
    }

    public record AnexoExistenteRequest(long id, @NotBlank @Size(max = 255) String descricao,
            @NotNull TipoDocumentoEnum tipo) {
    }
}
