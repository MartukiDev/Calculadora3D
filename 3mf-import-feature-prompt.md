# Feature: Importación inteligente de archivos 3MF para la calculadora 3D

## Contexto

El proyecto es una web app construida con:

- Next.js
- TypeScript
- Supabase

La aplicación ya cuenta con una calculadora de impresión 3D y un sistema de gestión de hasta **4 colores/filamentos por impresión**.

Quiero implementar una feature que permita cargar un archivo `.3mf` generado por un slicer y utilizar automáticamente la información disponible para alimentar la calculadora.

### Slicers soportados inicialmente

- Bambu Studio
- OrcaSlicer
- PrusaSlicer
- Elegoo Slicer

La arquitectura debe quedar preparada para agregar más slicers posteriormente.

---

# REGLA PRINCIPAL: AUDITAR ANTES DE IMPLEMENTAR

Antes de modificar cualquier archivo:

1. Audita completamente la estructura actual del proyecto.
2. Identifica cómo funciona actualmente la calculadora.
3. Identifica cómo está implementado el gestor de hasta 4 colores.
4. Audita los tipos TypeScript existentes.
5. Audita el schema actual de Supabase.
6. Identifica las tablas, columnas y relaciones existentes relacionadas con:
   - impresiones
   - modelos
   - cálculos
   - filamentos
   - colores
   - impresoras
   - usuarios
7. Revisa las RLS policies existentes.

No inventes una arquitectura paralela si ya existe una implementación equivalente.

---

# REGLA ABSOLUTA DE PERSISTENCIA

El `.3mf` puede contener mucha más información que la que actualmente soporta la aplicación.

Por lo tanto:

> EXTRAER ≠ PERSISTIR

El parser puede extraer toda la información técnicamente disponible.

Pero solamente debe guardarse en Supabase aquello que tenga una correspondencia real con el schema actual.

### NO hacer

No crear automáticamente:

- nuevas columnas
- nuevas tablas
- `metadata JSONB`
- `raw_3mf`
- `extra_data`
- blobs del archivo
- campos genéricos para guardar información que el schema no contempla

Solo para evitar perder información.

Si un dato no tiene dónde almacenarse actualmente:

```text
3MF
 ↓
Parser
 ↓
Dato detectado
 ↓
¿Schema actual lo soporta?
 ├── Sí → Persistir
 └── No → Disponible durante la sesión, NO persistir
```

Si consideras que una modificación del schema es indispensable, NO la ejecutes automáticamente. Documenta qué falta y por qué.

---

# OBJETIVO FUNCIONAL

El usuario debe poder:

1. Arrastrar un `.3mf`.
2. Seleccionarlo desde el explorador de archivos.
3. Procesarlo localmente cuando sea posible.
4. Detectar automáticamente el slicer.
5. Extraer información de impresión.
6. Detectar impresora.
7. Detectar tiempo.
8. Detectar consumo de filamento.
9. Detectar materiales.
10. Detectar colores.
11. Detectar consumo individual por color/filamento.
12. Mapear los datos hacia los 4 slots de filamento existentes en la calculadora.
13. Revisar/modificar los valores antes de confirmar.
14. Guardar únicamente los datos compatibles con Supabase.

---

# MULTICOLOR: REQUISITO CRÍTICO

La aplicación actualmente maneja hasta **4 colores de filamento**.

El parser NO debe modelar el filamento como:

```ts
filament: {
  color: string;
  grams: number;
}
```

porque una impresión puede tener múltiples materiales/colores.

Debe existir conceptualmente una estructura similar a:

```ts
filaments: [
  {
    slot: 1,
    color: "...",
    material: "...",
    weightGrams: 12.4,
    lengthMeters: 4.2
  },
  {
    slot: 2,
    color: "...",
    material: "...",
    weightGrams: 8.7,
    lengthMeters: 2.9
  }
]
```

La estructura exacta debe adaptarse a los tipos y arquitectura YA EXISTENTES.

No dupliques el sistema de colores que ya tiene la aplicación.

---

# CONSUMO POR COLOR

Este es uno de los datos más importantes.

Cuando el `.3mf` permita conocer el consumo individual de cada filamento:

```text
Filamento 1 → 12.4 g
Filamento 2 → 8.7 g
Filamento 3 → 3.2 g
Filamento 4 → 0.0 g
```

