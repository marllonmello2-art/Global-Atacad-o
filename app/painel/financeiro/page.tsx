"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, money } from "../../../components/ui";

type Entry = {
  id: string;
  type: "receber" | "pagar";
  orderId: string | null;
  description: string;
  category: string | null;
  amount: number;
  dueDate: string;
  paidAt: string | null;
  status: "pendente" | "pago" | "atrasado" | "cancelado";
};

const statusTones: Record<string, "green" | "amber" | "red" | "slate"> = { pago: "green", pendente: "slate", atrasado: "red", cancelado: "slate" };

export default function FinanceiroPage() {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState<"receber" | "pagar">("receber");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"todos" | "receber" | "pagar">("todos");

  async function loadEntries() {
    const response = await fetch("/api/finance", { cache: "no-store" });
    const payload = (await response.json()) as { entries?: Entry[] };
    setEntries(payload.entries ?? []);
  }

  useEffect(() => {
    void loadEntries();
  }, []);

  const totals = useMemo(() => {
    const list = entries ?? [];
    const pendingReceivable = list.filter((e) => e.type === "receber" && (e.status === "pendente" || e.status === "atrasado")).reduce((sum, e) => sum + e.amount, 0);
    const pendingPayable = list.filter((e) => e.type === "pagar" && (e.status === "pendente" || e.status === "atrasado")).reduce((sum, e) => sum + e.amount, 0);
    const overdue = list.filter((e) => e.status === "atrasado").length;
    return { pendingReceivable, pendingPayable, overdue, balance: pendingReceivable - pendingPayable };
  }, [entries]);

  async function submit() {
    if (!description.trim() || !amount || !dueDate) {
      setNotice("Preencha descrição, valor e vencimento.");
      return;
    }
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/finance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, description, category: category || undefined, amount: Number(amount), dueDate }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setNotice(payload.error ?? "Não foi possível salvar o lançamento.");
        return;
      }
      setDescription("");
      setCategory("");
      setAmount("");
      setDueDate("");
      setShowForm(false);
      await loadEntries();
    } finally {
      setSaving(false);
    }
  }

  async function markStatus(id: string, status: "pago" | "cancelado" | "pendente") {
    await fetch(`/api/finance/${id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    await loadEntries();
  }

  const filtered = (entries ?? []).filter((entry) => filter === "todos" || entry.type === filter);

  return (
    <div>
      <PageHeader title="Financeiro" description="Contas a receber e a pagar, fluxo de caixa e vendas fiado." action={<Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Fechar" : "+ Novo lançamento"}</Button>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Card className="p-4">
          <span className="text-xs font-semibold uppercase text-slate-400">A receber</span>
          <div className="mt-1 text-xl font-bold text-emerald-700">{money(totals.pendingReceivable)}</div>
        </Card>
        <Card className="p-4">
          <span className="text-xs font-semibold uppercase text-slate-400">A pagar</span>
          <div className="mt-1 text-xl font-bold text-red-600">{money(totals.pendingPayable)}</div>
        </Card>
        <Card className="p-4">
          <span className="text-xs font-semibold uppercase text-slate-400">Saldo projetado</span>
          <div className={`mt-1 text-xl font-bold ${totals.balance >= 0 ? "text-slate-800" : "text-red-600"}`}>{money(totals.balance)}</div>
        </Card>
        <Card className="p-4">
          <span className="text-xs font-semibold uppercase text-slate-400">Em atraso</span>
          <div className="mt-1 text-xl font-bold text-amber-600">{totals.overdue}</div>
        </Card>
      </div>

      {showForm && (
        <Card className="mb-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo">
              <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                <option value="receber">A receber</option>
                <option value="pagar">A pagar</option>
              </Select>
            </Field>
            <Field label="Categoria (opcional)">
              <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex.: fornecedor, aluguel..." />
            </Field>
            <Field label="Descrição">
              <Input value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <Field label="Valor (R$)">
              <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Vencimento">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </div>
          {notice && <p className="mt-3 text-sm text-red-600">{notice}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Salvando..." : "Salvar lançamento"}
            </Button>
          </div>
        </Card>
      )}

      <div className="mb-4 flex gap-2">
        {(["todos", "receber", "pagar"] as const).map((option) => (
          <button
            key={option}
            onClick={() => setFilter(option)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === option ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {option === "todos" ? "Todos" : option === "receber" ? "A receber" : "A pagar"}
          </button>
        ))}
      </div>

      {entries === null ? (
        <p className="text-sm text-slate-400">Carregando financeiro...</p>
      ) : filtered.length === 0 ? (
        <EmptyState title="Nenhum lançamento por aqui" description="Lançamentos de vendas fiado aparecem aqui automaticamente. Você também pode adicionar contas manualmente." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3">
                    <strong className="block text-slate-800">{entry.description}</strong>
                    {entry.category && <span className="text-xs text-slate-400">{entry.category}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={entry.type === "receber" ? "green" : "red"}>{entry.type === "receber" ? "Receber" : "Pagar"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{new Date(entry.dueDate).toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{money(entry.amount)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTones[entry.status]}>{entry.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {entry.status !== "pago" && entry.status !== "cancelado" && (
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => markStatus(entry.id, "pago")}>
                          Marcar pago
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
