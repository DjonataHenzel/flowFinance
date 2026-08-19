package com.flowfinance.backend.controller;

import com.flowfinance.backend.service.AutenticacaoService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping("/api/autenticacao")
public class AutenticacaoController {
    private final AutenticacaoService autenticacaoService;

    public AutenticacaoController(AutenticacaoService autenticacaoService) {
        this.autenticacaoService = autenticacaoService;
    }

    @PostMapping("/entrar")
    public ResponseEntity<Map<String, Object>> entrar(@Valid @RequestBody EntradaRequest requisicao, HttpSession sessao) {
        if (!autenticacaoService.autenticar(requisicao.usuario(), requisicao.senha())) {
            return ResponseEntity.status(401).body(Map.of("autenticado", false, "message", "Usuário ou senha inválidos"));
        }
        var dados=autenticacaoService.dadosUsuario(requisicao.usuario());
        sessao.setAttribute("usuario", requisicao.usuario());
        if(dados==null)return ResponseEntity.ok(Map.of("autenticado",true,"usuario",requisicao.usuario()));
        Map<String,Object> resposta=new java.util.HashMap<>();resposta.put("autenticado",true);resposta.put("usuario",dados.usuario());resposta.put("papelId",dados.papelId());resposta.put("papel",dados.papel());resposta.put("funcionalidades",dados.funcionalidades());
        return ResponseEntity.ok(resposta);
    }

    @PostMapping("/sair")
    public Map<String,Object> sair(HttpSession sessao) { sessao.invalidate(); return Map.of("message","Sessão encerrada"); }

    public record EntradaRequest(@NotBlank String usuario, @NotBlank String senha) {}
}