debe mantenerse esa separación.

NO convertir inmediatamente todo a:

```text
24.3 g PLA
```

porque la calculadora necesita conocer el consumo individual para poder calcular correctamente los costos de una impresión multicolor.

---

# MAPEO DE COLORES

El parser debe distinguir entre:

### Color declarado por el slicer

Por ejemplo:

```text
Filament 1
Color: #FFFFFF
```

y

### Color/nombre utilizado por la aplicación

Por ejemplo:

```text
Blanco
```

El parser debe conservar, cuando sea posible:

- color hexadecimal/RGB
- nombre del filamento
- material
- identificador/slot del filamento
- peso
- longitud

Luego la aplicación decide cómo representar ese color visualmente.

No asumir que:

```text
slot 1 = color 1
slot 2 = color 2
```

sin comprobar cómo el slicer representa realmente los filamentos.

---

# NORMALIZACIÓN

Cada slicer puede almacenar la información de forma diferente.

Implementar parsers/adapters independientes:

```text
3MF
 │
 ├── Bambu Studio Parser
 │
 ├── OrcaSlicer Parser
 │
 ├── PrusaSlicer Parser
 │
 └── Elegoo Slicer Parser
 │
 ↓
NormalizedPrintData
 │
 ├── printer
 ├── slicer
 ├── printTime
 ├── dimensions
 ├── layerHeight
 ├── totalFilament
 └── filaments[]
 │
 ↓
Existing Calculator
 │
 ↓
Existing Supabase Schema
```

La calculadora no debería conocer los detalles internos de cada slicer.

---

# MODELO NORMALIZADO

Crear una estructura interna equivalente a:

```ts
interface NormalizedPrintData {
  slicer: {
    name: string | null;
    version: string | null;
  };

  printer: string | null;

  printTimeSeconds: number | null;

  dimensions: {
    x: number;
    y: number;
    z: number;
  } | null;

  layerHeight: number | null;

  layerCount: number | null;

  filaments: NormalizedFilament[];

  objectsCount: number | null;
}
```

Y:

```ts
interface NormalizedFilament {
  slot: number;
  material: string | null;
  color: string | null;
  name: string | null;
  weightGrams: number | null;
  lengthMeters: number | null;
}
```

Estos tipos son una referencia conceptual.

Antes de crearlos, revisar si el proyecto ya tiene tipos equivalentes y reutilizarlos.

---

# INFORMACIÓN A EXTRAER

Cuando exista en el `.3mf`, intentar detectar:

## Impresión

- tiempo estimado
- número de capas
- altura de capa
- dimensiones
- cantidad de objetos
- cantidad de placas/build plates

## Impresora

- fabricante
- modelo
- perfil de impresora

## Slicer

- nombre
- versión

## Filamentos

Para cada filamento:

- slot
- material
- nombre
- color
- hexadecimal/RGB
- peso en gramos
- longitud en metros
- identificador si existe
- perfil de filamento si existe

## Multicolor

Detectar específicamente:

- cantidad de filamentos utilizados
- consumo por filamento
- correspondencia entre slot y color
- material por slot
- si existen hasta 4 filamentos

Si el archivo contiene más de 4 filamentos:

```text
Filamentos detectados: 6

La calculadora admite actualmente 4.

No truncar silenciosamente.

Mostrar una advertencia y permitir al usuario decidir cómo proceder.
```

No eliminar datos sin avisar.

---

# FILAMENTOS NO UTILIZADOS

Si el `.3mf` declara 4 filamentos pero solo utiliza 3:

```text
Slot 1 → 15.2 g
Slot 2 → 7.4 g
Slot 3 → 2.1 g
Slot 4 → 0 g
```

debe preservarse correctamente la información de slots cuando el formato lo permita.

No compactar automáticamente los slots si eso rompe la correspondencia real de los colores.

---

# IMPORTANTE: TIEMPO Y FILAMENTO

No calcular nuevamente el tiempo o consumo si el `.3mf` ya contiene un valor generado por el slicer.

Prioridad:

```text
Dato generado por slicer
        ↓
usar valor del slicer
```

Solo realizar cálculos propios si el dato no está disponible.

No presentar una estimación propia como si fuera el tiempo oficial del slicer.

