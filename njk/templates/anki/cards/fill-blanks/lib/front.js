/*
{% from "./const.njk" import 
    id_console_out, id_console_container,
    cl_prologue, cl_epilogue,
    cl_source_file, cl_source_line
%}
*/
{% include './tags.js' %}

let console_logs = []
const card_container = document

// parse tags including render control
const tags = parse_tags(card_container)
console_logs.push(`tags = ${[...tags.values()].join(', ')}`)

// parse the cloze ordinal to select the corresponding choices
let active_cloze = card_container.getElementsByClassName('cloze')[0]
let active_cloze_idx = active_cloze.getAttribute('data-ordinal')
console_logs.push(`active cloze = ${active_cloze.outerHTML}`)
console_logs.push(`active cloze index = ${active_cloze_idx}`)

let active_choice = card_container.getElementsByClassName(`choice-${active_cloze_idx}`)[0]
if (active_choice !== undefined) {
    if (tags.has('qg-show-choices')) {
        console_logs.push('show choices')

        // shuffle active choice list
        if (tags.has('qg-show-randomized')) {
            console_logs.push('shuffle choices')
            let children = [...active_choice.getElementsByTagName('li')]
            children.sort(() => Math.round(Math.random() * 2) - 1)
            let parent_list = active_choice.getElementsByTagName('ul')[0]
            parent_list.innerHTML = ''
            children.forEach((child) => parent_list.appendChild(child))
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
    card_container.getElementsByClassName('choices')[0].innerHTML = (
        `<div class="text-left">no choices for cloze ${active_cloze_idx}</div>`
    )
}

// show source file, source line
if (tags.has('qg-show-source-file')) {
    console_logs.push('show source file')
    card_container.getElementsByClassName('{{cl_source_file}}')[0].classList.add('active')
}
else {
    card_container.getElementsByClassName('{{cl_source_file}}')[0].classList.remove('active')
}
if (tags.has('qg-show-source-line')) {
    console_logs.push('show source line number')
    card_container.getElementsByClassName('{{cl_source_line}}')[0].classList.add('active')
}
else {
    card_container.getElementsByClassName('{{cl_source_line}}')[0].classList.remove('active')
}

// show prologue, epilogue
/**
 * @type {HTMLSpanElement}
 */
const prologue_el = card_container.getElementsByClassName('{{cl_prologue}}')[0]
if (tags.has('qg-show-prologue')) {
    if (prologue_el.innerText.trim().length !== 0) {
        console_logs.push('show prologue')
        prologue_el.classList.add('active')
    }
    else {
        console_logs.push('prologue empty')
    }
}
else {
    prologue_el.classList.remove('active')
}
 /**
 * @type {HTMLSpanElement}
 */
const epilogue_el = card_container.getElementsByClassName('{{cl_epilogue}}')[0]
if (tags.has('qg-show-epilogue')) {
    if (epilogue_el.innerText.trim().length !== 0) {
        console_logs.push('show epilogue')  
        epilogue_el.classList.add('active') 
    }
    else {
        console_logs.push('epilogue empty')
    }
}
else {
    epilogue_el.classList.remove('active')
}

// TODO load translation of text here?

// enable console
if (tags.has('qg-show-logging')) {
    console_logs.push('show console logs')

    /**
     * @type {HTMLElement}
     */
    let console_out = card_container.getElementById('{{id_console_out}}')
    console_out.innerText = console_logs.join('\n')

    /**
     * @type {HTMLElement}
     */
    const console_container = card_container.getElementById('{{id_console_container}}')
    console_container.classList.add('active')
}