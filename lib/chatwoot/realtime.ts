import { EventEmitter } from "events";

/**
 * Broker en memoria para eventos de Chatwoot (tiempo real). El endpoint entrante
 * (/api/webhooks/chatwoot) publica y el stream SSE (/api/chatwoot/stream) se
 * suscribe. Funciona con UNA instancia de la app (mismo proceso Node). Si algún
 * día se escala a varias instancias, habría que sustituir el bus por Redis/BD.
 * Se guarda en globalThis para sobrevivir el hot-reload en desarrollo.
 */

export interface EventoChatwoot {
  /** Nombre del evento de Chatwoot (message_created, conversation_updated, …). */
  tipo: string;
  /** Id de la conversación afectada (si aplica). */
  conversationId: number | null;
  /** Marca de tiempo (ms) del servidor. */
  at: number;
}

type GlobalConBroker = typeof globalThis & { __cwBroker?: EventEmitter };
const g = globalThis as GlobalConBroker;
const broker = g.__cwBroker ?? (g.__cwBroker = new EventEmitter());
// Muchos navegadores admin pueden estar suscritos: sin límite de listeners.
broker.setMaxListeners(0);

const CANAL = "evt";

/** Publica un evento a todos los streams conectados. */
export function publicarEventoChatwoot(evt: EventoChatwoot): void {
  broker.emit(CANAL, evt);
}

/** Suscribe un listener; devuelve la función para desuscribir. */
export function suscribirEventosChatwoot(fn: (evt: EventoChatwoot) => void): () => void {
  broker.on(CANAL, fn);
  return () => {
    broker.off(CANAL, fn);
  };
}
