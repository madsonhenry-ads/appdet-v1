import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Create a response to clear all browser storage
  const response = NextResponse.next()

  // Clear localStorage cookies on every page load
  response.cookies.set({
    name: 'user_data',
    value: '',
    expires: new Date(0),
    path: '/',
  })

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
