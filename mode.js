CodeMirror.defineMode("lately", function(cfg, modeCfg) {

  // Use setOption('mode', ...) to change the grammar.
  var completer = new Lately.Completer(modeCfg.grammar, {
    highlight: modeCfg.highlight, // getClass
  })

  class State {
    constructor(index = 0, line=null) {
      this.index = index
      this.line = line || []
      // this.indent = 0 // TODO auto-indent
    }

    copy() {
      return new State(this.index, this.line)
    }

    highlight(line) {
      let tokens = [].slice.apply(line)

      let start = this.index
      let end = this.index = start + tokens.length

      try {
        completer.rewind(start)
      } catch (e) {
        // previous error
      }

      let error = completer.feed(tokens)
      if (error) {
        console.error(error)
      }

      let ranges = completer.highlight(start, end)

      return ranges.map(range => {
        let className = range.className
        let rangeStart = range.start - start
        let rangeEnd = range.end - start
        let text = line.slice(rangeStart, rangeEnd)
        return { className, text }
      })
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

