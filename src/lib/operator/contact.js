// Shared helpers for contacting customers from operator UI components.

export function whatsAppLink(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return `https://wa.me/${digits}`;
}
