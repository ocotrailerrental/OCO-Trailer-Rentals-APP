import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  CircleAlert,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";

type InspectionType = "pickup" | "return";
type Inspection = {
  id: string;
  reservation_id: string;
  inspection_type: InspectionType;
  condition_status: "no_damage" | "damage_noted" | "needs_review";
  notes: string | null;
  completed_at: string | null;
};
type Photo = {
  id: string;
  storage_path: string;
  photo_category: string;
  notes: string | null;
  url?: string;
};
const REQUIRED_VIEWS = [
  "front",
  "rear",
  "driver_side",
  "passenger_side",
  "deck",
  "hitch",
  "tires",
] as const;

export const Route = createFileRoute(
  "/app/reservations/$reservationId/inspections/$inspectionType",
)({
  head: () => ({
    meta: [{ title: "Contactless inspection · OCO Trailer Rentals" }],
  }),
  component: InspectionPage,
});

function InspectionPage() {
  const { reservationId, inspectionType: rawType } = Route.useParams();
  const inspectionType =
    rawType === "return" ? "return" : rawType === "pickup" ? "pickup" : null;
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["inspection", reservationId, inspectionType],
    enabled: Boolean(inspectionType),
    queryFn: () =>
      loadInspection(reservationId, inspectionType as InspectionType),
  });
  const [condition, setCondition] =
    useState<Inspection["condition_status"]>("no_damage");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("front");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  const save = useMutation({
    mutationFn: async (complete: boolean) => {
      if (!query.data) throw new Error("Inspection is not ready.");
      const { error } = await supabase
        .from("oco_inspections")
        .update({
          condition_status: condition,
          notes: notes.trim() || null,
          completed_at: complete ? new Date().toISOString() : null,
        })
        .eq("id", query.data.inspection.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      setMessage("Inspection saved.");
      await client.invalidateQueries({
        queryKey: ["inspection", reservationId, inspectionType],
      });
      await client.invalidateQueries({
        queryKey: ["reservation", reservationId],
      });
    },
    onError: (error) =>
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save the inspection.",
      ),
  });

  async function upload(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!file || !query.data) return setMessage("Choose a photo first.");
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024)
      return setMessage("Use an image smaller than 10 MB.");
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return setMessage("Your session expired. Sign in again.");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `${auth.user.id}/${reservationId}/${query.data.inspection.id}/${crypto.randomUUID()}-${safeName}`;
    const stored = await supabase.storage
      .from("oco-inspection-photos")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (stored.error) return setMessage(stored.error.message);
    const inserted = await supabase.from("oco_inspection_photos").insert({
      inspection_id: query.data.inspection.id,
      uploaded_by: auth.user.id,
      storage_path: path,
      photo_category: category,
    });
    if (inserted.error) {
      await supabase.storage.from("oco-inspection-photos").remove([path]);
      return setMessage(inserted.error.message);
    }
    setFile(null);
    setMessage("Photo uploaded securely.");
    await client.invalidateQueries({
      queryKey: ["inspection", reservationId, inspectionType],
    });
  }

  if (!inspectionType) return <Notice title="Invalid inspection link" />;
  if (query.isLoading) return <Notice title="Preparing the inspection…" />;
  if (query.error || !query.data)
    return (
      <Notice
        title={
          query.error instanceof Error
            ? query.error.message
            : "Inspection unavailable"
        }
      />
    );
  const { inspection, photos, reservationNumber } = query.data;
  const uploadedViews = new Set(photos.map((photo) => photo.photo_category));
  const missingViews = REQUIRED_VIEWS.filter(
    (view) => !uploadedViews.has(view),
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        to="/app/reservations/$reservationId"
        params={{ reservationId }}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Reservation details
      </Link>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
          {reservationNumber}
        </p>
        <h1 className="mt-2 font-serif text-4xl capitalize">
          {inspectionType} inspection
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Photos stay private and are available only to this customer and
          authorized OCO staff.
        </p>
      </div>
      {inspection.completed_at && (
        <div className="flex gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Completed. You
          can add more photos or update notes.
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Condition</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["no_damage", "No damage"],
              ["damage_noted", "Damage noted"],
              ["needs_review", "Needs staff review"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setCondition(value as Inspection["condition_status"])
                }
                className={`rounded-lg border p-3 text-left text-sm ${condition === value ? "border-primary bg-primary/10" : "border-border"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div>
            <Label htmlFor="inspection-notes">Notes</Label>
            <textarea
              id="inspection-notes"
              className="mt-2 min-h-28 w-full rounded-lg border border-input bg-background p-3 text-sm"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={
                inspection.notes ?? "Describe condition or damage clearly."
              }
            />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-2xl">
            <Camera className="h-5 w-5 text-primary" /> Contactless photos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={upload}
            className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <div>
              <Label htmlFor="photo-category">View</Label>
              <select
                id="photo-category"
                className="mt-2 h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {[
                  "front",
                  "rear",
                  "driver_side",
                  "passenger_side",
                  "deck",
                  "hitch",
                  "tires",
                  "damage",
                  "other",
                ].map((value) => (
                  <option key={value} value={value}>
                    {value.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="inspection-photo">Photo</Label>
              <input
                id="inspection-photo"
                className="mt-2 block w-full text-sm"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
            <Button type="submit">
              <Upload className="mr-2 h-4 w-4" /> Upload
            </Button>
          </form>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {photos.map((photo) => (
              <figure
                key={photo.id}
                className="overflow-hidden rounded-lg border border-border"
              >
                <img
                  src={photo.url}
                  alt={photo.photo_category.replace("_", " ")}
                  className="aspect-square w-full object-cover"
                />
                <figcaption className="p-2 text-xs capitalize text-muted-foreground">
                  {photo.photo_category.replace("_", " ")}
                </figcaption>
              </figure>
            ))}
          </div>
          <div className="mt-6 rounded-lg bg-secondary/50 p-4">
            <p className="text-sm font-semibold">Required views</p>
            <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {REQUIRED_VIEWS.map((view) => (
                <li key={view} className="flex items-center gap-2 capitalize">
                  <span
                    className={
                      uploadedViews.has(view)
                        ? "text-emerald-600"
                        : "text-muted-foreground"
                    }
                  >
                    {uploadedViews.has(view) ? "✓" : "○"}
                  </span>
                  {view.replace("_", " ")}
                </li>
              ))}
            </ul>
          </div>
          {photos.length === 0 && (
            <p className="mt-5 text-sm text-muted-foreground">
              No photos uploaded yet. Add clear views before completing the
              handoff.
            </p>
          )}
        </CardContent>
      </Card>
      {message && (
        <p
          role="status"
          className="flex gap-2 rounded-lg border border-border p-3 text-sm"
        >
          <CircleAlert className="h-4 w-4" />
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => save.mutate(false)}
          disabled={save.isPending}
        >
          Save draft
        </Button>
        <Button
          onClick={() => save.mutate(true)}
          disabled={save.isPending || missingViews.length > 0}
        >
          Complete {inspectionType} inspection
        </Button>
      </div>
    </div>
  );
}

async function loadInspection(reservationId: string, type: InspectionType) {
  const reservation = await supabase
    .from("oco_reservations")
    .select("id,reservation_number")
    .eq("id", reservationId)
    .maybeSingle();
  if (reservation.error) throw reservation.error;
  if (!reservation.data)
    throw new Error("Reservation not found or access denied.");
  const started = await supabase.rpc("oco_start_inspection", {
    p_reservation_id: reservationId,
    p_inspection_type: type,
  });
  if (started.error) throw started.error;
  const inspection = (
    Array.isArray(started.data) ? started.data[0] : started.data
  ) as Inspection;
  const result = await supabase
    .from("oco_inspection_photos")
    .select("id,storage_path,photo_category,notes")
    .eq("inspection_id", inspection.id)
    .order("created_at");
  if (result.error) throw result.error;
  const photos = await Promise.all(
    ((result.data ?? []) as Photo[]).map(async (photo) => {
      const signed = await supabase.storage
        .from("oco-inspection-photos")
        .createSignedUrl(photo.storage_path, 600);
      return { ...photo, url: signed.data?.signedUrl };
    }),
  );
  return {
    inspection,
    photos,
    reservationNumber: reservation.data.reservation_number as string,
  };
}

function Notice({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center">
      <CircleAlert className="mx-auto h-8 w-8 text-primary" />
      <h1 className="mt-4 font-serif text-2xl">{title}</h1>
    </div>
  );
}
