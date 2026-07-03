'use client'

import { createClient } from '@/lib/supabase/client'
import { Suspense, useEffect, useState } from 'react'
import MovementForm from '@/components/movement/movement-form'
import MovementListItem from '@/components/movement/movement-list-item'

interface Movimiento {
    monto: number
    descripcion?: string | null
    fecha: string
    hora?: string | null
    cuenta_id: string
    categoria_id: string
    notas?: string | null
}

function MovimientosContent() {
    const [movements, setMovements] = useState<Movimiento[] | null>(null)
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

        {loading ? (
            <div>Cargando movimientos...</div>
        ) : (
            <div className="movements-list">
                {movements?.map((movimiento, index) => (
                    <MovementListItem key={index} movimiento={movimiento} />
                ))}
            </div>
        )}
    </>
}

export default function Page() {
    return (
        <Suspense fallback={<div>Cargando...</div>}>
            <MovimientosContent />
        </Suspense>
    )
}