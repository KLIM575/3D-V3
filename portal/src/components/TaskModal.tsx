'use client'

import { useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { cn } from '@/lib/utils'

const taskSchema = z.object({
  title: z.string().min(1, 'Название обязательно').max(200),
  description: z.string().nullable().optional(),
  completed: z.boolean().default(false),
})

type TaskForm = z.infer<typeof taskSchema>

interface TaskModalProps {
  open: boolean
  onClose: () => void
  stageId?: string
  task?: TaskForm
  onSubmit: (data: TaskForm) => Promise<void>
}

export function TaskModal({ open, onClose, stageId, task, onSubmit }: TaskModalProps) {
  const isEditing = !!task

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<TaskForm>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      completed: false,
    },
  })

  useEffect(() => {
    if (open && task) {
      reset(task)
    } else if (open && !task) {
      reset({ title: '', description: '', completed: false })
    }
  }, [open, task, reset])

  const handleClose = () => {
    onClose()
    reset()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-xl shadow-xl animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Редактировать задачу' : 'Новая задача'}
          </h2>
          <button onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-4 space-y-4">
          <div>
            <label htmlFor="title" className="label">
              Название задачи
            </label>
            <input
              id="title"
              {...register('title')}
              className={cn('input', errors.title && 'input-error')}
              placeholder="Введите название задачи"
              autoFocus
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
              placeholder="Добавьте описание..."
            />
            {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>}
          </div>

          {isEditing && (
            <div className="flex items-center gap-2">
              <input
                id="completed"
                type="checkbox"
                {...register('completed')}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <label htmlFor="completed" className="text-sm text-gray-700 cursor-pointer">
                Задача выполнена
              </label>
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
              ) : isEditing ? (
                'Сохранить'
              ) : (
                'Создать'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}