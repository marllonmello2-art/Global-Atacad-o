"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { Button, Card, Field, Input } from "../../components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = params.get("return_to") ?? "/painel";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Não foi possível entrar.");
        return;
      }
      router.push(returnTo);
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
          <p className="mt-2 text-sm text-slate-500">Entre para acessar seu painel de gestão.</p>
        </div>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <Field label="E-mail">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@loja.com" />
          </Field>
          <Field label="Senha">
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          Ainda não tem conta?{" "}
          <Link href="/registrar" className="font-semibold text-teal-700">
            Criar conta grátis
          </Link>
        </p>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
