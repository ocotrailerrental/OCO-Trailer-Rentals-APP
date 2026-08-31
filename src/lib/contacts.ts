import { supabase } from "@/lib/supabase";

export type PublicContact = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: "manager" | "admin" | "owner";
  location_id: string | null;
  location_name: string | null;
};

export async function loadPublicContacts(): Promise<PublicContact[]> {
  const result = await supabase.rpc("oco_public_contacts");
  if (result.error) throw result.error;
  return (result.data ?? []) as PublicContact[];
}

export function phoneHref(phone: string) {
  return `tel:+1${phone.replace(/\D/g, "")}`;
}

export function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length !== 10) return phone;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
