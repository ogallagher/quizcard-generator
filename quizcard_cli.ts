/**
 * Quizcard generator backend CLI driver (should be called by quizcard_generator.js).
 */

import * as yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as fs from 'fs/promises'
import { QuizCardGenerator } from './quizcard_generator'
import { AnkiNote } from './anki/anki_generator'
import * as rl from 'readline/promises'
import { import_fail_forward } from './misc'
import { 
  OPT_LOG_LEVEL, OPT_INPUT_FILE, OPT_LOG_FILE, OPT_NOTES_NAME,
  OPT_EXCLUDE_WORD, OPT_EXCLUDES_FILE, OPT_WORD_FREQUENCY_MIN,
  OPT_WORD_FREQUENCY_ORDINAL_MAX, OPT_WORD_FREQUENCY_ORDINAL_MIN,
  OPT_LIMIT, OPT_WORD_LENGTH_MIN, OPT_TAG, 
  OPT_DESCRIBES,
  OPT_ALIASES,
  OPT_INPUT_FILE_CONTENT,
  OPT_SENTENCE_TOKENS_MAX
} from './opt'

interface CliArgv {
  // additional overhead keys from yargs
  [key: string]: any

  // expected keys
  [OPT_LOG_LEVEL]?: string
  [OPT_INPUT_FILE]?: string
  [OPT_LOG_FILE]?: boolean
  [OPT_NOTES_NAME]?: string
  [OPT_EXCLUDE_WORD]?: string[]
  [OPT_EXCLUDES_FILE]?: string[]
  [OPT_WORD_FREQUENCY_MIN]?: number
  [OPT_WORD_FREQUENCY_ORDINAL_MAX]?: number
}

type TempLogger = typeof import('temp_js_logger').TempLogger

const imports_promise = Promise.all([
  import('temp_js_logger')
  .then(
      (templogger) => {
          return templogger.imports_promise
          .then(function() {
              return config_logging(templogger.TempLogger)
          })
      },
      import_fail_forward
  )
])

export default function main(argv: CliArgv): Promise<any> {
  let qg: QuizCardGenerator

  return imports_promise
  // configure logging
  .then(([templogger]) => {
    if (templogger !== undefined) {
      const log_level = argv[OPT_LOG_LEVEL]
      console.log(`debug set log level to ${log_level}`)
      templogger.set_level(log_level)
  
      if (!argv[OPT_LOG_FILE]) {
        console.log(`debug disable log file`)
        templogger.set_log_to_file(false)
      }
    }
    // else, no logging package enabled

    console.log(`debug cli args = ${JSON.stringify(argv)}`)
  })
  // fill remaining cli options
  .then(() => {
    return cli_prompts(argv)
  })
  // load input files
  .then(() => {
    return Promise.all([
      // source document
      new Promise(function(res, rej) {
        if (argv[OPT_INPUT_FILE_CONTENT] !== undefined) {
          res(argv[OPT_INPUT_FILE_CONTENT])
        }
        else if (argv[OPT_INPUT_FILE] !== undefined) {
          fs.readFile(argv[OPT_INPUT_FILE], {encoding: 'utf-8'})
          .then(res)
        }
        else {
          // not currently supported at interactive prompt
          rej(
            `input provided neither as file (--${OPT_INPUT_FILE}) `
            + `nor string content (--${OPT_INPUT_FILE_CONTENT})`
          )
        }
      }),
  
      // excludes files
      new Promise((res) => {
        const excludes_file_paths = argv[OPT_EXCLUDES_FILE]
        if (excludes_file_paths.length > 0) {
          Promise.all(excludes_file_paths.map(try_load_excludes_file))
          .then(res)
        }
        else {
          res([[]])
        }
      })
      .then((excludes_file_content: string[][]) => {
        return argv[OPT_EXCLUDE_WORD]
        // consolidate word excludes
        .concat(...excludes_file_content)
        // and parse strings, regexp
        .map((exclude: string) => {
          if (exclude.startsWith('/') && exclude.endsWith('/')) {
            return new RegExp(exclude.slice(1, exclude.lastIndexOf('/')))
          }
          else {
            return exclude
          }
        })
      })
    ])
  })
  // create quiz card generator
  .then(([input_file_content, word_excludes]: [string, (string|RegExp)[]]) => {
    qg = new QuizCardGenerator(
      input_file_content, 
      argv[OPT_INPUT_FILE],
      word_excludes,
      argv[OPT_SENTENCE_TOKENS_MAX]
    )

    return qg.finish_calculation
  })
  // finish analysis of source document
  .then(
    () => {
      console.log(`info calculations complete for ${argv[OPT_INPUT_FILE]}`)
      console.log(`info most frequent word is ${JSON.stringify(qg.get_word_by_frequency_index(0))}`)
      console.log(`info least frequent word is ${JSON.stringify(qg.get_word_by_frequency_index(0, false))}`)
    },
    (err) => {
      throw err
    }
  )
  // export anki notes file
  .then(() => {
    let anki_notes = qg.generate_anki_notes(
      argv[OPT_LIMIT],
      argv[OPT_WORD_FREQUENCY_MIN], 
      argv[OPT_WORD_LENGTH_MIN],
      argv[OPT_WORD_FREQUENCY_ORDINAL_MAX],
      argv[OPT_WORD_FREQUENCY_ORDINAL_MIN]
    )
    console.log(`info first generated Anki note is ${JSON.stringify(anki_notes[0], undefined, 2)}`)

    console.log(`exporting anki notes`)
    return AnkiNote.export(
      anki_notes,
      argv[OPT_NOTES_NAME],
      undefined,
      undefined,
      argv[OPT_TAG]
    )
  })
  .then(() => {
    console.log(`info export complete`)
  })
  .catch((err) => {
    console.log(`error ${err}`)
  })
}

