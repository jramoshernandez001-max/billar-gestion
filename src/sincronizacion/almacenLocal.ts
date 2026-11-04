/**
 * Almacén local (localStorage).
 *
 * Qué hace: adapta el almacenamiento del navegador a las interfaces
 * `AlmacenTexto` y `AlmacenConClaves` que usan la cola y las copias.
 * Cómo lo hace: reenvía a getItem, setItem, removeItem y key.
 * Por qué: la cola y el cliente no conocen al navegador, así se prueban con
 * un almacén en memoria. localStorage basta: la cola y las copias son
 * pequeñas y se leen de forma síncrona.
 */
import type { AlmacenConClaves } from './clienteSincronizado'

export function crearAlmacenLocal(storage: Storage): AlmacenConClaves {
  return {
    leer: (clave) => storage.getItem(clave),
    guardar: (clave, texto) => storage.setItem(clave, texto),
    borrar: (clave) => storage.removeItem(clave),
    claves: () => Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((k): k is string => k !== null),
  }
}
