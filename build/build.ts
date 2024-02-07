/**
 * Prevent errors from typescript output including definition of exports.__esModule property.
 */

import * as fs from 'fs'

interface PackageJSON {
  name: string,
  version: string,
  description: string,
  main: string
}

let INDEX_JS: string

load_package_json()
.then(
  (package_json: PackageJSON) => {
    INDEX_JS = `./${package_json.main}`

    fs.readFile(INDEX_JS, {encoding: 'utf-8'}, (err, data) => {
      if (err) {
        console.log(`error unable to read ${INDEX_JS}`)
        throw err
      }
      else {
        fs.writeFile(INDEX_JS, condition_before_exports_property(data), () => {
            console.log(`info wrote conditional exports property to ${INDEX_JS}`)
        })
      }
    })
  },
  (err) => {
    console.log('error failed to load package.json')
    throw err
  }
)

function load_package_json() {
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

function condition_before_exports_property(raw: string) {
  const exports_property = 'Object.defineProperty(exports, "__esModule"'
  let idx = raw.indexOf(exports_property)
  if (idx != -1 && raw[idx-1] === '\n') {
    console.log(`info exports property found at ${INDEX_JS}:${idx}`)
    const condition = '(typeof exports !== "undefined") && '
    
    return raw.slice(0, idx) + condition + restore_dynamic_import(raw.slice(idx))
  }
  else {
      console.log(`warning exports property not found in ${INDEX_JS}`)
      return restore_dynamic_import(raw)
  }
}

function restore_dynamic_import(raw: string) {
  const require_promise_regexp = /Promise\.resolve\(\)\.then\(\(\) => require\('([\w\-_:/]+)'\)\)/gi
  const dynamic_import_before = "import('"
  const dynamic_import_after = "')"
  let match_regexp: RegExpExecArray|null
  /**
   * Array of module_name, start, end.
   */
  let matches = []
  while ((match_regexp = require_promise_regexp.exec(raw)) !== null) {
    let module_name = match_regexp[1]
    console.log(
      `info restore dynamic import of ${module_name} from ${match_regexp.index} to ${require_promise_regexp.lastIndex}`
    )
    matches.push({module_name: module_name, start: match_regexp.index, end: require_promise_regexp.lastIndex})
  }
  
  let out = ''
  let raw_idx = 0
  let match_idx = 0
  let match
  if (matches.length > 0) {
    match = matches[match_idx]
    out += raw.slice(0, match.start)
    raw_idx = match.end
  }
  
  console.log(`restore ${matches.length} dynamic imports`)
  let end_idx
  for (match_idx = 0; match_idx < matches.length; match_idx++) {
    match = matches[match_idx]
    
    end_idx = (match_idx < matches.length-1) ? matches[match_idx+1].start : undefined
    console.log(`info ${match.module_name} + ${match.end}...${end_idx}`)
    
    out += (
      dynamic_import_before + match.module_name + dynamic_import_after
      + raw.slice(match.end, end_idx)
    )
    
    raw_idx = end_idx
  }
  
  return out
}
