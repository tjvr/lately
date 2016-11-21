
var myDslGrammar = BNF.parseBnf(`

file ::_
  nL file
  file nL
  file blankLines script
  script

blankLines ::_
  nL nL
  blankLines nL

script ::
  cm-string

cm-string ::
  hELLO cm-keyword wORLD

hELLO ::_
  h e l l o

wORLD ::_
  w o r l d

cm-keyword ::_
  s w e e t
  h a p p y

sEP ::_ nL

`)

var cmOptions = {
  value: "",
  mode: {
    name: 'lately',
    grammar: myDslGrammar,
    highlight: tag => /^cm-/.test(tag) ? tag.slice(3) : '',
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
`
hello sweet world

hello happy world
`
)

// TODO layout editor on window resize

