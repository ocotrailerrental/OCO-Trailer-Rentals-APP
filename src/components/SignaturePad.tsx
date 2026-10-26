import { useCallback, useEffect, useRef, useState } from 'react'
import { Eraser, PenLine, Type } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export type SignatureValue = {
  /** Printed name. Always required — the database refuses a signature without it. */
  name: string
  /** How the customer chose to sign. */
  mode: 'draw' | 'type'
  /** PNG data URL of the drawn mark, or null when typing or when nothing is drawn yet. */
  image: string | null
}

export const emptySignature: SignatureValue = { name: '', mode: 'draw', image: null }

/** True once the customer has actually signed, in whichever mode they chose. */
export function isSigned(value: SignatureValue) {
  if (!value.name.trim()) return false
  return value.mode === 'type' || Boolean(value.image)
}

/**
 * The Customer Signature block: sign with a finger, pen or mouse, or type instead.
 *
 * The printed name is always collected, because it is what the agreement's
 * initials blocks are taken from and what the database stores as the signature
 * of record. The drawn mark is stored alongside it as a PNG — it is evidence of
 * the act of signing, not a replacement for the name.
 */
export function SignaturePad({
  value,
  onChange,
  disabled = false,
}: {
  value: SignatureValue
  onChange: (next: SignatureValue) => void
  disabled?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const hasInk = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [, force] = useState(0)

  // Size the backing store to the element so strokes are crisp on high-DPI phones.
  const fitCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    const { width, height } = canvas.getBoundingClientRect()
    if (!width || !height) return
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#16272F'
    // Resizing wipes the canvas, so the stored image no longer matches it.
    hasInk.current = false
  }, [])

  useEffect(() => {
    if (value.mode !== 'draw') return
    fitCanvas()
    // A rotated phone resizes the pad; clearing is honest, silently stretching is not.
    const onResize = () => {
      fitCanvas()
      if (value.image) onChange({ ...value, image: null })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.mode, fitCanvas])

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drawing.current = true
    last.current = point(event)
    const ctx = event.currentTarget.getContext('2d')
    if (ctx && last.current) {
      // A tap leaves a dot rather than nothing.
      ctx.beginPath()
      ctx.arc(last.current.x, last.current.y, 1.1, 0, Math.PI * 2)
      ctx.fillStyle = '#16272F'
      ctx.fill()
      hasInk.current = true
    }
  }

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return
    const ctx = event.currentTarget.getContext('2d')
    if (!ctx) return
    const next = point(event)
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(next.x, next.y)
    ctx.stroke()
    last.current = next
    hasInk.current = true
  }

  const end = () => {
    if (!drawing.current) return
    drawing.current = false
    last.current = null
    const canvas = canvasRef.current
    if (canvas && hasInk.current) onChange({ ...value, image: canvas.toDataURL('image/png') })
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      ctx.save()
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.restore()
    }
    hasInk.current = false
    onChange({ ...value, image: null })
    force(n => n + 1)
  }

  const setMode = (mode: SignatureValue['mode']) => {
    if (mode === value.mode) return
    onChange({ ...value, mode, image: null })
  }

  const today = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <fieldset className="space-y-3" disabled={disabled}>
      <legend className="text-sm font-medium">Customer signature</legend>

      <div className="inline-flex rounded-lg border border-border p-0.5" role="tablist" aria-label="How to sign">
        {(['draw', 'type'] as const).map(mode => (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={value.mode === mode}
            onClick={() => setMode(mode)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${
              value.mode === mode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {mode === 'draw' ? <PenLine className="h-3.5 w-3.5" /> : <Type className="h-3.5 w-3.5" />}
            {mode === 'draw' ? 'Draw' : 'Type'}
          </button>
        ))}
      </div>

      {value.mode === 'draw' ? (
        <div className="space-y-1.5">
          <div className="relative rounded-lg border border-border bg-white">
            <canvas
              ref={canvasRef}
              aria-label="Signature pad. Draw your signature with a finger, pen or mouse."
              className="block h-36 w-full cursor-crosshair touch-none rounded-lg"
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
              onPointerLeave={end}
            />
            <div className="pointer-events-none absolute inset-x-4 bottom-7 border-b border-dashed border-slate-300" />
            <span className="pointer-events-none absolute bottom-2 left-4 text-[11px] text-slate-400">Sign above the line</span>
            <button
              type="button"
              onClick={clear}
              className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs text-slate-500 hover:text-slate-800"
            >
              <Eraser className="h-3.5 w-3.5" /> Clear
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {value.image ? 'Signature captured.' : 'Draw your signature in the box.'} Can't draw?
            Choose Type instead.
          </p>
        </div>
      ) : (
        <div
          className="flex h-24 items-end rounded-lg border border-border bg-white px-4 pb-3 font-serif text-3xl italic text-slate-800"
          aria-live="polite"
        >
          {value.name.trim() || <span className="text-base not-italic text-slate-400">Your typed name appears here as your signature</span>}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="signature-name">Printed full legal name</Label>
          <Input
            id="signature-name"
            autoComplete="name"
            value={value.name}
            maxLength={120}
            onChange={event => onChange({ ...value, name: event.target.value })}
            placeholder="Your full legal name"
          />
        </div>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Date</span>
          <p className="flex h-9 items-center text-sm text-muted-foreground">{today}</p>
        </div>
      </div>
    </fieldset>
  )
}
