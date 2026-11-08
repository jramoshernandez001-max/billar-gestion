/**
 * Pantalla "Nueva venta".
 *
 * Qué hace: deja armar una venta con varios renglones (producto, presentación,
 * cantidad y precio opcional), muestra subtotales, unidades y total, y la
 * registra. Desde cada renglón se abre "Elegir producto".
 * Cómo lo hace: guarda el borrador con las funciones puras de `borradorVenta`
 * (que calculan precios, unidades y problemas) y solo dibuja el resultado; al
 * registrar convierte el borrador con `aDatosVenta` y llama al repositorio de
 * ventas, y luego pasa a la lista de ventas.
 * Por qué: la lógica está probada aparte; aquí no se calcula nada. El precio
 * vacío significa "usa el de lista": la base lo guarda en la venta para que un
 * cambio de precio futuro no altere el historial.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import { MinusCircle, Minus, Plus, ChevronDown } from 'lucide-react'
import {
  agregarRenglon,
  aDatosVenta,
  borradorVacio,
  calcularBorrador,
  cambiarRenglon,
  quitarRenglon,
  type BorradorVenta,
  type CatalogoVendible,
  type RenglonBorrador,
} from '../../aplicacion/borradorVenta'
import { opcionesDePresentacion } from '../../domain/inventario/categorias'
import type { RepositorioInventario } from '../../datos/inventario'
import type { RepositorioVentas } from '../../datos/ventas'
import { CabeceraInterna } from '../componentes/CabeceraInterna'
import { CampoFecha } from '../componentes/CampoFecha'
import { Opciones } from '../componentes/Opciones'
import { formatoPesos } from '../formato'
import { useCarga } from '../useCarga'
import { SelectorProducto, type OpcionProducto } from './SelectorProducto'

/** Servicios que necesita la pantalla. */
export interface ServiciosVender {
  inventario: Pick<RepositorioInventario, 'listarProductos' | 'obtenerStock'>
  ventas: Pick<RepositorioVentas, 'registrarVenta'>
}

interface Propiedades {
  servicios: ServiciosVender
  /** Día de hoy, AAAA-MM-DD. */
  hoy: string
  alIr: (ruta: string) => void
}

/** Singular o plural: "1 unidad", "3 unidades". */
function unidadesTexto(n: number): string {
  return `${n} ${n === 1 ? 'unidad' : 'unidades'}`
}

