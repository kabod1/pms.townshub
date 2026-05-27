/**
 * useSurveys — real Supabase-backed survey hooks
 *
 * Provides:
 *  - useSurveys()              — all submitted surveys (NPS + ratings) for the tenant
 *  - useSurveyTriggers()       — pending/sent auto-send triggers post-checkout
 *  - useSurveyTemplates()      — survey templates (create/edit/delete)
 *  - useSurveyQuestions(tplId) — questions for a template
 *  - useSurveyAnalytics()      — avg ratings per question
 *  - useCreateTemplate()       — create a new template
 *  - useDeleteTemplate()       — delete a template
 *  - useSaveQuestion()         — add/update a question
 *  - useDeleteQuestion()       — delete a question
 *  - useMarkTriggerSent()      — mark a survey trigger as 'sent'
 *  - surveyNpsStats()          — derived NPS stats from survey list
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import type { Survey } from '@/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SurveyTemplate {
  id:          string
  tenant_id:   string
  name:        string
  description: string | null
  is_active:   boolean
  is_default:  boolean
  created_by:  string | null
  created_at:  string
  updated_at:  string
}

export type SurveyQuestionType = 'rating' | 'nps' | 'text' | 'boolean' | 'choice'

export interface SurveyQuestion {
  id:          string
  template_id: string
  tenant_id:   string
  question:    string
  type:        SurveyQuestionType
  options:     string[]
  required:    boolean
  sort_order:  number
  created_at:  string
}

export interface SurveyTrigger {
  id:           string
  tenant_id:    string
  booking_id:   string
  guest_id:     string | null
  template_id:  string | null
  survey_link:  string
  status:       'pending' | 'sent' | 'completed' | 'skipped'
  scheduled_at: string
  sent_at:      string | null
  completed_at: string | null
  created_at:   string
  booking?: { booking_reference: string; check_in_date: string; check_out_date: string }
  guest?: { first_name: string; last_name: string; email: string | null }
}

export interface SurveyQuestionAnalytics {
  question_id:    string
  question:       string
  type:           SurveyQuestionType
  template_id:    string
  tenant_id:      string
  response_count: number
  avg_score:      number | null
  min_score:      number | null
  max_score:      number | null
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const surveyKeys = {
  surveys:    (tid: string) => ['surveys',            tid] as const,
  triggers:   (tid: string, status?: string) => ['survey-triggers',   tid, status] as const,
  templates:  (tid: string) => ['survey-templates',   tid] as const,
  questions:  (tid: string, tplId: string) => ['survey-questions', tid, tplId] as const,
  analytics:  (tid: string) => ['survey-analytics',   tid] as const,
}

// ── Survey list ───────────────────────────────────────────────────────────────

/** All submitted surveys, most recent first */
export function useSurveys() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: surveyKeys.surveys(tenant?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('surveys')
        .select('*, guest:guests(first_name, last_name), booking:bookings(booking_reference, check_in_date, check_out_date)')
        .eq('tenant_id', tenant!.id)
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return data as Survey[]
    },
    enabled: !!tenant,
    staleTime: 30_000,
  })
}

// ── Survey triggers ───────────────────────────────────────────────────────────

/** Pending (or all) survey triggers for post-checkout auto-send */
export function useSurveyTriggers(status: SurveyTrigger['status'] | 'all' = 'pending') {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: surveyKeys.triggers(tenant?.id ?? '', status),
    queryFn: async () => {
      let q = supabase
        .from('survey_triggers')
        .select('*, booking:bookings(booking_reference, check_in_date, check_out_date), guest:guests(first_name, last_name, email)')
        .eq('tenant_id', tenant!.id)
        .order('scheduled_at', { ascending: true })
        .limit(200)

      if (status !== 'all') q = q.eq('status', status)

      const { data, error } = await q
      if (error) throw error
      return data as SurveyTrigger[]
    },
    enabled: !!tenant,
    staleTime: 30_000,
  })
}

// ── Survey templates ──────────────────────────────────────────────────────────

export function useSurveyTemplates() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: surveyKeys.templates(tenant?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('survey_templates')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as SurveyTemplate[]
    },
    enabled: !!tenant,
    staleTime: 60_000,
  })
}

// ── Survey questions ──────────────────────────────────────────────────────────

export function useSurveyQuestions(templateId: string | null | undefined) {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: surveyKeys.questions(tenant?.id ?? '', templateId ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('survey_questions')
        .select('*')
        .eq('template_id', templateId!)
        .eq('tenant_id', tenant!.id)
        .order('sort_order')
      if (error) throw error
      return data as SurveyQuestion[]
    },
    enabled: !!tenant && !!templateId,
    staleTime: 60_000,
  })
}

// ── Analytics view ────────────────────────────────────────────────────────────

