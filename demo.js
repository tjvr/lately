
var myDslGrammar = BNF.parseBnf(`

File ::_
  NL File
  File NL
  File BlankLines Script
  Script

BlankLines ::_
  NL NL
  BlankLines NL

Script ::_
  Hello

Hello ::_
  h e l l o

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

