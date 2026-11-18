/**
 * Pantalla "Nueva compra".
 *
 * Qué hace: registra una compra de uno o varios productos (fecha y, por
 * producto, presentación, cantidad y precio de cada caja, sixpack o
 * botella). Muestra el total de cada producto, su costo por unidad y el
 * total de la compra antes de guardar; todo entra a la bodega.
 * Cómo lo hace: lee los productos; el borrador (`borradorCompra`, en
 * aplicacion) guarda los renglones y calcula totales y problemas; al
 * registrar manda todo junto con `registrarCompras` (todo o nada) y va al
 * historial. Si llega un producto en la ruta (`inventario/comprar/<id>`), el
 * primer renglón ya lo trae.
 * Por qué: el negocio compra varios productos a la vez y sabe el precio de
 * cada caja, no siempre el total; la app hace las cuentas. El costo por
 * unidad de la última compra es la base de la utilidad semanal.
 */
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Info, Minus, MinusCircle, Plus } from 'lucide-react'
import {
  aDatosCompras,
  agregarRenglonCompra,
  borradorCompraVacio,
  calcularBorradorCompra,
  cambiarRenglonCompra,
  quitarRenglonCompra,
  type BorradorCompra,
  type CatalogoCompra,
  type RenglonCompraBorrador,
} from '../../aplicacion/borradorCompra'
import type { Producto, RepositorioInventario } from '../../datos/inventario'
import { opcionesDePresentacion } from '../../domain/inventario/categorias'
import type { Presentacion } from '../../domain/inventario/conversiones'

import { CabeceraInterna } from '../componentes/CabeceraInterna'
import { CampoFecha } from '../componentes/CampoFecha'
import { EstadoDeCarga } from '../componentes/EstadoDeCarga'
import { ListaDesplegable } from '../componentes/ListaDesplegable'
import { Opciones } from '../componentes/Opciones'
import { formatoPesos } from '../formato'
import { useCarga } from '../useCarga'
import { MENSAJES_ACCION } from '../../aplicacion/mensajesAccion'
import { useAvisos } from '../avisos/contextoAvisos'

/** Servicios que necesita la pantalla. */
export interface ServiciosComprar {
  inventario: Pick<RepositorioInventario, 'listarProductos' | 'registrarCompras'>
}

interface Propiedades {
  servicios: ServiciosComprar
  /** Producto con que empieza la compra (viene de la ruta). */
  productoId?: string
  /** Día de hoy, AAAA-MM-DD. */
  hoy: string
  alIr: (ruta: string) => void
}

/** Cómo se llama el precio que se pide, según la presentación. */
const NOMBRE_PRECIO: Record<Presentacion, string> = {
  caja: 'Precio por caja',
  sixpack: 'Precio por sixpack',
  unidad: 'Precio por unidad',
}

export function Comprar({ servicios, productoId, hoy, alIr }: Propiedades) {
  const cargar = useCallback(() => servicios.inventario.listarProductos(), [servicios])
  const { estado, datos: productos, error, recargar } = useCarga(cargar)

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
  return <FormularioCompra productos={productos} productoId={productoId} hoy={hoy} servicios={servicios} alIr={alIr} cabecera={cabecera} />
}

interface PropiedadesFormulario extends Propiedades {
  productos: readonly Producto[]
  cabecera: ReactNode
}

/**
 * Formulario de la compra, ya con los productos cargados.
 * Por qué aparte: el borrador inicial necesita el catálogo (para saber si el
 * producto de la ruta es licor), y así se arma una sola vez.
 */
