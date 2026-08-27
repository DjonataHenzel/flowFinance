package com.flowfinance.backend.controller;

import java.time.LocalDate;
import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.flowfinance.backend.service.RelatorioService;

import jakarta.servlet.http.HttpSession;

@RestController
@RequestMapping("/api/relatorios")
public class RelatorioController {
    private final RelatorioService service;
    public RelatorioController(RelatorioService service) { this.service=service; }

    @GetMapping("/contas")
    public List<RelatorioService.ContaRelatorio> contas(@RequestParam LocalDate inicio,
            @RequestParam LocalDate fim,HttpSession sessao) {
        validar(inicio,fim);
        return service.contas(inicio,fim,sessao.getAttribute("usuario").toString());
    }

    @GetMapping("/compromissos")
    public List<RelatorioService.CompromissoRelatorio> compromissos(@RequestParam LocalDate inicio,
            @RequestParam LocalDate fim) {
        validar(inicio,fim);
        return service.compromissos(inicio,fim);
    }

    private void validar(LocalDate inicio,LocalDate fim) {
        if (fim.isBefore(inicio)) throw new IllegalArgumentException("A data final não pode ser anterior à data inicial");
    }
}
