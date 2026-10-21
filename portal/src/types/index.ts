import { DefaultSession, DefaultUser } from 'next-auth'
import { JWT, DefaultJWT } from 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: string
    } & DefaultSession['user']
  }

  interface User extends DefaultUser {
    role: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id: string
    role: string
  }
}

export type UserRole = 'CLIENT' | 'MANAGER' | 'DEVELOPER' | 'ADMIN'

export type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'

export type StageType = 'SPECIFICATION' | 'DESIGN' | 'DEVELOPMENT' | 'TESTING' | 'DEPLOYMENT' | 'SUPPORT'

export type StageStatus = 'PENDING' | 'IN_PROGRESS' | 'REVIEW' | 'APPROVED' | 'REJECTED' | 'COMPLETED'

export type MessageType = 'TEXT' | 'FILE' | 'SYSTEM'

export type FileCategory = 'FIGMA' | 'CONTRACT' | 'ACT' | 'ARCHIVE' | 'DESIGN' | 'DOCUMENT' | 'OTHER'

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELLED' | 'REFUNDED'

export type PaymentProvider = 'STRIPE' | 'MANUAL'

export interface StageWithTasks {
  id: string
  projectId: string
  type: StageType
  title: string
  description: string | null
  status: StageStatus
  order: number
  startDate: Date | null
  dueDate: Date | null
  completedAt: Date | null
  tasks: Task[]
}

export interface Task {
  id: string
  stageId: string
  title: string
  description: string | null
  order: number
  completed: boolean
  completedAt: Date | null
}

export interface ProjectWithRelations {
  id: string
  title: string
  description: string | null
  status: ProjectStatus
  clientId: string
  managerId: string | null
  developerId: string | null
  startDate: Date | null
  endDate: Date | null
  budget: number | null
  stages: StageWithTasks[]
  client: { id: string; name: string | null; email: string; image: string | null }
  manager: { id: string; name: string | null; email: string; image: string | null } | null
  developer: { id: string; name: string | null; email: string; image: string | null } | null
}

export interface MessageWithAuthor {
  id: string
  projectId: string
  stageId: string | null
  authorId: string
  content: string
  type: MessageType
  metadata: any
  createdAt: Date
  author: { id: string; name: string | null; email: string; image: string | null; role: string }
  comments: CommentWithAuthor[]
}

export interface CommentWithAuthor {
  id: string
  messageId: string
  authorId: string
  content: string
  createdAt: Date
  author: { id: string; name: string | null; email: string; image: string | null; role: string }
}

export interface FileWithUploader {
  id: string
  projectId: string
  stageId: string | null
  uploaderId: string
  name: string
  originalName: string
  mimeType: string
  size: number
  category: FileCategory
  url: string
  path: string
  metadata: any
  createdAt: Date
  uploader: { id: string; name: string | null; email: string; image: string | null }
}

export interface InvoiceWithPayments {
  id: string
  projectId: string
  clientId: string
  number: string
  amount: number
  currency: string
  status: InvoiceStatus
  provider: PaymentProvider
  providerId: string | null
  description: string | null
  dueDate: Date | null
  paidAt: Date | null
  metadata: any
  createdAt: Date
  payments: Payment[]
}

export interface Payment {
  id: string
  invoiceId: string
  amount: number
  currency: string
  provider: PaymentProvider
  providerId: string
  status: string
  metadata: any
  createdAt: Date
}