---

# DETECCIÓN DEL SLICER

Crear detección robusta.

No depender únicamente del nombre del archivo.

Intentar identificar el slicer mediante:

- archivos internos
- namespaces XML
- metadata
- application metadata
- estructuras específicas
- configuración del proyecto

Resultado conceptual:

```ts
{
  name: "Bambu Studio",
  version: "02...."
}
```

o:

```ts
{
  name: "OrcaSlicer",
  version: "..."
}
```

Si no puede determinarse:

```ts
{
  name: null,
  version: null
}
```

y continuar intentando analizar el formato genérico.

---

# 3MF COMO ZIP

El `.3mf` debe tratarse como un contenedor ZIP.

No asumir rutas internas fijas.

Implementar:

1. validación
2. lectura del ZIP
3. identificación de archivos relevantes
4. parsing XML/JSON
5. detección de slicer
6. extracción de metadata
7. normalización

No ejecutar contenido del archivo.

Validar tamaño y estructura para evitar archivos maliciosos o ZIP bombs.

---

# CLIENT-SIDE

Evaluar primero procesamiento en navegador.

Idealmente:

```text
Usuario
 ↓
Selecciona .3mf
 ↓
Browser
 ↓
Parser
 ↓
NormalizedPrintData
 ↓
Calculadora
```

El `.3mf` no debería subirse al servidor si no es necesario.

Esto reduce:

- tráfico
- almacenamiento
- exposición de archivos
- complejidad del backend

Si el procesamiento resulta demasiado pesado, evaluar Web Worker.

---

# INTEGRACIÓN CON LA CALCULADORA EXISTENTE

No crear una segunda calculadora.

El resultado del parser debe alimentar directamente el flujo existente.

Ejemplo conceptual:

```text
3MF
 ↓
Parser
 ↓
NormalizedPrintData
 ↓
Existing Calculator State
 ↓
Usuario revisa
 ↓
Calcular
 ↓
Guardar
```

Los cuatro filamentos detectados deben mapearse al gestor de colores existente.

El usuario debe poder modificar manualmente:

- color
- material
- gramos
- metros
- slot

antes de confirmar.

El `.3MF` debe actuar como fuente de datos inicial, no como fuente inmutable.

---

# PERSISTENCIA

Antes de implementar el insert/update:

Auditar exactamente qué soporta el schema actual.

Crear un mapper explícito:

```ts
const payload = mapPrintDataToExistingSchema(normalizedData);
```

El mapper debe seleccionar explícitamente los campos permitidos.

Nunca hacer:

```ts
insert(normalizedData)
```

directamente.

Nunca persistir campos desconocidos.

---

# Supabase

Respetar:

- schema existente
- relaciones existentes
- foreign keys
- RLS
- tipos
- validaciones
- arquitectura de acceso existente

No saltarse RLS.

No crear service-role access innecesariamente.

No duplicar datos que ya existan en otras entidades.

---

# UI

Agregar un componente de importación:

```text
┌──────────────────────────────────────┐
│                                      │
│        Arrastra tu archivo 3MF       │
│                                      │
│       o selecciona un archivo        │
│                                      │
└──────────────────────────────────────┘
```

Después:

```text
✓ Bambu Studio detectado
✓ Bambu Lab A1 detectada
✓ Tiempo: 2h 18m
✓ 3 filamentos detectados
```

Y una vista de los 4 slots:

```text
┌───────┬──────────┬──────────┬─────────┐
│ Slot  │ Color    │ Material │ Consumo │
├───────┼──────────┼──────────┼─────────┤
│ 1     │ Blanco   │ PLA      │ 18.4 g  │
│ 2     │ Negro    │ PLA      │  7.2 g  │
│ 3     │ Rojo     │ PLA      │  2.1 g  │
│ 4     │ —        │ —        │  0 g    │
└───────┴──────────┴──────────┴─────────┘
```

Pero utilizar los componentes y estilos existentes de la aplicación.

No crear un nuevo sistema visual.

---

# Compatibilidad con más de 4 colores

Si el archivo contiene:

```text
6 filamentos
```

mostrar:

```text
⚠ Este archivo utiliza 6 filamentos.
La calculadora actualmente admite 4.
```

