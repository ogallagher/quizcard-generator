import { AnkiNote } from "./anki/anki_generator"

/**
 * Options for configuring QuizCardGenerator behavior.
 */

export const OPT_LOG_LEVEL = 'log-level'
export const OPT_INPUT_FILE = 'input-file'
/**
 * Input directly as string instead of file path.
 */
export const OPT_INPUT_FILE_CONTENT = `${OPT_INPUT_FILE}-content`
export const OPT_LOG_FILE = 'log-file'
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
/**
 * Word maximum ordinal rank from highest frequency (keep N most common), at anki transform stage.
 */
export const OPT_WORD_FREQUENCY_ORDINAL_MAX = 'word-frequency-first'
/**
 * Word maximum ordinal rank from lowest frequency (keep N most rare), at anki transform stage.
 */
export const OPT_WORD_FREQUENCY_ORDINAL_MIN = 'word-frequency-last'
/**
 * Word minimum length, at anki transform stage.
 */
export const OPT_WORD_LENGTH_MIN = 'word-length-min'
/**
 * Custom tag(s) for exported anki notes file.
 */
export const OPT_TAG = 'tag'
/**
 * Limit number of anki notes to generate.
 */
export const OPT_LIMIT = 'limit'
/**
 * Maximum number of tokens to include in a sentence before breaking to start a new one.
 */
export const OPT_SENTENCE_TOKENS_MAX = 'sentence-length-max'
/**
 * Minimum number of words in a sentence before allowing break.
 */
export const OPT_SENTENCE_WORDS_MIN = 'sentence-length-min'
export const OPT_PROLOGUE = 'prologue'
export const OPT_EPILOGUE = 'epilogue'
/**
 * Configure {@link AnkiNote.CHOICES_MAX}.
 */
export const OPT_CHOICES_MAX = 'choices'
/**
 * Configure probability that each choice is defined randomly instead of by edit distance.
 */
export const OPT_CHOICE_VARIATION = 'choice-randomness'

/**
 * Option descriptions/help messages.
 */
export const OPT_DESCRIBES = {
    [OPT_LOG_LEVEL]: 'logging level',
    [OPT_INPUT_FILE]: 'input/source file',
    [OPT_INPUT_FILE_CONTENT]: 'Instead of providing the source document as a file path, provide the string content directly.',
    [OPT_LOG_FILE]: 'generate a log file',
    [OPT_NOTES_NAME]: 'name of anki notes collection to generate; will be used for the exported file name',
    [OPT_EXCLUDE_WORD]: 'define a string or regexp (/<expr>/) to exclude from testable vocabulary (ex. names, trivial words)',
    [OPT_EXCLUDES_FILE]: 'input file containing a list of strings or regexp (/<expr>/) to exclude from testable vocabulary',
    [OPT_WORD_FREQUENCY_MIN]: 'minimum occurrences of a word to be testable',
    [OPT_WORD_FREQUENCY_ORDINAL_MAX]: `test the top N most frequently occurring words. takes precedence over ${OPT_WORD_FREQUENCY_ORDINAL_MIN} when both are specified. suffix with % for percentage`,
    [OPT_WORD_FREQUENCY_ORDINAL_MIN]: 'test the top N least frequently occurring words. suffix with % for percentage',
    [OPT_WORD_LENGTH_MIN]: 'test words at least this long',
    [OPT_TAG]: 'add custom tags to the anki notes export',
    [OPT_LIMIT]: 'limit number of generated anki notes',
    [OPT_SENTENCE_TOKENS_MAX]: 'maximum number of tokens (words both testable and not testable) to include in a single sentence',
    [OPT_SENTENCE_WORDS_MIN]: 'minimum number of (testable) words to include in a single sentence',
    [OPT_PROLOGUE]: 'anki notes include N tokens of additional text before the sentence with the tested word.',
    [OPT_EPILOGUE]: 'anki notes include N tokens of additional text after the sentence with the tested word.',
    [OPT_CHOICES_MAX]: 'maximum number of choices/options from which to choose the correct answer.',
    [OPT_CHOICE_VARIATION]: 'configures the degree of randomness in generated choices, in range [0,1]. suffix with % for percentage'
}

/**
 * Option aliases.
 */
export const OPT_ALIASES: {[key:string]: string[]|string} = {
    [OPT_INPUT_FILE]: 'i',
    [OPT_INPUT_FILE_CONTENT]: 'I',
    [OPT_LOG_LEVEL]: 'l',
    [OPT_LOG_FILE]: 'L',
    [OPT_NOTES_NAME]: 'n',
    [OPT_TAG]: 't',
    [OPT_LIMIT]: 'N',
    [OPT_EXCLUDES_FILE]: 'e',
    [OPT_EXCLUDE_WORD]: 'E',
    [OPT_CHOICES_MAX]: 'c',
    [OPT_CHOICE_VARIATION]: 'r'
}

export interface OptArgv {
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
    [OPT_SENTENCE_WORDS_MIN]?: number
    [OPT_SENTENCE_TOKENS_MAX]?: number
    [OPT_PROLOGUE]? :number
    [OPT_EPILOGUE]?: number
    [OPT_CHOICES_MAX]?: number
    [OPT_CHOICE_VARIATION]?: number
  }

export function clean_opts(argv: OptArgv) {
    let opts = {}
    let aliases = new Set(Object.values(OPT_ALIASES))
  
    for (let [key, value] of Object.entries(argv)) {
      if (
        !key.startsWith('-') && key !== '_' 
        && !/[A-Z\s]/.test(key) && !/\$\d+/.test(key)
        && !aliases.has(key)
        && value !== undefined) {
        opts[key] = value
      }
    }
  
    return opts
  }