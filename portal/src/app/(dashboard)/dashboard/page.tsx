import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Дашборд | Client Portal',
  description: 'Обзор ваших проектов и задач',
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/auth/signin')
  }

  return <DashboardContent userId={session.user.id} userRole={session.user.role} />
}

async function DashboardContent({ userId, userRole }: { userId: string; userRole: string }) {
  const where: any = {}

  if (userRole === 'CLIENT') where.clientId = userId
  else if (userRole === 'MANAGER') where.managerId = userId
  else if (userRole === 'DEVELOPER') where.developerId = userId

  const [projects, stats] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, email: true } },
        manager: { select: { id: true, name: true, email: true } },
        stages: {
          include: { tasks: true },
          orderBy: { order: 'asc' },
        },
        _count: { select: { messages: true, files: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.project.aggregate({
      where,
      _count: { id: true },
    }),
  ])

  const activeProjects = projects.filter((p) => p.status === 'ACTIVE')
  const completedProjects = projects.filter((p) => p.status === 'COMPLETED')

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Добро пожаловать обратно!</h1>
        <p className="mt-1 text-gray-600">Вот обзор ваших проектов и задач</p>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Всего проектов" value={stats._count.id} icon="folder" color="blue" />
        <StatCard title="Активных" value={activeProjects.length} icon="play" color="green" />
        <StatCard title="Завершённых" value={completedProjects.length} icon="check" color="purple" />
        <StatCard title="На паузе" value={projects.filter((p) => p.status === 'ON_HOLD').length} icon="pause" color="yellow" />
      </div>

      {/* Recent projects */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Недавние проекты</h2>
          <a href="/dashboard/projects" className="text-sm text-primary-600 hover:underline">
            Все проекты →
          </a>
        </div>

        {projects.length === 0 ? (
          <div className="card p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">Проектов пока нет</h3>
            <p className="mt-1 text-gray-500">Ваши проекты появятся здесь после создания</p>
            {userRole !== 'CLIENT' && (
              <a href="/dashboard/projects/new" className="mt-4 inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Создать проект
              </a>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ title, value, icon, color }: { title: string; value: number; icon: string; color: string }) {
  const colors = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    yellow: 'bg-yellow-500',
  }

  const icons: Record<string, React.ReactNode> = {
    folder: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
    play: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z" /></svg>,
    check: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    pause: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={cn('p-3 rounded-xl', colors[color as keyof typeof colors] || 'bg-gray-500')}>
          {icons[icon]}
        </div>
      </div>
    </div>
  )
}

function ProjectCard({ project }: { project: any }) {
  const completedTasks = project.stages.reduce((acc: number, stage: any) => {
    return acc + stage.tasks.filter((t: any) => t.completed).length
  }, 0)

  const totalTasks = project.stages.reduce((acc: number, stage: any) => {
    return acc + stage.tasks.length
  }, 0)

  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800',
    ACTIVE: 'bg-blue-100 text-blue-800',
    ON_HOLD: 'bg-yellow-100 text-yellow-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
  }

  const statusLabels: Record<string, string> = {
    DRAFT: 'Черновик',
    ACTIVE: 'Активен',
    ON_HOLD: 'На паузе',
    COMPLETED: 'Завершён',
    CANCELLED: 'Отменён',
  }

  return (
    <Link href={`/dashboard/projects/${project.id}`} className="card p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <h3 className="font-semibold text-gray-900 line-clamp-1">{project.title}</h3>
        <span className={cn('badge', statusColors[project.status])}>
          {statusLabels[project.status]}
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
          <span>{project._count.messages} сообщений</span>
        </div>
      </div>
    </Link>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}