'use client'

import { createClient } from '@/lib/supabase/client'
import { Suspense, useEffect, useState } from 'react'
import MovementForm from '@/components/movement/movement-form'
import MovementListItem from '@/components/movement/movement-list-item'
import './page.css'

interface Movimiento {
    monto: number
    descripcion?: string | null
    fecha: string
    hora?: string | null
    cuenta_id: string
    categoria_id: string
    notas?: string | null
    es_transferencia?: boolean | null
    transferencia_id?: string | null
}

function MovimientosContent() {
    const [movements, setMovements] = useState<Movimiento[] | null>(null)
    const supabase = createClient()
    const [loading, setLoading] = useState(true)

    const fetchRecords = async () => {
        try {
            const { data } = await supabase
                .from('movimiento')
                .select('monto, descripcion, fecha, hora, cuenta_id, categoria_id, notas, created_at, es_transferencia, transferencia_id')
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

    return (
        <div className="movimientos-page">
            <div className="movimientos-page__container">
                <MovementForm onMovimientoCreado={fetchRecords} />

                {loading ? (
                    <div className="movimientos-page__loading">Cargando movimientos...</div>
                ) : (
                    <div className="movimientos-list">
                        {movements?.map((movimiento, index) => (
                            <MovementListItem key={index} movimiento={movimiento} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default function Page() {
    return (
        <Suspense fallback={<div className="movimientos-page"><div className="movimientos-page__loading">Cargando...</div></div>}>
            <MovimientosContent />
        </Suspense>
    )
}