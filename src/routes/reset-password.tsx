import { useEffect, useState, type FormEvent } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BlinkClientBoundary } from '@/components/BlinkClientBoundary'
import { AuthLoading, CustomerAuthLayout } from '@/components/CustomerAuthLayout'
import { getAuthErrorMessage } from '@/lib/auth-errors'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/reset-password')({
  head: () => ({ meta: [{ title: 'Choose a new password · OCO Trailer Rentals' }] }),
  component: ResetPasswordRoute,
})

function ResetPasswordRoute() {
  return <BlinkClientBoundary fallback={<AuthLoading label="Preparing password reset…" />}><ResetPasswordForm /></BlinkClientBoundary>
}

function ResetPasswordForm() {
  const navigate = useNavigate()
  const [isChecking, setIsChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [updated, setUpdated] = useState(false)

  useEffect(() => {
    let mounted = true
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'PASSWORD_RECOVERY' || session) setHasSession(true)
      setIsChecking(false)
    })
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return
      if (sessionError) setError(getAuthErrorMessage(sessionError))
      setHasSession(Boolean(data.session))
      setIsChecking(false)
    })
    return () => { mounted = false; authListener.subscription.unsubscribe() }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (password.length < 8) return setError('Choose a password with at least 8 characters.')
    if (password !== confirmPassword) return setError('Passwords do not match.')
    setIsSubmitting(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(getAuthErrorMessage(updateError))
      setIsSubmitting(false)
      return
    }
    setUpdated(true)
    setIsSubmitting(false)
  }

  if (isChecking) return <AuthLoading label="Verifying your reset link…" />
  if (updated) return <CustomerAuthLayout title="Password updated" description="Your OCO account is ready to use again."><div className="space-y-5 text-sm leading-6 text-muted-foreground"><div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-foreground">Your password has been changed successfully.</div><Button onClick={() => navigate({ to: '/app' })} className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90">Continue to account</Button></div></CustomerAuthLayout>
  if (!hasSession) return <CustomerAuthLayout title="Reset link unavailable" description="This link may have expired or already been used."><div className="space-y-5 text-sm leading-6 text-muted-foreground"><p>Request a new password reset email, then open the newest link.</p><Button onClick={() => navigate({ to: '/forgot-password' })} className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90">Request a new link</Button><p className="text-center"><Link to="/login" search={{ redirect: undefined }} className="font-semibold text-primary hover:underline">Back to sign in</Link></p></div></CustomerAuthLayout>

  return <CustomerAuthLayout title="Choose a new password" description="Use at least 8 characters for your new password."><form onSubmit={handleSubmit} className="space-y-5" noValidate>{error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}<div className="space-y-2"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="new-password-confirm">Confirm new password</Label><Input id="new-password-confirm" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></div><Button type="submit" disabled={isSubmitting} className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90">{isSubmitting ? 'Updating password…' : 'Update password'}</Button></form></CustomerAuthLayout>
}
