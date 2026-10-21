'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { Send, Paperclip, Loader2, MoreVertical, Smile, FileText, Image, Archive, MessageSquare } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { cn, formatDateTime, getFileIcon } from '@/lib/utils'

interface Message {
  id: string
  content: string
  type: string
  createdAt: string
  author: { id: string; name: string | null; email: string; image: string | null; role: string }
  comments: Comment[]
}

interface Comment {
  id: string
  content: string
  createdAt: string
  author: { id: string; name: string | null; email: string; image: string | null; role: string }
}

function LoadingState() {
  return (
    <div className="card flex-1 flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500">
      <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
      <p>Сообщений пока нет</p>
      <p className="text-sm">Начните общение с командой проекта</p>
    </div>
  )
}

function LoadMoreButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-sm text-gray-500 hover:text-gray-700 py-2">
      Загрузить предыдущие сообщения
    </button>
  )
}

function LoadingMore() {
  return (
    <div className="flex justify-center py-2">
      <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
    </div>
  )
}

function MessageItem({ message, onAddComment }: { message: Message; onAddComment: (id: string, content: string) => void }) {
  const [showComments, setShowComments] = useState(false)
  const [newComment, setNewComment] = useState('')
  const isOwn = message.author.role === 'CLIENT'

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newComment.trim()) {
      onAddComment(message.id, newComment)
      setNewComment('')
    }
  }

  return (
    <div className={cn('flex gap-3', isOwn && 'flex-row-reverse')}>
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          isOwn ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-700'
        )}
      >
        {message.author.image ? (
          <img src={message.author.image} alt="" className="w-8 h-8 rounded-full" />
        ) : (
          <span className="text-sm font-medium">
            {message.author.name?.[0]?.toUpperCase() || message.author.email[0].toUpperCase()}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-gray-900">{message.author.name || message.author.email}</span>
          <span className="text-xs text-gray-400">{formatDateTime(message.createdAt)}</span>
          {message.type === 'SYSTEM' && (
            <span className="badge bg-gray-100 text-gray-600">Системное</span>
          )}
        </div>

        <div
          className={cn(
            'message-bubble',
            isOwn ? 'message-own' : 'message-other'
          )}
        >
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>

        <div className="mt-2">
          <button
            onClick={() => setShowComments(!showComments)}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
          >
            <MessageSquare className="w-4 h-4" />
            Комментарии ({message.comments.length})
          </button>

          {showComments && (
            <div className="mt-2 space-y-2 ml-10 border-l-2 border-gray-100 pl-3">
              {message.comments.map((comment) => (
                <div key={comment.id} className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">{comment.author.name || comment.author.email}</span>
                    <span className="text-xs text-gray-400">{formatDateTime(comment.createdAt)}</span>
                  </div>
                  <p className="text-gray-700">{comment.content}</p>
                </div>
              ))}

              <form onSubmit={handleCommentSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Добавить комментарий..."
                  className="input flex-1"
                />
                <button type="submit" disabled={!newComment.trim()} className="btn-primary px-3">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchMessages = async (pageNum = 1, append = false) => {
    if (pageNum === 1) setIsLoading(true)
    else setLoadingMore(true)

    try {
      const res = await fetch(`/api/projects/${projectId}/messages?page=${pageNum}&limit=50`)
      if (res.ok) {
        const data = await res.json()
        if (append) {
          setMessages((prev) => [...data.messages, ...prev])
        } else {
          setMessages(data.messages)
        }
        setHasMore(data.pagination.page < data.pagination.totalPages)
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error)
    } finally {
      setIsLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    fetchMessages(1)
  }, [projectId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchMessages(page + 1, true)
      setPage(page + 1)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newMessage }),
      })
      if (res.ok) {
        const message = await res.json()
        setMessages((prev) => [...prev, message])
        setNewMessage('')
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    } finally {
      setSending(false)
    }
  }

  const handleAddComment = async (messageId: string, content: string) => {
    try {
      const res = await fetch(`/api/messages/${messageId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        const comment = await res.json()
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId ? { ...msg, comments: [...msg.comments, comment] } : msg
          )
        )
      }
    } catch (error) {
      console.error('Failed to add comment:', error)
    }
  }

  if (isLoading) {
    return <LoadingState />
  }

  return (
    <div className="card flex-1 flex flex-col h-[calc(100vh-200px)] min-h-[500px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {hasMore && !loadingMore && <LoadMoreButton onClick={loadMore} />}
            {loadingMore && <LoadingMore />}
            <div ref={messagesEndRef} />
            {messages.map((message) => (
              <MessageItem
                key={message.id}
                message={message}
                onAddComment={handleAddComment}
              />
            ))}
          </>
        )}
      </div>

      <form onSubmit={handleSend} className="border-t border-gray-100 p-4">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Напишите сообщение..."
              rows={1}
              className="input pr-12 resize-none min-h-[44px] max-h-32"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend(e)
                }
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="btn-primary p-2 h-10"
            aria-label="Отправить"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  )
}