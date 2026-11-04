/**
 * Pantalla de inicio.
 *
 * Qué hace: muestra el saludo, las ventas de hoy (total, número de ventas y
 * unidades), los atajos, los avisos "Por revisar" (stock negativo, cierre
 * desactualizado, deudas) y el gráfico de ventas de los últimos 7 días.
 * Cómo lo hace: carga los datos con `cargarInicio` (lógica de la carpeta
 * aplicacion) y solo los dibuja según el diseño de Figma.
 * Por qué: sin lógica propia, el diseño puede cambiar sin tocar los cálculos.
 * El diseño muestra "Stock bajo", pero la base aún no guarda un stock mínimo
 * por producto; por ahora el aviso es "Stock negativo" (faltan registros).
 */
import { useCallback } from 'react'
import { ArrowRightLeft, ArrowUpRight, CalendarClock, ChevronRight, CheckCheck, Package, Plus, ShoppingBag, Wallet, type LucideIcon } from 'lucide-react'
import { cargarInicio, type DatosInicio, type ServiciosInicio } from '../../aplicacion/cargarInicio'
import { NOMBRE_NEGOCIO } from '../../configuracion/negocio'
import { Cabecera } from '../componentes/Cabecera'
import { diaSemanaCorto, fechaCorta, fechaLarga, formatoPesos, rangoCorto } from '../formato'
import { useCarga } from '../useCarga'

/** Alto máximo de una barra del gráfico, en píxeles (según el diseño). */
const ALTO_MAXIMO_BARRA = 116
const ALTO_MINIMO_BARRA = 4

interface Propiedades {
  servicios: ServiciosInicio
  /** Primer nombre de quien entró; si falta, solo se dice "Hola". */
  nombre?: string
  /** Día de hoy, AAAA-MM-DD. */
  hoy: string
  alIr: (ruta: string) => void
}

/** Singular o plural: plural(1, 'venta', 'ventas') → "1 venta". */
function plural(n: number, singular: string, pluralTexto: string): string {
  return `${n} ${n === 1 ? singular : pluralTexto}`
}

/** Alto de una barra proporcional a la venta más alta de la semana. */
function altoBarra(total: number, maximo: number): number {
  if (maximo === 0) return ALTO_MINIMO_BARRA
  return Math.max(ALTO_MINIMO_BARRA, Math.round((total / maximo) * ALTO_MAXIMO_BARRA))
}

interface AlertaDatos {
  clave: string
  Icono: LucideIcon
  color: 'aviso' | 'ok'
  titulo: string
  texto: string
  ruta: string
}

/** Arma los avisos "Por revisar" a partir de los datos. */
function alertasDe(datos: DatosInicio): AlertaDatos[] {
  const { avisos } = datos.resumen
  const lista: AlertaDatos[] = []
  if (avisos.productosNegativos > 0) {
    lista.push({
      clave: 'stock',
      Icono: Package,
      color: 'aviso',
      titulo: 'Stock negativo',
      texto: `${plural(avisos.productosNegativos, 'producto', 'productos')} con faltantes por registrar`,
      ruta: 'inventario',
    })
  }
  if (datos.primerCierreDesactualizado !== null) {
    lista.push({
      clave: 'cierre',
      Icono: CalendarClock,
      color: 'aviso',
      titulo: 'Cierre desactualizado',
      texto: `${fechaCorta(datos.primerCierreDesactualizado.desde)} · Cambiaron los movimientos`,
      ruta: 'cierres',
    })
  }
  if (avisos.deudaPendiente > 0) {
    lista.push({
      clave: 'deudas',
      Icono: Wallet,
      color: 'ok',
      titulo: 'Deudas pendientes',
      texto: `${formatoPesos(avisos.deudaPendiente)} en ${plural(datos.cuentasConDeuda, 'cuenta', 'cuentas')}`,
      ruta: 'deudas',
    })
  }
  return lista
}

const ATAJOS: readonly { nombre: string; Icono: LucideIcon; ruta: string }[] = [
  { nombre: 'Vender', Icono: Plus, ruta: 'vender' },
  { nombre: 'Comprar', Icono: ShoppingBag, ruta: 'inventario/comprar' },
  { nombre: 'Trasladar', Icono: ArrowRightLeft, ruta: 'inventario/trasladar' },
  { nombre: 'Cerrar día', Icono: CheckCheck, ruta: 'cierres/diario' },
]

