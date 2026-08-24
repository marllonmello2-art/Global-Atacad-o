"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, money } from "../../../components/ui";

type Product = {
  id: string;
  name: string;
  unit: string;
  retailPrice: number;
  currentStock: number;
  priceTiers: { minQuantity: number; price: number }[];
};
type Customer = { id: string; name: string; phone: string | null; type: "varejo" | "atacado" };
type OrderRow = {
  id: string;
  customerName: string | null;
  customerPhone: string | null;
  status: string;
  paymentMethod: string;
  total: number;
  itemCount: number;
  createdAt: string;
};
type OrderItem = { description: string; quantity: number; unitPrice: number; total: number };

type DraftItem = { productId: string; description: string; quantity: number; unitPrice: number };

const statusLabels: Record<string, string> = {
  orcamento: "Orçamento",
  aberto: "Aberto",
  pago: "Pago",
  separado: "Separado",
  enviado: "Enviado",
  concluido: "Concluído",
  cancelado: "Cancelado",
};
const statusTones: Record<string, "slate" | "green" | "amber" | "red" | "blue"> = {
  orcamento: "slate",
  aberto: "blue",
  pago: "green",
  separado: "amber",
  enviado: "amber",
  concluido: "green",
  cancelado: "red",
};
const paymentLabels: Record<string, string> = { pix: "Pix", cartao: "Cartão", boleto: "Boleto", dinheiro: "Dinheiro", fiado: "Fiado" };

function priceForQuantity(product: Product, quantity: number) {
  const applicable = product.priceTiers.filter((t) => quantity >= t.minQuantity).sort((a, b) => b.minQuantity - a.minQuantity)[0];
  return applicable ? applicable.price : product.retailPrice;
}

