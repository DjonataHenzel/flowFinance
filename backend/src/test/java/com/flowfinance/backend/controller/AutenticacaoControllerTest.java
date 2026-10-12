package com.flowfinance.backend.controller;

import com.flowfinance.backend.service.AutenticacaoService;
import com.flowfinance.backend.config.AutorizacaoInterceptor;
import com.flowfinance.backend.config.ConfiguracaoCors;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AutenticacaoController.class)
@Import({ ConfiguracaoCors.class, AutorizacaoInterceptor.class })
class AutenticacaoControllerTest {
    @Autowired
    private MockMvc mockMvc;
    @MockitoBean
    private AutenticacaoService autenticacaoService;

    @Test
    void deveAceitarPreflightHttpsDoLogin() throws Exception {
        mockMvc.perform(options("/api/autenticacao/entrar")
                .header("Origin", "https://flowfinance.ddns.net")
                .header("Access-Control-Request-Method", "POST")
                .header("Access-Control-Request-Headers", "content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://flowfinance.ddns.net"))
                .andExpect(header().string("Access-Control-Allow-Methods", containsString("POST")))
                .andExpect(header().string("Access-Control-Allow-Headers", containsString("content-type")))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }

    @Test
    void deveAutenticarCredenciaisValidas() throws Exception {
        when(autenticacaoService.autenticar("admin", "admin")).thenReturn(true);
        when(autenticacaoService.dadosUsuario("admin")).thenReturn(
                new AutenticacaoService.UsuarioAutenticado("admin", null, null, java.util.List.of()));
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
        var dados = new AutenticacaoService.UsuarioAutenticado("admin", null, null, java.util.List.of());
        when(autenticacaoService.dadosUsuario("admin")).thenReturn(dados);
        mockMvc.perform(get("/api/autenticacao/sessao").sessionAttr("usuario", "admin"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.autenticado").value(true))
                .andExpect(jsonPath("$.usuario").value("admin"));
    }

    @Test
    void deveRejeitarRestauracaoSemSessao() throws Exception {
        mockMvc.perform(get("/api/autenticacao/sessao"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.autenticado").value(false));
    }
}
