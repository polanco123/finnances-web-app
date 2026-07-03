import { createClient } from '@/lib/supabase/client'

export const insertarMovimiento = async (movimiento) => {
    const supabase = createClient()

  const { data, error } = await supabase
    .from('movimiento')
    .insert(movimiento)
    .select()

  if (error) throw error
  return data
}

export const obtenerMovimientos = async (limite = 10) => {
  const { data, error } = await supabase
    .from('movimiento')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limite)

  if (error) throw error
  return data
}
