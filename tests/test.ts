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
                ['horn', 'acorn', 2],
                ['개미', '거미', 1],
                ['도토리', '토', 2],
                ['도토리', '도t리', 1]
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
            BA'N'ANA cinnamon baNANa. apple.`,
            undefined, undefined,
            4
        )

        it('follows sentence token count min,max', function() {
            assert.strictEqual(
                qg.get_sentence(0).get_token_count(), 
                4, 
                `first sentence should combine the first 2 words and subsequent 4 words, because first grammatical sentence length < ${qg.sentence_word_count_min}, `
                + `and first + second grammatical sentences length=5 > ${qg.sentence_token_count_max}`
            )
        })

        describe('Word.get_raw_string', function() {
            it('returns correct raw string by location', function() {
                // TODO fix log indentation with this.currentTest.titlePath.length
                console.log(`debug given sentence word count min is ${qg.sentence_word_count_min}`)
                let sentence = qg.get_sentence(0)

                assert.strictEqual('banana?', qg.get_word('banana')?.get_raw_string({
                    sentence: sentence,
                    token_in_sentence: 1
                }))

                assert.strictEqual("BA'N'ANA", qg.get_word('banana')?.get_raw_string({
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

        describe.skip('generate_anki_notes', function() {

        })
    })
})