package com.flowfinance.backend.controller;

import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.flowfinance.backend.model.BancoEnum;
import com.flowfinance.backend.service.ContaBancariaService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/contas-bancarias")
public class ContaBancariaController {
    private final ContaBancariaService service;

    public ContaBancariaController(ContaBancariaService service) {
        this.service = service;
    }

    @GetMapping
    public List<ContaBancariaService.ContaBancariaResumo> listar(HttpSession s) {
        return service.listar(usuario(s));
    }

    @GetMapping("/titulares")
    public List<ContaBancariaService.TitularResumo> titulares() {
        return service.listarTitulares();
    }

    @GetMapping("/{id}")
    public ResponseEntity<ContaBancariaService.ContaBancariaResumo> buscar(@PathVariable long id, HttpSession s) {
        return service.buscar(id, usuario(s)).map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> cadastrar(@Valid @RequestBody ContaBancariaRequest r, HttpSession s) {
        long id = service.cadastrar(r.banco(), r.agencia(), r.numeroConta(), r.pessoaId(), usuario(s));
        return ResponseEntity.status(201).body(Map.of("id", id, "message", "Conta bancária cadastrada com sucesso"));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> alterar(@PathVariable long id,
            @Valid @RequestBody ContaBancariaRequest r, HttpSession s) {
        return service.alterar(id, r.banco(), r.agencia(), r.numeroConta(), r.pessoaId(), usuario(s))
                ? ResponseEntity.ok(Map.of("id", id, "message", "Conta bancária alterada com sucesso"))
                : ResponseEntity.notFound().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> excluir(@PathVariable long id, HttpSession s) {
        return service.excluir(id, usuario(s))
                ? ResponseEntity.ok(Map.of("id", id, "message", "Conta bancária excluída com sucesso"))
                : ResponseEntity.notFound().build();
    }

    private String usuario(HttpSession s) {
        return s.getAttribute("usuario").toString();
    }

    public record ContaBancariaRequest(
            @NotNull BancoEnum banco,
            @NotBlank @Size(max = 20) String agencia,
            @NotBlank @Size(max = 30) String numeroConta,
            @NotNull Long pessoaId) {
    }
}
