/**
 * Ventanitas emergentes de confirmación (avisos).
 *
 * Qué hace: muestra un aviso corto abajo de la pantalla cuando una acción
 * sale bien ("Venta registrada con éxito") y lo quita solo.
 * Cómo lo hace: el proveedor da `mostrar(texto)` por el contexto
 * (contextoAvisos.ts), guarda los avisos visibles y quita cada uno a los 3
 * segundos.
 * Por qué: confirma al usuario que lo que hizo quedó guardado y le da algo de
 * movimiento a la app, sin tener que tocar nada para cerrarlo.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CircleCheck } from 'lucide-react'
import { ContextoAvisos, DURACION_AVISO_MS, type Avisos } from './contextoAvisos'

/** Un aviso visible, con su id para quitarlo. */
interface AvisoVisible {
  id: number
  texto: string
}

/**
 * Proveedor de avisos.
 *
 * Qué hace: da `mostrar` a todo lo que tiene adentro y dibuja los avisos.
 * Cómo lo hace: cada aviso entra a una lista con un id y un temporizador lo
 * saca; al desmontarse se cancelan los temporizadores pendientes.
 * Por qué: un aviso debe sobrevivir al cambio de pantalla que suele venir
 * después de guardar (por ejemplo, ir al historial).
 */
export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [visibles, setVisibles] = useState<readonly AvisoVisible[]>([])
  const siguiente = useRef(1)
  const temporizadores = useRef(new Set<ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const pendientes = temporizadores.current
    return () => pendientes.forEach(clearTimeout)
  }, [])

  const mostrar = useCallback((texto: string) => {
    const id = siguiente.current++
    setVisibles((v) => [...v, { id, texto }])
    const t = setTimeout(() => {
      temporizadores.current.delete(t)
      setVisibles((v) => v.filter((a) => a.id !== id))
    }, DURACION_AVISO_MS)
    temporizadores.current.add(t)
  }, [])

  const avisos = useMemo<Avisos>(() => ({ mostrar }), [mostrar])

  return (
    <ContextoAvisos.Provider value={avisos}>
      {children}
      <div className="avisos-emergentes" aria-live="polite">
        {visibles.map((a) => (
          <div key={a.id} className="aviso-emergente" role="status">
            <CircleCheck size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>{a.texto}</span>
          </div>
        ))}
      </div>
    </ContextoAvisos.Provider>
  )
}
