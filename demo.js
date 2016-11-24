
let bnf = BNF.template

let myDslGrammar = bnf`

file --> NL file                  ${(a, b) => b}
      | file NL                   ${(a, b) => a}
      | file blankLines script    ${(a, b, c) => a.concat([c])}
      | script                    ${a => [a]}

blankLines --> NL NL
            | blankLines NL

script => cheese                  ${a => a}

cheese => 'hello' foo 'world'     ${function() { return ['hello:world', arguments[3]] }}
       | '1'

foo --> thing                     ${a => a}
      | thing2                    ${a => a}
      | op                        ${a => a}

thing => 'sweet'                  ${() => ['sweetConstant']}
       | 'happy'                  ${() => ['happyConstant']}

thing2 => 'swe'                   ${() => ['shortConst']}

op => 'really' foo                ${(a, b) => ['really', b]}

op => foo 'and' foo               ${(a, b, c) => ['+', a, c]}

int --> /[0-9]+/                  ${parseInt}

NL --> '\n'
SEP --> ' '
      | NL
`

function hm(d) {
  let q = {}
  for (var key in d) {
    q[Symbol.for(key)] = d[key]
  }
  return q
}

var highlightMap = hm({
  cheese: 'string',
  thing: 'keyword',
  thing2: 'atom',
  op: 'number',
})

var cmOptions = {
  value: "",
  mode: {
    name: 'lately',
    grammar: myDslGrammar,
    highlight: tag => highlightMap[tag] || null,
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
  cm.showHint({
    //hint: CodeMirror.hint.lately,
    completeSingle: false,
  })
}

var editor = CodeMirror(document.querySelector('.editor'), cmOptions)

this.editor.setValue(
`hello sweet and really happy world
`
)

function compile() {
  let result = this.editor.getMode()._completer.parse(this.editor.getValue())
  console.log(JSON.stringify(result))
  return result
}

// TODO layout editor on window resize

