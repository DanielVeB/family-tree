import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { computeLayout, type Point } from '../layout/computeLayout'
import {
  getDisplayName,
  type FamilyTree,
  type PersonName,
  type PersonNode,
} from '../model/tree'

type RelativeKind = 'parent' | 'child' | 'sibling' | 'partner'
interface TreeViewProps {
  tree: FamilyTree
  selectedId: string | null
  onSelect: (id: string | null) => void
  onAddRelative: (
    selectedId: string,
    relation: RelativeKind,
    name: PersonName,
  ) => void
}

const relationButtons: Array<{ kind: RelativeKind; label: string }> = [
  { kind: 'parent', label: 'addParent' },
  { kind: 'child', label: 'addChild' },
  { kind: 'sibling', label: 'addSibling' },
  { kind: 'partner', label: 'addPartner' },
]
const relationGroups = [
  { type: 'parents', label: 'parents' },
  { type: 'children', label: 'children' },
  { type: 'siblings', label: 'siblings' },
  { type: 'partners', label: 'partners' },
] as const
const minZoom = 0.25
const maxZoom = 2

export default function TreeView({
  tree,
  selectedId,
  onSelect,
  onAddRelative,
}: TreeViewProps) {
  const { t } = useTranslation()
  const [cardWidth, setCardWidth] = useState(
    window.innerWidth < 640 ? 160 : 200,
  )
  const layout = useMemo(
    () => computeLayout(tree, cardWidth),
    [tree, cardWidth],
  )
  const canvasRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 })
  const userMovedRef = useRef(false)
  const pointerMovedRef = useRef(false)
  const previousTreeRef = useRef<FamilyTree | null>(null)
  const pointers = useRef(new Map<number, Point>())
  const panStart = useRef<{ pointer: Point; viewport: typeof viewport } | null>(
    null,
  )
  const pinchStart = useRef<{
    distance: number
    midpoint: Point
    viewport: typeof viewport
  } | null>(null)
  const [relativeForm, setRelativeForm] = useState<RelativeKind | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [formError, setFormError] = useState('')
  const [formErrorField, setFormErrorField] = useState<
    'firstName' | 'lastName' | null
  >(null)
  const relativeFirstNameRef = useRef<HTMLInputElement>(null)
  const formWasOpenRef = useRef(false)

  const selectedPerson = tree.nodes.find((node) => node.id === selectedId)
  const selectedName = selectedPerson ? getDisplayName(selectedPerson) : ''

  const fitToScreen = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || tree.nodes.length === 0) return
    const { width, height } = canvas.getBoundingClientRect()
    const scale = Math.min(
      maxZoom,
      (width - 48) / layout.width,
      (height - 48) / layout.height,
    )
    const fittedScale = Math.max(minZoom, scale)
    setViewport({
      scale: fittedScale,
      x: (width - layout.width * fittedScale) / 2,
      y: (height - layout.height * fittedScale) / 2,
    })
  }, [layout, tree.nodes.length])

  useEffect(() => {
    if (tree !== previousTreeRef.current) {
      if (previousTreeRef.current && userMovedRef.current && selectedId) {
        const canvas = canvasRef.current
        const point = layout.positions[selectedId]
        if (canvas && point) {
          const { width, height } = canvas.getBoundingClientRect()
          setViewport((current) => {
            let x = current.x
            let y = current.y
            const left = x + point.x * current.scale
            const top = y + point.y * current.scale
            const right = left + cardWidth * current.scale
            const bottom = top + 88 * current.scale
            if (right > width - 24) x -= right - width + 24
            if (left < 24) x += 24 - left
            if (bottom > height - 24) y -= bottom - height + 24
            if (top < 24) y += 24 - top
            return { ...current, x, y }
          })
        }
      } else {
        fitToScreen()
      }
      previousTreeRef.current = tree
      userMovedRef.current = false
    }
  }, [tree, selectedId, layout, cardWidth, fitToScreen])

  useEffect(() => {
    const onResize = () => setCardWidth(window.innerWidth < 640 ? 160 : 200)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !canvasRef.current) return
    const observer = new ResizeObserver(() => {
      if (!userMovedRef.current) fitToScreen()
    })
    observer.observe(canvasRef.current)
    return () => observer.disconnect()
  }, [fitToScreen])

  useEffect(() => {
    if (relativeForm) {
      formWasOpenRef.current = true
      relativeFirstNameRef.current?.focus()
    } else if (formWasOpenRef.current) {
      formWasOpenRef.current = false
      if (selectedId) {
        window.requestAnimationFrame(() =>
          document.getElementById(`person-${selectedId}`)?.focus(),
        )
      }
    }
  }, [relativeForm, selectedId])

  const closeDetail = useCallback(() => {
    const closingId = selectedId
    setRelativeForm(null)
    onSelect(null)
    if (closingId) {
      window.requestAnimationFrame(() =>
        document.getElementById(`person-${closingId}`)?.focus(),
      )
    }
  }, [onSelect, selectedId])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (relativeForm) {
        setRelativeForm(null)
        setFormError('')
        setFormErrorField(null)
        setFirstName('')
        setLastName('')
        return
      }
      if (selectedId) closeDetail()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [relativeForm, selectedId, closeDetail])

  function submitRelative(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedFirstName = firstName.trim()
    if (!trimmedFirstName) {
      setFormError('required')
      setFormErrorField('firstName')
      relativeFirstNameRef.current?.focus()
      return
    }
    if (trimmedFirstName.length > 100) {
      setFormError('tooLong')
      setFormErrorField('firstName')
      return
    }
    if (lastName.trim().length > 100) {
      setFormError('tooLong')
      setFormErrorField('lastName')
      return
    }
    if (!selectedId || !relativeForm) return
    onAddRelative(selectedId, relativeForm, {
      firstName: trimmedFirstName,
      lastName: lastName.trim(),
    })
    setFirstName('')
    setLastName('')
    setFormError('')
    setFormErrorField(null)
    setRelativeForm(null)
  }

  const pointerPosition = (event: ReactPointerEvent<HTMLDivElement>) => ({
    x: event.clientX - event.currentTarget.getBoundingClientRect().left,
    y: event.clientY - event.currentTarget.getBoundingClientRect().top,
  })

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (
      event.target instanceof Element &&
      event.target.closest('.person-card, .canvas-controls')
    )
      return
    event.currentTarget.setPointerCapture(event.pointerId)
    if (pointers.current.size === 0) pointerMovedRef.current = false
    pointers.current.set(event.pointerId, pointerPosition(event))
    if (pointers.current.size === 1) {
      panStart.current = { pointer: pointerPosition(event), viewport }
    } else if (pointers.current.size === 2) {
      const points = [...pointers.current.values()]
      pinchStart.current = {
        distance: distance(points[0]!, points[1]!),
        midpoint: midpoint(points[0]!, points[1]!),
        viewport,
      }
    }
  }

  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return
    const point = pointerPosition(event)
    const previousPoint = pointers.current.get(event.pointerId)!
    if (
      Math.abs(point.x - previousPoint.x) > 4 ||
      Math.abs(point.y - previousPoint.y) > 4
    ) {
      pointerMovedRef.current = true
    }
    pointers.current.set(event.pointerId, point)
    if (pointers.current.size >= 2 && pinchStart.current) {
      const points = [...pointers.current.values()]
      const start = pinchStart.current
      const newMidpoint = midpoint(points[0]!, points[1]!)
      const scale = clamp(
        start.viewport.scale *
          (distance(points[0]!, points[1]!) / start.distance),
      )
      const worldX =
        (start.midpoint.x - start.viewport.x) / start.viewport.scale
      const worldY =
        (start.midpoint.y - start.viewport.y) / start.viewport.scale
      setViewport({
        scale,
        x: newMidpoint.x - worldX * scale,
        y: newMidpoint.y - worldY * scale,
      })
      userMovedRef.current = true
    } else if (panStart.current) {
      setViewport({
        ...panStart.current.viewport,
        x: panStart.current.viewport.x + point.x - panStart.current.pointer.x,
        y: panStart.current.viewport.y + point.y - panStart.current.pointer.y,
      })
      userMovedRef.current = true
    }
  }

  function pointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinchStart.current = null
    if (pointers.current.size === 0) panStart.current = null
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    const bounds = event.currentTarget.getBoundingClientRect()
    const cursor = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    }
    setViewport((current) => {
      const scale = clamp(current.scale * (event.deltaY < 0 ? 1.1 : 0.9))
      const ratio = scale / current.scale
      return {
        scale,
        x: cursor.x - (cursor.x - current.x) * ratio,
        y: cursor.y - (cursor.y - current.y) * ratio,
      }
    })
    userMovedRef.current = true
  }

  function zoomBy(factor: number) {
    const canvas = canvasRef.current
    if (!canvas) return
    const bounds = canvas.getBoundingClientRect()
    const center = { x: bounds.width / 2, y: bounds.height / 2 }
    setViewport((current) => {
      const scale = clamp(current.scale * factor)
      const ratio = scale / current.scale
      return {
        scale,
        x: center.x - (center.x - current.x) * ratio,
        y: center.y - (center.y - current.y) * ratio,
      }
    })
    userMovedRef.current = true
  }

  function deselectFromCanvas(event: React.MouseEvent<HTMLDivElement>) {
    if (pointerMovedRef.current) {
      pointerMovedRef.current = false
      return
    }
    if (
      selectedId &&
      event.target instanceof Element &&
      !event.target.closest('.person-card, .canvas-controls, .detail-panel')
    ) {
      closeDetail()
    }
  }

  return (
    <div
      className={`tree-workspace${selectedPerson ? ' tree-workspace--detail-open' : ''}`}
    >
      <div
        ref={canvasRef}
        className="tree-canvas"
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerUp}
        onPointerCancel={pointerUp}
        onWheel={handleWheel}
        onClick={deselectFromCanvas}
        aria-label={t('treeCanvas')}
      >
        <div
          className="tree-surface"
          style={{
            width: layout.width,
            height: layout.height,
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          }}
        >
          <svg
            className="tree-lines"
            width={layout.width}
            height={layout.height}
            aria-hidden="true"
          >
            {layout.edgePaths.map(({ edge, path }, index) => (
              <path
                key={`${edge.type}-${edge.from}-${edge.to}-${index}`}
                d={path}
              />
            ))}
          </svg>
          {tree.nodes.map((person) => {
            const point = layout.positions[person.id]
            return (
              <PersonCard
                key={person.id}
                person={person}
                point={point}
                selected={selectedId === person.id}
                width={cardWidth}
                onSelect={() => {
                  setRelativeForm(null)
                  setFirstName('')
                  setLastName('')
                  setFormError('')
                  setFormErrorField(null)
                  onSelect(person.id)
                }}
              />
            )
          })}
        </div>
        <div
          className="canvas-controls"
          role="group"
          aria-label={t('canvasControls')}
        >
          <button
            type="button"
            className="icon-pill"
            aria-label={t('zoomIn')}
            onClick={() => zoomBy(1.2)}
          >
            +
          </button>
          <button
            type="button"
            className="icon-pill"
            aria-label={t('zoomOut')}
            onClick={() => zoomBy(1 / 1.2)}
          >
            −
          </button>
          <button
            type="button"
            className="icon-pill icon-pill--fit"
            aria-label={t('fitToScreen')}
            onClick={() => {
              fitToScreen()
              userMovedRef.current = true
            }}
          >
            ↔
          </button>
        </div>
      </div>

      {selectedPerson && (
        <aside className="panel detail-panel" aria-label={selectedName}>
          <button
            type="button"
            className="icon-pill detail-panel__close"
            aria-label={t('close')}
            onClick={closeDetail}
          >
            ×
          </button>
          {relativeForm ? (
            <RelativeForm
              relation={relativeForm}
              name={selectedName}
              firstName={firstName}
              lastName={lastName}
              error={formError}
              errorField={formErrorField}
              firstNameRef={relativeFirstNameRef}
              onFirstName={(value) => {
                setFirstName(value)
                setFormError('')
                setFormErrorField(null)
              }}
              onLastName={(value) => {
                setLastName(value)
                setFormError('')
                setFormErrorField(null)
              }}
              onSubmit={submitRelative}
              onCancel={() => {
                setRelativeForm(null)
                setFirstName('')
                setLastName('')
                setFormError('')
                setFormErrorField(null)
              }}
            />
          ) : (
            <>
              <h2 className="detail-panel__name">{selectedName}</h2>
              <Relations tree={tree} person={selectedPerson} />
              <h3>{t('addRelative')}</h3>
              <div className="relative-actions">
                {relationButtons.map(({ kind, label }) => (
                  <button
                    className="button button--ghost"
                    type="button"
                    key={kind}
                    onClick={() => {
                      setFirstName('')
                      setLastName('')
                      setFormError('')
                      setFormErrorField(null)
                      setRelativeForm(kind)
                    }}
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
            </>
          )}
        </aside>
      )}
    </div>
  )
}

function PersonCard({
  person,
  point,
  selected,
  width,
  onSelect,
}: {
  person: PersonNode
  point: Point | undefined
  selected: boolean
  width: number
  onSelect: () => void
}) {
  const name = getDisplayName(person)
  const initials =
    `${person.data.firstName.charAt(0)}${(person.data.lastName ?? '').charAt(0)}`.toLocaleUpperCase()
  if (!point) return null
  return (
    <button
      id={`person-${person.id}`}
      type="button"
      className={`person-card${selected ? ' person-card--selected' : ''}`}
      style={{ left: point.x, top: point.y, width }}
      aria-label={name}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="person-card__avatar" aria-hidden="true">
        {initials}
      </span>
      <span className="person-card__name" title={name}>
        {name}
      </span>
    </button>
  )
}

function Relations({ tree, person }: { tree: FamilyTree; person: PersonNode }) {
  const { t } = useTranslation()
  const relations: Record<(typeof relationGroups)[number]['type'], string[]> = {
    parents: [],
    children: [],
    siblings: [],
    partners: [],
  }
  for (const edge of tree.edges) {
    if (edge.type === 'child') {
      if (edge.to === person.id) relations.parents.push(edge.from)
      if (edge.from === person.id) relations.children.push(edge.to)
    } else if (edge.type === 'sibling') {
      if (edge.from === person.id) relations.siblings.push(edge.to)
      if (edge.to === person.id) relations.siblings.push(edge.from)
    } else {
      if (edge.from === person.id) relations.partners.push(edge.to)
      if (edge.to === person.id) relations.partners.push(edge.from)
    }
  }
  return (
    <div className="relations">
      {relationGroups.map(({ type, label }) => {
        const names = relations[type]
          .map((id) => tree.nodes.find((node) => node.id === id))
          .filter((node): node is PersonNode => Boolean(node))
          .map(getDisplayName)
        if (!names.length) return null
        return (
          <section className="relations__group" key={type}>
            <h3>{t(label)}</h3>
            <ul>
              {names.map((name, index) => (
                <li key={`${name}-${index}`}>{name}</li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function RelativeForm({
  relation,
  name,
  firstName,
  lastName,
  error,
  errorField,
  firstNameRef,
  onFirstName,
  onLastName,
  onSubmit,
  onCancel,
}: {
  relation: RelativeKind
  name: string
  firstName: string
  lastName: string
  error: string
  errorField: 'firstName' | 'lastName' | null
  firstNameRef: React.RefObject<HTMLInputElement | null>
  onFirstName: (value: string) => void
  onLastName: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const relationTranslation: Record<RelativeKind, string> = {
    parent: t('parentRelation'),
    child: t('childRelation'),
    sibling: t('siblingRelation'),
    partner: t('partnerRelation'),
  }
  return (
    <>
      <h2 className="detail-panel__form-title">
        {t('addTo', { relation: relationTranslation[relation], name })}
      </h2>
      <form onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="relative-first-name">{t('firstName')}</label>
          <input
            id="relative-first-name"
            ref={firstNameRef}
            autoComplete="given-name"
            maxLength={101}
            value={firstName}
            aria-invalid={errorField === 'firstName'}
            aria-describedby={
              errorField === 'firstName'
                ? 'relative-first-name-error'
                : undefined
            }
            onChange={(event) => onFirstName(event.target.value)}
          />
          {error && errorField === 'firstName' && (
            <span
              className="field__error"
              id="relative-first-name-error"
              role="alert"
            >
              {error === 'required'
                ? t('firstNameRequired')
                : t('nameTooLong', { max: 100 })}
            </span>
          )}
        </div>
        <div className="field">
          <label htmlFor="relative-last-name">{t('lastName')}</label>
          <input
            id="relative-last-name"
            autoComplete="family-name"
            maxLength={101}
            value={lastName}
            aria-invalid={errorField === 'lastName'}
            aria-describedby={
              errorField === 'lastName' ? 'relative-last-name-error' : undefined
            }
            onChange={(event) => onLastName(event.target.value)}
          />
          {error && errorField === 'lastName' && (
            <span
              className="field__error"
              id="relative-last-name-error"
              role="alert"
            >
              {t('nameTooLong', { max: 100 })}
            </span>
          )}
        </div>
        <div className="form-actions">
          <button className="button button--primary" type="submit">
            {t('save')}
          </button>
          <button
            className="button button--ghost"
            type="button"
            onClick={onCancel}
          >
            {t('cancel')}
          </button>
        </div>
      </form>
    </>
  )
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

function clamp(value: number) {
  return Math.max(minZoom, Math.min(maxZoom, value))
}
