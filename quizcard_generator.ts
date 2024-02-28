#!node
/**
 * Quiz/flash card generator. 
 */

import { PlatformPath } from 'node:path'
import { AnkiNote } from './anki/anki_generator'
import { Percentage, import_fail_forward, sort_random, regexp_word_exclude } from './misc'

export * as opt from './opt'

export class QuizCardGenerator {
    public static readonly regexp_comment = /^\s*#/
    public static readonly regexp_delim_line = /[\n\r]/g
    private static regexp_delim_token = /[\s]+/g
    private static regexp_end_sentence = /[\.\?!]+/
    private static regexp_token_key_exclude = regexp_word_exclude
    public static readonly debug_threshold = 100

    protected case_sensitive: boolean = false
    public static readonly SENTENCE_WORD_COUNT_MIN_DEFAULT: number = 3
    public readonly sentence_word_count_min: number = QuizCardGenerator.SENTENCE_WORD_COUNT_MIN_DEFAULT
    public readonly sentence_token_count_max: number|undefined = undefined
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

    constructor(source_string: string, source_url?: string, word_excludes?: Array<RegExp|string>, sentence_word_count_min?: number, sentence_token_count_max?: number) {
        this.source_url = source_url
        let sentence_current = this.next_sentence()

        let word_exclude_regex_combined: RegExp|undefined
        let word_exclude_regex_sources: string[] = []
        if (word_excludes !== undefined) {
            for (let word_exclude of word_excludes) {
                this.word_excludes.add(
                    !this.case_sensitive && !(word_exclude instanceof RegExp)
                    ? word_exclude.toLowerCase()
                    : word_exclude
                )

                if (word_exclude instanceof RegExp) {
                    word_exclude_regex_sources.push(`(${word_exclude.source})`)
                }
            }

            if (word_exclude_regex_sources.length > 0) {
                word_exclude_regex_combined = new RegExp(
                    word_exclude_regex_sources.join('|'),
                    !this.case_sensitive ? 'i' : undefined
                )
            }
        }
        console.log(
            `debug combined word excludes string-count=${this.word_excludes.size} expr=${word_exclude_regex_combined}`
        )
        
        this.sentence_word_count_min = sentence_word_count_min
        this.sentence_token_count_max = sentence_token_count_max
        console.log(`debug sentence words-min=${this.sentence_word_count_min} tokens-max=${this.sentence_token_count_max}`)

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
                    && (word_exclude_regex_combined === undefined || !word_exclude_regex_combined.test(source_token))
                ) {
                    // parse token as word
                    if (line_idx < QuizCardGenerator.debug_threshold) {
                        console.log(
                            `debug token at [line=${line_idx} sentence=${sentence_current?.index} token=${token_idx}]`
                            + ` raw="${source_token}" key="${key_string}"`
                        )
                    }
                    
                    let word: Word
                    if (this.words.has(key_string)) {
                        // fetch existing word
                        word = this.words.get(key_string)
                    }
                    else {
                        // add new word
                        word = new Word(
                            key_string,
                            source_token,
                            this
                        )
                        this.words.set(key_string, word)
                    }

                    // add appearance location
                    word.add_location(source_token, line_idx, undefined, token_idx, sentence_current)

                    // add word to sentence
                    sentence_current.add_token(word)
                }
                else {
                    // token has no word characters; add to sentence as plain token
                    sentence_current.add_token(source_token)
                }
                
                if (
                    (this.sentence_token_count_max !== undefined && sentence_current.get_token_count() >= this.sentence_token_count_max) 
                    || QuizCardGenerator.regexp_end_sentence.test(source_token)
                ) {
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
            this.sentences.push(sentence_current)
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
                        Word.edit_distance(wa, wb, max_dist)
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

            if (this.sentences.length < QuizCardGenerator.debug_threshold) {
                console.log(`debug commit sentence ${current_sentence}`)
            }
            this.sentences.push(current_sentence)
        }

