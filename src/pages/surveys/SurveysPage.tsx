import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Star, Link2, Copy, Plus, Trash2, Send, LayoutList, ChevronDown, ChevronUp } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { StatCard } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import toast from 'react-hot-toast'
import {
  useSurveys,
  useSurveyTriggers,
  useSurveyTemplates,
  useSurveyQuestions,
  useCreateTemplate,
  useDeleteTemplate,
  useSaveQuestion,
  useDeleteQuestion,
  useMarkTriggerSent,
  surveyNpsStats,
  type SurveyTemplate,
  type SurveyQuestion,
  type SurveyQuestionType,
} from '@/hooks/useSurveys'

// ── Helpers ───────────────────────────────────────────────────────────────────

function RatingBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-subtext w-24 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-light rounded-full overflow-hidden">
        <div className="h-full bg-gold rounded-full" style={{ width: `${(value / 5) * 100}%` }} />
      </div>
      <span className="text-xs font-semibold text-body w-6 text-right">{value.toFixed(1)}</span>
    </div>
  )
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 10 }).map((_, i) => (
        <span key={i} className={`text-sm ${i < value ? 'text-gold' : 'text-gray-200'}`}>★</span>
      ))}
    </div>
  )
}

function npsCategory(score: number) {
  if (score >= 9) return { label: 'Promoter', color: 'bg-green-100 text-green-700' }
  if (score >= 7) return { label: 'Passive', color: 'bg-amber-100 text-amber-800' }
  return { label: 'Detractor', color: 'bg-red-100 text-red-700' }
}

