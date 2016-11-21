
let bnf = BNF.template

let myDslGrammar = bnf`

file --> NL file
      | file NL
      | file blankLines script
      | script

blankLines --> NL NL
            | blankLines NL

script => cm_string

cm_string => 'hello' cm_keyword 'world'
           | '1'

cm_keyword => 'sweet'
            | 'happy'

int --> /[0-9]+/        ${parseInt}

NL --> '\n'
SEP --> ' '
      | NL
`

var cmOptions = {
  value: "",
  mode: {
    name: 'lately',
    grammar: myDslGrammar,
    highlight: tag => /^cm_/.test(tag) ? tag.slice(3) : '',
  },
  extraKeys: {'Ctrl-Space': 'autocomplete'},

  indentUnit: 3,
  smartIndent: true,
  tabSize: 3,
  indentWithTabs: true,

  lineWrapping: true,
  dragDrop: false,
  cursorScrollMargin: 80,

  lineNumbers: true,
  // TODO show errors
  //gutters: ['CodeMirror-linenumbers', 'errors'],

  cursorHeight: 1,

  undoDepth: NaN,
}


CodeMirror.commands.autocomplete = function(cm) {
  cm.showHint({ hint: CodeMirror.hint.lately })
}

var editor = CodeMirror(document.querySelector('.editor'), cmOptions)

this.editor.setValue(
`hello sweet world

hello happy world
`
)

// TODO layout editor on window resize

