import { redirect } from "next/navigation";
import { getCurrentUser } from "../../lib/session";
import { PainelShell } from "../../components/painel-shell";

export const dynamic = "force-dynamic";

export default async function PainelLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar?return_to=/painel");

  return <PainelShell user={user}>{children}</PainelShell>;
}
