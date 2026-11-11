import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tooltip } from '../Tooltip'
import { type RelativeKind } from '../../model/tree'

interface NodeActionButtonProps {
  id: string
  tooltip: string
  disabled?: boolean
  placement: 'top' | 'bottom' | 'left' | 'right'
  visible: boolean
  onActivate: (id: string | null) => void
  onClick: () => void
}

function NodeActionButton({
  id,
  tooltip,
  disabled = false,
  placement,
  visible,
  onActivate,
  onClick,
}: NodeActionButtonProps) {
  const holdTimerRef = useRef<number | null>(null)
  const suppressClickRef = useRef(false)

  const clearHold = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  const handlePointerDown = () => {
    if (disabled) return
    clearHold()
    holdTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = true
      onActivate(id)
    }, 400)
  }

  return (
    <div className="node-action-button-wrap">
      <button
        type="button"
        className="icon-pill node-action-button"
        aria-label={tooltip}
        aria-disabled={disabled ? 'true' : undefined}
        aria-describedby={visible ? `${id}-tooltip` : undefined}
        title={tooltip}
        tabIndex={0}
        onMouseEnter={() => onActivate(id)}
        onMouseLeave={() => onActivate(null)}
        onFocus={() => onActivate(id)}
        onBlur={() => onActivate(null)}
        onPointerDown={handlePointerDown}
        onPointerUp={clearHold}
        onPointerLeave={clearHold}
        onPointerCancel={clearHold}
        onClick={() => {
          if (disabled) return
          if (suppressClickRef.current) {
            suppressClickRef.current = false
            return
          }
          onClick()
        }}
      >
        {childrenMap[id] ?? null}
      </button>
      <Tooltip
        id={`${id}-tooltip`}
        text={tooltip}
        side={placement}
        visible={visible}
      />
    </div>
  )
}

const childrenMap: Record<string, string> = {
  'add-parent': '↑',
  'add-child': '↓',
  'add-sibling': '⇄',
  'add-partner': '♥',
  edit: '✎',
  delete: '⌫',
  move: '✦',
}

interface NodeActionsProps {
  selectedName: string
  cardLeft: number
  cardTop: number
  cardWidth: number
  cardHeight: number
  selectedHasTwoParents: boolean
  onAddRelative: (kind: RelativeKind) => void
}

export function NodeActions({
  selectedName,
  cardLeft,
  cardTop,
  cardWidth,
  cardHeight,
  selectedHasTwoParents,
  onAddRelative,
}: NodeActionsProps) {
  const { t } = useTranslation()
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const actionSize = 36
  const gap = 8
  const actionButtons = [
    {
      id: 'add-parent',
      kind: 'parent' as const,
      label: t('nodeActions.addParent'),
      tooltip: selectedHasTwoParents
        ? t('relativeParentDisabled', { name: selectedName })
        : t('nodeActions.addParent'),
      placement: 'top' as const,
      left: cardLeft + cardWidth / 2 - actionSize / 2,
      top: cardTop - gap - actionSize,
      disabled: selectedHasTwoParents,
    },
    {
      id: 'add-sibling',
      kind: 'sibling' as const,
      label: t('nodeActions.addSibling'),
      tooltip: t('nodeActions.addSibling'),
      placement: 'left' as const,
      left: cardLeft - gap - actionSize,
      top: cardTop + cardHeight / 2 - actionSize / 2,
      disabled: false,
    },
    {
      id: 'add-partner',
      kind: 'partner' as const,
      label: t('nodeActions.addPartner'),
      tooltip: t('nodeActions.addPartner'),
      placement: 'right' as const,
      left: cardLeft + cardWidth + gap,
      top: cardTop + cardHeight / 2 - actionSize / 2,
      disabled: false,
    },
    {
      id: 'add-child',
      kind: 'child' as const,
      label: t('nodeActions.addChild'),
      tooltip: t('nodeActions.addChild'),
      placement: 'bottom' as const,
      left: cardLeft + cardWidth / 2 - actionSize / 2,
      top: cardTop + cardHeight + gap,
      disabled: false,
    },
  ]

  return (
    <div
      className="node-actions"
      aria-label={t('nodeActions.groupLabel', { name: selectedName })}
      role="toolbar"
    >
      {actionButtons.map((button) => {
        const visible = activeTooltip === button.id
        const onClickAction = () => {
          if (button.id === 'add-parent') onAddRelative('parent')
          if (button.id === 'add-child') onAddRelative('child')
          if (button.id === 'add-sibling') onAddRelative('sibling')
          if (button.id === 'add-partner') onAddRelative('partner')
        }

        return (
          <div
            key={button.id}
            className="node-action-button-shell"
            style={{
              left: button.left,
              top: button.top,
            }}
          >
            <NodeActionButton
              id={button.id}
              tooltip={button.tooltip}
              disabled={button.disabled}
              placement={button.placement}
              visible={visible}
              onActivate={(value) => {
                if (value === button.id) {
                  setActiveTooltip(button.id)
                  return
                }
                if (activeTooltip === button.id) {
                  setActiveTooltip(null)
                }
              }}
              onClick={onClickAction}
            />
          </div>
        )
      })}
    </div>
  )
}

