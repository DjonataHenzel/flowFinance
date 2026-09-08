package com.flowfinance.backend.controller;

import com.flowfinance.backend.service.UsuarioService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.List;
import java.time.LocalTime;
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

    @GetMapping("/pessoas-vinculaveis")
    public List<UsuarioService.PessoaVinculavel> listarPessoasVinculaveis(
            @RequestParam(required = false) Long usuarioId) {
        return service.listarPessoasVinculaveis(usuarioId);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> cadastrar(@Valid @RequestBody NovoUsuarioRequest request) {
        service.cadastrar(request.usuario(), request.senha(),request.papelId(), request.pessoaId(), request.notificarContaVencendoWhatsapp(), request.contatosWhatsapp(), request.notificarContaVencendoNtfy(), request.topicoNtfy(),request.horaNotificacao(),request.diasAntecedencia(),request.visualizarCadastrosTodosUsuarios());
        return ResponseEntity.status(201).body(Map.of("message", "Usuário cadastrado com sucesso"));
    }

    @PutMapping("/{id}")
    public ResponseEntity<Map<String, Object>> alterar(@PathVariable long id, @Valid @RequestBody AlterarUsuarioRequest request) {
        if (!service.alterar(id, request.usuario(), request.senha(), request.ativo(),request.papelId(), request.pessoaId(), request.notificarContaVencendoWhatsapp(), request.contatosWhatsapp(), request.notificarContaVencendoNtfy(), request.topicoNtfy(),request.horaNotificacao(),request.diasAntecedencia(),request.visualizarCadastrosTodosUsuarios())) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("message", "Usuário alterado com sucesso"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> excluir(@PathVariable long id) {
        return service.excluir(id) ? ResponseEntity.ok(Map.of("message", "Usuário excluído com sucesso")) : ResponseEntity.notFound().build();
    }

    public record NovoUsuarioRequest(@NotBlank @Size(max = 100) String usuario,
            @NotBlank @Size(min = 4, max = 72) String senha,@NotNull Long papelId, Long pessoaId,
            boolean notificarContaVencendoWhatsapp, List<String> contatosWhatsapp,
            boolean notificarContaVencendoNtfy, String topicoNtfy, LocalTime horaNotificacao, Integer diasAntecedencia,
            boolean visualizarCadastrosTodosUsuarios) {
    }
    public record AlterarUsuarioRequest(@NotBlank @Size(max = 100) String usuario,
            @Size(min = 4, max = 72) String senha, boolean ativo,@NotNull Long papelId, Long pessoaId,
            boolean notificarContaVencendoWhatsapp, List<String> contatosWhatsapp,
            boolean notificarContaVencendoNtfy, String topicoNtfy, LocalTime horaNotificacao, Integer diasAntecedencia,
            boolean visualizarCadastrosTodosUsuarios) {}
}
