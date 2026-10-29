// ============================================================
// @ottabase/forms - CrudHub (generic admin data screens)
// ============================================================
// Rendered from the server's model descriptors (GET /api/admin/crudhub),
// never from model classes: models are server code.
// ============================================================

export { CrudHubDirectory } from './CrudHubDirectory';
export type { CrudHubDirectoryProps } from './CrudHubDirectory';
export { CrudHubList, CRUDHUB_PAGE_SIZES, crudHubAbilities, resolveListPrefs } from './CrudHubList';
export type { CrudHubListProps, CrudHubListState } from './CrudHubList';
export { CrudHubDetail, relatedLabel } from './CrudHubDetail';
export type { CrudHubDetailProps } from './CrudHubDetail';
export { CrudHubForm } from './CrudHubForm';
export type { CrudHubFormProps } from './CrudHubForm';
export { CrudHubCell, emptyLabel, getCrudHubRenderer, registerCrudHubRenderer, shortId } from './CrudHubCell';
export type { CrudHubCellMode, CrudHubCellProps, CrudHubRenderer } from './CrudHubCell';
export {
    CRUDHUB_API,
    CRUDHUB_PATH,
    crudHubModelConfig,
    crudHubPaths,
    fillRouteTokens,
    readRemembered,
    rowTitle,
    useCrudHubModel,
    useCrudHubModelConfig,
    useCrudHubModels,
    writeRemembered,
} from './useCrudHub';
export type { CrudHubNavigate, RememberedListState } from './useCrudHub';
