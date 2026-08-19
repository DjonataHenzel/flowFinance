package com.flowfinance.backend.controller;

import java.math.BigDecimal;

import com.flowfinance.backend.service.DashboardService;
import com.flowfinance.backend.service.DashboardService.ResumoFinanceiro;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(DashboardController.class)
class DashboardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private DashboardService dashboardService;

    @Test
    void shouldReturnDashboardSummary() throws Exception {
        when(dashboardService.buscarResumoMesAtual("admin")).thenReturn(new ResumoFinanceiro(
                "Agosto", new BigDecimal("18500.00"), new BigDecimal("9200.00"), new BigDecimal("9300.00")));
        mockMvc.perform(get("/api/dashboard").sessionAttr("usuario","admin"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.month").exists())
                .andExpect(jsonPath("$.totalIncome").value(18500.0));
    }
}
