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

;(function() {

  const Pos = CodeMirror.Pos

  function tagText(tag) {
    if (typeof tag === 'symbol') return ''
    if (tag === Lately.Token.SEP) return ' '
    return tag.toString()
  }

  function applyHint(cm, data, completion) {
    var text = completion.text;
    cm.replaceRange(text, completion.from || data.from,
                          completion.to || data.to, "complete");
    if (completion.selection !== null) {
      var line = completion.from.line;
      var start = completion.from.ch + completion.selection, end = start;
      cm.setSelection(Pos(line, start), Pos(line, end))
    }
  }

  // TODO doesn't work on next line?

  function hint(editor) {
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
    let lineIndex = index

    // require a non-blank line
    if (cur.ch === 0) return

    // feed the current line up to the cursor
    let line = editor.getLine(cur.line)
    completer.rewind(index)
    completer.feed(line.slice(0, cur.ch))
    index += cur.ch

    // retrieve the entire rest of the document
    let value = editor.getValue()
    let after = value.slice(index)

    let suggest = completer.complete(index, after)
    if (!suggest) return

    suggest.forEach(c => {
      // offset by start-of-line
      c.start -= lineIndex
      c.end -= lineIndex

      var displayText = c.completion.map(tag => {
        return typeof tag === 'symbol' ? '_' : tag.hintText ? tag.hintText() : tag.toString()
      }).join('')

      // generate replacement text
      var text = ''
      var selection = null
      c.completion.forEach(tag => {
        if (typeof tag === 'symbol') {
          // TODO selection must not be before start!
          if (selection === null) selection = text.length
        } else {
          text += tag.hintText ? tag.hintText() : tag.toString()
        }
      })
      if (selection === null) selection = text.length
      Object.assign(c, {text, displayText, selection})
    })

    // ignore if empty/whitespace
    suggest = suggest.filter(c => c.text.trim() && c.displayText.trim())

    // ignore if has no effect! TODO--this doesn't work
    suggest = suggest.filter(c => {
      let exist = line.slice(c.start, c.end)
      return c.text !== exist
    })


    // throw away longer completions
    let max = Math.max.apply(null, suggest.map(c => c.start))
    suggest = suggest.filter(c => c.start === max)

    // ignore if first item is SEP
    // TODO insert space after completion instead
    //suggest = suggest.filter(c => c.completion[0] !== Lately.Token.SEP)

    // TODO highlight completions

    var start = cur.ch, end = start

    let list = []
    suggest.forEach(c => {
      //start = Math.min(start, c.start)
      list.push({
        text: line.slice(c.start, cur.ch) + c.text + line.slice(cur.ch, c.end),
        displayText: c.displayText,
        selection: c.selection === null ? null : c.selection + (cur.ch - c.start),
        hint: applyHint,
        from: Pos(cur.line, c.start),
        to: Pos(cur.line, c.end),
      })
    })
    if (!list.length) return

    let from = Pos(cur.line, start)
    let to = Pos(cur.line, end)
    return { list, from, to }
  }

  CodeMirror.registerHelper("hint", "lately", hint)

}())
