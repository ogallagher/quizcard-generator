/**
 * Integration of quiz card generator output with Anki.
 */

import { createHash } from 'crypto'
import { Sentence, Word } from '../quizcard_generator'
import * as fs from 'fs'
import * as path from 'node:path'
import { Percentage, sort_random, regexp_word_exclude } from '../misc'
import { AnkiTag, RenderControlTag } from './anki_tag'
import { OPT_INPUT_FILE_CONTENT, OptArgv } from '../opt'

const ind = '  '
const ul_ind = ind + ind
const el_ind = ind + ind + ind

interface SourceReference {file: string, line_number: number}
declare type OptionalWriteStream = fs.WriteStream|{write: (value: string) => void}

export class AnkiNote {
    /**
     * Max number of options from which to choose the correct answer. Equal to the number of
     * distractors + 1.
     */
    protected static CHOICES_MAX = 5
    protected static readonly SEPARATOR_NAME = 'tab'
    public static readonly SEPARATOR = '\t'
    public static readonly OUT_NAME_DEFAULT = 'notes'
    /**
     * A word must be at least this long to be testable.
     */
    public static readonly WORD_LENGTH_MIN_DEFAULT: number = 2

    /**
     * Default tags shared by all generated notes.
     */
    protected static tags: Set<string> = new Set([
        AnkiTag.QUIZGEN,
        RenderControlTag.SHOW_CHOICES,
        RenderControlTag.SHOW_SOURCE_FILE,
        RenderControlTag.SHOW_SOURCE_LINE,
        RenderControlTag.SHOW_RANDOMIZED,
        RenderControlTag.SHOW_PROLOGUE,
        RenderControlTag.SHOW_EPILOGUE
    ])

    /**
     * Note identifier.
     */
    public readonly external_uid: string
    /**
     * Note text.
     */
    public readonly text: string
    /**
     * List of tested words.
     */
    public readonly clozes: AnkiCloze[]
    /**
     * Map of tested words to distractors.
     */
    public readonly choices: Map<AnkiCloze, string[]>
    /**
     * Reference to location in source text.
     */
    public readonly source_reference?: SourceReference
    /**
     * Note text translations. Not yet generated.
     */
    public readonly translations?: string
    /**
     * Text from previous neighboring sentence(s).
     */
    public readonly prologue?: string
    /**
     * Text from next neighboring sentence(s).
     */
    public readonly epilogue?: string

    /**
     * Creates note instance
     */
    protected constructor(
        id: string, 
        text: string, 
        clozes: AnkiCloze[], 
        choices: Map<AnkiCloze, string[]>, 
        source_reference?: SourceReference,
        prologue?: string,
        epilogue?: string
    ) {
        this.external_uid = id
        this.text = text
        this.clozes = clozes
        this.choices = choices
        this.source_reference = source_reference
        this.translations = undefined
        this.prologue = prologue
        this.epilogue = epilogue
    }

    public toString(
        note_type: string = '',
        tags: string = '',
        write_stream?: OptionalWriteStream
    ): string|undefined {
        let out: string|undefined
        if (write_stream === undefined) {
            // mock WriteStream api with string buffer
            out = ''
            write_stream = {
                write: function(value: string) {
                    out += value
                }
            }
        }

        // note external id
        write_stream.write(this.external_uid)
        write_stream.write(AnkiNote.SEPARATOR)

        // note type
        write_stream.write(note_type)
        write_stream.write(AnkiNote.SEPARATOR)

        // note tags
        write_stream.write('"')
        write_stream.write(tags)
        if (this.clozes.length === 0) {
            // all candidate words were ignored as not testable
            if (tags.length !== 0) {
                write_stream.write(AnkiNote.SEPARATOR)
            }
            write_stream.write(AnkiTag.NOT_TESTABLE)
        }
        write_stream.write('"')
        write_stream.write(AnkiNote.SEPARATOR)

        // note text
        write_stream.write('"' + AnkiNote.escape_quotes(this.text) + '"')
        write_stream.write(AnkiNote.SEPARATOR)

        // note clozes
        write_stream.write('"<div class=""choices"">\n')
        this.clozes.map((cloze) => {
            write_stream.write(ind + `<div class=""choice choice-${cloze.index}"">\n`)
            write_stream.write(ul_ind + `<ul>\n`)

            // cloze choices
            for (
                let choice of this.choices.get(cloze).concat(cloze.key).sort(sort_random)
            ) {
                write_stream.write(`${el_ind}<li>${AnkiNote.escape_quotes(choice)}</li>\n`)
            }

            write_stream.write(ul_ind + `</ul>\n`)
            write_stream.write(ind + `</div>\n`)
        })
        write_stream.write('</div>"')
        write_stream.write(AnkiNote.SEPARATOR)

        // note source file
        if (this.source_reference !== undefined) {
            write_stream.write(`"${this.source_reference.file}"`)
        }
        write_stream.write(AnkiNote.SEPARATOR)

        // note source line
        if (this.source_reference !== undefined) {
            write_stream.write(`"${this.source_reference.line_number}"`)
        }
        write_stream.write(AnkiNote.SEPARATOR)

        // note translations
        if (this.translations !== undefined) {
            write_stream.write(`"${this.translations}"`)
        }
        write_stream.write(AnkiNote.SEPARATOR)

        // prologue
        if (this.prologue !== undefined) {
            write_stream.write(`"${this.prologue}"`)
        }
        write_stream.write(AnkiNote.SEPARATOR)

        // epilogue
        if (this.epilogue !== undefined) {
            write_stream.write(`"${this.epilogue}"`)
        }

        return out
    }

