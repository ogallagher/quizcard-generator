import * as fs from 'fs'

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

export function load_package_json() {
    return new Promise(function(res, rej) {
        fs.readFile('./package.json', {encoding: 'utf-8'}, (err, data) => {
        if (err) {
            rej(err)
        }
        else {
            res(JSON.parse(data))
        }
        })
    })
}
