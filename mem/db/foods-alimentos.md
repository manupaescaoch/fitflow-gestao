---
name: foods vs alimentos (decisão adiada)
description: Tabela alimentos é órfã (151 reg, sem queries no código). foods (910 reg) é a fonte real, com food_measures e fruit_portion_options. Consolidar em PT está adiado.
type: feature
---
Estado atual:
- `foods` (910 reg) — usada em src/lib/foods.ts, BuscaAlimento, FavoritosModal
- `food_measures` (1053 reg) — vinculada a foods
- `fruit_portion_options` (16 reg)
- `alimentos` (151 reg) — declarada como type em src/lib/dieta.ts mas SEM nenhuma query real
- `alimento_favoritos` — usada normalmente (favoritos do nutricionista)

A IA (server/dieta.functions.ts) usa "alimentos" só como palavra no prompt, não consulta tabela.

Quando reabrir: o usuário prefere PT como padrão. Caminho mais seguro = renomear foods→alimentos (após drop da tabela alimentos atual). Requer reescrever lib/foods.ts, BuscaAlimento, FavoritosModal e regenerar types.
