import * as assert from 'assert'
import { describe, before, it } from 'mocha'
import { Word } from './quizcard_generator'

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
                for (let [a, b, dist] of word_pairs) {
                    actual_dist = Word.edit_distance(
                        new Word(a, a),
                        new Word(b, b)
                    )

                    assert.equal(
                        actual_dist, 
                        dist, 
                        `got unexpected distance ${actual_dist} != ${dist} for ${a},${b}`
                    )
                }
            })
        })
    })
})