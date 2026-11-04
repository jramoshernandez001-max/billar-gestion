/**
 * Estado de carga de una pantalla.
 *
 * Qué hace: muestra "Cargando…" o, si falló, el error con un botón para
 * reintentar.
 * Cómo lo hace: recibe el estado de `useCarga` y dibuja lo que toca.
 * Por qué: todas las pantallas que leen datos muestran lo mismo mientras
 * esperan o si algo falla.
 */
interface Propiedades {
  estado: 'cargando' | 'error'
  error: string | null
  /** Qué no se pudo cargar (ej. "el inventario"). */
  que: string
  reintentar: () => void
}

export function EstadoDeCarga({ estado, error, que, reintentar }: Propiedades) {
  if (estado === 'cargando') return <p role="status" className="estado">Cargando…</p>
  return (
    <>
      <div className="aviso aviso--error">
        <div className="aviso__mensaje">
          <span className="aviso__titulo">No se pudo cargar {que}</span>
          <span role="alert">{error}</span>
        </div>
      </div>
      <button type="button" className="boton" onClick={reintentar}>Reintentar</button>
    </>
  )
}
