/**
 * Memoria de acceso (modo sin conexión).
 *
 * Qué hace: recuerda en el teléfono qué correo fue autorizado por la base de
 * datos y cuándo.
 * Cómo lo hace: un JSON en localStorage. Si falta, está dañado o no se puede
 * guardar, se comporta como si no hubiera nada.
 * Por qué: permite abrir la app sin internet y ver lo guardado. Ante la
 * duda no recuerda nada, y entonces el acceso se niega como siempre.
 */
import type { MemoriaDeAcceso } from './servicioAcceso'

const CLAVE = 'billar.acceso'

export function crearMemoriaDeAcceso(storage: Storage): MemoriaDeAcceso {
  return {
    leer() {
      try {
        const texto = storage.getItem(CLAVE)
        if (texto === null) return null
        const valor = JSON.parse(texto) as { correo?: unknown; en?: unknown }
        return typeof valor.correo === 'string' && typeof valor.en === 'string' ? { correo: valor.correo, en: valor.en } : null
      } catch {
        return null
      }
    },
    guardar(correo, en) {
      try {
        storage.setItem(CLAVE, JSON.stringify({ correo, en }))
      } catch {
        // Sin espacio: simplemente no se recuerda.
      }
    },
    borrar() {
      try {
        storage.removeItem(CLAVE)
      } catch {
        // Nada que hacer.
      }
    },
  }
}
