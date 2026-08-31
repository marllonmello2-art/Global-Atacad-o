# Sistema de Tesouraria da Igreja — Arquitetura

Documento de desenho. Nada aqui depende do sistema Global Atacado: a stack é a
mesma (já validada neste repositório), mas o produto é separado — ver
"Onde este projeto deve morar" no final.

## 1. Decisões de stack

| Camada | Escolha | Por quê |
| --- | --- | --- |
| App + API | Next.js (App Router) | Páginas e rotas de API no mesmo deploy; Server Components fazem a leitura direto no banco, sem round-trip de API. |
| Hospedagem | Cloudflare Workers via `@opennextjs/cloudflare` | Sem servidor para manter; cold start irrelevante; custo baixo para o volume de uma igreja. |
| Banco | Cloudflare D1 (SQLite) | Relacional com índices e agregação em SQL — a origem real do ganho de performance sobre planilha. |
| Acesso a dados | SQL direto (`db.prepare`), sem ORM em runtime | Menos código no caminho quente e controle total do plano de consulta. Drizzle Kit só gera migrations a partir do schema. |
| Arquivos | Cloudflare R2 | Comprovantes/recibos anexados a lançamentos e contas a pagar. |
| Auth | Sessão própria (PBKDF2 + cookie httpOnly) | Sem dependência externa; poucos usuários, todos conhecidos. |
| UI | Tailwind CSS v4 | Consistente com o que já é usado. |

## 2. Por que o sistema anterior era lento (e o que muda)

O sistema anterior era orientado a planilha. Os quatro gargalos típicos e a
resposta de cada um:

1. **Ler a aba inteira para responder qualquer pergunta.** Saldo de uma conta
   exigia varrer todos os lançamentos. → Agora: índice por conta+data e
   `SUM()` no banco; nunca se carrega a base inteira para a memória.
2. **Recalcular saldos a cada tela.** → Agora: saldo apurado é mantido de forma
   incremental em `accounts.current_balance_cents`, atualizado na mesma
   transação que grava o lançamento, e reconferível contra a view
   `account_entries` (fonte da verdade).
3. **Uma chamada por linha ao gravar/importar.** → Agora: `db.batch([...])`
   grava lote inteiro em uma ida ao banco; importação de planilha é idempotente
   por hash.
4. **Relatório montado no cliente.** → Agora: agregação em SQL (`GROUP BY`) e,
   para o consolidado, uma tabela de resumo mensal (`monthly_summary`)
   atualizada na escrita. A tela lê linhas já somadas.

Regra de ouro do projeto: **nenhuma tela pode carregar a tabela de lançamentos
inteira.** Toda listagem é paginada (`LIMIT`/`OFFSET` com filtro de período
obrigatório) e todo número agregado vem de `SUM`/`GROUP BY` ou de
`monthly_summary`.

## 3. Modelo de escrita (a parte que define a consistência)

Todo lançamento é **uma linha** em `transactions`, mesmo a transferência. A
transferência não vira dois lançamentos espelhados (isso dobra a base e
desalinha quando um dos lados é editado): ela guarda `account_id` (origem) e
`counter_account_id` (destino).

A expansão em movimentos com sinal fica na view `account_entries`:

- `ENTRADA` → `+valor` em `account_id`
- `SAIDA` → `-valor` em `account_id`
- `TRANSFERENCIA` → `-valor` em `account_id` **e** `+valor` em `counter_account_id`

Consequência: `valor` é sempre positivo (`amount_cents > 0`), o sinal é derivado
do tipo. Isso elimina a classe de bug "saída gravada com valor positivo".

Toda escrita passa por um único caminho (`lib/ledger.ts`) que, em um `batch`:

1. valida (ver invariantes em `modelo-de-dados.md`);
2. insere/atualiza `transactions`;
3. aplica o delta em `accounts.current_balance_cents` (nos dois lados, se for transferência);
4. aplica o delta em `monthly_summary`;
5. grava `audit_log`.

Nada escreve em `transactions` fora desse caminho — nem a importação, nem o agente.

## 4. Módulos da aplicação

