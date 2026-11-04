/**
 * Filtro por categoría de producto.
 *
 * Qué hace: muestra Todas, Cerveza, Licor y Otros, y deja elegir una.
 * Cómo lo hace: usa el control segmentado `Opciones` con las categorías del
 * dominio.
 * Por qué: Productos e Inventario filtran igual; un solo componente evita
 * repetirlo y mantiene el mismo aspecto.
 */
import { CATEGORIAS, etiquetaCategoria, type FiltroCategoria } from '../../domain/inventario/categorias'
import { Opciones } from './Opciones'

interface Propiedades {
  valor: FiltroCategoria
  alCambiar: (valor: FiltroCategoria) => void
}

export function FiltroDeCategoria({ valor, alCambiar }: Propiedades) {
  const opciones = [
    { valor: 'todas' as FiltroCategoria, etiqueta: 'Todas' },
    ...CATEGORIAS.map((c) => ({ valor: c as FiltroCategoria, etiqueta: etiquetaCategoria(c) })),
  ]
  return <Opciones nombre="Categoría" opciones={opciones} valor={valor} alCambiar={alCambiar} />
}
