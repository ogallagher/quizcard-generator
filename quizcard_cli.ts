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

export default function main(argv: object): Promise<any> {
  // logging updated by caller
  console.log(`debug cli args = ${JSON.stringify(argv)}`)

  let qg: QuizCardGenerator

  const input_file_path = argv[OPT_INPUT_FILE]
  return fs.readFile(input_file_path, {encoding: 'utf-8'})
  .then((input_file_content) => {
    qg = new QuizCardGenerator(input_file_content)

    console.log(`info sentence 2 = ${qg.get_sentence(2)}`)
    console.log(`info "that" = ${JSON.stringify(qg.get_word('that'), undefined, 2)}`)

    return qg.finish_calculation
  })
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
  .then(() => {
    let anki_notes = qg.generate_anki_notes()
    console.log(`info first generated Anki note is ${JSON.stringify(anki_notes[0], undefined, 2)}`)

    console.log(`exporting first note to default location`)
    return AnkiNote.export(
      [anki_notes[0]],
      argv[OPT_NOTES_NAME]
    )
  })
  .then(() => {
    console.log(`info export complete`)
  })
}

export function cli_args() {
  const argv = yargs.default(
    hideBin(process.argv)
  )
  .usage('Backend quizcard generator CLI driver (called via quizcard_generator.js)')

  .alias('h', 'help')
  .alias('v', 'version')

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

  .describe(OPT_NOTES_NAME, 'name of anki notes collection to generate; will be used for the exported file name')
  .alias(OPT_NOTES_NAME, 'n')

  .parse()

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
