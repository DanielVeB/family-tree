import { useEffect, useReducer, useState } from 'react'
import { useTranslation } from 'react-i18next'
import NewTreeDialog from './components/NewTreeDialog'
import TreeView from './components/TreeView'
import {
  addFirstPerson,
  addRelative,
  createEmptyTree,
  type FamilyTree,
  type PersonName,
} from './model/tree'

interface AppState {
  tree: FamilyTree
  selectedId: string | null
}

type AppAction =
  | { type: 'create'; tree: FamilyTree }
  | { type: 'select'; selectedId: string | null }
  | { type: 'add-relative'; tree: FamilyTree; selectedId: string }

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'create':
      return {
        tree: action.tree,
        selectedId: null,
      }
    case 'select':
      return { ...state, selectedId: action.selectedId }
    case 'add-relative':
      return { tree: action.tree, selectedId: action.selectedId }
  }
}

function App() {
  const { i18n, t } = useTranslation()
  const [state, dispatch] = useReducer(reducer, {
    tree: createEmptyTree(),
    selectedId: null,
  })
  const [showNewTreeDialog, setShowNewTreeDialog] = useState(false)

  useEffect(() => {
    document.title = t('documentTitle')
  }, [i18n.language, t])

  useEffect(() => {
    if (state.tree.nodes.length === 0) return
    const preventLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', preventLeaving)
    return () => window.removeEventListener('beforeunload', preventLeaving)
  }, [state.tree.nodes.length])

  useEffect(() => {
    if (!showNewTreeDialog) return
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowNewTreeDialog(false)
    }
    window.addEventListener('keydown', cancelOnEscape)
    return () => window.removeEventListener('keydown', cancelOnEscape)
  }, [showNewTreeDialog])

  const changeLanguage = (language: 'en' | 'pl') => {
    window.localStorage.setItem('family-tree-language', language)
    void i18n.changeLanguage(language)
  }

  function createTree(name: PersonName) {
    dispatch({
      type: 'create',
      tree: addFirstPerson(createEmptyTree(), name),
    })
    setShowNewTreeDialog(false)
  }

  function createRelative(
    selectedId: string,
    relation: 'parent' | 'child' | 'sibling' | 'partner',
    name: PersonName,
  ) {
    const tree = addRelative(state.tree, selectedId, relation, name)
    dispatch({
      type: 'add-relative',
      tree,
      selectedId: tree.nodes[tree.nodes.length - 1]!.id,
    })
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <a className="wordmark" href={import.meta.env.BASE_URL}>
          {t('appName')}
        </a>
        <div
          className="language-toggle"
          role="group"
          aria-label={t('language')}
        >
          <button
            type="button"
            aria-pressed={i18n.language === 'en'}
            onClick={() => changeLanguage('en')}
          >
            {t('englishShort')}
          </button>
          <span aria-hidden="true">|</span>
          <button
            type="button"
            aria-pressed={i18n.language === 'pl'}
            onClick={() => changeLanguage('pl')}
          >
            {t('polishShort')}
          </button>
        </div>
      </header>

      {state.tree.nodes.length === 0 ? (
        <main className="empty-state">
          <div className="empty-state__content">
            <h1>{t('welcomeTitle')}</h1>
            <p>{t('welcomeDescription')}</p>
            <div className="empty-state__actions">
              <button
                className="button button--primary"
                type="button"
                onClick={() => setShowNewTreeDialog(true)}
              >
                {t('startTree')}
              </button>
              <button
                className="button button--ghost"
                type="button"
                disabled
                aria-disabled="true"
              >
                {t('importFile')}
              </button>
            </div>
          </div>
        </main>
      ) : (
        <main className="tree-main">
          <TreeView
            tree={state.tree}
            selectedId={state.selectedId}
            onSelect={(selectedId) => dispatch({ type: 'select', selectedId })}
            onAddRelative={createRelative}
          />
        </main>
      )}
      {showNewTreeDialog && (
        <NewTreeDialog
          onCreate={createTree}
          onCancel={() => setShowNewTreeDialog(false)}
        />
      )}
    </div>
  )
}

export default App
