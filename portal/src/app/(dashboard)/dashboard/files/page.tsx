'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Upload, Download, Trash2, Search, Filter, Loader2, MoreVertical, FileText, Image, Archive, Eye } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { cn, formatFileSize, formatDate, getFileCategoryLabel, getFileIcon } from '@/lib/utils'

interface FileItem {
  id: string
  name: string
  originalName: string
  mimeType: string
  size: number
  category: string
  url: string
  createdAt: string
  uploader: { name: string | null; email: string; image: string | null }
  stage: { id: string; title: string; type: string } | null
}

export default function FilesPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const [files, setFiles] = useState<FileItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')

  const categories = ['FIGMA', 'CONTRACT', 'ACT', 'ARCHIVE', 'DESIGN', 'DOCUMENT', 'OTHER']

  const fetchFiles = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (categoryFilter) params.set('category', categoryFilter)
      if (stageFilter) params.set('stageId', stageFilter)

      const res = await fetch(`/api/projects/${projectId}/files?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setFiles(data)
      }
    } catch (error) {
      console.error('Failed to fetch files:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchFiles()
  }, [projectId, categoryFilter, stageFilter])

  const onDrop = async (acceptedFiles: File[]) => {
    setUploading(true)
    try {
      for (const file of acceptedFiles) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('projectId', projectId)

        const res = await fetch(`/api/projects/${projectId}/files`, {
          method: 'POST',
          body: formData,
        })
        if (res.ok) {
          const newFile = await res.json()
          setFiles((prev) => [newFile, ...prev])
        }
      }
    } catch (error) {
      console.error('Failed to upload file:', error)
    } finally {
      setUploading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': [],
      'application/pdf': [],
      'application/zip': [],
      'application/x-rar-compressed': [],
      'application/json': ['.figma'],
    },
    maxSize: 10 * 1024 * 1024,
  })

  const handleDownload = async (file: FileItem) => {
    try {
      const res = await fetch(`/api/files/${projectId}/${file.name}`)
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = file.originalName
        a.click()
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Failed to download file:', error)
    }
  }

  const handleDelete = async (fileId: string) => {
    if (!confirm('Удалить этот файл?')) return

    try {
      const res = await fetch(`/api/files/${fileId}`, { method: 'DELETE' })
      if (res.ok) {
        setFiles((prev) => prev.filter((f) => f.id !== fileId))
      }
    } catch (error) {
      console.error('Failed to delete file:', error)
    }
  }

  const filteredFiles = files.filter((file) => {
    const matchesSearch = file.originalName.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = !categoryFilter || file.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Файлы</h1>
          <p className="text-gray-600">Управляйте файлами проекта</p>
        </div>
        <div {...getRootProps()} className="btn-primary relative">
          <Upload className="w-5 h-5 mr-2" />
          Загрузить файл
          <input {...getInputProps()} />
        </div>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'dropzone',
          isDragActive && 'dropzone-active',
          uploading && 'opacity-50 pointer-events-none'
        )}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-lg text-gray-600">
          {isDragActive ? 'Отпустите файл сюда...' : 'Перетащите файлы сюда или нажмите для загрузки'}
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Поддерживаемые форматы: изображения, PDF, ZIP, FIGMA (макс. 10 МБ)
        </p>
        {uploading && <Loader2 className="mx-auto mt-4 h-8 w-8 animate-spin text-primary-600" />}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Поиск файлов..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="input max-w-xs"
          >
            <option value="">Все категории</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{getFileCategoryLabel(cat)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Files list */}
      {isLoading ? (
        <div className="card p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-600" />
        </div>
      ) : filteredFiles.length === 0 ? (
        <div className="card p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900">Файлов не найдено</h3>
          <p className="mt-1 text-gray-500">Загрузите первый файл или измените фильтры</p>
        </div>
      ) : (
        <div className="card divide-y divide-gray-100">
          {filteredFiles.map((file) => (
            <FileRow key={file.id} file={file} onDownload={handleDownload} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}

function FileRow({ file, onDownload, onDelete }: { file: FileItem; onDownload: (file: FileItem) => void; onDelete: (id: string) => void }) {
  const [showMenu, setShowMenu] = useState(false)
  const icon = getFileIcon(file.mimeType)

  const icons: Record<string, React.ReactNode> = {
    image: <Image className="w-5 h-5" />,
    video: <FileText className="w-5 h-5" />,
    music: <FileText className="w-5 h-5" />,
    'file-text': <FileText className="w-5 h-5" />,
    archive: <Archive className="w-5 h-5" />,
    figma: <FileText className="w-5 h-5" />,
    file: <FileText className="w-5 h-5" />,
  }

  return (
    <div className="file-item relative">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-100 rounded-lg">
          {icons[icon] || <FileText className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{file.originalName}</p>
          <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
            <span>{formatFileSize(file.size)}</span>
            <span className={cn('badge bg-gray-100 text-gray-600')}>
              {getFileCategoryLabel(file.category)}
            </span>
            {file.stage && <span>{file.stage.title}</span>}
            <span>{formatDate(file.createdAt)}</span>
            <span>Загрузил: {file.uploader.name || file.uploader.email}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onDownload(file)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <Download className="w-5 h-5" />
          </button>
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowMenu(!showMenu)
              }}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-10">
                <button onClick={() => onDelete(file.id)} className="w-full px-4 py-2 text-left text-red-600 hover:bg-gray-50 text-sm flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Удалить
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}