'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
// Se o seu VS Code reclamar do import abaixo, use: import { createClient } from '@/utils/supabase/server'
import { createClient } from '../../utils/supabase/server'

// --- FUNÇÃO DE LOGIN (Mantém o redirecionamento) ---
export async function login(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/error')
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

// --- FUNÇÃO DE SIGNUP (Atualizada para funcionar com o Popup) ---
export async function signup(formData: FormData) {
  const supabase = await createClient()

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    // Retorna o erro para o front-end mostrar (se quiser)
    return { error: error.message }
  }

  // Retorna sucesso para abrir o modal
  return { success: true }
}
