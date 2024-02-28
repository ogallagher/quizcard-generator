import * as assert from 'assert'
import { describe, before, it } from 'mocha'
import { Word, QuizCardGenerator, WordEditDistance } from '../quizcard_generator'

describe('quizcard_generator', function() {
    describe('Word', function() {
        describe('edit_distance', function() {
            let word_pairs: [string, string, number][] = [
                ['acorn', 'acorns', 1],
                ['acorn', 'corn', 1],
                ['acorn', 'o', 4],
                ['acorn', 'horn', 2],
                ['horn', 'acorn', 2],
                ['개미', '거미', 1],
                ['도토리', '토', 2],
                ['도토리', '도t리', 1]
            ]

            it('is correct', function() {
                let actual_dist: WordEditDistance
                let wa: Word, wb: Word
                for (let [a, b, dist] of word_pairs) {
                    wa = new Word(a, a)
                    wb = new Word(b, b)
                    actual_dist = Word.edit_distance(
                        wa,
                        wb
                    )

                    assert.strictEqual(
                        actual_dist.distance, 
                        dist, 
                        `got unexpected distance ${actual_dist} != ${dist} for ${a},${b}`
                    )
                    assert.strictEqual(wa.get_distance(wb).distance, dist)
                    assert.strictEqual(wb.get_distance(wa).distance, dist)
                    assert.strictEqual(wa.get_distance(wb), wa.get_distance(b))
                    assert.deepStrictEqual(wa.get_words_at_distance(dist), [b])
                }

                assert.equal(wa.get_distance('missing'), undefined)
            })

            it('fetches words at distance', function() {
                let wa = new Word(word_pairs[0][0], word_pairs[0][0].toUpperCase())
                let wb = new Word(word_pairs[0][1], word_pairs[0][1].toUpperCase())
                Word.edit_distance(wa, wb)

                assert.deepStrictEqual(wa.get_words_at_distance(1), [wb.key_string])
            })

            it('fetches nearest words', function() {
                let wa = new Word(word_pairs[0][0], word_pairs[0][0].toUpperCase())
                let wb = new Word(word_pairs[0][1], word_pairs[0][1].toUpperCase())
                Word.edit_distance(wa, wb)

                let wc = new Word(word_pairs[1][1], word_pairs[1][1].toUpperCase())
                Word.edit_distance(wa, wc)

                assert.deepStrictEqual(
                    wa.get_closest_words(1), 
                    [wb.key_string],
                    `error failed to get closest words to ${JSON.stringify(wa)}`
                )
            })
        })
    })

    describe.skip('Sentence', function() {

    })

    describe('QuizCardGenerator', function() {
        let qg = new QuizCardGenerator(
            `1apple1 2banana2?
            2BA'N'ANA3 3cinnamon4 2baNANa5 4cherry6 1apple7.`,
            undefined, undefined,
            3, 5
        )

        it('follows sentence token count min,max', function() {
            assert.strictEqual(
                qg.get_sentence(0).get_token_count(), 
                5, 
                `first sentence should combine the first 2 words and next 1 word, `
                + `because first grammatical sentence word count < ${qg.sentence_word_count_min}, `
                + `and first + second grammatical sentences length=7 > ${qg.sentence_token_count_max} `
                + `and second sentence does not introduce unique word 3 until token 4`
            )
        })

        describe('Word.get_raw_string', function() {
            it('returns correct raw string by location', function() {
                // TODO fix log indentation with this.currentTest.titlePath.length
                console.log(`debug given sentence word count min is ${qg.sentence_word_count_min}`)
                let sentence = qg.get_sentence(0)

                assert.strictEqual('2banana2?', qg.get_word('banana')?.get_raw_string({
                    sentence: sentence,
                    token_in_sentence: 1
                }))

                assert.strictEqual("2BA'N'ANA3", qg.get_word('banana')?.get_raw_string({
                    sentence,
                    token_in_sentence: 2
                }))
            })
        })

        describe('calculate_stats', function() {
            // TODO why does this not work?
            // before(function() {
            //     return qg.finish_calculation
            // })

            it('counts correct frequencies', function() {
                qg.finish_calculation.then(() => {
                    assert.strictEqual(qg.get_word('banana').get_frequency(), 2)
                    assert.strictEqual(qg.get_word('cinnamon').get_frequency(), 1)
                })
            })

            it('generates correct edit distances', function() {
                qg.finish_calculation.then(() => {
                    assert.strictEqual(
                        qg.get_word('apple').get_distance('banana'),
                        5
                    )
                })
            })

            it('returns highest and lowest frequencies', function() {
                qg.finish_calculation.then(() => {
                    assert.deepStrictEqual(qg.get_words_by_frequency(2, true), ['banana', 'apple'])
                    assert.deepStrictEqual(qg.get_words_by_frequency(2, false), ['apple', 'cinnamon'])
                    assert.deepStrictEqual(qg.get_words_by_frequency(10, false), qg.get_words_by_frequency(3, true))
                })
            })
        })

        describe('generate_anki_notes', function() {
            it('excludes non word chars from clozes', function() {
                let notes = qg.generate_anki_notes(
                    undefined,
                    1, 1,
                    undefined, undefined,
                    2, 2,
                    '0%'
                )
                
                assert.strictEqual(
                    notes.length, 2,
                    'source text should be parsed as 2 sentences -> 2 notes'
                )
                
                let banana3_cloze = notes[0].clozes[2]
                assert.strictEqual(
                    banana3_cloze.toString(),
                    "2{{c3::BA'N'ANA}}3",
                    `cloze for ${JSON.stringify(banana3_cloze)} should exclude `
                    + `non word edgechars from inner text, keeping inner apostrophes`
                )
                
                let cherry6_cloze = notes[1].clozes[0]
                assert.strictEqual(
                    cherry6_cloze.toString(),
                    '4{{c1::cherry}}6',
                    `cloze for ${JSON.stringify(cherry6_cloze)} should exclude `
                    + `non word edge chars from inner text`
                )
            })
        })
    })
})