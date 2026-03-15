import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

type AuthMode = 'login' | 'register'

interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
}

interface UseAuthReturn extends AuthState {
  mode: AuthMode
  setMode: (mode: AuthMode) => void
  email: string
  setEmail: (v: string) => void
  password: string
  setPassword: (v: string) => void
  error: string | null
  isSubmitting: boolean
  submit: () => Promise<void>
  signOut: () => Promise<void>
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // 监听 Supabase 会话变化
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setIsLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const submit = async () => {
    setError(null)
    if (!email.trim() || !password.trim()) {
      setError('邮箱和密码不能为空')
      return
    }
    if (password.length < 6) {
      setError('密码长度至少 6 位')
      return
    }
    setIsSubmitting(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setError('✅ 注册成功！请前往邮箱点击验证链接后登录。')
        setMode('login')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '操作失败，请重试'
      // 友好化常见错误提示
      if (msg.includes('Invalid login credentials')) setError('邮箱或密码错误')
      else if (msg.includes('User already registered')) setError('该邮箱已注册，请直接登录')
      else if (msg.includes('Email not confirmed')) setError('邮箱尚未验证，请检查收件箱')
      else setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return {
    user, session, isLoading,
    mode, setMode,
    email, setEmail,
    password, setPassword,
    error, isSubmitting,
    submit, signOut,
  }
}
