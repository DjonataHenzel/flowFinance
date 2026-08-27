package com.flowfinance.backend.controller;

import java.util.Map;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import com.fasterxml.jackson.core.JsonProcessingException;

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

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<Map<String,Object>> integridadeViolada() {
        return ResponseEntity.status(409).body(Map.of("message","O registro está vinculado a outros dados ou viola uma regra de integridade."));
    }

    @ExceptionHandler({HttpMessageNotReadableException.class,JsonProcessingException.class,MissingServletRequestPartException.class})
    ResponseEntity<Map<String,Object>> requisicaoInvalida() {
        return ResponseEntity.badRequest().body(Map.of("message","O conteúdo da requisição é inválido ou está incompleto."));
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<Map<String,Object>> uploadMuitoGrande() {
        return ResponseEntity.status(413).body(Map.of("message","Os arquivos enviados excedem o limite permitido."));
    }
}
