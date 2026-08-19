package com.flowfinance.backend.controller;

import java.util.Map;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String,Object>> argumentoInvalido(IllegalArgumentException exception) {
        return ResponseEntity.badRequest().body(Map.of("message",exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String,Object>> validacaoInvalida() {
        return ResponseEntity.badRequest().body(Map.of("message","Verifique os dados informados."));
    }

    @ExceptionHandler(DuplicateKeyException.class)
    ResponseEntity<Map<String,Object>> registroDuplicado() {
        return ResponseEntity.status(409).body(Map.of("message","Já existe um registro com estes dados."));
    }
}
