package com.flowfinance.backend.controller;

import com.flowfinance.backend.service.PessoaService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/pessoas")
public class PessoaController {
    private final PessoaService service;
    public PessoaController(PessoaService service) { this.service = service; }

    @GetMapping public List<PessoaService.PessoaResumo> listar() { return service.listar(); }
    @GetMapping("/{id}") public ResponseEntity<PessoaService.PessoaDetalhe> buscar(@PathVariable long id) {
        return service.buscar(id).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.notFound().build());
    }
    @PostMapping public ResponseEntity<Map<String,Object>> cadastrar(@Valid @RequestBody PessoaRequest request) {
        long id = service.cadastrar(request); return ResponseEntity.status(201).body(Map.of("id",id,"message","Pessoa cadastrada com sucesso"));
    }
    @PutMapping("/{id}") public ResponseEntity<Map<String,Object>> alterar(@PathVariable long id,@Valid @RequestBody PessoaRequest request) {
        if (!service.alterar(id,request)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("id",id,"message","Pessoa alterada com sucesso"));
    }
    @DeleteMapping("/{id}") public ResponseEntity<Map<String,Object>> excluir(@PathVariable long id) {
        return service.excluir(id) ? ResponseEntity.ok(Map.of("id",id,"message","Pessoa excluída com sucesso")) : ResponseEntity.notFound().build();
    }

    public record PessoaRequest(@NotBlank @Size(max=150) String nome, String cpf, String cep, String logradouro,
            String numero, String complemento, String bairro, String cidade, String uf, String canalPreferencial,
            List<String> whatsapp, List<String> ntfy) {}
}