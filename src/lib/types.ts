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

export type FilamentoUsado = {
  filament_id: string;
  gramos: number;
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
  costo_filamento: number;
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

export const MAX_FILAMENTOS = 4;
export const STOCK_BAJO_GRAMOS = 50;
