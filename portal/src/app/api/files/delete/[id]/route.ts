import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { unlink } from 'fs/promises'

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const hasAccess = await checkFileAccess(id, session.user.id, session.user.role)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const file = await prisma.file.findUnique({ where: { id } })
    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Delete physical file
    try {
      await unlink(file.path)
    } catch (e) {
      console.warn('Could not delete physical file:', e)
    }

    // Delete database record
    await prisma.file.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete file error:', error)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}