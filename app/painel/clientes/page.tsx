"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select } from "../../../components/ui";

type Customer = {
  id: string;
  name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  type: "varejo" | "atacado";
  creditLimit: number;
  paymentTermDays: number;
  status: "pendente" | "aprovado" | "bloqueado";
  notes: string | null;
};

type CustomerForm = {
  name: string;
  document: string;
  phone: string;
  email: string;
  type: Customer["type"];
  creditLimit: string;
  paymentTermDays: string;
  status: Customer["status"];
  notes: string;
};

const emptyForm: CustomerForm = { name: "", document: "", phone: "", email: "", type: "varejo", creditLimit: "", paymentTermDays: "0", status: "aprovado", notes: "" };

const statusTones: Record<string, "green" | "amber" | "red"> = { aprovado: "green", pendente: "amber", bloqueado: "red" };

export default function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function loadCustomers() {
    const response = await fetch("/api/customers", { cache: "no-store" });
    const payload = (await response.json()) as { customers?: Customer[] };
    setCustomers(payload.customers ?? []);
  }

  useEffect(() => {
    void loadCustomers();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(customer: Customer) {
    setEditingId(customer.id);
    setForm({
      name: customer.name,
      document: customer.document ?? "",
      phone: customer.phone ?? "",
      email: customer.email ?? "",
      type: customer.type,
      creditLimit: String(customer.creditLimit),
      paymentTermDays: String(customer.paymentTermDays),
      status: customer.status,
      notes: customer.notes ?? "",
    });
    setShowForm(true);
  }

  async function submit() {
    if (!form.name.trim()) {
      setNotice("Informe o nome do cliente.");
      return;
    }
    setSaving(true);
    setNotice("");
    const payload = {
      name: form.name,
      document: form.document || undefined,
      phone: form.phone || undefined,
      email: form.email || undefined,
      type: form.type,
      creditLimit: Number(form.creditLimit) || 0,
      paymentTermDays: Number(form.paymentTermDays) || 0,
      status: form.status,
      notes: form.notes || undefined,
    };
    try {
      const response = await fetch(editingId ? `/api/customers/${editingId}` : "/api/customers", {
        method: editingId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setNotice(result.error ?? "Não foi possível salvar o cliente.");
        return;
      }
      setShowForm(false);
      await loadCustomers();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Excluir este cliente?")) return;
    await fetch(`/api/customers/${id}`, { method: "DELETE" });
    await loadCustomers();
  }

  return (
    <div>
      <PageHeader title="Clientes" description="Cadastre clientes de varejo e revendedores atacadistas, com limite de crédito e prazo de pagamento." action={<Button onClick={openCreate}>+ Novo cliente</Button>} />

      {notice && !showForm && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{notice}</div>}

      {showForm && (
        <Card className="mb-6 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">{editingId ? "Editar cliente" : "Novo cliente"}</h2>
            <button onClick={() => setShowForm(false)} className="text-sm text-slate-400 hover:text-slate-600">
              Fechar
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome / Razão social">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="CPF / CNPJ">
              <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
            </Field>
            <Field label="Telefone / WhatsApp">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
            </Field>
            <Field label="E-mail">
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Tipo de cliente">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "varejo" | "atacado" })}>
                <option value="varejo">Varejo</option>
                <option value="atacado">Atacado / Revendedor</option>
              </Select>
            </Field>
            <Field label="Status do cadastro">
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Customer["status"] })}>
                <option value="pendente">Pendente de aprovação</option>
                <option value="aprovado">Aprovado</option>
                <option value="bloqueado">Bloqueado</option>
              </Select>
            </Field>
            <Field label="Limite de crédito (R$)">
              <Input type="number" step="0.01" value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: e.target.value })} />
            </Field>
            <Field label="Prazo de pagamento (dias)">
              <Input type="number" value={form.paymentTermDays} onChange={(e) => setForm({ ...form, paymentTermDays: e.target.value })} />
            </Field>
          </div>
          {notice && <p className="mt-3 text-sm text-red-600">{notice}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? "Salvando..." : "Salvar cliente"}
            </Button>
          </div>
        </Card>
      )}

      {customers === null ? (
        <p className="text-sm text-slate-400">Carregando clientes...</p>
      ) : customers.length === 0 ? (
        <EmptyState title="Nenhum cliente cadastrado" description="Cadastre clientes de varejo ou revendedores atacadistas para agilizar os próximos pedidos." action={<Button onClick={openCreate}>+ Novo cliente</Button>} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Crédito</th>
                <th className="px-4 py-3">Prazo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td className="px-4 py-3">
                    <strong className="block text-slate-800">{customer.name}</strong>
                    <span className="text-xs text-slate-400">{customer.phone ?? customer.email ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={customer.type === "atacado" ? "blue" : "slate"}>{customer.type === "atacado" ? "Atacado" : "Varejo"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-700">R$ {customer.creditLimit.toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3 text-slate-700">{customer.paymentTermDays} dias</td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTones[customer.status]}>{customer.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => openEdit(customer)}>
                        Editar
                      </Button>
                      <Button variant="danger" onClick={() => remove(customer.id)}>
                        Excluir
                      </Button>
                    </div>
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
