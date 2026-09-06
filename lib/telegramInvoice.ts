type InvoiceResult = "paid" | "unavailable" | "failed";

export async function openTelegramInvoice(
  product: string,
  initData: string
): Promise<{ result: InvoiceResult; message?: string }> {
  const telegram = (window as any).Telegram?.WebApp;
  if (!telegram?.openInvoice) return { result: "unavailable" };

  try {
    const res = await fetch(`/api/invoice?product=${product}`, {
      headers: { "x-telegram-init-data": initData },
    });
    const json = await res.json().catch(() => null);
    if (!json?.url) return { result: "failed", message: json?.error };

    const status = await new Promise<string>((resolve) => telegram.openInvoice(json.url, resolve));
    return { result: status === "paid" ? "paid" : "failed" };
  } catch (error) {
    return { result: "failed", message: error instanceof Error ? error.message : undefined };
  }
}
