/** Solo lo que no depende de la máquina; el resto vive en cada Printer. */
export type UserSettings = {
  user_id: string;
  tarifa_luz_clp_kwh: number;
  iva_pct: number;
  updated_at: string;
};

export type Printer = {
  id: string;
  user_id: string;
  nombre: string;
  marca: string;
  modelo: string;
  color_hex: string;
  consumo_w: number;
  tarifa_mano_obra_clp_hora: number;
  costo_depreciacion_clp_hora: number;
  desperdicio_pct_default: number;
  activo: boolean;
  es_default: boolean;
  created_at: string;
  updated_at: string;
};

export type Filament = {
  id: string;
  user_id: string;
  marca: string;
  material: string;
  color_nombre: string;
  color_hex: string;
  costo_clp_kg: number;
  stock_gramos: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

/** Insumo de taller que no es filamento: NFC, argollas, imanes, boquillas. */
export type InventoryItem = {
  id: string;
  user_id: string;
  nombre: string;
  /** Texto libre: cada taller nombra sus cosas distinto. */
  categoria: string;
  unidad: string;
  color_hex: string;
  costo_clp_unidad: number;
  stock: number;
  /** 0 = sin alerta. Por ítem, porque las unidades no son comparables. */
  stock_minimo: number;
  /** Los repuestos de taller no entran al selector de la calculadora. */
  usa_en_calculo: boolean;
  /** Si se pierde cuando la impresión falla (NFC embebido sí, embalaje no). */
  aplica_desperdicio: boolean;
  nota: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type FilamentoUsado = {
  filament_id: string;
  gramos: number;
};

/**
 * Línea de insumo dentro de un cálculo. Congela costo y comportamiento frente
 * al desperdicio: el precio del ítem puede cambiar mañana, el cálculo no.
 */
export type InsumoUsado = {
  item_id: string;
  cantidad: number;
  costo_unitario: number;
  aplica_desperdicio: boolean;
};

export type PrintStatus = "borrador" | "lanzada";

export type Print = {
  id: string;
  user_id: string;
  /** Null solo si la impresora se eliminó después: el cálculo ya guarda sus costos. */
  printer_id: string | null;
  nombre_proyecto: string;
  status: PrintStatus;
  tiempo_impresion_horas: number;
  filamentos_usados: FilamentoUsado[];
  insumos_usados: InsumoUsado[];
  costo_filamento: number;
  costo_insumos: number;
  costo_luz: number;
  costo_mano_obra: number;
  costo_depreciacion: number;
  desperdicio_pct: number;
  iva_pct: number;
  margen_pct: number;
  costo_total: number;
  precio_neto: number;
  precio_final_con_iva: number;
  notas: string | null;
  fecha_lanzamiento: string | null;
  created_at: string;
  updated_at: string;
};

export type ProjectStatus = "borrador" | "lanzado";

/**
 * Producto vendible: un cálculo repetido `cantidad` veces, más los insumos de
 * armado y embalaje que no pertenecen a la impresión.
 *
 * Todo lo que declara es la **receta de una unidad** y `cantidad` multiplica la
 * receta completa, así que el mismo proyecto entrega costo unitario y costo del
 * lote sin que nadie multiplique a mano.
 */
export type Project = {
  id: string;
  user_id: string;
  nombre: string;
  descripcion: string | null;
  color_hex: string;
  /** Null si aún no le asociaron cálculo, o si el cálculo se eliminó después. */
  print_id: string | null;
  cantidad: number;
  /** Insumos de armado por unidad; mismo shape congelado que en `Print`. */
  insumos_usados: InsumoUsado[];
  /** El margen es del proyecto: la pieza cuesta, el proyecto vende. */
  margen_pct: number;
  iva_pct: number;
  status: ProjectStatus;
  notas: string | null;
  /** Los seis costos solo tienen valor una vez lanzado; antes se derivan en vivo. */
  costo_pieza_unitario: number;
  costo_insumos_unitario: number;
  costo_unitario: number;
  costo_total: number;
  precio_neto: number;
  precio_final_con_iva: number;
  fecha_lanzamiento: string | null;
  created_at: string;
  updated_at: string;
};

export const MATERIALES = [
  "PLA",
  "PLA+",
  "ABS",
  "PETG",
  "TPU",
  "ASA",
  "Nylon",
  "PC",
  "PVA",
  "HIPS",
  "Otro",
] as const;

/**
 * Unidades del inventario de insumos. La primera es la habitual (piezas); el
 * resto cubre lo que se compra a granel (pegamento, cadena, cinta).
 */
export const UNIDADES = ["u", "g", "ml", "m", "cm", "par", "set"] as const;

export const MAX_FILAMENTOS = 4;
export const MAX_INSUMOS = 8;
export const STOCK_BAJO_GRAMOS = 50;

/**
 * Tope de unidades por proyecto. Existe para que un cero de más no dispare un
 * descuento de stock irreversible de un millón de unidades.
 */
export const MAX_CANTIDAD_PROYECTO = 10000;

/** El umbral de los insumos es por ítem; un mínimo en 0 significa "no me avises". */
export const stockBajoInsumo = (
  item: Pick<InventoryItem, "stock" | "stock_minimo">,
): boolean =>
  Number(item.stock_minimo) > 0 &&
  Number(item.stock) <= Number(item.stock_minimo);
