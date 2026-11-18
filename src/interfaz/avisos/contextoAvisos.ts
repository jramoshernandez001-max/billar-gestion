/**
 * Contexto de los avisos emergentes.
 *
 * Qué hace: define `mostrar(texto)`, el hook `useAvisos` y cuánto dura un
 * aviso.
 * Cómo lo hace: un contexto de React cuyo valor por defecto no hace nada.
 * Por qué: las pantallas solo piden mostrar un aviso; sin proveedor (en las
 * pruebas de cada pantalla) no falla nada. El dibujo vive en Avisos.tsx.
 */
import { createContext, useContext } from 'react'

/** Lo que las pantallas pueden hacer con los avisos. */
export interface Avisos {
  mostrar(texto: string): void
}

/** Cuánto dura un aviso en pantalla, en milisegundos. */
export const DURACION_AVISO_MS = 3000

export const ContextoAvisos = createContext<Avisos>({ mostrar: () => undefined })

/**
 * Devuelve los avisos de la app.
 * Por qué: las pantallas solo llaman a mostrar; no saben cómo se dibuja.
 */
export function useAvisos(): Avisos {
  return useContext(ContextoAvisos)
}
