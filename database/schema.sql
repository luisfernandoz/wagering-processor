-- Garante a extensões necessárias (ex: UUIDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Wallets (Carteiras)
-- Invariante: Salvo nunca negativo, versão para controle de concorrência e restrição de uma wallet por player + moeda.
CREATE TABLE IF NOT EXISTS wallet_entity (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_wallet_balance_non_negative CHECK (balance >= 0.00),
    CONSTRAINT uk_player_currency UNIQUE (user_id, currency)
);

-- 2. Tabela de Transações (Wager Transactions / Idempotência)
-- Fonte da verdade para a idempotência persistente baseada no provider e external transaction id.
CREATE TABLE IF NOT EXISTS transaction_entity (
    id VARCHAR(36) PRIMARY KEY,
    provider_id VARCHAR(100) NOT NULL,
    external_transaction_id VARCHAR(100) NOT NULL,
    wallet_id VARCHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_transaction_wallet FOREIGN KEY (wallet_id) REFERENCES wallet_entity(id) ON DELETE RESTRICT,
    CONSTRAINT uk_provider_external_tx UNIQUE (provider_id, external_transaction_id)
);

-- 3. Tabela de Ledger (Wallet Ledger Entries - Imutável)
-- Registra cada movimentação financeira auditável de forma estritamente imutável.
CREATE TABLE IF NOT EXISTS ledger_entity (
    id VARCHAR(36) PRIMARY KEY,
    wallet_id VARCHAR(36) NOT NULL,
    transaction_id VARCHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    balance_before NUMERIC(15, 2) NOT NULL,
    balance_after NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_ledger_wallet FOREIGN KEY (wallet_id) REFERENCES wallet_entity(id) ON DELETE RESTRICT,
    CONSTRAINT fk_ledger_transaction FOREIGN KEY (transaction_id) REFERENCES transaction_entity(id) ON DELETE RESTRICT
);

-- 4. Tabela de Outbox (Outbox Pattern)
-- Garante a atomicidade entre a gravação financeira e a publicação de eventos de integração.
CREATE TABLE IF NOT EXISTS outbox_message_entity (
    id VARCHAR(36) PRIMARY KEY,
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id VARCHAR(36) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    published_at TIMESTAMP WITH TIME ZONE NULL
);

-- 5. Tabela de Inbox (Inbox Pattern para SQS)
-- Garante deduplicação persistente no consumo de filas mensageiras.
CREATE TABLE IF NOT EXISTS inbox_message_entity (
    message_id VARCHAR(100) NOT NULL,
    consumer_name VARCHAR(100) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE NULL,
    PRIMARY KEY (message_id, consumer_name)
);

-- Índices adicionais para performance em buscas e concorrência
CREATE INDEX IF NOT EXISTS idx_outbox_status_created ON outbox_message_entity(status, created_at) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_ledger_wallet_created ON ledger_entity(wallet_id, created_at DESC);
