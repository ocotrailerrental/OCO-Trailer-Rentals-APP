import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, LogOut, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const getErrorMessage = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String(error.message) : 'Please try again in a moment.'

export const Route = createFileRoute('/app/')({
  head: () => ({ meta: [{ title: 'My account · OCO Trailer Rentals' }] }),
  component: DashboardHome,
})

type Profile = { full_name: string | null; phone: string | null; role: string }
type DashboardReservation = { id: string; reservation_number: string; start_date: string; end_date: string; total: number; reservation_status: string; payment_status: string }

function DashboardHome() {
  const queryClient = useQueryClient()
  const dashboardQuery = useQuery({ queryKey: ['customer-dashboard'], queryFn: loadDashboard })
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const saveMutation = useMutation({ mutationFn: async () => { const { data: authData, error: authError } = await supabase.auth.getUser(); if (authError || !authData.user) throw new Error('Your session has expired. Please sign in again.'); const { data, error: updateError } = await supabase.from('oco_profiles').update({ full_name: fullName.trim(), phone: phone.trim() }).eq('id', authData.user.id).select('full_name, phone, role').single(); if (updateError) throw updateError; return data as Profile }, onSuccess: data => { queryClient.setQueryData(['customer-dashboard'], current => current ? { ...current, profile: data } : current); setMessage('Profile saved.'); }, onError: value => setError(getErrorMessage(value)) })
  const data = dashboardQuery.data
  // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronize editable fields after the profile query resolves
  useEffect(() => { if (data?.profile) { setFullName(data.profile.full_name ?? ''); setPhone(data.profile.phone ?? '') } }, [data?.profile])
  if (dashboardQuery.isLoading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" /></div>
  if (dashboardQuery.error || !data) return <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm text-destructive">{getErrorMessage(dashboardQuery.error)}</div>
  const activeStatuses = ['confirmed', 'ready_for_pickup', 'checked_out', 'active', 'return_pending_review', 'overdue']
  const completedStatuses = ['completed', 'returned']
  const pendingCount = data.reservations.filter(item => ['draft', 'quote', 'pending', 'awaiting_payment', 'awaiting_cash_payment'].includes(item.reservation_status.toLowerCase())).length
  const activeCount = data.reservations.filter(item => activeStatuses.includes(item.reservation_status.toLowerCase())).length
  const completedCount = data.reservations.filter(item => completedStatuses.includes(item.reservation_status.toLowerCase())).length
  const nextRental = data.reservations.filter(item => !['completed', 'cancelled', 'declined', 'no-show', 'returned'].includes(item.reservation_status.toLowerCase())).sort((a, b) => a.start_date.localeCompare(b.start_date))[0]
  const displayName = fullName || 'there'
  return <div className="space-y-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Customer account</p><h1 className="mt-2 font-serif text-4xl">Welcome, {displayName}</h1><p className="mt-2 text-sm text-muted-foreground">Your OCO profile and rental home base.</p></div><Button variant="outline" onClick={signOut} className="w-full gap-2 bg-transparent sm:w-auto"><LogOut className="h-4 w-4" /> Sign out</Button></div>{(error || message) && <div role={error ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-primary/30 bg-primary/10 text-foreground'}`}>{error || message}</div>}<div className="grid gap-4 sm:grid-cols-3"><StatCard label="Pending" value={pendingCount} /><StatCard label="Confirmed / active" value={activeCount} /><StatCard label="Completed" value={completedCount} /></div><div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]"><Card><CardHeader><CardTitle className="flex items-center gap-2 font-serif text-2xl"><UserRound className="h-5 w-5 text-primary" /> Profile details</CardTitle></CardHeader><CardContent className="space-y-5"><div className="space-y-2"><Label htmlFor="profile-name">Full name</Label><Input id="profile-name" value={fullName} onChange={event => setFullName(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="profile-email">Email address</Label><Input id="profile-email" value={data.email} readOnly className="bg-muted/50" /></div><div className="space-y-2"><Label htmlFor="profile-phone">Phone number</Label><Input id="profile-phone" type="tel" value={phone} onChange={event => setPhone(event.target.value)} /></div><div className="flex items-center justify-between gap-3 border-t border-border pt-5"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Account role</p><p className="mt-1 text-sm font-semibold capitalize">{data.profile?.role ?? 'customer'}</p></div><Button onClick={() => { setError(''); setMessage(''); saveMutation.mutate() }} disabled={saveMutation.isPending} className="bg-primary text-primary-foreground hover:bg-primary/90">{saveMutation.isPending ? 'Saving…' : 'Save profile'}</Button></div></CardContent></Card><div className="space-y-6">{nextRental ? <Card><CardContent className="p-6"><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Next rental</p><h2 className="mt-3 font-serif text-2xl">{nextRental.reservation_number}</h2><p className="mt-2 text-sm text-muted-foreground">{nextRental.start_date} – {nextRental.end_date}</p><Link to="/app/reservations/$reservationId" params={{ reservationId: nextRental.id }} className="mt-5 inline-flex text-sm font-semibold text-primary hover:underline">View reservation <ArrowRight className="ml-1 h-4 w-4" /></Link></CardContent></Card> : <EmptyRentalCard title="Upcoming rentals" copy="Your next rental will appear here after you submit a reservation." />}<EmptyRentalCard title="Rental history" copy={completedCount ? `${completedCount} completed rental${completedCount === 1 ? '' : 's'} in your account.` : 'Completed rental history will appear here after your first trip.'} /><Link to="/app/reservations" className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">View all rentals <ArrowRight className="h-4 w-4" /></Link></div></div></div>
}

function EmptyRentalCard({ title, copy }: { title: string; copy: string }) { return <Card className="border-dashed"><CardContent className="p-6"><h2 className="font-serif text-2xl">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{copy}</p></CardContent></Card> }

function StatCard({ label, value }: { label: string; value: number }) { return <Card><CardContent className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 font-serif text-3xl text-primary">{value}</p></CardContent></Card> }

async function loadDashboard() { const { data: authData, error: authError } = await supabase.auth.getUser(); if (authError || !authData.user) throw new Error('Your session has expired. Please sign in again.'); const [profileResult, reservationsResult] = await Promise.all([supabase.from('oco_profiles').select('full_name, phone, role').eq('id', authData.user.id).maybeSingle(), supabase.from('oco_reservations').select('id,reservation_number,start_date,end_date,total,reservation_status,payment_status').eq('customer_id', authData.user.id).order('start_date', { ascending: true })]); if (profileResult.error) throw profileResult.error; if (reservationsResult.error) throw reservationsResult.error; return { email: authData.user.email ?? '', profile: profileResult.data as Profile | null, reservations: (reservationsResult.data ?? []) as DashboardReservation[] } }
function signOut() { return supabase.auth.signOut() }
