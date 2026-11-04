/**
 * Pantalla "Ajustar stock" (conteo físico).
 *
 * Qué hace: deja corregir a mano las existencias de un producto en bodega o en
 * nevera: sumar o restar unidades con un motivo obligatorio. Muestra el stock
 * actual y el que quedaría después del ajuste.
 * Cómo lo hace: lee productos y stock; `calcularAjuste` (aplicacion) calcula el
 * stock resultante, las unidades con signo y qué impide guardar; al guardar
 * llama al repositorio de inventario y vuelve a la lista. El producto viaja en
 * la ruta (`inventario/ajustar/<id>`).
 * Por qué: el stock nunca se edita, es la suma de movimientos; un ajuste es un
 * movimiento más y su motivo queda en la bitácora.
 */
import { useState } from 'react'
import { calcularAjuste, type TipoAjuste } from '../../aplicacion/ajusteStock'
import type { RepositorioInventario } from '../../datos/inventario'
import type { Ubicacion } from '../../domain/inventario/stock'
import { CabeceraInterna } from '../componentes/CabeceraInterna'
import { EstadoDeCarga } from '../componentes/EstadoDeCarga'
import { ListaDesplegable } from '../componentes/ListaDesplegable'
import { Opciones } from '../componentes/Opciones'
import { textoUnidades } from '../formato'
import { useDatosInventario } from '../useDatosInventario'

/** Servicios que necesita la pantalla. */
export interface ServiciosAjustar {
  inventario: Pick<RepositorioInventario, 'listarProductos' | 'obtenerStock' | 'registrarAjuste'>
}

interface Propiedades {
  servicios: ServiciosAjustar
  /** Producto elegido (viene de la ruta); sin él hay que elegir uno. */
  productoId?: string
  alIr: (ruta: string) => void
}

const UBICACIONES = [
  { valor: 'bodega', etiqueta: 'Bodega' },
  { valor: 'nevera', etiqueta: 'Nevera' },
] as const

const TIPOS = [
  { valor: 'sumar', etiqueta: 'Sumar (+)' },
  { valor: 'restar', etiqueta: 'Restar (−)' },
] as const

export function AjustarStock({ servicios, productoId, alIr }: Propiedades) {
  const { estado, datos, error, recargar } = useDatosInventario(servicios.inventario)
  const [ubicacion, setUbicacion] = useState<Ubicacion>('nevera')
  const [tipo, setTipo] = useState<TipoAjuste>('sumar')
  const [texto, setTexto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const cabecera = (
    <CabeceraInterna titulo="Ajustar stock" subtitulo="Corrección manual de existencias" alVolver={() => alIr('inventario')} />
  )
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

  const actual = (productoId === undefined ? undefined : datos.stock.get(productoId))?.[ubicacion] ?? 0
  const resultado = calcularAjuste({ actual, tipo, unidades: texto === '' ? null : Number(texto), motivo })
  const nombreUbicacion = ubicacion === 'bodega' ? 'Bodega' : 'Nevera'
  const puedeGuardar = productoId !== undefined && resultado.puedeGuardar && !enviando

  const guardar = async () => {
    if (productoId === undefined || resultado.unidadesConSigno === null) return
    setEnviando(true)
    setFallo(null)
    try {
      await servicios.inventario.registrarAjuste({
        productoId,
        ubicacion,
        unidades: resultado.unidadesConSigno,
        motivo: motivo.trim(),
      })
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
          alCambiar={(id) => alIr(`inventario/ajustar/${id}`)}
        />

        <div className="campo">
          <span className="campo__etiqueta">Ubicación</span>
          <Opciones nombre="Ubicación" opciones={UBICACIONES} valor={ubicacion} alCambiar={setUbicacion} />
        </div>

        <div className="tarjeta">
          <div className="dato">
            <span className="dato__etiqueta">Stock actual · {nombreUbicacion}</span>
            <span className={`dato__valor${actual < 0 ? ' dato__valor--negativo' : ''}`}>{textoUnidades(actual)}</span>
          </div>
          <p className="texto-suave">Cuenta las unidades físicas antes de ajustar.</p>
        </div>

        <div className="campo">
          <span className="campo__etiqueta">Tipo de ajuste</span>
          <Opciones nombre="Tipo de ajuste" opciones={TIPOS} valor={tipo} alCambiar={setTipo} />
        </div>

        <div className="campo">
          <label className="campo__etiqueta" htmlFor="unidades-ajuste">Unidades</label>
          <div className="entrada">
            <input
              id="unidades-ajuste"
              type="text"
              inputMode="numeric"
              className="entrada__control"
              value={texto}
              onChange={(e) => setTexto(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </div>

        <div className="campo">
          <label className="campo__etiqueta" htmlFor="motivo-ajuste">Motivo obligatorio</label>
          <textarea
            id="motivo-ajuste"
            className="entrada entrada--texto entrada--motivo"
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </div>

        <div className="tarjeta tarjeta--destacada">
          <div className="dato">
            <span className="dato__etiqueta">Stock después del ajuste</span>
            <span className="dato__total">{textoUnidades(resultado.despues)}</span>
          </div>
        </div>

        {resultado.problema !== null && texto !== '' && <p className="texto-suave">{resultado.problema}</p>}
        {fallo !== null && <span role="alert" className="texto-error">{fallo}</span>}

        <button type="button" className="boton boton--primario" disabled={!puedeGuardar} onClick={guardar}>
          Guardar ajuste
        </button>
        <p className="texto-suave">El motivo quedará en el registro de movimientos.</p>
      </div>
    </>
  )
}
