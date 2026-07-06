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

export const insertarTransferencia = async (movimientoOrigen, movimientoDestino) => {
  const supabase = createClient()

  const { data: dataOrigen, error: errorOrigen } = await supabase
    .from('movimiento')
    .insert(movimientoOrigen)
    .select()

  if (errorOrigen) throw errorOrigen

  const { data: dataDestino, error: errorDestino } = await supabase
    .from('movimiento')
    .insert(movimientoDestino)
    .select()

  if (errorDestino) throw errorDestino

  return { origen: dataOrigen, destino: dataDestino }
}
