# Tesouraria da Igreja — desenho do sistema

Desenho de banco de dados e arquitetura para o sistema de tesouraria da igreja
(unidades Jardim Primavera, Campos Eliseos, Saracuruna e Jardim Anhanga).

| Arquivo | Conteúdo |
| --- | --- |
| [`arquitetura.md`](./arquitetura.md) | Stack, causas da lentidão anterior e como são resolvidas, módulos, ingestão por texto/agente, relatórios, segurança e ordem de implementação. |
| [`modelo-de-dados.md`](./modelo-de-dados.md) | Explicação de cada tabela, invariantes, consultas de referência e plano de migração da planilha. |
| [`schema.sql`](./schema.sql) | DDL completa para Cloudflare D1 (SQLite). |
| [`seed.sql`](./seed.sql) | Unidades, categorias padronizadas, aliases das grafias antigas e contas iniciais. |

> Este repositório é o **Global Atacado**. A tesouraria é um produto separado —
> a recomendação (ver fim de `arquitetura.md`) é criar repositório e Worker
> próprios e levar estes documentos junto.