export default function PedidosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "cartao" | "boleto" | "dinheiro" | "fiado">("pix");
  const [status, setStatus] = useState<"orcamento" | "aberto" | "pago">("aberto");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function loadAll() {
    const [productsRes, customersRes, ordersRes] = await Promise.all([
      fetch("/api/products", { cache: "no-store" }),
      fetch("/api/customers", { cache: "no-store" }),
      fetch("/api/orders", { cache: "no-store" }),
    ]);
    const productsPayload = (await productsRes.json()) as { products?: Product[] };
    const customersPayload = (await customersRes.json()) as { customers?: Customer[] };
    const ordersPayload = (await ordersRes.json()) as { orders?: OrderRow[] };
    setProducts(productsPayload.products ?? []);
    setCustomers(customersPayload.customers ?? []);
    setOrders(ordersPayload.orders ?? []);
    if (!selectedProduct && productsPayload.products?.[0]) setSelectedProduct(productsPayload.products[0].id);
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addItem() {
    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;
    const unitPrice = priceForQuantity(product, 1);
    setItems([...items, { productId: product.id, description: product.name, quantity: 1, unitPrice }]);
  }

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setItems(
      items.map((item, i) => {
        if (i !== index) return item;
        const next = { ...item, ...patch };
        if (patch.quantity !== undefined) {
          const product = products.find((p) => p.id === next.productId);
          if (product) next.unitPrice = priceForQuantity(product, next.quantity);
        }
        return next;
      })
    );
  }

  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0), [items]);
  const total = Math.max(0, subtotal - (Number(discount) || 0));

  function resetForm() {
    setCustomerId("");
    setManualName("");
    setManualPhone("");
    setPaymentMethod("pix");
    setStatus("aberto");
    setDiscount("0");
    setNotes("");
    setItems([]);
  }

  async function submitOrder() {
    if (items.length === 0) {
      setNotice("Adicione ao menos um item ao pedido.");
      return;
    }
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || undefined,
          customerName: customerId ? undefined : manualName || undefined,
          customerPhone: customerId ? undefined : manualPhone || undefined,
          paymentMethod,
          status,
          discount: Number(discount) || 0,
          notes: notes || undefined,
          items: items.map((item) => ({ productId: item.productId, description: item.description, quantity: item.quantity, unitPrice: item.unitPrice })),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setNotice(payload.error ?? "Não foi possível registrar o pedido.");
        return;
      }
      resetForm();
      setShowForm(false);
      await loadAll();
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(orderId: string, nextStatus: string) {
    await fetch(`/api/orders/${orderId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
    await loadAll();
  }

  async function sendWhatsApp(order: OrderRow) {
    const detailResponse = await fetch(`/api/orders/${order.id}`, { cache: "no-store" });
    const payload = (await detailResponse.json()) as { order?: { items: OrderItem[]; total: number; customerName: string | null } };
    const orderItems = payload.order?.items ?? [];
    const lines = [`Pedido ${order.id.slice(0, 8).toUpperCase()} — ${order.customerName ?? "Cliente"}`, ""];
    for (const item of orderItems) lines.push(`• ${item.quantity}x ${item.description} — ${money(item.unitPrice)} (${money(item.total)})`);
    lines.push("", `Total: ${money(order.total)}`, `Pagamento: ${paymentLabels[order.paymentMethod] ?? order.paymentMethod}`);
    const digits = (order.customerPhone ?? "").replace(/\D/g, "");
    window.open(`https://wa.me/${digits}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <PageHeader title="Pedidos" description="Registre vendas, acompanhe o status e envie o pedido pelo WhatsApp." action={<Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Fechar" : "+ Novo pedido"}</Button>} />

      {showForm && (
        <Card className="mb-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente cadastrado (opcional)">
              <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Cliente avulso</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.type === "atacado" ? "· Atacado" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            {!customerId && (
              <>
                <Field label="Nome do cliente">
                  <Input value={manualName} onChange={(e) => setManualName(e.target.value)} />
                </Field>
                <Field label="WhatsApp do cliente">
                  <Input value={manualPhone} onChange={(e) => setManualPhone(e.target.value)} placeholder="(11) 99999-9999" />
                </Field>
              </>
            )}
            <Field label="Forma de pagamento">
              <Select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}>
                <option value="pix">Pix</option>
                <option value="cartao">Cartão</option>
                <option value="boleto">Boleto</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="fiado">Fiado</option>
              </Select>
            </Field>
            <Field label="Situação do pedido">
              <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                <option value="orcamento">Orçamento (não afeta estoque)</option>
                <option value="aberto">Pedido confirmado</option>
                <option value="pago">Já pago</option>
              </Select>
            </Field>
            <Field label="Desconto (R$)">
              <Input type="number" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </Field>
          </div>

          <div className="mt-6">
            <strong className="text-sm text-slate-700">Itens do pedido</strong>
            <div className="mt-2 flex gap-2">
              <Select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="flex-1">
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · estoque {p.currentStock} {p.unit}
                  </option>
                ))}
              </Select>
              <Button variant="secondary" onClick={addItem} disabled={products.length === 0}>
                Adicionar item
              </Button>
            </div>

            {items.map((item, index) => (
              <div key={index} className="mt-2 grid grid-cols-[1fr_100px_120px_120px_auto] items-center gap-2">
                <span className="text-sm text-slate-700">{item.description}</span>
                <Input type="number" min={1} value={item.quantity} onChange={(e) => updateItem(index, { quantity: Number(e.target.value) || 1 })} />
                <Input type="number" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) || 0 })} />
                <span className="text-sm font-semibold text-slate-700">{money(item.quantity * item.unitPrice)}</span>
                <Button variant="danger" onClick={() => setItems(items.filter((_, i) => i !== index))}>
                  ×
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <Field label="Observações (opcional)">
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
            <div className="text-sm text-slate-500">
              Subtotal {money(subtotal)} · <strong className="text-slate-800">Total {money(total)}</strong>
            </div>
            <div className="flex gap-2">
              {notice && <span className="self-center text-sm text-red-600">{notice}</span>}
              <Button onClick={submitOrder} disabled={saving}>
                {saving ? "Salvando..." : "Registrar pedido"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {orders === null ? (
        <p className="text-sm text-slate-400">Carregando pedidos...</p>
      ) : orders.length === 0 ? (
        <EmptyState title="Nenhum pedido registrado" description="Registre seu primeiro pedido para acompanhar vendas, estoque e financeiro automaticamente." />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Pagamento</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3 text-slate-500">
                    #{order.id.slice(0, 8).toUpperCase()}
                    <div className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleString("pt-BR")}</div>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{order.customerName ?? "Cliente avulso"}</td>
                  <td className="px-4 py-3 text-slate-600">{paymentLabels[order.paymentMethod] ?? order.paymentMethod}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{money(order.total)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge tone={statusTones[order.status] ?? "slate"}>{statusLabels[order.status] ?? order.status}</Badge>
                      <Select className="w-auto text-xs" value={order.status} onChange={(e) => changeStatus(order.id, e.target.value)}>
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" onClick={() => sendWhatsApp(order)}>
                      WhatsApp
                    </Button>
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
