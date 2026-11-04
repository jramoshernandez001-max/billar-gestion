/**
 * Pantalla "Trasladar" (de bodega a nevera).
 *
 * Qué hace: deja elegir un producto y cuántas unidades pasar de la bodega a
 * la nevera. Muestra lo que hay en cada lado, avisa si se pide más de lo
 * disponible y registra el traslado.
 * Cómo lo hace: lee productos y stock; `evaluarTraslado` (aplicacion) dice si
 * se puede registrar y cuánto falta; al confirmar llama al repositorio de
 * inventario y vuelve a la lista. El producto viaja en la ruta
 * (`inventario/trasladar/<id>`).
 * Por qué: se piden unidades sueltas, no cajas (el stock va en unidades). El
 * diseño bloquea pedir más de lo que hay en bodega aunque la base solo avise:
 * así no se deja la bodega en negativo sin querer; "Usar N unidades" pasa lo
 * disponible.
 */
import { useState } from 'react'
import { ArrowRight, CircleAlert } from 'lucide-react'
import { evaluarTraslado } from '../../aplicacion/traslado'
import type { RepositorioInventario } from '../../datos/inventario'
import { CabeceraInterna } from '../componentes/CabeceraInterna'
import { EstadoDeCarga } from '../componentes/EstadoDeCarga'
import { ListaDesplegable } from '../componentes/ListaDesplegable'
import { textoUnidades } from '../formato'
import { useDatosInventario } from '../useDatosInventario'

/** Servicios que necesita la pantalla. */
export interface ServiciosTrasladar {
  inventario: Pick<RepositorioInventario, 'listarProductos' | 'obtenerStock' | 'registrarTraslado'>
}

interface Propiedades {
  servicios: ServiciosTrasladar
  /** Producto elegido (viene de la ruta); sin él hay que elegir uno. */
  productoId?: string
  alIr: (ruta: string) => void
}

export function Trasladar({ servicios, productoId, alIr }: Propiedades) {
  const { estado, datos, error, recargar } = useDatosInventario(servicios.inventario)
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const cabecera = <CabeceraInterna titulo="Trasladar" subtitulo="De bodega a nevera" alVolver={() => alIr('inventario')} />
  if (estado !== 'listo' || datos === null) {
    return (
      <>
        {cabecera}
        <div className="marco__contenido">
          <EstadoDeCarga estado={estado === 'cargando' ? 'cargando' : 'error'} error={error} que="el inventario" reintentar={recargar} />
        </div>
      </>
    )
  }

  const stock = productoId === undefined ? undefined : datos.stock.get(productoId)
  const bodega = stock?.bodega ?? 0
  const nevera = stock?.nevera ?? 0
  const solicitadas = texto === '' ? null : Number(texto)
  const evaluacion = evaluarTraslado(bodega, solicitadas)
  const puedeRegistrar = productoId !== undefined && evaluacion.puedeRegistrar && !enviando

  const registrar = async () => {
    if (productoId === undefined || solicitadas === null) return
    setEnviando(true)
    setFallo(null)
    try {
      await servicios.inventario.registrarTraslado(productoId, solicitadas)
      alIr('inventario')
    } catch (causa) {
      setFallo(causa instanceof Error ? causa.message : String(causa))
      setEnviando(false)
    }
  }

  return (
    <>
      {cabecera}
      <div className="marco__contenido">
        <ListaDesplegable
          etiqueta="Producto"
          valor={productoId ?? ''}
          textoVacio="Elegir producto"
          opciones={datos.productos.map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
          alCambiar={(id) => alIr(`inventario/trasladar/${id}`)}
        />

        <div className="tarjeta">
          <div className="recorrido">
            <div className="recorrido__lado">
              <span className="texto-suave">Bodega</span>
              <span className="recorrido__valor">{bodega}</span>
            </div>
            <ArrowRight size={20} strokeWidth={1.5} className="recorrido__flecha" aria-hidden="true" />
            <div className="recorrido__lado">
              <span className="texto-suave">Nevera</span>
              <span className="recorrido__valor">{nevera}</span>
            </div>
          </div>
        </div>

        <div className="campo">
          <label className="campo__etiqueta" htmlFor="unidades-traslado">Unidades a trasladar</label>
          <div className="entrada">
            <input
              id="unidades-traslado"
              type="text"
              inputMode="numeric"
              className="entrada__control"
              value={texto}
              onChange={(e) => setTexto(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <p className="texto-suave">Ingresa unidades sueltas, no cajas.</p>
        </div>

        {evaluacion.estado === 'excede' && (
          <div className="aviso">
            <CircleAlert size={18} strokeWidth={1.5} aria-hidden="true" />
            <div className="aviso__mensaje">
              <span className="aviso__titulo">Faltaron {evaluacion.faltan} en bodega</span>
              <span>Solicitaste {textoUnidades(solicitadas ?? 0)}, pero solo hay {evaluacion.maximo} disponibles.</span>
            </div>
          </div>
        )}

        <div className="dato">
          <span className="dato__etiqueta">Máximo disponible</span>
          <span className="dato__valor">{textoUnidades(evaluacion.maximo)}</span>
        </div>

        <div className="confirmacion">
          <button type="button" className="boton boton--primario" disabled={!puedeRegistrar} onClick={registrar}>
            Trasladar
          </button>
          {evaluacion.estado === 'excede' && <span className="texto-error">Reduce la cantidad para continuar.</span>}
          {fallo !== null && <span role="alert" className="texto-error">{fallo}</span>}
        </div>

        {evaluacion.estado === 'excede' && evaluacion.maximo > 0 && (
          <button type="button" className="boton" onClick={() => setTexto(String(evaluacion.maximo))}>
            Usar {evaluacion.maximo} unidades
          </button>
        )}
      </div>
    </>
  )
}