Permitir que el usuario seleccione qué 4 filamentos quiere importar.

Ejemplo:

```text
☑ Blanco
☑ Negro
☑ Rojo
☑ Azul
☐ Verde
☐ Amarillo
```

No descartar automáticamente los otros dos.

---

# Testing

Crear fixtures reales o representativos para:

- Bambu Studio
- OrcaSlicer
- PrusaSlicer
- Elegoo Slicer

Probar:

### Single color

```text
1 filamento
```

### Multicolor

```text
2 filamentos
3 filamentos
4 filamentos
```

### Más de 4

```text
5+ filamentos
```

### Datos incompletos

- sin impresora
- sin tiempo
- sin consumo
- sin color
- sin material

### Archivos inválidos

- ZIP corrupto
- XML inválido
- archivo que no es 3MF
- slicer desconocido

### Persistencia

Probar específicamente que el mapper:

- solo envía columnas existentes
- respeta relaciones existentes
- no persiste metadata desconocida
- respeta RLS

---

# Criterios de aceptación

- [ ] Se puede importar un `.3mf`.
- [ ] Se detecta Bambu Studio.
- [ ] Se detecta OrcaSlicer.
- [ ] Se detecta PrusaSlicer.
- [ ] Se detecta Elegoo Slicer.
- [ ] Se extrae impresora cuando está disponible.
- [ ] Se extrae tiempo cuando está disponible.
- [ ] Se extrae consumo de filamento.
- [ ] Se extrae consumo individual por filamento cuando está disponible.
- [ ] Se detectan colores.
- [ ] Se detectan materiales.
- [ ] Se mantiene la correspondencia entre slot/color/consumo.
- [ ] Se integra con el gestor existente de 4 colores.
- [ ] Se soportan impresiones de 1 a 4 colores.
- [ ] Se advierte correctamente cuando existen más de 4.
- [ ] El usuario puede modificar los datos importados.
- [ ] No se crea una segunda calculadora.
- [ ] Solo se persisten datos soportados por el schema actual.
- [ ] No se modifica Supabase sin justificación explícita.
- [ ] No se almacena el `.3mf` completo.
- [ ] Se respetan RLS y relaciones existentes.
- [ ] Existen tests para los cuatro slicers.
- [ ] La arquitectura permite agregar nuevos slicers posteriormente.

---

# ORDEN DE IMPLEMENTACIÓN

Trabaja exactamente en este orden:

## Fase 1 — Auditoría

Audita:

- estructura del proyecto
- calculadora
- gestor de 4 colores
- tipos
- Supabase schema
- RLS
- flujo de persistencia

No modifiques código todavía.

## Fase 2 — Diseño

Determina:

- dónde debe vivir el parser
- cómo detectar slicers
- estructura normalizada
- cómo conectar con el estado existente de la calculadora
- qué campos pueden persistirse realmente

## Fase 3 — Parser

Implementa:

- core 3MF reader
- detector de slicer
- Bambu Studio parser
- OrcaSlicer parser
- PrusaSlicer parser
- Elegoo Slicer parser

## Fase 4 — Integración

Conectar:

```text
3MF → Parser → NormalizedPrintData → Calculadora existente
```

## Fase 5 — Persistencia

Conectar:

```text
NormalizedPrintData
        ↓
Existing Schema Mapper
        ↓
Supabase
```

## Fase 6 — Testing

Ejecutar tests y verificar especialmente los escenarios multicolor.

---

# Restricciones finales

No:

- reestructurar toda la aplicación
- crear una segunda calculadora
- crear un nuevo sistema de colores
- modificar Supabase arbitrariamente
- guardar información que el schema no soporte
- asumir que todos los `.3mf` tienen la misma estructura
- asumir que un `.3mf` siempre contiene información de slicing
- asumir que el filamento es un único valor
- perder silenciosamente filamentos cuando existen más de 4

Sí:

- reutilizar código existente
- reutilizar tipos existentes
- reutilizar el gestor de 4 colores
- utilizar el schema actual
- mantener parsers independientes por slicer
- normalizar los datos
- mantener la información por filamento
- permitir edición manual después de importar
- diseñar el sistema para agregar nuevos slicers posteriormente

La implementación debe sentirse como una extensión natural de la calculadora existente, no como un sistema independiente.
