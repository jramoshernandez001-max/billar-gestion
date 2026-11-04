/**
 * Pantalla "Bitácora".
 *
 * Qué hace: lista todo lo que cambió datos (quién, cuándo y qué), con filtros
 * por tipo de movimiento y por usuario, y acceso al detalle de cada entrada.
 * Cómo lo hace: carga la bitácora y `resumirBitacora` (aplicacion) filtra,
 * ordena y pagina de a 20.
 * Por qué: los dos usuarios tienen los mismos permisos; la bitácora es la
 * evidencia de quién anuló o corrigió algo y por qué. La app nunca escribe en
 * ella: lo hacen las funciones de la base.
 */
import { useCallback, useMemo, useState } from 'react'
import { resumirBitacora, type GrupoBitacora } from '../../aplicacion/resumenBitacora'
import type { RepositorioBitacora } from '../../datos/bitacora'
import { CabeceraInterna } from '../componentes/CabeceraInterna'
import { EstadoDeCarga } from '../componentes/EstadoDeCarga'
import { ListaDesplegable } from '../componentes/ListaDesplegable'
import { momentoLocal } from '../formato'
import { useCarga } from '../useCarga'

/** Servicios que necesita la pantalla. */
export interface ServiciosBitacora {
  bitacora: Pick<RepositorioBitacora, 'listarBitacora'>
}

interface Propiedades {
  servicios: ServiciosBitacora
  alIr: (ruta: string) => void
}

const PAGINA = 20

const GRUPOS = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'ventas', etiqueta: 'Ventas' },
  { valor: 'compras', etiqueta: 'Compras' },
  { valor: 'inventario', etiqueta: 'Inventario' },
  { valor: 'deudas', etiqueta: 'Deudas' },
  { valor: 'cierres', etiqueta: 'Cierres' },
  { valor: 'productos', etiqueta: 'Productos' },
] as const

export function Bitacora({ servicios, alIr }: Propiedades) {
  const cargar = useCallback(() => servicios.bitacora.listarBitacora(), [servicios])
  const { estado, datos, error, recargar } = useCarga(cargar)
  const [grupo, setGrupo] = useState<GrupoBitacora>('todos')
  const [usuario, setUsuario] = useState<string | null>(null)
  const [limite, setLimite] = useState(PAGINA)

  const resumen = useMemo(
    () => (datos === null ? null : resumirBitacora({ entradas: datos, grupo, usuario, limite })),
    [datos, grupo, usuario, limite],
  )

  const cabecera = <CabeceraInterna titulo="Bitácora" subtitulo="Quién cambió qué" alVolver={() => alIr('mas')} />
  if (resumen === null) {
    return (
      <>
        {cabecera}
        <div className="marco__contenido">
          <EstadoDeCarga estado={estado === 'error' ? 'error' : 'cargando'} error={error} que="la bitácora" reintentar={recargar} />
        </div>
      </>
    )
  }

  return (
    <>
      {cabecera}
      <div className="marco__contenido">
        <ListaDesplegable etiqueta="Tipo de movimiento" valor={grupo} opciones={GRUPOS} alCambiar={(g) => { setGrupo(g as GrupoBitacora); setLimite(PAGINA) }} />
        <ListaDesplegable
          etiqueta="Usuario"
          valor={usuario ?? 'todos'}
          opciones={[{ valor: 'todos', etiqueta: 'Todos' }, ...resumen.usuarios.map((u) => ({ valor: u, etiqueta: u }))]}
          alCambiar={(u) => { setUsuario(u === 'todos' ? null : u); setLimite(PAGINA) }}
        />

        {resumen.tarjetas.length === 0 && <p className="estado">No hay movimientos.</p>}
        {resumen.tarjetas.map((t) => (
          <button key={t.id} type="button" className="tarjeta tarjeta--boton" onClick={() => alIr(`mas/bitacora/${t.id}`)}>
            <span className="tarjeta__cabecera">
              <span className="renglones__descripcion">{t.titulo}</span>
              <span className="texto-suave">{momentoLocal(t.momento)}</span>
            </span>
            <span className="texto-suave">{t.usuario}</span>
            {t.motivo !== null && <span className="texto-suave">Motivo: {t.motivo}</span>}
          </button>
        ))}

        {resumen.total > resumen.tarjetas.length && (
          <p className="texto-suave texto-centrado">
            <span>{resumen.tarjetas.length} de {resumen.total} movimientos</span> ·{' '}
            <button type="button" className="enlace" onClick={() => setLimite((l) => l + PAGINA)}>Cargar más</button>
          </p>
        )}
      </div>
    </>
  )
}