export function Vender({ servicios, hoy, alIr }: Propiedades) {
  const cargar = useCallback(async () => {
    const [productos, stock] = await Promise.all([
      servicios.inventario.listarProductos(),
      servicios.inventario.obtenerStock(),
    ])
    return { productos, stock }
  }, [servicios])
  const { estado, datos, error, recargar } = useCarga(cargar)

  const contador = useRef(1)
  const [borrador, setBorrador] = useState<BorradorVenta>(() => agregarRenglon(borradorVacio(hoy), 'r1'))
  /** Clave del renglón cuyo producto se está eligiendo; null si ninguno. */
  const [eligiendo, setEligiendo] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [falloRegistro, setFalloRegistro] = useState<string | null>(null)

  const catalogo: CatalogoVendible = useMemo(
    () => new Map((datos?.productos ?? []).map((p) => [p.id, p])),
    [datos],
  )
  const calculado = useMemo(() => calcularBorrador(borrador, catalogo), [borrador, catalogo])

  if (estado !== 'listo' || datos === null) {
    return (
      <>
        <CabeceraInterna titulo="Nueva venta" subtitulo="Se descuenta de la nevera" alVolver={() => alIr('inicio')} />
        <div className="marco__contenido">
          {estado === 'cargando' ? (
            <p role="status" className="estado">Cargando…</p>
          ) : (
            <>
              <div className="aviso aviso--error">
                <div className="aviso__mensaje">
                  <span className="aviso__titulo">No se pudieron cargar los productos</span>
                  <span role="alert">{error}</span>
                </div>
              </div>
              <button type="button" className="boton" onClick={recargar}>Reintentar</button>
            </>
          )}
        </div>
      </>
    )
  }

  const enNevera = (id: string) => datos.stock.get(id)?.nevera ?? 0
  const cambiar = (clave: string, cambios: Parameters<typeof cambiarRenglon>[2]) =>
    setBorrador((b) => cambiarRenglon(b, clave, cambios, catalogo))

  if (eligiendo !== null) {
    const renglon = borrador.renglones.find((r) => r.clave === eligiendo)
    const opciones: OpcionProducto[] = datos.productos.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      unidadesPorCaja: p.unidadesPorCaja,
      precioUnidad: p.precioUnidad,
      enNevera: enNevera(p.id),
    }))
    return (
      <SelectorProducto
        opciones={opciones}
        seleccionado={renglon?.productoId ?? null}
        alVolver={() => setEligiendo(null)}
        alElegir={(id) => {
          cambiar(eligiendo, { productoId: id })
          setEligiendo(null)
        }}
      />
    )
  }

  const registrar = async () => {
    setEnviando(true)
    setFalloRegistro(null)
    try {
      await servicios.ventas.registrarVenta(aDatosVenta(borrador, catalogo))
      alIr('mas/ventas')
    } catch (causa) {
      setFalloRegistro(causa instanceof Error ? causa.message : String(causa))
      setEnviando(false)
    }
  }

  const dibujarRenglon = (renglon: RenglonBorrador, indice: number) => {
    const producto = renglon.productoId === null ? undefined : datos.productos.find((p) => p.id === renglon.productoId)
    const fila = calculado.renglones[indice]
    return (
      <section className="tarjeta" key={renglon.clave} aria-label={`Renglón ${indice + 1}`}>
        <div className="renglon__producto">
          <button
            type="button"
            className="renglon__elegir"
            aria-label={`Producto del renglón ${indice + 1}`}
            onClick={() => setEligiendo(renglon.clave)}
          >
            <span className="renglon__datos">
              <span className="renglon__nombre">{producto?.nombre ?? 'Elegir producto'}</span>
              <span className="renglon__detalle">
                {producto === undefined
                  ? 'Toca para buscar'
                  : `${producto.categoria === 'licor' ? 'Botella' : `${producto.unidadesPorCaja} unid/caja`} · ${enNevera(producto.id)} en nevera`}
              </span>
            </span>
            <ChevronDown size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <button type="button" className="renglon__quitar" aria-label="Quitar renglón" onClick={() => setBorrador((b) => quitarRenglon(b, renglon.clave))}>
            <MinusCircle size={20} strokeWidth={1.5} />
          </button>
        </div>

        <div className="campo">
          <span className="campo__etiqueta">Presentación</span>
          <Opciones
            nombre="Presentación"
            opciones={opcionesDePresentacion(producto?.categoria ?? 'cerveza', producto?.manejaSixpack ?? true)}
            valor={renglon.presentacion}
            alCambiar={(presentacion) => cambiar(renglon.clave, { presentacion })}
          />
        </div>

        <div className="renglon__medidas">
          <div className="campo campo--cantidad">
            <span className="campo__etiqueta">Cantidad</span>
            <div className="cantidad">
              <button
                type="button"
                className="cantidad__boton"
                aria-label="Menos cantidad"
                onClick={() => cambiar(renglon.clave, { cantidad: Math.max(1, renglon.cantidad - 1) })}
              >
                <Minus size={20} strokeWidth={1.5} />
              </button>
              <span className="cantidad__valor" aria-live="polite">{renglon.cantidad}</span>
              <button
                type="button"
                className="cantidad__boton"
                aria-label="Más cantidad"
                onClick={() => cambiar(renglon.clave, { cantidad: renglon.cantidad + 1 })}
              >
                <Plus size={20} strokeWidth={1.5} />
              </button>
            </div>
          </div>
          <label className="campo campo--precio">
            <span className="campo__etiqueta">Precio · opcional</span>
            <span className="entrada">
              <input
                type="text"
                inputMode="numeric"
                className="entrada__control"
                placeholder={fila.precioLista === null ? '' : formatoPesos(fila.precioLista)}
                value={renglon.precioCobrado === undefined ? '' : String(renglon.precioCobrado)}
                onChange={(e) => {
                  const digitos = e.target.value.replace(/\D/g, '')
                  cambiar(renglon.clave, { precioCobrado: digitos === '' ? undefined : Number(digitos) })
                }}
              />
            </span>
          </label>
        </div>

        <div className="division" />
        <div className="dato">
          <span className="dato__etiqueta">{unidadesTexto(fila.unidades)}</span>
          <span className="dato__subtotal">{formatoPesos(fila.subtotal ?? 0)}</span>
        </div>
      </section>
    )
  }

  return (
    <>
      <CabeceraInterna titulo="Nueva venta" subtitulo="Se descuenta de la nevera" alVolver={() => alIr('inicio')} />
      <div className="marco__contenido">
        <CampoFecha valor={borrador.fecha} hoy={hoy} alCambiar={(fecha) => setBorrador((b) => ({ ...b, fecha }))} />
        <p className="texto-suave">Precio por presentación. Si lo dejas vacío, se usa el precio del catálogo.</p>

        {/* El botón va arriba porque el renglón nuevo aparece de primero. */}
        <button
          type="button"
          className="boton"
          onClick={() => {
            contador.current += 1
            const clave = `r${contador.current}`
            setBorrador((b) => agregarRenglon(b, clave))
          }}
        >
          <Plus size={18} strokeWidth={1.5} aria-hidden="true" />
          <span className="boton__texto">Agregar renglón</span>
        </button>

        {borrador.renglones.map(dibujarRenglon)}


        <div className="dato">
          <span className="dato__etiqueta">Total · {unidadesTexto(calculado.unidades)}</span>
          <span className="dato__total">{formatoPesos(calculado.total)}</span>
        </div>

        {falloRegistro !== null && (
          <div className="aviso aviso--error">
            <div className="aviso__mensaje">
              <span className="aviso__titulo">No se pudo registrar la venta</span>
              <span role="alert">{falloRegistro}</span>
            </div>
          </div>
        )}

        <button
          type="button"
          className="boton boton--primario"
          disabled={!calculado.puedeRegistrar || enviando}
          onClick={registrar}
        >
          Registrar
        </button>
      </div>
    </>
  )
}
