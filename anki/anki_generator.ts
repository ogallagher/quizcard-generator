/**
 * Integration of quiz card generator output with Anki.
 */

import { Sentence, Word } from '../quizcard_generator'
import * as fs from 'fs'
import * as path from 'node:path'

export class AnkiNote {
    public static readonly CHOICES_MAX = 4
    protected static readonly SEPARATOR_NAME = 'tab'
    protected static readonly SEPARATOR = '\t'
    protected static readonly NOTE_TYPE_COL = 1
    public static readonly OUT_NAME_DEFAULT = 'notes'

    protected static tags: Set<string> = new Set(['quizcard-generator'])

    public readonly text: string
    public readonly clozes: AnkiCloze[]
    public readonly choices: Map<AnkiCloze, string[]>

    protected constructor(text: string, clozes: AnkiCloze[], choices: Map<AnkiCloze, string[]>) {
        this.text = text
        this.clozes = clozes
        this.choices = choices
    }

    public static from_sentence(s: Sentence) {
        let text: string[] = []
        let clozes: AnkiCloze[] = []
        let choices: Map<AnkiCloze, string[]> = new Map()
        let cloze_idx: number = 1

        for (let token of s.get_tokens()) {
            if (token instanceof Word) {
                // generate cloze
                let cloze = new AnkiCloze(cloze_idx, token.raw_string, token.key_string)
                text.push(cloze.toString())
                clozes.push(cloze)
                cloze_idx++

                // generate choices
                console.log(`debug ${cloze.key} closest words = ${token.get_closest_words(this.CHOICES_MAX)}`)
                choices.set(cloze, token.get_closest_words(this.CHOICES_MAX))
            }
            else {
                text.push(token)
            }
        }

        return new AnkiNote(text.join(' '), clozes, choices)
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

            // metadata
            write_stream.write(
                `#separator:${AnkiNote.SEPARATOR_NAME}\n`
                + `#html:true\n`
                + `#notetype column:1\n`
                + `#tags column:2\n`
            )
            AnkiNote.tags.add(file_name)
            const tags: string = [...AnkiNote.tags.values()].join(AnkiNote.SEPARATOR)

            // notes
            const ind = '  '
            const ul_ind = ind + ind
            const el_ind = ind + ind + ind
            for (let note of notes) {
                // note type
                write_stream.write(note_type)
                write_stream.write(AnkiNote.SEPARATOR)

                // note tags
                write_stream.write('"' + tags + '"')
                write_stream.write(AnkiNote.SEPARATOR)

                // note text
                write_stream.write('"' + note.text + '"')
                write_stream.write(AnkiNote.SEPARATOR)

                // note clozes
                write_stream.write('"<div class=""choices"">\n')
                note.clozes.map((cloze) => {
                    write_stream.write(ind + `<div class=""choice-${cloze.index}"">\n`)
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

                // end note
                write_stream.write('\n')
            }
            write_stream.end()

            console.log(`info exported to ${path.join(out_dir, out_file)}`)

            return write_stream.bytesWritten
        })
        
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