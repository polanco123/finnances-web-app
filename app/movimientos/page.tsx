'use client'

import { createClient } from '@/lib/supabase/client'
import { Suspense, useEffect, useState } from 'react'
import MovementForm from '@/components/movement/movement-form'

function MovimientosContent() {
    const [movements, setMovements] = useState<Record<string, unknown>[] | null>(null)
    const supabase = createClient()
    const [loading, setLoading] = useState(true)


    const fetchRecords = async () => {
        try {
            const { data } = await supabase
                .from('movimiento')
                .select('monto, descripcion, fecha, hora, cuenta_id, categoria_id, notas, created_at')
                .order('created_at', { ascending: false })
                .limit(10)
            setMovements(data)
        } catch {
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchRecords()
    }, [])

    return <>

        <MovementForm onMovimientoCreado={fetchRecords} />

        <pre>{JSON.stringify(movements, null, 2)}</pre>
    </>
}

export default function Page() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <MovimientosContent />
        </Suspense>
    )
}