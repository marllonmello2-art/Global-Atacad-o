"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, PageHeader, Select, Textarea, money } from "../../../components/ui";

type Variant = { id?: string; name: string; sku: string; priceOverride: string; stock: string };
type Tier = { id?: string; minQuantity: string; price: string; label: string };
type Product = {
  id: string;
  sku: string | null;
  ean: string | null;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  unit: string;
  costPrice: number;
  retailPrice: number;
  minStock: number;
  currentStock: number;
  imageUrl: string | null;
  active: boolean;
  visibleInCatalog: boolean;
  variants: { id: string; name: string; sku: string | null; priceOverride: number | null; stock: number }[];
  priceTiers: { id: string; minQuantity: number; price: number; label: string | null }[];
};

const emptyForm = {
  name: "",
  sku: "",
  ean: "",
  description: "",
  category: "",
  brand: "",
  unit: "un",
  costPrice: "",
  retailPrice: "",
  minStock: "",
  currentStock: "",
  active: true,
  visibleInCatalog: true,
};

export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [pendingImageFor, setPendingImageFor] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [notice, setNotice] = useState("");

  async function loadProducts() {
    try {
      const response = await fetch("/api/products", { cache: "no-store" });
      const payload = (await response.json()) as { products?: Product[]; error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Não foi possível carregar os produtos.");
        return;
      }
      setProducts(payload.products ?? []);
    } catch {
      setError("Não foi possível conectar ao servidor.");
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  function openCreateForm() {
    setEditingId(null);
    setForm(emptyForm);
    setVariants([]);
    setTiers([]);
    setShowForm(true);
  }

  function openEditForm(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      sku: product.sku ?? "",
      ean: product.ean ?? "",
      description: product.description ?? "",
      category: product.category ?? "",
      brand: product.brand ?? "",
      unit: product.unit,
      costPrice: String(product.costPrice),
      retailPrice: String(product.retailPrice),
      minStock: String(product.minStock),
      currentStock: String(product.currentStock),
      active: product.active,
      visibleInCatalog: product.visibleInCatalog,
    });
    setVariants(product.variants.map((v) => ({ id: v.id, name: v.name, sku: v.sku ?? "", priceOverride: v.priceOverride != null ? String(v.priceOverride) : "", stock: String(v.stock) })));
    setTiers(product.priceTiers.map((t) => ({ id: t.id, minQuantity: String(t.minQuantity), price: String(t.price), label: t.label ?? "" })));
    setShowForm(true);
  }

  async function suggestCopy() {
    if (!form.name.trim()) {
      setNotice("Informe o nome do produto antes de gerar a sugestão.");
      return;
    }
    setSuggesting(true);
    try {
      const response = await fetch("/api/products/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.name, category: form.category, brand: form.brand, unit: form.unit }),
      });
      const payload = (await response.json()) as { title?: string; description?: string; error?: string };
      if (response.ok && payload.description) {
        setForm((prev) => ({ ...prev, name: payload.title ?? prev.name, description: payload.description ?? prev.description }));
      }
    } finally {
      setSuggesting(false);
    }
  }

  async function submitForm() {
    if (!form.name.trim()) {
      setNotice("Informe o nome do produto.");
      return;
    }
    setSaving(true);
    setNotice("");
    const payload = {
      name: form.name,
      sku: form.sku || undefined,
      ean: form.ean || undefined,
      description: form.description || undefined,
      category: form.category || undefined,
      brand: form.brand || undefined,
      unit: form.unit,
      costPrice: Number(form.costPrice) || 0,
      retailPrice: Number(form.retailPrice) || 0,
      minStock: Number(form.minStock) || 0,
      currentStock: Number(form.currentStock) || 0,
      active: form.active,
      visibleInCatalog: form.visibleInCatalog,
      variants: variants
        .filter((v) => v.name.trim())
        .map((v) => ({ id: v.id, name: v.name, sku: v.sku || undefined, priceOverride: v.priceOverride ? Number(v.priceOverride) : null, stock: Number(v.stock) || 0 })),
      priceTiers: tiers
        .filter((t) => Number(t.minQuantity) > 0)
        .map((t) => ({ id: t.id, minQuantity: Number(t.minQuantity), price: Number(t.price) || 0, label: t.label || undefined })),
    };

    try {
      const response = await fetch(editingId ? `/api/products/${editingId}` : "/api/products", {
        method: editingId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string; id?: string };
      if (!response.ok) {
        setNotice(result.error ?? "Não foi possível salvar o produto.");
        return;
      }
      setShowForm(false);
      await loadProducts();
    } catch {
      setNotice("Não foi possível conectar ao servidor.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(id: string) {
    if (!window.confirm("Excluir este produto? Essa ação não pode ser desfeita.")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    await loadProducts();
  }

  function askImage(productId: string) {
    setPendingImageFor(productId);
    fileInputRef.current?.click();
  }

  async function onImageSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !pendingImageFor) return;
    const body = new FormData();
    body.append("image", file);
    await fetch(`/api/products/${pendingImageFor}/image`, { method: "POST", body });
    setPendingImageFor(null);
    await loadProducts();
  }

  function exportCsv() {
    window.open("/api/products/csv", "_blank");
  }

  async function importCsv(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const text = await file.text();
    const response = await fetch("/api/products/csv", { method: "POST", body: text });
    const payload = (await response.json()) as { imported?: number; error?: string };
    setNotice(response.ok ? `${payload.imported} produtos importados com sucesso.` : payload.error ?? "Não foi possível importar.");
    if (response.ok) await loadProducts();
  }

  return (
    <div>
      <PageHeader
        title="Produtos"
        description="Cadastre produtos, variações e tabela de preço por quantidade para o atacado."
        action={
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer">
              <Button variant="secondary" onClick={() => document.getElementById("csv-import-input")?.click()}>
                Importar CSV
              </Button>
              <input id="csv-import-input" type="file" accept=".csv,text/csv" className="hidden" onChange={importCsv} />
            </label>
            <Button variant="secondary" onClick={exportCsv}>
              Exportar CSV
            </Button>
            <Button onClick={openCreateForm}>+ Novo produto</Button>
          </div>
        }
      />

      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onImageSelected} />

      {notice && <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-sm text-teal-800">{notice}</div>}
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      {showForm && (
        <Card className="mb-6 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-800">{editingId ? "Editar produto" : "Novo produto"}</h2>
            <button onClick={() => setShowForm(false)} className="text-sm text-slate-400 hover:text-slate-600">
              Fechar
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome do produto">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Camiseta básica algodão" />
            </Field>
            <Field label="Categoria">
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex.: Vestuário" />
            </Field>
            <Field label="Marca">
              <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </Field>
            <Field label="SKU">
              <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            </Field>
            <Field label="Código de barras (EAN)">
              <Input value={form.ean} onChange={(e) => setForm({ ...form, ean: e.target.value })} />
            </Field>
            <Field label="Unidade de venda">
              <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                <option value="un">Unidade (un)</option>
                <option value="kg">Quilo (kg)</option>
                <option value="cx">Caixa (cx)</option>
                <option value="par">Par</option>
                <option value="m">Metro (m)</option>
              </Select>
            </Field>
            <Field label="Preço de custo">
              <Input type="number" step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} />
            </Field>
            <Field label="Preço de venda (varejo)">
              <Input type="number" step="0.01" value={form.retailPrice} onChange={(e) => setForm({ ...form, retailPrice: e.target.value })} />
            </Field>
            <Field label="Estoque mínimo">
              <Input type="number" step="1" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
            </Field>
            <Field label="Estoque atual">
              <Input type="number" step="1" value={form.currentStock} onChange={(e) => setForm({ ...form, currentStock: e.target.value })} />
            </Field>
          </div>

          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Descrição</span>
              <Button variant="ghost" onClick={suggestCopy} disabled={suggesting}>
                {suggesting ? "Gerando..." : "✦ Sugerir título e descrição"}
              </Button>
            </div>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="mt-6 flex items-center gap-6 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Ativo
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.visibleInCatalog} onChange={(e) => setForm({ ...form, visibleInCatalog: e.target.checked })} /> Visível no catálogo público
            </label>
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <strong className="text-sm text-slate-700">Variações (cor, tamanho, modelo...)</strong>
              <Button variant="ghost" onClick={() => setVariants([...variants, { name: "", sku: "", priceOverride: "", stock: "" }])}>
                + Adicionar variação
              </Button>
            </div>
            {variants.map((variant, index) => (
              <div key={index} className="mb-2 grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2">
                <Input placeholder="Nome (ex.: Azul / M)" value={variant.name} onChange={(e) => setVariants(variants.map((v, i) => (i === index ? { ...v, name: e.target.value } : v)))} />
                <Input placeholder="SKU" value={variant.sku} onChange={(e) => setVariants(variants.map((v, i) => (i === index ? { ...v, sku: e.target.value } : v)))} />
                <Input
                  placeholder="Preço (opcional)"
                  type="number"
                  value={variant.priceOverride}
                  onChange={(e) => setVariants(variants.map((v, i) => (i === index ? { ...v, priceOverride: e.target.value } : v)))}
                />
                <Input placeholder="Estoque" type="number" value={variant.stock} onChange={(e) => setVariants(variants.map((v, i) => (i === index ? { ...v, stock: e.target.value } : v)))} />
                <Button variant="danger" onClick={() => setVariants(variants.filter((_, i) => i !== index))}>
                  ×
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between">
              <strong className="text-sm text-slate-700">Tabela de preço por quantidade (atacado)</strong>
              <Button variant="ghost" onClick={() => setTiers([...tiers, { minQuantity: "", price: "", label: "" }])}>
                + Adicionar faixa
              </Button>
            </div>
            {tiers.map((tier, index) => (
              <div key={index} className="mb-2 grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
                <Input placeholder="A partir de (qtd)" type="number" value={tier.minQuantity} onChange={(e) => setTiers(tiers.map((t, i) => (i === index ? { ...t, minQuantity: e.target.value } : t)))} />
                <Input placeholder="Preço unitário" type="number" step="0.01" value={tier.price} onChange={(e) => setTiers(tiers.map((t, i) => (i === index ? { ...t, price: e.target.value } : t)))} />
                <Input placeholder="Rótulo (ex.: Atacado)" value={tier.label} onChange={(e) => setTiers(tiers.map((t, i) => (i === index ? { ...t, label: e.target.value } : t)))} />
                <Button variant="danger" onClick={() => setTiers(tiers.filter((_, i) => i !== index))}>
                  ×
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>
              Cancelar
            </Button>
            <Button onClick={submitForm} disabled={saving}>
              {saving ? "Salvando..." : "Salvar produto"}
            </Button>
          </div>
        </Card>
      )}

      {products === null ? (
        <p className="text-sm text-slate-400">Carregando produtos...</p>
      ) : products.length === 0 ? (
        <EmptyState title="Nenhum produto cadastrado ainda" description="Cadastre seu primeiro produto para começar a montar o catálogo e controlar o estoque." action={<Button onClick={openCreateForm}>+ Novo produto</Button>} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Produto</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Estoque</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-lg bg-slate-100">
                        {product.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div>
                        <strong className="block text-slate-800">{product.name}</strong>
                        <span className="text-xs text-slate-400">{product.sku || product.category || "—"}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{money(product.retailPrice)}</td>
                  <td className="px-4 py-3">
                    <span className={product.currentStock <= product.minStock ? "font-semibold text-red-600" : "text-slate-700"}>
                      {product.currentStock} {product.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={product.active ? "green" : "slate"}>{product.active ? "Ativo" : "Inativo"}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => askImage(product.id)}>
                        Foto
                      </Button>
                      <Button variant="ghost" onClick={() => openEditForm(product)}>
                        Editar
                      </Button>
                      <Button variant="danger" onClick={() => deleteProduct(product.id)}>
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
