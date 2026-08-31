import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail, MapPin, Phone } from "lucide-react";
import { OcoLockup } from "@/components/OcoLogo";
import { formatPhone, loadPublicContacts, phoneHref } from "@/lib/contacts";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/contact")({
  head: () => ({ meta: [{ title: "Contact OCO Trailer Rentals" }] }),
  component: ContactPage,
});

function ContactPage() {
  const locations = useQuery({
    queryKey: ["contact-locations"],
    queryFn: async () => {
      const result = await supabase
        .from("oco_locations")
        .select("id,name,address_line1,address_line2,city,state,postal_code")
        .eq("is_active", true)
        .order("name");
      if (result.error) throw result.error;
      return result.data ?? [];
    },
  });
  const contacts = useQuery({
    queryKey: ["public-contacts"],
    queryFn: loadPublicContacts,
  });
  return (
    <main className="min-h-dvh bg-background">
      <header className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6">
          <Link to="/">
            <OcoLockup />
          </Link>
          <Link to="/" className="flex items-center gap-2 text-sm">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
        </div>
      </header>
      <section className="mx-auto max-w-4xl px-5 py-16">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Contact OCO
        </p>
        <h1 className="mt-3 font-serif text-5xl">Your local trailer team.</h1>
        <p className="mt-5 max-w-2xl leading-7 text-muted-foreground">
          For an existing rental, sign in and open the reservation so the team
          can identify the correct trailer, dates, and yard. Location details
          below come directly from OCO’s current system.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {locations.isLoading && <p>Loading current locations…</p>}
          {locations.error && (
            <p role="alert" className="text-destructive">
              Location details are temporarily unavailable.
            </p>
          )}
          {locations.data?.map((location) => (
            <article
              key={location.id}
              className="rounded-2xl border border-border bg-card p-6"
            >
              <MapPin className="h-6 w-6 text-primary" />
              <h2 className="mt-8 font-serif text-2xl">{location.name}</h2>
              <address className="mt-3 not-italic text-sm leading-6 text-muted-foreground">
                {location.address_line1}
                {location.address_line2 && (
                  <>
                    <br />
                    {location.address_line2}
                  </>
                )}
                <br />
                {location.city}, {location.state} {location.postal_code}
              </address>
            </article>
          ))}
        </div>
        <div className="mt-12">
          <h2 className="font-serif text-3xl">Contact the team</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {contacts.isLoading && <p>Loading current contact details…</p>}
            {contacts.error && (
              <p role="alert" className="text-destructive">
                Contact details are temporarily unavailable.
              </p>
            )}
            {contacts.data?.map((contact) => (
              <article
                key={contact.email ?? contact.phone}
                className="rounded-2xl border border-border bg-card p-6"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  {contact.location_name ?? "Company-wide"}
                </p>
                <h3 className="mt-2 font-serif text-2xl">
                  {contact.full_name}
                </h3>
                <p className="mt-1 text-sm capitalize text-muted-foreground">
                  {contact.role}
                </p>
                <div className="mt-5 space-y-2 text-sm">
                  {contact.phone && (
                    <a
                      href={phoneHref(contact.phone)}
                      className="flex items-center gap-2 hover:text-primary"
                    >
                      <Phone className="h-4 w-4" />
                      {formatPhone(contact.phone)}
                    </a>
                  )}
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="flex items-center gap-2 hover:text-primary"
                    >
                      <Mail className="h-4 w-4" />
                      {contact.email}
                    </a>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="mt-10 flex gap-4">
          <Link
            to="/login"
            search={{ redirect: "/app/reservations" }}
            className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
          >
            Open my rentals
          </Link>
          <Link
            to="/faq"
            className="rounded-lg border border-border px-5 py-3 text-sm font-semibold"
          >
            Read the FAQ
          </Link>
        </div>
      </section>
    </main>
  );
}