function FormularioCompra({ productos, productoId, hoy, servicios, alIr, cabecera }: PropiedadesFormulario) {
  const avisos = useAvisos()
  const catalogo: CatalogoCompra = new Map(productos.map((p) => [p.id, p]))
  const [borrador, setBorrador] = useState<BorradorCompra>(() => borradorCompraVacio(hoy, productoId, catalogo))
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  const contador = useRef(1)

  const calculado = calcularBorradorCompra(borrador, catalogo)
  const cambiar = (clave: string, cambios: Parameters<typeof cambiarRenglonCompra>[2]) =>
    setBorrador((b) => cambiarRenglonCompra(b, clave, cambios, catalogo))

  const registrar = async () => {
    setEnviando(true)
    setFallo(null)
    try {
      await servicios.inventario.registrarCompras(aDatosCompras(borrador, catalogo))
      avisos.mostrar(MENSAJES_ACCION.compraRegistrada)
      alIr('mas/compras')
    } catch (causa) {
      setFallo(causa instanceof Error ? causa.message : String(causa))
      setEnviando(false)
    }
  }

  const agregar = () => {
    contador.current += 1
    const clave = `r${contador.current}`
    setBorrador((b) => agregarRenglonCompra(b, clave))
  }

  const dibujarRenglon = (renglon: RenglonCompraBorrador, indice: number) => {
    const numero = indice + 1
    const producto = renglon.productoId === null ? undefined : catalogo.get(renglon.productoId)
    const fila = calculado.renglones[indice]
    const esLicor = producto?.categoria === 'licor'
    const nombrePrecio = esLicor ? 'Precio por botella' : NOMBRE_PRECIO[renglon.presentacion]
    const idPrecio = `precio-${renglon.clave}`
    return (
      <section className="tarjeta" key={renglon.clave} aria-label={`Producto ${numero} de la compra`}>
        <div className="renglon__producto">
          <div className="renglon__elegir">
            <ListaDesplegable
              etiqueta={`Producto ${numero}`}
              valor={renglon.productoId ?? ''}
              textoVacio="Elegir producto"
              opciones={productos.map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
              alCambiar={(id) => cambiar(renglon.clave, { productoId: id })}
            />
          </div>
          {borrador.renglones.length > 1 && (
            <button
              type="button"
              className="renglon__quitar"
              aria-label={`Quitar producto ${numero}`}
              onClick={() => setBorrador((b) => quitarRenglonCompra(b, renglon.clave))}
            >
              <MinusCircle size={20} strokeWidth={1.5} />
            </button>
          )}
        </div>

        <div className="campo">
          <span className="campo__etiqueta">Presentación</span>
          <Opciones
            nombre={`Presentación · renglón ${numero}`}
            opciones={opcionesDePresentacion(producto?.categoria ?? 'cerveza', producto === undefined || producto.manejaSixpack)}
            valor={renglon.presentacion}
            alCambiar={(presentacion) => cambiar(renglon.clave, { presentacion })}
          />
        </div>

        <div className="renglon__medidas">
          <div className="campo campo--cantidad">
            <span className="campo__etiqueta">{esLicor ? 'Botellas' : 'Cantidad'}</span>
            <div className="cantidad">
              <button
                type="button"
                className="cantidad__boton"
                aria-label={`Menos cantidad · renglón ${numero}`}
                onClick={() => cambiar(renglon.clave, { cantidad: Math.max(1, renglon.cantidad - 1) })}
              >
                <Minus size={20} strokeWidth={1.5} aria-hidden="true" />
              </button>
              <span className="cantidad__valor" aria-live="polite">{renglon.cantidad}</span>
              <button
                type="button"
                className="cantidad__boton"
                aria-label={`Más cantidad · renglón ${numero}`}
                onClick={() => cambiar(renglon.clave, { cantidad: renglon.cantidad + 1 })}
              >
                <Plus size={20} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="campo campo--precio">
            <label className="campo__etiqueta" htmlFor={idPrecio}>{nombrePrecio}</label>
            <span className="entrada">
              <input
                id={idPrecio}
                aria-label={`${nombrePrecio} · renglón ${numero}`}
                type="text"
                inputMode="numeric"
                className="entrada__control"
                placeholder="$ 0"
                value={renglon.precio === null ? '' : formatoPesos(renglon.precio)}
                onChange={(e) => {
                  const digitos = e.target.value.replace(/\D/g, '')
                  cambiar(renglon.clave, { precio: digitos === '' ? null : Number(digitos) })
                }}
              />
            </span>
          </div>
        </div>

        <div className="division" />
        <div className="dato">
          <span className="dato__etiqueta">
            {fila.detalle === '' ? '—' : fila.detalle}
            {fila.costoPorUnidad !== null && <span className="texto-suave"> · {formatoPesos(fila.costoPorUnidad)} por unidad</span>}
          </span>
          <span className="dato__subtotal">{formatoPesos(fila.costoTotal ?? 0)}</span>
        </div>
      </section>
    )
  }

  return (
    <>
      {cabecera}
      <div className="marco__contenido">
        <CampoFecha valor={borrador.fecha} hoy={hoy} alCambiar={(fecha) => setBorrador((b) => ({ ...b, fecha }))} />

        {borrador.renglones.map(dibujarRenglon)}

        <button type="button" className="boton" onClick={agregar}>
          <Plus size={18} strokeWidth={1.5} aria-hidden="true" />
          <span className="boton__texto">Agregar producto</span>
        </button>

        <div className="tarjeta tarjeta--destacada">
          <div className="dato">
            <span className="dato__etiqueta">Total de la compra · {calculado.unidades} unidades</span>
            <span className="dato__total">{formatoPesos(calculado.total)}</span>
          </div>
        </div>

        <div className="aviso aviso--neutro">
          <Info size={18} strokeWidth={1.5} aria-hidden="true" />
          <div className="aviso__mensaje">
            <span className="aviso__titulo">Destino: bodega</span>
            <span>Escribe lo que costó cada caja (o botella); la app calcula el total.</span>
          </div>
        </div>

        {calculado.problema !== null && <p className="texto-suave">{calculado.problema}</p>}
        {fallo !== null && <span role="alert" className="texto-error">{fallo}</span>}

        <button type="button" className="boton boton--primario" disabled={!calculado.puedeRegistrar || enviando} onClick={registrar}>
          Registrar compra
        </button>
        <button type="button" className="boton" onClick={() => alIr('mas/compras')}>Ver historial de compras</button>
      </div>
    </>
  )
}
