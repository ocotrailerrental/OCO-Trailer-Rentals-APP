/**
 * Collapsible SaaS sidebar — OPT-IN (rendered by SharedAppLayout, which the
 * template root does NOT apply by default). Only reach for this when building a
 * SaaS / dashboard app; landing & marketing pages stay full-bleed.
 *
 * Expands to 15rem, collapses to 3rem (icon-only).
 * State is persisted to localStorage. Tooltips appear automatically when collapsed.
 *
 * A native flex-col implementation (shadcn Button/Avatar/Tooltip primitives) for
 * full layout control — every line is yours to edit.
 */
import { useState, useEffect, useCallback } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  LayoutDashboard,
  ClipboardList,
  LogOut,
  PanelLeft,
} from 'lucide-react'
import { OcoMark } from '@/components/OcoLogo'
import { cn } from '@/lib/utils'

const SIDEBAR_KEY = 'sidebar_collapsed'

/** Initials for the avatar: two from the name, else the email's first letter. */
function initialsFor(name: string, email: string) {
  const fromName = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
  if (fromName) return fromName
  return email.trim()[0]?.toUpperCase() ?? '·'
}

interface NavItemDef {
  href: string
  icon: ReactNode
  label: string
}

// Every href here MUST have a real route file, and every page you add under
// `src/routes/app/` should get an entry here — a nav link with no route ships a
// 404. Only the shipped dashboard route is listed; add yours as you create them,
// e.g. `src/routes/app/items.tsx` → { href: '/app/items', label: 'Items' }.
const NAV_ITEMS: NavItemDef[] = [
  { href: '/app', icon: <LayoutDashboard className="h-4 w-4" />, label: 'Dashboard' },
  { href: '/app/reservations', icon: <ClipboardList className="h-4 w-4" />, label: 'My Rentals' },
]

function NavItem({ item, collapsed, pathname }: { item: NavItemDef; collapsed: boolean; pathname: string }) {
  const active = item.href === '/app'
    ? pathname === '/app' || pathname === '/app/'
    : pathname === item.href || pathname.startsWith(`${item.href}/`)

  const link = (
    <a
      href={item.href}
      className={cn(
        'flex items-center gap-2.5 rounded-md text-sm transition-colors cursor-pointer',
        collapsed ? 'justify-center w-8 h-8 mx-auto' : 'px-3 py-2 w-full',
        active
          ? 'bg-accent text-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      <span className="shrink-0">{item.icon}</span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </a>
  )
  if (!collapsed) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}

export function AppSidebarShell() {
  const location = useLocation()
  const pathname = typeof location?.pathname === 'string' ? location.pathname : ''
  // SSR always renders expanded; the saved preference is restored after mount.
  // Reading localStorage in the initializer makes the client's first render
  // differ from the server markup → hydration mismatch on hard refresh.
  const [collapsed, setCollapsed] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-time restore of a persisted preference; reading localStorage in the useState initializer causes an SSR hydration mismatch
    if (localStorage.getItem(SIDEBAR_KEY) === 'true') setCollapsed(true)
  }, [])

  // The signed-in customer. This used to be hard-coded to "User · user@example.com",
  // which shipped placeholder text into a live account page.
  const [account, setAccount] = useState<{ name: string; email: string } | null>(null)
  useEffect(() => {
    let active = true
    void (async () => {
      const { data, error } = await supabase.auth.getUser()
      if (!active || error || !data.user) return
      const email = data.user.email ?? ''
      const { data: profile } = await supabase
        .from('oco_profiles')
        .select('full_name')
        .eq('id', data.user.id)
        .maybeSingle()
      if (!active) return
      setAccount({ name: profile?.full_name?.trim() || '', email })
    })()
    return () => { active = false }
  }, [])

  const displayName = account?.name || (account?.email ? account.email.split('@')[0] : 'Your account')
  const displayEmail = account?.email || 'Loading…'
  const initials = account ? initialsFor(account.name, account.email) : '·'

  const toggle = useCallback(() => {
    setCollapsed(v => {
      const next = !v
      localStorage.setItem(SIDEBAR_KEY, String(next))
      return next
    })
  }, [])

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          'flex flex-col h-full bg-background border-r border-border overflow-hidden',
          'transition-[width] duration-200 ease-linear shrink-0',
          collapsed ? 'w-[3rem]' : 'w-[15rem]'
        )}
      >
        {/* ── Header ────────────────────────────────────── */}
        <div
          className={cn(
            'flex items-center gap-2 shrink-0 border-b border-border h-[52px] px-3',
            collapsed && 'justify-center px-2'
          )}
        >
          {!collapsed && (
            <>
              <OcoMark className="h-7 w-7 shrink-0" />
              <span className="flex-1 font-semibold text-sm truncate">OCO Trailer Rentals</span>
            </>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={toggle}
              >
                <PanelLeft
                  className={cn(
                    'h-4 w-4 transition-transform duration-200',
                    collapsed && 'rotate-180'
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* ── Nav (only this section scrolls) ───────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-0.5">
          {!collapsed && (
            <p className="px-3 pt-1 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Main
            </p>
          )}
          {NAV_ITEMS.map(item => (
            <NavItem key={item.href} item={item} collapsed={collapsed} pathname={pathname} />
          ))}
        </div>

        {/* ── Footer (always pinned to bottom) ──────────── */}
        <div
          className={cn(
            'shrink-0 border-t border-border',
            collapsed ? 'flex flex-col items-center gap-1 p-2' : 'p-3 space-y-1'
          )}
        >
          {/* User row */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <a href="/app" className="flex items-center justify-center h-8 w-8 rounded-md hover:bg-accent transition-colors" aria-label={`Signed in as ${displayName}`}>
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="text-[10px] bg-muted">{initials}</AvatarFallback>
                  </Avatar>
                </a>
              </TooltipTrigger>
              <TooltipContent side="right">{displayName} · {displayEmail}</TooltipContent>
            </Tooltip>
          ) : (
            <a href="/app" className="flex items-center gap-2 rounded-md hover:bg-accent transition-colors w-full px-2 py-1.5">
              <Avatar className="h-6 w-6 shrink-0">
                <AvatarFallback className="text-[10px] bg-muted">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium leading-tight truncate">{displayName}</p>
                <p className="text-[10px] text-muted-foreground leading-tight truncate">
                  {displayEmail}
                </p>
              </div>
            </a>
          )}

          {/* Sign out */}
          {collapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                  onClick={() => { void supabase.auth.signOut() }}
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Sign out</TooltipContent>
            </Tooltip>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start px-2 gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => { void supabase.auth.signOut() }}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              Sign out
            </Button>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
