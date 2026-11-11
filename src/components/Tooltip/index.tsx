interface TooltipProps {
  id: string
  text: string
  side: 'top' | 'bottom' | 'left' | 'right'
  visible: boolean
}

export function Tooltip({ id, text, side, visible }: TooltipProps) {
  if (!visible) return null

  return (
    <span id={id} role="tooltip" className={`tooltip tooltip--${side}`}>
      {text}
    </span>
  )
}
