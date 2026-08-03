'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { type EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

function ConfirmContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<'verifying' | 'error'>('verifying')
  const ranOnce = useRef(false)

  useEffect(() => {
    if (ranOnce.current) return
    ranOnce.current = true

    const token_hash = searchParams.get('token_hash')
    const type = searchParams.get('type') as EmailOtpType | null
    const next = searchParams.get('next') ?? '/'

    if (!token_hash || !type) {
      router.replace('/auth/error?error=No token hash or type')
      return
    }

    const supabase = createClient()

    supabase.auth.verifyOtp({ type, token_hash }).then(({ error }) => {
      if (error) {
        setStatus('error')
        router.replace(`/auth/error?error=${encodeURIComponent(error.message)}`)
        return
      }
      router.replace(next)
    })
  }, [router, searchParams])

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      {status === 'verifying' ? 'Verificando...' : 'Error al verificar, redirigiendo...'}
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center' }}>Verificando...</div>}>
      <ConfirmContent />
    </Suspense>
  )
}
