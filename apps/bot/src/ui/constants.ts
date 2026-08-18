/** Shared timeouts for interactive UI (modals, select menus). Commands still
 * pass these explicitly to each prompt call rather than relying on a hidden
 * default inside the helper, so a command that genuinely needs a different
 * timeout isn't fighting one. */
export const DEFAULT_MODAL_TIMEOUT_MS = 5 * 60 * 1000;
export const DEFAULT_SELECT_TIMEOUT_MS = 60 * 1000;
