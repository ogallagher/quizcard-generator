//  {% from "./const.njk" import 
//      id_console_out, id_console_container,
//      cl_prologue, cl_epilogue
//  %}
// {% include './tags.js' %}

let console_logs = []
const card = document.getElementsByClassName('.card')[0]

// parse tags including render control
const tags = parse_tags(card)
console_logs.push(`tags = ${tags.join(', ')}`)

// parse the cloze ordinal to select the corresponding choices
let active_cloze = card.getElementsByClassName('cloze')[0]
let active_cloze_idx = active_cloze.getAttribute('data-ordinal')
console_logs.push(`active cloze = ${active_cloze.outerHTML}`)
console_logs.push(`active cloze index = ${active_cloze_idx}`)

let active_choice = card.getElementsByClassName(`choice-${active_cloze_idx}`)[0]
if (active_choice !== undefined) {
    if (tags.has('show-choices')) {
        console_logs.push('show choices')

        // shuffle active choice list
        if (tags.has('show-randomized')) {
            console_logs.push('shuffle choices')
            let children = [...active_choice.childNodes].sort(() => Math.round(Math.random() * 2) - 1)
            active_choice.replaceChildren(...children)
        }

        // show choice list
        active_choice.classList.add('active')
        console_logs.push(`active choice = ${active_choice.outerHTML}`)
    }
    else {
        console_logs.push('hide choices')
    }
}
else {
    // show choices missing message
    card.getElementsByClassName('choices')[0].innerHTML = (
        `<div class="text-left">no choices for cloze ${active_cloze_idx}</div>`
    )
}

// show source file, source line
if (tags.has('show-source-file')) {
    console_logs.push('show source file')
    card.getElementsByClassName('{{cl_source_file}}')[0].classList.add('active')
}
if (tags.has('show-source-line')) {
    console_logs.push('show source line number')
    card.getElementsByClassName('{{cl_source_line}}')[0].classList.add('active')
}

// show prologue, epilogue
if (tags.has('show-prologue')) {
    /**
     * @type {HTMLSpanElement}
     */
    const prologue_el = card.getElementsByClassName('{{cl_prologue}}')[0]
    if (prologue_el.innerText.trim().length !== 0) {
        console_logs.push('show prologue')
        prologue_el.classList.add('active')
    }
    else {
        console_logs.push('prologue empty')
    }
}
if (tags.has('show-epilogue')) {
    /**
     * @type {HTMLSpanElement}
     */
    const epilogue_el = card.getElementsByClassName('{{cl_epilogue}}')[0]
    if (epilogue_el.innerText.trim().length !== 0) {
        console_logs.push('show epilogue')  
        epilogue_el.classList.add('active') 
    }
    else {
        console_logs.push('epilogue empty')
    }
}

// TODO load translation of text here?

// enable console
if (tags.has('show-logging')) {
    console_logs.push('show console logs')

    /**
     * @type {HTMLElement}
     */
    let console_out = card.getElementById('{{id_console_out}}')
    console_out.innerText = console_logs.join('\n')

    /**
     * @type {HTMLElement}
     */
    const console_container = card.getElementById('{{id_console_container}}')
    console_container.classList.add('active')
}