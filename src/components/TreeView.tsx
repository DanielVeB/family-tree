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
import DeletePersonDialog from './DeletePersonDialog'
import { InlineNodeControls, NodeActions } from './NodeActions'
import {
  computeLayout,
  LAYOUT_SPACING,
  type Point,
} from '../layout/computeLayout'
import {
  getDeletePreview,
  getConnectedParts,
  getMoveLevelAvailability,
  getConnectionQuestions,
  getDefaultConnectionAnswers,
  getDisplayName,
  getParentCount,
  moveOne,
  TreeOperationError,
  type FamilyTree,
  type ConnectionAnswers,
  type ConnectionQuestionGroup,
  type DeletePreview,
  type PersonName,
  type PersonNode,
  type RelativeKind,
  type MoveRequest,
} from '../model/tree'

interface TreeViewProps {
  tree: FamilyTree
  selectedId: string | null
  onSelect: (id: string | null) => void
  onAddRelative: (
    selectedId: string,
    relation: RelativeKind,
    name: PersonName,
    answers: ConnectionAnswers,
    centers: Record<string, number>,
    side?: 'left' | 'right',
  ) => void
  onUpdatePerson: (personId: string, name: PersonName) => boolean
  onDeletePerson: (personId: string) => void
  onMovePerson: (tree: FamilyTree, personId: string) => void
}

interface DragPreview {
  personId: string
  pointerId: number
  startWorld: Point
  pointer: Point
  targetLayer: number
  dx: number
  dy: number
  availability: ReturnType<typeof getMoveLevelAvailability>
  partIds: string[]
}

const minZoom = 0.25
const maxZoom = 2

