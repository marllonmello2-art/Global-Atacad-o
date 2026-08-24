"use client";

import { useEffect, useState } from "react";
import { Card, PageHeader, money } from "../../../components/ui";

type Report = {
  last30Days: { orderCount: number; revenue: number; estimatedProfit: number };
  stock: { totalValue: number; productCount: number; lowStockCount: number };
  finance: { pendingReceivable: number; pendingPayable: number };
  topProducts: { name: string; quantity: number; revenue: number }[];
};

export default function RelatoriosPage() {
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    fetch("/api/reports", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setReport(data as Report));
  }, []);

  return (
    <div>
      <PageHeader title="Relatórios" description="Vendas, estoque e lucro dos últimos 30 dias." />

      {!report ? (
        <p className="text-sm text-slate-400">Carregando relatórios...</p>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <span className="text-xs font-semibold uppercase text-slate-400">Pedidos (30 dias)</span>
              <div className="mt-1 text-2xl font-bold text-slate-800">{report.last30Days.orderCount}</div>
            </Card>
            <Card className="p-5">
              <span className="text-xs font-semibold uppercase text-slate-400">Faturamento (30 dias)</span>
              <div className="mt-1 text-2xl font-bold text-emerald-700">{money(report.last30Days.revenue)}</div>
            </Card>
            <Card className="p-5">
              <span className="text-xs font-semibold uppercase text-slate-400">Lucro estimado (30 dias)</span>
              <div className="mt-1 text-2xl font-bold text-slate-800">{money(report.last30Days.estimatedProfit)}</div>
              <p className="mt-1 text-xs text-slate-400">Faturamento menos o custo dos produtos vendidos.</p>
            </Card>
          </div>

          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Card className="p-5">
              <span className="text-xs font-semibold uppercase text-slate-400">Valor em estoque (custo)</span>
              <div className="mt-1 text-xl font-bold text-slate-800">{money(report.stock.totalValue)}</div>
              <p className="mt-1 text-xs text-slate-400">{report.stock.productCount} produtos cadastrados</p>
            </Card>
            <Card className="p-5">
              <span className="text-xs font-semibold uppercase text-slate-400">Produtos em estoque baixo</span>
              <div className="mt-1 text-xl font-bold text-amber-600">{report.stock.lowStockCount}</div>
            </Card>
            <Card className="p-5">
              <span className="text-xs font-semibold uppercase text-slate-400">A receber x a pagar</span>
              <div className="mt-1 text-xl font-bold text-slate-800">
                {money(report.finance.pendingReceivable)} <span className="text-slate-300">/</span> {money(report.finance.pendingPayable)}
              </div>
            </Card>
          </div>

          <Card className="overflow-x-auto">
            <div className="border-b border-slate-100 px-4 py-3">
              <strong className="text-sm text-slate-700">Produtos mais vendidos</strong>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Quantidade vendida</th>
                  <th className="px-4 py-3">Receita</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.topProducts.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                      Ainda não há vendas suficientes para gerar o ranking.
                    </td>
                  </tr>
                )}
                {report.topProducts.map((product) => (
                  <tr key={product.name}>
                    <td className="px-4 py-3 font-medium text-slate-800">{product.name}</td>
                    <td className="px-4 py-3 text-slate-600">{product.quantity}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{money(product.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
