import { useState, type FormEvent } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ClientOnlyBoundary } from '@/components/ClientOnlyBoundary'
import { AuthLoading, CustomerAuthLayout } from '@/components/CustomerAuthLayout'
import { getAuthErrorMessage } from '@/lib/auth-errors'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/forgot-password')({
  head: () => ({ meta: [{ title: 'Reset your password · OCO Trailer Rentals' }] }),
  component: ForgotPasswordRoute,
})

function ForgotPasswordRoute() {
  return <ClientOnlyBoundary fallback={<AuthLoading label="Loading password recovery…" />}><ForgotPasswordForm /></ClientOnlyBoundary>
}

function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (resetError) {
      setError(getAuthErrorMessage(resetError))
      setIsSubmitting(false)
      return
    }
    setSent(true)
    setIsSubmitting(false)
  }

  return (
    <CustomerAuthLayout title="Reset your password" description="We’ll email you a secure link to choose a new password.">
      {sent ? <div className="space-y-5 text-sm leading-6 text-muted-foreground"><div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-foreground">If an account exists for <strong>{email}</strong>, a password reset link is on its way.</div><p className="text-center"><Link to="/login" search={{ redirect: undefined }} className="font-semibold text-primary hover:underline">Back to sign in</Link></p></div> : <form onSubmit={handleSubmit} className="space-y-5" noValidate>{error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}<div className="space-y-2"><Label htmlFor="recovery-email">Email address</Label><Input id="recovery-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></div><Button type="submit" disabled={isSubmitting} className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90">{isSubmitting ? 'Sending link…' : 'Send reset link'}</Button><p className="text-center text-sm text-muted-foreground"><Link to="/login" search={{ redirect: undefined }} className="font-semibold text-primary hover:underline">Back to sign in</Link></p></form>}
    </CustomerAuthLayout>
  )
}
