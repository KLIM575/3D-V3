'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Plus, MoreVertical, Edit, Trash2, MessageSquare, FileText, Check, Loader2 } from 'lucide-react'
import { cn, getStageLabel, getStageColor, getStatusLabel, getStatusColor } from '@/lib/utils'
import { TaskModal } from '@/components/TaskModal'
import { StageModal } from '@/components/StageModal'

interface Project {
  id: string
  title: string
  description: string | null
  status: string
  clientId: string
  managerId: string | null
  developerId: string | null
  budget: number | null
  startDate: string | null
  endDate: string | null
  stages: Stage[]
  client: { name: string | null; email: string }
  manager: { name: string | null; email: string } | null
  developer: { name: string | null; email: string } | null
}

interface Stage {
  id: string
  type: string
  title: string
  description: string | null
  status: string
  order: number
  startDate: string | null
  dueDate: string | null
  tasks: Task[]
}

interface Task {
  id: string
  title: string
  description: string | null
  order: number
  completed: boolean
  completedAt: string | null
}

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params.id as string
  const [project, setProject] = useState<Project | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [taskModal, setTaskModal] = useState<{ open: boolean; stageId?: string; task?: Task }>({ open: false })
  const [stageModal, setStageModal] = useState<{ open: boolean; stage?: Stage }>({ open: false })

  const fetchProject = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}`)
      if (res.ok) {
        const data = await res.json()
        setProject(data)
      }
    } catch (error) {
      console.error('Failed to fetch project:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId, type } = result

    if (!destination) return

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }

    if (type === 'task') {
      await moveTask(draggableId, source.droppableId, destination.droppableId, destination.index)
    } else if (type === 'stage') {
      await moveStage(draggableId, destination.index)
    }
  }

  const moveTask = async (taskId: string, sourceStageId: string, destStageId: string, index: number) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stageId: destStageId, order: index }),
      })
      if (res.ok) fetchProject()
    } catch (error) {
      console.error('Failed to move task:', error)
    }
  }

  const moveStage = async (stageId: string, index: number) => {
    try {
      const res = await fetch(`/api/stages/${stageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: index }),
      })
      if (res.ok) fetchProject()
    } catch (error) {
      console.error('Failed to move stage:', error)
    }
  }

  const updateTask = async (taskId: string, data: Partial<Task>) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) fetchProject()
    } catch (error) {
      console.error('Failed to update task:', error)
    }
  }

  const createTask = async (stageId: string, data: { title: string; description?: string | null }) => {
    try {
      const res = await fetch(`/api/stages/${stageId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        fetchProject()
        setTaskModal({ open: false })
      }
    } catch (error) {
      console.error('Failed to create task:', error)
    }
  }

  const updateStage = async (stageId: string, data: Partial<Stage>) => {
    try {
      const res = await fetch(`/api/stages/${stageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        fetchProject()
        setStageModal({ open: false })
      }
    } catch (error) {
      console.error('Failed to update stage:', error)
    }
  }

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="card p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-600" />
        </div>
      ) : project ? (
        <>
          {/* Project header */}
          <div className="card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
                {project.description && (
                  <p className="mt-1 text-gray-600">{project.description}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={cn('badge', getStatusColor(project.status))}>
                  {getStatusLabel(project.status)}
                </span>
                <button className="btn-outline">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 border-t border-gray-100 pt-4">
              <span>Клиент: {project.client.name || project.client.email}</span>
              {project.manager && <span>Менеджер: {project.manager.name || project.manager.email}</span>}
              {project.developer && <span>Разработчик: {project.developer.name || project.developer.email}</span>}
              {project.budget && <span>Бюджет: {project.budget.toLocaleString()} ₽</span>}
            </div>
          </div>

          {/* Kanban board */}
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {project.stages.map((stage, index) => (
                <Draggable key={stage.id} draggableId={stage.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={cn(
                        'kanban-column transition-all duration-200',
                        snapshot.isDragging && 'shadow-xl'
                      )}
                    >
                      <div className={cn('stage-header', getStageColor(stage.type))}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{getStageLabel(stage.type)}</span>
                          <span className={cn('badge bg-white/20')}>{stage.tasks.length}</span>
                        </div>
                        <button
                          onClick={() => setStageModal({ open: true, stage })}
                          className="p-1 text-white/80 hover:text-white rounded hover:bg-white/10"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>

                      <Droppable droppableId={stage.id} type="task">
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              'stage-content',
                              snapshot.isDraggingOver && 'bg-primary-50'
                            )}
                          >
                            {stage.tasks.map((task, taskIndex) => (
                              <Draggable key={task.id} draggableId={task.id} index={taskIndex}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    onClick={() => setTaskModal({ open: true, stageId: stage.id, task })}
                                    className={cn(
                                      'kanban-card',
                                      snapshot.isDragging && 'kanban-card-dragging',
                                      task.completed && 'opacity-60 line-through'
                                    )}
                                  >
                                    <div className="flex items-start gap-2">
                                      <input
                                        type="checkbox"
                                        checked={task.completed}
                                        onChange={(e) => updateTask(task.id, { completed: e.target.checked })}
                                        className="mt-1 w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                                      />
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-gray-900 truncate">{task.title}</p>
                                        {task.description && (
                                          <p className="text-sm text-gray-500 truncate mt-1">{task.description}</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>

                      <button
                        onClick={() => setTaskModal({ open: true, stageId: stage.id })}
                        className="p-3 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors w-full text-left"
                      >
                        <Plus className="w-4 h-4 mr-2 inline" />
                        Добавить задачу
                      </button>
                    </div>
                  )}
                </Draggable>
              ))}
            </div>
          </DragDropContext>

          {/* Task Modal */}
<TaskModal
            open={taskModal.open}
            onClose={() => setTaskModal({ open: false })}
            stageId={taskModal.stageId}
            task={taskModal.task}
            onSubmit={taskModal.task
              ? (data) => updateTask(taskModal.task!.id, data)
              : (data) => createTask(taskModal.stageId!, data)
            }
/>

          {/* Stage Modal */}
          <StageModal
            open={stageModal.open}
            onClose={() => setStageModal({ open: false })}
            stage={stageModal.stage}
            onSubmit={updateStage}
          />
        </>
      ) : (
        <div className="card p-8 text-center">
          <h2 className="text-lg font-medium text-gray-900">Проект не найден</h2>
        </div>
      )}
    </div>
  )
}