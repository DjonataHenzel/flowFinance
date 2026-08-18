package com.flowfinance.backend.controller;

import com.flowfinance.backend.service.UsuarioService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.List;
import com.flowfinance.backend.service.UsuarioService.UsuarioResumo;

@RestController
@RequestMapping("/api/usuarios")
public class UsuarioController {
    private final UsuarioService service;

    public UsuarioController(UsuarioService service) {
        this.service = service;
    }

    @GetMapping
    public List<UsuarioResumo> listar() {
        return service.listar();
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> cadastrar(@Valid @RequestBody NovoUsuarioRequest request) {
        try {
            service.cadastrar(request.usuario(), request.senha(),request.papelId());
            return ResponseEntity.status(201).body(Map.of("message", "Usuário cadastrado com sucesso"));
        } catch (DuplicateKeyException exception) {
            return ResponseEntity.status(409).body(Map.of("message", "Este nome de usuário já está cadastrado"));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> alterar(@PathVariable long id, @Valid @RequestBody AlterarUsuarioRequest request) {
        try {
            if (!service.alterar(id, request.usuario(), request.senha(), request.ativo(),request.papelId())) return ResponseEntity.notFound().build();
            return ResponseEntity.ok(Map.of("message", "Usuário alterado com sucesso"));
        } catch (DuplicateKeyException exception) {
            return ResponseEntity.status(409).body(Map.of("message", "Este nome de usuário já está cadastrado"));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> excluir(@PathVariable long id) {
        return service.excluir(id) ? ResponseEntity.ok(Map.of("message", "Usuário excluído com sucesso")) : ResponseEntity.notFound().build();
    }

    public record NovoUsuarioRequest(@NotBlank @Size(max = 100) String usuario,
            @NotBlank @Size(min = 4, max = 72) String senha,@NotNull Long papelId) {
    }
    public record AlterarUsuarioRequest(@NotBlank @Size(max = 100) String usuario,
            @Size(min = 4, max = 72) String senha, boolean ativo,@NotNull Long papelId) {}
}
