import { useEffect, useState } from 'react'
import { Outlet, createFileRoute, useNavigate } from '@tanstack/react-router'
import { SharedAppLayout } from '@/layouts/shared-app-layout'
import { AuthLoading } from '@/components/CustomerAuthLayout'
import { ClientOnlyBoundary } from '@/components/ClientOnlyBoundary'
import { supabase } from '@/lib/supabase'

/**
 * Customer dashboard shell, mounted at the real `/app` segment.
 *
 * Everything under `src/routes/app/` renders inside this sidebar chrome, and the
 * whole shell is auth-gated here in one place rather than per page. The segment is
 * named rather than pathless on purpose: a `_`-prefixed layout adds no URL segment,
 * so it would collide with the root index route at "/" and fail the build.
 */
export const Route = createFileRoute('/app')({
  component: AppLayout,
})

function AppLayout() {
  return (
    <ClientOnlyBoundary fallback={<AuthLoading />}>
      <AuthenticatedApp />
    </ClientOnlyBoundary>
  )
}

function AuthenticatedApp() {
  const navigate = useNavigate()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    let mounted = true
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      if (!session) {
        navigate({ to: '/login', search: { redirect: undefined }, replace: true })
        return
      }
      setIsChecking(false)
    })
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return
      if (error || !data.session) {
        navigate({ to: '/login', search: { redirect: undefined }, replace: true })
        return
      }
      setIsChecking(false)
    })
    return () => { mounted = false; authListener.subscription.unsubscribe() }
  }, [navigate])

  if (isChecking) return <AuthLoading label="Checking your OCO account…" />
  return <SharedAppLayout appName="OCO Trailer Rentals"><Outlet /></SharedAppLayout>
}
