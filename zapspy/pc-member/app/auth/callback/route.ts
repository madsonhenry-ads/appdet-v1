import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  // Se houver um parâmetro "next" na URL, usamos ele, senão vamos pro dashboard
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    
    // Essa função troca o código temporário por uma sessão real do usuário
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Se deu certo, redireciona para o dashboard
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Se der erro, volta para a home com uma mensagem de erro
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