export function useSurveyAnalytics() {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: surveyKeys.analytics(tenant?.id ?? ''),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('survey_question_analytics')
        .select('*')
        .eq('tenant_id', tenant!.id)
      if (error) throw error
      return data as SurveyQuestionAnalytics[]
    },
    enabled: !!tenant,
    staleTime: 60_000,
  })
}

// ── Mutations ─────────────────────────────────────────────────────────────────

interface CreateTemplateVars {
  name:        string
  description?: string
  isDefault?:  boolean
}

export function useCreateTemplate() {
  const { tenant, user: profile } = useAuthStore()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, description, isDefault = false }: CreateTemplateVars) => {
      // If making default, unset current default first
      if (isDefault) {
        await supabase
          .from('survey_templates')
          .update({ is_default: false })
          .eq('tenant_id', tenant!.id)
          .eq('is_default', true)
      }

      const { data, error } = await supabase
        .from('survey_templates')
        .insert({
          tenant_id:   tenant!.id,
          name,
          description: description ?? null,
          is_active:   true,
          is_default:  isDefault,
          created_by:  profile?.id ?? null,
        })
        .select()
        .single()
      if (error) throw error
      return data as SurveyTemplate
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: surveyKeys.templates(tenant?.id ?? '') })
      toast.success('Survey template created')
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to create template'),
  })
}

export function useDeleteTemplate() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase
        .from('survey_templates')
        .delete()
        .eq('id', templateId)
        .eq('tenant_id', tenant!.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: surveyKeys.templates(tenant?.id ?? '') })
      toast.success('Template deleted')
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to delete'),
  })
}

interface SaveQuestionVars {
  templateId:  string
  questionId?: string   // present when editing
  question:    string
  type:        SurveyQuestionType
  options?:    string[]
  required?:   boolean
  sortOrder?:  number
}

export function useSaveQuestion() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ templateId, questionId, question, type, options = [], required = true, sortOrder = 0 }: SaveQuestionVars) => {
      const payload = {
        template_id: templateId,
        tenant_id:   tenant!.id,
        question,
        type,
        options,
        required,
        sort_order:  sortOrder,
      }

      if (questionId) {
        const { error } = await supabase
          .from('survey_questions')
          .update(payload)
          .eq('id', questionId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('survey_questions')
          .insert(payload)
        if (error) throw error
      }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: surveyKeys.questions(tenant?.id ?? '', vars.templateId) })
      toast.success(vars.questionId ? 'Question updated' : 'Question added')
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to save question'),
  })
}

export function useDeleteQuestion() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ questionId, templateId }: { questionId: string; templateId: string }) => {
      const { error } = await supabase
        .from('survey_questions')
        .delete()
        .eq('id', questionId)
        .eq('tenant_id', tenant!.id)
      if (error) throw error
      return templateId
    },
    onSuccess: (templateId) => {
      qc.invalidateQueries({ queryKey: surveyKeys.questions(tenant?.id ?? '', templateId) })
      toast.success('Question deleted')
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to delete'),
  })
}

export function useMarkTriggerSent() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (triggerId: string) => {
      const { error } = await supabase
        .from('survey_triggers')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', triggerId)
        .eq('tenant_id', tenant!.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['survey-triggers', tenant?.id] })
      toast.success('Survey marked as sent')
    },
    onError: (err: any) => toast.error(err.message ?? 'Failed to update trigger'),
  })
}

// ── NPS stats helper ──────────────────────────────────────────────────────────

export interface NpsStats {
  total:        number
  promoters:    number
  passives:     number
  detractors:   number
  npsScore:     number | null
  avgNps:       number | null
  avgOverall:   number | null
  recommendPct: number
}

export function surveyNpsStats(surveys: Survey[]): NpsStats {
  const withNps   = surveys.filter((s) => s.nps_score !== null)
  const promoters = withNps.filter((s) => (s.nps_score ?? 0) >= 9).length
  const detractors = withNps.filter((s) => (s.nps_score ?? 0) <= 6).length
  const passives  = withNps.length - promoters - detractors
  const npsScore  = withNps.length > 0
    ? Math.round(((promoters - detractors) / withNps.length) * 100)
    : null
  const avgNps    = withNps.length > 0
    ? Math.round(withNps.reduce((s, r) => s + (r.nps_score ?? 0), 0) / withNps.length)
    : null

  const withOverall = surveys.filter((s) => s.overall_rating != null)
  const avgOverall  = withOverall.length > 0
    ? withOverall.reduce((s, r) => s + (r.overall_rating ?? 0), 0) / withOverall.length
    : null

  const wouldRecommend = surveys.filter((s) => s.would_recommend === true).length
  const recommendPct   = surveys.length > 0
    ? Math.round((wouldRecommend / surveys.length) * 100)
    : 0

  return { total: surveys.length, promoters, passives, detractors, npsScore, avgNps, avgOverall, recommendPct }
}
