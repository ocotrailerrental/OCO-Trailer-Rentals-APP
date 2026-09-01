import { useEffect, useRef, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CircleAlert, IdCard, ShieldCheck, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/app/documents')({
  head: () => ({ meta: [{ title: 'Licence and insurance · OCO Trailer Rentals' }] }),
  component: DocumentsPage,
})

const BUCKET = 'oco-inspection-photos'
const MAX_BYTES = 10 * 1024 * 1024

// Fifty states, DC and the territories that issue driving licences OCO accepts.
const STATES = [
  'AK','AL','AR','AZ','CA','CO','CT','DC','DE','FL','GA','HI','IA','ID','IL','IN','KS','KY','LA',
  'MA','MD','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH','NJ','NM','NV','NY','OH','OK','OR',
  'PA','PR','RI','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY',
]

type Verification = {
  profile_id: string
  date_of_birth: string | null
  license_state: string | null
  license_last4: string | null
  license_expiry: string | null
  license_photo_path: string | null
  insurance_type: string | null
  insurer_name: string | null
  policy_number: string | null
  policy_expiry: string | null
  insurance_doc_path: string | null
  coverage_label: string | null
  submitted_at: string | null
  verified_at: string | null
}

type Settings = {
  insurance_option_label: string
  insurance_option_blurb: string
  insurance_daily_fee: number
  insurance_option_active: boolean
}

/**
 * Where a renter supplies the three things OCO has to check before handing over a
 * trailer: that they hold a current licence, that they are old enough, and that
 * the load is insured.
 *
 * Only the last four digits of the licence number are stored. The full number is
 * never asked for and never kept — it is not needed to verify anyone at the
 * counter, and holding it would make this table worth stealing.
 */