    public toJSON(): {[key: string]: any} {
        let view = {}

        for (let [key, val] of Object.entries(this)) {
            if (key === 'choices') {
                view[key] = {}
                for (let [c_key, c_val] of this.choices.entries()) {
                    view[key][c_key] = c_val
                }
            }
            else {
                view[key] = val
            }
        }

        return view
    }

    /**
     * Generate anki note from parsed sentence.
     * 
     * @param sentence Sentence/excerpt containing words for a single note.
     * @param word_frequency_min Minimum testable word frequency.
     * @param word_length_min Minimum testable word length.
     * @param words_kept Set of word key strings that are allowed/white-listed for testing.
     * @returns Note instance.
     */
    public static from_sentence(
        sentence: Sentence, 
        word_frequency_min?: number, 
        word_length_min?: number, 
        words_kept?: Set<string>,
        before_token_count?: number,
        after_token_count?: number,
        choice_variation?: number|Percentage
    ) {
        let text: string[] = []
        let clozes: AnkiCloze[] = []
        /**
         * Map test words (clozes) to distractors.
         */
        let choices: Map<AnkiCloze, string[]> = new Map()
        let cloze_idx: number = 1
        let token_idx: number = 0

        let _choice_variation: number 
        if (choice_variation instanceof Percentage) {
            _choice_variation = choice_variation.get_proportion()
        }
        else {
            _choice_variation = choice_variation
        }

        for (let token of sentence.get_tokens()) {
            if (token instanceof Word) {
                let raw_string = token.get_raw_string({
                    sentence: sentence,
                    token_in_sentence: token_idx
                })

                if (
                    (word_frequency_min === undefined || token.get_frequency() >= word_frequency_min)
                    && (word_length_min === undefined || token.key_string.length >= word_length_min)
                    && (words_kept === undefined || words_kept.has(token.key_string))
                ) {
                    // word is testable; generate cloze
                    // console.log(`debug ${token} is testable`)
                    let cloze = new AnkiCloze(
                        cloze_idx, 
                        raw_string, 
                        token.key_string
                    )
                    text.push(cloze.toString())
                    clozes.push(cloze)
                    cloze_idx++

                    // generate distractor choices, leaving 1 spot for the correct choice
                    // console.log(`debug ${cloze.key} closest words = ${token.get_closest_words(this.CHOICES_MAX)}`)
                    choices.set(cloze, token.get_closest_words(this.CHOICES_MAX-1, _choice_variation))
                }
                else {
                    // word is not testable; revert to plain token
                    // console.log(`debug ${token} is not testable`)
                    text.push(raw_string)
                }
            }
            else {
                text.push(token)
            }

            // increment token index
            token_idx++
        }

        const source_reference: SourceReference|undefined = (
            sentence.source === undefined ? undefined : {
            file: sentence.source,
            line_number: sentence.index
        })

        return new AnkiNote(
            AnkiNote.generate_id(source_reference, sentence.toString()),
            text.join(' '), 
            clozes, 
            choices,
            source_reference,
            before_token_count !== undefined ? sentence.get_prologue(before_token_count) : undefined,
            after_token_count !== undefined ? sentence.get_epilogue(after_token_count) : undefined
        )
    }

    /**
     * Generate anki notes file header.
     * 
     * @param notes_count Number of notes that will be exported below the header.
     * @param write_stream Optional write stream to use instead of string variable.
     * @param opts All quizgen entrypoint options used for generating these anki notes.
     * @returns Header string if `write_stream` is `undefined`.
     */
    public static header(
        notes_count: number,
        write_stream?: OptionalWriteStream,
        opts?: OptArgv
    ): string|undefined {
        let out: string|undefined
        if (write_stream === undefined) {
            // mock WriteStream api with string buffer
            out = ''
            write_stream = {
                write: function(value: string) {
                    out += value
                }
            }
        }

        // comments
        write_stream.write(
            `# ${notes_count} notes generated with`
            + ` [quizcard-generator](https://github.com/ogallagher/quizcard-generator)\n`
        )
        write_stream.write(
            `# author date = ${new Date().toISOString()}\n`
        )
        write_stream.write(
            '# columns = ' + [
                'euid', 'notetype', 'tags',
                'text', 'choices',
                'source-file', 'source-line',
                'translations',
                'prologue', 'epilogue'
            ] + '\n'
        )
        write_stream.write(
            '# quizgen opts = ' + (
                opts === undefined 
                    ? '' 
                    : Object.entries(opts).map(([key, val]) => {
                        if (key === OPT_INPUT_FILE_CONTENT) {
                            // do not show entire source text
                            return `--${key}="${val.substring(0, 128).replace(/\n/g, ' ')}..."`
                        }
                        else if (Array.isArray(val)) {
                            if (val.length === 0) {
                                return undefined
                            }
                            else {
                                return val.map((vi) => {
                                    return `--${key}=${vi}`
                                })
                                .join(' ')
                            }
                        }
                        else if (typeof val === 'string') {
                            return `--${key}="${val}"`
                        }
                        else {
                            return `--${key}=${val}`
                        }
                    })
                    .filter((key_val) => key_val !== undefined)
                    .join(' ')
            ) + '\n'
        )

        // metadata
        write_stream.write(
            `#separator:${AnkiNote.SEPARATOR_NAME}\n`
            + `#html:true\n`
            // euid is not same as anki guid column, so do not mention here
            + `#notetype column:2\n`
            + `#tags column:3\n`
        )

        return out
    }

