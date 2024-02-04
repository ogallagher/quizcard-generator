import * as assert from 'assert'
import { describe, before, it } from 'mocha'
import { Word, QuizCardGenerator } from '../quizcard_generator'

describe('quizcard_generator', function() {
    describe('Word', function() {
        describe('edit_distance', function() {
            let word_pairs: [string, string, number][] = [
                ['acorn', 'acorns', 1],
                ['acorn', 'corn', 1],
                ['acorn', 'o', 4],
                ['acorn', 'horn', 2],
                ['horn', 'acorn', 2]
            ]

            it('is correct', function() {
                let actual_dist: number
                let wa: Word, wb: Word
                for (let [a, b, dist] of word_pairs) {
                    wa = new Word(a, a)
                    wb = new Word(b, b)
                    actual_dist = Word.edit_distance(
                        wa,
                        wb
                    )

                    assert.strictEqual(
                        actual_dist, 
                        dist, 
                        `got unexpected distance ${actual_dist} != ${dist} for ${a},${b}`
                    )
                    assert.strictEqual(wa.get_distance(wb), dist)
                    assert.strictEqual(wb.get_distance(wa), dist)
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
            `apple banana?
            BA'N'ANA cinnamon`
        )

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
        })

        describe.skip('generate_anki_notes', function() {

        })
    })
})