/**
 * Log error on failed import and return undefined instead of imported module.
 * 
 * @param err
 */
export function import_fail_forward(err: Error): undefined {
    console.log(`warning import failed. ${err}`)
    console.log(`debug ${err.stack}`)
    return undefined
}