export default function TreeView({
  tree,
  selectedId,
  onSelect,
  onAddRelative,
  onUpdatePerson,
  onDeletePerson,
  onMovePerson,
}: TreeViewProps) {
  const { t } = useTranslation()
  const [cardWidth, setCardWidth] = useState(
    window.innerWidth < 640 ? 160 : 200,
  )
  const layout = useMemo(
    () => computeLayout(tree, cardWidth),
    [tree, cardWidth],
  )
  const peopleByLayer = useMemo(() => {
    const rows = new Map<number, PersonNode[]>()
    for (const person of tree.nodes) {
      const row = rows.get(person.metaData.layer) ?? []
      row.push(person)
      rows.set(person.metaData.layer, row)
    }
    return new Map(
      [...rows].map(([layer, people]) => [
        layer,
        people
          .sort((left, right) => left.metaData.order - right.metaData.order)
          .map(({ id }) => id),
      ]),
    )
  }, [tree.nodes])
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
  const dragCandidate = useRef<{
    personId: string
    pointerId: number
    start: Point
    pointerType: string
  } | null>(null)
  const dragTimer = useRef<number | null>(null)
  const dragRef = useRef<DragPreview | null>(null)
  const suppressCardClick = useRef(false)
  const [drag, setDrag] = useState<DragPreview | null>(null)
  const [heldPersonId, setHeldPersonId] = useState<string | null>(null)
  const [relativeForm, setRelativeForm] = useState<RelativeKind | null>(null)
  const [relativeSide, setRelativeSide] = useState<'left' | 'right' | undefined>()
  const [editing, setEditing] = useState(false)
  const [deletePreview, setDeletePreview] = useState<DeletePreview | null>(null)
  const [editAnnounced, setEditAnnounced] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [formError, setFormError] = useState('')
  const [formErrorField, setFormErrorField] = useState<
    'firstName' | 'lastName' | null
  >(null)
  const [connectionAnswers, setConnectionAnswers] = useState<ConnectionAnswers>(
    { checked: {}, choice: null },
  )
  const [connectionError, setConnectionError] = useState(false)
  const [moveAnnouncement, setMoveAnnouncement] = useState('')
  const connectionChoiceRef = useRef<HTMLInputElement>(null)
  const relativeFirstNameRef = useRef<HTMLInputElement>(null)
  const formWasOpenRef = useRef(false)

  const selectedPerson = tree.nodes.find((node) => node.id === selectedId)
  const selectedName = selectedPerson ? getDisplayName(selectedPerson) : ''
  const connectionQuestions = useMemo(
    () =>
      selectedId && relativeForm
        ? getConnectionQuestions(tree, selectedId, relativeForm)
        : [],
    [tree, selectedId, relativeForm],
  )
  const selectedHasTwoParents =
    selectedId !== null && getParentCount(tree, selectedId) >= 2
  const selectedLevels = selectedId
    ? getMoveLevelAvailability(tree, selectedId)
    : []
  const applyMove = useCallback(
    (request: MoveRequest) => {
      const person = tree.nodes.find(({ id }) => id === request.personId)
      if (!person) return
      const dropX =
        (request.centers?.[request.personId] ?? person.metaData.order) +
        request.dx
      const result = moveOne(
        tree,
        request.personId,
        request.targetLayer,
        dropX,
        request.centers,
      )
      if (result === tree) return
      onMovePerson(result, request.personId)
      const moved = result.nodes.find(({ id }) => id === request.personId)
      setMoveAnnouncement(
        moved && moved.metaData.layer !== person.metaData.layer
          ? t('layers.announceLevel', {
              name: getDisplayName(person),
              level: moved.metaData.layer + 1,
            })
          : t('layers.announce', { name: getDisplayName(person) }),
      )
    },
    [onMovePerson, t, tree],
  )

  const requestMove = useCallback(
    (request: MoveRequest) => {
      const person = tree.nodes.find(({ id }) => id === request.personId)
      if (!person) return
      const availability = getMoveLevelAvailability(
        tree,
        request.personId,
      ).find(({ layer }) => layer === request.targetLayer)
      if (!availability || !availability.onlyThisPersonValid) return
      applyMove(request)
    },
    [applyMove, tree],
  )

  const moveDirection = useCallback(
    (
      direction: 'up' | 'down' | 'left' | 'right',
      personId = selectedId ?? undefined,
    ) => {
      const person = tree.nodes.find(({ id }) => id === personId)
      if (!person || relativeForm || editing) return
      const currentLayer = person.metaData.layer
      const centers = Object.fromEntries(
        tree.nodes.map((person) => [
          person.id,
          layout.cardCenters[person.id]
            ? layout.cardCenters[person.id]!.x
            : person.metaData.order,
        ]),
      )
      if (direction === 'up' || direction === 'down') {
        const targetLayer = currentLayer + (direction === 'up' ? -1 : 1)
        requestMove({
          personId: person.id,
          targetLayer,
          dx: 0,
          moveConnected: false,
          centers,
        })
        return
      }
      const ordered = tree.nodes
        .filter((person) => person.metaData.layer === currentLayer)
        .sort((a, b) => a.metaData.order - b.metaData.order)
      const index = ordered.findIndex(({ id }) => id === person.id)
      const neighbor = ordered[index + (direction === 'left' ? -1 : 1)]
      const point = layout.positions[person.id]
      const neighborPoint = neighbor ? layout.positions[neighbor.id] : undefined
      if (!point || !neighborPoint) return
      const selectedCenter = point.x + cardWidth / 2
      const neighborCenter = neighborPoint.x + cardWidth / 2
      const dx =
        neighborCenter -
        selectedCenter +
        (direction === 'right' ? cardWidth / 2 : -cardWidth / 2)
      requestMove({
        personId: person.id,
        targetLayer: currentLayer,
        dx,
        moveConnected: false,
        centers,
      })
    },
    [
      cardWidth,
      editing,
      layout.cardCenters,
      layout.positions,
      relativeForm,
      requestMove,
      selectedId,
      tree.nodes,
    ],
  )

  const setDragPreview = useCallback((preview: DragPreview | null) => {
    dragRef.current = preview
    setDrag(preview)
  }, [])

  const startCardDrag = useCallback(
    (personId: string, pointerId: number, start: Point) => {
      const person = tree.nodes.find(({ id }) => id === personId)
      if (!person) return
      const partIds =
        getConnectedParts(tree).find((ids) => ids.includes(personId)) ?? []
      const startWorld = {
        x: (start.x - viewport.x) / viewport.scale,
        y: (start.y - viewport.y) / viewport.scale,
      }
      const preview: DragPreview = {
        personId,
        pointerId,
        startWorld,
        pointer: start,
        targetLayer: person.metaData.layer,
        dx: 0,
        dy: 0,
        availability: getMoveLevelAvailability(tree, personId),
        partIds,
      }
      setDragPreview(preview)
      panStart.current = null
      setHeldPersonId(null)
    },
    [setDragPreview, tree, viewport.scale, viewport.x, viewport.y],
  )

  const updateCardDrag = useCallback(
    (pointer: Point) => {
      const current = dragRef.current
      if (!current) return
      const world = {
        x: (pointer.x - viewport.x) / viewport.scale,
        y: (pointer.y - viewport.y) / viewport.scale,
      }
      const rowCenters = [
        ...new Set(
          tree.nodes
            .filter(({ id }) => current.partIds.includes(id))
            .map(({ metaData }) => metaData.layer),
        ),
      ].map((layer) => {
        const row = tree.nodes.filter(
          (person) =>
            current.partIds.includes(person.id) &&
            person.metaData.layer === layer,
        )
        return {
          layer,
          y:
            row.reduce(
              (sum, person) =>
                sum +
                (layout.positions[person.id]?.y ?? 0) +
                LAYOUT_SPACING.cardHeight / 2,
              0,
            ) / Math.max(1, row.length),
        }
      })
      const targetLayer =
        rowCenters.sort(
          (a, b) => Math.abs(a.y - world.y) - Math.abs(b.y - world.y),
        )[0]?.layer ?? current.targetLayer
      setDragPreview({
        ...current,
        pointer,
        targetLayer,
        dx: world.x - current.startWorld.x,
        dy: world.y - current.startWorld.y,
      })
    },
    [
      layout.positions,
      setDragPreview,
      tree.nodes,
      viewport.scale,
      viewport.x,
      viewport.y,
    ],
  )

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
            const bottom = top + LAYOUT_SPACING.cardHeight * current.scale
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
          focusPersonControl(selectedId, 'identity'),
        )
      }
    }
  }, [relativeForm, selectedId])

  useEffect(() => {
    if (editing) relativeFirstNameRef.current?.focus()
  }, [editing])

  const closeDetail = useCallback(() => {
    const closingId = selectedId
    setRelativeForm(null)
    setEditing(false)
    setDeletePreview(null)
    onSelect(null)
    if (closingId) {
      window.requestAnimationFrame(() =>
        focusPersonControl(closingId, 'identity'),
      )
    }
  }, [onSelect, selectedId])

  const cancelEdit = useCallback(() => {
    setEditing(false)
    setFormError('')
    setFormErrorField(null)
    if (selectedId) {
      window.requestAnimationFrame(() => focusPersonControl(selectedId, 'edit'))
    }
  }, [selectedId])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (dragRef.current) {
        setDragPreview(null)
        dragCandidate.current = null
        if (dragTimer.current !== null) {
          window.clearTimeout(dragTimer.current)
          dragTimer.current = null
        }
        return
      }
      if (deletePreview) return
      if (relativeForm) {
        setRelativeForm(null)
        setFormError('')
        setFormErrorField(null)
        setFirstName('')
        setLastName('')
        setConnectionAnswers({ checked: {}, choice: null })
        setConnectionError(false)
        return
      }
      if (editing) {
        cancelEdit()
        return
      }
      if (selectedId) closeDetail()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    relativeForm,
    editing,
    deletePreview,
    selectedId,
    closeDetail,
    cancelEdit,
    setDragPreview,
  ])

  function submitEdit(event: FormEvent<HTMLFormElement>) {
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
    if (!selectedPerson) {
      setFormError('unknownPerson')
      return
    }
    try {
      const changed = onUpdatePerson(selectedPerson.id, {
        firstName: trimmedFirstName,
        lastName: lastName.trim(),
      })
      setEditing(false)
      setFormError('')
      setFormErrorField(null)
      setEditAnnounced(changed)
      if (selectedId) {
        window.requestAnimationFrame(() =>
          focusPersonControl(selectedId, 'edit'),
        )
      }
    } catch (error) {
      if (!(error instanceof TreeOperationError)) throw error
      setFormError(error.code)
    }
  }

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
    if (
      connectionQuestions.some((question) => question.kind === 'choice') &&
      connectionAnswers.choice === null
    ) {
      setConnectionError(true)
      connectionChoiceRef.current?.focus()
      return
    }
    try {
      onAddRelative(
        selectedId,
        relativeForm,
        {
          firstName: trimmedFirstName,
          lastName: lastName.trim(),
        },
        connectionAnswers,
        Object.fromEntries(
          Object.entries(layout.cardCenters).map(([id, point]) => [
            id,
            point.x,
          ]),
        ),
        relativeSide,
      )
    } catch (error) {
      if (!(error instanceof TreeOperationError)) throw error
      if (error.code === 'missingConnectionChoice') {
        setConnectionError(true)
        connectionChoiceRef.current?.focus()
      } else {
        setFormError(error.code)
      }
      return
    }
    setFirstName('')
    setLastName('')
    setFormError('')
    setFormErrorField(null)
    setConnectionError(false)
    setConnectionAnswers({ checked: {}, choice: null })
    setRelativeForm(null)
  }

  function openRelativeForm(kind: RelativeKind, side?: 'left' | 'right') {
    if (kind === 'parent' && selectedHasTwoParents) return
    const questions = selectedId
      ? getConnectionQuestions(tree, selectedId, kind)
      : []
    setConnectionAnswers(getDefaultConnectionAnswers(questions))
    setConnectionError(false)
    setFormError('')
    setFormErrorField(null)
    setFirstName('')
    setLastName('')
    setEditing(false)
    setEditAnnounced(false)
    setRelativeSide(side)
    setRelativeForm(kind)
  }

  const pointerPosition = (event: ReactPointerEvent<HTMLDivElement>) => ({
    x: event.clientX - event.currentTarget.getBoundingClientRect().left,
    y: event.clientY - event.currentTarget.getBoundingClientRect().top,
  })

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const personCard =
      event.target instanceof Element
        ? event.target.closest<HTMLElement>('.person-card')
        : null
    if (
      event.target instanceof Element &&
      event.target.closest('.canvas-controls, .person-card__controls')
    )
      return
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    if (pointers.current.size === 0) pointerMovedRef.current = false
    pointers.current.set(event.pointerId, pointerPosition(event))
    if (personCard) {
      const personId = personCard.id.replace(/^person-/, '')
      const start = pointerPosition(event)
      dragCandidate.current = {
        personId,
        pointerId: event.pointerId,
        start,
        pointerType: event.pointerType,
      }
      if (event.pointerType === 'touch') {
        panStart.current = { pointer: start, viewport }
        setHeldPersonId(personId)
        dragTimer.current = window.setTimeout(() => {
          const candidate = dragCandidate.current
          if (!candidate || candidate.pointerId !== event.pointerId) return
          startCardDrag(
            candidate.personId,
            candidate.pointerId,
            candidate.start,
          )
        }, 400)
      }
      return
    }
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
    const candidate = dragCandidate.current
    if (candidate?.pointerId === event.pointerId && !dragRef.current) {
      const moved =
        Math.hypot(point.x - candidate.start.x, point.y - candidate.start.y) > 6
      if (candidate.pointerType === 'touch' && moved) {
        if (dragTimer.current !== null) {
          window.clearTimeout(dragTimer.current)
          dragTimer.current = null
        }
        dragCandidate.current = null
        setHeldPersonId(null)
      } else if (candidate.pointerType !== 'touch' && moved) {
        startCardDrag(candidate.personId, candidate.pointerId, candidate.start)
      }
    }
    if (dragRef.current?.pointerId === event.pointerId) {
      updateCardDrag(point)
      pointerMovedRef.current = true
      event.preventDefault()
      pointers.current.set(event.pointerId, point)
      return
    }
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
    if (event.type === 'pointercancel') {
      setDragPreview(null)
      dragCandidate.current = null
      setHeldPersonId(null)
      if (dragTimer.current !== null) {
        window.clearTimeout(dragTimer.current)
        dragTimer.current = null
      }
      pointers.current.delete(event.pointerId)
      panStart.current = null
      return
    }
    if (dragRef.current?.pointerId === event.pointerId) {
      updateCardDrag(pointerPosition(event))
    }
    const activeDrag = dragRef.current
    if (activeDrag?.pointerId === event.pointerId) {
      const canvas = canvasRef.current
      const bounds = canvas?.getBoundingClientRect()
      const outside =
        !bounds ||
        event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom
      if (!outside) {
        const pointer = pointerPosition(event)
        const worldX = (pointer.x - viewport.x) / viewport.scale
        const selected = tree.nodes.find(({ id }) => id === activeDrag.personId)
        const availability = activeDrag.availability.find(
          ({ layer }) => layer === activeDrag.targetLayer,
        )
        if (selected && availability && availability.onlyThisPersonValid) {
          requestMove({
            personId: activeDrag.personId,
            targetLayer: activeDrag.targetLayer,
            dx: worldX - activeDrag.startWorld.x,
            moveConnected: false,
            centers: Object.fromEntries(
              tree.nodes.map((person) => [
                person.id,
                layout.cardCenters[person.id]
                  ? layout.cardCenters[person.id]!.x
                  : person.metaData.order,
              ]),
            ),
          })
        }
      }
      suppressCardClick.current = true
      window.setTimeout(() => {
        suppressCardClick.current = false
      }, 0)
      setDragPreview(null)
    }
    dragCandidate.current = null
    setHeldPersonId(null)
    if (dragTimer.current !== null) {
      window.clearTimeout(dragTimer.current)
      dragTimer.current = null
    }
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
      className={`tree-workspace${relativeForm || editing ? ' tree-workspace--detail-open' : ''}`}
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
          {drag &&
            drag.availability.map((level) => {
              const band = layout.rowBands.find(
                (item) =>
                  item.layer === level.layer &&
                  item.personIds.some((id) => drag.partIds.includes(id)),
              )
              if (!band) return null
              const available =
                level.onlyThisPersonValid || level.withConnectedPeopleValid
              return (
                <div
                  key={level.layer}
                  className={`drag-level-band${available ? '' : ' drag-level-band--unavailable'}${drag.targetLayer === level.layer && available ? ' drag-level-band--target' : ''}`}
                  style={{
                    left: band.left,
                    top: band.top,
                    width: band.width,
                    height: band.height,
                  }}
                  aria-hidden="true"
                >
                  <span>{t('layers.level', { level: level.layer + 1 })}</span>
                </div>
              )
            })}
          <svg
            className="tree-lines"
            width={layout.width}
            height={layout.height}
            aria-hidden="true"
          >
            {layout.edgePaths.map(({ edge, path, people, dots }, index) => {
              const highlighted =
                selectedId !== null && people.includes(selectedId)
              const key = `${edge.type}-${edge.from}-${edge.to}-${index}`
              return (
                <g
                  key={key}
                  className={
                    highlighted ? 'tree-line-group--selected' : undefined
                  }
                >
                  <path d={path} />
                  {dots.map((dot, dotIndex) => (
                    <circle
                      key={`${key}-dot-${dotIndex}`}
                      cx={dot.x}
                      cy={dot.y}
                      r="3"
                    />
                  ))}
                </g>
              )
            })}
          </svg>
          {tree.nodes.map((person) => {
            const originalPoint = layout.positions[person.id]
            const point = originalPoint
            const personLevels = selectedId === person.id ? selectedLevels : []
            const personName = getDisplayName(person)
            const row = peopleByLayer.get(person.metaData.layer) ?? []
            const rowIndex = row.indexOf(person.id)
            return (
              <PersonCard
                key={person.id}
                person={person}
                point={point}
                selected={selectedId === person.id}
                width={cardWidth}
                held={heldPersonId === person.id}
                dragging={drag?.personId === person.id}
                dragConnected={false}
                controls={
                  <InlineNodeControls
                    personId={person.id}
                    personName={personName}
                    currentLevel={person.metaData.layer}
                    selectedLevels={personLevels}
                    canMoveLeft={rowIndex > 0}
                    canMoveRight={rowIndex >= 0 && rowIndex < row.length - 1}
                    onEdit={() => {
                      onSelect(person.id)
                      setRelativeForm(null)
                      setFirstName(person.data.firstName)
                      setLastName(person.data.lastName ?? '')
                      setFormError('')
                      setFormErrorField(null)
                      setEditAnnounced(false)
                      setEditing(true)
                    }}
                    onDelete={() => {
                      onSelect(person.id)
                      setDeletePreview(getDeletePreview(tree, person.id))
                    }}
                    moveDirection={(direction) =>
                      moveDirection(direction, person.id)
                    }
                    onMoveOpen={() => onSelect(person.id)}
                  />
                }
                onSelect={() => {
                  if (suppressCardClick.current) {
                    suppressCardClick.current = false
                    return
                  }
                  setRelativeForm(null)
                  setEditing(false)
                  setDeletePreview(null)
                  setFirstName('')
                  setLastName('')
                  setFormError('')
                  setFormErrorField(null)
                  onSelect(person.id)
                }}
                onMoveDirection={(direction) =>
                  moveDirection(direction, person.id)
                }
              />
            )
          })}
          {drag && (
            <div
              className="drag-insertion-line"
              style={{
                left:
                  (drag.pointer.x - viewport.x) / viewport.scale -
                  LAYOUT_SPACING.lineInset,
                top:
                  (tree.nodes.find(
                    (person) =>
                      drag.partIds.includes(person.id) &&
                      person.metaData.layer === drag.targetLayer,
                  )
                    ? layout.positions[
                        tree.nodes.find(
                          (person) =>
                            drag.partIds.includes(person.id) &&
                            person.metaData.layer === drag.targetLayer,
                        )!.id
                      ]!.y
                    : 0) - 12,
                height: LAYOUT_SPACING.cardHeight + 24,
              }}
              aria-hidden="true"
            />
          )}
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

      {selectedPerson &&
        !relativeForm &&
        !editing &&
        !deletePreview &&
        !drag && (
          <>
            <NodeActions
              selectedName={selectedName}
              cardLeft={
                viewport.x +
                (layout.positions[selectedPerson.id]?.x ?? 0) * viewport.scale
              }
              cardTop={
                viewport.y +
                (layout.positions[selectedPerson.id]?.y ?? 0) * viewport.scale
              }
              cardWidth={cardWidth * viewport.scale}
              cardHeight={LAYOUT_SPACING.cardHeight * viewport.scale}
              selectedHasTwoParents={selectedHasTwoParents}
              onAddRelative={openRelativeForm}
            />
            <span className="visually-hidden" aria-live="polite">
              {moveAnnouncement}
            </span>
            <span className="visually-hidden" aria-live="polite">
              {editAnnounced ? t('editNameAnnounce') : ''}
            </span>
          </>
        )}
      {selectedPerson && (relativeForm || editing) && (
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
              tree={tree}
              questions={connectionQuestions}
              answers={connectionAnswers}
              connectionError={connectionError}
              choiceRef={connectionChoiceRef}
              onAnswers={(answers) => {
                setConnectionAnswers(answers)
                setConnectionError(
                  answers.choice === null ? connectionError : false,
                )
                setFormError('')
              }}
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
                setConnectionAnswers({ checked: {}, choice: null })
                setConnectionError(false)
              }}
            />
          ) : editing && selectedPerson ? (
            <EditPersonForm
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
              onSubmit={submitEdit}
              onCancel={cancelEdit}
            />
          ) : null}
        </aside>
      )}
      {selectedPerson && deletePreview && (
        <DeletePersonDialog
          name={selectedName}
          preview={deletePreview}
          isOnlyPerson={tree.nodes.length === 1}
          onConfirm={() => {
            onDeletePerson(selectedPerson.id)
            setDeletePreview(null)
          }}
          onCancel={() => {
            setDeletePreview(null)
            window.requestAnimationFrame(() =>
              focusPersonControl(selectedPerson.id, 'delete'),
            )
          }}
        />
      )}
    </div>
  )
}

