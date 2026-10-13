package com.flowfinance.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Set;

import org.junit.jupiter.api.Test;

import com.flowfinance.backend.model.FuncionalidadeEnum;

class PermissaoServiceTest {
    @Test
    void perfilConvidadoExcluiTodasAsOutrasFuncionalidades() {
        Set<FuncionalidadeEnum> resultado = PermissaoService.normalizarFuncionalidades(Set.of(
                FuncionalidadeEnum.PERFIL_CONVIDADO,
                FuncionalidadeEnum.CONSULTAR_CONTAS,
                FuncionalidadeEnum.CADASTRAR_CONTAS));

        assertEquals(Set.of(FuncionalidadeEnum.PERFIL_CONVIDADO), resultado);
    }

    @Test
    void perfilSemConvidadoMantemFuncionalidadesSelecionadas() {
        Set<FuncionalidadeEnum> selecionadas = Set.of(
                FuncionalidadeEnum.CONSULTAR_CONTAS,
                FuncionalidadeEnum.CADASTRAR_CONTAS);

        assertEquals(selecionadas, PermissaoService.normalizarFuncionalidades(selecionadas));
    }
}
