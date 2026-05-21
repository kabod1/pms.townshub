import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Palette, Globe, Mail } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

const schema = z.object({
  name: z.string().min(1, 'Hotel name required'),
  tagline: z.string().optional(),
  primary_color: z.string().optional(),
  accent_color: z.string().optional(),
  logo_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  favicon_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  custom_domain: z.string().optional(),
  email_from_name: z.string().optional(),
  email_from_address: z.string().email('Valid email required').optional().or(z.literal('')),
  email_signature: z.string().optional(),
  terms_url: z.string().optional(),
  privacy_url: z.string().optional(),
  support_url: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function BrandingSettings() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()

  const { register, handleSubmit, reset, watch, formState: { errors, isDirty } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (tenant) {
      reset({
        name: tenant.name,
        primary_color: '#0B1F4B',
        accent_color: '#C9A84C',
        logo_url: tenant.logo_url ?? '',
        email_from_name: tenant.name,
        email_from_address: tenant.email,
      })
    }
  }, [tenant, reset])

  const save = useMutation({
    mutationFn: async (data: FormData) => {
      await supabase.from('tenants').update({
        name: data.name,
        logo_url: data.logo_url || null,
        email: data.email_from_address || tenant?.email,
        settings: {
          tagline: data.tagline,
          primary_color: data.primary_color,
          accent_color: data.accent_color,
          favicon_url: data.favicon_url,
          custom_domain: data.custom_domain,
          email_from_name: data.email_from_name,
          email_signature: data.email_signature,
          terms_url: data.terms_url,
          privacy_url: data.privacy_url,
          support_url: data.support_url,
        },
      }).eq('id', tenant!.id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenant'] })
      toast.success('Branding settings saved')
    },
    onError: () => toast.error('Failed to save branding'),
  })

  const primaryColor = watch('primary_color') ?? '#0B1F4B'
  const accentColor = watch('accent_color') ?? '#C9A84C'
  const logoUrl = watch('logo_url')

  return (
    <DashboardLayout>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-xl font-bold text-body">White-Label Branding</h1>
          <p className="text-sm text-subtext">Customise your platform with your brand identity</p>
        </div>

        <form onSubmit={handleSubmit((d) => save.mutate(d))} className="space-y-6">
          {/* Identity */}
          <Card>
            <h2 className="text-sm font-semibold text-body mb-4 flex items-center gap-2">
              <Palette size={15} /> Brand Identity
            </h2>
            <div className="space-y-4">
              <Input label="Hotel / Brand Name" error={errors.name?.message} {...register('name')} />
              <Input label="Tagline" placeholder="Your luxury escape in the heart of Cyprus" {...register('tagline')} />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-body mb-1">Primary Colour</label>
                  <div className="flex items-center gap-2">
                    <input type="color" {...register('primary_color')} className="h-9 w-14 rounded border border-mid cursor-pointer" />
                    <input
                      type="text"
                      value={primaryColor}
                      readOnly
                      className="flex-1 rounded-lg border border-mid px-3 py-2 text-sm text-body bg-light"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-body mb-1">Accent Colour</label>
                  <div className="flex items-center gap-2">
                    <input type="color" {...register('accent_color')} className="h-9 w-14 rounded border border-mid cursor-pointer" />
                    <input
                      type="text"
                      value={accentColor}
                      readOnly
                      className="flex-1 rounded-lg border border-mid px-3 py-2 text-sm text-body bg-light"
                    />
                  </div>
                </div>
              </div>

              <Input label="Logo URL" placeholder="https://yourhotel.com/logo.png" error={errors.logo_url?.message} {...register('logo_url')} />
              {logoUrl && (
                <div className="mt-2">
                  <p className="text-xs text-subtext mb-1">Preview:</p>
                  <img src={logoUrl} alt="Logo preview" className="h-12 object-contain rounded border border-mid" />
                </div>
              )}
              <Input label="Favicon URL" placeholder="https://yourhotel.com/favicon.ico" {...register('favicon_url')} />
            </div>

            {/* Colour Preview */}
            <div className="mt-4 rounded-lg p-4 flex items-center gap-3" style={{ backgroundColor: primaryColor }}>
              <div className="h-8 w-8 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: accentColor }}>
                TH
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Brand Preview</p>
                <p className="text-white/70 text-xs">Your brand colours applied</p>
              </div>
            </div>
          </Card>

          {/* Domain */}
          <Card>
            <h2 className="text-sm font-semibold text-body mb-4 flex items-center gap-2">
              <Globe size={15} /> Custom Domain
            </h2>
            <div className="space-y-4">
              <Input
                label="Custom Domain"
                placeholder="pms.yourhotel.com"
                {...register('custom_domain')}
              />
              <p className="text-xs text-subtext">Point your DNS CNAME record to <code className="bg-light px-1.5 py-0.5 rounded text-body font-mono">app.townshub.cy</code> to activate your custom domain.</p>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Terms URL" placeholder="/terms" {...register('terms_url')} />
                <Input label="Privacy URL" placeholder="/privacy" {...register('privacy_url')} />
                <Input label="Support URL" placeholder="/support" {...register('support_url')} />
              </div>
            </div>
          </Card>

          {/* Email */}
          <Card>
            <h2 className="text-sm font-semibold text-body mb-4 flex items-center gap-2">
              <Mail size={15} /> Email Branding
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="From Name" placeholder="Grand Hotel" {...register('email_from_name')} />
                <Input label="From Email" type="email" error={errors.email_from_address?.message} {...register('email_from_address')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-body mb-1">Email Signature</label>
                <textarea
                  {...register('email_signature')}
                  rows={3}
                  placeholder="Kind regards,&#10;The Grand Hotel Team&#10;+357 99 999 999 | yourhotel.com"
                  className="w-full rounded-lg border border-mid px-3 py-2 text-sm text-body focus:outline-none focus:ring-2 focus:ring-gold resize-none"
                />
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" loading={save.isPending} disabled={!isDirty && !save.isPending}>
              Save Branding Settings
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  )
}
