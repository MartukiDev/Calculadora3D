"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ajustarStockInsumo,
  deleteInventoryItem,
  toggleInventoryItemActivo,
} from "@/app/dashboard/actions";
import { Alert, CacheBadge, EmptyState, Modal } from "@/components/ui";
import { inventoryCache } from "@/lib/cache";
import { formatCLP, formatCantidad } from "@/lib/format";
import { stockBajoInsumo, type InventoryItem } from "@/lib/types";
import { InventoryForm } from "./InventoryForm";

const SIN_CATEGORIA = "Sin categoría";

const toNum = (v: string) => {
  const parsed = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

export function InventoryManager({
  items,
  userId,
  loadError,
}: {
  items: InventoryItem[];
  userId: string;
  loadError: string | null;
}) {
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<InventoryItem | null>(null);
  const [mostrarArchivados, setMostrarArchivados] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);

  // Fallback offline: si la carga desde Supabase falló, servimos la caché.
  const cached = useMemo(() => {
    if (!loadError || !userId) return null;
    return inventoryCache.get(userId)?.data ?? null;
  }, [loadError, userId]);

  const lista = cached ?? items;

  useEffect(() => {
    if (!loadError && userId) inventoryCache.set(userId, items);
  }, [loadError, userId, items]);

  const activos = lista.filter((i) => i.activo);
  const archivados = lista.filter((i) => !i.activo);
  const enPestana = mostrarArchivados ? archivados : activos;

  const categorias = useMemo(
    () =>
      [...new Set(lista.map((i) => i.categoria.trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "es"),
      ),
    [lista],
  );

  const termino = busqueda.trim().toLowerCase();
  const visibles = enPestana.filter((i) => {
    const coincideTexto =
      !termino ||
      i.nombre.toLowerCase().includes(termino) ||
      i.categoria.toLowerCase().includes(termino) ||
      (i.nota ?? "").toLowerCase().includes(termino);
    const coincideCategoria =
      !categoriaFiltro || i.categoria.trim() === categoriaFiltro;
    return coincideTexto && coincideCategoria;
  });

  // Agrupado por categoría, con los sin clasificar al final. Sin useMemo: son
  // decenas de ítems y el agrupado depende de dos filtros que cambian al tipear.
  const porCategoria = new Map<string, InventoryItem[]>();
  for (const item of visibles) {
    const clave = item.categoria.trim() || SIN_CATEGORIA;
    const actual = porCategoria.get(clave);
    if (actual) actual.push(item);
    else porCategoria.set(clave, [item]);
  }

  const grupos = [...porCategoria.entries()].sort(([a], [b]) => {
    if (a === SIN_CATEGORIA) return 1;
    if (b === SIN_CATEGORIA) return -1;
    return a.localeCompare(b, "es");
  });

  const conAlerta = activos.filter(stockBajoInsumo);
  const valorInventario = activos.reduce(
    (acc, i) => acc + Number(i.stock) * Number(i.costo_clp_unidad),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white/95">Inventario</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            NFC, boquillas, argollas y todo lo que no es filamento ·{" "}
            <span className="num">{formatCLP(valorInventario)}</span> en stock
            {cached && <CacheBadge />}
          </p>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
        >
          Agregar insumo
        </button>
      </div>

      {loadError && !cached && (
        <Alert>No pudimos cargar tu inventario: {loadError}</Alert>
      )}

      {conAlerta.length > 0 && !mostrarArchivados && (
        <Alert tone="warn">
          {conAlerta.length} insumo(s) llegaron a su stock mínimo:{" "}
          {conAlerta.map((i) => i.nombre).join(", ")}.
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          <TabButton
            active={!mostrarArchivados}
            onClick={() => setMostrarArchivados(false)}
          >
            Activos ({activos.length})
          </TabButton>
          <TabButton
            active={mostrarArchivados}
            onClick={() => setMostrarArchivados(true)}
          >
            Archivados ({archivados.length})
          </TabButton>
        </div>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="field-input max-w-xs flex-1"
          placeholder="Buscar insumo…"
          aria-label="Buscar insumo"
        />
      </div>

      {categorias.length > 0 && (
        <div className="-mx-4 flex w-[calc(100%+2rem)] gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:flex-wrap sm:px-0">
          <FiltroChip
            active={categoriaFiltro === null}
            onClick={() => setCategoriaFiltro(null)}
          >
            Todas
          </FiltroChip>
          {categorias.map((c) => (
            <FiltroChip
              key={c}
              active={categoriaFiltro === c}
              onClick={() => setCategoriaFiltro(categoriaFiltro === c ? null : c)}
            >
              {c}
            </FiltroChip>
          ))}
        </div>
      )}

      {visibles.length === 0 ? (
        <EmptyState
          title={
            enPestana.length === 0
              ? mostrarArchivados
                ? "No hay insumos archivados"
                : "Tu inventario está vacío"
              : "Ningún insumo coincide con el filtro"
          }
          description="Registra tags NFC, argollas, imanes, boquillas o lo que uses en el taller, con su unidad y costo. Los que marques como usables en cálculos se suman al costo de la impresión y se descuentan al lanzarla."
        />
      ) : (
        <div className="space-y-8">
          {grupos.map(([categoria, deCategoria]) => (
            <section key={categoria} className="space-y-3">
              <h2 className="text-xs tracking-wide text-muted uppercase">
                {categoria}{" "}
                <span className="num text-white/40">({deCategoria.length})</span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {deCategoria.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    onEdit={() => {
                      setCreating(false);
                      setEditing(item);
                    }}
                    onDelete={() => setConfirmDelete(item)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <Modal
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? "Editar insumo" : "Nuevo insumo"}
      >
        <InventoryForm
          item={editing}
          categorias={categorias}
          onDone={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Eliminar insumo"
      >
        <p className="text-sm text-white/75">
          Vas a eliminar{" "}
          <span className="font-medium text-white/90">
            {confirmDelete?.nombre}
          </span>
          . Los cálculos que lo usaron mantienen su costo, pero ya no podrán
          mostrar de qué insumo se trataba. Si solo se te acabó, mejor archívalo.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setConfirmDelete(null)}
          >
            Cancelar
          </button>
          <form
            action={deleteInventoryItem}
            onSubmit={() => setConfirmDelete(null)}
          >
            <input type="hidden" name="id" value={confirmDelete?.id ?? ""} />
            <button type="submit" className="btn-danger">
              Eliminar
            </button>
          </form>
        </div>
      </Modal>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm transition ${
        active
          ? "bg-white/10 text-white"
          : "text-muted hover:bg-white/[0.06] hover:text-white/85"
      }`}
    >
      {children}
    </button>
  );
}

function FiltroChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1 text-xs transition ${
        active
          ? "border-accent/40 bg-accent-soft text-accent"
          : "border-white/10 bg-white/[0.04] text-muted hover:text-white/85"
      }`}
    >
      {children}
    </button>
  );
}

function ItemCard({
  item,
  onEdit,
  onDelete,
}: {
  item: InventoryItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // Cuánto suma o resta cada ajuste rápido. Vive acá y no en el formulario
  // porque cargar una compra no debería obligar a abrir un modal.
  const [ajuste, setAjuste] = useState("1");
  const bajo = stockBajoInsumo(item);
  const delta = toNum(ajuste);

  return (
    <article
      className={`glass-panel flex flex-col gap-4 p-5 ${
        item.activo ? "" : "opacity-60"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className="h-11 w-11 shrink-0 rounded-xl border border-white/20 shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)]"
          style={{ backgroundColor: item.color_hex }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white/95">
            {item.nombre}
          </h3>
          <p className="truncate text-xs text-muted">
            {item.categoria || "Sin categoría"}
          </p>
        </div>
        {bajo && item.activo && (
          <span className="badge border-accent/30 bg-accent-soft text-accent">
            Stock bajo
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Stock</dt>
          <dd
            className={`num mt-0.5 font-medium ${
              bajo ? "text-accent" : "text-white/90"
            }`}
          >
            {formatCantidad(item.stock, item.unidad)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Costo</dt>
          <dd className="num mt-0.5 font-medium text-white/90">
            {formatCLP(item.costo_clp_unidad)}
            <span className="text-xs text-muted">/{item.unidad}</span>
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-1.5">
        {item.usa_en_calculo ? (
          <span className="badge border-accent-2/30 bg-accent-2/12 text-accent-2">
            En cálculos
          </span>
        ) : (
          <span className="badge border-white/15 bg-white/[0.06] text-white/70">
            Solo stock
          </span>
        )}
        {item.usa_en_calculo && item.aplica_desperdicio && (
          <span className="badge border-white/15 bg-white/[0.06] text-white/70">
            Con desperdicio
          </span>
        )}
        {Number(item.stock_minimo) > 0 && (
          <span className="badge border-white/15 bg-white/[0.06] text-white/70">
            Mín. {formatCantidad(item.stock_minimo, item.unidad)}
          </span>
        )}
      </div>

      {item.nota && (
        <p className="text-xs whitespace-pre-wrap text-white/55">{item.nota}</p>
      )}

      {/* Ajuste rápido: dos formularios porque cada botón manda su propio signo. */}
      <div className="flex items-center gap-2 border-t border-white/[0.08] pt-3">
        <span className="text-xs text-muted">Ajustar</span>
        <input
          type="number"
          step="0.01"
          min="0"
          value={ajuste}
          onChange={(e) => setAjuste(e.target.value)}
          className="field-input-num w-20 !px-2.5 !py-1.5 text-xs"
          aria-label={`Cantidad a ajustar de ${item.nombre}`}
        />
        <form action={ajustarStockInsumo}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="delta" value={String(-delta)} />
          <button
            type="submit"
            className="btn-ghost !px-3 !py-1.5 text-xs"
            aria-label={`Restar stock de ${item.nombre}`}
          >
            −
          </button>
        </form>
        <form action={ajustarStockInsumo}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="delta" value={String(delta)} />
          <button
            type="submit"
            className="btn-ghost !px-3 !py-1.5 text-xs"
            aria-label={`Sumar stock de ${item.nombre}`}
          >
            +
          </button>
        </form>
      </div>

      <div className="flex gap-2 border-t border-white/[0.08] pt-3">
        <button
          type="button"
          onClick={onEdit}
          className="btn-ghost flex-1 !py-2 text-xs"
        >
          Editar
        </button>
        <form action={toggleInventoryItemActivo} className="flex-1">
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="activo" value={String(item.activo)} />
          <button type="submit" className="btn-ghost w-full !py-2 text-xs">
            {item.activo ? "Archivar" : "Reactivar"}
          </button>
        </form>
        <button
          type="button"
          onClick={onDelete}
          className="btn-danger !px-3 !py-2 text-xs"
          aria-label="Eliminar insumo"
        >
          ✕
        </button>
      </div>
    </article>
  );
}
