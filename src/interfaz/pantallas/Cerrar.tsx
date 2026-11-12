/**
 * Pantalla de cierre (diario y semanal).
 *
 * Qué hace: pide el efectivo y las transferencias contados, muestra al
 * instante el resultado (cuadra, faltante o sobrante y, en la semana, la
 * utilidad) y guarda el cierre. En la semana pide el costo por unidad de los
 * productos vendidos sin compras. También lista los productos vendidos del
 * periodo para revisar qué se vendió antes de confirmar.
 * Cómo lo hace: llama a `vistaPreviaCierre` cada vez que cambian los datos,
 * convierte el resultado con `describirCierre` y lo dibuja con
 * `ResumenCierre`; al confirmar llama a `cerrarPeriodo` y va al detalle.
 * Por qué: la vista previa y el cierre guardado usan el mismo cálculo, así lo
 * que se ve es lo que queda. Un producto sin costo nunca se toma como cero:
 * se pide el costo o el cierre queda incompleto.
 */
import { useEffect, useMemo, useState } from 'react'
import { describirCierre, type VistaCierre } from '../../aplicacion/vistaCierre'
import type { RepositorioInventario, Producto } from '../../datos/inventario'
import type { RepositorioVentas, VentaRegistrada } from '../../datos/ventas'
import { resumirProductosVendidos } from '../../aplicacion/productosVendidos'
import type { ServicioCierres } from '../../aplicacion/servicioCierres'
import { lunesDe } from '../../domain/compartido/semana'
import { CabeceraInterna } from '../componentes/CabeceraInterna'
import { CampoFecha } from '../componentes/CampoFecha'
import { Opciones } from '../componentes/Opciones'
import { ProductosVendidos } from '../componentes/ProductosVendidos'
import { ResumenCierre } from '../componentes/ResumenCierre'
import { fechaCorta } from '../formato'

/** Servicios que necesita la pantalla. */
export interface ServiciosCerrar {
  inventario: Pick<RepositorioInventario, 'listarProductos'>
  ventas: Pick<RepositorioVentas, 'listarVentas'>
  servicioCierres: Pick<ServicioCierres, 'vistaPreviaCierre' | 'cerrarPeriodo'>
}

interface Propiedades {
  servicios: ServiciosCerrar
  tipo: 'diario' | 'semanal'
  /** Día de hoy, AAAA-MM-DD. */
  hoy: string
  alIr: (ruta: string) => void
}

/** Resultado de la última vista previa pedida, con la clave de sus datos. */
type Previa = { clave: string; vista: VistaCierre; hasta: string } | { clave: string; error: string }

/** Entero o null si el texto no es un entero mayor a cero. */
const entero = (texto: string) => (/^\d+$/.test(texto) && Number(texto) > 0 ? Number(texto) : null)

