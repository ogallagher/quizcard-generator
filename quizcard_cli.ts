/**
 * Quizcard generator backend CLI driver (should be called by quizcard_generator.js).
 */

import * as yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as fs from 'fs/promises'
import { QuizCardGenerator } from './quizcard_generator'
import { AnkiNote } from './anki/anki_generator'
import * as rl from 'readline/promises'

export const OPT_LOG_LEVEL = 'log-level'
export const OPT_INPUT_FILE = 'input-file'
export const OPT_NO_LOG_FILE = 'no-log-file'
export const OPT_NOTES_NAME = 'anki-notes-name'
/**
 * Excluded words, at parse stage.
 */
export const OPT_EXCLUDE_WORD = 'exclude-word'
export const OPT_EXCLUDES_FILE = 'excludes-file'
/**
 * Word minimum frequency, at anki transform stage.
 */
export const OPT_WORD_FREQUENCY_MIN = 'word-frequency-min'
export const OPT_WORD_FREQUENCY_ORDINAL_MAX = 'word-frequency-first'
export const OPT_WORD_FREQUENCY_ORDINAL_MIN = 'word-frequency-last'
/**
 * Word minimum length, at anki transform stage.
 */
export const OPT_WORD_LENGTH_MIN = 'word-length-min'

interface CliArgv {
  // additional overhead keys from yargs
  [key: string]: any

  // expected keys
  [OPT_LOG_LEVEL]?: string
  [OPT_INPUT_FILE]?: string
  [OPT_NO_LOG_FILE]?: boolean
  [OPT_NOTES_NAME]?: string
  [OPT_EXCLUDE_WORD]?: string[]
  [OPT_EXCLUDES_FILE]?: string[]
  [OPT_WORD_FREQUENCY_MIN]?: number
  [OPT_WORD_FREQUENCY_ORDINAL_MAX]?: number
}

export default function main(argv: CliArgv): Promise<any> {
  // logging updated by caller
  console.log(`debug cli args = ${JSON.stringify(argv)}`)

  let qg: QuizCardGenerator

  // load input files
  const input_file_path = argv[OPT_INPUT_FILE]
  return Promise.all([
    // source document
    fs.readFile(input_file_path, {encoding: 'utf-8'}),

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
  // create quiz card generator
  .then(([input_file_content, word_excludes]: [string, (string|RegExp)[]]) => {
    qg = new QuizCardGenerator(
      input_file_content, 
      input_file_path,
      word_excludes
    )

    return qg.finish_calculation
  })
  // finish analysis of source document
  .then(
    () => {
      console.log(`info calculations complete for ${input_file_path}`)
      console.log(`info most frequent word is ${JSON.stringify(qg.get_word_by_frequency_index(0))}`)
      console.log(`info least frequent word is ${JSON.stringify(qg.get_word_by_frequency_index(0, false))}`)
    },
    (err) => {
      throw err
    }
  )
  .then(() => {
    // fill remaining cli options
    return cli_prompts(argv)
  })
  // export anki notes file
  .then(() => {
    let anki_notes = qg.generate_anki_notes(argv[OPT_WORD_FREQUENCY_MIN], argv[OPT_WORD_LENGTH_MIN])
    console.log(`info first generated Anki note is ${JSON.stringify(anki_notes[0], undefined, 2)}`)

    console.log(`exporting anki notes`)
    return AnkiNote.export(
      anki_notes,
      argv[OPT_NOTES_NAME]
    )
  })
  .then(() => {
    console.log(`info export complete`)
  })
}

export function cli_args(): CliArgv {
  const argv = yargs.default(
    hideBin(process.argv)
  )
  .usage('Backend quizcard generator CLI driver (called via quizcard_generator.js)')

  .describe(OPT_INPUT_FILE, 'input/source file')
  .alias(OPT_INPUT_FILE, 'i')
  .default(OPT_INPUT_FILE, 'docs/examples/eng_source.txt')

  .describe(OPT_LOG_LEVEL, 'logging level')
  .alias(OPT_LOG_LEVEL, 'l')
  .choices(OPT_LOG_LEVEL, ['debug', 'info', 'warning', 'error'])
  .default(OPT_LOG_LEVEL, 'debug')

  .describe(OPT_NO_LOG_FILE, 'do not generate a log file')
  .alias(OPT_NO_LOG_FILE, 's')
  .boolean(OPT_NO_LOG_FILE)
  .default(OPT_NO_LOG_FILE, false)

  .describe(
    OPT_NOTES_NAME, 
    'name of anki notes collection to generate; will be used for the exported file name'
  )
  .alias(OPT_NOTES_NAME, 'n')

  .describe(
    OPT_EXCLUDE_WORD, 
    'define a string or regexp (/<expr>/) to exclude from testable vocabulary (ex. names, trivial words)'
  )
  .string(OPT_EXCLUDE_WORD)
  .array(OPT_EXCLUDE_WORD)

  .describe(
    OPT_EXCLUDES_FILE,
    'input file containing a list of strings or regexp (/<expr>/) to exclude from testable vocabulary'
  )
  .string(OPT_EXCLUDES_FILE)
  .array(OPT_EXCLUDES_FILE)

  .describe(OPT_WORD_FREQUENCY_MIN, '[not yet implemented] minimum occurrences of a word to be testable')
  .number(OPT_WORD_FREQUENCY_MIN)

  .describe(OPT_WORD_FREQUENCY_ORDINAL_MAX, '[not yet implemented] test the top N most frequently occurring words')
  .number(OPT_WORD_FREQUENCY_ORDINAL_MAX)

  .describe(OPT_WORD_FREQUENCY_ORDINAL_MIN, '[not yet implemented] test the top N least frequently occurring words')
  .number(OPT_WORD_FREQUENCY_ORDINAL_MIN)

  .describe(OPT_WORD_LENGTH_MIN, '[not yet implemented] test words at least this long')
  .number(OPT_WORD_LENGTH_MIN)
  .default(OPT_WORD_LENGTH_MIN, AnkiNote.WORD_LENGTH_MIN_DEFAULT)

  .parse()

  if (argv[OPT_EXCLUDE_WORD] === undefined) {
    argv[OPT_EXCLUDE_WORD] = []
  }

  return argv
}

function cli_prompts(argv: object): Promise<void> {
  // only use cli prompts where not provided as cli args
  let cli: rl.Interface = rl.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((res) => {
    if (argv[OPT_NOTES_NAME] === undefined) {
      cli.question(`name of generated notes collection (default="${AnkiNote.OUT_NAME_DEFAULT}"): `)
      .then(res)
    }
    else {
      res(argv[OPT_NOTES_NAME])
    }
  })
  .then((notes_name) => {
    if (notes_name === '') {
      notes_name = undefined
    }

    argv[OPT_NOTES_NAME] = notes_name

    cli.close()
  })
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
