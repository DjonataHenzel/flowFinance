package com.flowfinance.backend.controller;

import com.flowfinance.backend.service.CompromissoService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.OffsetDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/compromissos")
public class CompromissoController {
    private final CompromissoService service;
    public CompromissoController(CompromissoService service) { this.service=service; }
    @GetMapping public List<CompromissoService.CompromissoResumo> listar(){return service.listar();}
    @PostMapping public ResponseEntity<Map<String,Object>> cadastrar(@Valid @RequestBody CompromissoRequest r){long id=service.cadastrar(r);return ResponseEntity.status(201).body(Map.of("id",id,"message","Compromisso cadastrado com sucesso"));}
    @PutMapping("/{id}") public ResponseEntity<Map<String,Object>> alterar(@PathVariable long id,@Valid @RequestBody CompromissoRequest r){if(!service.alterar(id,r))return ResponseEntity.notFound().build();return ResponseEntity.ok(Map.of("id",id,"message","Compromisso alterado com sucesso"));}
    @PostMapping("/{id}/duplicar") public ResponseEntity<Map<String,Object>> duplicar(@PathVariable long id){Long novo=service.duplicar(id);return novo==null?ResponseEntity.notFound().build():ResponseEntity.status(201).body(Map.of("id",novo,"message","Compromisso duplicado com sucesso"));}
    @DeleteMapping("/{id}") public ResponseEntity<Map<String,Object>> excluir(@PathVariable long id){return service.excluir(id)?ResponseEntity.ok(Map.of("id",id,"message","Compromisso excluído com sucesso")):ResponseEntity.notFound().build();}
    public record CompromissoRequest(@NotNull OffsetDateTime dataHora,@NotBlank @Size(max=1000) String descricao,@NotNull Long pessoaId,@NotNull LocalTime horaNotificacao,@NotBlank String situacao){}
}