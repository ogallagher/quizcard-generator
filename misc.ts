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

export class Percentage {
    public static readonly PERCENT_UNIT = '%'
    public readonly value: number

    constructor(value: number|string|Percentage) {
        try {
            if (typeof value === 'string') {
                if (Percentage.is_percentage(value)) {
                    value = value.slice(0, -1)
                }
                // else, assume number without unit is supposed to be percentage
    
                this.value = parseFloat(value)
            }
            else if (value instanceof Percentage) {
                this.value = value.value
            }
            else {
                this.value = value
            }
        }
        catch (err) {
            throw new RangeError(`failed to parse ${value} as a percentage. ${err}`)
        }
    }

    toString(): string {
        return `${this.value}${Percentage.PERCENT_UNIT}`
    }

    private static is_percentage(value: number|string|Percentage): boolean {
        return (typeof value === 'string' && value.endsWith(Percentage.PERCENT_UNIT)) || value instanceof Percentage
    }

    static percentage_or_number(value: Percentage|number|string|undefined): Percentage|number {
        return Percentage.is_percentage(value) 
            ? new Percentage(value) 
            : (typeof value === 'string') ? parseFloat(value) : value
    }
}
