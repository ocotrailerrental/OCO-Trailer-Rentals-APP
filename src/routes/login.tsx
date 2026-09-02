import { useState, type FormEvent } from 'react'
import { Link, createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ClientOnlyBoundary } from '@/components/ClientOnlyBoundary'
import { AuthLoading, CustomerAuthLayout } from '@/components/CustomerAuthLayout'
import { getAuthErrorMessage } from '@/lib/auth-errors'
import { safeInternalRedirect } from '@/lib/booking'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/login')({
  head: () => ({
    meta: [
      { title: 'Sign in · OCO Trailer Rentals' },
      { name: 'description', content: 'Sign in to manage your OCO Trailer Rentals account.' },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({ redirect: safeInternalRedirect(search.redirect) }),
  component: LoginRoute,
})

function LoginRoute() {
  return (
    <ClientOnlyBoundary fallback={<AuthLoading label="Loading sign in…" />}>
      <LoginForm />
    </ClientOnlyBoundary>
  )
}

function LoginForm() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const search = useSearch({ from: '/login' }) as { redirect?: string }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(getAuthErrorMessage(signInError))
      setIsSubmitting(false)
      return
    }
    // `redirect` is a full href — "/reserve?trailerId=…&startDate=…" — because that
    // is what the reserve page captured on the way out. Router `to:` takes a route
    // path, not an href, so navigating with it drops the query string and the
    // customer lands on an incomplete reservation. A location assignment keeps the
    // whole thing, and it is already proven internal by `safeInternalRedirect`.
    const redirect = safeInternalRedirect(search.redirect) ?? '/app'
    if (redirect.includes('?')) {
      window.location.assign(redirect)
      return
    }
    await navigate({ to: redirect })
  }

  return (
    <CustomerAuthLayout title="Welcome back" description="Sign in to manage your rentals, profile, and pickup details.">
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        <div className="space-y-2"><Label htmlFor="email">Email address</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></div>
        <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="password">Password</Label><Link to="/forgot-password" className="text-xs font-semibold text-primary hover:underline">Forgot password?</Link></div><Input id="password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></div>
        <Button type="submit" disabled={isSubmitting} className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90">{isSubmitting ? 'Signing in…' : 'Sign in'}</Button>
        <p className="text-center text-sm text-muted-foreground">New to OCO? <Link to="/signup" className="font-semibold text-primary hover:underline">Create an account</Link></p>
      </form>
    </CustomerAuthLayout>
  )
}
