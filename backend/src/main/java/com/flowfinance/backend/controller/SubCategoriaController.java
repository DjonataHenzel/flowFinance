package com.flowfinance.backend.controller;

import java.net.URI;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.flowfinance.backend.service.SubCategoriaService;

import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

@RestController
@RequestMapping("/api/subcategorias")
public class SubCategoriaController {
    private final SubCategoriaService service;

    public SubCategoriaController(SubCategoriaService service) {
        this.service = service;
    }

    @GetMapping
    public List<SubCategoriaService.SubCategoriaResumo> listar(HttpSession sessao) {
        return service.listar(usuario(sessao));
    }

    @GetMapping("/categorias")
    public List<SubCategoriaService.CategoriaOpcao> listarCategoriasVinculaveis(HttpSession sessao) {
        return service.listarCategoriasVinculaveis(usuario(sessao));
    }

    @GetMapping("/{id}")
    public ResponseEntity<SubCategoriaService.SubCategoriaResumo> buscar(@PathVariable long id,
            HttpSession sessao) {
        return service.buscar(id, usuario(sessao)).map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> cadastrar(@Valid @RequestBody SubCategoriaRequest request,
            HttpSession sessao) {
        long id = service.cadastrar(request.nome(), request.descricao(), request.categoriaId(), usuario(sessao));
        return ResponseEntity.created(URI.create("/api/subcategorias/" + id))
                .body(Map.of("id", id, "message", "Subcategoria cadastrada com sucesso"));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> alterar(@PathVariable long id,
            @Valid @RequestBody SubCategoriaRequest request, HttpSession sessao) {
        if (!service.alterar(id, request.nome(), request.descricao(), request.categoriaId(), usuario(sessao))) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("id", id, "message", "Subcategoria alterada com sucesso"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> excluir(@PathVariable long id, HttpSession sessao) {
        return service.excluir(id, usuario(sessao))
                ? ResponseEntity.ok(Map.of("id", id, "message", "Subcategoria excluída com sucesso"))
                : ResponseEntity.notFound().build();
    }

    private String usuario(HttpSession sessao) {
        return sessao.getAttribute("usuario").toString();
    }

    public record SubCategoriaRequest(@NotBlank @Size(max = 100) String nome,
            @Size(max = 255) String descricao, @NotNull @Positive Long categoriaId) {}
}
