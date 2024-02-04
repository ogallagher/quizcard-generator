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
    public readonly finish_calculation: Promise<any>
    protected words_frequency_desc: Array<Word>

    constructor(source_string: string) {
        let sentence_current = this.next_sentence()

        source_string.split(QuizCardGenerator.regexp_delim_line)
        .map((source_line, line_idx) => {
            source_line.split(QuizCardGenerator.regexp_delim_token)
            .map((source_token, token_idx) => {
                if (source_token.length === 0) return

                // create key string for token
                let key_string = source_token.replace(
                    QuizCardGenerator.regexp_token_key_exclude,
                    ''
                )
                if (!this.case_sensitive) {
                    key_string = key_string.toLowerCase()
                }
                // console.log(
                //     `debug raw token at [line=${line_idx} word=${token_idx}]`
                //     + ` "${source_token}" key="${key_string}"`
                // )
                
                // parse token as word
                let word: Word
                if (this.words.has(key_string)) {
                    // fetch existing word
                    word = this.words.get(key_string)
                }
                else {
                    // add new word
                    word = new Word(
                        key_string,
                        source_token
                    )
                    this.words.set(key_string, word)
                }

                // add appearance location
                word.add_location(line_idx, undefined, token_idx)

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

        this.finish_calculation = this.calculate_stats()
    }

    protected calculate_stats(): Promise<any[]> {
        const self = this

        const word_count = self.words.size

        return Promise.all([
            // word probabilities
            new Promise(function(r0) {
                let word_idx = 0
                for (let word of self.words.values()) {
                    word.update_probability(word_count)
                    word_idx++
                }
                r0(undefined)
            }),
            // sort words frequency descending
            new Promise(function(r1) {
                function sort_frequency_desc(w1: Word, w2: Word): number {
                    return w2.get_frequency() - w1.get_frequency()
                }

                self.words_frequency_desc = [...self.words.values()].sort(sort_frequency_desc)
                r1(undefined)
            }),
            // word mutual edit distances (group similar words)
            new Promise(function(r2) {

            })
        ])
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

        return new Sentence(this.sentences.length)
    }

    public get_sentence(sentence_index: number): Sentence {
        return this.sentences[sentence_index]
    }

    public get_word(key_string: string): Word {
        if (!this.case_sensitive) {
            key_string = key_string.toLowerCase()
        }

        return this.words.get(key_string)
    }

    public get_word_by_frequency_index(index: number, descending: boolean = true): Word {
        if (!descending) {
            index = (this.words_frequency_desc.length-1) - index
        }

        return this.words_frequency_desc[index]
    }
}

export class Sentence {
    public readonly index: number
    protected words: Map<string, Word> = new Map()
    protected tokens: Array<Word|string> = []
    protected tokens_omits_whitespace: boolean = true

    constructor(index: number) {
        this.index = index
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

export class Word {
    public readonly key_string: string
    public readonly raw_string: string
    protected locations: Array<{
        line: number
        char_on_line?: number
        word_on_line: number
    }> = []
    protected frequency: number = 0
    protected probability: number = 0

    constructor(key_string: string, raw_string: string) {
        this.key_string = key_string
        this.raw_string = raw_string
    }

    add_location(line: number, char_on_line: number|undefined, word_on_line: number) {
        this.locations.push({
            line,
            char_on_line,
            word_on_line
        })

        this.frequency++
    }

    update_probability(population_count: number) {
        this.probability = this.frequency / population_count
    }

    get_frequency() {
        return this.frequency
    }

    toString() {
        return this.raw_string
    }

    /*
	 * Edit distance calculation uses the Wagner-Fischer algorithm for Levenshtein edit distance.
	 * https://en.wikipedia.org/wiki/Wagner–Fischer_algorithm
	 * 
	 * Returns edit distance or -1 if greater than `max_dist`.
	 */
	public static edit_distance(w1: Word, w2: Word, max_dist?: number): number {
		const a = w1.key_string // first row
		const b = w2.key_string // first col
		
		const w: number = a.length+1
		const h: number = b.length+1

        max_dist = (max_dist !== undefined) ? max_dist : Math.max(w, h)
		
        // matrix of substring distances (stored in memory as 1 dimension)
		const d: Array<number> = new Array(h*w); 
		
        // init first row
        for (let x=0; x < w; x++) {
            d[x] = x
        }
        // init first col
		for (let y=0; y < h; y++) { 
			d[y*w] = y
		}
		
		let sc: number; // substitution cost
		let mc: number; // min cost (between insert, delete, substitute)
		let c: number;	// temp cost var for comparison
		
		let dist = 0;   // running count of current edit distance
		
		// compute distance, keeping in mind best distance so far
		for (let y=1; y < h && dist != -1; y++) {
			for (let x=1; x < w; x++) {
				if (a[x-1] == b[y-1]) {
					sc = 0
				}
				else {
					sc = 1
				}
				
				mc = d[y*w + (x-1)] + 1
				c = d[(y-1)*w + x] + 1
				if (c < mc) {
					mc = c
				}
				c = d[(y-1)*w + (x-1)] + sc
				if (c < mc) {
					mc = c
				}
				
				d[y*w + x] = mc;
				if (x == y || (y == h-1 && x > y) || (x == w-1 && y > x)) {
					dist = mc
				}
			}
			
			if (dist > max_dist) {
				dist = -1
			}
		}
		
		if (dist != -1 && dist <= max_dist) {
			return dist
		}
		else {
			return -1
		}
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

                    return cli.default(argv)
                })
                .then(() => {
                    console.log(`debug main end`)
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
