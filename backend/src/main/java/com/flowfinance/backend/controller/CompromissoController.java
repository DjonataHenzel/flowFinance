package com.flowfinance.backend.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowfinance.backend.service.CompromissoService;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.net.URI;
import java.time.OffsetDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import com.flowfinance.backend.model.SituacaoCompromissoEnum;
import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping("/api/compromissos")
public class CompromissoController {

    private final CompromissoService service;
    private final ObjectMapper mapper;
    private final Validator validator;

    public CompromissoController(CompromissoService service, ObjectMapper mapper, Validator validator) {
        this.service = service;
        this.mapper = mapper;
        this.validator = validator;
    }

    @GetMapping
    public List<CompromissoService.CompromissoResumo> listar(HttpSession sessao) {
        return service.listar(usuario(sessao));
    }

    @GetMapping("/{compromissoId}/anexos/{anexoId}")
    public ResponseEntity<byte[]> visualizarAnexo(@PathVariable long compromissoId, @PathVariable long anexoId,
            HttpSession sessao) {
        return service.buscarAnexo(compromissoId, anexoId, usuario(sessao))
                .map(a -> ResponseEntity.ok().contentType(tipoArquivo(a.tipoArquivo()))
                        .header(HttpHeaders.CONTENT_DISPOSITION,
                                "inline; filename*=UTF-8''" + java.net.URLEncoder.encode(a.nomeArquivo(),
                                        java.nio.charset.StandardCharsets.UTF_8))
                        .body(a.conteudo()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{compromissoId}/anexos/{anexoId}/download")
    public ResponseEntity<byte[]> baixarAnexo(@PathVariable long compromissoId, @PathVariable long anexoId,
            HttpSession sessao) {
        return service.buscarAnexo(compromissoId, anexoId, usuario(sessao))
                .map(a -> ResponseEntity.ok().contentType(tipoArquivo(a.tipoArquivo()))
                        .header(HttpHeaders.CONTENT_DISPOSITION,
                                "attachment; filename*=UTF-8''" + java.net.URLEncoder.encode(a.nomeArquivo(),
                                        java.nio.charset.StandardCharsets.UTF_8))
                        .body(a.conteudo()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> cadastrar(@RequestPart("compromisso") String json,
            @RequestPart(value = "anexos", required = false) MultipartFile[] anexos,
            @RequestPart(value = "descricoesAnexos", required = false) String descricoes, HttpSession sessao)
            throws IOException {
        long id = service.cadastrar(lerCompromisso(json), anexos, lerDescricoes(descricoes), usuario(sessao));
        return ResponseEntity.created(URI.create("/api/compromissos/" + id))
                .body(Map.of("id", id, "message", "Compromisso cadastrado com sucesso"));
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> alterar(@PathVariable long id, @RequestPart("compromisso") String json,
            @RequestPart(value = "anexos", required = false) MultipartFile[] anexos,
            @RequestPart(value = "descricoesAnexos", required = false) String descricoes,
            @RequestPart(value = "anexosExistentes", required = false) String existentesJson, HttpSession sessao)
            throws IOException {
        List<AnexoExistenteRequest> existentes = existentesJson == null ? List.of()
                : mapper.readValue(existentesJson, new TypeReference<>() {
                });
        if (!service.alterar(id, lerCompromisso(json), anexos, lerDescricoes(descricoes), existentes, usuario(sessao)))
            return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("id", id, "message", "Compromisso alterado com sucesso"));
    }

    @PostMapping("/{id}/duplicar")
    public ResponseEntity<Map<String, Object>> duplicar(@PathVariable long id, HttpSession sessao) {
        Long novo = service.duplicar(id, usuario(sessao));
        return novo == null ? ResponseEntity.notFound().build()
                : ResponseEntity.status(201).body(Map.of("id", novo, "message", "Compromisso duplicado com sucesso"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> excluir(@PathVariable long id, HttpSession sessao) {
        return service.excluir(id, usuario(sessao))
                ? ResponseEntity.ok(Map.of("id", id, "message", "Compromisso excluído com sucesso"))
                : ResponseEntity.notFound().build();
    }

    private String usuario(HttpSession sessao) {
        return sessao.getAttribute("usuario").toString();
    }

    private CompromissoRequest lerCompromisso(String json) throws IOException {
        CompromissoRequest r = mapper.readValue(json, CompromissoRequest.class);

        if (!validator.validate(r).isEmpty())
            throw new IllegalArgumentException("Preencha os dados obrigatórios do compromisso");

        return r;
    }

    private List<String> lerDescricoes(String json) throws IOException {
        return json == null ? List.of() : mapper.readValue(json, new TypeReference<>() {
        });
    }

    private MediaType tipoArquivo(String tipo) {
        try {
            return tipo == null ? MediaType.APPLICATION_OCTET_STREAM : MediaType.parseMediaType(tipo);
        } catch (InvalidMediaTypeException e) {
            return MediaType.APPLICATION_OCTET_STREAM;
        }
    }

    public record CompromissoRequest(@NotNull OffsetDateTime dataHora, @NotBlank @Size(max = 1000) String descricao,
            @NotNull @Size(min = 1) List<Long> pessoaIds, @NotNull Long categoriaId, Long subcategoriaId,
            @NotNull LocalTime horaNotificacao,
            @NotNull SituacaoCompromissoEnum situacao, @Size(max = 8) String cep, @Size(max = 150) String logradouro,
            @Size(max = 20) String numero, @Size(max = 100) String complemento, @Size(max = 100) String bairro,
            @Size(max = 100) String cidade, @Size(max = 2) String uf, List<@Valid ContatoWhatsappRequest> whatsapp) {
    }

    public record ContatoWhatsappRequest(@NotBlank @Size(max = 20) String numero,
            @NotBlank @Size(max = 100) String descricao) {

    }

    public record AnexoExistenteRequest(long id, @NotBlank @Size(max = 255) String descricao) {

    }
}
