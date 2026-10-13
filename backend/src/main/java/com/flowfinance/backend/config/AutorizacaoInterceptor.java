package com.flowfinance.backend.config;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import com.flowfinance.backend.model.FuncionalidadeEnum;
import com.flowfinance.backend.service.AutenticacaoService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class AutorizacaoInterceptor implements HandlerInterceptor {
    private final AutenticacaoService autenticacao;

    public AutorizacaoInterceptor(ObjectProvider<AutenticacaoService> autenticacao) {
        this.autenticacao = autenticacao.getIfAvailable();
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws IOException {
        if ("OPTIONS".equals(request.getMethod())
                || request.getRequestURI().startsWith("/api/autenticacao/"))
            return true;

        if (autenticacao == null)
            return erro(response, 503, "Serviço de autorização indisponível.");

        Object usuario = request.getSession(false) == null ? null : request.getSession(false).getAttribute("usuario");

        if (usuario == null) {
            if (ehDownloadDeAnexo(request)) {
                String retorno = URLEncoder.encode(request.getRequestURI(), StandardCharsets.UTF_8);
                response.sendRedirect("/?download=" + retorno);
                return false;
            }

            return erro(response, 401, "Sessão expirada. Entre novamente.");
        }

        if (autenticacao.ehConvidado(usuario.toString())) {
            return erro(response, 403,
                    "O perfil Convidado permite navegar pelas telas, mas não consultar ou alterar informações.");
        }

        FuncionalidadeEnum necessaria = funcionalidadeNecessaria(request);

        if (necessaria != null && !autenticacao.temPermissao(usuario.toString(), necessaria))
            return erro(response, 403, "Você não possui permissão para esta operação.");

        return true;
    }

    private FuncionalidadeEnum funcionalidadeNecessaria(HttpServletRequest request) {
        String caminho = request.getRequestURI(), metodo = request.getMethod();

        if (caminho.equals("/api/dashboard") || caminho.startsWith("/api/dashboard/"))
            return FuncionalidadeEnum.VISUALIZAR_DASHBOARD;

        if (caminho.equals("/api/relatorios/contas"))
            return FuncionalidadeEnum.CONSULTAR_CONTAS;

        if (caminho.equals("/api/relatorios/compromissos"))
            return FuncionalidadeEnum.CONSULTAR_COMPROMISSOS;

        if (caminho.startsWith("/api/permissoes"))
            return FuncionalidadeEnum.GERENCIAR_PERMISSOES;

        if (caminho.startsWith("/api/usuarios"))
            return Map
                    .of("GET", FuncionalidadeEnum.CONSULTAR_USUARIOS, "POST", FuncionalidadeEnum.CADASTRAR_USUARIOS,
                            "PUT", FuncionalidadeEnum.ALTERAR_USUARIOS, "DELETE", FuncionalidadeEnum.EXCLUIR_USUARIOS)
                    .get(metodo);

        if (caminho.startsWith("/api/pessoas"))
            return Map
                    .of("GET", FuncionalidadeEnum.CONSULTAR_PESSOAS, "POST", FuncionalidadeEnum.CADASTRAR_PESSOAS,
                            "PUT", FuncionalidadeEnum.ALTERAR_PESSOAS, "DELETE", FuncionalidadeEnum.EXCLUIR_PESSOAS)
                    .get(metodo);

        if (caminho.startsWith("/api/contas-bancarias"))
            return Map.of("GET", FuncionalidadeEnum.CONSULTAR_CONTAS_BANCARIAS, "POST",
                    FuncionalidadeEnum.CADASTRAR_CONTAS_BANCARIAS, "PUT", FuncionalidadeEnum.ALTERAR_CONTAS_BANCARIAS,
                    "DELETE", FuncionalidadeEnum.EXCLUIR_CONTAS_BANCARIAS).get(metodo);

        if (caminho.startsWith("/api/categorias"))
            return Map.of("GET", FuncionalidadeEnum.CONSULTAR_CATEGORIAS, "POST",
                    FuncionalidadeEnum.CADASTRAR_CATEGORIAS, "PUT", FuncionalidadeEnum.ALTERAR_CATEGORIAS, "DELETE",
                    FuncionalidadeEnum.EXCLUIR_CATEGORIAS).get(metodo);

        if (caminho.startsWith("/api/subcategorias"))
            return Map.of("GET", FuncionalidadeEnum.CONSULTAR_SUBCATEGORIAS, "POST",
                    FuncionalidadeEnum.CADASTRAR_SUBCATEGORIAS, "PUT", FuncionalidadeEnum.ALTERAR_SUBCATEGORIAS,
                    "DELETE", FuncionalidadeEnum.EXCLUIR_SUBCATEGORIAS).get(metodo);

        if (caminho.startsWith("/api/compromissos"))
            return Map.of("GET", FuncionalidadeEnum.CONSULTAR_COMPROMISSOS, "POST",
                    FuncionalidadeEnum.CADASTRAR_COMPROMISSOS, "PUT", FuncionalidadeEnum.ALTERAR_COMPROMISSOS, "DELETE",
                    FuncionalidadeEnum.EXCLUIR_COMPROMISSOS).get(metodo);

        if (!caminho.startsWith("/api/contas"))
            return null;

        if ("GET".equals(metodo) || caminho.endsWith("/notificar"))
            return FuncionalidadeEnum.CONSULTAR_CONTAS;

        if (caminho.endsWith("/duplicar"))
            return FuncionalidadeEnum.DUPLICAR_CONTAS;

        if (caminho.endsWith("/baixar"))
            return FuncionalidadeEnum.BAIXAR_RECEBER_CONTAS;

        if (caminho.endsWith("/estornar-baixa"))
            return FuncionalidadeEnum.ESTORNAR_BAIXAS;

        return Map.of("POST", FuncionalidadeEnum.CADASTRAR_CONTAS, "PUT", FuncionalidadeEnum.ALTERAR_CONTAS, "DELETE",
                FuncionalidadeEnum.EXCLUIR_CONTAS).get(metodo);
    }

    private boolean ehDownloadDeAnexo(HttpServletRequest request) {
        return request.getRequestURI().matches("/api/(contas|compromissos)/\\d+/anexos/\\d+/download");
    }

    private boolean erro(HttpServletResponse response, int status, String mensagem) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"message\":\"" + mensagem + "\"}");
        return false;
    }
}
