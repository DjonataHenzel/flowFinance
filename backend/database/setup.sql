-- Execute este arquivo com: psql -U postgres -f database/setup.sql
CREATE DATABASE "sistemaFinanceiro";

-- Comando do cliente psql para acessar o banco recém-criado.
\connect "sistemaFinanceiro"

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS usuario (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario VARCHAR(100) NOT NULL UNIQUE,
    senha VARCHAR(100) NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Senha BCrypt; pode ser reexecutado sem duplicar o usuário.
INSERT INTO usuario (usuario, senha)
VALUES ('admin', crypt('admin', gen_salt('bf', 12)))
ON CONFLICT (usuario) DO UPDATE SET senha = EXCLUDED.senha, ativo = TRUE;

CREATE TABLE IF NOT EXISTS contas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    descricao VARCHAR(255) NOT NULL,
    valor_total NUMERIC(15, 2) NOT NULL CHECK (valor_total > 0),
    qtd_parcelas INTEGER NOT NULL DEFAULT 1 CHECK (qtd_parcelas > 0),
    usuario_cadastro BIGINT REFERENCES usuario(id),
    tipo VARCHAR(7) NOT NULL CHECK (tipo IN ('RECEBER', 'PAGAR')),
    situacao VARCHAR(9) NOT NULL DEFAULT 'ABERTA' CHECK (situacao IN ('ABERTA', 'PAGA', 'RECEBIDA', 'PARCELADA')),
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    baixada_em TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS parcelas_contas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conta_id BIGINT NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
    numero INTEGER NOT NULL CHECK (numero > 0),
    valor NUMERIC(15, 2) NOT NULL CHECK (valor > 0),
    data_vencimento DATE NOT NULL,
    situacao VARCHAR(9) NOT NULL DEFAULT 'PENDENTE' CHECK (situacao IN ('PENDENTE', 'PAGA', 'RECEBIDA')),
    baixada_em TIMESTAMP WITH TIME ZONE,
    observacao_baixa VARCHAR(1000),
    UNIQUE (conta_id, numero)
);

CREATE TABLE IF NOT EXISTS anexos_contas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conta_id BIGINT NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
    nome_arquivo VARCHAR(255) NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    tipo_arquivo VARCHAR(150),
    tamanho BIGINT NOT NULL,
    conteudo BYTEA NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS papeis (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    descricao VARCHAR(255),
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS papel_funcionalidades (
    papel_id BIGINT NOT NULL REFERENCES papeis(id) ON DELETE CASCADE,
    funcionalidade VARCHAR(60) NOT NULL,
    PRIMARY KEY (papel_id, funcionalidade)
);
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS papel_id BIGINT REFERENCES papeis(id);

-- Migração para instalações existentes.
ALTER TABLE contas ADD COLUMN IF NOT EXISTS situacao VARCHAR(9) NOT NULL DEFAULT 'ABERTA';
ALTER TABLE contas ADD COLUMN IF NOT EXISTS qtd_parcelas INTEGER NOT NULL DEFAULT 1;
ALTER TABLE contas ADD COLUMN IF NOT EXISTS usuario_cadastro BIGINT REFERENCES usuario(id);
ALTER TABLE contas ADD COLUMN IF NOT EXISTS baixada_em TIMESTAMP WITH TIME ZONE;
ALTER TABLE parcelas_contas ADD COLUMN IF NOT EXISTS baixada_em TIMESTAMP WITH TIME ZONE;
ALTER TABLE parcelas_contas ADD COLUMN IF NOT EXISTS observacao_baixa VARCHAR(1000);
ALTER TABLE parcelas_contas ADD COLUMN IF NOT EXISTS situacao VARCHAR(9) NOT NULL DEFAULT 'PENDENTE';
ALTER TABLE anexos_contas ADD COLUMN IF NOT EXISTS descricao VARCHAR(255) NOT NULL DEFAULT 'Anexo';
