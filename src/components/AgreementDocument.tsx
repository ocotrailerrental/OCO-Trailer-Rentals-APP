/**
 * Renders a rental agreement's stored markdown — the checkout preview or a signed
 * snapshot — with the `[[SIGNATURE:CUSTOMER]]` and `[[SIGNATURE:OCO]]` markers
 * turned into real signature blocks.
 *
 * Deliberately not a markdown library: the text is written by an administrator,
 * and rendering it as HTML would turn the agreement editor into a way to inject
 * script into a checkout page. Headings, rules and paragraphs are all it needs.
 */

export type SignatureBlockData = {
  name?: string | null
  image?: string | null
  signedAt?: string | null
}

const CUSTOMER_MARKER = '[[SIGNATURE:CUSTOMER]]'
const OCO_MARKER = '[[SIGNATURE:OCO]]'

export function AgreementDocument({
  markdown,
  customer,
  oco,
}: {
  markdown: string
  customer?: SignatureBlockData
  oco?: SignatureBlockData
}) {
  const blocks = markdown.split(/\n{2,}/)
  return (
    <div className="space-y-3">
      {blocks.map((block, index) => {
        const trimmed = block.trim()
        if (trimmed === CUSTOMER_MARKER) {
          return <SignatureBlock key={index} title="Customer signature" data={customer} />
        }
        if (trimmed === OCO_MARKER) {
          return (
            <SignatureBlock
              key={index}
              title="OCO representative signature"
              data={oco}
              pendingText="Countersigned at collection"
            />
          )
        }
        const heading = trimmed.match(/^#{1,6}\s+(.*)$/)
        if (heading) {
          return (
            <h3 key={index} className="font-serif text-base font-semibold">
              {stripEmphasis(heading[1])}
            </h3>
          )
        }
        if (trimmed === '---') return <hr key={index} className="border-border" />
        if (!trimmed) return null
        return (
          <p key={index} className="text-muted-foreground">
            {stripEmphasis(trimmed)}
          </p>
        )
      })}
    </div>
  )
}

function SignatureBlock({
  title,
  data,
  pendingText = 'Not yet signed',
}: {
  title: string
  data?: SignatureBlockData
  pendingText?: string
}) {
  const name = data?.name?.trim()
  const date = data?.signedAt
    ? new Date(data.signedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="mt-2 flex h-16 items-end border-b border-border pb-1">
        {data?.image ? (
          <img src={data.image} alt={`Signature of ${name ?? 'signer'}`} className="max-h-14 max-w-full object-contain" />
        ) : name ? (
          <span className="font-serif text-2xl italic text-foreground">{name}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{pendingText}</span>
        )}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <span>Printed name: {name || '—'}</span>
        <span>Date: {date ?? '—'}</span>
      </div>
    </div>
  )
}

const stripEmphasis = (text: string) =>
  text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
