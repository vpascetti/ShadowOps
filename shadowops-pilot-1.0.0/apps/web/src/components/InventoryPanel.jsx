import { useEffect, useState, useRef } from 'react'
import '../styles/InventoryPanel.css'

export default function InventoryPanel() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    fetchInventory()
    return () => {
      mounted.current = false
    }
  }, [])

  async function fetchInventory() {
    setLoading(true)
    try {
      const res = await fetch('/api/inventory')
      const data = await res.json()
      if (data.ok && mounted.current) setItems(data.inventory)
    } catch (err) {
      console.error('Failed to fetch inventory', err)
    } finally {
      if (mounted.current) setLoading(false)
    }
  }

  async function adjust(id, delta) {
    try {
      const res = await fetch(`/api/inventory/${id}/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta }),
      })
      const data = await res.json()
      if (data.ok) {
        // update local copy
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, qty_on_hand: data.item.qty_on_hand, status: data.item.status } : it)))
      } else {
        console.error('Adjust failed', data.error)
      }
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="inventory-panel">
      <h3>Inventory</h3>
      {loading ? (
        <p>Loading…</p>
      ) : (
        <div className="inventory-table-wrapper">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Part</th>
                <th>Location</th>
                <th>On Hand</th>
                <th>Min</th>
                <th>Max</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={8}>No inventory items</td>
                </tr>
              )}
              {items.map((it) => (
                <tr key={it.id} className={`inv-row ${it.status}`}>
                  <td>{it.sku}</td>
                  <td>{it.part || '—'}</td>
                  <td>{it.location || '—'}</td>
                  <td>{it.qty_on_hand}</td>
                  <td>{it.min_threshold}</td>
                  <td>{it.max_threshold}</td>
                  <td className="status-cell">{it.status}</td>
                  <td className="actions-cell">
                    <button onClick={() => adjust(it.id, -1)}>-1</button>
                    <button onClick={() => adjust(it.id, 1)}>+1</button>
                    <button onClick={() => adjust(it.id, 10)}>+10</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