export function Inicio({ servicios, nombre, hoy, alIr }: Propiedades) {
  const cargar = useCallback(() => cargarInicio(servicios, hoy), [servicios, hoy])
  const { estado, datos, error, recargar } = useCarga(cargar)

  const cabecera = (
    <Cabecera
      titulo={nombre === undefined ? 'Hola' : `Hola, ${nombre}`}
      subtitulo={`${NOMBRE_NEGOCIO} · ${fechaLarga(hoy)}`}
    />
  )

  if (estado === 'cargando') {
    return (
      <>
        {cabecera}
        <div className="marco__contenido">
          <p role="status" className="estado">Cargando…</p>
        </div>
      </>
    )
  }
  if (estado === 'error' || datos === null) {
    return (
      <>
        {cabecera}
        <div className="marco__contenido">
          <div className="aviso aviso--error">
            <div className="aviso__mensaje">
              <span className="aviso__titulo">No se pudieron cargar los datos</span>
              <span role="alert">{error}</span>
            </div>
          </div>
          <button type="button" className="boton" onClick={recargar}>Reintentar</button>
        </div>
      </>
    )
  }

  const { resumen } = datos
  const alertas = alertasDe(datos)
  const maximo = Math.max(...resumen.ultimosDias.map((d) => d.total))
  const totalSemana = resumen.ultimosDias.reduce((suma, d) => suma + d.total, 0)
  const primero = resumen.ultimosDias[0].fecha
  const ultimo = resumen.ultimosDias[resumen.ultimosDias.length - 1].fecha

  return (
    <>
      {cabecera}
      <div className="marco__contenido">
        <section className="tarjeta tarjeta--destacada">
          <div className="periodo">
            <span>Ventas de hoy</span>
            <ArrowUpRight size={18} strokeWidth={1.5} aria-hidden="true" />
          </div>
          <p className="cifra">{formatoPesos(resumen.hoy.total)}</p>
          <div className="actividad">
            <span>{plural(resumen.hoy.cantidadVentas, 'venta', 'ventas')}</span>
            <span>{plural(resumen.hoy.unidades, 'unidad', 'unidades')}</span>
          </div>
        </section>

        <div className="atajos">
          {ATAJOS.map(({ nombre: etiqueta, Icono, ruta }) => (
            <button key={etiqueta} type="button" className="atajo" onClick={() => alIr(ruta)}>
              <span className="atajo__icono">
                <Icono size={20} strokeWidth={1.5} aria-hidden="true" />
              </span>
              {etiqueta}
            </button>
          ))}
        </div>

        <div className="seccion">
          <h2 className="seccion__titulo">Por revisar</h2>
        </div>
        <section className="tarjeta">
          {alertas.length === 0 ? (
            <p className="texto-suave">Todo en orden</p>
          ) : (
            <div className="alertas">
              {alertas.map(({ clave, Icono, color, titulo, texto, ruta }, i) => (
                <div key={clave} className="alertas">
                  {i > 0 && <div className="division" />}
                  <button type="button" className="alerta" onClick={() => alIr(ruta)}>
                    <Icono size={20} strokeWidth={1.5} className={`alerta__icono--${color}`} aria-hidden="true" />
                    <span className="alerta__detalle">
                      <span className="alerta__titulo">{titulo}</span>
                      <span className="alerta__texto">{texto}</span>
                    </span>
                    <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="seccion">
          <h2 className="seccion__titulo">Últimos 7 días</h2>
        </div>
        <section className="tarjeta">
          <div className="dato">
            <span className="dato__etiqueta">{rangoCorto(primero, ultimo)}</span>
            <span className="dato__valor">{formatoPesos(totalSemana)}</span>
          </div>
          <div className="grafico" role="img" aria-label="Ventas de los últimos 7 días">
            {resumen.ultimosDias.map((dia) => {
              const esHoy = dia.fecha === hoy
              return (
                <div key={dia.fecha} className="grafico__dia">
                  <div
                    className={`grafico__barra${esHoy ? ' grafico__barra--hoy' : ''}`}
                    style={{ height: altoBarra(dia.total, maximo) }}
                  />
                  <span className={`grafico__nombre${esHoy ? ' grafico__nombre--hoy' : ''}`}>{diaSemanaCorto(dia.fecha)}</span>
                </div>
              )
            })}
          </div>
          <p className="texto-suave">Hoy: {formatoPesos(resumen.hoy.total)} · Solo ventas vigentes</p>
        </section>
      </div>
    </>
  )
}
