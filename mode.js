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
  if (editor.getMode().name !== 'lately') {
    throw new Error('editor must be in lately mode')
  }
  let completer = editor.getMode()._completer

  // count characters up to the cursor line
  let cur = editor.getCursor()
  var index = 0
  editor.getDoc().iter(0, cur.line, line => {
    index += line.text.length + 1 // +1 for '\n'
  })

  // feed the current line up to the cursor
  let line = editor.getLine(cur.line)
  completer.rewind(index)
  completer.feed(line.slice(0, cur.ch))
  index += cur.ch

  // check we counted correctly --TODO remove
  let state = editor.getStateAfter(cur.line, false)
  if (state.index !== index - cur.ch + line.length) debugger

  // retrieve the entire rest of the document
  let value = editor.getValue()
  let after = value.slice(index)

  let suggest = completer.complete(index, after)

  // throw away longer completions
  let max = Math.max.apply(null, suggest.map(c => c.start))
  suggest = suggest.filter(c => c.start === max)

  var start = cur.ch, end = start

  function tagText(tag) {
    if (typeof tag === 'symbol') return ''
    if (tag === Lately.Token.SEP) return ' '
    return tag.toString()
  }

  // TODO insert space after completion [if allowed by grammar] [consume existing if possible]
  // TODO highlight completions

  let list = suggest.map(c => {
    // start = Math.min(start, c.start)
    // end = Math.min(end, c.end)
    return {
      //className: c.target.toString(),
      text: c.completion.map(tagText).join(''),
      //displayText: c.completion.map(x => x.toString()).join(''),
      from: CodeMirror.Pos(cur.line, cur.ch),
      to: CodeMirror.Pos(cur.line, cur.ch),
    }
  })

  let from = CodeMirror.Pos(cur.line, start)
  let to = CodeMirror.Pos(cur.line, end)
  return { list, from, to }
})

