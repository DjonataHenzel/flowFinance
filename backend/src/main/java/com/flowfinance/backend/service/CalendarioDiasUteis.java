package com.flowfinance.backend.service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.MonthDay;
import java.util.List;
import java.util.Set;
import java.util.stream.IntStream;

final class CalendarioDiasUteis {
    private static final Set<MonthDay> FERIADOS_NACIONAIS = Set.of(
            MonthDay.of(1, 1), MonthDay.of(4, 21), MonthDay.of(5, 1), MonthDay.of(9, 7),
            MonthDay.of(10, 12), MonthDay.of(11, 2), MonthDay.of(11, 15), MonthDay.of(11, 20),
            MonthDay.of(12, 25));

    private CalendarioDiasUteis() {
    }

    static List<LocalDate> vencimentosParaNotificar(LocalDate referencia) {
        if (!diaUtil(referencia))
            return List.of();
        return IntStream.rangeClosed(0, 14)
                .mapToObj(referencia::minusDays)
                .filter(data -> proximoDiaUtil(data).equals(referencia))
                .toList();
    }

    private static LocalDate proximoDiaUtil(LocalDate data) {
        LocalDate atual = data;
        while (!diaUtil(atual))
            atual = atual.plusDays(1);
        return atual;
    }

    private static boolean diaUtil(LocalDate data) {
        DayOfWeek dia = data.getDayOfWeek();
        return dia != DayOfWeek.SATURDAY && dia != DayOfWeek.SUNDAY && !feriadoNacional(data);
    }

    private static boolean feriadoNacional(LocalDate data) {
        return FERIADOS_NACIONAIS.contains(MonthDay.from(data))
                || data.equals(domingoPascoa(data.getYear()).minusDays(2));
    }

    private static LocalDate domingoPascoa(int ano) {
        int a = ano % 19;
        int b = ano / 100;
        int c = ano % 100;
        int d = b / 4;
        int e = b % 4;
        int f = (b + 8) / 25;
        int g = (b - f + 1) / 3;
        int h = (19 * a + b - d - g + 15) % 30;
        int i = c / 4;
        int k = c % 4;
        int l = (32 + 2 * e + 2 * i - h - k) % 7;
        int m = (a + 11 * h + 22 * l) / 451;
        int mes = (h + l - 7 * m + 114) / 31;
        int dia = (h + l - 7 * m + 114) % 31 + 1;
        return LocalDate.of(ano, mes, dia);
    }
}