export function cli_args(): CliArgv {
  let yargs_argv = yargs.default(
    hideBin(process.argv)
  )
  .usage('Backend quizcard generator CLI driver (called via quizcard_generator.js)')

  Object.entries(OPT_DESCRIBES).map(([opt_key, opt_describe]) => {
    yargs_argv.describe(opt_key, opt_describe)
  })

  yargs_argv = yargs_argv
  .alias(OPT_ALIASES)

  .choices(OPT_LOG_LEVEL, ['debug', 'info', 'warning', 'error'])
  .default(OPT_LOG_LEVEL, 'debug')

  .boolean(OPT_LOG_FILE)
  .default(OPT_LOG_FILE, false)

  .string(OPT_EXCLUDE_WORD)
  .array(OPT_EXCLUDE_WORD)

  .string(OPT_EXCLUDES_FILE)
  .array(OPT_EXCLUDES_FILE)

  .number(OPT_WORD_FREQUENCY_MIN)

  .number(OPT_WORD_FREQUENCY_ORDINAL_MAX)

  .number(OPT_WORD_FREQUENCY_ORDINAL_MIN)

  .number(OPT_WORD_LENGTH_MIN)
  .default(OPT_WORD_LENGTH_MIN, AnkiNote.WORD_LENGTH_MIN_DEFAULT)

  .array(OPT_TAG)

  .number(OPT_LIMIT)

  const argv = yargs_argv.parse()

  // yargs aliasing doesn't seem to work? 
  // Handle it custom here with short aliases having precendence
  Object.entries(OPT_ALIASES).map(([opt_key, opt_aliases]) => {
    if (typeof opt_aliases === 'string') {
      opt_aliases = [opt_aliases]
    }

    for (let alias of opt_aliases) {
      if (argv[alias] !== undefined) {
        // assign value of alias key to opt key
        argv[opt_key] = argv[alias]
        // skip other aliases of same opt
        break
      }
    }
  })

  // array type opt defaults to empty arrays
  for (let array_opt of [OPT_EXCLUDE_WORD, OPT_EXCLUDES_FILE, OPT_TAG]) {
    if (argv[array_opt] === undefined) argv[array_opt] = []
  }

  return argv
}

function cli_prompts(argv: object): Promise<void> {
  // only use cli prompts where not provided as cli args
  let cli: rl.Interface = rl.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  // ask anki notes name.
  return new Promise((res) => {
    if (argv[OPT_NOTES_NAME] === undefined) {
      cli.question(`name of generated notes collection (default="${AnkiNote.OUT_NAME_DEFAULT}"): `)
      .then(res)
    }
    else {
      res(argv[OPT_NOTES_NAME])
    }
  })
  // save anki notes name. ask source text.
  .then((notes_name) => {
    if (notes_name === '') {
      notes_name = undefined
    }

    argv[OPT_NOTES_NAME] = notes_name

    if (argv[OPT_INPUT_FILE] === undefined && argv[OPT_INPUT_FILE_CONTENT] === undefined) {
      return cli.question('path to source text file, or input source text directly (surround with "double quotes"): ').then((input_res) => {
        if (input_res.startsWith('"')) {
          return [undefined, input_res.slice(1, -1)]
        }
        else {
          return [input_res, undefined]
        }
      })
    }
    else {
      return [argv[OPT_INPUT_FILE], argv[OPT_INPUT_FILE_CONTENT]]
    }
  })
  .then(([input_file, input_content]: [string, string]) => {
    if (input_file === undefined || input_file.trim() === '') {
      input_file = undefined
    }
    if (input_content === undefined || input_content.trim() === '') {
      input_content = undefined
    }

    argv[OPT_INPUT_FILE] = input_file
    argv[OPT_INPUT_FILE_CONTENT] = input_content
    console.log(`debug ${OPT_INPUT_FILE} = ${input_file}`)
    console.log(`debug ${OPT_INPUT_FILE_CONTENT} = ${input_content}`)
  })
  .finally(() => cli.close())
}

function try_load_excludes_file(file_path: string): Promise<string[]> {
  return fs.readFile(file_path, {encoding: 'utf-8'})
  .then(
    (data) => {
      let excludes: string[] = []
      data.split(QuizCardGenerator.regexp_delim_line)
      .map((line) => {
        if (QuizCardGenerator.regexp_comment.test(line)) {
          console.log(`debug excludes comment ${line}`)
        }
        else {
          excludes.push(line)
        }
      })

      return excludes
    },
    (err) => {
      console.log(`error unable to load ${file_path}. ${err}`)
      return []
    }
  )
}

function config_logging(tl: TempLogger) {
  return tl.config({
      level: 'debug',
      with_timestamp: false,
      name: 'quizcard-generator',
      with_lineno: true,
      with_level: true,
      parse_level_prefix: true,
      log_to_file: true,
      with_cli_colors: true
  })
}
