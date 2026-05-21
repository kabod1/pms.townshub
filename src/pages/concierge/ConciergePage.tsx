import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, MapPin, Pencil, Trash2, Globe } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import type { ConciergeItem, ConciergeCategory } from '@/types'

const categorySchema = z.object({
  name: z.string().min(1, 'Name required'),
  icon: z.string().optional(),
})
type CategoryForm = z.infer<typeof categorySchema>

const itemSchema = z.object({
  title: z.string().min(1, 'Title required'),
  description: z.string().optional(),
  category_id: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  distance_minutes: z.coerce.number().optional(),
  tags: z.string().optional(),
})
type ItemForm = z.infer<typeof itemSchema>

function useCategories() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['concierge-categories', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('concierge_categories')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('sort_order')
      if (error) throw error
      return data as ConciergeCategory[]
    },
    enabled: !!tenant,
  })
}

function useItems() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['concierge-items', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('concierge_items')
        .select('*, category:concierge_categories(id,name)')
        .eq('tenant_id', tenant!.id)
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return data as ConciergeItem[]
    },
    enabled: !!tenant,
  })
}

export default function ConciergePage() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showItemModal, setShowItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<ConciergeItem | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')

  const { data: categories = [], isLoading: catLoading } = useCategories()
  const { data: items = [], isLoading: itemLoading } = useItems()

  const catForm = useForm<CategoryForm>({ resolver: zodResolver(categorySchema) })
  const itemForm = useForm<ItemForm>({ resolver: zodResolver(itemSchema) })

  const saveCategory = useMutation({
    mutationFn: async (data: CategoryForm) => {
      await supabase.from('concierge_categories').insert({
        ...data,
        tenant_id: tenant!.id,
        sort_order: categories.length,
        is_active: true,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['concierge-categories'] })
      toast.success('Category added')
      setShowCategoryModal(false)
      catForm.reset()
    },
  })

  const saveItem = useMutation({
    mutationFn: async (data: ItemForm) => {
      const payload = {
        title: data.title,
        description: data.description || null,
        category_id: data.category_id || null,
        address: data.address || null,
        phone: data.phone || null,
        website: data.website || null,
        distance_minutes: data.distance_minutes || null,
        tags: data.tags ? data.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
        tenant_id: tenant!.id,
        sort_order: editingItem ? editingItem.sort_order : items.length,
        is_active: true,
      }
      if (editingItem) {
        await supabase.from('concierge_items').update(payload).eq('id', editingItem.id)
      } else {
        await supabase.from('concierge_items').insert(payload)
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['concierge-items'] })
      toast.success(editingItem ? 'Item updated' : 'Item added')
      setShowItemModal(false)
      setEditingItem(null)
      itemForm.reset()
    },
    onError: () => toast.error('Failed to save item'),
  })

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('concierge_items').update({ is_active: false }).eq('id', id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['concierge-items'] })
      toast.success('Item removed')
    },
  })

  function openEditItem(item: ConciergeItem) {
    setEditingItem(item)
    itemForm.reset({
      title: item.title,
      description: item.description ?? '',
      category_id: item.category_id ?? '',
      address: item.address ?? '',
      phone: item.phone ?? '',
      website: item.website ?? '',
      distance_minutes: item.distance_minutes ?? undefined,
      tags: item.tags?.join(', ') ?? '',
    })
    setShowItemModal(true)
  }

  const filteredItems = filterCategory === 'all'
    ? items
    : items.filter((i) => i.category_id === filterCategory)

  const categoryOptions = [
    { value: '', label: '— No Category —' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ]

  const isLoading = catLoading || itemLoading

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-body">Digital Concierge</h1>
            <p className="text-sm text-subtext">Local guide, recommendations, and guest information</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { catForm.reset(); setShowCategoryModal(true) }}>
              <Plus size={15} /> Category
            </Button>
            <Button size="sm" onClick={() => { setEditingItem(null); itemForm.reset(); setShowItemModal(true) }}>
              <Plus size={15} /> Add Place
            </Button>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterCategory === 'all' ? 'bg-navy text-white' : 'bg-light text-subtext hover:text-body'}`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilterCategory(c.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterCategory === c.id ? 'bg-navy text-white' : 'bg-light text-subtext hover:text-body'}`}
            >
              {c.icon && <span className="mr-1">{c.icon}</span>}
              {c.name}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : filteredItems.length === 0 ? (
          <EmptyState icon={<MapPin size={32} />} title="No places added" description="Add local restaurants, attractions, and services for your guests." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <div key={item.id} className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-body truncate">{item.title}</p>
                    {item.category && (
                      <span className="text-xs text-subtext">{item.category.name}</span>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => openEditItem(item)} className="p-1 text-subtext hover:text-body"><Pencil size={13} /></button>
                    <button onClick={() => deleteItem.mutate(item.id)} className="p-1 text-subtext hover:text-red-600"><Trash2 size={13} /></button>
                  </div>
                </div>

                {item.description && (
                  <p className="text-xs text-subtext mt-1 line-clamp-2">{item.description}</p>
                )}

                <div className="mt-2 space-y-1">
                  {item.address && (
                    <div className="flex items-center gap-1.5 text-xs text-subtext">
                      <MapPin size={11} />
                      <span className="truncate">{item.address}</span>
                    </div>
                  )}
                  {item.distance_minutes && (
                    <p className="text-xs text-subtext">{item.distance_minutes} min away</p>
                  )}
                  {item.phone && (
                    <p className="text-xs text-subtext">{item.phone}</p>
                  )}
                  {item.website && (
                    <a href={item.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue hover:underline">
                      <Globe size={11} /> Website
                    </a>
                  )}
                </div>

                {item.tags && item.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.tags.map((tag) => (
                      <Badge key={tag} label={tag} className="bg-blue-50 text-blue-700 text-xs" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category Modal */}
      <Modal
        open={showCategoryModal}
        onClose={() => { setShowCategoryModal(false); catForm.reset() }}
        title="Add Category"
        size="sm"
      >
        <form onSubmit={catForm.handleSubmit((d) => saveCategory.mutate(d))} className="space-y-4">
          <Input label="Category Name" error={catForm.formState.errors.name?.message} {...catForm.register('name')} />
          <Input label="Icon (emoji)" placeholder="🍽️" {...catForm.register('icon')} />
          <div className="flex gap-3 justify-end">
            <Button variant="outline" type="button" onClick={() => setShowCategoryModal(false)}>Cancel</Button>
            <Button type="submit" loading={saveCategory.isPending}>Add</Button>
          </div>
        </form>
      </Modal>

      {/* Item Modal */}
      <Modal
        open={showItemModal}
        onClose={() => { setShowItemModal(false); setEditingItem(null); itemForm.reset() }}
        title={editingItem ? 'Edit Place' : 'Add Place'}
      >
        <form onSubmit={itemForm.handleSubmit((d) => saveItem.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Input label="Title" error={itemForm.formState.errors.title?.message} {...itemForm.register('title')} />
            </div>
            <Select label="Category" options={categoryOptions} {...itemForm.register('category_id')} />
            <Input label="Distance (minutes)" type="number" min={0} {...itemForm.register('distance_minutes')} />
            <div className="col-span-2">
              <Input label="Description" {...itemForm.register('description')} />
            </div>
            <Input label="Address" {...itemForm.register('address')} />
            <Input label="Phone" {...itemForm.register('phone')} />
            <div className="col-span-2">
              <Input label="Website URL" type="url" {...itemForm.register('website')} />
            </div>
            <div className="col-span-2">
              <Input label="Tags (comma-separated)" placeholder="restaurant, outdoor, family-friendly" {...itemForm.register('tags')} />
            </div>
          </div>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" type="button" onClick={() => setShowItemModal(false)}>Cancel</Button>
            <Button type="submit" loading={saveItem.isPending}>{editingItem ? 'Update' : 'Add'}</Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
