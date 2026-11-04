/**
 * Pantalla "Resúmenes" (próximamente).
 *
 * Qué hace: avisa que los resúmenes y gráficos llegarán más adelante.
 * Cómo lo hace: cabecera con flecha de vuelta a Más y un texto.
 * Por qué: la opción ya está en el menú; no debe llevar a una pantalla vacía.
 */
import { CabeceraInterna } from '../componentes/CabeceraInterna'

export function ResumenesProximamente({ alIr }: { alIr: (ruta: string) => void }) {
  return (
    <>
      <CabeceraInterna titulo="Resúmenes" subtitulo="Próximamente" alVolver={() => alIr('mas')} />
      <div className="marco__contenido">
        <p className="estado">Aquí verás resúmenes y gráficos de ventas, compras y utilidad.</p>
      </div>
    </>
  )
}
