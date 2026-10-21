'use client'

import { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { Plus, Search, Filter, Loader2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn, formatDate, getStatusLabel, getStatusColor } from '@/lib/utils'

interface Project {
  id: string
  title: string
  description: string | null
  status: string
  clientId: string
  managerId: string | null
  developerId: string | null
  startDate: string | null
  endDate: string | null
  budget: number | null
  updatedAt: string
  client: { id: string; name: string | null; email: string; image: string | null }
  manager: { id: string; name: string | null; email: string; image: string | null } | null
  developer: { id: string; name: string | null; email: string; image: string | null } | null
  stages: any[]
  _count: { messages: number; files: number; invoices: number }
}

function ProjectsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '')

  const fetchProjects = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/projects?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setProjects(data.projects || [])
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchProjects()
  }, [search, statusFilter])

  const statuses = ['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Проекты</h1>
          <p className="text-gray-600">Управляйте своими проектами и отслеживайте прогресс</p>
        </div>
        <Link href="/dashboard/projects/new" className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Новый проект
        </Link>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск проектов..."
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && router.push(`?search=${e.currentTarget.value}&status=${statusFilter}`)}
              className="input pl-10"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                router.push(`?search=${search}&status=${e.target.value}`)
              }}
              className="input pl-10 pr-8 appearance-none"
            >
              <option value="">Все статусы</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {getStatusLabel(status)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Projects list */}
      {isLoading ? (
        <div className="card p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-600" />
        </div>
      ) : projects.length === 0 ? (
        <div className="card p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">Проектов не найдено</h3>
          <p className="mt-1 text-gray-500">Попробуйте изменить фильтры или создать новый проект</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-600" /></div>}>
      <ProjectsContent />
    </Suspense>
  )
}

function ProjectCard({ project }: { project: Project }) {
  const completedTasks = project.stages.reduce((acc: number, stage: any) => {
    return acc + stage.tasks.filter((t: any) => t.completed).length
  }, 0)

  const totalTasks = project.stages.reduce((acc: number, stage: any) => {
    return acc + stage.tasks.length
  }, 0)

  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <Link href={`/dashboard/projects/${project.id}`} className="card p-5 hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between mb-4">
        <h3 className="font-semibold text-gray-900 line-clamp-1 group-hover:text-primary-600 transition-colors">
          {project.title}
        </h3>
        <span className={cn('badge', getStatusColor(project.status))}>
          {getStatusLabel(project.status)}
        </span>
      </div>

      {project.description && (
        <p className="text-sm text-gray-500 mb-4 line-clamp-2">{project.description}</p>
      )}

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-500">Прогресс</span>
            <span className="font-medium text-gray-900">{progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{completedTasks} / {totalTasks} задач</span>
          <span>{project._count.files} файлов</span>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>Обновлён {formatDate(project.updatedAt)}</span>
        </div>
      </div>
    </Link>
  )
}