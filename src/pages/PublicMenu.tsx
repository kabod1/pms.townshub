import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  AlertCircle, Plus, Minus, X, UtensilsCrossed,
  Check, ChevronLeft, Banknote, CreditCard,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Category { id: string; name: string; sort_order: number }
interface MenuItem {
  id: string; category_id: string | null; name: string
  description: string | null; price: number; currency: string
  allergens: string[]; tags: string[]; is_available: boolean
  photo_url: string | null
}
interface MenuData {
  tenant: { id: string; name: string; currency: string; logo_url: string | null; slug: string }
  categories: Category[]
  items: MenuItem[]
}
interface CartItem {
  menuItemId: string; name: string; price: number; quantity: number; notes: string
}

// ── Allergen chips ─────────────────────────────────────────────────────────────
const ALLERGEN_INFO: Record<string, { emoji: string; color: string }> = {
  gluten:    { emoji: '🌾', color: 'bg-amber-100 text-amber-800' },
  wheat:     { emoji: '🌾', color: 'bg-amber-100 text-amber-800' },
  dairy:     { emoji: '🥛', color: 'bg-blue-100 text-blue-800' },
  milk:      { emoji: '🥛', color: 'bg-blue-100 text-blue-800' },
  nuts:      { emoji: '🥜', color: 'bg-orange-100 text-orange-800' },
  peanuts:   { emoji: '🥜', color: 'bg-orange-100 text-orange-800' },
  eggs:      { emoji: '🥚', color: 'bg-yellow-100 text-yellow-800' },
  egg:       { emoji: '🥚', color: 'bg-yellow-100 text-yellow-800' },
  fish:      { emoji: '🐟', color: 'bg-cyan-100 text-cyan-800' },
  shellfish: { emoji: '🦐', color: 'bg-pink-100 text-pink-800' },
  soy:       { emoji: '🫘', color: 'bg-green-100 text-green-800' },
  sesame:    { emoji: '🌰', color: 'bg-stone-100 text-stone-800' },
  celery:    { emoji: '🌿', color: 'bg-emerald-100 text-emerald-800' },
  mustard:   { emoji: '🟡', color: 'bg-yellow-100 text-yellow-700' },
  sulphites: { emoji: '⚗️', color: 'bg-purple-100 text-purple-800' },
  lupin:     { emoji: '🌸', color: 'bg-rose-100 text-rose-800' },
  molluscs:  { emoji: '🐚', color: 'bg-teal-100 text-teal-800' },
}

function formatPrice(price: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'EUR' }).format(price)
}

