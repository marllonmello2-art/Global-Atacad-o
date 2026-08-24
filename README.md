# Global Atacado

Sistema de gestão para lojistas e atacadistas: catálogo de produtos com
variações, estoque, clientes (varejo e atacado), pedidos com fluxo de status
e pagamento (incluindo fiado), financeiro básico (contas a receber/pagar),
catálogo digital compartilhável com pedido direto pelo WhatsApp, importação e
exportação de produtos por CSV, e relatórios de vendas, estoque e lucro.

## Stack

- **Next.js** (App Router) para as páginas e a API.
- **Cloudflare Workers** via [`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare) para hospedagem.
- **Cloudflare D1** (SQLite) para o banco de dados, acessado com SQL direto (sem camada de ORM em runtime).
- **Cloudflare R2** para armazenar as fotos dos produtos.
- **Drizzle Kit** apenas para gerar as migrations a partir de `db/schema.ts` (documentação do esquema).
- Autenticação própria por e-mail/senha (PBKDF2 + sessão em cookie), sem depender de serviço externo.
- Tailwind CSS v4 para a interface.

## Configuração local

```bash
npm install
cp .dev.vars.example .dev.vars   # se for testar bindings localmente com wrangler
npm run dev
```

O ambiente de desenvolvimento local (`next dev`) roda sem os bindings do
Cloudflare. Para testar com D1/R2 reais, use o fluxo do Wrangler:

```bash
npx wrangler d1 create global-atacado-db
# copie o database_id retornado para wrangler.jsonc
npx wrangler r2 bucket create global-atacado-arquivos
npm run cf:build
npm run cf:preview
```

## Deploy

```bash
npm run cf:deploy
```

Isso executa `opennextjs-cloudflare build` seguido de `opennextjs-cloudflare deploy`,
publicando o Worker com os bindings declarados em `wrangler.jsonc`.

## Estrutura

- `app/` — páginas (App Router) e rotas de API.
- `app/painel/` — área autenticada do lojista (produtos, estoque, clientes, pedidos, financeiro, relatórios, configurações).
- `app/c/[slug]/` — catálogo digital público, sem necessidade de login.
- `db/schema.ts` — esquema Drizzle (referência/migrations).
- `db/runtime.ts` — acesso ao binding D1/R2 em runtime e criação idempotente das tabelas.
- `lib/` — autenticação, sessão, regras de produtos/pedidos e utilitário de CSV.

## Primeiro acesso

1. Crie sua conta em `/registrar`.
2. Cadastre produtos em **Produtos**, com preço de varejo e, se quiser, uma
   tabela de preço por quantidade para o atacado.
3. Configure o nome da loja e o link do catálogo em **Catálogo e loja**.
4. Compartilhe o link `/c/seu-identificador` com seus clientes revendedores.

## Roteiro (próximas fases)

- Integração com marketplaces (Shopee, Mercado Livre, SHEIN, TikTok Shop).
- Emissão fiscal (NF-e/NFC-e).
- Sugestão de título/descrição por IA generativa real (hoje o gerador é baseado em regras, sem depender de chave de API).
- Aprovação de cadastro de revendedores diretamente pelo catálogo público.
- Controle de lotes e validade para quem vende perecíveis.
