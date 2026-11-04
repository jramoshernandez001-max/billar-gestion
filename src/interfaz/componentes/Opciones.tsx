/**
 * Selector de opciones (control segmentado).
 *
 * Qué hace: muestra varias opciones en una barra y deja elegir una (por
 * ejemplo Unidad, Sixpack, Caja o Todas, Vigentes, Anuladas).
 * Cómo lo hace: una lista de botones con rol "radio"; la elegida va resaltada
 * y una opción no disponible se muestra tachada y no se puede elegir.
 * Por qué: el diseño usa el mismo control en varias pantallas; un solo
 * componente evita repetirlo y asegura que se pueda usar con teclado y
 * lector de pantalla.
 */
export interface OpcionDeSelector<T extends string> {
  valor: T
  etiqueta: string
  /** Se muestra tachada y no se puede elegir. */
  noDisponible?: boolean
}

interface Propiedades<T extends string> {
  /** Nombre del grupo para lectores de pantalla (ej. "Presentación"). */
  nombre: string
  opciones: readonly OpcionDeSelector<T>[]
  valor: T
  alCambiar: (valor: T) => void
}

export function Opciones<T extends string>({ nombre, opciones, valor, alCambiar }: Propiedades<T>) {
  return (
    <div className="opciones" role="radiogroup" aria-label={nombre}>
      {opciones.map((opcion) => (
        <button
          key={opcion.valor}
          type="button"
          role="radio"
          aria-checked={opcion.valor === valor}
          disabled={opcion.noDisponible}
          className={`opcion${opcion.valor === valor ? ' opcion--activa' : ''}${opcion.noDisponible ? ' opcion--no-disponible' : ''}`}
          onClick={() => alCambiar(opcion.valor)}
        >
          {opcion.etiqueta}
        </button>
      ))}
    </div>
  )
}