        const new_sentence = new Sentence(this.sentences.length, this.source_url)
        current_sentence?.set_after(new_sentence)
        new_sentence.set_before(current_sentence)

        return new_sentence
    }

    public get_sentence(sentence_index: number): Sentence {
        return this.sentences[sentence_index]
    }

    public get_sentences(): Sentence[] {
        return new Array(...this.sentences)
    }

    public get_sentences_count(): number {
        return this.sentences.length
    }

    public get_words_count(): number {
        return this.words_frequency_desc.length
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

    public get_words_by_frequency(limit: number|Percentage, highest: boolean = true): Set<string> {
        
        let _limit: number
        if (limit instanceof Percentage) {
            // convert percentage to ordinal number
            _limit = Math.ceil(limit.get_proportion() * this.words_frequency_desc.length)
            console.log(`debug convert ordinal frequency percentage ${limit} to number ${_limit}`)
        }
        else {
            _limit = limit
        }

        if (highest) {
            if (this.words_highest_frequency?.size !== limit) {
                this.words_highest_frequency = new Set(this.words_frequency_desc.slice(0, _limit).map((word) => word.key_string))
            }
            return this.words_highest_frequency
        }
        else {
            if (this.words_lowest_frequency?.size !== limit) {
                this.words_lowest_frequency = new Set(this.words_frequency_desc.slice(Math.max(this.words_frequency_desc.length-_limit, 0)).map((word) => word.key_string))
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
        word_frequency_ordinal_max?: number|string,
        word_frequency_ordinal_min?: number|string,
        before_token_count?: number,
        after_token_count?: number,
        choice_variation?: number|string
    ): AnkiNote[] {
        const count = (limit === undefined) ? this.sentences.length : limit
        console.log(`info generate ${limit} anki notes`)

        let anki_notes: AnkiNote[] = new Array(count)

        const _word_frequency_ordinal_min = Percentage.percentage_or_number(word_frequency_ordinal_min)
        const _word_frequency_ordinal_max = Percentage.percentage_or_number(word_frequency_ordinal_max)
        console.log(
            `debug word_frequency_ordinal_max or min = `
            + `${_word_frequency_ordinal_max} || ${_word_frequency_ordinal_min}`
        )
        const _choice_variation = Percentage.percentage_or_number(choice_variation)
        console.log(`debug choice variation = ${_choice_variation}`)
        console.log(`debug prologue=${before_token_count} epilogue=${after_token_count}`)

        this.sentences.slice(0, count).map((s, idx) => {
            anki_notes[idx] = AnkiNote.from_sentence(
                s, 
                word_frequency_min, 
                word_length_min,
                (
                    // select between high frequency
                    _word_frequency_ordinal_max !== undefined ? this.get_words_by_frequency(_word_frequency_ordinal_max, true) 
                    // and low frequency
                    : (_word_frequency_ordinal_min !== undefined ? this.get_words_by_frequency(_word_frequency_ordinal_min, false) : undefined)
                ),
                before_token_count, after_token_count,
                _choice_variation
            )
        })
        
        return anki_notes.filter((note) => note !== undefined)
    }

    public get_source_url(): string|undefined {
        return this.source_url
    }
}

export class Sentence {
    public readonly index: number
    public readonly source?: string
    protected words: Map<string, Word> = new Map()
    protected tokens: Array<Word|string> = []
    protected tokens_omits_whitespace: boolean = true
    protected before?: Sentence
    protected after?: Sentence

    constructor(index: number, source?: string, before?: Sentence, after?: Sentence) {
        this.index = index
        this.source = source
        this.before = before
        this.after = after
    }

    add_token(token: Word|string) {
        // if (this.tokens.length < QuizCardGenerator.debug_threshold) {
        //     console.log(`debug s${this.index}.t${this.tokens.length}=${token}`)
        // }
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

    get_token_count(): number {
        return this.tokens.length
    }

    set_before(before: Sentence) {
        this.before = before
    }

    set_after(after: Sentence) {
        this.after = after
    }

    get_prologue(token_count: number): string {
        if (token_count === 0) return ''

        const delim = this.tokens_omits_whitespace ? ' ' : ''
        if (this.before !== undefined) {
            return this.before.tokens.slice(-token_count).join(delim)
        }
        else {
            console.log(
                `error cannot include ${token_count} prologue tokens without before `
                + `of s${this.index}`
            )
            return ''
        }
    }

    get_epilogue(token_count: number): string {
        if (token_count === 0) return ''

        const delim = this.tokens_omits_whitespace ? ' ' : ''
        if (this.after !== undefined) {
            return this.after.tokens.slice(0, token_count).join(delim)
        }
        else {
            console.log(
                `error cannot include ${token_count} epilogue tokens without after `
                + ` of s${this.index}`
            )
            return ''
        }
    }

    toString(prologue_token_count: number = 0, epilogue_token_count: number = 0): string {
        const delim = this.tokens_omits_whitespace ? ' ' : ''
        let text = this.tokens.join(delim)

        if (prologue_token_count > 0) {
            text = this.get_prologue(prologue_token_count) + delim + text
        }
        if (epilogue_token_count > 0) {
            text = text + delim + this.get_epilogue(epilogue_token_count)
        }

        return text
    }
}

interface WordLocation {
    line: number
    char_on_line?: number
    word_on_line: number
    raw_string: string,
    sentence: Sentence,
    token_in_sentence: number
}

export class Word {
    /**
     * Unique identifier string (normalized version of raw string).
     */
    public readonly key_string: string
    /**
     * Raw token string as encountered at **first** location in source text.
     */
    public readonly raw_string: string
    protected locations: Array<WordLocation> = []
    protected sentence_locations: Map<string, WordLocation> = new Map()
    protected frequency: number = 0
    protected probability: number = 0
    /**
     * Map edit distances to words.
     */
    protected readonly edit_distances: Map<number, string[]> = new Map()
    /**
     * Map words to their edit distances, values being {@link WordEditDistance} instances for
     * access to `variance` as well.
     */
    protected readonly edit_distances_by_word: Map<string, WordEditDistance> = new Map()
    protected edit_distances_range = {
        min: Number.MAX_VALUE, 
        max: 0
    }
    /**
     * Length of {@link Word.key_string}.
     */
    public readonly length: number
    protected readonly context: QuizCardGenerator

    constructor(key_string: string, raw_string: string, context?: QuizCardGenerator) {
        this.key_string = key_string
        this.length = key_string.length
        this.raw_string = raw_string
        this.context = context
    }

    /**
     * Add location of occurrence of this word.
     * 
     * Assumes that the word has not yet been added to its parent {@linkcode Sentence}.
     * 
     * @param raw_string 
     * @param line 
     * @param char_on_line 
     * @param word_on_line 
     * @param sentence 
     */
    add_location(
        raw_string: string|undefined, 
        line: number, 
        char_on_line: number|undefined, 
        word_on_line: number,
        sentence: Sentence
    ) {
        const location = {
            raw_string: (raw_string === undefined ? this.raw_string : raw_string),
            line,
            char_on_line,
            word_on_line,
            sentence,
            token_in_sentence: sentence.get_token_count()
        }
        this.locations.push(location)
        this.sentence_locations.set(this.sentence_location_key(sentence.index, location.token_in_sentence), location)

        this.frequency++
    }

    private sentence_location_key(sentence_index: number, token_in_sentence: number) {
        return `s${sentence_index}-t${token_in_sentence}`
    }

    update_probability(population_count: number) {
        this.probability = this.frequency / population_count
    }

    get_frequency() {
        return this.frequency
    }

    /**
     * Attempt to return the raw token string corresponding to the given location.
     * If the location cannot be determined, {@linkcode Word.raw_string} is returned.
     * 
     * @param location_key Unique location reference.
     * @returns {string}
     */
    get_raw_string(location_key?: {
        sentence: Sentence,
        token_in_sentence: number
    }) {
        if (location_key !== undefined) {
            const location = this.sentence_locations.get(this.sentence_location_key(
                location_key.sentence.index,
                location_key.token_in_sentence
            ))

            if (location !== undefined) {
                return location.raw_string
            }
        }

        return this.raw_string
    }

    /**
     * Since this returns the raw string corresponding to the arbirary first location in the source text, it's
     * better to use {@linkcode Word.get_raw_string} whenever possible.
     */
    toString() {
        return this.raw_string
    }

    /**
     * @returns JSON compatible representation.
     */
    toJSON(): {[key: string]: any} {
        let view = {}

        for (let [key, val] of Object.entries(this)) {
            if (key === 'locations') {
                view[key] = this.locations.map(Word.location_to_json_view)
            }
            else if (key === 'sentence_locations') {
                view[key] = {}
                for (let [loc_key, loc_val] of this.sentence_locations.entries()) {
                    view[key][loc_key] = Word.location_to_json_view(loc_val)
                }
            }
            else if (key === 'context') {
                view[key] = Word.context_to_json_view(this.context)
            }
            else {
                view[key] = val
            }
        }

        return view
    }

    private static location_to_json_view(location: WordLocation) {
        let view: {[key: string]: any} = {}

        for (let [key, val] of Object.entries(location)) {
            if (key === 'sentence') {
                view[key] = 's' + location.sentence.index
            }
            else {
                view[key] = val
            }
        }

        return view
    }

    private static context_to_json_view(context: QuizCardGenerator) {
        let view: {[key: string]: any} = {}
        view['source_url'] = context?.get_source_url()

        return view
    }

    private set_distance(edit_dist: WordEditDistance, word: Word) {
        this.edit_distances_by_word.set(word.key_string, edit_dist)

        if (this.edit_distances.has(edit_dist.distance)) {
            this.edit_distances.get(edit_dist.distance).push(word.key_string)
        }
        else {
            this.edit_distances.set(edit_dist.distance, [word.key_string])
        }

        if (edit_dist.distance < this.edit_distances_range.min) {
            this.edit_distances_range.min = edit_dist.distance
        }
        if (edit_dist.distance > this.edit_distances_range.max) {
            this.edit_distances_range.max = edit_dist.distance
        }
    }

    public get_distance(word: Word|string): WordEditDistance|undefined {
        return this.edit_distances_by_word.get(
            (word instanceof Word) ? word.key_string : word
        )
    }

    public get_words_at_distance(distance: number): string[] {
        let words = this.edit_distances.get(distance)
        return (words !== undefined) ? words : []
    }

    /**
     * Get the N closest words to this one.
     * 
     * @param count Number of words to return ordered distance ascending.
     * @param random_probability Probability that instead of the next closest word, a random word is
     * added to the return list. Domain is [0,1]. Only works if {@link Word.context} is defined.
     */
    public get_closest_words(count: number, random_probability?: number): string[] {
        let closest: Set<string> = new Set()
        let distance = this.edit_distances_range.min
        let candidates: string[]|undefined
        let random_chances = 1
        const word_population: number|undefined = this.context?.get_words_count()

        while (closest.size < count && distance <= this.edit_distances_range.max) {
            candidates = this.get_words_at_distance(distance)

            random_chances = candidates.length || 0
            if (random_probability !== undefined && word_population !== undefined) {
                let r_idx: number
                let r_str: string
                for (let i = 0; i < random_chances && closest.size < count; i++) {
                    if (Math.random() <= random_probability) {
                        // add random choice
                        r_idx = Math.round(Math.random() * (word_population-1))
                        r_str = this.context.get_word_by_frequency_index(r_idx).key_string
                        if (r_str !== this.key_string) {
                            closest.add(r_str)
                        }
                    }
                    // skip random choice
                }
            }

            if (candidates !== undefined) {
                if (closest.size + candidates.length > count) {
                    // select random subset of equidistant candidates
                    candidates.sort(sort_random).slice(0, count-closest.size)
                    .forEach((candidate) => closest.add(candidate))
                }
                else {
                    candidates.forEach((candidate) => closest.add(candidate))
                }
            }

            distance++
        }

        return new Array(...closest.values())
    }

    /**
     * Calculate and return edit distance between words.
     * As a side effect, also calls {@link Word#set_distance} for each word tested.
     * 
     * @param w1 
     * @param w2 
     */
    public static edit_distance(w1: Word, w2: Word, max_dist?: number) {
        const word_edit_dist = new WordEditDistance(w1, w2, max_dist)

        if (word_edit_dist.distance !== -1) {
            w1.set_distance(word_edit_dist, w2)
            w2.set_distance(word_edit_dist, w1)
        }

        return word_edit_dist
    }
}

export class WordEditDistance {
    /**
     * Edit distance between 2 strings.
     */
    public readonly distance: number
    /**
     * Representation of normalized distance in range [0,1].
     * Formula = `distance(w1, w2) / max(w1.length, w2.length)`
     * Stored internally as an integer, to which {@link WordEditDistance.variance_precision} must 
     * be applied to convert to the true value.
     */
    private readonly variance: number
    /**
     * Number of digits after the decimal point to which edit distance variances are rounded
     * and considered equivalent.
     */
    protected static variance_precision: number = 2
    public static readonly DISTANCE_BEYOND = -1

    constructor(w1: string|Word, w2: string|Word, max_dist?: number) {
        this.distance = WordEditDistance.edit_distance(w1, w2, max_dist)
        if (this.distance !== -1) {
            this.variance = Math.round(
                (this.distance / Math.max(w1.length, w2.length)) 
                * (10 * WordEditDistance.variance_precision)
            )
        }
        else {
            this.variance = WordEditDistance.DISTANCE_BEYOND
        }
    }

    /**
     * Normalized edit distance in range [0,1]. This means that the distance between words is agnostic
     * of their length, where `'ab' to 'ac'` has the same variance as `'aabb'` to `'aacc'`.
     * 
     * @returns Word edit variance.
     */
    get_variance(): number {
        return this.variance / (10 * WordEditDistance.variance_precision)
    }

    /**
	 * Edit distance calculation uses the 
     * [Wagner-Fischer algorithm](https://en.wikipedia.org/wiki/Wagner–Fischer_algorithm) 
     * for Levenshtein edit distance.
	 * 
	 * Returns edit distance or -1 if greater than `max_dist`.
	 */
	private static edit_distance(w1: Word|string, w2: Word|string, max_dist?: number): number {
		const a = w1 instanceof Word ? w1.key_string : w1 // first row
		const b = w2 instanceof Word ? w2.key_string : w2 // first col
		
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
			return WordEditDistance.DISTANCE_BEYOND
		}
	}

    /**
     * @returns A combination of `distance` and `variance`.
     */
    toString() {
        return `${this.distance}-${this.variance}`
    }

    /**
     * Compares 2 edit distances by **variance**, which stays within normalized range [0,1] regardless
     * of the lengths of the original strings measured.
     */
    static compare(e1: WordEditDistance, e2: WordEditDistance) {
        return e1.variance - e2.variance
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
    const SELF_BIN_NAME = 'quizcard-generator'

    if (typeof exports !== 'undefined') {
        // backend
        exports.imports_promise = imports_promise

        // check entrypoint
        if (node_process !== undefined) {
            const entrypoint_file = node_path.basename(node_process.argv[1])
            console.log(`debug argv[1] (entrypoint script) = ${entrypoint_file}`)
            if (entrypoint_file === SELF_FILE_NAME || entrypoint_file === SELF_BIN_NAME) {
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
