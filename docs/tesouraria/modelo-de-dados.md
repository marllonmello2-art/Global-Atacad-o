# Sistema de Tesouraria da Igreja — Modelo de dados

DDL completa em [`schema.sql`](./schema.sql); dados iniciais em
[`seed.sql`](./seed.sql). Este documento explica **por que** cada tabela é
assim e quais regras o banco garante sozinho.

## Convenções

| Assunto | Regra |
| --- | --- |
| Dinheiro | `INTEGER` em centavos, sempre. Nunca `REAL` — 0,1 + 0,2 em ponto flutuante não fecha caixa. |
| Datas | `TEXT` `'YYYY-MM-DD'`. Ordena e compara como string, e é o que o SQLite indexa bem. |
| Meses | `TEXT` `'YYYY-MM'` (competência, fatura, resumo). |
| Ids | `TEXT` (ulid/uuid gerado na aplicação), exceto tabelas de domínio fixo (unidades, categorias), que usam slug legível. |
| Exclusão | Lógica (`deleted_at`). Tesouraria não apaga histórico. |
| Enums | `CHECK` no banco, não só no TypeScript. É o que impede o dado sujo voltar por importação. |

## Tabelas

### Acesso — `users`, `sessions`, `user_units`, `agent_tokens`
Papel no usuário (`ADMINISTRADOR`, `TESOUREIRO`, `LEITOR`) e vínculo N:N com
unidades. O agente usa `agent_tokens` (hash do token), nunca uma sessão de
navegador — assim dá para revogar o acesso do agente sem mexer em ninguém.

### `units` e `accounts`
Conta com `unit_id NULL` é conta **Geral** (Santander Mulheres, Santander
Família). Um `CHECK` garante que `CAIXA` não tem instituição e `BANCO` tem.
`opening_balance_cents` é o saldo inicial; `current_balance_cents` é o saldo
apurado, mantido incrementalmente na escrita.

### `categories` e `category_aliases` — o fim da duplicidade
`categories` é **lista fixa** (21 itens), com slug estável como id: renomear o
rótulo não quebra os lançamentos já gravados. A interface não oferece "criar
categoria".

Toda categoria que chega de fora (planilha, agente, texto) passa por
`normalizeCategory(texto)`: minúsculas, sem acento, espaços colapsados, busca em
`category_aliases`. "AÇÃO SOCIAL", "Ação social" e "acao social" caem todas em
`acao_social`. O que não casa com nenhum alias entra como
`pendente_classificacao` e aparece numa fila para revisão — nunca cria categoria
nova nem é descartado em silêncio.

### `transactions` — o razão
Uma linha por lançamento, **inclusive a transferência** (`account_id` = origem,
`counter_account_id` = destino). Guardar transferência como dois lançamentos
espelhados dobra a base e, na hora que alguém edita um dos lados, o par
desalinha sem ninguém perceber.

`amount_cents` é sempre positivo; o sinal vem do `type`. A view
`account_entries` expande cada lançamento em movimentos com sinal por conta e é
a fonte da verdade dos saldos.

Invariantes garantidas pelo próprio banco:

- `amount_cents > 0`;
- `TRANSFERENCIA` exige destino, e destino ≠ origem;
- `ENTRADA`/`SAIDA` **não** têm destino;
- `ENTRADA`/`SAIDA` exigem categoria;
- lançamento de campanha exige `campaign_id`; de unidade, exige `unit_id`;
- `status = 'CONCILIADO'` exige `reconciled_at`;
- `import_hash` único (índice parcial) → reimportar a mesma planilha não duplica nada.

`source` (`planilha` | `web` | `agente`) preserva a rastreabilidade que já
existia. `receipt_key` aponta o comprovante no R2.

### `monthly_summary`
Pré-agregado `(mês, conta, ledger, categoria) → entradas, saídas`, atualizado no
mesmo `batch` da escrita. É o que faz o consolidado e os gráficos do painel
responderem sem varrer o razão. Como é derivado, existe um job de reconciliação
(`lib/balances.ts`) que recalcula tudo a partir de `account_entries` e acusa
divergência — se um dia der diferença, a verdade é o razão.

### `bills` — contas a pagar/receber
Cobre recorrência (`recurrence` + `recurrence_parent_id`), parcelamento
(`installment_number`/`installment_total`), fornecedor, chave Pix e vínculo com
evento de calendário. A baixa **não** duplica dinheiro: gera um lançamento em
`transactions` e guarda o `transaction_id`. Um `CHECK` impede marcar como `PAGO`
sem data, valor pago e conta.

### `cards` e `card_installments`
`cards` cadastra o cartão (unidade, conta que paga a fatura, dia de fechamento e
vencimento). Cada parcela é uma linha com `purchase_month` e `invoice_month`, o
que permite a pergunta que a planilha respondia mal: "quanto já está comprometido
na fatura de março?" — `SUM(installment_cents) WHERE invoice_month = '2026-03'`.

