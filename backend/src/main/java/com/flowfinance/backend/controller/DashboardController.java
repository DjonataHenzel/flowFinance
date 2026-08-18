package com.flowfinance.backend.controller;

import com.flowfinance.backend.service.DashboardService;
import com.flowfinance.backend.service.DashboardService.ResumoFinanceiro;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.format.annotation.DateTimeFormat;
import java.time.LocalDate;
import com.flowfinance.backend.model.SituacaoContaEnum;

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
            @RequestParam(required = false) SituacaoContaEnum situacao) {
        if (dataInicio == null && dataFim == null && situacao == null) {
            return service.buscarResumoMesAtual();
        }
        LocalDate hoje = LocalDate.now();
        return service.buscarResumo(dataInicio == null ? hoje.withDayOfMonth(1) : dataInicio,
                dataFim == null ? hoje.withDayOfMonth(hoje.lengthOfMonth()) : dataFim, situacao);
    }
}
