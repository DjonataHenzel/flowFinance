package com.flowfinance.backend.controller;

import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.Set;

import com.flowfinance.backend.model.FuncionalidadeEnum;
import com.flowfinance.backend.service.PermissaoService;
import com.flowfinance.backend.service.PermissaoService.PapelDetalhe;
import com.flowfinance.backend.service.PermissaoService.PapelResumo;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/permissoes")
public class PermissaoController {
    private final PermissaoService servico;

    public PermissaoController(PermissaoService servico) {
        this.servico = servico;
    }

    @GetMapping
    public List<PapelResumo> listar() {
        return servico.listar();
    }

    @GetMapping("/{id}")
    public ResponseEntity<PapelDetalhe> buscar(@PathVariable long id) {
        return servico.buscar(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/funcionalidades")
    public FuncionalidadeEnum[] funcionalidades() {
        return FuncionalidadeEnum.values();
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> cadastrar(@Valid @RequestBody PapelRequest requisicao) {
        long id = servico.cadastrar(requisicao.nome(), requisicao.descricao(), requisicao.ativo(),
                requisicao.funcionalidades());
        return ResponseEntity.created(URI.create("/api/permissoes/" + id))
                .body(Map.of("id", id, "message", "Papel cadastrado com sucesso"));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> alterar(@PathVariable long id,
            @Valid @RequestBody PapelRequest requisicao) {
        if (!servico.alterar(id, requisicao.nome(), requisicao.descricao(), requisicao.ativo(),
                requisicao.funcionalidades())) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("id", id, "message", "Papel alterado com sucesso"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> excluir(@PathVariable long id) {
        if (!servico.excluir(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("id", id, "message", "Papel excluído com sucesso"));
    }

    public record PapelRequest(
            @NotBlank String nome,
            String descricao,
            boolean ativo,
            @NotNull Set<FuncionalidadeEnum> funcionalidades) {
    }
}
