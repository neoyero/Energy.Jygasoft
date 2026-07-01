"use client"

import { useEffect, useRef, useState } from "react"

export interface EventoRT {
  tipo: string
  conversationId: number | null
  at: number
}

/**
 * Suscribe la UI al stream SSE de Chatwoot (/api/chatwoot/stream). Llama a
 * `onEvento` por cada evento entrante. El EventSource reconecta solo si se cae.
 * Devuelve `conectado` para mostrar el indicador "En vivo".
 */
export function useChatwootRealtime(onEvento: (e: EventoRT) => void) {
  const [conectado, setConectado] = useState(false)
  const cb = useRef(onEvento)
  cb.current = onEvento

  useEffect(() => {
    // EventSource no está en SSR; nos aseguramos de estar en el navegador.
    if (typeof window === "undefined" || typeof EventSource === "undefined") return
    const es = new EventSource("/api/chatwoot/stream")

    es.onopen = () => setConectado(true)
    es.onerror = () => setConectado(false) // el navegador reintenta solo
    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data) as EventoRT
        if (evt?.tipo === "conectado") {
          setConectado(true)
          return
        }
        cb.current(evt)
      } catch {
        // ignora líneas no-JSON (heartbeats van como comentarios ': ping')
      }
    }

    return () => es.close()
  }, [])

  return { conectado }
}
