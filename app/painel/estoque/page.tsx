"use client";

import { useEffect, useState } from "react";
import { Badge, Button, Card, Field, Input, PageHeader, Select } from "../../../components/ui";

type Product = { id: string; name: string; unit: string; currentStock: number; minStock: number };
type Movement = { id: string; productId: string; productName: string; type: string; quantity: number; reason: string | null; createdAt: string };

const typeLabels: Record<string, string> = { entrada: "Entrada", saida: "Saída", ajuste: "Ajuste", devolucao: "Devolução" };
const typeTones: Record<string, "green" | "red" | "amber" | "blue"> = { entrada: "green", saida: "red", ajuste: "amber", devolucao: "blue" };

export default function EstoquePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[] | null>(null);
  const [productId, setProductId] = useState("");
  const [type, setType] = useState<"entrada" | "saida" | "ajuste">("entrada");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function loadAll() {
    const [productsRes, movementsRes] = await Promise.all([fetch("/api/products", { cache: "no-store" }), fetch("/api/stock", { cache: "no-store" })]);
    const productsPayload = (await productsRes.json()) as { products?: Product[] };
    const movementsPayload = (await movementsRes.json()) as { movements?: Movement[] };
    setProducts(productsPayload.products ?? []);
    setMovements(movementsPayload.movements ?? []);
    if (!productId && productsPayload.products?.[0]) setProductId(productsPayload.products[0].id);
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function registerMovement() {
    if (!productId || !quantity) {
      setNotice("Selecione o produto e informe a quantidade.");
      return;
    }
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/stock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, type, quantity: Number(quantity), reason: reason || undefined }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setNotice(payload.error ?? "Não foi possível registrar a movimentação.");
        return;
      }
      setQuantity("");
      setReason("");
      await loadAll();
    } finally {
      setSaving(false);
    }
  }

  const lowStock = products.filter((p) => p.currentStock <= p.minStock);

  return (
    <div>
      <PageHeader title="Estoque" description="Registre entradas, saídas e ajustes, e acompanhe produtos com estoque baixo." />

      {lowStock.length > 0 && (
        <Card className="mb-6 border-amber-200 bg-amber-50 p-4">
          <strong className="text-sm text-amber-800">Atenção: {lowStock.length} produto(s) no estoque mínimo ou abaixo</strong>
          <ul className="mt-2 flex flex-wrap gap-2">
            {lowStock.map((p) => (
              <li key={p.id} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-700 shadow-sm">
                {p.name} · {p.currentStock} {p.unit}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="mb-6 p-6">
        <h2 className="mb-4 text-lg font-bold text-slate-800">Nova movimentação</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Produto">
            <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tipo">
            <Select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
              <option value="ajuste">Ajuste (+/-)</option>
            </Select>
          </Field>
          <Field label="Quantidade">
            <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
          <Field label="Motivo (opcional)">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: Compra de fornecedor" />
          </Field>
        </div>
        {notice && <p className="mt-3 text-sm text-red-600">{notice}</p>}
        <div className="mt-4 flex justify-end">
          <Button onClick={registerMovement} disabled={saving || products.length === 0}>
            {saving ? "Registrando..." : "Registrar movimentação"}
          </Button>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Quantidade</th>
              <th className="px-4 py-3">Motivo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {movements?.map((movement) => (
              <tr key={movement.id}>
                <td className="px-4 py-3 text-slate-500">{new Date(movement.createdAt).toLocaleString("pt-BR")}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{movement.productName}</td>
                <td className="px-4 py-3">
                  <Badge tone={typeTones[movement.type] ?? "slate"}>{typeLabels[movement.type] ?? movement.type}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-700">{movement.quantity}</td>
                <td className="px-4 py-3 text-slate-500">{movement.reason ?? "—"}</td>
              </tr>
            ))}
            {movements?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Nenhuma movimentação registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
