import React from 'react'

interface DiacriticBarProps {
  onInsert: (char: string) => void
}

const FRENCH_CHARS = ['é', 'è', 'ê', 'ë', 'à', 'â', 'ç', 'ù', 'û', 'î', 'ï', 'ô', 'œ', '«', '»']

export const DiacriticBar: React.FC<DiacriticBarProps> = ({ onInsert }) => {
  return (
    <div className="flex items-center gap-1.5 flex-wrap py-1.5 px-2 bg-parchment-200 border border-stone-border rounded text-xs select-none">
      <span className="text-ink-500 font-mono text-[11px] mr-1">Ký tự đặc biệt:</span>
      {FRENCH_CHARS.map((char) => (
        <button
          key={char}
          type="button"
          onClick={() => onInsert(char)}
          className="px-2 py-0.5 bg-white hover:bg-parchment-50 active:bg-stone-200 text-ink-900 border border-stone-border rounded font-serif text-sm transition-colors shadow-2xs cursor-pointer"
          title={`Chèn ký tự '${char}'`}
        >
          {char}
        </button>
      ))}
    </div>
  )
}
