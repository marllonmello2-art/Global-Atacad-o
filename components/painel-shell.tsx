"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useState } from "react";

type NavItem = { href: string; label: string; icon: string };

const navItems: NavItem[] = [
  { href: "/painel", label: "Visão geral", icon: "◧" },
  { href: "/painel/produtos", label: "Produtos", icon: "▤" },
  { href: "/painel/estoque", label: "Estoque", icon: "▣" },
  { href: "/painel/clientes", label: "Clientes", icon: "◎" },
  { href: "/painel/pedidos", label: "Pedidos", icon: "✎" },
  { href: "/painel/financeiro", label: "Financeiro", icon: "$" },
  { href: "/painel/relatorios", label: "Relatórios", icon: "↗" },
  { href: "/painel/configuracoes", label: "Catálogo e loja", icon: "⚙" },
];

export function PainelShell({ user, children }: { user: { name: string; email: string }; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-60 flex-col border-r border-slate-200 bg-white px-3 py-6 md:flex">
        <div className="mb-8 px-3 text-lg font-extrabold text-teal-800">
          Global <span className="text-teal-600">Atacado</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => {
            const active = item.href === "/painel" ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold ${
                  active ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span className="w-4 text-center text-slate-400">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-slate-100 pt-4">
          <div className="px-3 text-xs">
            <strong className="block text-slate-700">{user.name}</strong>
            <span className="text-slate-400">{user.email}</span>
          </div>
          <button
            onClick={signOut}
            disabled={signingOut}
            className="mt-3 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
          >
            {signingOut ? "Saindo..." : "Sair da conta"}
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <div className="text-base font-extrabold text-teal-800">Global Atacado</div>
          <button onClick={signOut} className="text-sm font-semibold text-red-600">
            Sair
          </button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden">
          {navItems.map((item) => {
            const active = item.href === "/painel" ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
                  active ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
