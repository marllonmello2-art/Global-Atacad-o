"use client";

import { useEffect, useState } from "react";
import { Button, Card, Field, Input, PageHeader, Textarea } from "../../../components/ui";

export default function ConfiguracoesPage() {
  const [slug, setSlug] = useState("");
  const [storeName, setStoreName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((raw) => {
        const payload = raw as { settings?: { slug: string; storeName: string; whatsappNumber: string | null; description: string | null } };
        if (!payload.settings) return;
        setSlug(payload.settings.slug);
        setStoreName(payload.settings.storeName);
        setWhatsappNumber(payload.settings.whatsappNumber ?? "");
        setDescription(payload.settings.description ?? "");
      });
  }, []);

  async function save() {
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, storeName, whatsappNumber, description }),
      });
      const payload = (await response.json()) as { slug?: string; error?: string };
      if (!response.ok) {
        setNotice(payload.error ?? "Não foi possível salvar as configurações.");
        return;
      }
      if (payload.slug) setSlug(payload.slug);
      setNotice("Configurações salvas com sucesso.");
    } finally {
      setSaving(false);
    }
  }

  const catalogUrl = origin && slug ? `${origin}/c/${slug}` : "";

  return (
    <div>
      <PageHeader title="Catálogo e loja" description="Configure o nome da loja, WhatsApp e o link público do catálogo digital." />

      <Card className="mb-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome da loja">
            <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          </Field>
          <Field label="Identificador do catálogo (link)" hint="Usado no link público, ex.: /c/sua-loja">
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
          </Field>
          <Field label="WhatsApp para receber pedidos" hint="Com DDI e DDD, ex.: 5511999999999">
            <Input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="5511999999999" />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Descrição da loja (aparece no catálogo)">
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </Field>
        </div>
        {notice && <p className="mt-3 text-sm text-teal-700">{notice}</p>}
        <div className="mt-6 flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar configurações"}
          </Button>
        </div>
      </Card>

      {catalogUrl && (
        <Card className="p-6">
          <strong className="text-sm text-slate-700">Link do seu catálogo digital</strong>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <a href={catalogUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-teal-700">
              {catalogUrl}
            </a>
            <Button variant="secondary" onClick={() => navigator.clipboard.writeText(catalogUrl)}>
              Copiar link
            </Button>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Compartilhe esse link pelo WhatsApp com seus clientes revendedores. Só aparecem produtos marcados como &ldquo;visível no catálogo&rdquo; e ativos.
          </p>
        </Card>
      )}
    </div>
  );
}
