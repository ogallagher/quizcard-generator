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
    [OPT_SENTENCE_WORDS_MIN]: 'minimum number of (testable) words to include in a single sentence'
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
    [OPT_EXCLUDE_WORD]: 'E'
}