function AllergenChip({ allergen }: { allergen: string }) {
  const key = allergen.toLowerCase()
  const info = ALLERGEN_INFO[key]
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${info?.color ?? 'bg-gray-100 text-gray-600'}`}>
      {info?.emoji ?? '⚠️'} {allergen}
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
type View = 'menu' | 'cart' | 'done'

export default function PublicMenu() {
  const { slug, tableToken } = useParams<{ slug: string; tableToken?: string }>()

  const [data, setData]               = useState<MenuData | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [selectedItem, setSelectedItem]     = useState<MenuItem | null>(null)
  const [itemQty, setItemQty]         = useState(1)
  const [itemNotes, setItemNotes]     = useState('')
  const [cart, setCart]               = useState<CartItem[]>([])
  const [view, setView]               = useState<View>('menu')
  const [tableNumber, setTableNumber] = useState(tableToken ?? '')
  const [guestName, setGuestName]     = useState('')
  const [payMethod, setPayMethod]     = useState<'cash' | 'card'>('cash')
  const [submitting, setSubmitting]   = useState(false)
  const [orderId, setOrderId]         = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    fetch(`/api/menu?slug=${slug}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error)
        setData(json)
        if (json.categories.length > 0) setActiveCategory(json.categories[0].id)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug])

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const cartTotal = cart.reduce((s, i) => s + i.price * i.quantity, 0)

  function openItem(item: MenuItem) {
    setSelectedItem(item)
    setItemQty(1)
    setItemNotes('')
  }

  function addToCart() {
    if (!selectedItem) return
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItemId === selectedItem.id && c.notes === itemNotes)
      if (existing) {
        return prev.map((c) =>
          c.menuItemId === selectedItem.id && c.notes === itemNotes
            ? { ...c, quantity: c.quantity + itemQty }
            : c
        )
      }
      return [...prev, {
        menuItemId: selectedItem.id,
        name:       selectedItem.name,
        price:      selectedItem.price,
        quantity:   itemQty,
        notes:      itemNotes,
      }]
    })
    setSelectedItem(null)
  }

  function updateCartQty(idx: number, delta: number) {
    setCart((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], quantity: next[idx].quantity + delta }
      return next.filter((c) => c.quantity > 0)
    })
  }

  const placeOrder = useCallback(async () => {
    if (!data || cart.length === 0) return
    setSubmitting(true)
    try {
      const body = {
        slug: data.tenant.slug,
        items: cart.map((c) => ({
          menu_item_id: c.menuItemId,
          name:         c.name,
          quantity:     c.quantity,
          unit_price:   c.price,
          notes:        c.notes || null,
        })),
        table_number:   tableNumber || null,
        guest_name:     guestName || null,
        payment_method: payMethod,
        table_token:    tableToken ?? null,
      }
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Order failed')
      setOrderId(json.order_id)
      setCart([])
      setView('done')
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to place order. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [data, cart, tableNumber, guestName, payMethod, tableToken])

  // ── Loading / Error states ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading menu…</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Menu not available</p>
          <p className="text-sm text-gray-400 mt-1">{error ?? 'Please try again later'}</p>
        </div>
      </div>
    )
  }

  const { tenant, categories, items } = data
  const filteredItems = activeCategory === 'all'
    ? items.filter((i) => i.is_available)
    : items.filter((i) => i.category_id === activeCategory && i.is_available)

  // ── Done screen ────────────────────────────────────────────────────────────
  if (view === 'done') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-5 shadow-lg">
          <Check size={36} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h1>
        <p className="text-gray-500 mb-1">Your order has been received and is being prepared.</p>
        {tableNumber && <p className="text-sm text-gray-400 mb-1">Table: <span className="font-semibold text-gray-600">{tableNumber}</span></p>}
        {orderId && <p className="text-xs text-gray-300 mt-2">Order #{orderId.slice(-8).toUpperCase()}</p>}
        <button
          onClick={() => { setView('menu'); setOrderId(null) }}
          className="mt-8 px-6 py-3 bg-[#0F2138] text-white rounded-xl font-semibold text-sm"
        >
          Back to Menu
        </button>
        <p className="text-xs text-gray-300 mt-8">Powered by Townshub PMS</p>
      </div>
    )
  }

  // ── Cart / Checkout view ───────────────────────────────────────────────────
  if (view === 'cart') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-[#0F2138] text-white px-4 pt-10 pb-4 flex items-center gap-3">
          <button onClick={() => setView('menu')} className="p-1 -ml-1 text-white/70 hover:text-white">
            <ChevronLeft size={22} />
          </button>
          <div>
            <h1 className="font-bold text-base">{tenant.name}</h1>
            <p className="text-xs text-white/60">Review your order</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto max-w-xl w-full mx-auto px-4 py-5 space-y-4">
          {/* Cart items */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {cart.length === 0 ? (
              <p className="text-center py-10 text-gray-400 text-sm">Your cart is empty</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                      {item.notes && <p className="text-xs text-gray-400 italic">{item.notes}</p>}
                      <p className="text-sm font-semibold text-[#0F2138] mt-0.5">
                        {formatPrice(item.price * item.quantity, tenant.currency)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => updateCartQty(idx, -1)}
                        className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQty(idx, 1)}
                        className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center text-white hover:bg-amber-600"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subtotal */}
          <div className="bg-white rounded-2xl shadow-sm px-4 py-3 flex justify-between">
            <span className="text-gray-600 font-medium">Total</span>
            <span className="font-bold text-[#0F2138] text-lg">{formatPrice(cartTotal, tenant.currency)}</span>
          </div>

          {/* Delivery info */}
          <div className="bg-white rounded-2xl shadow-sm px-4 py-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Deliver to</p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Table Number {tableToken && <span className="text-amber-600">(auto-filled from QR)</span>}
              </label>
              <input
                type="text"
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="e.g. 5 or A3"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Your Name (optional)</label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="e.g. John"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          {/* Payment method */}
          <div className="bg-white rounded-2xl shadow-sm px-4 py-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Payment Method</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPayMethod('cash')}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-colors ${
                  payMethod === 'cash' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white'
                }`}
              >
                <Banknote size={20} className={payMethod === 'cash' ? 'text-amber-600' : 'text-gray-400'} />
                <span className={`text-sm font-semibold ${payMethod === 'cash' ? 'text-amber-700' : 'text-gray-500'}`}>Cash</span>
              </button>
              <button
                onClick={() => setPayMethod('card')}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-colors ${
                  payMethod === 'card' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white'
                }`}
              >
                <CreditCard size={20} className={payMethod === 'card' ? 'text-amber-600' : 'text-gray-400'} />
                <span className={`text-sm font-semibold ${payMethod === 'card' ? 'text-amber-700' : 'text-gray-500'}`}>Card</span>
              </button>
            </div>
            {payMethod === 'card' && (
              <p className="text-xs text-gray-400 mt-2 text-center">Card payment will be collected by our staff.</p>
            )}
          </div>
        </div>

        {/* Place order button */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-4 shadow-lg">
          <button
            onClick={placeOrder}
            disabled={submitting || cart.length === 0}
            className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl text-base transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? 'Placing Order…' : `Place Order · ${formatPrice(cartTotal, tenant.currency)}`}
          </button>
        </div>
      </div>
    )
  }

  // ── Menu view ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#0F2138] text-white px-4 pt-10 pb-6 text-center">
        <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center mx-auto mb-3">
          <UtensilsCrossed size={22} className="text-white" />
        </div>
        <h1 className="text-xl font-bold">{tenant.name}</h1>
        <p className="text-white/60 text-sm mt-0.5">
          {tableToken ? `Table ${tableToken}` : 'Food & Beverage Menu'}
        </p>
      </div>

      {/* Category tabs */}
      {categories.length > 0 && (
        <div className="sticky top-0 bg-white border-b border-gray-100 z-10 shadow-sm">
          <div className="flex gap-1 overflow-x-auto px-3 py-2 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                  activeCategory === cat.id
                    ? 'bg-[#0F2138] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="max-w-xl mx-auto px-4 py-4 space-y-3 pb-32">
        {filteredItems.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No items in this category.</div>
        )}
        {filteredItems.map((item) => (
          <button
            key={item.id}
            onClick={() => openItem(item)}
            className="w-full text-left bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="flex gap-3 p-4">
              {/* Photo */}
              {item.photo_url && (
                <div className="shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-gray-100">
                  <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-gray-900 text-[15px] leading-snug">{item.name}</p>
                  <span className="shrink-0 font-bold text-[#0F2138] text-base">
                    {formatPrice(item.price, item.currency)}
                  </span>
                </div>
                {item.description && (
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                )}
                {item.allergens.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {item.allergens.slice(0, 3).map((a) => (
                      <AllergenChip key={a} allergen={a} />
                    ))}
                    {item.allergens.length > 3 && (
                      <span className="text-[11px] text-gray-400">+{item.allergens.length - 3} more</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* Add button strip */}
            <div className="px-4 pb-3 flex justify-end">
              <span className="flex items-center gap-1 bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full">
                <Plus size={12} /> Add
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Cart bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-20 p-4">
          <button
            onClick={() => setView('cart')}
            className="w-full max-w-xl mx-auto flex items-center justify-between bg-[#0F2138] text-white px-5 py-4 rounded-2xl shadow-xl"
          >
            <div className="flex items-center gap-2">
              <span className="bg-amber-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
              <span className="font-semibold text-sm">View Order</span>
            </div>
            <span className="font-bold">{formatPrice(cartTotal, tenant.currency)}</span>
          </button>
        </div>
      )}

      {/* Item detail sheet */}
      {selectedItem && (
        <div className="fixed inset-0 z-30 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedItem(null)} />
          <div className="relative bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto">
            {/* Photo */}
            {selectedItem.photo_url ? (
              <div className="w-full h-52 bg-gray-100 overflow-hidden rounded-t-3xl">
                <img src={selectedItem.photo_url} alt={selectedItem.name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mt-3 mb-1" />
            )}

            <div className="px-5 py-4 space-y-4">
              {/* Close */}
              {!selectedItem.photo_url && (
                <button onClick={() => setSelectedItem(null)} className="absolute top-3 right-4 p-1 text-gray-400">
                  <X size={20} />
                </button>
              )}
              {selectedItem.photo_url && (
                <button
                  onClick={() => setSelectedItem(null)}
                  className="absolute top-4 right-4 bg-white/90 rounded-full p-1.5 shadow text-gray-600"
                >
                  <X size={16} />
                </button>
              )}

              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedItem.name}</h2>
                <p className="text-amber-600 font-bold text-lg mt-0.5">
                  {formatPrice(selectedItem.price, selectedItem.currency)}
                </p>
              </div>

              {selectedItem.description && (
                <p className="text-gray-500 text-sm leading-relaxed">{selectedItem.description}</p>
              )}

              {/* Allergens */}
              {selectedItem.allergens.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Contains</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedItem.allergens.map((a) => <AllergenChip key={a} allergen={a} />)}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Special Requests
                </label>
                <textarea
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value.slice(0, 200))}
                  placeholder="Allergies, modifications, preferences…"
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {/* Quantity + Add */}
              <div className="flex items-center gap-4 pt-1 pb-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setItemQty((q) => Math.max(1, q - 1))}
                    className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="text-xl font-bold w-6 text-center">{itemQty}</span>
                  <button
                    onClick={() => setItemQty((q) => q + 1)}
                    className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white hover:bg-amber-600"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <button
                  onClick={addToCart}
                  className="flex-1 py-3 bg-[#0F2138] text-white font-bold rounded-2xl text-sm hover:bg-[#1a3150] transition-colors"
                >
                  Add to Order · {formatPrice(selectedItem.price * itemQty, selectedItem.currency)}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="text-center pb-2 pt-1">
        <p className="text-xs text-gray-300">Powered by Townshub PMS</p>
      </div>
    </div>
  )
}
