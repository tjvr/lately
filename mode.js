CodeMirror.defineMode("lately", function(cfg, modeCfg) {

  // Use setOption('mode', ...) to change the grammar.
  var completer = new Lately.Completer(modeCfg.grammar)

  class State {
    constructor(index = 0, line=null, hasError=false) {
      this.index = index
      this.line = line || []
      this.hasError = hasError
      // this.indent = 0 // TODO auto-indent
    }

    copy() {
      return new State(this.index, this.line, this.hasError)
    }

    highlight(line) {
      //console.log(this.index, JSON.stringify(line), line.length)

      let tokens = [].slice.apply(line)

      let start = this.index
      let end = this.index = start + tokens.length

      try {
        completer.rewind(start)
      } catch (e) {
        // previous error
      }

      try {
        completer.feed(tokens)
      } catch (e) {
        if (!this.hasError) {
        console.error(e)
        }
        this.hasError = true
      }

      // TODO only bother highlighting certain classes
      return completer.highlight(start, end) // { text, className }
    }

    next(stream) {
      // this.indent = stream.indentation()

      if (!this.line.length) {
        if (this.index > 0) {
          this.highlight('\n')
        }
        let m = stream.match(/.*/, false) // don't consume
        this.line = this.highlight(m[0])
      }

      let token = this.line.shift()
      if (!stream.match(token.text)) { // consume
        throw "Does not match stream: " + token
      }
      return token.className
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

