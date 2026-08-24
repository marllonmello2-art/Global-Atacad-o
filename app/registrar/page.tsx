"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button, Card, Field, Input } from "../../components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Não foi possível criar sua conta.");
        return;
      }
      router.push("/painel");
      router.refresh();
    } catch {
      setError("Não foi possível conectar ao servidor agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <div className="text-lg font-extrabold text-teal-800">
            Global <span className="text-teal-600">Atacado</span>
          </div>
          <p className="mt-2 text-sm text-slate-500">Crie sua conta e monte o catálogo da sua loja.</p>
        </div>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field label="Seu nome">
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
          </Field>
          <Field label="E-mail">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@loja.com" />
          </Field>
          <Field label="Senha" hint="Mínimo de 8 caracteres.">
            <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Criando conta..." : "Criar conta"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          Já tem conta?{" "}
          <Link href="/entrar" className="font-semibold text-teal-700">
            Entrar
          </Link>
        </p>
      </Card>
    </main>
  );
}
