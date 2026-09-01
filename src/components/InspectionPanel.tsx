import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, Check, CircleAlert, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AdminData,
  AdminInspection,
  AdminReservation,
  OPTIONAL_PHOTO_VIEWS,
  REQUIRED_PHOTO_VIEWS,
} from '@/lib/admin'
import { supabase } from '@/lib/supabase'

// Exactly the values `oco_inspections_condition_status_check` allows.
const CONDITIONS = [
  { key: 'no_damage', label: 'No damage — nothing to note' },
  { key: 'damage_noted', label: 'Damage noted' },
  { key: 'needs_review', label: 'Needs review by a manager' },
]

const BUCKET = 'oco-inspection-photos'
const MAX_BYTES = 10 * 1024 * 1024

/**
 * Walking round the trailer with a phone, before it leaves and after it comes back.
 *
 * The seven required views are the ones the database insists on: an inspection
 * cannot be completed with any of them missing, so they are listed here as slots
 * to fill rather than as a free-for-all upload box. Photos are keyed to the
 * inspection, which is keyed to the reservation, the trailer and the customer —
 * so the record of who had the trailer and what state it was in stays together.
 */
export function InspectionPanel({
  reservation,
  inspectionType,
  data,
  onClose,
}: {
  reservation: AdminReservation
  inspectionType: 'pickup' | 'return'
  data: AdminData
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const existing = data.inspections.find(
    item => item.reservation_id === reservation.id && item.inspection_type === inspectionType
  )
  const [inspection, setInspection] = useState<AdminInspection | null>(existing ?? null)
  const [condition, setCondition] = useState(existing?.condition_status ?? 'no_damage')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [error, setError] = useState('')
  const [busyCategory, setBusyCategory] = useState('')

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-console'] })

  const photosFor = (category: string) =>
    inspection
      ? data.inspectionPhotos.filter(
          photo => photo.inspection_id === inspection.id && photo.photo_category === category
        )
      : []

  const start = useMutation({
    mutationFn: async () => {
      const { data: row, error: rpcError } = await supabase.rpc('oco_start_inspection', {
        p_reservation_id: reservation.id,
        p_inspection_type: inspectionType,
      })
      if (rpcError) throw new Error(rpcError.message)
      return row as unknown as AdminInspection
    },
    onSuccess: row => {
      setInspection({ ...row, photo_count: 0 })
      refresh()
    },
    onError: e => setError(e instanceof Error ? e.message : 'Could not start the inspection.'),
  })

  /**
   * Uploads go to a path beginning with the uploader's own user id, because that
   * is what the storage policy allows to be written. Reading is governed
   * separately, so the customer and the yard's staff can still see the photo.
   */
  const upload = useMutation({
    mutationFn: async ({ category, file }: { category: string; file: File }) => {
      if (!inspection) throw new Error('Start the inspection first.')
      if (!file.type.startsWith('image/')) throw new Error('That file is not an image.')
      if (file.size > MAX_BYTES) throw new Error('That photo is larger than 10 MB.')

      const { data: authData } = await supabase.auth.getUser()
      const uid = authData.user?.id
      if (!uid) throw new Error('Your session has expired. Please sign in again.')

      const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const path = `${uid}/inspections/${inspection.id}/${category}-${Date.now()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false })
      if (uploadError) throw new Error(uploadError.message)

      const { error: insertError } = await supabase.from('oco_inspection_photos').insert({
        inspection_id: inspection.id,
        uploaded_by: uid,
        storage_path: path,
        photo_category: category,
      })
      // If the row fails to record, the file in the bucket is an orphan nobody can
      // find. Remove it rather than leaving it behind.
      if (insertError) {
        await supabase.storage.from(BUCKET).remove([path])
        throw new Error(insertError.message)
      }
    },
    onSuccess: refresh,
    onError: e => setError(e instanceof Error ? e.message : 'That photo did not upload.'),
    onSettled: () => setBusyCategory(''),
  })

  const save = useMutation({
    mutationFn: async (complete: boolean) => {
      if (!inspection) throw new Error('Start the inspection first.')
      const patch: Record<string, unknown> = {
        condition_status: condition,
        notes: notes.trim() || null,
      }
      if (complete) patch.completed_at = new Date().toISOString()
      const { error: updateError } = await supabase
        .from('oco_inspections')
        .update(patch)
        .eq('id', inspection.id)
      if (updateError) throw new Error(updateError.message)
    },
    onSuccess: () => {
      refresh()
      onClose()
    },
    onError: e => setError(e instanceof Error ? e.message : 'The inspection was not saved.'),
  })

  const missing = REQUIRED_PHOTO_VIEWS.filter(view => photosFor(view.key).length === 0)
  const isComplete = Boolean(inspection?.completed_at)

  return (
    <Card className="border-primary/30">
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">
              {inspectionType === 'pickup' ? 'Before it leaves' : 'On its return'}
            </p>
            <h3 className="mt-2 font-serif text-2xl">
              {inspectionType === 'pickup' ? 'Pickup inspection' : 'Return inspection'}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {reservation.reservation_number} · {reservation.customer_name}
            </p>
          </div>
          <Button variant="outline" onClick={onClose} className="bg-transparent">
            Close
          </Button>
        </div>

        {!inspection ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Starting an inspection creates the record these photos attach to. Take all seven views
              before you finish it — the record cannot be completed with any of them missing.
            </p>
            <Button
              disabled={start.isPending}
              onClick={() => {
                setError('')
                start.mutate()
              }}
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Camera className="h-4 w-4" />
              {start.isPending ? 'Starting…' : 'Start inspection'}
            </Button>
          </div>
        ) : (
          <>
            {isComplete && (
              <p className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <Check className="h-4 w-4 text-primary" />
                This inspection was completed. You can still add photos, but the record is closed.
              </p>
            )}

            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Required views
              </h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {REQUIRED_PHOTO_VIEWS.map(view => (
                  <PhotoSlot
                    key={view.key}
                    label={view.label}
                    count={photosFor(view.key).length}
                    required
                    busy={busyCategory === view.key}
                    onPick={file => {
                      setError('')
                      setBusyCategory(view.key)
                      upload.mutate({ category: view.key, file })
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                Anything else
              </h4>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {OPTIONAL_PHOTO_VIEWS.map(view => (
                  <PhotoSlot
                    key={view.key}
                    label={view.label}
                    count={photosFor(view.key).length}
                    required={false}
                    busy={busyCategory === view.key}
                    onPick={file => {
                      setError('')
                      setBusyCategory(view.key)
                      upload.mutate({ category: view.key, file })
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="condition">Condition</Label>
                <select
                  id="condition"
                  value={condition}
                  onChange={event => setCondition(event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {CONDITIONS.map(item => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="inspection-notes">Notes</Label>
                <Input
                  id="inspection-notes"
                  value={notes}
                  onChange={event => setNotes(event.target.value)}
                  placeholder="Scuff on the driver-side fender, already there at pickup"
                />
              </div>
            </div>

            {missing.length > 0 && !isComplete && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                Still to photograph: {missing.map(view => view.label).join(', ')}.
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}

            <div className="flex flex-wrap gap-3 border-t border-border pt-5">
              <Button
                variant="outline"
                disabled={save.isPending}
                onClick={() => {
                  setError('')
                  save.mutate(false)
                }}
                className="bg-transparent"
              >
                Save and finish later
              </Button>
              {!isComplete && (
                <Button
                  disabled={save.isPending || missing.length > 0}
                  onClick={() => {
                    setError('')
                    save.mutate(true)
                  }}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Check className="h-4 w-4" />
                  {save.isPending ? 'Saving…' : 'Complete inspection'}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function PhotoSlot({
  label,
  count,
  required,
  busy,
  onPick,
}: {
  label: string
  count: number
  required: boolean
  busy: boolean
  onPick: (file: File) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const done = count > 0

  return (
    <div
      className={`rounded-lg border p-4 ${
        done ? 'border-primary/40 bg-primary/5' : required ? 'border-dashed border-border' : 'border-border'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        {done ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-primary">
            <Check className="h-3.5 w-3.5" /> {count}
          </span>
        ) : (
          required && <span className="text-xs text-muted-foreground">Required</span>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={event => {
          const file = event.target.files?.[0]
          // Clearing the value lets the same file be chosen again after a failure.
          event.target.value = ''
          if (file) onPick(file)
        }}
      />
      <Button
        variant="outline"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="mt-3 h-9 w-full gap-2 bg-transparent text-sm"
      >
        <Upload className="h-3.5 w-3.5" />
        {busy ? 'Uploading…' : done ? 'Add another' : 'Take photo'}
      </Button>
    </div>
  )
}