### `campaigns`
Campanha tem orçamento, período e status. Os lançamentos dela ficam **na mesma
tabela** `transactions`, com `ledger = 'CAMPANHA'` — fora do fluxo de caixa das
unidades por padrão, mas usando o mesmo código de escrita, validação, conciliação
e relatório. Uma tabela `campaignTransactions` separada, como no sistema
anterior, obriga a manter duas vezes cada regra e cada consulta.

### `ministry_refunds`
Registro simples do valor a reembolsar; quando pago, aponta para o lançamento
que efetivou o pagamento.

### `category_rules` e `entry_drafts` — a ponte para o agente
`category_rules` são regras determinísticas (`padrão → categoria/conta/unidade`,
com prioridade) editáveis na tela de configurações. `entry_drafts` guarda o texto
cru, a proposta em JSON e a confiança; só depois de confirmado por uma pessoa
vira lançamento. Confirmar um rascunho pode criar uma regra nova — o sistema
acerta mais a cada uso, sem depender de o modelo "lembrar".

### `import_batches` e `audit_log`
Importação registra lote, linhas lidas/importadas/ignoradas e fica `EM_ANALISE`
até a confirmação (a tela mostra o que vai entrar antes de gravar). `audit_log`
grava quem, o quê, quando e o antes/depois em JSON, inclusive para o agente
(`actor_kind = 'AGENTE'`).

## Consultas de referência

```sql
-- Saldo apurado de todas as contas de uma unidade (fonte da verdade)
SELECT a.id, a.name,
       a.opening_balance_cents + COALESCE(SUM(e.signed_cents), 0) AS saldo_cents
  FROM accounts a
  LEFT JOIN account_entries e ON e.account_id = a.id AND e.ledger = 'UNIDADE'
 WHERE a.unit_id = ?1
 GROUP BY a.id;

-- Entradas e saídas por categoria, por período, numa unidade
SELECT c.name, t.type, SUM(t.amount_cents) AS total_cents, COUNT(*) AS qtd
  FROM transactions t
  JOIN categories c ON c.id = t.category_id
 WHERE t.deleted_at IS NULL AND t.ledger = 'UNIDADE'
   AND t.unit_id = ?1 AND t.date BETWEEN ?2 AND ?3
   AND t.type IN ('ENTRADA','SAIDA')
 GROUP BY c.name, t.type
 ORDER BY total_cents DESC;

-- Consolidado geral mês a mês (lê o pré-agregado, não o razão)
SELECT month,
       SUM(in_cents)  AS entradas_cents,
       SUM(out_cents) AS saidas_cents,
       SUM(in_cents) - SUM(out_cents) AS resultado_cents
  FROM monthly_summary
 WHERE ledger = 'UNIDADE' AND month BETWEEN ?1 AND ?2
 GROUP BY month
 ORDER BY month;

-- Fila de conciliação de uma conta
SELECT id, date, description, amount_cents, type
  FROM transactions
 WHERE status = 'PENDENTE' AND account_id = ?1 AND deleted_at IS NULL
 ORDER BY date;

-- Contas a pagar dos próximos 30 dias
SELECT b.due_date, u.name AS unidade, b.description, b.supplier, b.expected_cents
  FROM bills b LEFT JOIN units u ON u.id = b.unit_id
 WHERE b.status = 'PENDENTE' AND b.deleted_at IS NULL
   AND b.due_date BETWEEN date('now') AND date('now', '+30 day')
 ORDER BY b.due_date;

-- Campanha: quanto já foi arrecadado e gasto contra o orçamento
SELECT c.name, c.budget_cents,
       SUM(CASE WHEN t.type = 'ENTRADA' THEN t.amount_cents ELSE 0 END) AS arrecadado_cents,
       SUM(CASE WHEN t.type = 'SAIDA'   THEN t.amount_cents ELSE 0 END) AS gasto_cents
  FROM campaigns c
  LEFT JOIN transactions t ON t.campaign_id = c.id AND t.deleted_at IS NULL
 GROUP BY c.id;
```

## Migração da planilha antiga

1. **Cadastro primeiro.** Unidades, contas (com saldo inicial real) e categorias
   pelo `seed.sql`.
2. **Mapear as grafias.** Rodar um levantamento de `SELECT DISTINCT categoria` na
   planilha e completar `category_aliases` com o que aparecer. Só depois importar.
3. **Importar em lotes**, com `import_hash` = hash de
   `(data, conta, valor, descrição normalizada, referência)`. Reimportar é
   seguro: linha repetida é ignorada pelo índice único.
4. **Transferências.** Onde a planilha tem dois lançamentos espelhados
   ("Entre Contas" saindo de A e entrando em B, mesma data e valor), casar o par
   e gravar **uma** transferência. O que não casar entra como
   ENTRADA/SAIDA com `pendente_classificacao` para revisão manual.
5. **Conferir.** Para cada conta, comparar
   `opening_balance_cents + SUM(account_entries)` com o saldo apurado da
   planilha. Divergência é erro de importação, não de sistema — corrigir antes
   de liberar o uso.
6. **Marcar tudo como `CONCILIADO`** no que já estava conferido, e recalcular
   `monthly_summary` uma vez no fim da carga.
