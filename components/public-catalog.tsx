"use client";

import { useMemo, useState } from "react";
import { money } from "./ui";

type CatalogProduct = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  unit: string;
  retailPrice: number;
  imageUrl: string | null;
  priceTiers: { minQuantity: number; price: number; label: string | null }[];
};

function priceForQuantity(product: CatalogProduct, quantity: number) {
  const applicable = product.priceTiers.filter((t) => quantity >= t.minQuantity).sort((a, b) => b.minQuantity - a.minQuantity)[0];
  return applicable ? applicable.price : product.retailPrice;
}

export function PublicCatalog({
  store,
  products,
}: {
  store: { storeName: string; whatsappNumber: string | null; description: string | null };
  products: CatalogProduct[];
}) {
  const [cart, setCart] = useState<Record<string, number>>({});

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, qty]) => qty > 0)
        .map(([productId, quantity]) => {
          const product = products.find((p) => p.id === productId);
          if (!product) return null;
          const unitPrice = priceForQuantity(product, quantity);
          return { product, quantity, unitPrice, total: unitPrice * quantity };
        })
        .filter(Boolean) as { product: CatalogProduct; quantity: number; unitPrice: number; total: number }[],
    [cart, products]
  );

  const cartTotal = cartItems.reduce((sum, item) => sum + item.total, 0);
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  function setQuantity(productId: string, quantity: number) {
    setCart((prev) => ({ ...prev, [productId]: Math.max(0, quantity) }));
  }

  function sendToWhatsApp() {
    const lines = [`Olá! Quero fazer um pedido na ${store.storeName}:`, ""];
    for (const item of cartItems) {
      lines.push(`• ${item.quantity}x ${item.product.name} — ${money(item.unitPrice)} (${money(item.total)})`);
    }
    lines.push("", `Total: ${money(cartTotal)}`);
    const digits = (store.whatsappNumber ?? "").replace(/\D/g, "");
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-28">
      <header className="border-b border-slate-200 bg-white px-6 py-8 text-center">
        <h1 className="text-2xl font-extrabold text-slate-900">{store.storeName}</h1>
        {store.description && <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">{store.description}</p>}
      </header>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-8 sm:grid-cols-2 lg:grid-cols-3">
        {products.length === 0 && (
          <p className="col-span-full text-center text-sm text-slate-500">Nenhum produto disponível no catálogo no momento.</p>
        )}
        {products.map((product) => {
          const quantity = cart[product.id] ?? 0;
          const unitPrice = priceForQuantity(product, quantity || 1);
          const bestTier = product.priceTiers.slice().sort((a, b) => b.minQuantity - a.minQuantity)[0];
          return (
            <article key={product.id} className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex h-44 items-center justify-center bg-slate-100">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl text-slate-300">▤</span>
                )}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                {product.category && <span className="text-xs font-bold uppercase tracking-wide text-teal-600">{product.category}</span>}
                <strong className="text-sm text-slate-800">{product.name}</strong>
                {product.description && <p className="line-clamp-2 text-xs text-slate-500">{product.description}</p>}
                <div className="mt-auto flex items-end justify-between pt-2">
                  <div>
                    <div className="text-lg font-bold text-slate-900">{money(unitPrice)}</div>
                    <div className="text-xs text-slate-400">por {product.unit}</div>
                  </div>
                  {bestTier && <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700">Atacado a partir de {bestTier.minQuantity}un</span>}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    className="h-8 w-8 rounded-lg border border-slate-300 text-slate-600"
                    onClick={() => setQuantity(product.id, quantity - 1)}
                  >
                    −
                  </button>
                  <input
                    className="h-8 w-14 rounded-lg border border-slate-300 text-center text-sm"
                    type="number"
                    min={0}
                    value={quantity}
                    onChange={(e) => setQuantity(product.id, Number(e.target.value) || 0)}
                  />
                  <button
                    className="h-8 w-8 rounded-lg border border-slate-300 text-slate-600"
                    onClick={() => setQuantity(product.id, quantity + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {cartCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="text-sm text-slate-600">
              <strong className="text-slate-900">{cartCount}</strong> itens · <strong className="text-slate-900">{money(cartTotal)}</strong>
            </div>
            <button
              onClick={sendToWhatsApp}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700"
            >
              Enviar pedido pelo WhatsApp
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