```
app/
  entrar/                      login
  painel/
    page.tsx                   visão geral: saldo por conta, pendências, mês corrente
    lancamentos/               listagem filtrada + criação/edição
    conciliacao/               fila de PENDENTE → CONCILIADO (ação em lote)
    contas/                    contas por unidade + saldos
    contas-a-pagar/            bills: vencimentos, recorrência, parcelas
    cartoes/                   parcelamentos por fatura
    campanhas/                 campanhas e seus lançamentos
    reembolsos/                reembolsos de ministério
    relatorios/                por unidade, categoria, período e consolidado
    importar/                  importação de planilha (migração + extrato)
    caixa-de-entrada/          rascunhos vindos de texto/agente, para confirmar
    configuracoes/             usuários, unidades, contas, regras de classificação
  api/
    transactions/              CRUD + listagem paginada
    transactions/bulk/         conciliação e criação em lote
    accounts/  bills/  cards/  campaigns/  refunds/
    reports/                   endpoints de agregação
    import/                    upload + preview + confirmação
    agent/entries/             ingestão por texto (ver §5)
lib/
  ledger.ts                    único caminho de escrita no razão
  balances.ts                  saldos e recomputação/auditoria de saldo
  categories.ts                lista fixa + normalização por alias
  classify.ts                  regras determinísticas texto → categoria/conta/unidade
  reports.ts                   consultas de relatório
  auth.ts / session.ts         autenticação e sessão
  audit.ts                     log de alterações
db/
  schema.ts                    schema Drizzle (fonte das migrations)
  runtime.ts                   bindings D1/R2
  seed.ts                      unidades, contas, categorias e aliases
```

## 5. Lançamento por texto (o agente)

O requisito 3 do prompt — registrar por texto e o sistema classificar — é
atendido por um funil de três estágios, e **o agente nunca escreve direto no
razão**:

```
texto livre  →  parse  →  entry_drafts (rascunho)  →  confirmação  →  transactions
```

- **`POST /api/agent/entries`** recebe `{ text, source }` e autentica por token
  de serviço (`agent_tokens`), não por sessão de navegador.
- **Parse determinístico primeiro** (`lib/classify.ts`): extrai valor, data,
  forma de pagamento e busca `category_rules` por padrão de texto
  (ex.: `%enel%` → Energia, conta Itaú da unidade X). Cada regra tem
  prioridade e é editável na tela de configurações.
- **O que a regra não resolve** vira rascunho com
  `category_id = 'pendente_classificacao'` e `confidence` baixo. Quem confirma é
  uma pessoa, na Caixa de entrada — e a confirmação pode **virar uma nova regra**
  com um clique, de modo que o sistema fica mais preciso com o uso.
- `source` do lançamento resultante fica `agente`, preservando a rastreabilidade
  que já existia (`planilha`, `web`, `agente`).

Assim, um LLM classificando errado nunca corrompe o saldo: o pior caso é um
rascunho descartado.

## 6. Relatórios

Todos derivam de `account_entries` + `transactions`, com período obrigatório:

| Relatório | Consulta |
| --- | --- |
| Por unidade | `GROUP BY unit_id, type` no período |
| Por categoria | `GROUP BY category_id, type` (entradas e saídas separadas) |
| Por período | série mensal a partir de `monthly_summary` |
| Consolidado geral | soma das unidades + contas Gerais, campanhas destacadas à parte |
| Fluxo por conta | `account_entries` filtrado por conta, com saldo acumulado |
| Conciliação | `WHERE status = 'PENDENTE'` por conta e período |
| Contas a pagar | `bills` por vencimento, com projeção das recorrentes |

Campanhas ficam **fora** do fluxo de caixa das unidades por padrão (`ledger =
'CAMPANHA'`), mas usam as mesmas tabelas e o mesmo código — sem duplicar
relatório, como acontecia com `campaignTransactions` separado.

## 7. Segurança e auditoria

- Papéis: `ADMINISTRADOR` (tudo), `TESOUREIRO` (lança e concilia nas suas
  unidades), `LEITOR` (só relatórios). Vínculo em `user_units`.
- Todo acesso a lançamento filtra por unidade permitida ao usuário — inclusive
  nos relatórios.
- `audit_log` grava quem, o quê, quando e o estado antes/depois em JSON.
  Lançamento conciliado não é editado silenciosamente: a edição exige
  desconciliar, e isso fica no log.
- Exclusão é lógica (`deleted_at`), para o histórico nunca perder um valor.

## 8. Ordem de implementação sugerida

1. Migrations + seed (unidades, contas, categorias, aliases) e auth.
2. `lib/ledger.ts` + CRUD de lançamentos + saldos.
3. Importação da planilha antiga com normalização de categorias (é o que valida
   o modelo contra os dados reais).
4. Conciliação e contas a pagar.
5. Relatórios e consolidado.
6. Cartões, campanhas, reembolsos.
7. Ingestão por texto/agente e regras de classificação.

## 9. Onde este projeto deve morar

Este repositório é o **Global Atacado** (gestão para lojistas). Tesouraria é
outro domínio, outro público e outro ciclo de deploy — misturar os dois obriga a
versionar e publicar juntos coisas sem relação. Recomendação: **repositório e
Worker próprios** (`tesouraria-igreja`), copiando desta base o que já está
resolvido — `db/runtime.ts`, `lib/auth.ts`, `lib/session.ts`, `middleware.ts`,
`components/ui.tsx` e a configuração do OpenNext/Wrangler.

Estes documentos ficam aqui como o desenho aprovado; ao criar o repositório
novo, eles vão junto.