function focusPersonControl(
  personId: string,
  control: 'identity' | 'edit' | 'delete',
) {
  const className = {
    identity: 'person-card__identity',
    edit: 'person-card__control--edit',
    delete: 'person-card__control--delete',
  }[control]
  document
    .getElementById(`person-${personId}`)
    ?.querySelector<HTMLButtonElement>(`.${className}`)
    ?.focus()
}

function PersonCard({
  person,
  point,
  selected,
  width,
  held,
  dragging,
  dragConnected,
  controls,
  onSelect,
  onMoveDirection,
}: {
  person: PersonNode
  point: Point | undefined
  selected: boolean
  width: number
  held: boolean
  dragging: boolean
  dragConnected: boolean
  controls: React.ReactNode
  onSelect: () => void
  onMoveDirection: (
    direction: 'up' | 'down' | 'left' | 'right',
    personId?: string,
  ) => void
}) {
  const name = getDisplayName(person)
  const initials =
    `${person.data.firstName.charAt(0)}${(person.data.lastName ?? '').charAt(0)}`.toLocaleUpperCase()
  if (!point) return null
  return (
    <div
      id={`person-${person.id}`}
      className={`person-card${selected ? ' person-card--selected' : ''}${held ? ' person-card--held' : ''}${dragging ? ' person-card--dragging' : ''}${dragConnected ? ' person-card--drag-connected' : ''}`}
      style={{ left: point.x, top: point.y, width }}
      role="group"
      aria-label={name}
      onClick={onSelect}
    >
      <button
        type="button"
        className="person-card__identity"
        aria-label={name}
        aria-pressed={selected}
        onKeyDown={(event) => {
          if (!event.altKey) return
          const direction = {
            ArrowUp: 'up',
            ArrowDown: 'down',
            ArrowLeft: 'left',
            ArrowRight: 'right',
          }[event.key]
          if (!direction) return
          event.preventDefault()
          onMoveDirection(
            direction as 'up' | 'down' | 'left' | 'right',
            person.id,
          )
        }}
      >
        <span className="person-card__avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="person-card__name" title={name}>
          {name}
        </span>
      </button>
      {controls}
    </div>
  )
}

