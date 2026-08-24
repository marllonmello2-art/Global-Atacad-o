import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "../lib/session";
import { Button } from "../components/ui";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/painel");

  return (
    <main className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="text-lg font-extrabold text-teal-800">
          Global <span className="text-teal-600">Atacado</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link href="/entrar" className="text-sm font-semibold text-slate-600 hover:text-teal-700">
            Entrar
          </Link>
          <Link href="/registrar">
            <Button>Criar conta grátis</Button>
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-2 md:items-center">
        <div>
          <span className="inline-block rounded-full bg-teal-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-teal-700">
            Para lojistas e atacadistas
          </span>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight text-slate-900">
            Controle produtos, estoque, pedidos e financeiro em um só sistema.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Cadastre produtos com preço de varejo e tabelas por quantidade para o atacado, acompanhe o estoque em
            tempo real, registre pedidos com fiado, Pix, cartão ou boleto, e compartilhe um catálogo digital pelo
            WhatsApp com seus clientes revendedores.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/registrar">
              <Button className="px-6 py-3 text-base">Começar agora</Button>
            </Link>
            <Link href="/entrar">
              <Button variant="secondary" className="px-6 py-3 text-base">
                Já tenho conta
              </Button>
            </Link>
          </div>
        </div>
        <div className="grid gap-4">
          {[
            { title: "Catálogo com variações", copy: "Cor, tamanho, SKU, EAN, custo e margem em cada produto." },
            { title: "Preço varejo x atacado", copy: "Tabela de preço por quantidade mínima para revendedores." },
            { title: "Estoque sob controle", copy: "Entradas, saídas e aviso de estoque mínimo automático." },
            { title: "Catálogo compartilhável", copy: "Link público para o cliente pedir direto pelo WhatsApp." },
          ].map((item) => (
            <div key={item.title} className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
              <strong className="text-slate-800">{item.title}</strong>
              <p className="mt-1 text-sm text-slate-500">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
