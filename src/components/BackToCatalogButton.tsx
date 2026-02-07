'use client'

import { useRouter } from 'next/navigation'

export default function BackToCatalogButton() {
    const router = useRouter()

    return (
        <button
            onClick={() => router.back()}
            className="btn-back"
            style={{
                border: 'none',
                cursor: 'pointer',
                font: 'inherit'
            }}
        >
            <i className="fa-solid fa-arrow-left"></i> Volver al catálogo
        </button>
    )
}
