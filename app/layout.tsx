import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Global Atacado · Gestão para lojistas e atacadistas",
  description: "Catálogo, estoque, pedidos, preços por atacado, clientes e financeiro em um só lugar.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
