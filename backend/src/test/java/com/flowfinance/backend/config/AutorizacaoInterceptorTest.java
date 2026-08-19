package com.flowfinance.backend.config;

import static org.junit.jupiter.api.Assertions.assertFalse;
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
        autenticacao=mock(AutenticacaoService.class);
        ObjectProvider<AutenticacaoService> provider=mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(autenticacao);
        interceptor=new AutorizacaoInterceptor(provider);
    }

    @Test
    void deveRejeitarRequisicaoSemSessao() throws Exception {
        MockHttpServletRequest request=new MockHttpServletRequest("GET","/api/contas");
        MockHttpServletResponse response=new MockHttpServletResponse();
        assertFalse(interceptor.preHandle(request,response,new Object()));
        assertTrue(response.getStatus()==401);
    }

    @Test
    void deveRejeitarOperacaoSemPermissao() throws Exception {
        MockHttpServletRequest request=new MockHttpServletRequest("DELETE","/api/contas/10");
        request.getSession().setAttribute("usuario","teste");
        MockHttpServletResponse response=new MockHttpServletResponse();
        when(autenticacao.temPermissao("teste",FuncionalidadeEnum.EXCLUIR_CONTAS)).thenReturn(false);
        assertFalse(interceptor.preHandle(request,response,new Object()));
        assertTrue(response.getStatus()==403);
    }

    @Test
    void devePermitirOperacaoAutorizada() throws Exception {
        MockHttpServletRequest request=new MockHttpServletRequest("GET","/api/dashboard");
        request.getSession().setAttribute("usuario","teste");
        when(autenticacao.temPermissao("teste",FuncionalidadeEnum.VISUALIZAR_DASHBOARD)).thenReturn(true);
        assertTrue(interceptor.preHandle(request,new MockHttpServletResponse(),new Object()));
    }
}
