import { Truck } from 'lucide-react'
import { cn } from '@/lib/utils'

export function TrailerImage({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  if (!src) {
    return (
      <div className={cn('flex items-center justify-center bg-sidebar text-sidebar-foreground', className)} role="img" aria-label={`${alt} — photo coming soon`}>
        <div className="text-center"><Truck className="mx-auto h-10 w-10 text-primary" /><span className="mt-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/60">OCO fleet</span></div>
      </div>
    )
  }
  return <img src={src} alt={alt} className={cn('object-cover', className)} />
}
