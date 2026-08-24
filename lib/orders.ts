export const ORDER_STATUSES = ["orcamento", "aberto", "pago", "separado", "enviado", "concluido", "cancelado"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isCommittedStatus(status: string) {
  return status === "aberto" || status === "pago" || status === "separado" || status === "enviado" || status === "concluido";
}

export function isCancelled(status: string) {
  return status === "cancelado";
}

export function whatsappOrderLink(phone: string | null | undefined, orderSummary: string) {
  const digits = (phone ?? "").replace(/\D/g, "");
  const text = encodeURIComponent(orderSummary);
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}
