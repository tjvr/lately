(function (mod) {
  if (typeof define === 'function' && define.amd) {
    define(mod); // amd
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = mod; // node
  } else {
    window.Lately = mod;
  }
})(function() {

  function isLR0(tag) { return tag.constructor === LR0 }
  function isNullable(rule) { return rule.first.constructor === LR0 }
  function reversed(array) { var clone = array.slice(); return clone.reverse() }

  // is-a Tag
  class Token {
    constructor(kind, value) {
      this.kind = kind
      this.value = value
      if (this.value !== undefined) {
        this.base = Token.get(this.kind)
      }
    }

    toString() {
      return this.value ? ('`' + this.value + '`') : this.kind
    }

    scan() {
      return this.base ? [this.base, this] : [this]
    }
  }
  Token.cache = new Map()
  Token.get = (kind, value = undefined) => {
    var byValue = Token.cache.get(kind)
    if (!byValue) Token.cache.set(kind, byValue = new Map())
    var token = byValue.get(value)
    if (!token) byValue.set(value, token = new Token(kind, value))
    return token
  }
  Token.START = Token.get('START')
  Token.EOF = Token.get('EOF')
  Token.NL = Token.get('NL', '\n')

  // is-a Tag
  class LR0 {
    constructor(rule, dot) {
      this.rule = rule
      this.wants = rule.symbols[dot]
      this.dot = dot
      this.advance = null // set by Rule
    }

    toString() {
      let symbols = this.rule.symbols.slice()
      symbols.splice(this.dot, 0, '•')
      return '<' + this.rule.target.toString() + ' → ' + symbols.join(' ') + '>'
    }
  }

  class Rule {
    constructor(target, symbols, build) {
      if (!symbols || symbols.constructor !== Array) {
        throw 'symbols must be a list'
      }
      if (typeof build !== 'function') {
        build = (...args) => [target, args]
      }
      this.symbols = symbols
      this.target = target
      this.build = build

      if (symbols.length) {
        var previous
        this.first = previous = new LR0(this, 0)
        for (var dot=1; dot<symbols.length; dot++) {
          let lr0 = new LR0(this, dot)
          previous.advance = lr0
          previous = lr0
        }
        previous.advance = target
      } else {
        this.first = target
      }

      this.priority = 0
    }

    toString() {
      return '<' + this.target.toString() + ' → ' + this.symbols.join(' ') + '>'
    }

    reverse() {
      let clone = new Rule(this.target, reversed(this.symbols), null)
      clone.priority = this.priority
      return clone
    }
  }

  class Grammar {
    constructor(options) {
      this.ruleSets = new Map() // rules by target
      this.highestPriority = 0
      this.orderedChoice = options && options.orderedChoice === false ? false : true
    }

    add(rule) {
      if (!(rule instanceof Rule)) throw 'not a rule'
      rule.priority = ++this.highestPriority
      var set = this.ruleSets.get(rule.target)
      if (!set) this.ruleSets.set(rule.target, set = [])
      set.push(rule)
    }

    get(target) {
      return this.ruleSets.get(target)
    }

    has(target) {
      return this.ruleSets.has(target)
    }

    remove(rule) {
      let set = this.ruleSets.get(rule.target)
      let index = set.indexOf(rule)
      if (index === -1) throw 'rule not found'
      set.splice(index, 1)
    }

    reverse() {
      let grammar = new Grammar({ orderedChoice: this.orderedChoice })
      this.ruleSets.forEach((ruleSet, target) => {
        ruleSet.forEach(rule => {
          let clone = rule.reverse()
          grammar.add(clone)
        })
      })
      return grammar
    }

    log() {
      let rules = []
      this.ruleSets.forEach((ruleSet, target) => {
        ruleSet.forEach(rule => {
          rules.push(rule.toString())
        })
      })
      console.log(rules.join('\n'))
    }
  }

  class Derivation {
    constructor(left, right, rule) {
      this.left = left
      this.right = right
      this.rule = rule
    }
  }

  class Item {
    constructor(start, tag) {
      this.start = start // a Column
      this.tag = tag

      this.left = null
      this.right = null
      this.rule = null
      this.derivations = []

      this.cameFrom = new Error().stack

      // this.value = undefined
      // this.children = undefined
    }

    addDerivation(left, right, rule, orderedChoice=true) {
      if (this.rule !== null) {
        if (!orderedChoice) {
          this.derivations.append(new Derivation(left, right, rule))
          return
        } else {
          // last rule defined wins
          if (this.rule.priority >= rule.priority) {
            return
          }
        }
      }
      this.left = left
      this.right = right
      this.rule = rule
    }

    evaluate() { //stack=null) {
      if (this.value !== undefined) {
        return this.value
      }

      // if (stack === null) stack = []
      // stack.push(this)
      let rule = this.rule
      if (!rule) { // a token (from scan!)
        return this.value
      }

      let children = this.children !== undefined ? this.children.slice() : this.evaluateChildren() //stack)

      //if (stack.pop() !== this) throw 'recursion error'
      var value = this.value = rule.build.apply(rule, children)
      if (value === undefined) {
        throw 'build() returned undefined'
      }
      return value
    }

    evaluateChildren() { //stack) {
      if (isLR0(this.tag) && this.tag.dot === 0) {
        return []
      }

      var item = this
      let nodes = []
      while (item.left) {
        nodes.push(item)
        item = item.left
      }

      let children = this.children = []
      for (var i = nodes.length; i--; ) {
        let child = nodes[i].right.evaluate() //stack)
        children.push(child)
      }
      return children
    }

    // TODO evaluate when orderedChoice = false
  }

  class Column {
    constructor(grammar, index) {
      this.grammar = grammar
      this.index = index

      this.items = []
      this.unique = {}
      this.wants = new Map()
    }

    add(start, tag) {
      let byKey = this.unique[start.index]
      if (!byKey) this.unique[start.index] = byKey = new Map()

      var item = byKey.get(tag)
      if (item) {
        return item
      }

      byKey.set(tag, item = new Item(start, tag))
      this.items.push(item)

      if (isLR0(tag)) {
        let target = tag.wants
        let byTarget = this.wants.get(target)
        if (!byTarget) {
          this.wants.set(target, [item])
        } else {
          byTarget.push(item)
        }
      }
      return item
    }

    scan(token, previous) {
      let tags = token.scan ? token.scan() : [token]
      tags.forEach(tag => {
        if (previous.wants.has(tag)) {
          let item = this.add(previous, tag)
          item.value = token
        }
      })
      return !!this.items.length
    }

    predict(tag) {
      let ruleSet = this.grammar.get(tag) || []
      ruleSet.forEach(rule => {
        let item = this.add(this, rule.first)

        if (isNullable(rule)) { // nullables need a value.
          item.rule = rule
        }
      })
    }

    complete(right) {
      let wantedBy = right.start.wants.get(right.tag)
      // wantedBy cannot be empty, otherwise `right` would never have been predicted!
      wantedBy.forEach(left => {
        let item = this.add(left.start, left.tag.advance)
        item.addDerivation(left, right, left.tag.rule)
      })
    }

    process() {
      let items = this.items
      for (var i=0; i<items.length; i++) {
        let item = items[i]
        if (isLR0(item.tag)) {
          this.predict(item.tag.wants)
        } else {
          this.complete(item)
        }
      }
    }

    evaluate() {
      this.items.forEach(item => {
        if (isLR0(item.tag)) {
          item.evaluate()
        }
      })
    }

    log() {
      if (!this.items) {
        console.log("")
        return
      }
      console.table(this.items.map(item => {
        return { start: item.start.index, tag: item.tag.toString() }
      }))
    }
  }

  class Parser {
    constructor(grammar, options) {
      this.grammar = grammar
      if (!(grammar instanceof Grammar)) throw 'expected Grammar'

      this.columns = []
      this.tokens = []
      this.index = 0
    }

    // TODO return syntax errors, don't throw them
    _error(msg, token, previous) {
      // TODO error messages
      if (msg === 'Unexpected') {
        return msg + token
      } else {
        return msg
      }
    }

    rewind(index) {
      if (index < 0 || index > this.tokens.length) throw new Error('invalid index')
      this.index = index
    }

    feed(newTokens) {
      let tokens = this.tokens
      var index
      for (var i=0; i<newTokens.length; i++) {
        index = this.index + i
        // cf. Map key equality semantics (we don't bother special-casing NaN)
        if (tokens[index] !== newTokens[i]) {
          break
        }
      }
      index = this.index + i
      tokens.splice(index)
      this.columns.splice(index)
      if (this.columns.length === 0) {
        this._start()
      }
      for ( ; i<newTokens.length; i++) {
        this._step(newTokens[i])
      }
    }

    // TODO gc-friendly mode; store columns only at checkpoints

    _start() {
      if (this.columns.length !== 0) throw new Error('oops')
      if (this.index !== 0) throw new Error('oops')

      let column = new Column(this.grammar, 0)
      this.columns = [column]
      column.wants.set(Token.START, [])
      column.predict(Token.START)
      column.process()
    }

    _step(token) {
      //if (this.columns.length !== this.index + 1) throw new Error('oops')

      let columns = this.columns
      let previous = columns[columns.length - 1]
      let column = new Column(this.grammar, this.index + 1)

      // DEBUG
      //previous.log()

      if (!previous.wants.size) {
        // TODO: can this happen?
        throw this._error('Expected EOF', token)
      }

      let canScan = column.scan(token, previous)
      if (!canScan) {
        throw this._error('Unexpected', token, previous)
      }

      column.process()

      columns.push(column)
      this.tokens.push(token)
      this.index++
    }

    parse() {
      if (arguments.length) throw 'parse() takes no arguments'
      let column = this.columns[this.index]
      let item = column.unique[0].get(Token.START)
      if (!item) {
        // TODO: can this happen?
        throw this._error('Failed', this.tokens[this.index])
      }

      let value = item.evaluate()
      return value
    }

    _resume(resume) {
      var column = this.table[resume - 1]
      assert(column.position === resume - 1)
      assert(resume === this.table.length)

      var tokens = this.tokens
      for (var index = resume; index <= tokens.length; index++) {
        var token = tokens[index]
        var previous = column
        column = Column(grammar, index + 1)
        var canScan = token instanceof Token ? column.scanToken(token, previous) : column.scan(token, previous)
        if (!canScan) {
          throw this._error(token, previous)
        }

        this.index = index

        var lastColumn = column
        column = this.scan(column, tokens, index - 1)
        assert(this.table.length === column.position)
        this.table.push(column)

        this.process(column, lastColumn)
        if (this.error) return
      }

      var byOrigin = column.idx[this.grammar.toplevel]
      if (!byOrigin || !byOrigin[0]) {
        this.error = "no results"
        return
      }
      return byOrigin[0]
    }

    parse3(tokens) {
      // TODO resumable
      this.tokens = tokens.slice()

      var column = new Column(this.grammar, 0)
      this.columns = [column]
      column.wants.set(Token.START, [])
      column.predict(Token.START)

      for (var index=0; index<tokens.length; index++) {
        column.process()

        // DEBUG
        column.log()

        var token = tokens[index]
        var previous = column
        column = new Column(this.grammar, index + 1)
        this.columns.push(column)

        if (!previous.wants.size) {
          // TODO: can this happen?
          throw this._error('Expected EOF', token)
        }

        let canScan = column.scan(token, previous)
        if (!canScan) {
          throw this._error('Unexpected', token, previous)
        }
      }

      column.process()

      let item = column.unique[0].get(Token.START)
      if (!item) {
        // TODO: can this happen?
        throw this._error('Failed', token)
      }

      let value = item.evaluate()
      return value

      /*
      token = lexer.lex()
      index = 0
      while token != Token.EOF:
        #print index, column.items
      previous, column = column, Column(grammar, index + 1)
      if not column.scan(token, previous):
        msg = "Unexpected " + token.kind + " @ " + str(index)
      if token.value:
        msg += ": " + token.value
      for token in previous.wants:
        if isinstance(token, Token):
        if token.value:
        assert not isinstance(token.value, Leaf) # TODO remove
      msg += "\nExpected: " + token.value
      else:
        msg += "\nExpected: " + token.kind
      return msg
      column.process()

      if token == Token.word('{'):
        column.evaluate()
      elif token == Token.word('}'):
        column.evaluate()

      token = lexer.lex()
      index += 1

      #print index, column.items
      key = 0, Symbol.START
      if key not in column.unique:
        return "Unexpected EOF"
      start = column.unique[key]
      value = start.evaluate()

      return value.sexpr() #"yay"
      */
    }
  }

  class Completer {
    constructor(grammar) {
      this.leftParser = new Parser(grammar)
      this.rightParser = new Parser(grammar.reverse())
    }

    rewind(index) { return this.leftParser.rewind(index) }
    feed(tokens) { return this.leftParser.feed(tokens) }
    highlight(start, end) { return this.leftParser.highlight(start, end) }
    parse() { return this.leftParser.parse() }

    complete(cursor, end) {
      let tokens = this.tokens

      let right = tokens.slice(cursor)
      right.reverse()
      this.rightParser.rewind(0)
      this.rightParser.feed(tokens)

      var leftColumn
      var rightColumn
      try {
        this.leftParser.parse(left); throw false
      } catch (e) {
        // TODO check index matches cursor
        leftColumn = e._table[e._table.length - 1]
      }
      try {
        this.rightParser.parse(right); throw false
      } catch (e) {
        // TODO check index matches right.length
        rightColumn = e._table[e._table.length - 1]
      }

      var completions = []

      for (var i=0; i<leftColumn.length; i++) {
        for (var j=0; j<rightColumn.length; j++) {
          var l = leftColumn[i]
          var r = rightColumn[j]
          if (l.rule === r.rule._original
            ){

            var symbols = l.rule.symbols
            var li = l.position,
                ri = symbols.length - r.position
            var completion = symbols.slice(li, ri)
            var options = [completion]

            options.forEach(function(option) {
              completions.push({
                start: l.origin,
                pre: symbols.slice(0, li),
                completion: option,
                post: symbols.slice(ri),
                end: tokens.length - r.origin,
                rule: l.rule,
              })
            })
          }
        }
      }

      function pretty(symbol) {
        return (typeof symbol === "string" ? symbol : symbol)
      }

      // console.log("Completions table:")
      // console.table(completions.map(function(s) {
      //   var info = s.rule.process._info
      //   return {
      //     start: s.start,
      //     pre: s.pre.map(pretty).join(" "),
      //     completion: s.completion.map(pretty).join(" "),
      //     post: s.post.map(pretty).join(" "),
      //     end: s.end,
      //     selector: info ? info.selector : null,
      //     name: s.rule.name,
      //   }
      // }))

      return completions
    }

  }
  Completer.cursorToken = {
    kind: "cursor",
    value: "_CURSOR_",
    isEqual: function(other) {
      return other === this
    },
  }



  return {
    Token,
    Rule,
    Grammar,
    Parser,
    Completer,
  }

}())
