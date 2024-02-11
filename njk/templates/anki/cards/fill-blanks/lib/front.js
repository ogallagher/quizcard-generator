// {% from "./const.njk" import id_console_out %}
// parse the cloze ordinal to select the corresponding choices
let active_cloze = document.getElementsByClassName('cloze')[0]
let active_cloze_idx = active_cloze.getAttribute('data-ordinal')
let console_logs = []
console_logs.push(`active cloze = ${active_cloze.outerHTML}`)
console_logs.push(`active cloze index = ${active_cloze_idx}`)

let active_choice = document.getElementsByClassName(`choice-${active_cloze_idx}`)[0]
if (active_choice !== undefined) {
    active_choice.classList.add('active')
    console_logs.push(`active choice = ${active_choice.outerHTML}`)
}
else {
    document.getElementsByClassName('choices')[0].innerHTML = (
    `<div class="text-left">no choices for cloze ${active_cloze_idx}</div>`
    )
}

// TODO load translation of text here?

let console_out = document.getElementById('{{id_console_out}}')
console_out.innerText = console_logs.join('\n')