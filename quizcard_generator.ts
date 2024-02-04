/**
 * Quiz/flash card generator.
 */

import { PlatformPath } from 'node:path'

export class QuizCardGenerator {
    private static regexp_delim_line = /[\n\r]/g
    private static regexp_delim_token = /[\s]+/g
    private static regexp_end_sentence = /[\.\?!]+/g
    private static regexp_token_key_exclude = /[\W]+/gi

    protected case_sensitive: boolean = false

    /**
     * Map of unique words present in the source string.
     */
    protected words: Map<string, Word> = new Map()
    /**
     * List of sentences in order of appearence in the source string.
     */
    protected sentences: Array<Sentence> = []

    constructor(source_string: string) {
        let sentence_current = this.next_sentence()

        source_string.split(QuizCardGenerator.regexp_delim_line)
        .map((source_line, line_idx) => {
            source_line.split(QuizCardGenerator.regexp_delim_token)
            .map((source_token, token_idx) => {
                // create key string for token
                let key_string = source_token.replace(
                    QuizCardGenerator.regexp_token_key_exclude,
                    ''
                )
                if (!this.case_sensitive) {
                    key_string = key_string.toLowerCase()
                }
                console.log(
                    `debug raw token at [line=${line_idx} word=${token_idx}]`
                    + ` ${source_token} to key string ${key_string}`
                )
                
                // parse token as word
                let word: Word
                if (this.words.has(key_string)) {
                    // fetch existing word and increment appearances/frequency
                    word = this.words.get(key_string)
                    word.increment_frequency()
                }
                else {
                    // add new word
                    word = new Word(
                        key_string,
                        source_token, 
                        line_idx, 
                        undefined, 
                        token_idx
                    )
                    this.words.set(key_string, word)
                }

                // add word to sentence
                sentence_current.add_token(word)
                
                if (source_token.match(QuizCardGenerator.regexp_end_sentence) !== null) {
                    // end of sentence
                    sentence_current = this.next_sentence(sentence_current)
                }
                else {
                    // [skip] add whitespace before next word
                    // sentence_current.add_token(' ')
                }
            })
        })

        // add last sentence
        if (!sentence_current.is_empty()) {
            this.next_sentence()
        }

        console.log(`info parsed ${this.sentences.length} sentences, ${this.words.size} words`)
        console.log(`info first sentence is ${this.sentences[0]}`)
        console.log(`info first word is ${JSON.stringify(this.words.values().next().value)}`)
    }

    /**
     * Add current sentence to {@link QuizCardGenerator#sentences} and return a new sentence.
     * 
     * @param current_sentence 
     * @returns 
     */
    protected next_sentence(current_sentence?: Sentence): Sentence {
        if (current_sentence !== undefined) {
            this.sentences.push(current_sentence)
        }

        return new Sentence()
    }
}

class Sentence {
    protected words: Map<string, Word> = new Map()
    protected tokens: Array<Word|string> = []
    protected tokens_omits_whitespace: boolean = true

    constructor() {
    }

    add_token(token: Word|string) {
        this.tokens.push(token)
        if (token instanceof Word) {
            this.words.set(token.key_string, token)
        }
    }

    is_empty(): boolean {
        return this.tokens.length === 0
    }

    toString() {
        const delim = this.tokens_omits_whitespace ? ' ' : ''
        return this.tokens.join(delim)
    }
}

class Word {
    public readonly key_string: string
    public readonly raw_string: string
    public readonly location: {
        line: number
        char_on_line: number
        word_on_line: number
    }
    protected frequency: number = 0

    constructor(key_string: string, raw_string: string, line: number, char_on_line: number, word_on_line: number) {
        this.key_string = key_string
        this.raw_string = raw_string
        this.location = {
            line: line,
            char_on_line: char_on_line,
            word_on_line: word_on_line
        }
    }

    increment_frequency() {
        this.frequency++
    }

    toString() {
        return this.raw_string
    }
}

const imports_promise = Promise.all([
    import('node:process').then(
        (node_process) => {
            return node_process
        },
        import_fail_forward
    ),
    import('node:path').then(
        (node_path) => {
            return node_path
        },
        import_fail_forward
    ),
    // TODO import types for temp logger when available
    import('temp_js_logger')
    .then(
        (templogger) => {
            return templogger.imports_promise
            .then(function() {
                return config_logging(templogger)
            })
        },
        import_fail_forward
    )
])

imports_promise.then(([
    node_process, 
    node_path,
    templogger
] : [
    NodeJS.Process,
    PlatformPath,
    any
]) => {
    const SELF_FILE_NAME = 'quizcard_generator.js'

    if (typeof exports !== 'undefined') {
        // backend
        exports.imports_promise = imports_promise

        // check entrypoint
        if (node_process !== undefined) {
            const entrypoint_file = node_path.basename(node_process.argv[1])
            console.log(`debug argv[1] (entrypoint script) = ${entrypoint_file}`)
            if (entrypoint_file === SELF_FILE_NAME) {
                // proceed to cli driver
                console.log('info is entrypoint')
                import('./quizcard_cli')
                .then((cli) => {
                    const argv = cli.cli_args()
                    if (templogger !== undefined) {
                        const log_level = argv[cli.OPT_LOG_LEVEL]
                        console.log(`debug set log level to ${log_level}`)
                        templogger.TempLogger.set_log_level(log_level)

                        if (argv[cli.OPT_NO_LOG_FILE]) {
                            console.log(`debug disable log file`)
                            templogger.TempLogger.set_log_to_file(false)
                        }
                    }
                    cli.default(argv)
                })
            }
            else {
                console.log('debug not entrypoint')
            }
        }
        else {
            console.log('warning script on backend, but unable to import node:process')
            // assume not entrypoint
        }
    }
    else {
        // frontend
    }
})

function config_logging(tl: any) {
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

function import_fail_forward(err: Error) {
    console.log(`warning import failed. ${err}`)
    console.log(`debug ${err.stack}`)
    return undefined
}