function EditPersonForm({
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
  return (
    <>
      <h2 className="detail-panel__form-title">{t('editPersonTitle')}</h2>
      <form className="relative-form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="edit-first-name">{t('firstName')}</label>
          <input
            id="edit-first-name"
            ref={firstNameRef}
            autoComplete="given-name"
            maxLength={101}
            value={firstName}
            aria-invalid={errorField === 'firstName'}
            aria-describedby={
              errorField === 'firstName' ? 'edit-first-name-error' : undefined
            }
            onChange={(event) => onFirstName(event.target.value)}
          />
          {error && errorField === 'firstName' && (
            <span
              className="field__error"
              id="edit-first-name-error"
              role="alert"
            >
              {error === 'required'
                ? t('firstNameRequired')
                : t('nameTooLong', { max: 100 })}
            </span>
          )}
        </div>
        <div className="field">
          <label htmlFor="edit-last-name">{t('lastName')}</label>
          <input
            id="edit-last-name"
            autoComplete="family-name"
            maxLength={101}
            value={lastName}
            aria-invalid={errorField === 'lastName'}
            aria-describedby={
              errorField === 'lastName' ? 'edit-last-name-error' : undefined
            }
            onChange={(event) => onLastName(event.target.value)}
          />
          {error && errorField === 'lastName' && (
            <span
              className="field__error"
              id="edit-last-name-error"
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
        {error && errorField === null && (
          <p className="field__error" role="alert">
            {t('editSaveError')}
          </p>
        )}
      </form>
    </>
  )
}

function RelativeForm({
  relation,
  name,
  firstName,
  lastName,
  error,
  errorField,
  tree,
  questions,
  answers,
  connectionError,
  choiceRef,
  onAnswers,
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
  tree: FamilyTree
  questions: ConnectionQuestionGroup[]
  answers: ConnectionAnswers
  connectionError: boolean
  choiceRef: React.RefObject<HTMLInputElement | null>
  onAnswers: (answers: ConnectionAnswers) => void
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
      <form className="relative-form" onSubmit={onSubmit} noValidate>
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
        <ConnectionQuestions
          groups={questions}
          tree={tree}
          targetName={name}
          answers={answers}
          error={connectionError}
          choiceRef={choiceRef}
          onAnswers={onAnswers}
        />
        {error && errorField === null && (
          <p className="field__error" role="alert">
            {error === 'tooManyParents'
              ? t('connectTooManyParents')
              : t('connectSaveError')}
          </p>
        )}
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

function ConnectionQuestions({
  groups,
  tree,
  targetName,
  answers,
  error,
  choiceRef,
  onAnswers,
}: {
  groups: ConnectionQuestionGroup[]
  tree: FamilyTree
  targetName: string
  answers: ConnectionAnswers
  error: boolean
  choiceRef: React.RefObject<HTMLInputElement | null>
  onAnswers: (answers: ConnectionAnswers) => void
}) {
  const { t } = useTranslation()
  if (!groups.length) return null

  const getName = (personId: string) => {
    const person = tree.nodes.find((node) => node.id === personId)
    return person ? getDisplayName(person) : ''
  }
  const coupleParentId = groups.find((group) => group.id === 'parentCouple')
    ?.items[0]?.personId
  const legends: Record<ConnectionQuestionGroup['id'], string> = {
    partnerChildren: t('connectPartnerLegend', { name: targetName }),
    childOtherParent: t('connectChildLegend'),
    childSiblings: t('connectChildSiblingsLegend', { name: targetName }),
    siblingParents: t('connectSiblingParentsLegend', { name: targetName }),
    siblingSiblings: t('connectSiblingsLegend', { name: targetName }),
    parentSiblings: t('connectSiblingsLegend', { name: targetName }),
    parentCouple: t('connectParentCoupleLegend', {
      parent: coupleParentId ? getName(coupleParentId) : '',
    }),
  }
  const getItemLabel = (group: ConnectionQuestionGroup, personId: string) => {
    const personName = getName(personId)
    switch (group.id) {
      case 'partnerChildren':
        return t('connectPartnerItem', { child: personName })
      case 'childOtherParent':
      case 'siblingParents':
        return t('connectAlsoChildOf', { parent: personName })
      case 'childSiblings':
      case 'siblingSiblings':
        return t('connectAlsoSiblingOf', { name: personName })
      case 'parentSiblings':
        return t('connectParentSiblingItem', { name: personName })
      case 'parentCouple':
        return t('connectParentCouple', { parent: personName })
    }
  }

  return (
    <div className="connection-questions">
      {groups.map((group) => {
        const enabledItems = group.items.filter((item) => !item.disabledReason)
        const selectAllAvailable =
          group.kind === 'checkboxes' && enabledItems.length >= 4
        const allSelected =
          selectAllAvailable &&
          enabledItems.every(
            (item) => answers.checked[`${group.id}:${item.personId}`],
          )
        return (
          <fieldset
            className="connection-group"
            key={group.id}
            aria-describedby={
              error && group.kind === 'choice'
                ? `connection-${group.id}-error`
                : undefined
            }
          >
            <legend>{legends[group.id]}</legend>
            {selectAllAvailable && (
              <button
                className="button button--ghost connection-select-all"
                type="button"
                onClick={() => {
                  const checked = { ...answers.checked }
                  for (const item of enabledItems) {
                    checked[`${group.id}:${item.personId}`] = !allSelected
                  }
                  onAnswers({ ...answers, checked })
                }}
              >
                {allSelected ? t('connectClearAll') : t('connectSelectAll')}
              </button>
            )}
            <div className="connection-items">
              {group.items.map((item, index) => {
                const personName = getName(item.personId)
                const controlId = `connection-${group.id}-${index}`
                const disabledId = `${controlId}-disabled`
                const label = getItemLabel(group, item.personId)
                return (
                  <label
                    className={`connection-item${item.disabledReason ? ' connection-item--disabled' : ''}`}
                    htmlFor={controlId}
                    key={`${group.id}:${item.personId}`}
                  >
                    {group.kind === 'choice' ? (
                      <input
                        ref={index === 0 ? choiceRef : undefined}
                        id={controlId}
                        type="radio"
                        name="other-parent-choice"
                        value={item.personId}
                        checked={answers.choice === item.personId}
                        disabled={Boolean(item.disabledReason)}
                        aria-describedby={
                          item.disabledReason ? disabledId : undefined
                        }
                        aria-invalid={error}
                        onChange={() => {
                          onAnswers({ ...answers, choice: item.personId })
                        }}
                      />
                    ) : (
                      <input
                        id={controlId}
                        type="checkbox"
                        checked={
                          answers.checked[`${group.id}:${item.personId}`] ??
                          item.defaultChecked
                        }
                        disabled={Boolean(item.disabledReason)}
                        aria-describedby={
                          item.disabledReason ? disabledId : undefined
                        }
                        onChange={(event) => {
                          onAnswers({
                            ...answers,
                            checked: {
                              ...answers.checked,
                              [`${group.id}:${item.personId}`]:
                                event.target.checked,
                            },
                          })
                        }}
                      />
                    )}
                    <span className="connection-item__copy">
                      <span>
                        {group.kind === 'choice' ? personName : label}
                      </span>
                      {item.disabledReason && (
                        <span className="connection-item__note" id={disabledId}>
                          {t('connectDisabledTwoParents')}
                        </span>
                      )}
                    </span>
                  </label>
                )
              })}
              {group.kind === 'choice' && (
                <label
                  className="connection-item"
                  htmlFor="connection-no-parent"
                >
                  <input
                    id="connection-no-parent"
                    type="radio"
                    name="other-parent-choice"
                    value="__none__"
                    checked={answers.choice === '__none__'}
                    aria-invalid={error}
                    onChange={() =>
                      onAnswers({ ...answers, choice: '__none__' })
                    }
                  />
                  <span>{t('connectChildNone')}</span>
                </label>
              )}
            </div>
            {error && group.kind === 'choice' && (
              <p
                className="field__error"
                id={`connection-${group.id}-error`}
                role="alert"
              >
                {t('connectChildError')}
              </p>
            )}
          </fieldset>
        )
      })}
    </div>
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
