# Arquitetura do Wagering Processor

Este documento detalha as decisões arquiteturais, padrões de design, trade-offs e garantias de consistência adotadas no desenvolvimento do **Wagering Processor**.

---

## 1. Visão Geral e Estilo Arquitetural

O sistema adota os princípios de **Domain-Driven Design (DDD)** e **Clean Architecture**, dividindo claramente as responsabilidades em quatro camadas isoladas:

- **Domain (`src/domain`)**: Contém as regras de negócio puras, agregados (`Wallet`, `WagerTransaction`), value objects imutáveis (`Money`) e invariantes globais. Sem dependências externas de ORM ou framework.
- **Application (`src/application`)**: Casos de uso e serviços de aplicação (`FinanceService`) que orquestram transações, transições de domínio e persistência.
- **Infrastructure (`src/infrastructure`)**: Camada de persistência (`MikroORM`, entidades do banco, migrations), mensageria e adaptadores externos.
- **Presentation (`src/presentation`)**: Controladores HTTP (`NestJS`), validações de DTOs e tratamentos de exceção de borda.

---

## 2. Decisões de Concorrência e Consistência (ACID)

Para evitar _lost updates_ e garantir que múltiplas instâncias da aplicação operem com segurança sob alta concorrência em _hot wallets_, a estratégia escolhida combina:

1. **Bloqueio Pessimista (`SELECT ... FOR UPDATE` / `lockMode: 4`)**: Ao processar débitos ou créditos, a carteira é bloqueada explicitamente no banco de dados dentro do escopo transacional.
2. **Atualizações Atômicas (`nativeUpdate`)**: Modificações de saldo e versão evitam conflitos do Unit of Work do ORM, garantindo que o SQL atinja diretamente a linha correta de forma atômica.
3. **Restrições de Banco (Constraints)**: O schema do PostgreSQL possui restrições explícitas (`CHECK (balance >= 0)`) impedindo qualquer possibilidade de saldo negativo a nível de banco de dados, independentemente de falhas lógicas na aplicação.

---

## 3. Idempotência Persistente

A idempotência não utiliza cache em memória. Ela é garantida por:

- **Chave de Idempotência e Transações Únicas**: Cada requisição de aposta é validada contra a tabela `TransactionEntity` filtrando por `(providerId, externalTransactionId)`.
- Caso a transação já tenha sido processada, o sistema retorna imediatamente o resultado original sem duplicar efeitos financeiros (`idempotentReplay: true`).

---

## 4. Ledger Imutável e Auditoria

- Toda alteração de saldo gera obrigatoriamente um registro correspondente na tabela de `ledger`.
- O Ledger é estruturado de forma estritamente **imutável** (sem campos mutáveis ou rotinas de update/delete), permitindo auditoria financeira completa e reconciliação determinística entre o saldo materializado na carteira e a soma dos lançamentos.

---

## 5. Padrão Outbox

- Mensagens de integração (`OutboxMessageEntity`) e eventos de alteração de estado são persistidos na **mesma transação SQL** da operação financeira. Isso garante que nenhum evento seja perdido em caso de falha de infraestrutura antes da publicação na mensageria.
