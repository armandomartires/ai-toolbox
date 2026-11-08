/**
 * Whether a module is the script node was started with. Compares real paths,
 * so a symlinked or copied install still starts, and folds case on Windows,
 * where node may hand argv[1] and import.meta.url in different cases.
 */
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const real = (path: string): string => {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}
const fold = (path: string): string => (process.platform === 'win32' ? path.toLowerCase() : path)

export const isMain = (moduleUrl: string, argv1: string | undefined = process.argv[1]): boolean =>
  argv1 !== undefined && argv1 !== '' && fold(real(fileURLToPath(moduleUrl))) === fold(real(argv1))
