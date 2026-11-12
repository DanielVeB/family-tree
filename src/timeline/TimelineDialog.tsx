import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { formatPartialDate } from '../model/dates'
import type { FamilyTree } from '../model/tree'
import { getTimelineEvents, type TimelineEvent } from './timeline'

interface TimelineDialogProps {
  tree: FamilyTree
  onClose: () => void
}

type TransitionPhase = 'idle' | 'exiting' | 'entering'
type TransitionIntent = 'next' | 'prev' | 'jump' | 'autoplay'

const EXIT_TRANSITION_MS = 180
const ENTER_TRANSITION_MS = 260

function getEventDescription(event: TimelineEvent, t: TFunction): string {
  if (event.type === 'marriage') {
    return t('timeline.event.marriage', {
      first: event.people[0] ?? '',
      second: event.people[1] ?? '',
    })
  }
  return t(`timeline.event.${event.type}`, {
    name: event.people[0] ?? '',
  })
}

function getEventIcon(type: TimelineEvent['type']): string {
  if (type === 'birth') return '✶'
  if (type === 'death') return '✝'
  return '♡'
}

function getInitialReducedMotionPreference(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function TimelineDialog({ tree, onClose }: TimelineDialogProps) {
  const { t, i18n } = useTranslation()
  const events = useMemo(() => getTimelineEvents(tree), [tree])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [manualAnnouncement, setManualAnnouncement] = useState('')
  const [transitionPhase, setTransitionPhase] =
    useState<TransitionPhase>('idle')
  const [transitionIntent, setTransitionIntent] =
    useState<TransitionIntent>('jump')
  const [pendingIndex, setPendingIndex] = useState<number | null>(null)
  const [pendingAnnouncement, setPendingAnnouncement] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    getInitialReducedMotionPreference,
  )
  const dialogRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const previouslyFocusedRef = useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  )

  const hasEvents = events.length > 0
  const lastIndex = events.length - 1
  const currentEvent = events[currentIndex]
  const description = currentEvent ? getEventDescription(currentEvent, t) : ''
  const formattedDate = currentEvent
    ? formatPartialDate(currentEvent.date, i18n.language)
    : ''

  useEffect(() => {
    const previouslyFocused = previouslyFocusedRef.current
    contentRef.current?.focus()
    return () => previouslyFocused?.focus()
  }, [])

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (event: MediaQueryListEvent) =>
      setPrefersReducedMotion(event.matches)
    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [])

  const announceCurrentEvent = useCallback(
    (index: number) => {
      const event = events[index]
      if (!event) return
      setManualAnnouncement(
        `${getEventDescription(event, t)}. ${formatPartialDate(event.date, i18n.language)}`,
      )
    },
    [events, i18n.language, t],
  )

  const moveToIndex = useCallback(
    (
      index: number,
      intent: TransitionIntent,
      options: { pausePlayback: boolean; announce: boolean },
    ) => {
      const nextIndex = Math.max(0, Math.min(index, lastIndex))
      if (options.pausePlayback) {
        setIsPlaying(false)
      }
      if (nextIndex === currentIndex && transitionPhase === 'idle') return
      setTransitionIntent(intent)

      if (prefersReducedMotion || transitionPhase !== 'idle') {
        setTransitionPhase('idle')
        setPendingIndex(null)
        setCurrentIndex(nextIndex)
        if (options.announce) announceCurrentEvent(nextIndex)
        window.requestAnimationFrame(() => contentRef.current?.focus())
        return
      }

      setPendingIndex(nextIndex)
      setPendingAnnouncement(options.announce)
      setTransitionPhase('exiting')
    },
    [
      announceCurrentEvent,
      currentIndex,
      lastIndex,
      prefersReducedMotion,
      transitionPhase,
    ],
  )

  useEffect(() => {
    if (transitionPhase !== 'exiting' || pendingIndex === null) return
    const timer = window.setTimeout(() => {
      setCurrentIndex(pendingIndex)
      if (pendingAnnouncement) {
        announceCurrentEvent(pendingIndex)
      }
      if (transitionIntent === 'autoplay' && pendingIndex >= lastIndex) {
        setIsPlaying(false)
      }
      setTransitionPhase('entering')
    }, EXIT_TRANSITION_MS)
    return () => window.clearTimeout(timer)
  }, [
    announceCurrentEvent,
    lastIndex,
    pendingAnnouncement,
    pendingIndex,
    transitionIntent,
    transitionPhase,
  ])

  useEffect(() => {
    if (transitionPhase !== 'entering') return
    const timer = window.setTimeout(() => {
      setTransitionPhase('idle')
      setPendingIndex(null)
      setPendingAnnouncement(false)
      contentRef.current?.focus()
    }, ENTER_TRANSITION_MS)
    return () => window.clearTimeout(timer)
  }, [transitionPhase])

  useEffect(() => {
    if (!isPlaying || !hasEvents) return
    const timer = window.setInterval(() => {
      if (transitionPhase !== 'idle') return
      if (currentIndex >= lastIndex) {
        setIsPlaying(false)
        return
      }
      moveToIndex(currentIndex + 1, 'autoplay', {
        pausePlayback: false,
        announce: false,
      })
    }, 5000)
    return () => window.clearInterval(timer)
  }, [
    currentIndex,
    hasEvents,
    isPlaying,
    lastIndex,
    moveToIndex,
    transitionPhase,
  ])

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key === 'Tab') {
      const focusableElements =
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        )
      if (!focusableElements?.length) {
        event.preventDefault()
        return
      }
      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
      return
    }

    const target = event.target
    if (
      target instanceof HTMLElement &&
      target.closest(
        'input, select, textarea, [contenteditable="true"], [role="slider"], [role="listbox"]',
      )
    ) {
      return
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      moveToIndex(currentIndex - 1, 'prev', {
        pausePlayback: true,
        announce: true,
      })
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      moveToIndex(currentIndex + 1, 'next', {
        pausePlayback: true,
        announce: true,
      })
    }
  }

  function togglePlayback() {
    if (!hasEvents) return
    if (isPlaying) {
      setIsPlaying(false)
      return
    }
    if (currentIndex === lastIndex) {
      moveToIndex(0, 'jump', { pausePlayback: false, announce: false })
    }
    setManualAnnouncement('')
    setIsPlaying(true)
  }

  return (
    <div className="dialog-backdrop timeline-backdrop">
      <div
        ref={dialogRef}
        className="panel timeline-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="timeline-title"
        onKeyDown={handleKeyDown}
      >
        <div className="timeline-dialog__header">
          <h2 id="timeline-title">{t('timeline.title')}</h2>
          <button
            className="icon-pill"
            type="button"
            aria-label={t('close')}
            onClick={onClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        {hasEvents && currentEvent ? (
          <>
            <div
              key={`${currentEvent.type}-${currentEvent.date}-${currentIndex}`}
              ref={contentRef}
              className={`timeline-dialog__event timeline-dialog__event--${currentEvent.type} timeline-dialog__event--${transitionPhase} timeline-dialog__event--intent-${transitionIntent}`}
              tabIndex={-1}
              aria-describedby="timeline-date"
            >
              <span className="timeline-dialog__marker" aria-hidden="true">
                <span className="timeline-dialog__marker-icon">
                  {getEventIcon(currentEvent.type)}
                </span>
              </span>
              <p className="timeline-dialog__description">{description}</p>
              <time
                id="timeline-date"
                className="timeline-dialog__date"
                dateTime={currentEvent.date}
              >
                {formattedDate}
              </time>
            </div>
            <p className="timeline-dialog__progress">
              {t('timeline.progress', {
                current: new Intl.NumberFormat(i18n.language).format(
                  currentIndex + 1,
                ),
                total: new Intl.NumberFormat(i18n.language).format(
                  events.length,
                ),
              })}
            </p>
            <div className="timeline-dialog__controls">
              <button
                className="button button--ghost"
                type="button"
                aria-label={t('timeline.previous')}
                disabled={currentIndex === 0 || transitionPhase !== 'idle'}
                onClick={() =>
                  moveToIndex(currentIndex - 1, 'prev', {
                    pausePlayback: true,
                    announce: true,
                  })
                }
              >
                {t('timeline.previous')}
              </button>
              <button
                className="button button--primary"
                type="button"
                aria-label={
                  isPlaying ? t('timeline.pause') : t('timeline.play')
                }
                onClick={togglePlayback}
              >
                {isPlaying ? t('timeline.pause') : t('timeline.play')}
              </button>
              <button
                className="button button--ghost"
                type="button"
                aria-label={t('timeline.next')}
                disabled={
                  currentIndex === lastIndex || transitionPhase !== 'idle'
                }
                onClick={() =>
                  moveToIndex(currentIndex + 1, 'next', {
                    pausePlayback: true,
                    announce: true,
                  })
                }
              >
                {t('timeline.next')}
              </button>
            </div>
            <span className="visually-hidden" role="status" aria-live="polite">
              {manualAnnouncement}
            </span>
          </>
        ) : (
          <div
            ref={contentRef}
            className="timeline-dialog__empty"
            tabIndex={-1}
          >
            <p>{t('timeline.empty')}</p>
            <button
              className="button button--ghost"
              type="button"
              onClick={onClose}
            >
              {t('close')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
