---
Task ID: 1
Agent: Main
Task: Link intervention materials with inventory stock - deduction and dropdown

Work Log:
- Cleared .next cache to fix ChunkLoadError
- Added InterventionMaterial junction model to Prisma schema (interventionId, productId, quantity)
- Updated Product model to include interventions relation
- Updated Intervention model to include materials relation
- Ran prisma db push and prisma generate
- Created /api/products/for-dropdown API endpoint (returns only products with stock > 0)
- Updated /api/interventions POST route to accept materials array, validate stock, deduct quantities
- Updated /api/interventions/[id] PUT route to handle materials update (restore old stock, deduct new)
- Updated /api/interventions/[id] DELETE route to restore stock when deleting intervention
- Updated /api/interventions GET route to include materials with product info
- Updated InterventionFormDialog with dynamic materials list (product dropdown + quantity input)
- Updated map popup form with materials section (dynamic add/remove rows)
- Updated intervention popup display to show linked materials
- Updated InterventionsView to show materials info in list items
- Added product filtering by intervention type (DERATISATION, DESINSECTISATION, etc.)
- Tested full flow: create intervention with materials, verified stock deduction from 45→43 for رودينال

Stage Summary:
- Feature complete: Materials from inventory appear in dropdown when creating/editing interventions
- Stock is automatically deducted when intervention is created
- Stock is restored when intervention is deleted
- Stock is properly managed when intervention is updated (old quantities restored, new quantities deducted)
- Server-side validation prevents using more stock than available
- Backward compatible: old interventions without materials still work fine
- "Free text" material field kept for materials not in inventory
