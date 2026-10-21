import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Admin routes
    if (path.startsWith('/dashboard/admin') && token?.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Manager routes
    if (path.startsWith('/dashboard/manager') && !['ADMIN', 'MANAGER'].includes(token?.role || '')) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Developer routes
    if (path.startsWith('/dashboard/developer') && !['ADMIN', 'DEVELOPER'].includes(token?.role || '')) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname
        // Allow access to auth pages without token
        if (path.startsWith('/auth/')) return true
        // Require token for dashboard
        if (path.startsWith('/dashboard')) return !!token
        return true
      },
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/auth/:path*',
  ],
}