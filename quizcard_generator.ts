/**
 * Quiz/flash card generator. 
 */

import { PlatformPath } from 'node:path'
import { AnkiNote } from './anki/anki_generator'
import { import_fail_forward } from './misc'

export * as opt from './opt'

export class QuizCardGenerator {
    public static readonly regexp_comment = /^\s*#/
    public static readonly regexp_delim_line = /[\n\r]/g
    private static regexp_delim_token = /[\s]+/g
    private static regexp_end_sentence = /[\.\?!]+/g
    private static regexp_token_key_exclude = /[\s0-9`~!@#\$%\^&*()\-_+={}\[\]|\\:;'\"<>?,.\/∑´®†¥¨ˆ=ƒ©˙∆˚¬≈√∫˜]+/g

    protected case_sensitive: boolean = false
    protected sentence_word_count_min: number = 3
    protected source_url?: string
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
    protected word_excludes: Set<RegExp|string> = new Set()
    protected words_highest_frequency: Set<string>
    protected words_lowest_frequency: Set<string>

    constructor(source_string: string, source_url?: string, word_excludes?: Array<RegExp|string>) {
        this.source_url = source_url
        let sentence_current = this.next_sentence()

        let word_exclude_regex_combined: RegExp|undefined
        let word_exclude_regex_sources: string[] = []
        if (word_excludes !== undefined) {
            for (let word_exclude of word_excludes) {
                this.word_excludes.add(word_exclude)

                if (word_exclude instanceof RegExp) {
                    word_exclude_regex_sources.push(`(${word_exclude.source})`)
                }
            }

            if (word_exclude_regex_sources.length > 0) {
                word_exclude_regex_combined = new RegExp(word_exclude_regex_sources.join('|'))
            }
        }

        console.log(`debug combined word excludes expr = ${word_exclude_regex_combined}`)

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

                if (
                    key_string.length !== 0
                    // string literal exclude
                    && !this.word_excludes.has(key_string)
                    // regexp pattern exclude
                    && (word_exclude_regex_combined === undefined || !word_exclude_regex_combined.test(key_string))
                ) {
                    // parse token as word
                    // console.log(
                    //     `debug raw token at [line=${line_idx} word=${token_idx}]`
                    //     + ` "${source_token}" key="${key_string}"`
                    // )
                    
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
                }
                else {
                    // token has no word characters; add to sentence as plain token
                    sentence_current.add_token(source_token)
                }
                
                
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
                const words_list = [...self.words.values()]
                const max_dist = 10
                let wa: Word, wb: Word

                for (let a=0; a < words_list.length; a++) {
                    wa = words_list[a]
                    for (let b=a+1; b < words_list.length; b++) {
                        wb = words_list[b]
                        let d = Word.edit_distance(wa, wb, max_dist)
                        // console.log(`debug dist from ${wa} to ${wb} = ${d}`)
                    }
                }
                r2(undefined)
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
            if (current_sentence.get_word_count() < this.sentence_word_count_min) {
                // sentence is not long enough; allow to combine with next one
                return current_sentence
            }

            this.sentences.push(current_sentence)
        }

        return new Sentence(this.sentences.length, this.source_url)
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

    public get_words_by_frequency(limit: number, highest: boolean = true): Set<string> {
        if (highest) {
            if (this.words_highest_frequency?.size !== limit) {
                this.words_highest_frequency = new Set(this.words_frequency_desc.slice(0, limit).map((word) => word.key_string))
            }
            return this.words_highest_frequency
        }
        else {
            if (this.words_lowest_frequency?.size !== limit) {
                this.words_lowest_frequency = new Set(this.words_frequency_desc.slice(Math.max(this.words_frequency_desc.length-limit, 0)).map((word) => word.key_string))
            }
            return this.words_lowest_frequency
        }
    }

    /**
     * Convert each sentence to an anki note.
     */
    public generate_anki_notes(
        limit?: number,
        word_frequency_min?: number, 
        word_length_min?: number,
        word_frequency_ordinal_max?: number,
        word_frequency_ordinal_min?: number
    ): AnkiNote[] {
        const count = (limit === undefined) ? this.sentences.length : limit
        console.log(`info generate ${limit} anki notes`)

        let anki_notes: AnkiNote[] = new Array(count)
        console.log(
            `debug word_frequency_ordinal_max or min = `
            + `${word_frequency_ordinal_max} || ${word_frequency_ordinal_min}`
        )
        this.sentences.slice(0, count).map((s, idx) => {
            anki_notes[idx] = AnkiNote.from_sentence(
                s, 
                word_frequency_min, 
                word_length_min,
                (
                    // select between high frequency
                    word_frequency_ordinal_max !== undefined ? this.get_words_by_frequency(word_frequency_ordinal_max, true) 
                    // and low frequency
                    : (word_frequency_ordinal_min !== undefined ? this.get_words_by_frequency(word_frequency_ordinal_min, false) : undefined)
                )
            )
        })

        return anki_notes
    }
}

export class Sentence {
    public readonly index: number
    public readonly source?: string
    protected words: Map<string, Word> = new Map()
    protected tokens: Array<Word|string> = []
    protected tokens_omits_whitespace: boolean = true

    constructor(index: number, source?: string) {
        this.index = index
        this.source = source
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

    get_words(): IterableIterator<[string, Word]> {
        return this.words.entries()
    }

    get_word_count(): number {
        return this.words.size
    }

    get_tokens(): IterableIterator<string|Word> {
        return this.tokens.values()
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
    protected readonly edit_distances: Map<number, string[]> = new Map()
    protected readonly edit_distances_by_word: Map<string, number> = new Map()
    protected edit_distances_range = {
        min: Number.MAX_VALUE, 
        max: 0
    }

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

    private set_distance(distance: number, word: Word) {
        this.edit_distances_by_word.set(word.key_string, distance)

        if (this.edit_distances.has(distance)) {
            this.edit_distances.get(distance).push(word.key_string)
        }
        else {
            this.edit_distances.set(distance, [word.key_string])
        }

        if (distance < this.edit_distances_range.min) {
            this.edit_distances_range.min = distance
        }
        if (distance > this.edit_distances_range.max) {
            this.edit_distances_range.max = distance
        }
    }

    public get_distance(word: Word|string): number|undefined {
        return this.edit_distances_by_word.get(
            (word instanceof Word) ? word.key_string : word
        )
    }

    public get_words_at_distance(distance: number): string[] {
        return this.edit_distances.get(distance)
    }

    public get_closest_words(count: number): string[] {
        let closest: string[] = []
        let distance = 0
        let candidates: string[]|undefined

        function sort_random() {
            return (Math.random() * 2) - 1
        }

        while (closest.length < count && distance <= this.edit_distances_range.max) {
            candidates = this.get_words_at_distance(distance)

            if (candidates !== undefined) {
                if (closest.length + candidates.length > count) {
                    // select random subset of equidistant candidates
                    closest = closest.concat(candidates.sort(sort_random).slice(0, count-closest.length))
                }
                else {
                    closest = closest.concat(candidates)
                }
            }

            distance++
        }

        return closest
    }

    /**
	 * Edit distance calculation uses the 
     * [Wagner-Fischer algorithm](https://en.wikipedia.org/wiki/Wagner–Fischer_algorithm) 
     * for Levenshtein edit distance.
	 * 
	 * Returns edit distance or -1 if greater than `max_dist`.
     * As a side effect, also calls {@link Word#set_distance} for each word tested.
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
            w1.set_distance(dist, w2)
            w2.set_distance(dist, w1)

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
    )
])

imports_promise.then(([
    node_process, 
    node_path
] : [
    NodeJS.Process,
    PlatformPath
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
                    return cli.default(argv)
                })
                .then(() => {
                    console.log(`debug main end`)
                    return
                })
            }
            else {
                console.log('debug not entrypoint')
                return
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
