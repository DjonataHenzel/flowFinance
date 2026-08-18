package com.flowfinance.backend.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Mantém bancos já instalados compatíveis sem exigir recriação das tabelas. */
@Component
public class InicializacaoBanco implements ApplicationRunner {
    private final JdbcTemplate jdbc;
    public InicializacaoBanco(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @Override
    public void run(ApplicationArguments args) {
        jdbc.execute("ALTER TABLE contas ADD COLUMN IF NOT EXISTS qtd_parcelas INTEGER NOT NULL DEFAULT 1");
        jdbc.execute("ALTER TABLE contas ADD COLUMN IF NOT EXISTS usuario_cadastro BIGINT REFERENCES usuario(id)");
        jdbc.execute("ALTER TABLE contas ADD COLUMN IF NOT EXISTS tipo VARCHAR(7) NOT NULL DEFAULT 'RECEBER'");
        jdbc.execute("ALTER TABLE contas ADD COLUMN IF NOT EXISTS situacao VARCHAR(9) NOT NULL DEFAULT 'ABERTA'");
        jdbc.execute("ALTER TABLE contas DROP CONSTRAINT IF EXISTS contas_tipo_check");
        jdbc.execute("ALTER TABLE contas DROP CONSTRAINT IF EXISTS contas_situacao_check");
        jdbc.execute("UPDATE contas SET tipo = CASE tipo WHEN 'ENTRADA' THEN 'RECEBER' WHEN 'SAIDA' THEN 'PAGAR' ELSE tipo END");
        jdbc.execute("UPDATE contas SET situacao = CASE WHEN situacao IN ('PAGA','RECEBIDA') THEN situacao WHEN qtd_parcelas > 1 THEN 'PARCELADA' ELSE 'ABERTA' END");
        jdbc.execute("ALTER TABLE contas ALTER COLUMN tipo SET DEFAULT 'RECEBER'");
        jdbc.execute("ALTER TABLE contas ALTER COLUMN situacao SET DEFAULT 'ABERTA'");
        jdbc.execute("ALTER TABLE contas ADD CONSTRAINT contas_tipo_check CHECK (tipo IN ('RECEBER','PAGAR'))");
        jdbc.execute("ALTER TABLE contas ADD CONSTRAINT contas_situacao_check CHECK (situacao IN ('ABERTA','PAGA','RECEBIDA','PARCELADA'))");
        jdbc.execute("ALTER TABLE contas ADD COLUMN IF NOT EXISTS criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP");
        jdbc.execute("ALTER TABLE contas ADD COLUMN IF NOT EXISTS baixada_em TIMESTAMP WITH TIME ZONE");
        jdbc.execute("ALTER TABLE parcelas_contas ADD COLUMN IF NOT EXISTS baixada_em TIMESTAMP WITH TIME ZONE");
        jdbc.execute("ALTER TABLE parcelas_contas ADD COLUMN IF NOT EXISTS observacao_baixa VARCHAR(1000)");
        jdbc.execute("ALTER TABLE parcelas_contas ADD COLUMN IF NOT EXISTS situacao VARCHAR(9) NOT NULL DEFAULT 'PENDENTE'");
        jdbc.execute("ALTER TABLE parcelas_contas DROP CONSTRAINT IF EXISTS parcelas_contas_situacao_check");
        jdbc.execute("UPDATE parcelas_contas p SET situacao=CASE WHEN p.baixada_em IS NULL THEN 'PENDENTE' WHEN c.tipo='PAGAR' THEN 'PAGA' ELSE 'RECEBIDA' END FROM contas c WHERE c.id=p.conta_id");
        jdbc.execute("ALTER TABLE parcelas_contas ADD CONSTRAINT parcelas_contas_situacao_check CHECK (situacao IN ('PENDENTE','PAGA','RECEBIDA'))");
        jdbc.execute("ALTER TABLE anexos_contas ADD COLUMN IF NOT EXISTS descricao VARCHAR(255) NOT NULL DEFAULT 'Anexo'");
        jdbc.execute("CREATE TABLE IF NOT EXISTS papeis (id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,nome VARCHAR(100) NOT NULL UNIQUE,descricao VARCHAR(255),ativo BOOLEAN NOT NULL DEFAULT TRUE,criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS papel_funcionalidades (papel_id BIGINT NOT NULL REFERENCES papeis(id) ON DELETE CASCADE,funcionalidade VARCHAR(60) NOT NULL,PRIMARY KEY(papel_id,funcionalidade))");
        jdbc.execute("ALTER TABLE usuario ADD COLUMN IF NOT EXISTS papel_id BIGINT REFERENCES papeis(id)");
    }
}
