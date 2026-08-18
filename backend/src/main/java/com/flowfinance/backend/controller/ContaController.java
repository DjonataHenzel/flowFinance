package com.flowfinance.backend.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flowfinance.backend.service.ContaService;
import com.flowfinance.backend.model.TipoContaEnum;
import jakarta.validation.Valid;
import jakarta.validation.Validator;
import jakarta.validation.constraints.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.math.BigDecimal;
import java.net.URI;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/contas")
public class ContaController {
    private final ContaService service; private final ObjectMapper mapper; private final Validator validator;
    public ContaController(ContaService service, ObjectMapper mapper, Validator validator) { this.service = service; this.mapper = mapper; this.validator = validator; }

    @GetMapping public List<ContaService.ContaResumo> listar() { return service.listar(); }
    @GetMapping("/{id}") public ResponseEntity<ContaService.ContaDetalhe> buscar(@PathVariable long id) { return service.buscar(id).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build()); }
    @GetMapping("/{contaId}/anexos/{anexoId}")
    public ResponseEntity<byte[]> visualizarAnexo(@PathVariable long contaId,@PathVariable long anexoId) {
        return service.buscarAnexo(contaId,anexoId).map(a -> ResponseEntity.ok()
                .contentType(a.tipoArquivo()==null?MediaType.APPLICATION_OCTET_STREAM:MediaType.parseMediaType(a.tipoArquivo()))
                .header(HttpHeaders.CONTENT_DISPOSITION,"inline; filename*=UTF-8''"+java.net.URLEncoder.encode(a.nomeArquivo(),java.nio.charset.StandardCharsets.UTF_8))
                .body(a.conteudo())).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> cadastrar(@RequestPart("conta") String json, @RequestPart(value="anexos", required=false) MultipartFile[] anexos, @RequestPart(value="descricoesAnexos", required=false) String descricoes, @RequestPart(value="anexosExistentes", required=false) String existentesJson) throws IOException {
        List<AnexoExistenteRequest> existentes = existentesJson == null ? List.of() : mapper.readValue(existentesJson, new TypeReference<>() {});
        long id = service.cadastrar(lerConta(json), anexos, lerDescricoes(descricoes), existentes);
        return ResponseEntity.created(URI.create("/api/contas/" + id)).body(Map.of("id", id, "message", "Conta cadastrada com sucesso"));
    }

    @PutMapping(value="/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> alterar(@PathVariable long id, @RequestPart("conta") String json, @RequestPart(value="anexos", required=false) MultipartFile[] anexos, @RequestPart(value="descricoesAnexos", required=false) String descricoes, @RequestPart(value="anexosExistentes", required=false) String existentesJson) throws IOException {
        List<AnexoExistenteRequest> existentes = existentesJson == null ? List.of() : mapper.readValue(existentesJson, new TypeReference<>() {});
        if (!service.alterar(id, lerConta(json), anexos, lerDescricoes(descricoes), existentes)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("id", id, "message", "Conta alterada com sucesso"));
    }

    @PostMapping("/{id}/duplicar") public ResponseEntity<Map<String, Object>> duplicar(@PathVariable long id) {
        Long novoId = service.duplicar(id); if (novoId == null) return ResponseEntity.notFound().build();
        return ResponseEntity.created(URI.create("/api/contas/" + novoId)).body(Map.of("id", novoId, "message", "Conta duplicada com sucesso"));
    }
    @DeleteMapping("/{id}") public ResponseEntity<Map<String, Object>> excluir(@PathVariable long id) {
        return service.excluir(id) ? ResponseEntity.ok(Map.of("id", id, "message", "Conta excluída com sucesso")) : ResponseEntity.notFound().build();
    }
    @PatchMapping("/{id}/baixar") public ResponseEntity<Map<String, Object>> baixar(@PathVariable long id, @Valid @RequestBody BaixaContaRequest baixa) {
        service.baixar(id,baixa.pagamento()==TipoPagamento.TOTAL,baixa.numeroParcela(),baixa.observacao());
        return ResponseEntity.ok(Map.of("id", id, "message", "Baixa registrada com sucesso"));
    }
    @PatchMapping("/{id}/estornar-baixa") public ResponseEntity<Map<String, Object>> estornarBaixa(@PathVariable long id) {
        service.estornarBaixa(id);
        return ResponseEntity.ok(Map.of("id",id,"message","Baixa estornada com sucesso"));
    }

    private NovaContaRequest lerConta(String json) throws IOException {
        NovaContaRequest conta = mapper.readValue(json, NovaContaRequest.class);
        if (!validator.validate(conta).isEmpty() || conta.parcelas() == null || conta.parcelas().isEmpty()) throw new IllegalArgumentException("Preencha os dados obrigatórios da conta e das parcelas");
        BigDecimal soma = conta.parcelas().stream().map(ParcelaContaRequest::valor).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (soma.compareTo(conta.valorTotal()) != 0) throw new IllegalArgumentException("A soma das parcelas deve ser igual ao valor total"); return conta;
    }
    private List<String> lerDescricoes(String json) throws IOException { return json == null ? List.of() : mapper.readValue(json, new TypeReference<>() {}); }
    @ExceptionHandler(IllegalArgumentException.class) ResponseEntity<Map<String, Object>> invalida(IllegalArgumentException e) { return ResponseEntity.badRequest().body(Map.of("message", e.getMessage())); }

    public record NovaContaRequest(@NotBlank String descricao, @NotNull @DecimalMin("0.01") BigDecimal valorTotal, @NotNull TipoContaEnum tipo, List<@Valid ParcelaContaRequest> parcelas) {}
    public record ParcelaContaRequest(@Min(1) int numero, @NotNull @DecimalMin("0.01") BigDecimal valor, @NotNull LocalDate dataVencimento) {}
    public record AnexoExistenteRequest(long id, @NotBlank String descricao) {}
    public enum TipoPagamento { TOTAL, PARCIAL }
    public record BaixaContaRequest(@NotNull TipoPagamento pagamento,Integer numeroParcela,@Size(max=1000) String observacao) {}
}
