/**
 * Quizcard generator backend CLI driver (should be called by quizcard_generator.js).
 */

import * as yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import * as fs from 'fs/promises'
import { QuizCardGenerator } from './quizcard_generator'

export const OPT_LOG_LEVEL = 'log-level'
export const OPT_INPUT_FILE = 'input-file'
export const OPT_NO_LOG_FILE = 'no-log-file'

export default function main(argv: object) {
  // logging updated by caller

  const input_file_path = argv[OPT_INPUT_FILE]
  fs.readFile(input_file_path, {encoding: 'utf-8'})
  .then((input_file_content) => {
    let qg = new QuizCardGenerator(input_file_content)
  })
}

export function cli_args() {
  const argv = yargs.default(
    hideBin(process.argv)
  )
  .usage('Backend quizcard generator CLI driver (called via quizcard_generator.js)')

  .alias('help', 'h')

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

  .alias('version', 'v')

  .parse()

  return argv
}