interface InlineNodeControlsProps {
  personId: string
  personName: string
  currentLevel: number
  selectedLevels: Array<{
    layer: number
    onlyThisPersonValid: boolean
    withConnectedPeopleValid: boolean
  }>
  canMoveLeft: boolean
  canMoveRight: boolean
  onEdit: () => void
  onDelete: () => void
  onMoveOpen: () => void
  moveDirection: (direction: 'up' | 'down' | 'left' | 'right') => void
}

export function InlineNodeControls({
  personId,
  personName,
  currentLevel,
  selectedLevels,
  canMoveLeft,
  canMoveRight,
  onEdit,
  onDelete,
  onMoveOpen,
  moveDirection,
}: InlineNodeControlsProps) {
  const { t } = useTranslation()
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const [moveOpen, setMoveOpen] = useState(false)
  const moveButtonDefs = [
    ['up', '↑', 'layers.up'],
    ['down', '↓', 'layers.down'],
    ['left', '←', 'layers.left'],
    ['right', '→', 'layers.right'],
  ] as const
  const actionDefs = [
    { id: 'edit', label: t('nodeActions.edit'), icon: '✎', onClick: onEdit },
    {
      id: 'delete',
      label: t('nodeActions.delete'),
      icon: '⌫',
      onClick: onDelete,
    },
    {
      id: 'move',
      label: t('nodeActions.move'),
      icon: '✦',
      onClick: () => {
        onMoveOpen()
        setMoveOpen((open) => !open)
      },
    },
  ]

  return (
    <div
      className="person-card__controls"
      role="toolbar"
      aria-label={t('nodeActions.groupLabel', { name: personName })}
    >
      {actionDefs.map(({ id, label, icon, onClick }) => (
        <div className="person-card__control-wrap" key={id}>
          <button
            type="button"
            className={`icon-pill person-card__control person-card__control--${id}`}
            aria-label={label}
            aria-expanded={id === 'move' ? moveOpen : undefined}
            aria-haspopup={id === 'move' ? 'true' : undefined}
            aria-describedby={
              activeTooltip === id ? `${personId}-${id}-tooltip` : undefined
            }
            title={label}
            onMouseEnter={() => setActiveTooltip(id)}
            onMouseLeave={() => setActiveTooltip(null)}
            onFocus={() => setActiveTooltip(id)}
            onBlur={() => setActiveTooltip(null)}
            onClick={(event) => {
              event.stopPropagation()
              onClick()
            }}
          >
            <span aria-hidden="true">{icon}</span>
          </button>
          <Tooltip
            id={`${personId}-${id}-tooltip`}
            text={label}
            side="bottom"
            visible={activeTooltip === id}
          />
        </div>
      ))}
      {moveOpen && (
        <div className="node-move-popover">
          <div className="node-move-popover__label">
            {t('layers.level', { level: currentLevel + 1 })}
          </div>
          <div className="node-move-popover__row">
            {moveButtonDefs.map(([direction, icon, key]) => {
              const targetLayer =
                currentLevel +
                (direction === 'up' ? -1 : direction === 'down' ? 1 : 0)
              const enabled =
                direction === 'left'
                  ? canMoveLeft
                  : direction === 'right'
                    ? canMoveRight
                    : selectedLevels.some(
                        ({
                          layer,
                          onlyThisPersonValid,
                          withConnectedPeopleValid,
                        }) =>
                          layer === targetLayer &&
                          (onlyThisPersonValid || withConnectedPeopleValid),
                      )

              return (
                <button
                  key={direction}
                  type="button"
                  className="icon-pill node-move-button"
                  aria-label={t(key)}
                  title={t(key)}
                  aria-disabled={enabled ? undefined : 'true'}
                  tabIndex={enabled ? 0 : -1}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (!enabled) return
                    moveDirection(direction)
                    setMoveOpen(false)
                  }}
                >
                  <span aria-hidden="true">{icon}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