function copySurveyLink(ref: string) {
  const url = `${window.location.origin}/survey/${ref}`
  navigator.clipboard.writeText(url)
    .then(() => toast.success('Survey link copied!'))
    .catch(() => toast.error('Copy failed'))
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const templateSchema = z.object({
  name:        z.string().min(1, 'Name required'),
  description: z.string().optional(),
  isDefault:   z.boolean().optional(),
})
type TemplateForm = z.infer<typeof templateSchema>

const questionSchema = z.object({
  question:   z.string().min(1, 'Question required'),
  type:       z.string().min(1),
  optionsRaw: z.string().optional(),   // comma-separated for 'choice' type
  required:   z.boolean().optional(),
})
type QuestionForm = z.infer<typeof questionSchema>

const QUESTION_TYPE_LABELS: Record<SurveyQuestionType, string> = {
  rating:  'Star Rating (1–5)',
  nps:     'NPS Score (0–10)',
  text:    'Open Text',
  boolean: 'Yes / No',
  choice:  'Multiple Choice',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TemplateQuestions({ template }: { template: SurveyTemplate }) {
  const [expanded, setExpanded] = useState(false)
  const [showAddQ, setShowAddQ] = useState(false)
  const [editQ, setEditQ] = useState<SurveyQuestion | null>(null)

  const { data: questions = [], isLoading } = useSurveyQuestions(template.id)
  const saveQ   = useSaveQuestion()
  const deleteQ = useDeleteQuestion()

  const qForm = useForm<QuestionForm>({
    resolver: zodResolver(questionSchema),
    defaultValues: { type: 'rating', required: true },
  })

  function openEdit(q: SurveyQuestion) {
    setEditQ(q)
    qForm.reset({
      question:   q.question,
      type:       q.type,
      optionsRaw: q.options?.join(', ') ?? '',
      required:   q.required,
    })
    setShowAddQ(true)
  }

  function closeModal() {
    setShowAddQ(false)
    setEditQ(null)
    qForm.reset({ type: 'rating', required: true })
  }

  function onSubmitQ(data: QuestionForm) {
    const opts = data.optionsRaw
      ? data.optionsRaw.split(',').map((s) => s.trim()).filter(Boolean)
      : []
    saveQ.mutate({
      templateId:  template.id,
      questionId:  editQ?.id,
      question:    data.question,
      type:        data.type as SurveyQuestionType,
      options:     opts,
      required:    data.required ?? true,
      sortOrder:   editQ?.sort_order ?? questions.length,
    }, { onSuccess: closeModal })
  }

  return (
    <div className="mt-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs text-subtext hover:text-body"
      >
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {questions.length} question{questions.length !== 1 ? 's' : ''}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 pl-2 border-l border-mid">
          {isLoading ? (
            <p className="text-xs text-subtext">Loading…</p>
          ) : questions.length === 0 ? (
            <p className="text-xs text-subtext italic">No questions yet.</p>
          ) : (
            questions.map((q, idx) => (
              <div key={q.id} className="flex items-center justify-between gap-2 rounded-lg bg-light px-3 py-2">
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-subtext mr-2">{idx + 1}.</span>
                  <span className="text-xs text-body">{q.question}</span>
                  <Badge label={QUESTION_TYPE_LABELS[q.type] ?? q.type} className="ml-2 bg-blue-50 text-blue-700 text-xs" />
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(q)}
                    className="p-1 text-subtext hover:text-navy text-xs"
                    title="Edit"
                  >Edit</button>
                  <button
                    onClick={() => deleteQ.mutate({ questionId: q.id, templateId: template.id })}
                    className="p-1 text-subtext hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
          <button
            onClick={() => { setEditQ(null); qForm.reset({ type: 'rating', required: true }); setShowAddQ(true) }}
            className="flex items-center gap-1 text-xs text-blue hover:underline mt-1"
          >
            <Plus size={12} /> Add question
          </button>
        </div>
      )}

      <Modal
        open={showAddQ}
        onClose={closeModal}
        title={editQ ? 'Edit Question' : 'Add Question'}
        size="sm"
      >
        <form onSubmit={qForm.handleSubmit(onSubmitQ)} className="space-y-4">
          <Input
            label="Question text"
            error={qForm.formState.errors.question?.message}
            {...qForm.register('question')}
          />
          <Select
            label="Type"
            options={Object.entries(QUESTION_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
            {...qForm.register('type')}
          />
          {qForm.watch('type') === 'choice' && (
            <Input
              label="Options (comma-separated)"
              placeholder="Option A, Option B, Option C"
              {...qForm.register('optionsRaw')}
            />
          )}
          <label className="flex items-center gap-2 text-sm text-body cursor-pointer">
            <input type="checkbox" {...qForm.register('required')} className="rounded" />
            Required
          </label>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" type="button" onClick={closeModal}>Cancel</Button>
            <Button type="submit" loading={saveQ.isPending}>{editQ ? 'Update' : 'Add'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type Tab = 'responses' | 'templates' | 'triggers'

export default function SurveysPage() {
  const [activeTab, setActiveTab] = useState<Tab>('responses')
  const [showTemplateModal, setShowTemplateModal] = useState(false)

  const { data: surveys     = [], isLoading: surveyLoading }   = useSurveys()
  const { data: templates   = [], isLoading: tplLoading }      = useSurveyTemplates()
  const { data: allTriggers = [], isLoading: triggerLoading }  = useSurveyTriggers('all')

  const createTemplate = useCreateTemplate()
  const deleteTemplate = useDeleteTemplate()
  const markSent       = useMarkTriggerSent()

  const tplForm = useForm<TemplateForm>({ resolver: zodResolver(templateSchema) })

  const stats = surveyNpsStats(surveys)

  const pendingTriggers   = allTriggers.filter((t) => t.status === 'pending')
  const sentTriggers      = allTriggers.filter((t) => t.status === 'sent')
  const completedTriggers = allTriggers.filter((t) => t.status === 'completed')

  function onSubmitTemplate(data: TemplateForm) {
    createTemplate.mutate(data, {
      onSuccess: () => { setShowTemplateModal(false); tplForm.reset() },
    })
  }

  const isLoading = surveyLoading || tplLoading || triggerLoading

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-body">Guest Satisfaction Surveys</h1>
            <p className="text-sm text-subtext">NPS scores, post-stay feedback, and survey templates</p>
          </div>
          <div className="flex items-center gap-2">
            <Link2 size={14} className="text-subtext" />
            <code className="text-xs bg-light px-2 py-1 rounded-md text-body font-mono truncate max-w-[180px]">
              /survey/BOOKING_REF
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const example = `${window.location.origin}/survey/HTL-XXXXXX`
                navigator.clipboard.writeText(example)
                  .then(() => toast.success('Example link copied — replace XXXXXX with booking ref'))
                  .catch(() => {})
              }}
            >
              <Copy size={14} /> Copy template
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                title="NPS Score"
                value={stats.npsScore !== null ? `${stats.npsScore > 0 ? '+' : ''}${stats.npsScore}` : '—'}
                subtitle="Net Promoter Score"
                icon={<Star size={20} />}
                color="gold"
              />
              <StatCard
                title="Avg NPS Rating"
                value={stats.avgNps !== null ? `${stats.avgNps}/10` : '—'}
                subtitle="Average out of 10"
                icon={<Star size={20} />}
                color="green"
              />
              <StatCard
                title="Overall Rating"
                value={stats.avgOverall !== null ? `${stats.avgOverall.toFixed(1)}/5` : '—'}
                icon={<Star size={20} />}
                color="navy"
              />
              <StatCard
                title="Would Recommend"
                value={`${stats.recommendPct}%`}
                subtitle={`${surveys.filter((s) => s.would_recommend).length} of ${surveys.length}`}
                icon={<Star size={20} />}
                color="blue"
              />
            </div>

            {/* NPS breakdown */}
            {stats.promoters + stats.passives + stats.detractors > 0 && (
              <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-3 sm:p-5">
                <h2 className="text-sm font-semibold text-body mb-3">NPS Breakdown</h2>
                <div className="flex gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{stats.promoters}</p>
                    <p className="text-xs text-subtext">Promoters (9–10)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-600">{stats.passives}</p>
                    <p className="text-xs text-subtext">Passives (7–8)</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">{stats.detractors}</p>
                    <p className="text-xs text-subtext">Detractors (0–6)</p>
                  </div>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 border-b border-mid">
              {([
                ['responses', 'Responses', surveys.length],
                ['templates', 'Templates', templates.length],
                ['triggers',  'Auto-send Triggers', pendingTriggers.length],
              ] as const).map(([tab, label, count]) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === tab
                      ? 'border-gold text-gold'
                      : 'border-transparent text-subtext hover:text-body'
                  }`}
                >
                  {label}
                  {count > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                      activeTab === tab ? 'bg-gold text-white' : 'bg-light text-subtext'
                    }`}>{count}</span>
                  )}
                </button>
              ))}
            </div>

            {/* ── RESPONSES TAB ── */}
            {activeTab === 'responses' && (
              surveys.length === 0 ? (
                <EmptyState
                  icon={<Star size={32} />}
                  title="No surveys yet"
                  description="Guest surveys appear here after post-stay emails are sent."
                />
              ) : (
                <div className="space-y-3">
                  {surveys.map((survey) => {
                    const guest   = survey.guest as { first_name: string; last_name: string } | null
                    const booking = survey.booking as { booking_reference: string } | null
                    return (
                      <div key={survey.id} className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-4">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-body">
                                {guest ? `${guest.first_name} ${guest.last_name}` : 'Anonymous'}
                              </p>
                              {booking && (
                                <button
                                  onClick={() => copySurveyLink(booking.booking_reference)}
                                  className="flex items-center gap-1 text-xs text-subtext font-mono hover:text-navy"
                                  title="Copy survey link"
                                >
                                  {booking.booking_reference}
                                  <Copy size={11} />
                                </button>
                              )}
                              {survey.nps_score !== null && (
                                <Badge
                                  label={npsCategory(survey.nps_score).label}
                                  className={npsCategory(survey.nps_score).color + ' text-xs'}
                                />
                              )}
                              {survey.would_recommend && (
                                <Badge label="Would recommend" className="bg-green-100 text-green-700 text-xs" />
                              )}
                            </div>
                            {survey.nps_score !== null && (
                              <div className="mt-1.5">
                                <p className="text-xs text-subtext mb-0.5">NPS: {survey.nps_score}/10</p>
                                <StarRating value={survey.nps_score} />
                              </div>
                            )}
                            <div className="mt-2 space-y-1">
                              <RatingBar label="Cleanliness" value={survey.cleanliness_rating} />
                              <RatingBar label="Service"     value={survey.service_rating} />
                              <RatingBar label="Amenities"   value={survey.amenities_rating} />
                              <RatingBar label="Overall"     value={survey.overall_rating} />
                            </div>
                            {survey.comments && (
                              <p className="mt-2 text-sm text-body italic border-l-2 border-gold pl-3">
                                "{survey.comments}"
                              </p>
                            )}
                          </div>
                          <span className="text-xs text-subtext shrink-0">
                            {new Date(survey.submitted_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {/* ── TEMPLATES TAB ── */}
            {activeTab === 'templates' && (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => { tplForm.reset(); setShowTemplateModal(true) }}>
                    <Plus size={15} /> New Template
                  </Button>
                </div>
                {templates.length === 0 ? (
                  <EmptyState
                    icon={<LayoutList size={32} />}
                    title="No templates yet"
                    description="Create a survey template to customise the questions guests see."
                  />
                ) : (
                  <div className="space-y-3">
                    {templates.map((tpl) => (
                      <div key={tpl.id} className="rounded-xl bg-white shadow-sm ring-1 ring-mid p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-body">{tpl.name}</p>
                              {tpl.is_default && (
                                <Badge label="Default" className="bg-gold text-white text-xs" />
                              )}
                              {!tpl.is_active && (
                                <Badge label="Inactive" className="bg-gray-100 text-gray-500 text-xs" />
                              )}
                            </div>
                            {tpl.description && (
                              <p className="text-xs text-subtext mt-0.5">{tpl.description}</p>
                            )}
                            <TemplateQuestions template={tpl} />
                          </div>
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete template "${tpl.name}"? This also deletes its questions.`)) {
                                deleteTemplate.mutate(tpl.id)
                              }
                            }}
                            className="p-1.5 text-subtext hover:text-red-600 shrink-0"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TRIGGERS TAB ── */}
            {activeTab === 'triggers' && (
              <div className="space-y-4">
                {/* Summary pills */}
                <div className="flex gap-3 flex-wrap">
                  <span className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-semibold">
                    {pendingTriggers.length} Pending
                  </span>
                  <span className="rounded-full bg-blue-100 text-blue-800 px-3 py-1 text-xs font-semibold">
                    {sentTriggers.length} Sent
                  </span>
                  <span className="rounded-full bg-green-100 text-green-700 px-3 py-1 text-xs font-semibold">
                    {completedTriggers.length} Completed
                  </span>
                </div>

                {allTriggers.length === 0 ? (
                  <EmptyState
                    icon={<Send size={32} />}
                    title="No triggers yet"
                    description="Survey triggers are auto-created when a booking is checked out."
                  />
                ) : (
                  <div className="space-y-2">
                    {allTriggers.map((trigger) => {
                      const booking = trigger.booking as { booking_reference: string; check_out_date: string } | null
                      const guest   = trigger.guest as { first_name: string; last_name: string; email: string | null } | null
                      const statusColors: Record<string, string> = {
                        pending:   'bg-amber-100 text-amber-800',
                        sent:      'bg-blue-100 text-blue-800',
                        completed: 'bg-green-100 text-green-700',
                        skipped:   'bg-gray-100 text-gray-500',
                      }
                      return (
                        <div key={trigger.id} className="rounded-xl bg-white shadow-sm ring-1 ring-mid px-4 py-3 flex items-center gap-4 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-body">
                                {guest ? `${guest.first_name} ${guest.last_name}` : 'Guest'}
                              </p>
                              {booking && (
                                <span className="text-xs text-subtext font-mono">{booking.booking_reference}</span>
                              )}
                              <Badge
                                label={trigger.status.charAt(0).toUpperCase() + trigger.status.slice(1)}
                                className={`text-xs ${statusColors[trigger.status] ?? 'bg-gray-100 text-gray-600'}`}
                              />
                            </div>
                            {guest?.email && (
                              <p className="text-xs text-subtext mt-0.5">{guest.email}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-subtext">
                                Scheduled: {new Date(trigger.scheduled_at).toLocaleString()}
                              </span>
                              <button
                                onClick={() => copySurveyLink(trigger.survey_link.replace('/survey/', ''))}
                                className="flex items-center gap-0.5 text-xs text-blue hover:underline"
                                title="Copy survey link"
                              >
                                <Copy size={11} /> Copy link
                              </button>
                            </div>
                          </div>
                          {trigger.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="outline"
                              loading={markSent.isPending}
                              onClick={() => markSent.mutate(trigger.id)}
                            >
                              <Send size={13} /> Mark Sent
                            </Button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* New Template Modal */}
      <Modal
        open={showTemplateModal}
        onClose={() => { setShowTemplateModal(false); tplForm.reset() }}
        title="New Survey Template"
        size="sm"
      >
        <form onSubmit={tplForm.handleSubmit(onSubmitTemplate)} className="space-y-4">
          <Input
            label="Template name"
            placeholder="Post-Stay Survey"
            error={tplForm.formState.errors.name?.message}
            {...tplForm.register('name')}
          />
          <Input
            label="Description (optional)"
            {...tplForm.register('description')}
          />
          <label className="flex items-center gap-2 text-sm text-body cursor-pointer">
            <input type="checkbox" {...tplForm.register('isDefault')} className="rounded" />
            Set as default template
          </label>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" type="button" onClick={() => setShowTemplateModal(false)}>Cancel</Button>
            <Button type="submit" loading={createTemplate.isPending}>Create</Button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  )
}
