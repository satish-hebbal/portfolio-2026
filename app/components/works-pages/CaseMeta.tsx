// The project facts strip under every case study header. One layout for all
// case studies: label above value, scope as a wrapping list, optional status.

type Item = { label: string; value: string }

const font = { fontFamily: 'FunnelDisplay, sans-serif' }

export default function CaseMeta({ items, scope, status }: { items: Item[]; scope: string[]; status?: string }) {
  const cells = [...items, { label: 'Scope', value: scope.join(' · ') }]
  return (
    <div className="relative flex flex-col md:flex-row items-stretch border-b border-gray-200">
      {cells.map((item, i) => (
        <div
          key={item.label}
          className={`flex flex-row md:flex-col items-baseline md:items-start gap-3 md:gap-1 px-6 md:px-8 py-3 md:py-4 ${
            item.label === 'Scope' ? 'md:flex-1 min-w-0' : 'md:shrink-0'
          } ${i > 0 ? 'border-t md:border-t-0 md:border-l border-gray-200' : ''}`}
        >
          <span className="text-[9px] uppercase tracking-widest text-gray-500 shrink-0 w-20 md:w-auto" style={font}>{item.label}</span>
          <span className="text-xs text-gray-800 leading-relaxed" style={font}>{item.value}</span>
        </div>
      ))}
      {status && (
        <div className="flex items-center px-6 md:px-8 py-3 border-t md:border-t-0 md:border-l border-gray-200">
          <span className="flex items-center gap-2">
            <span className="relative flex items-center justify-center w-2 h-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: '#22c55e' }} />
              <span className="relative inline-flex rounded-full w-2 h-2" style={{ background: '#22c55e' }} />
            </span>
            <span className="text-xs text-gray-800 whitespace-nowrap" style={font}>{status}</span>
          </span>
        </div>
      )}
    </div>
  )
}