    /**
     * Create Anki notes file at `<file_dir>/<file_name>.txt`, or 
     * `out/anki/notes/<note_type>.txt` by default.
     * 
     * @param notes 
     * @param file_name 
     * @param file_dir 
     * @param note_type 
     * @param tags 
     * @returns 
     */
    public static export(
        notes: AnkiNote[],  
        file_name: string = AnkiNote.OUT_NAME_DEFAULT,
        file_dir?: string,
        note_type: string = 'fill-blanks',
        tags: string[] = [],
        opts?: OptArgv
    ): Promise<number> {
        const out_dir = (file_dir !== undefined) ? file_dir : `out/anki/notes/${note_type}`
        const out_file = `${file_name}.txt`

        return new Promise<void>(function(res, rej) {
            fs.mkdir(
                out_dir, { recursive: true}, (err) => {
                    if (err) {
                        rej(err)
                    }
                    else {
                        res()
                    }
                }
            )
        })
        .then(() => {
            const write_stream = fs.createWriteStream(path.join(out_dir, out_file), {
                encoding: 'utf-8'
            })

            this.header(notes.length, write_stream, opts)
            
            const tags_set = new Set(AnkiNote.tags)
            tags_set.add(file_name)
            const tags_str: string = tags.concat(...tags_set.values()).join(AnkiNote.SEPARATOR)
            console.log(`info supplied tags string = ${tags_str}`)

            // notes
            for (let note of notes) {
                note.toString(note_type, tags_str, write_stream)
                
                // end note
                write_stream.write('\n')
            }
            write_stream.end()
            
            return new Promise(function(res) {
                write_stream.close(() => {
                    console.log(`info exported to ${path.join(out_dir, out_file)}`)
                    res(write_stream.bytesWritten)
                })
            })
        })
        
    }

    /**
     * Uniquely identify this note by source reference, or by a text hash if the source
     * reference is unknown.
     * 
     * Note this reference derivation is currently a combination of a file path/url and a line number. 
     * If either of these two attributes changes, the id will change.
     * 
     * @param text The text content (may be transformed/normalized) of this note.
     * @param source_reference Reference to the source from which this note was generated.
     */
    public static generate_id(source_reference: SourceReference|undefined, text: string) {
        const hash = createHash('sha256')

        if (source_reference === undefined) {
            // hash of text
            hash.update(text)
        }
        else {
            // hash of source reference
            hash.update(source_reference.file + '#' + source_reference.line_number)
        }

        return hash.digest('hex')
    }

    public static escape_quotes(text: string) {
        return text.replace(/\"/g, '""')
    }

    public static get_choices_max(): number {
        return AnkiNote.CHOICES_MAX
    }

    public static set_choices_max(choices_max: number|undefined) {
        if (choices_max !== undefined) {
            console.log(`info max choices = ${AnkiNote.CHOICES_MAX}`)
            AnkiNote.CHOICES_MAX = choices_max
        }
    }
}

class AnkiCloze {
    /**
     * Use token key excludes pattern as equivalent to non word characters.
     */
    private static regexp_value_exclude = regexp_word_exclude
    index: number
    value: string
    key: string
    hint?: string

    constructor(index: number, value: string, key: string, hint?: string) {
        this.index = index
        this.value = value
        this.key = key
        this.hint = hint
    }

    public toString() {
        const hint_suffix = (this.hint !== undefined) ? `:${this.hint}` : ''
        
        // exclude non word characters from value to be guessed
        let nonword_match = this.value.match(AnkiCloze.regexp_value_exclude)
        let nonword_prefix = '', nonword_suffix = ''
        if (nonword_match !== null) {
            nonword_prefix = nonword_match[0]
            if (!this.value.startsWith(nonword_prefix)) {
                // first match is not prefix
                nonword_prefix = ''
            }
            
            if (nonword_match.length > 1) {
                nonword_suffix = nonword_match.slice(-1)[0]
                if (!this.value.endsWith(nonword_suffix)) {
                    // last match is not suffix
                    nonword_suffix = ''
                }
            }
        }
        let word_value = this.value.substring(
            nonword_prefix.length,
            this.value.length - nonword_suffix.length
        )
        
        return `${nonword_prefix}{{c${this.index}::${word_value}${hint_suffix}}}${nonword_suffix}`
    }
}