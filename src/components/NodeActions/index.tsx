import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
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

function RelativeIcon({ kind }: { kind: 'parent' | 'child' }) {
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10" cy="5" r="3" />
      <path d="M10 8v4m-5 0h10m-10 0v4m10-4v4" />
      {kind === 'parent' ? (
        <path d="M19 4v6m-3-3h6" />
      ) : (
        <path d="M19 14v6m-3-3h6" />
      )}
    </svg>
  )
}

const childrenMap: Record<string, ReactNode> = {
  'add-parent': <RelativeIcon kind="parent" />,
  'add-child': <RelativeIcon kind="child" />,
  'add-sibling-left': '⇄',
  'add-sibling-right': '⇄',
  'add-partner-left': '♥',
  'add-partner-right': '♥',
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
  onAddRelative: (kind: RelativeKind, side?: 'left' | 'right') => void
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
  const actionSize = 44
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
      id: 'add-sibling-left',
      kind: 'sibling' as const,
      side: 'left' as const,
      label: t('nodeActions.addSiblingLeft'),
      tooltip: t('nodeActions.addSiblingLeft'),
      placement: 'left' as const,
      left: cardLeft - actionSize,
      top: cardTop + cardHeight / 2 - actionSize - gap / 2,
      disabled: false,
    },
    {
      id: 'add-partner-left',
      kind: 'partner' as const,
      side: 'left' as const,
      label: t('nodeActions.addPartnerLeft'),
      tooltip: t('nodeActions.addPartnerLeft'),
      placement: 'left' as const,
      left: cardLeft - actionSize,
      top: cardTop + cardHeight / 2 + gap / 2,
      disabled: false,
    },
    {
      id: 'add-sibling-right',
      kind: 'sibling' as const,
      side: 'right' as const,
      label: t('nodeActions.addSiblingRight'),
      tooltip: t('nodeActions.addSiblingRight'),
      placement: 'right' as const,
      left: cardLeft + cardWidth,
      top: cardTop + cardHeight / 2 - actionSize - gap / 2,
      disabled: false,
    },
    {
      id: 'add-partner-right',
      kind: 'partner' as const,
      side: 'right' as const,
      label: t('nodeActions.addPartnerRight'),
      tooltip: t('nodeActions.addPartnerRight'),
      placement: 'right' as const,
      left: cardLeft + cardWidth,
      top: cardTop + cardHeight / 2 + gap / 2,
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
          if (button.kind === 'parent' || button.kind === 'child') {
            onAddRelative(button.kind)
          } else {
            onAddRelative(button.kind, button.side)
          }
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
  const moveTriggerRef = useRef<HTMLButtonElement>(null)
  const movePopoverRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!moveOpen) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target
      if (
        target instanceof Node &&
        !moveTriggerRef.current?.contains(target) &&
        !movePopoverRef.current?.contains(target)
      ) {
        setMoveOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () =>
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [moveOpen])
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
            ref={id === 'move' ? moveTriggerRef : undefined}
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
        <div className="node-move-popover" ref={movePopoverRef}>
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
