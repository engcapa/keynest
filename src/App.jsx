import { useState, useEffect, useCallback } from 'react'
import './App.css'
import AccountCard from './components/AccountCard.jsx'
import AddAccountModal from './components/AddAccountModal.jsx'
import { loadAccounts, saveAccounts } from './lib/storage.js'

function KeyIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="5.5"/>
      <path d="M21 2l-9.6 9.6"/>
      <path d="M15.5 7.5l3 3L22 7l-3-3"/>
    </svg>
  )
}

function SearchIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <path d="M21 21l-4.35-4.35"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  )
}

export default function App() {
  const [accounts, setAccounts] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setAccounts(loadAccounts())
  }, [])

  const handleAdd = useCallback((account) => {
    setAccounts(prev => {
      const next = [...prev, account]
      saveAccounts(next)
      return next
    })
    setShowModal(false)
  }, [])

  const handleDelete = useCallback((id) => {
    setAccounts(prev => {
      const next = prev.filter(a => a.id !== id)
      saveAccounts(next)
      return next
    })
  }, [])

  const filtered = search.trim()
    ? accounts.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        (a.issuer && a.issuer.toLowerCase().includes(search.toLowerCase()))
      )
    : accounts

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">
          <KeyIcon className="header-logo" />
          <div>
            <div className="header-title">Keynest</div>
            <div className="header-subtitle">Authenticator</div>
          </div>
        </div>
        <button className="btn-add" onClick={() => setShowModal(true)}>
          <PlusIcon />
          Add account
        </button>
      </header>

      <main className="main">
        {accounts.length > 0 && (
          <div className="search-bar">
            <SearchIcon className="search-icon" />
            <input
              type="search"
              placeholder="Search accounts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="empty-state">
            <KeyIcon className="empty-icon" />
            {accounts.length === 0 ? (
              <>
                <h2>No accounts yet</h2>
                <p>Add your first account to generate one-time codes.</p>
              </>
            ) : (
              <>
                <h2>No results</h2>
                <p>No accounts match your search.</p>
              </>
            )}
          </div>
        ) : (
          <div className="accounts-list">
            {filtered.map(account => (
              <AccountCard
                key={account.id}
                account={account}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <AddAccountModal
          onAdd={handleAdd}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
