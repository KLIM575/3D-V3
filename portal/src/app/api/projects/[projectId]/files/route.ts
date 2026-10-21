import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760')

const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'application/json',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

async function checkProjectAccess(projectId: string, userId: string, userRole: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { clientId: true, managerId: true, developerId: true },
  })

  if (!project) return false

  if (userRole === 'ADMIN') return true
  if (userRole === 'CLIENT' && project.clientId === userId) return true
  if (userRole === 'MANAGER' && project.managerId === userId) return true
  if (userRole === 'DEVELOPER' && project.developerId === userId) return true

  return false
}

function getFileCategory(mimeType: string, originalName: string): string {
  if (mimeType === 'application/json' && originalName.endsWith('.figma')) return 'FIGMA'
  if (originalName.toLowerCase().includes('contract') || originalName.toLowerCase().includes('договор')) return 'CONTRACT'
  if (originalName.toLowerCase().includes('act') || originalName.toLowerCase().includes('акт')) return 'ACT'
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return 'ARCHIVE'
  if (mimeType.startsWith('image/')) return 'DESIGN'
  if (mimeType === 'application/pdf') return 'DOCUMENT'
  return 'OTHER'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId } = await params
    const hasAccess = await checkProjectAccess(projectId, session.user.id, session.user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const stageId = searchParams.get('stageId')
    const category = searchParams.get('category')

    const where: any = { projectId }
    if (stageId) where.stageId = stageId
    if (category) where.category = category

    const files = await prisma.file.findMany({
      where,
      include: {
        uploader: { select: { id: true, name: true, email: true, image: true } },
        stage: { select: { id: true, title: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(files)
  } catch (error) {
    console.error('Get files error:', error)
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const projectId = formData.get('projectId') as string
    const stageId = formData.get('stageId') as string | null
    const category = formData.get('category') as string | null

    if (!file || !projectId) {
      return NextResponse.json({ error: 'Missing file or projectId' }, { status: 400 })
    }

    const hasAccess = await checkProjectAccess(projectId, session.user.id, session.user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 })
    }

    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
    }

    // Create upload directory
    const projectUploadDir = join(UPLOAD_DIR, projectId)
    await mkdir(projectUploadDir, { recursive: true })

    // Generate unique filename
    const fileExtension = file.name.split('.').pop() || ''
    const uniqueName = `${randomUUID()}.${fileExtension}`
    const filePath = join(projectUploadDir, uniqueName)

    // Save file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Determine category
    const fileCategory = category || getFileCategory(file.type, file.name)

    // Create database record
    const fileRecord = await prisma.file.create({
      data: {
        projectId,
        stageId,
        uploaderId: session.user.id,
        name: uniqueName,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        category: fileCategory as any,
        url: `/api/files/${projectId}/${uniqueName}`,
        path: filePath,
      },
      include: {
        uploader: { select: { id: true, name: true, email: true, image: true } },
      },
    })

    return NextResponse.json(fileRecord, { status: 201 })
  } catch (error) {
    console.error('Upload file error:', error)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}