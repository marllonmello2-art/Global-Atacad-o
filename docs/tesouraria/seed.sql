-- Dados iniciais: unidades, categorias padronizadas e aliases das grafias antigas.
-- Idempotente: pode rodar de novo sem duplicar.

-- ------------------------------------------------------------- unidades -----
INSERT OR IGNORE INTO units (id, name, sort_order) VALUES
  ('jardim_primavera', 'Jardim Primavera', 1),
  ('campos_eliseos',   'Campos Eliseos',   2),
  ('saracuruna',       'Saracuruna',       3),
  ('jardim_anhanga',   'Jardim Anhanga',   4);

-- ------------------------------------------------------------ categorias ----
-- Lista fixa. 'nature' orienta a interface (o que aparece em ENTRADA/SAÍDA) e a
-- validação; não impede um estorno legítimo em sentido contrário quando
-- nature = 'AMBAS'.
INSERT OR IGNORE INTO categories (id, name, nature, sort_order) VALUES
  ('dizimo',                 'Dízimo',                    'ENTRADA',        1),
  ('oferta',                 'Oferta',                    'ENTRADA',        2),
  ('arrecadacao_igreja',     'Arrecadação da igreja',     'ENTRADA',        3),
  ('vendas',                 'Vendas',                    'ENTRADA',        4),
  ('rendimento',             'Rendimento',                'ENTRADA',        5),
  ('reembolso',              'Reembolso',                 'AMBAS',          6),
  ('eventos_participacoes',  'Eventos e Participações',   'AMBAS',          7),
  ('acao_social',            'Ação social',               'SAIDA',          8),
  ('alimentacao',            'Alimentação',               'SAIDA',          9),
  ('limpeza',                'Limpeza',                   'SAIDA',         10),
  ('energia',                'Energia',                   'SAIDA',         11),
  ('internet_tecnologia',    'Internet/Tecnologia',       'SAIDA',         12),
  ('aluguel',                'Aluguel',                   'SAIDA',         13),
  ('manutencao',             'Manutenção',                'SAIDA',         14),
  ('colaboradores',          'Colaboradores',             'SAIDA',         15),
  ('impostos_taxas',         'Impostos e taxas',          'SAIDA',         16),
  ('taxas_tarifas',          'Taxas e Tarifas',           'SAIDA',         17),
  ('encargos_financeiros',   'Encargos financeiros',      'SAIDA',         18),
  ('entre_contas',           'Entre Contas',              'TRANSFERENCIA', 19),
  ('pendente_classificacao', 'Pendente de classificação', 'AMBAS',         20),
  ('outros',                 'Outros',                    'AMBAS',         21);

-- --------------------------------------------------------------- aliases ----
-- Chave sempre normalizada: minúsculas, sem acento, espaços colapsados.
-- É por aqui que as grafias duplicadas da planilha antiga entram sem recriar
-- categoria nova.
INSERT OR IGNORE INTO category_aliases (alias, category_id) VALUES
  ('dizimo',                    'dizimo'),
  ('dizimos',                   'dizimo'),
  ('oferta',                    'oferta'),
  ('ofertas',                   'oferta'),
  ('arrecadacao da igreja',     'arrecadacao_igreja'),
  ('arrecadacao igreja',        'arrecadacao_igreja'),
  ('reembolso',                 'reembolso'),
  ('reembolsos',                'reembolso'),
  ('acao social',               'acao_social'),
  ('eventos e participacoes',   'eventos_participacoes'),
  ('eventos e participacao',    'eventos_participacoes'),
  ('eventos',                   'eventos_participacoes'),
  ('alimentacao',               'alimentacao'),
  ('limpeza',                   'limpeza'),
  ('energia',                   'energia'),
  ('luz',                       'energia'),
  ('internet/tecnologia',       'internet_tecnologia'),
  ('internet e tecnologia',     'internet_tecnologia'),
  ('internet',                  'internet_tecnologia'),
  ('tecnologia',                'internet_tecnologia'),
  ('aluguel',                   'aluguel'),
  ('manutencao',                'manutencao'),
  ('colaboradores',             'colaboradores'),
  ('colaborador',               'colaboradores'),
  ('impostos e taxas',          'impostos_taxas'),
  ('impostos',                  'impostos_taxas'),
  ('taxas e tarifas',           'taxas_tarifas'),
  ('tarifas',                   'taxas_tarifas'),
  ('tarifa bancaria',           'taxas_tarifas'),
  ('vendas',                    'vendas'),
  ('venda',                     'vendas'),
  ('rendimento',                'rendimento'),
  ('rendimentos',               'rendimento'),
  ('entre contas',              'entre_contas'),
  ('entre conta',               'entre_contas'),
  ('transferencia entre contas','entre_contas'),
  ('encargos financeiros',      'encargos_financeiros'),
  ('encargo financeiro',        'encargos_financeiros'),
  ('pendente de classificacao', 'pendente_classificacao'),
  ('pendente',                  'pendente_classificacao'),
  ('sem categoria',             'pendente_classificacao'),
  ('outros',                    'outros'),
  ('outro',                     'outros');

-- ----------------------------------------------------------------- contas ---
-- Ajustar nomes e saldos iniciais conforme o cadastro real antes de rodar.
INSERT OR IGNORE INTO accounts (id, unit_id, name, kind, institution, opening_balance_cents, current_balance_cents) VALUES
  ('cx_jardim_primavera', 'jardim_primavera', 'Caixa Jardim Primavera', 'CAIXA', NULL,        0, 0),
  ('cx_campos_eliseos',   'campos_eliseos',   'Caixa Campos Eliseos',   'CAIXA', NULL,        0, 0),
  ('cx_saracuruna',       'saracuruna',       'Caixa Saracuruna',       'CAIXA', NULL,        0, 0),
  ('cx_jardim_anhanga',   'jardim_anhanga',   'Caixa Jardim Anhanga',   'CAIXA', NULL,        0, 0),
  ('bc_santander_mulheres', NULL, 'Santander Mulheres', 'BANCO', 'Santander', 0, 0),
  ('bc_santander_familia',  NULL, 'Santander Família',  'BANCO', 'Santander', 0, 0);
