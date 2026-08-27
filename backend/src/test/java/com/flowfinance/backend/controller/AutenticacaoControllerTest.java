package com.flowfinance.backend.controller;

import com.flowfinance.backend.service.AutenticacaoService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AutenticacaoController.class)
class AutenticacaoControllerTest {
    @Autowired private MockMvc mockMvc;
    @MockitoBean private AutenticacaoService autenticacaoService;

    @Test
    void deveAutenticarCredenciaisValidas() throws Exception {
        when(autenticacaoService.autenticar("admin", "admin")).thenReturn(true);
        when(autenticacaoService.dadosUsuario("admin")).thenReturn(
                new AutenticacaoService.UsuarioAutenticado("admin",null,null,java.util.List.of()));
        mockMvc.perform(post("/api/autenticacao/entrar").contentType("application/json")
                        .content("{\"usuario\":\"admin\",\"senha\":\"admin\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.autenticado").value(true));
    }

    @Test
    void deveRejeitarCredenciaisInvalidas() throws Exception {
        when(autenticacaoService.autenticar("admin", "errada")).thenReturn(false);
        mockMvc.perform(post("/api/autenticacao/entrar").contentType("application/json")
                        .content("{\"usuario\":\"admin\",\"senha\":\"errada\"}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.autenticado").value(false));
    }

    @Test
    void deveRestaurarSessaoValida() throws Exception {
        var dados=new AutenticacaoService.UsuarioAutenticado("admin",null,null,java.util.List.of());
        when(autenticacaoService.dadosUsuario("admin")).thenReturn(dados);
        mockMvc.perform(get("/api/autenticacao/sessao").sessionAttr("usuario","admin"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.autenticado").value(true))
                .andExpect(jsonPath("$.usuario").value("admin"));
    }

    @Test
    void deveRejeitarRestauracaoSemSessao() throws Exception {
        mockMvc.perform(get("/api/autenticacao/sessao"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.autenticado").value(false));
    }
}
