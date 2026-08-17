import type {
  Filament,
  InsumoUsado,
  InventoryItem,
  Print,
  Project,
} from "./types";

const n = (v: number | string | null | undefined): number => {
  const parsed = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

// ------------------------------------------------------------
// Costos
// ------------------------------------------------------------

export type ProjectBreakdown = {
  /** Lo que cuesta imprimir una pieza: el `costo_total` congelado del cálculo. */
  costoPiezaUnitario: number;
  /** Insumos de armado y embalaje de UNA unidad. */
  costoInsumosUnitario: number;
  costoUnitario: number;
  precioNetoUnitario: number;
  precioFinalUnitario: number;
  cantidad: number;
  costoTotal: number;
  precioNeto: number;
  precioFinalConIva: number;
  ganancia: number;
};

/**
 * El proyecto suma el costo ya congelado del cálculo y sus insumos de armado, y
 * aplica **su propio** margen. El `margen_pct` del cálculo se ignora a propósito:
 * la pieza cuesta, el proyecto vende. Aplicar los dos sería margen sobre margen.
 *
 * Los insumos de armado tampoco pasan por el % de desperdicio: ese porcentaje
 * modela fallas de impresión y ya viene cobrado dentro de `costoPiezaUnitario`.
 * Una caja de embalaje no se pierde porque falle una pieza.
 */
export function calcularProyecto(input: {
  costoPiezaUnitario: number;
  insumosUsados: InsumoUsado[];
  cantidad: number;
  margenPct: number;
  ivaPct: number;
}): ProjectBreakdown {
  const cantidad = n(input.cantidad);
  const costoPiezaUnitario = n(input.costoPiezaUnitario);

  const costoInsumosUnitario = (input.insumosUsados ?? []).reduce(
    (acc, i) => acc + n(i.cantidad) * n(i.costo_unitario),
    0,
  );

  const costoUnitario = costoPiezaUnitario + costoInsumosUnitario;
  const precioNetoUnitario = costoUnitario * (1 + n(input.margenPct) / 100);
  const precioFinalUnitario = precioNetoUnitario * (1 + n(input.ivaPct) / 100);

  const costoTotal = costoUnitario * cantidad;
  const precioNeto = precioNetoUnitario * cantidad;

  return {
    costoPiezaUnitario,
    costoInsumosUnitario,
    costoUnitario,
    precioNetoUnitario,
    precioFinalUnitario,
    cantidad,
    costoTotal,
    precioNeto,
    precioFinalConIva: precioFinalUnitario * cantidad,
    ganancia: precioNeto - costoTotal,
  };
}

/**
 * Resuelve el desglose de un proyecto guardado.
 *
 * Mientras es borrador se deriva en vivo del cálculo asociado, así que editar el
 * cálculo se refleja en el proyecto. Una vez lanzado manda el snapshot congelado:
 * el cálculo puede editarse o borrarse después y el proyecto ya cobró lo que
 * cobró.
 */
export function breakdownDeProyecto(
  project: Project,
  print: Print | null,
): ProjectBreakdown {
  if (project.status === "lanzado") {
    const cantidad = n(project.cantidad);
    const precioNeto = n(project.precio_neto);
    return {
      costoPiezaUnitario: n(project.costo_pieza_unitario),
      costoInsumosUnitario: n(project.costo_insumos_unitario),
      costoUnitario: n(project.costo_unitario),
      precioNetoUnitario: cantidad > 0 ? precioNeto / cantidad : 0,
      precioFinalUnitario:
        cantidad > 0 ? n(project.precio_final_con_iva) / cantidad : 0,
      cantidad,
      costoTotal: n(project.costo_total),
      precioNeto,
      precioFinalConIva: n(project.precio_final_con_iva),
      ganancia: precioNeto - n(project.costo_total),
    };
  }

  return calcularProyecto({
    costoPiezaUnitario: n(print?.costo_total),
    insumosUsados: project.insumos_usados ?? [],
    cantidad: n(project.cantidad),
    margenPct: n(project.margen_pct),
    ivaPct: n(project.iva_pct),
  });
}

// ------------------------------------------------------------
// Materiales consolidados
// ------------------------------------------------------------

export type MaterialFilamento = {
  filament_id: string;
  filamento: Filament | undefined;
  /** Gramos de la pieza × cantidad. */
  gramos: number;
  /** Lo que conviene tener: los gramos más el % de desperdicio del cálculo. */
  gramosConDesperdicio: number;
  stock: number;
  /** 0 si alcanza. Contra `gramosConDesperdicio`, que es lo que se va a gastar. */
  falta: number;
};

/** De dónde sale un insumo: la pieza impresa, el armado del proyecto, o ambos. */
export type OrigenInsumo = "impresion" | "armado" | "ambos";

export type MaterialInsumo = {
  item_id: string;
  item: InventoryItem | undefined;
  cantidad: number;
  origen: OrigenInsumo;
  stock: number;
  falta: number;
  /** Unidad congelada de la línea, para poder mostrar totales sin el catálogo. */
  costoTotal: number;
};

export type MaterialesProyecto = {
  filamentos: MaterialFilamento[];
  insumos: MaterialInsumo[];
  gramosTotales: number;
  /** true si a algo no le alcanza el stock actual. */
  hayFaltantes: boolean;
};

/**
 * Lista de materiales del proyecto completo: qué comprar y cuánto falta.
 *
 * Consolida en una sola fila por material los insumos que vienen de la impresión
 * y los que agrega el armado del proyecto — que es justamente lo que no se puede
 * ver mirando el cálculo por un lado y el inventario por el otro.
 *
 * El faltante es una **foto, no una reserva**: dos proyectos en borrador pueden
 * reclamar el mismo carrete y los dos se verán en verde.
 */
export function consolidarMateriales(input: {
  print: Print | null;
  insumosProyecto: InsumoUsado[];
  cantidad: number;
  filamentos: Filament[];
  items: InventoryItem[];
}): MaterialesProyecto {
  const cantidad = n(input.cantidad);
  const filamentosPorId = new Map(input.filamentos.map((f) => [f.id, f]));
  const itemsPorId = new Map(input.items.map((i) => [i.id, i]));
  const desperdicio = 1 + n(input.print?.desperdicio_pct) / 100;

  const acumFilamentos = new Map<string, number>();
  for (const fu of input.print?.filamentos_usados ?? []) {
    acumFilamentos.set(
      fu.filament_id,
      (acumFilamentos.get(fu.filament_id) ?? 0) + n(fu.gramos) * cantidad,
    );
  }

  const filamentos: MaterialFilamento[] = [...acumFilamentos.entries()].map(
    ([filament_id, gramos]) => {
      const filamento = filamentosPorId.get(filament_id);
      const gramosConDesperdicio = gramos * desperdicio;
      const stock = n(filamento?.stock_gramos);
      return {
        filament_id,
        filamento,
        gramos,
        gramosConDesperdicio,
        stock,
        falta: Math.max(0, gramosConDesperdicio - stock),
      };
    },
  );

  // Un mismo ítem puede llegar por los dos lados (un NFC embebido en la pieza y
  // otro suelto en la caja): se suman en una fila y el origen queda en "ambos".
  const acumInsumos = new Map<
    string,
    { cantidad: number; costoTotal: number; origen: OrigenInsumo }
  >();

  const sumar = (
    linea: InsumoUsado,
    origen: Exclude<OrigenInsumo, "ambos">,
  ) => {
    const previo = acumInsumos.get(linea.item_id);
    const total = n(linea.cantidad) * cantidad;
    acumInsumos.set(linea.item_id, {
      cantidad: (previo?.cantidad ?? 0) + total,
      costoTotal: (previo?.costoTotal ?? 0) + total * n(linea.costo_unitario),
      origen: !previo || previo.origen === origen ? origen : "ambos",
    });
  };

  for (const iu of input.print?.insumos_usados ?? []) sumar(iu, "impresion");
  for (const iu of input.insumosProyecto ?? []) sumar(iu, "armado");

  const insumos: MaterialInsumo[] = [...acumInsumos.entries()].map(
    ([item_id, acc]) => {
      const item = itemsPorId.get(item_id);
      const stock = n(item?.stock);
      return {
        item_id,
        item,
        cantidad: acc.cantidad,
        origen: acc.origen,
        stock,
        falta: Math.max(0, acc.cantidad - stock),
        costoTotal: acc.costoTotal,
      };
    },
  );

  return {
    filamentos,
    insumos,
    gramosTotales: filamentos.reduce((acc, f) => acc + f.gramos, 0),
    hayFaltantes:
      filamentos.some((f) => f.falta > 0) || insumos.some((i) => i.falta > 0),
  };
}
