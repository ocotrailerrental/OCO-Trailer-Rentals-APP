import { useState, type FormEvent } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ClientOnlyBoundary } from '@/components/ClientOnlyBoundary'
import { AuthLoading, CustomerAuthLayout } from '@/components/CustomerAuthLayout'
import { getAuthErrorMessage } from '@/lib/auth-errors'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/signup')({
  head: () => ({
    meta: [
      { title: 'Create an account · OCO Trailer Rentals' },
      { name: 'description', content: 'Create your OCO Trailer Rentals customer account.' },
    ],
  }),
  component: SignupRoute,
})

function SignupRoute() {
  return <ClientOnlyBoundary fallback={<AuthLoading label="Loading registration…" />}><SignupForm /></ClientOnlyBoundary>
}

function SignupForm() {
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [confirmationSent, setConfirmationSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (password.length < 8) return setError('Choose a password with at least 8 characters.')
    if (password !== confirmPassword) return setError('Passwords do not match.')
    setIsSubmitting(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone } },
    })
    if (signUpError) {
      setError(getAuthErrorMessage(signUpError))
      setIsSubmitting(false)
      return
    }
    if (data.session) {
      await navigate({ to: '/app' })
      return
    }
    setConfirmationSent(true)
    setIsSubmitting(false)
  }

  if (confirmationSent) {
    return (
      <CustomerAuthLayout title="Check your email" description="Your account is almost ready.">
        <div className="space-y-5 text-sm leading-6 text-muted-foreground"><div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-foreground">We sent a confirmation link to <strong>{email}</strong>. Confirm your email, then return here to sign in.</div><p>For your security, customer access is enabled after email confirmation.</p><p className="text-center"><Link to="/login" search={{ redirect: undefined }} className="font-semibold text-primary hover:underline">Return to sign in</Link></p></div>
      </CustomerAuthLayout>
    )
  }

  return (
    <CustomerAuthLayout title="Create your account" description="Save your rental details and keep every trip in one place.">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        <div className="space-y-2"><Label htmlFor="full-name">Full name</Label><Input id="full-name" autoComplete="name" required value={fullName} onChange={event => setFullName(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="signup-email">Email address</Label><Input id="signup-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="phone">Phone number</Label><Input id="phone" type="tel" autoComplete="tel" required value={phone} onChange={event => setPhone(event.target.value)} /></div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="signup-password">Password</Label><Input id="signup-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="confirm-password">Confirm password</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></div></div>
        <p className="text-xs leading-5 text-muted-foreground">Your customer role is assigned securely by OCO. It cannot be selected during registration.</p>
        <Button type="submit" disabled={isSubmitting} className="h-11 w-full bg-primary text-primary-foreground hover:bg-primary/90">{isSubmitting ? 'Creating account…' : 'Create account'}</Button>
        <p className="text-center text-sm text-muted-foreground">Already have an account? <Link to="/login" search={{ redirect: undefined }} className="font-semibold text-primary hover:underline">Sign in</Link></p>
      </form>
    </CustomerAuthLayout>
  )
}