export function Cerrar({ servicios, tipo, hoy, alIr }: Propiedades) {
  const [fecha, setFecha] = useState(hoy)
  const [efectivo, setEfectivo] = useState('')
  const [transferencias, setTransferencias] = useState('')
  const [costos, setCostos] = useState<Record<string, string>>({})
  const [nombres, setNombres] = useState<ReadonlyMap<string, string>>(new Map())
  const [productos, setProductos] = useState<readonly Producto[]>([])
  const [ventas, setVentas] = useState<readonly VentaRegistrada[]>([])
  const [previa, setPrevia] = useState<Previa | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const desde = tipo === 'diario' ? fecha : lunesDe(fecha)
  const costosManuales = useMemo(() => {
    const r: Record<string, number> = {}
    for (const [id, texto] of Object.entries(costos)) {
      const n = entero(texto)
      if (n !== null) r[id] = n
    }
    return r
  }, [costos])
  const datos = useMemo(
    () => ({ tipo, desde, efectivo: Number(efectivo || 0), transferencias: Number(transferencias || 0), costosManuales }),
    [tipo, desde, efectivo, transferencias, costosManuales],
  )
  const clave = JSON.stringify(datos)

  // Nombres de productos, para mostrar los que están sin costo.
  useEffect(() => {
    let vigente = true
    servicios.inventario.listarProductos().then(
      (lista) => {
        if (!vigente) return
        setNombres(new Map(lista.map((p) => [p.id, p.nombre])))
        setProductos(lista)
      },
      () => undefined,
    )
    return () => { vigente = false }
  }, [servicios])

  // Ventas, para listar lo vendido del periodo (si falla, solo se omite el bloque).
  useEffect(() => {
    let vigente = true
    servicios.ventas.listarVentas().then(
      (lista) => { if (vigente) setVentas(lista) },
      () => undefined,
    )
    return () => { vigente = false }
  }, [servicios])

  // Vista previa: se recalcula cuando cambian los datos; se descarta la respuesta vieja.
  useEffect(() => {
    let vigente = true
    servicios.servicioCierres.vistaPreviaCierre(datos).then(
      (r) => {
        if (!vigente) return
        try {
          setPrevia({ clave, hasta: r.hasta, vista: describirCierre(tipo, r.resultado, { efectivo: datos.efectivo, transferencias: datos.transferencias }, nombres) })
        } catch (causa) {
          setPrevia({ clave, error: causa instanceof Error ? causa.message : String(causa) })
        }
      },
      (causa: unknown) => { if (vigente) setPrevia({ clave, error: causa instanceof Error ? causa.message : String(causa) }) },
    )
    return () => { vigente = false }
  }, [servicios, datos, clave, tipo, nombres])

  const actual = previa !== null && previa.clave === clave ? previa : null
  const vista = actual !== null && 'vista' in actual ? actual.vista : null
  const hasta = actual !== null && 'vista' in actual ? actual.hasta : null
  const errorPrevia = actual !== null && 'error' in actual ? actual.error : null

  // Productos vendidos del periodo que se está cerrando (mismo cálculo del detalle).
  const vendidos = useMemo(() => {
    if (hasta === null) return null
    const catalogo = new Map(productos.map((p) => [p.id, { nombre: p.nombre, categoria: p.categoria }]))
    return resumirProductosVendidos(ventas, desde, hasta, catalogo)
  }, [ventas, productos, desde, hasta])

  const cerrar = async () => {
    setEnviando(true)
    setFallo(null)
    try {
      const id = await servicios.servicioCierres.cerrarPeriodo(datos)
      alIr(`mas/cierres/${id}`)
    } catch (causa) {
      setFallo(causa instanceof Error ? causa.message : String(causa))
      setEnviando(false)
    }
  }

  const solo = (set: (v: string) => void) => (e: { target: { value: string } }) => set(e.target.value.replace(/\D/g, ''))
  return (
    <>
      <CabeceraInterna titulo={tipo === 'diario' ? 'Cerrar día' : 'Cerrar semana'} subtitulo="Cuadra lo vendido con el dinero" alVolver={() => alIr('mas/cierres')} />
      <div className="marco__contenido">
        <Opciones
          nombre="Tipo de cierre"
          opciones={[{ valor: 'diario', etiqueta: 'Diario' }, { valor: 'semanal', etiqueta: 'Semanal' }]}
          valor={tipo}
          alCambiar={(t) => alIr(`cierres/${t}`)}
        />
        <CampoFecha valor={fecha} hoy={hoy} etiqueta={tipo === 'diario' ? 'Fecha' : 'Semana que contiene'} alCambiar={setFecha} />
        {tipo === 'semanal' && hasta !== null && <p className="texto-suave">{fechaCorta(desde)} – {fechaCorta(hasta)}</p>}

        <div className="campo">
          <label className="campo__etiqueta" htmlFor="efectivo-cierre">Efectivo</label>
          <div className="entrada"><input id="efectivo-cierre" type="text" inputMode="numeric" className="entrada__control" placeholder="$ 0" value={efectivo} onChange={solo(setEfectivo)} /></div>
        </div>
        <div className="campo">
          <label className="campo__etiqueta" htmlFor="transferencias-cierre">Transferencias</label>
          <div className="entrada"><input id="transferencias-cierre" type="text" inputMode="numeric" className="entrada__control" placeholder="$ 0" value={transferencias} onChange={solo(setTransferencias)} /></div>
        </div>

        {errorPrevia !== null && <span role="alert" className="texto-error">{errorPrevia}</span>}
        {vista === null && errorPrevia === null && <p role="status" className="estado">Calculando…</p>}
        {vista !== null && vista.semanal !== null && vista.semanal.productosSinCosto.map((p) => (
          <div className="campo" key={p.id}>
            <label className="campo__etiqueta" htmlFor={`costo-${p.id}`}>Costo por unidad · {p.nombre}</label>
            <div className="entrada"><input id={`costo-${p.id}`} type="text" inputMode="numeric" className="entrada__control" placeholder="$ 0" value={costos[p.id] ?? ''} onChange={(e) => setCostos((c) => ({ ...c, [p.id]: e.target.value.replace(/\D/g, '') }))} /></div>
          </div>
        ))}
        {vista !== null && <ResumenCierre vista={vista} />}
        {vendidos !== null && <ProductosVendidos datos={vendidos} mostrarCajas={tipo === 'semanal'} />}

        {fallo !== null && <span role="alert" className="texto-error">{fallo}</span>}
        <button type="button" className="boton boton--primario" disabled={vista === null || enviando} onClick={cerrar}>
          {tipo === 'diario' ? 'Cerrar día' : 'Cerrar semana'}
        </button>
      </div>
    </>
  )
}
