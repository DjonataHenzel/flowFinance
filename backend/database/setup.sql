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
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notificar_conta_vencendo_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
    notificar_conta_vencendo_ntfy BOOLEAN NOT NULL DEFAULT FALSE,
    topico_ntfy VARCHAR(80),
    hora_notificacao TIME NOT NULL DEFAULT '08:00',
    dias_antecedencia INTEGER NOT NULL DEFAULT 0 CHECK (dias_antecedencia BETWEEN 0 AND 30),
    visualizar_cadastros_todos_usuarios BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS contatos_whatsapp_usuario (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    numero VARCHAR(16) NOT NULL,
    UNIQUE (usuario_id, numero)
);

CREATE TABLE IF NOT EXISTS pessoas (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    cpf VARCHAR(11),
    cep VARCHAR(8),
    logradouro VARCHAR(200),
    numero VARCHAR(20),
    complemento VARCHAR(100),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    uf CHAR(2),
    canal_preferencial VARCHAR(10) NOT NULL DEFAULT 'WHATSAPP' CHECK (canal_preferencial IN ('WHATSAPP', 'NTFY')),
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (cpf)
);

CREATE TABLE IF NOT EXISTS pessoas_whatsapp (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pessoa_id BIGINT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
    numero VARCHAR(16) NOT NULL,
    UNIQUE (pessoa_id, numero)
);

CREATE TABLE IF NOT EXISTS pessoas_ntfy (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pessoa_id BIGINT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
    topico VARCHAR(80) NOT NULL,
    UNIQUE (pessoa_id, topico)
);

CREATE TABLE IF NOT EXISTS compromissos (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pessoa_id BIGINT NOT NULL REFERENCES pessoas(id),
    data_hora TIMESTAMP WITH TIME ZONE NOT NULL,
    descricao VARCHAR(1000) NOT NULL,
    hora_notificacao TIME NOT NULL,
    situacao VARCHAR(12) NOT NULL DEFAULT 'PENDENTE' CHECK (situacao IN ('PENDENTE', 'RESOLVIDO', 'REAGENDADO')),
    ultima_notificacao TIMESTAMP WITH TIME ZONE,
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
    pessoa_id BIGINT REFERENCES pessoas(id),
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
CREATE TABLE IF NOT EXISTS historico_notificacoes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    usuario_id BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    data_referencia DATE NOT NULL,
    canal VARCHAR(20) NOT NULL,
    quantidade INTEGER NOT NULL,
    mensagem TEXT NOT NULL,
    enviado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (usuario_id, data_referencia, canal)
);
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS papel_id BIGINT REFERENCES papeis(id);
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS visualizar_cadastros_todos_usuarios BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS contas_pessoas_notificacao (
    conta_id BIGINT NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
    pessoa_id BIGINT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
    PRIMARY KEY (conta_id, pessoa_id)
);
INSERT INTO contas_pessoas_notificacao(conta_id,pessoa_id)
SELECT id,pessoa_id FROM contas WHERE pessoa_id IS NOT NULL ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS compromissos_pessoas_notificacao (
    compromisso_id BIGINT NOT NULL REFERENCES compromissos(id) ON DELETE CASCADE,
    pessoa_id BIGINT NOT NULL REFERENCES pessoas(id) ON DELETE CASCADE,
    PRIMARY KEY (compromisso_id, pessoa_id)
);
INSERT INTO compromissos_pessoas_notificacao(compromisso_id,pessoa_id)
SELECT id,pessoa_id FROM compromissos WHERE pessoa_id IS NOT NULL ON CONFLICT DO NOTHING;

-- Migração para instalações existentes.
ALTER TABLE contas ADD COLUMN IF NOT EXISTS situacao VARCHAR(9) NOT NULL DEFAULT 'ABERTA';
ALTER TABLE contas ADD COLUMN IF NOT EXISTS qtd_parcelas INTEGER NOT NULL DEFAULT 1;
ALTER TABLE contas ADD COLUMN IF NOT EXISTS usuario_cadastro BIGINT REFERENCES usuario(id);
ALTER TABLE contas ADD COLUMN IF NOT EXISTS baixada_em TIMESTAMP WITH TIME ZONE;
ALTER TABLE contas ADD COLUMN IF NOT EXISTS pessoa_id BIGINT REFERENCES pessoas(id);
ALTER TABLE compromissos ADD COLUMN IF NOT EXISTS ultima_notificacao TIMESTAMP WITH TIME ZONE;
ALTER TABLE compromissos DROP CONSTRAINT IF EXISTS compromissos_situacao_check;
ALTER TABLE compromissos ADD CONSTRAINT compromissos_situacao_check CHECK (situacao IN ('PENDENTE','RESOLVIDO','REAGENDADO','CONCLUIDO','NOTIFICADO'));
ALTER TABLE parcelas_contas ADD COLUMN IF NOT EXISTS baixada_em TIMESTAMP WITH TIME ZONE;
ALTER TABLE parcelas_contas ADD COLUMN IF NOT EXISTS observacao_baixa VARCHAR(1000);
ALTER TABLE parcelas_contas ADD COLUMN IF NOT EXISTS situacao VARCHAR(9) NOT NULL DEFAULT 'PENDENTE';
ALTER TABLE anexos_contas ADD COLUMN IF NOT EXISTS descricao VARCHAR(255) NOT NULL DEFAULT 'Anexo';
