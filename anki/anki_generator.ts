/**
 * Integration of quiz card generator output with Anki.
 */

import { createHash } from 'crypto'
import { Sentence, Word } from '../quizcard_generator'
import * as fs from 'fs'
import * as path from 'node:path'

interface SourceReference {file: string, line_number: number}

export class AnkiNote {
    /**
     * Max number of options from which to choose the correct answer.
     */
    protected static CHOICES_MAX = 4
    protected static readonly SEPARATOR_NAME = 'tab'
    protected static readonly SEPARATOR = '\t'
    public static readonly OUT_NAME_DEFAULT = 'notes'
    protected static readonly TAG_NOT_TESTABLE = 'not-testable'
    /**
     * A word must be at least this long to be testable.
     */
    public static readonly WORD_LENGTH_MIN_DEFAULT: number = 2

    protected static tags: Set<string> = new Set(['quizcard-generator'])

    public readonly external_uid: string
    public readonly text: string
    public readonly clozes: AnkiCloze[]
    public readonly choices: Map<AnkiCloze, string[]>
    public readonly source_reference?: SourceReference
    public readonly translations?: string

    protected constructor(id: string, text: string, clozes: AnkiCloze[], choices: Map<AnkiCloze, string[]>, source_reference?: SourceReference) {
        this.external_uid = id
        this.text = text
        this.clozes = clozes
        this.choices = choices
        this.source_reference = source_reference
        this.translations = undefined
    }

    /**
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
        words_kept?: Set<string>
    ) {
        let text: string[] = []
        let clozes: AnkiCloze[] = []
        let choices: Map<AnkiCloze, string[]> = new Map()
        let cloze_idx: number = 1

        for (let token of sentence.get_tokens()) {
            if (token instanceof Word) {
                if (
                    (word_frequency_min === undefined || token.get_frequency() >= word_frequency_min)
                    && (word_length_min === undefined || token.key_string.length >= word_length_min)
                    && (words_kept === undefined || words_kept.has(token.key_string))
                ) {
                    // word is testable; generate cloze
                    // console.log(`debug ${token} is testable`)
                    let cloze = new AnkiCloze(cloze_idx, token.raw_string, token.key_string)
                    text.push(cloze.toString())
                    clozes.push(cloze)
                    cloze_idx++

                    // generate choices
                    // console.log(`debug ${cloze.key} closest words = ${token.get_closest_words(this.CHOICES_MAX)}`)
                    choices.set(cloze, token.get_closest_words(this.CHOICES_MAX))
                }
                else {
                    // word is not testable; revert to plain token
                    // console.log(`debug ${token} is not testable`)
                    text.push(token.raw_string)
                }
            }
            else {
                text.push(token)
            }
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
            source_reference
        )
    }

    public static export(
        notes: AnkiNote[],  
        file_name: string = AnkiNote.OUT_NAME_DEFAULT,
        file_dir?: string,
        note_type: string = 'fill-blanks',
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

            // comments
            write_stream.write(
                `# ${notes.length} notes generated with`
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
                    'translations'
                ] + '\n'
            )

            // metadata
            write_stream.write(
                `#separator:${AnkiNote.SEPARATOR_NAME}\n`
                + `#html:true\n`
                // euid is not same as anki guid column, so do not mention here
                + `#notetype column:2\n`
                + `#tags column:3\n`
            )
            AnkiNote.tags.add(file_name)
            const tags: string = [...AnkiNote.tags.values()].join(AnkiNote.SEPARATOR)

            // notes
            const ind = '  '
            const ul_ind = ind + ind
            const el_ind = ind + ind + ind
            for (let note of notes) {
                // note external id
                write_stream.write(note.external_uid)
                write_stream.write(AnkiNote.SEPARATOR)

                // note type
                write_stream.write(note_type)
                write_stream.write(AnkiNote.SEPARATOR)

                // note tags
                write_stream.write('"')
                write_stream.write(tags)
                if (note.clozes.length === 0) {
                    // all candidate words were ignored as not testable
                    write_stream.write(AnkiNote.SEPARATOR + AnkiNote.TAG_NOT_TESTABLE)
                }
                write_stream.write('"')
                write_stream.write(AnkiNote.SEPARATOR)

                // note text
                write_stream.write('"' + note.text + '"')
                write_stream.write(AnkiNote.SEPARATOR)

                // note clozes
                write_stream.write('"<div class=""choices"">\n')
                note.clozes.map((cloze) => {
                    write_stream.write(ind + `<div class=""choice choice-${cloze.index}"">\n`)
                    write_stream.write(ul_ind + `<ul>\n`)

                    // cloze choices
                    for (
                        let choice of note.choices.get(cloze).concat(cloze.key).sort(sort_random)
                    ) {
                        write_stream.write(`${el_ind}<li>${choice}</li>\n`)
                    }

                    write_stream.write(ul_ind + `</ul>\n`)
                    write_stream.write(ind + `</div>\n`)
                })
                write_stream.write('</div>"')
                write_stream.write(AnkiNote.SEPARATOR)

                // note source file
                if (note.source_reference !== undefined) {
                    write_stream.write(`"${note.source_reference.file}"`)
                }
                write_stream.write(AnkiNote.SEPARATOR)

                // note source line
                if (note.source_reference !== undefined) {
                    write_stream.write(`"${note.source_reference.line_number}"`)
                }
                write_stream.write(AnkiNote.SEPARATOR)

                // note translations
                if (note.translations !== undefined) {
                    write_stream.write(`"${note.translations}"`)
                }

                // end note
                write_stream.write('\n')
            }
            write_stream.end()

            console.log(`info exported to ${path.join(out_dir, out_file)}`)

            return write_stream.bytesWritten
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
}

class AnkiCloze {
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
        return `{{c${this.index}::${this.value}${hint_suffix}}}`
    }
}

function sort_random() {
    return (Math.random() * 2) - 1
}