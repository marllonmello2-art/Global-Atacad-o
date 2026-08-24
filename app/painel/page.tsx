"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, PageHeader, money } from "../../components/ui";

type Report = {
  last30Days: { orderCount: number; revenue: number; estimatedProfit: number };
  stock: { totalValue: number; productCount: number; lowStockCount: number };
  finance: { pendingReceivable: number; pendingPayable: number };
};

export default function PainelHomePage() {
  const [report, setReport] = useState<Report | null>(null);

  useEffect(() => {
    fetch("/api/reports", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setReport(data as Report));
  }, []);

  return (
    <div>
      <PageHeader title="Visão geral" description="Resumo rápido do seu negócio." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <span className="text-xs font-semibold uppercase text-slate-400">Faturamento (30 dias)</span>
          <div className="mt-1 text-2xl font-bold text-emerald-700">{report ? money(report.last30Days.revenue) : "—"}</div>
        </Card>
        <Card className="p-5">
          <span className="text-xs font-semibold uppercase text-slate-400">Pedidos (30 dias)</span>
          <div className="mt-1 text-2xl font-bold text-slate-800">{report ? report.last30Days.orderCount : "—"}</div>
        </Card>
        <Card className="p-5">
          <span className="text-xs font-semibold uppercase text-slate-400">Produtos em estoque baixo</span>
          <div className="mt-1 text-2xl font-bold text-amber-600">{report ? report.stock.lowStockCount : "—"}</div>
        </Card>
        <Card className="p-5">
          <span className="text-xs font-semibold uppercase text-slate-400">A receber pendente</span>
          <div className="mt-1 text-2xl font-bold text-slate-800">{report ? money(report.finance.pendingReceivable) : "—"}</div>
        </Card>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { href: "/painel/produtos", title: "Cadastrar produto", copy: "Adicione produtos, variações e preços por quantidade." },
          { href: "/painel/pedidos", title: "Registrar pedido", copy: "Lance uma venda e envie o resumo pelo WhatsApp." },
          { href: "/painel/configuracoes", title: "Compartilhar catálogo", copy: "Pegue o link do catálogo digital da sua loja." },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full p-5 transition hover:border-teal-300 hover:shadow-md">
              <strong className="text-slate-800">{item.title}</strong>
              <p className="mt-1 text-sm text-slate-500">{item.copy}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
