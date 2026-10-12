package com.flowfinance.backend.controller;

import com.flowfinance.backend.service.DashboardService;
import com.flowfinance.backend.service.DashboardService.ResumoFinanceiro;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.format.annotation.DateTimeFormat;
import java.time.LocalDate;
import java.util.List;
import com.flowfinance.backend.model.SituacaoContaEnum;
import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping("/api")
public class DashboardController {
    private final DashboardService service;

    public DashboardController(DashboardService service) {
        this.service = service;
    }

    @GetMapping("/dashboard")
    public ResumoFinanceiro dashboard(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim,
            @RequestParam(required = false) SituacaoContaEnum situacao, HttpSession sessao) {
        String usuario = sessao.getAttribute("usuario").toString();
        if (dataInicio == null && dataFim == null && situacao == null) {
            return service.buscarResumoMesAtual(usuario);
        }
        LocalDate hoje = LocalDate.now();
        return service.buscarResumo(dataInicio == null ? hoje.withDayOfMonth(1) : dataInicio,
                dataFim == null ? hoje.withDayOfMonth(hoje.lengthOfMonth()) : dataFim, situacao, usuario);
    }

    @GetMapping("/dashboard/serie-mensal")
    public List<DashboardService.ResumoMensal> serieMensal(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim,
            HttpSession sessao) {
        return service.buscarSerieMensal(dataInicio, dataFim, sessao.getAttribute("usuario").toString());
    }
}
