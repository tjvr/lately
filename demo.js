
let bnf = BNF.template

let myDslGrammar = bnf`

file --> NL file                  ${(a, b) => b}
      | file NL                   ${(a, b) => a}
      | file blankLines script    ${(a, b, c) => a.concat([c])}
      | script                    ${a => [a]}

blankLines --> NL NL
            | blankLines NL

script => cm_string               ${a => a}

cm_string => 'hello' cm_keyword 'world'   ${function() { return ['hello:world', arguments[3]] }}
           | '1'

cm_keyword => 'sweet'       ${() => ['sweetConstant']}
            | 'happy'       ${() => ['happyConstant']}

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

function compile() {
  let result = this.editor.getMode()._completer.parse(this.editor.getValue())
  console.log(JSON.stringify(result))
  return result
}

// TODO layout editor on window resize

