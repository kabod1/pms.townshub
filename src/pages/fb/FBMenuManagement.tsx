import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Tag, QrCode, Copy, ExternalLink } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Card } from '@/components/ui/Card'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatCurrency } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { FBMenuCategory, FBMenuItem } from '@/types'

const categorySchema = z.object({
  name: z.string().min(1, 'Name required'),
  description: z.string().optional(),
})
type CategoryForm = z.infer<typeof categorySchema>

const itemSchema = z.object({
  name: z.string().min(1, 'Name required'),
  description: z.string().optional(),
  price: z.coerce.number().min(0, 'Price required'),
  category_id: z.string().optional(),
  allergens: z.string().optional(),
  tags: z.string().optional(),
  is_available: z.boolean().default(true),
})
type ItemForm = z.infer<typeof itemSchema>

function useMenuCategories() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['fb-menu-categories', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fb_menu_categories')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('sort_order')
      if (error) throw error
      return data as FBMenuCategory[]
    },
    enabled: !!tenant,
  })
}

function useMenuItems() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['fb-menu-items', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fb_menu_items')
        .select('*, category:fb_menu_categories(id,name)')
        .eq('tenant_id', tenant!.id)
        .order('sort_order')
      if (error) throw error
      return data as FBMenuItem[]
    },
    enabled: !!tenant,
  })
}

