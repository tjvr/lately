CodeMirror.defineMode("lately", function(cfg, modeCfg) {

  // Use setOption('mode', ...) to change the grammar.
  var completer = new Lately.Completer(modeCfg.grammar)

  class State {
    constructor(index = 0, line = null) {
      this.index = index
      this.line = line || []
      // this.indent = 0 // TODO auto-indent
    }

    copy() {
      return new State(this.index, this.line)
    }

    highlight(line) {
      console.log(this.index, line)
      this.index += line.length
      return line[0] === '\n' ? [{text: '\n'}, {text: line.slice(1), class: 'string'}] : [{text: line, class: 'string'}]

      let tokens = [].slice.apply(line)

      let start = this.index
      let end = this.index = start + tokens.length

      completer.rewind(start)
      completer.feed(tokens)
      return completer.highlight(start, end) // { text, class }
    }

    next(stream) {
      // this.indent = stream.indentation()

      if (!this.line.length) {
        let m = stream.match(/.*/, false) // don't consume
        let line = this.index === 0 ? m[0] : '\n' + m[0]
        this.line = this.highlight(line)
      }

      let token = this.line.shift()
      if (token.text === '\n') {
        token = this.line.shift()
      }
      if (!stream.match(token.text)) { // consume
        throw "Does not match stream: " + token
      }
      var className = "s-" + token.class // TODO different classname?
      return className
    }
  }


  /* CodeMirror mode */

  return {
    startState: () => new State(),
    copyState: state => state.copy(),
    token: (stream, state) => state.next(stream),
    blankLine: state => {
      state.highlight('\n')
      return ''
    },

    _completer: completer,

    // TODO auto-indent
    //indent: function(state, textAfter) {
    //  var indent = parseInt(state.indent / cfg.indentUnit)

    //  // TODO

    //  // return number of spaces to indent, taking indentUnit into account
    //  return cfg.indentUnit * indent
    //},

    // TODO electric etc
    // electricInput: /^\s*(?:case .*?:|default:|\{|\})$/,
    // blockCommentStart: "/*",
    // blockCommentEnd: "*/",
    // lineComment: "//",
    // fold: "brace",
    // closeBrackets: "()[]{}''\"\"``",

  }
})

CodeMirror.registerHelper("hint", "lately", function(editor, options) {
  // TODO all this
 
  let cur = editor.getCursor(), curLine = editor.getLine(cur.line)
  let start = cur.ch, end = start
  
  let from = CodeMirror.Pos(cur.line, start)
  let to = CodeMirror.Pos(cur.line, end)
  let list = ["fridge", "potato"]

  return { list, from, to }
})

