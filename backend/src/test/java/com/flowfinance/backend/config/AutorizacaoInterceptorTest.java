package com.flowfinance.backend.config;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import com.flowfinance.backend.model.FuncionalidadeEnum;
import com.flowfinance.backend.service.AutenticacaoService;

class AutorizacaoInterceptorTest {
    private AutenticacaoService autenticacao;
    private AutorizacaoInterceptor interceptor;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void configurar() {
        autenticacao = mock(AutenticacaoService.class);
        ObjectProvider<AutenticacaoService> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(autenticacao);
        interceptor = new AutorizacaoInterceptor(provider);
    }

    @Test
    void deveRejeitarRequisicaoSemSessao() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/contas");
        MockHttpServletResponse response = new MockHttpServletResponse();
        assertFalse(interceptor.preHandle(request, response, new Object()));
        assertEquals(401, response.getStatus());
    }

    @Test
    void deveRedirecionarDownloadParaLoginQuandoSessaoExpirar() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/contas/10/anexos/4/download");
        MockHttpServletResponse response = new MockHttpServletResponse();
        assertFalse(interceptor.preHandle(request, response, new Object()));
        assertEquals(302, response.getStatus());
        assertEquals(
                "/?download=%2Fapi%2Fcontas%2F10%2Fanexos%2F4%2Fdownload",
                response.getHeader("Location"));
    }

    @Test
    void deveRejeitarOperacaoSemPermissao() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("DELETE", "/api/contas/10");
        request.getSession().setAttribute("usuario", "teste");
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(autenticacao.temPermissao("teste", FuncionalidadeEnum.EXCLUIR_CONTAS)).thenReturn(false);
        assertFalse(interceptor.preHandle(request, response, new Object()));
        assertEquals(403, response.getStatus());
    }

    @Test
    void devePermitirOperacaoAutorizada() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/dashboard");
        request.getSession().setAttribute("usuario", "teste");
        when(autenticacao.temPermissao("teste", FuncionalidadeEnum.VISUALIZAR_DASHBOARD))
                .thenReturn(true);
        assertTrue(interceptor.preHandle(request, new MockHttpServletResponse(), new Object()));
    }

    @Test
    void devePermitirSerieMensalComPermissaoDeDashboard() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/dashboard/serie-mensal");
        request.getSession().setAttribute("usuario", "teste");
        when(autenticacao.temPermissao("teste", FuncionalidadeEnum.VISUALIZAR_DASHBOARD))
                .thenReturn(true);
        assertTrue(interceptor.preHandle(request, new MockHttpServletResponse(), new Object()));
    }

    @Test
    void deveExigirPermissaoParaContasBancarias() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/contas-bancarias");
        request.getSession().setAttribute("usuario", "teste");
        when(autenticacao.temPermissao("teste", FuncionalidadeEnum.CADASTRAR_CONTAS_BANCARIAS))
                .thenReturn(false);

        MockHttpServletResponse response = new MockHttpServletResponse();
        assertFalse(interceptor.preHandle(request, response, new Object()));
        assertEquals(403, response.getStatus());
    }

    @Test
    void deveProtegerRelatorioDeCompromissos() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/relatorios/compromissos");
        request.getSession().setAttribute("usuario", "teste");
        when(autenticacao.temPermissao("teste", FuncionalidadeEnum.CONSULTAR_COMPROMISSOS))
                .thenReturn(true);

        assertTrue(interceptor.preHandle(request, new MockHttpServletResponse(), new Object()));
    }

    @Test
    void deveExigirPermissaoParaSubcategorias() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("PUT", "/api/subcategorias/10");
        request.getSession().setAttribute("usuario", "teste");
        when(autenticacao.temPermissao("teste", FuncionalidadeEnum.ALTERAR_SUBCATEGORIAS))
                .thenReturn(false);

        MockHttpServletResponse response = new MockHttpServletResponse();
        assertFalse(interceptor.preHandle(request, response, new Object()));
        assertEquals(403, response.getStatus());
    }

    @Test
    void deveBloquearLeituraEAlteracaoParaPerfilConvidado() throws Exception {
        when(autenticacao.ehConvidado("teste")).thenReturn(true);

        for (String metodo : new String[] { "GET", "POST" }) {
            MockHttpServletRequest request = new MockHttpServletRequest(metodo, "/api/contas");
            request.getSession().setAttribute("usuario", "teste");
            MockHttpServletResponse response = new MockHttpServletResponse();

            assertFalse(interceptor.preHandle(request, response, new Object()));
            assertEquals(403, response.getStatus());
            assertTrue(response.getContentAsString().contains(
                    "O perfil Convidado permite navegar pelas telas, mas não consultar ou alterar informações."));
        }
    }

    @Test
    @SuppressWarnings("unchecked")
    void deveBloquearQuandoServicoDeAutorizacaoEstiverIndisponivel() throws Exception {
        ObjectProvider<AutenticacaoService> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(null);
        AutorizacaoInterceptor semAutenticacao = new AutorizacaoInterceptor(provider);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/contas");
        MockHttpServletResponse response = new MockHttpServletResponse();

        assertFalse(semAutenticacao.preHandle(request, response, new Object()));
        assertEquals(503, response.getStatus());
    }
}
