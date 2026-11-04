/**
 * Pantalla "Nueva compra".
 *
 * Qué hace: registra una compra de un producto (fecha, presentación, cantidad
 * y costo total) que se suma a la bodega, y muestra las unidades y el costo
 * por unidad antes de guardar.
 * Cómo lo hace: lee los productos; `calcularCompra` (aplicacion) calcula las
 * unidades, el costo por unidad y qué impide registrar; al guardar llama al
 * repositorio y va al historial. El producto viaja en la ruta
 * (`inventario/comprar/<id>`).
 * Por qué: el costo por unidad de la última compra es la base de la utilidad
 * semanal; verlo antes de guardar evita errores de digitación.
 */
import { useCallback, useState } from 'react'
import { Minus, Plus, Info } from 'lucide-react'
import { calcularCompra } from '../../aplicacion/calculoCompra'
import type { RepositorioInventario } from '../../datos/inventario'
import { opcionesDePresentacion, presentacionPermitida } from '../../domain/inventario/categorias'
import type { Presentacion } from '../../domain/inventario/conversiones'
import { CabeceraInterna } from '../componentes/CabeceraInterna'
import { CampoFecha } from '../componentes/CampoFecha'
import { EstadoDeCarga } from '../componentes/EstadoDeCarga'
import { ListaDesplegable } from '../componentes/ListaDesplegable'
import { Opciones } from '../componentes/Opciones'
import { formatoPesos } from '../formato'
import { useCarga } from '../useCarga'

/** Servicios que necesita la pantalla. */
export interface ServiciosComprar {
  inventario: Pick<RepositorioInventario, 'listarProductos' | 'registrarCompra'>
}

interface Propiedades {
  servicios: ServiciosComprar
  /** Producto elegido (viene de la ruta). */
  productoId?: string
  /** Día de hoy, AAAA-MM-DD. */
  hoy: string
  alIr: (ruta: string) => void
}

const ETIQUETA_CANTIDAD: Record<Presentacion, string> = {
  unidad: 'Cantidad de unidades',
  sixpack: 'Cantidad de sixpacks',
  caja: 'Cantidad de cajas',
}

export function Comprar({ servicios, productoId, hoy, alIr }: Propiedades) {
  const cargar = useCallback(() => servicios.inventario.listarProductos(), [servicios])
  const { estado, datos: productos, error, recargar } = useCarga(cargar)
  const [fecha, setFecha] = useState(hoy)
  const [elegida, setPresentacion] = useState<Presentacion>('caja')
  const [cantidad, setCantidad] = useState(1)
  const [costoTexto, setCostoTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const cabecera = <CabeceraInterna titulo="Nueva compra" subtitulo="Se suma a la bodega" alVolver={() => alIr('inventario')} />
  if (estado !== 'listo' || productos === null) {
    return (
      <>
        {cabecera}
        <div className="marco__contenido">
          <EstadoDeCarga estado={estado === 'cargando' ? 'cargando' : 'error'} error={error} que="los productos" reintentar={recargar} />
        </div>
      </>
    )
  }

  const producto = productos.find((p) => p.id === productoId) ?? null
  const costoTotal = costoTexto === '' ? null : Number(costoTexto)
  // Si el producto no admite la presentación elegida (licor: solo botella), se usa unidad.
  const presentacion: Presentacion =
    producto !== null && !presentacionPermitida(producto.categoria, elegida, producto.manejaSixpack) ? 'unidad' : elegida
  const resultado = calcularCompra({ producto, presentacion, cantidad, costoTotal })
  const puedeRegistrar = resultado.puedeRegistrar && !enviando

  const registrar = async () => {
    if (producto === null || costoTotal === null) return
    setEnviando(true)
    setFallo(null)
    try {
      await servicios.inventario.registrarCompra({ productoId: producto.id, presentacion, cantidad, costoTotal, fecha })
      alIr('mas/compras')
    } catch (causa) {
      setFallo(causa instanceof Error ? causa.message : String(causa))
      setEnviando(false)
    }
  }

  return (
    <>
      {cabecera}
      <div className="marco__contenido">
        <CampoFecha valor={fecha} hoy={hoy} alCambiar={setFecha} />
        <ListaDesplegable
          etiqueta="Producto"
          valor={producto?.id ?? ''}
          textoVacio="Elegir producto"
          opciones={productos.map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
          alCambiar={(id) => alIr(`inventario/comprar/${id}`)}
        />

        <div className="campo">
          <span className="campo__etiqueta">Presentación</span>
          <Opciones
            nombre="Presentación"
            opciones={opcionesDePresentacion(producto?.categoria ?? 'cerveza', producto === null || producto.manejaSixpack)}
            valor={presentacion}
            alCambiar={setPresentacion}
          />
        </div>

        <div className="campo">
          <span className="campo__etiqueta">{producto?.categoria === 'licor' ? 'Cantidad de botellas' : ETIQUETA_CANTIDAD[presentacion]}</span>
          <div className="cantidad">
            <button type="button" className="cantidad__boton" aria-label="Menos cantidad" onClick={() => setCantidad((c) => Math.max(1, c - 1))}>
              <Minus size={20} strokeWidth={1.5} aria-hidden="true" />
            </button>
            <span className="cantidad__valor" aria-live="polite">{cantidad}</span>
            <button type="button" className="cantidad__boton" aria-label="Más cantidad" onClick={() => setCantidad((c) => c + 1)}>
              <Plus size={20} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="campo">
          <label className="campo__etiqueta" htmlFor="costo-compra">Costo total</label>
          <div className="entrada">
            <input
              id="costo-compra"
              type="text"
              inputMode="numeric"
              className="entrada__control"
              placeholder="$ 0"
              value={costoTexto === '' ? '' : formatoPesos(Number(costoTexto))}
              onChange={(e) => setCostoTexto(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <p className="texto-suave">El valor pagado por toda la compra.</p>
        </div>

        <div className="tarjeta tarjeta--destacada">
          <div className="dato">
            <span className="dato__etiqueta">{resultado.detalle}</span>
            <span className="dato__valor">{resultado.unidades > 0 ? `${resultado.unidades} unidades` : '—'}</span>
          </div>
          <div className="division" />
          <div className="dato">
            <span className="dato__etiqueta">Costo por unidad</span>
            <span className="dato__total">{resultado.costoPorUnidad === null ? '—' : formatoPesos(resultado.costoPorUnidad)}</span>
          </div>
        </div>

        <div className="aviso aviso--neutro">
          <Info size={18} strokeWidth={1.5} aria-hidden="true" />
          <div className="aviso__mensaje">
            <span className="aviso__titulo">Destino: bodega</span>
            <span>
              {producto === null || resultado.unidades === 0
                ? 'Elige un producto y una cantidad.'
                : `Al registrar se sumarán ${resultado.unidades} unidades de ${producto.nombre}.`}
            </span>
          </div>
        </div>

        {resultado.problema !== null && producto !== null && costoTexto !== '' && <p className="texto-suave">{resultado.problema}</p>}
        {fallo !== null && <span role="alert" className="texto-error">{fallo}</span>}

        <button type="button" className="boton boton--primario" disabled={!puedeRegistrar} onClick={registrar}>
          Registrar compra
        </button>
        <button type="button" className="boton" onClick={() => alIr('mas/compras')}>Ver historial de compras</button>
      </div>
    </>
  )
}