function DocumentsPage() {
  const queryClient = useQueryClient()
  const [isHydrated, setIsHydrated] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount marker prevents SSR/client data divergence
    setIsHydrated(true)
  }, [])

  const query = useQuery({
    queryKey: ['my-documents'],
    enabled: isHydrated,
    queryFn: async () => {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) throw new Error('Please sign in again.')
      const profileId = authData.user.id

      const [verification, settings, minAge] = await Promise.all([
        supabase
          .from('oco_customer_verification')
          .select(
            'profile_id,date_of_birth,license_state,license_last4,license_expiry,license_photo_path,' +
              'insurance_type,insurer_name,policy_number,policy_expiry,insurance_doc_path,' +
              'coverage_label,submitted_at,verified_at'
          )
          .eq('profile_id', profileId)
          .maybeSingle(),
        supabase
          .from('oco_settings')
          .select(
            'insurance_option_label,insurance_option_blurb,insurance_daily_fee,insurance_option_active'
          )
          .maybeSingle(),
        supabase.from('oco_locations').select('min_renter_age').eq('is_active', true),
      ])
      if (verification.error) throw verification.error

      const ages = ((minAge.data ?? []) as unknown as { min_renter_age: number | null }[])
        .map(row => Number(row.min_renter_age) || 21)
      return {
        profileId,
        verification: (verification.data as unknown as Verification | null) ?? null,
        settings: (settings.data as unknown as Settings | null) ?? null,
        // If yards disagree, quote the strictest — telling someone they qualify and
        // then turning them away at the counter is worse than asking for a year.
        minAge: ages.length ? Math.max(...ages) : 21,
      }
    },
  })

  const existing = query.data?.verification ?? null
  const settings = query.data?.settings ?? null

  const [dateOfBirth, setDateOfBirth] = useState('')
  const [licenseState, setLicenseState] = useState('')
  const [licenseLast4, setLicenseLast4] = useState('')
  const [licenseExpiry, setLicenseExpiry] = useState('')
  const [insuranceType, setInsuranceType] = useState('')
  const [insurerName, setInsurerName] = useState('')
  const [policyNumber, setPolicyNumber] = useState('')
  const [policyExpiry, setPolicyExpiry] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  // Fill the form from whatever is already on file, once, when it arrives.
  if (query.data && loadedFor !== query.data.profileId) {
    setLoadedFor(query.data.profileId)
    setDateOfBirth(existing?.date_of_birth ?? '')
    setLicenseState(existing?.license_state ?? '')
    setLicenseLast4(existing?.license_last4 ?? '')
    setLicenseExpiry(existing?.license_expiry ?? '')
    setInsuranceType(existing?.insurance_type ?? '')
    setInsurerName(existing?.insurer_name ?? '')
    setPolicyNumber(existing?.policy_number ?? '')
    setPolicyExpiry(existing?.policy_expiry ?? '')
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['my-documents'] })

  const save = useMutation({
    mutationFn: async () => {
      const profileId = query.data?.profileId
      if (!profileId) throw new Error('Please sign in again.')

      const today = new Date().toISOString().slice(0, 10)
      if (!dateOfBirth) throw new Error('Please give your date of birth.')
      if (dateOfBirth >= today) throw new Error('That date of birth is not in the past.')
      if (!licenseState) throw new Error('Please choose the state that issued your licence.')
      if (!/^\d{4}$/.test(licenseLast4))
        throw new Error('Enter the last four digits of your licence number.')
      if (!licenseExpiry) throw new Error('Please give your licence expiry date.')
      if (licenseExpiry < today) throw new Error('That licence has already expired.')
      if (!insuranceType) throw new Error('Please choose how the rental is insured.')
      if (insuranceType === 'own') {
        if (!insurerName.trim()) throw new Error('Please name your insurer.')
        if (!policyExpiry) throw new Error('Please give your policy expiry date.')
        if (policyExpiry < today) throw new Error('That policy has already expired.')
      }

      const age = yearsBetween(dateOfBirth, today)
      const minAge = query.data?.minAge ?? 21
      if (age < minAge) {
        throw new Error(`OCO rents to drivers aged ${minAge} and over.`)
      }

      const payload: Record<string, unknown> = {
        profile_id: profileId,
        date_of_birth: dateOfBirth,
        license_state: licenseState,
        license_last4: licenseLast4,
        license_expiry: licenseExpiry,
        insurance_type: insuranceType,
        insurer_name: insuranceType === 'own' ? insurerName.trim() : null,
        policy_number: insuranceType === 'own' ? policyNumber.trim() || null : null,
        policy_expiry: insuranceType === 'own' ? policyExpiry : null,
        submitted_at: new Date().toISOString(),
      }
      if (insuranceType === 'oco_coverage') {
        payload.coverage_label = settings?.insurance_option_label ?? 'OCO coverage'
        payload.coverage_daily_fee = Number(settings?.insurance_daily_fee) || 0
        payload.coverage_accepted_at = new Date().toISOString()
      }

      const { error: upsertError } = await supabase
        .from('oco_customer_verification')
        .upsert(payload, { onConflict: 'profile_id' })
      if (upsertError) throw new Error(upsertError.message)
    },
    onSuccess: () => {
      setSaved(true)
      refresh()
    },
    onError: e => setError(e instanceof Error ? e.message : 'Your details were not saved.'),
  })

  if (!isHydrated || query.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading your documents…</p>
  }
  if (query.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        We could not load your documents:{' '}
        {query.error instanceof Error ? query.error.message : 'please try again.'}
      </p>
    )
  }

  const verified = Boolean(existing?.verified_at)

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Before you collect
        </p>
        <h1 className="mt-2 font-serif text-4xl">Licence and insurance</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We check these before handing over a trailer. Filling them in here means less standing
          around at the yard.
        </p>
      </div>

      {verified ? (
        <p className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
          Your documents have been checked by OCO staff. You can still update them if anything
          changes.
        </p>
      ) : existing?.submitted_at ? (
        <p className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
          <CircleAlert className="h-4 w-4 shrink-0" />
          Received. A member of staff checks these against the originals when you collect.
        </p>
      ) : null}

      <Card>
        <CardContent className="space-y-5 p-5 sm:p-7">
          <h2 className="flex items-center gap-2 font-serif text-2xl">
            <IdCard className="h-5 w-5 text-primary" /> Driving licence
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="dob">Date of birth</Label>
              <Input
                id="dob"
                type="date"
                value={dateOfBirth}
                onChange={event => setDateOfBirth(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                OCO rents to drivers aged {query.data?.minAge ?? 21} and over.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="license-state">Issuing state</Label>
              <select
                id="license-state"
                value={licenseState}
                onChange={event => setLicenseState(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Choose a state</option>
                {STATES.map(code => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="license-last4">Last four digits</Label>
              <Input
                id="license-last4"
                inputMode="numeric"
                maxLength={4}
                value={licenseLast4}
                onChange={event => setLicenseLast4(event.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="4821"
                className="font-mono tracking-widest"
              />
              <p className="text-xs text-muted-foreground">
                Four digits only. We never ask for or store the full number.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="license-expiry">Expires</Label>
              <Input
                id="license-expiry"
                type="date"
                value={licenseExpiry}
                onChange={event => setLicenseExpiry(event.target.value)}
              />
            </div>
          </div>

          <FileField
            label="Photo of your licence"
            hint="A clear photo of the front. Only you and the staff at your pickup yard can open it."
            column="license_photo_path"
            current={existing?.license_photo_path ?? null}
            profileId={query.data?.profileId ?? ''}
            onDone={refresh}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-5 p-5 sm:p-7">
          <h2 className="flex items-center gap-2 font-serif text-2xl">
            <ShieldCheck className="h-5 w-5 text-primary" /> Insurance
          </h2>

          <div className="space-y-3">
            {settings?.insurance_option_active && (
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                <input
                  type="radio"
                  name="insurance"
                  value="oco_coverage"
                  checked={insuranceType === 'oco_coverage'}
                  onChange={() => setInsuranceType('oco_coverage')}
                  className="mt-1 h-4 w-4 accent-primary"
                />
                <span>
                  <span className="block text-sm font-medium">
                    {settings.insurance_option_label}
                    {Number(settings.insurance_daily_fee) > 0 && (
                      <span className="ml-2 text-muted-foreground">
                        ${Number(settings.insurance_daily_fee).toFixed(2)} per day
                      </span>
                    )}
                  </span>
                  <span className="mt-1 block text-sm text-muted-foreground">
                    {settings.insurance_option_blurb}
                  </span>
                </span>
              </label>
            )}

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
              <input
                type="radio"
                name="insurance"
                value="own"
                checked={insuranceType === 'own'}
                onChange={() => setInsuranceType('own')}
                className="mt-1 h-4 w-4 accent-primary"
              />
              <span>
                <span className="block text-sm font-medium">My own policy</span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  Your auto policy covers the trailer while you are towing it. Bring the certificate.
                </span>
              </span>
            </label>
          </div>

          {insuranceType === 'own' && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="insurer">Insurer</Label>
                  <Input
                    id="insurer"
                    value={insurerName}
                    onChange={event => setInsurerName(event.target.value)}
                    placeholder="State Farm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="policy-number">Policy number</Label>
                  <Input
                    id="policy-number"
                    value={policyNumber}
                    onChange={event => setPolicyNumber(event.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="policy-expiry">Policy expires</Label>
                  <Input
                    id="policy-expiry"
                    type="date"
                    value={policyExpiry}
                    onChange={event => setPolicyExpiry(event.target.value)}
                  />
                </div>
              </div>

              <FileField
                label="Certificate of insurance"
                hint="A photo or PDF of the declarations page."
                column="insurance_doc_path"
                current={existing?.insurance_doc_path ?? null}
                profileId={query.data?.profileId ?? ''}
                onDone={refresh}
              />
            </>
          )}
        </CardContent>
      </Card>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <Check className="h-4 w-4 text-primary" /> Saved.
        </p>
      )}

      <div className="flex justify-end">
        <Button
          disabled={save.isPending}
          onClick={() => {
            setError('')
            setSaved(false)
            save.mutate()
          }}
          className="h-11 gap-2 bg-primary px-6 text-primary-foreground hover:bg-primary/90"
        >
          {save.isPending ? 'Saving…' : 'Save my details'}
        </Button>
      </div>
    </div>
  )
}

/**
 * One document upload. The file goes into a private bucket under the customer's
 * own folder — the storage policy allows writing nowhere else — and the path is
 * recorded on their verification row.
 */
function FileField({
  label,
  hint,
  column,
  current,
  profileId,
  onDone,
}: {
  label: string
  hint: string
  column: 'license_photo_path' | 'insurance_doc_path'
  current: string | null
  profileId: string
  onDone: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')

  async function handle(file: File) {
    setProblem('')
    setBusy(true)
    try {
      if (!profileId) throw new Error('Please sign in again.')
      const allowed = file.type.startsWith('image/') || file.type === 'application/pdf'
      if (!allowed) throw new Error('Upload an image or a PDF.')
      if (file.size > MAX_BYTES) throw new Error('That file is larger than 10 MB.')

      const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const path = `${profileId}/documents/${column}-${Date.now()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false })
      if (uploadError) throw new Error(uploadError.message)

      const { error: saveError } = await supabase
        .from('oco_customer_verification')
        .upsert({ profile_id: profileId, [column]: path }, { onConflict: 'profile_id' })
      if (saveError) {
        await supabase.storage.from(BUCKET).remove([path])
        throw new Error(saveError.message)
      }
      onDone()
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'That file did not upload.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {label}
            {current && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                <Check className="h-3.5 w-3.5" /> On file
              </span>
            )}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={event => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void handle(file)
          }}
        />
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="gap-2 bg-transparent"
        >
          <Upload className="h-4 w-4" />
          {busy ? 'Uploading…' : current ? 'Replace' : 'Upload'}
        </Button>
      </div>
      {problem && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {problem}
        </p>
      )}
    </div>
  )
}

/** Whole years between two ISO dates, the way an age is counted. */
function yearsBetween(from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  let years = end.getUTCFullYear() - start.getUTCFullYear()
  const monthDiff = end.getUTCMonth() - start.getUTCMonth()
  if (monthDiff < 0 || (monthDiff === 0 && end.getUTCDate() < start.getUTCDate())) years -= 1
  return years
}
