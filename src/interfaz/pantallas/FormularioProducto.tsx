/**
 * Pantalla "Nuevo producto" / "Editar producto".
 *
 * Qué hace: pide nombre, unidades por caja, si maneja sixpack y los precios de
 * unidad y caja, y guarda un producto nuevo o los cambios de uno existente.
 * Cómo lo hace: `validarProducto` (aplicacion) revisa los campos y devuelve un
 * mensaje por campo; al guardar llama a crear o editar y vuelve a la lista. El
 * producto a editar viaja en la ruta.
 * Por qué: cambiar un precio no altera ventas pasadas, porque cada venta
 * guarda el precio cobrado; por eso se avisa al editar.
 */
import { useCallback, useState } from 'react'
import { validarProducto, type EntradaProducto } from '../../aplicacion/formularioProducto'
import type { RepositorioInventario } from '../../datos/inventario'
import { CabeceraInterna } from '../componentes/CabeceraInterna'
import { EstadoDeCarga } from '../componentes/EstadoDeCarga'
import { CATEGORIAS, etiquetaCategoria } from '../../domain/inventario/categorias'
import { Opciones } from '../componentes/Opciones'
import { useCarga } from '../useCarga'

/** Servicios que necesita la pantalla. */
export interface ServiciosFormularioProducto {
  inventario: Pick<RepositorioInventario, 'listarProductos' | 'crearProducto' | 'editarProducto'>
}

interface Propiedades {
  servicios: ServiciosFormularioProducto
  /** Producto a editar (de la ruta); sin él se crea uno nuevo. */
  productoId?: string
  /** Ruta a la que volver (por defecto la lista de productos). */
  volverA?: string
  alIr: (ruta: string) => void
}

const VACIA: EntradaProducto = { nombre: '', categoria: 'cerveza', unidadesPorCaja: '', manejaSixpack: false, precioUnidad: '', precioCaja: '' }

/** Solo dígitos: los montos y cantidades son enteros. */
const soloDigitos = (texto: string) => texto.replace(/\D/g, '')

export function FormularioProducto({ servicios, productoId, volverA = 'mas/productos', alIr }: Propiedades) {
  const cargar = useCallback(() => servicios.inventario.listarProductos(), [servicios])
  const { estado, datos: productos, error, recargar } = useCarga(cargar)
  const [cambios, setCambios] = useState<Partial<EntradaProducto>>({})
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const editando = productoId !== undefined
  const cabecera = (
    <CabeceraInterna
      titulo={editando ? 'Editar producto' : 'Nuevo producto'}
      subtitulo={editando ? 'Nombre, presentación y precios' : 'Agrégalo al catálogo'}
      alVolver={() => alIr(volverA)}
    />
  )
  if (estado !== 'listo' || productos === null) {
    return (
      <>
        {cabecera}
        <div className="marco__contenido">
          <EstadoDeCarga estado={estado === 'error' ? 'error' : 'cargando'} error={error} que="los productos" reintentar={recargar} />
        </div>
      </>
    )
  }

  const actual = editando ? productos.find((p) => p.id === productoId) : undefined
  if (editando && actual === undefined) {
    return (
      <>
        {cabecera}
        <div className="marco__contenido">
          <span role="alert" className="texto-error">Ese producto no existe.</span>
          <button type="button" className="boton" onClick={() => alIr(volverA)}>Volver</button>
        </div>
      </>
    )
  }

  const base: EntradaProducto = actual === undefined
    ? VACIA
    : {
        nombre: actual.nombre,
        categoria: actual.categoria,
        unidadesPorCaja: String(actual.unidadesPorCaja),
        manejaSixpack: actual.manejaSixpack,
        precioUnidad: String(actual.precioUnidad),
        precioCaja: String(actual.precioCaja),
      }
  const entrada: EntradaProducto = { ...base, ...cambios }
  const cambiar = (parcial: Partial<EntradaProducto>) => setCambios((c) => ({ ...c, ...parcial }))
  const otros = productos.filter((p) => p.id !== productoId).map((p) => p.nombre)
  const resultado = validarProducto(entrada, otros)
  const esLicor = entrada.categoria === 'licor'
  // Los errores se muestran solo en campos que ya se tocaron o llenaron.
  const visible = (campo: keyof EntradaProducto) => (entrada[campo] !== '' || cambios[campo] !== undefined) ? resultado.errores[campo as keyof typeof resultado.errores] : undefined

  const guardar = async () => {
    if (resultado.datos === null) return
    setEnviando(true)
    setFallo(null)
    try {
      if (editando) await servicios.inventario.editarProducto(productoId, resultado.datos)
      else await servicios.inventario.crearProducto(resultado.datos)
      alIr(volverA)
    } catch (causa) {
      setFallo(causa instanceof Error ? causa.message : String(causa))
      setEnviando(false)
    }
  }

  const campoTexto = (id: string, etiqueta: string, campo: 'nombre' | 'unidadesPorCaja' | 'precioUnidad' | 'precioCaja', numerico: boolean) => (
    <div className="campo">
      <label className="campo__etiqueta" htmlFor={id}>{etiqueta}</label>
      <div className="entrada">
        <input
          id={id}
          type="text"
          inputMode={numerico ? 'numeric' : 'text'}
          className="entrada__control"
          value={entrada[campo]}
          onChange={(e) => cambiar({ [campo]: numerico ? soloDigitos(e.target.value) : e.target.value })}
        />
      </div>
      {visible(campo) !== undefined && <span className="texto-error">{visible(campo)}</span>}
    </div>
  )

  return (
    <>
      {cabecera}
      <div className="marco__contenido">
        {campoTexto('nombre-producto', 'Nombre', 'nombre', false)}
        <div className="campo">
          <span className="campo__etiqueta">Categoría</span>
          <Opciones
            nombre="Categoría"
            opciones={CATEGORIAS.map((c) => ({ valor: c, etiqueta: etiquetaCategoria(c) }))}
            valor={entrada.categoria}
            alCambiar={(categoria) => cambiar({ categoria })}
          />
          {esLicor && <p className="texto-suave">El licor se vende por botella entera: sin sixpack ni caja.</p>}
        </div>
        {!esLicor && campoTexto('unidades-caja', 'Unidades por caja', 'unidadesPorCaja', true)}
        {!esLicor && (
          <div className="campo">
            <span className="campo__etiqueta">¿Maneja sixpack?</span>
            <Opciones
              nombre="Maneja sixpack"
              opciones={[{ valor: 'si', etiqueta: 'Sí' }, { valor: 'no', etiqueta: 'No' }]}
              valor={entrada.manejaSixpack ? 'si' : 'no'}
              alCambiar={(v) => cambiar({ manejaSixpack: v === 'si' })}
            />
            <p className="texto-suave">Un sixpack siempre son 6 unidades.</p>
          </div>
        )}
        {campoTexto('precio-unidad', esLicor ? 'Precio de la botella' : 'Precio de la unidad', 'precioUnidad', true)}
        {!esLicor && campoTexto('precio-caja', 'Precio de la caja', 'precioCaja', true)}

        {editando && <p className="texto-suave">Cambiar un precio no altera las ventas pasadas.</p>}
        {fallo !== null && <span role="alert" className="texto-error">{fallo}</span>}

        <button type="button" className="boton boton--primario" disabled={!resultado.puedeGuardar || enviando} onClick={guardar}>
          Guardar producto
        </button>
      </div>
    </>
  )
}
