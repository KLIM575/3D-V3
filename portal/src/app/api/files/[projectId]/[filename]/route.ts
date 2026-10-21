import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { join } from 'path'

async function checkFileAccess(fileId: string, userId: string, userRole: string) {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    include: { project: { select: { clientId: true, managerId: true, developerId: true } } },
  })

  if (!file) return false

  if (userRole === 'ADMIN') return true
  if (userRole === 'CLIENT' && file.project.clientId === userId) return true
  if (userRole === 'MANAGER' && file.project.managerId === userId) return true
  if (userRole === 'DEVELOPER' && file.project.developerId === userId) return true

  return false
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; filename: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { projectId, filename } = await params

    const fileRecord = await prisma.file.findFirst({
      where: { projectId, name: filename },
      include: { project: { select: { clientId: true, managerId: true, developerId: true } } },
    })

    if (!fileRecord) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const hasAccess = await checkFileAccess(fileRecord.id, session.user.id, session.user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const fileBuffer = await readFile(fileRecord.path)

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': fileRecord.mimeType,
        'Content-Disposition': `attachment; filename="${fileRecord.originalName}"`,
        'Content-Length': fileRecord.size.toString(),
      },
    })
  } catch (error) {
    console.error('Download file error:', error)
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
  }
}