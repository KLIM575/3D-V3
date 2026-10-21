'use client'

import { useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn, getStageLabel, getStatusLabel } from '@/lib/utils'

const stageSchema = z.object({
  title: z.string().min(1, 'Название обязательно').max(200),
  description: z.string().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED']),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
})

type StageForm = z.infer<typeof stageSchema>

interface StageModalProps {
  open: boolean
  onClose: () => void
  stage?: {
    id: string
    type: string
    title: string
    description: string | null
    status: string
    startDate: string | null
    dueDate: string | null
  }
  onSubmit: (stageId: string, data: StageForm) => Promise<void>
}

export function StageModal({ open, onClose, stage, onSubmit }: StageModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<StageForm>({
    resolver: zodResolver(stageSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'PENDING',
      startDate: '',
      dueDate: '',
    },
  })

  const status = watch('status')

  useEffect(() => {
    if (open && stage) {
      reset({
        title: stage.title,
        description: stage.description || '',
        status: stage.status as 'PENDING' | 'IN_PROGRESS' | 'REVIEW' | 'APPROVED' | 'REJECTED' | 'COMPLETED',
        startDate: stage.startDate ? stage.startDate.split('T')[0] : '',
        dueDate: stage.dueDate ? stage.dueDate.split('T')[0] : '',
      })
    }
  }, [open, stage, reset])

  const handleClose = () => {
    onClose()
    reset()
  }

  if (!open || !stage) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Настройки этапа</h2>
            <p className="text-sm text-gray-500">{getStageLabel(stage.type)}</p>
          </div>
          <button onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit((data) => onSubmit(stage.id, data))} className="p-4 space-y-4">
          <div>
            <label htmlFor="title" className="label">
              Название этапа
            </label>
            <input
              id="title"
              {...register('title')}
              className={cn('input', errors.title && 'input-error')}
              placeholder="Например: Дизайн главной страницы"
            />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
          </div>

          <div>
            <label htmlFor="description" className="label">
              Описание (необязательно)
            </label>
            <textarea
              id="description"
              {...register('description')}
              rows={3}
              className={cn('input', errors.description && 'input-error')}
              placeholder="Детали этапа..."
            />
            {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>}
          </div>

          <div>
            <label htmlFor="status" className="label">
              Статус
            </label>
            <select
              id="status"
              {...register('status')}
              className={cn('input', errors.status && 'input-error')}
            >
              <option value="PENDING">Ожидает</option>
              <option value="IN_PROGRESS">В процессе</option>
              <option value="REVIEW">На проверке</option>
              <option value="APPROVED">Утверждён</option>
              <option value="REJECTED">Отклонён</option>
              <option value="COMPLETED">Завершён</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="startDate" className="label">
                Дата начала
              </label>
              <input
                id="startDate"
                type="date"
                {...register('startDate')}
                className={cn('input', errors.startDate && 'input-error')}
              />
            </div>
            <div>
              <label htmlFor="dueDate" className="label">
                Дедлайн
              </label>
              <input
                id="dueDate"
                type="date"
                {...register('dueDate')}
                className={cn('input', errors.dueDate && 'input-error')}
              />
            </div>
          </div>

          {status === 'COMPLETED' && (
            <div className="p-3 bg-green-50 border border-green-100 rounded-lg text-sm text-green-800">
              При установке статуса «Завершён» будет проставлена дата завершения автоматически.
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="btn-secondary flex-1"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  Сохранение...
                </>
              ) : (
                'Сохранить'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}