export default function FBMenuManagement() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'items' | 'categories'>('items')
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<FBMenuCategory | null>(null)
  const [editingItem, setEditingItem] = useState<FBMenuItem | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')

  const { data: categories = [], isLoading: catLoading } = useMenuCategories()
  const { data: items = [], isLoading: itemLoading } = useMenuItems()

  const catForm = useForm<CategoryForm>({ resolver: zodResolver(categorySchema) })
  const itemForm = useForm<ItemForm>({
    resolver: zodResolver(itemSchema),
    defaultValues: { is_available: true },
  })

  const saveCategory = useMutation({
    mutationFn: async (data: CategoryForm) => {
      const payload = { ...data, tenant_id: tenant!.id, sort_order: categories.length }
      if (editingCategory) {
        await supabase.from('fb_menu_categories').update(data).eq('id', editingCategory.id)
      } else {
        await supabase.from('fb_menu_categories').insert(payload)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fb-menu-categories'] })
      toast.success(editingCategory ? 'Category updated' : 'Category added')
      setShowCategoryModal(false)
      setEditingCategory(null)
      catForm.reset()
    },
    onError: () => toast.error('Failed to save category'),
  })

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('fb_menu_categories').delete().eq('id', id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fb-menu-categories'] })
      toast.success('Category deleted')
    },
  })

  const saveItem = useMutation({
    mutationFn: async (data: ItemForm) => {
      const payload = {
        name: data.name,
        description: data.description || null,
        price: data.price,
        category_id: data.category_id || null,
        allergens: data.allergens ? data.allergens.split(',').map((s) => s.trim()).filter(Boolean) : [],
        tags: data.tags ? data.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
        is_available: data.is_available,
        tenant_id: tenant!.id,
        sort_order: items.length,
        is_active: true,
      }
      if (editingItem) {
        await supabase.from('fb_menu_items').update({ ...payload }).eq('id', editingItem.id)
      } else {
        await supabase.from('fb_menu_items').insert(payload)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fb-menu-items'] })
      toast.success(editingItem ? 'Item updated' : 'Item added')
      setShowItemModal(false)
      setEditingItem(null)
      itemForm.reset({ is_available: true })
    },
    onError: () => toast.error('Failed to save menu item'),
  })

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('fb_menu_items').update({ is_active: false }).eq('id', id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fb-menu-items'] })
      toast.success('Item removed')
    },
  })

  const toggleAvailability = useMutation({
    mutationFn: async ({ id, available }: { id: string; available: boolean }) => {
      await supabase.from('fb_menu_items').update({ is_available: available }).eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fb-menu-items'] }),
  })

  function openEditCategory(cat: FBMenuCategory) {
    setEditingCategory(cat)
    catForm.reset({ name: cat.name, description: cat.description ?? '' })
    setShowCategoryModal(true)
  }

  function openEditItem(item: FBMenuItem) {
    setEditingItem(item)
    itemForm.reset({
      name: item.name,
      description: item.description ?? '',
      price: item.price,
      category_id: item.category_id ?? '',
      allergens: item.allergens?.join(', ') ?? '',
      tags: item.tags?.join(', ') ?? '',
      is_available: item.is_available,
    })
    setShowItemModal(true)
  }

  const filteredItems = filterCategory === 'all'
    ? items.filter((i) => i.is_active)
    : items.filter((i) => i.is_active && i.category_id === filterCategory)

  const categoryOptions = [
    { value: '', label: '— No Category —' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ]
  const filterOptions = [
    { value: 'all', label: 'All Categories' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ]

  const isLoading = catLoading || itemLoading

  const menuUrl = tenant ? `${window.location.origin}/menu/${tenant.slug}` : ''
  const qrSrc = menuUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=10&data=${encodeURIComponent(menuUrl)}` : ''

  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* QR Code banner */}
        {tenant && (
          <div className="bg-[#0F2138] rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-5">
            <img src={qrSrc} alt="Menu QR" className="w-28 h-28 rounded-xl bg-white p-1 shrink-0" />
            <div className="flex-1 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
                <QrCode size={16} className="text-amber-400" />
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Guest Menu QR Code</span>
              </div>
              <p className="text-white font-semibold text-sm mb-0.5">Print or display this QR code in rooms, at the bar & restaurant</p>
              <p className="text-white/50 text-xs mb-3 break-all">{menuUrl}</p>
              <div className="flex gap-2 justify-center sm:justify-start flex-wrap">
                <button
                  onClick={() => { navigator.clipboard.writeText(menuUrl); toast.success('Link copied!') }}
                  className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Copy size={12} /> Copy link
                </button>
                <a
                  href={menuUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  <ExternalLink size={12} /> Preview
                </a>
                <a
                  href={qrSrc} download={`${tenant.slug}-menu-qr.png`}
                  className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  <QrCode size={12} /> Download QR
                </a>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-body">Menu Management</h1>
            <p className="text-sm text-subtext">Manage your F&B menu items and categories</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setEditingCategory(null); catForm.reset(); setShowCategoryModal(true) }}>
              <Tag size={15} /> Category
            </Button>
            <Button size="sm" onClick={() => { setEditingItem(null); itemForm.reset({ is_available: true }); setShowItemModal(true) }}>
              <Plus size={15} /> Add Item
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-mid">
          {(['items', 'categories'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors ${
                activeTab === tab ? 'border-gold text-gold' : 'border-transparent text-subtext hover:text-body'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : activeTab === 'items' ? (
          <>
            <div className="flex items-center gap-3">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="rounded-lg border border-mid bg-white px-3 py-1.5 text-sm text-body focus:outline-none focus:ring-2 focus:ring-gold"
              >
                {filterOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <span className="text-sm text-subtext">{filteredItems.length} item(s)</span>
            </div>

            {filteredItems.length === 0 ? (
              <EmptyState title="No menu items" description="Add your first menu item to get started." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredItems.map((item) => (
                  <Card key={item.id} className="flex flex-col gap-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-body truncate">{item.name}</p>
                        {item.category && (
                          <span className="text-xs text-subtext">{item.category.name}</span>
                        )}
                      </div>
                      <p className="font-bold text-gold shrink-0 ml-2">{formatCurrency(item.price, tenant?.currency)}</p>
                    </div>
                    {item.description && (
                      <p className="text-xs text-subtext line-clamp-2">{item.description}</p>
                    )}
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {item.tags.map((tag) => (
                          <Badge key={tag} label={tag} className="bg-blue-50 text-blue-700 text-xs" />
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        onClick={() => toggleAvailability.mutate({ id: item.id, available: !item.is_available })}
                        className={`text-xs font-medium px-2 py-0.5 rounded-full transition-colors ${
                          item.is_available
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {item.is_available ? 'Available' : 'Unavailable'}
                      </button>
                      <div className="flex gap-1">
                        <button onClick={() => openEditItem(item)} className="p-1 text-subtext hover:text-body">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => deleteItem.mutate(item.id)} className="p-1 text-subtext hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {categories.length === 0 ? (
              <EmptyState title="No categories" description="Create categories to organise your menu." />
            ) : (
              <div className="space-y-2">
                {categories.map((cat) => {
                  const count = items.filter((i) => i.category_id === cat.id && i.is_active).length
                  return (
                    <div key={cat.id} className="flex items-center gap-4 rounded-xl bg-white shadow-sm ring-1 ring-mid px-4 py-3">
                      <div className="flex-1">
                        <p className="font-medium text-body">{cat.name}</p>
                        {cat.description && <p className="text-xs text-subtext">{cat.description}</p>}
                      </div>
                      <span className="text-sm text-subtext">{count} item(s)</span>
                      <div className="flex gap-1">
                        <button onClick={() => openEditCategory(cat)} className="p-1 text-subtext hover:text-body">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => deleteCategory.mutate(cat.id)} className="p-1 text-subtext hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Category Modal */}
      <Modal
        open={showCategoryModal}
        onClose={() => { setShowCategoryModal(false); setEditingCategory(null); catForm.reset() }}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
        size="sm"
      >
        <form onSubmit={catForm.handleSubmit((d) => saveCategory.mutate(d))} className="space-y-4">
          <Input label="Name" error={catForm.formState.errors.name?.message} {...catForm.register('name')} />
          <Input label="Description" {...catForm.register('description')} />
          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" type="button" onClick={() => { setShowCategoryModal(false); setEditingCategory(null); catForm.reset() }}>Cancel</Button>
            <Button type="submit" loading={saveCategory.isPending}>{editingCategory ? 'Update' : 'Add'}</Button>
          </div>
        </form>
      </Modal>

      {/* Item Modal */}
      <Modal
        open={showItemModal}
        onClose={() => { setShowItemModal(false); setEditingItem(null); itemForm.reset({ is_available: true }) }}
        title={editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
      >
        <form onSubmit={itemForm.handleSubmit((d) => saveItem.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label="Item Name" error={itemForm.formState.errors.name?.message} {...itemForm.register('name')} />
            </div>
            <Input label={`Price (${tenant?.currency ?? 'EUR'})`} type="number" step="0.01" min={0} error={itemForm.formState.errors.price?.message} {...itemForm.register('price')} />
            <Select label="Category" options={categoryOptions} {...itemForm.register('category_id')} />
            <div className="col-span-2">
              <Input label="Description" {...itemForm.register('description')} />
            </div>
            <Input label="Allergens (comma-separated)" placeholder="gluten, dairy, nuts" {...itemForm.register('allergens')} />
            <Input label="Tags (comma-separated)" placeholder="vegetarian, spicy, popular" {...itemForm.register('tags')} />
          </div>
          <label className="flex items-center gap-2 text-sm text-body cursor-pointer">
            <input type="checkbox" {...itemForm.register('is_available')} className="rounded border-mid" />
            Available for ordering
          </label>
          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" type="button" onClick={() => { setShowItemModal(false); setEditingItem(null); itemForm.reset({ is_available: true }) }}>Cancel</Button>
            <Button type="submit" loading={saveItem.isPending}>{editingItem ? 'Update' : 'Add Item'}</Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
