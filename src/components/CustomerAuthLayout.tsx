import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OcoLockup } from '@/components/OcoLogo'

export function CustomerAuthLayout({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-sidebar px-5 py-12 text-sidebar-foreground">
      <div className="w-full max-w-md">
        <Link to="/" className="mx-auto mb-8 flex w-fit text-sidebar-foreground" aria-label="OCO Trailer Rentals — home">
          <OcoLockup />
        </Link>
        <Card className="border-sidebar-foreground/10 bg-card text-card-foreground shadow-lg">
          <CardHeader className="space-y-2 px-6 pb-2 pt-6">
            <CardTitle className="font-serif text-3xl">{title}</CardTitle>
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-4">{children}</CardContent>
        </Card>
      </div>
    </main>
  )
}

export function AuthLoading({ label = 'Checking your account…' }: { label?: string }) {
  return (
    <div suppressHydrationWarning className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="text-center">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
        <p suppressHydrationWarning className="mt-4 text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}
