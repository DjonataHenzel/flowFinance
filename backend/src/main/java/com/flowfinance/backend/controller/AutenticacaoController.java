package com.flowfinance.backend.controller;

import com.flowfinance.backend.service.AutenticacaoService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import jakarta.servlet.http.HttpSession;
import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequestMapping("/api/autenticacao")
public class AutenticacaoController {
    private final AutenticacaoService autenticacaoService;

    public AutenticacaoController(AutenticacaoService autenticacaoService) {
        this.autenticacaoService = autenticacaoService;
    }

    @PostMapping("/entrar")
    public ResponseEntity<Map<String, Object>> entrar(@Valid @RequestBody EntradaRequest requisicao,
            HttpServletRequest request, HttpSession sessao) {
        if (!autenticacaoService.autenticar(requisicao.usuario(), requisicao.senha())) {
            return ResponseEntity.status(401).body(Map.of("autenticado", false, "message", "Usuário ou senha inválidos"));
        }
        var dados=autenticacaoService.dadosUsuario(requisicao.usuario());
        if(dados==null)
            return ResponseEntity.status(401).body(Map.of("autenticado",false,"message","Usuário inativo ou não encontrado"));
        request.changeSessionId();
        sessao.setAttribute("usuario", requisicao.usuario());
        return ResponseEntity.ok(resposta(dados));
    }

    @GetMapping("/sessao")
    public ResponseEntity<Map<String,Object>> sessaoAtual(HttpServletRequest request) {
        HttpSession sessao=request.getSession(false);
        if(sessao==null||sessao.getAttribute("usuario")==null)
            return ResponseEntity.status(401).body(Map.of("autenticado",false,"message","Sessão expirada. Entre novamente."));
        var dados=autenticacaoService.dadosUsuario(sessao.getAttribute("usuario").toString());
        if(dados==null){sessao.invalidate();return ResponseEntity.status(401).body(Map.of("autenticado",false,"message","Sessão expirada. Entre novamente."));}
        return ResponseEntity.ok(resposta(dados));
    }

    @PostMapping("/sair")
    public Map<String,Object> sair(HttpSession sessao) { sessao.invalidate(); return Map.of("message","Sessão encerrada"); }

    private Map<String,Object> resposta(AutenticacaoService.UsuarioAutenticado dados) {
        Map<String,Object> resposta=new java.util.HashMap<>();
        resposta.put("autenticado",true);resposta.put("usuario",dados.usuario());resposta.put("papelId",dados.papelId());
        resposta.put("papel",dados.papel());resposta.put("funcionalidades",dados.funcionalidades());return resposta;
    }

    public record EntradaRequest(@NotBlank String usuario, @NotBlank String senha) {}
}
