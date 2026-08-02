import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: cuentas, error: fetchError } = await supabase
    .from('cuenta').select('saldo_calculado, es_fondo_retiro').eq('activa', true)
  if (fetchError) return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 })

  const totalActivos = cuentas.filter((c) => c.saldo_calculado > 0).reduce((s, c) => s + c.saldo_calculado, 0)
  const totalDeudas = Math.abs(cuentas.filter((c) => c.saldo_calculado < 0).reduce((s, c) => s + c.saldo_calculado, 0))
  const patrimonioNeto = totalActivos - totalDeudas
  const retiro = cuentas.filter((c) => c.es_fondo_retiro).reduce((s, c) => s + c.saldo_calculado, 0)
  const patrimonioDisponible = patrimonioNeto - retiro
  const fecha = new Date().toISOString().slice(0, 10) // fixed 06:00 UTC run ⇒ matches local date, see rationale

  const { error: upsertError } = await supabase.from('patrimonio_snapshot').upsert(
    { fecha, patrimonio_neto: patrimonioNeto, patrimonio_disponible: patrimonioDisponible,
      total_activos: totalActivos, total_deudas: totalDeudas },
    { onConflict: 'fecha' },
  )
  if (upsertError) return new Response(JSON.stringify({ error: upsertError.message }), { status: 500 })
  return new Response(JSON.stringify({ ok: true, fecha }), { status: 200 })
})
