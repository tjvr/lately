
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
  cm-string cm-keyword

cm-string ::_
  h e l l o

cm-keyword ::_
  w o r l d

sEP ::_ nL

`)

var cmOptions = {
  value: "",
  mode: {
    name: 'lately',
    grammar: myDslGrammar,
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

this.editor.setValue(`
hello
`)

