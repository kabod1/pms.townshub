import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { UtensilsCrossed, AlertCircle } from 'lucide-react'

interface Category { id: string; name: string; sort_order: number }
interface MenuItem {
  id: string; category_id: string | null; name: string
  description: string | null; price: number; currency: string
  allergens: string[]; tags: string[]; is_available: boolean
}
interface MenuData {
  tenant: { id: string; name: string; currency: string }
  categories: Category[]
  items: MenuItem[]
}

function formatPrice(price: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(price)
}

export default function PublicMenu() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<MenuData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>('all')

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
  const filtered = activeCategory === 'all'
    ? items
    : items.filter((i) => i.category_id === activeCategory)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#0F2138] text-white px-4 pt-10 pb-6 text-center">
        <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center mx-auto mb-3">
          <UtensilsCrossed size={22} className="text-white" />
        </div>
        <h1 className="text-xl font-bold">{tenant.name}</h1>
        <p className="text-white/60 text-sm mt-0.5">Food & Beverage Menu</p>
      </div>

      {/* Category tabs */}
      {categories.length > 0 && (
        <div className="sticky top-0 bg-white border-b border-gray-100 z-10 shadow-sm">
          <div className="flex gap-1 overflow-x-auto px-4 py-2 scrollbar-hide">
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

      {/* Menu items */}
      <div className="max-w-xl mx-auto px-4 py-6 space-y-3">
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            No items in this category yet.
          </div>
        )}
        {filtered.map((item) => (
          <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-[15px]">{item.name}</p>
                {item.description && (
                  <p className="text-sm text-gray-500 mt-0.5 leading-snug">{item.description}</p>
                )}
                {item.allergens.length > 0 && (
                  <p className="text-xs text-amber-600 mt-1.5">
                    Contains: {item.allergens.join(', ')}
                  </p>
                )}
                {item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.tags.map((tag) => (
                      <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold text-[#0F2138] text-base">
                  {formatPrice(item.price, item.currency)}
                </p>
                {!item.is_available && (
                  <span className="text-xs text-red-400 font-medium">Unavailable</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center pb-10 pt-2">
        <p className="text-xs text-gray-400">Powered by Townshub PMS</p>
      </div>
    </div>
  )
}
