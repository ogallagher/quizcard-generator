/*
{% from './const.njk' import cl_tags %}
*/

/**
 * @param {HTMLDivElement} card_el
 * @returns {Set<string>} 
 */
function parse_tags(card_el) {
    const tags_el = card_el.getElementsByClassName('{{cl_tags}}')[0]
    const tags_arr = tags_el.innerHTML.trim().split(/\s+/)
    const tags = new Set()
    tags_arr.forEach((t) => {
        tags.add(t)
    })
    return tags
}