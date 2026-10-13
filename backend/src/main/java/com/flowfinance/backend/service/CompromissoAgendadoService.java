package com.flowfinance.backend.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class CompromissoAgendadoService {
    private final CompromissoService service;

    public CompromissoAgendadoService(CompromissoService service) {
        this.service = service;
    }

    @Scheduled(cron = "0 * * * * *", zone = "${app.time-zone:America/Sao_Paulo}")
    public void executar() {
        service.notificarPendentes();
    }
}