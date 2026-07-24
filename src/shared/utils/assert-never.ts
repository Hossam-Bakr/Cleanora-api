/**
 * @desc Fail when an exhaustive branch receives an unexpected value.
 * @access Internal type-safety helper
 * @explanation This function makes missing union cases visible during
 * development instead of silently continuing with invalid state.
 */
export function assertNever(value: never, message: string): never {
  throw new Error(`${message}: ${String(value)}`);
}
