(function (mod) {
  let name = 'Lately'
  if (typeof define === 'function' && define.amd) {
    define(mod()) // amd
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = mod() // node
  } else {
    window[name] = mod()
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
  Token.SEP = Token.get('SEP')
  Token.EOF = Token.get('EOF')
  // Token.NL = Token.get('NL', '\n')

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
      return '<' + this.rule.target.toString() + ' → ' + symbols.map(x => x.toString()).join(' ') + '>'
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
      clone._original = this
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
      if (token === undefined) throw 'undefined token'
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
      var options = options || {}

      this.grammar = grammar
      if (!(grammar instanceof Grammar)) throw new Error('need a Grammar')

      this.columns = []
      this.tokens = []
      this.index = 0

      this.highlighter = new Highlighter(this, options.highlight)

      this._start()
    }

    rewind(index) {
      // set the current index for the next feed() or parse()
      // we aggressively cache columns, so this doesn't throw them away yet
      if (index < 0 || index > this.tokens.length) throw new Error('invalid index')
      this.index = index
    }

    _discard(index) {
      this.tokens.splice(index)
      this.highlighter.discard(index)
    }

    feed(newTokens) {
      // only throw away columns if we see a new and unusual token
      let end = this.index + newTokens.length
      let offset = this.tokens.length
      for (var i=0; i<newTokens.length; i++) {
        // cf. Map key equality semantics (we don't bother special-casing NaN)
        if (this.tokens[i + offset] !== newTokens[i]) {
          break
        }
        this.index++
      }
      if (i === newTokens.length) return

      // add remaining tokens
      this._discard(this.index)
      let count = newTokens.length - i
      for ( ; i<newTokens.length; i++) {
        if (newTokens[i] === undefined) throw new Error('undefined token')
        this.tokens.push(newTokens[i])
      }

      // can't parse so give up
      if (this.columns.length < this.index + 1) {
        return { index: this.columns.length }
      }

      // recalc columns, up to end of newTokens
      this.columns.splice(this.index + 1)
      if (this.columns.length === 0) throw 'impossible'
      // nb. length of columns may be < index+1 *iff* the last feed() threw an error

      while (this.index < end) {
        if (this.tokens[this.index] === undefined) throw 'help'
        let error = this._step(this.tokens[this.index])
        this.index++
        if (error) return error
      }
    }

    // TODO gc-friendly mode; store columns only at checkpoints

    _start() {
      if (this.columns.length !== 0) 'oops'
      if (this.index !== 0) throw 'oops'

      let column = new Column(this.grammar, 0)
      this.columns.splice(0)
      this.columns.push(column)
      column.wants.set(Token.START, [])
      column.predict(Token.START)
      column.process()
    }

    _step(token) {
      // TODO this is getting offset wrong -- something about newlines probably?
      if (this.columns.length !== this.index + 1) 'oops' // TODO

      let columns = this.columns
      let previous = columns[columns.length - 1]
      let column = new Column(this.grammar, this.index + 1)

      // DEBUG
      //previous.log()

      if (!previous.wants.size) {
        // TODO: can this happen?
        return { error: 'Expected EOF', index: this.index, type: 'empty-wants', column: column }
      }

      let canScan = column.scan(token, previous)
      if (!canScan) {
        return { error: 'Unexpected ' + token, index: this.index + 1, type: 'cant-scan', column: column }
      }

      column.process()

      columns.push(column)
    }

    parse() {
      if (arguments.length) throw new Error('parse() takes no arguments')
      let column = this.columns[this.index]
      let item = column.unique[0].get(Token.START)
      if (!item) {
        throw { error: 'Failed', index: this.index, type: 'not-finished' }
      }

      let value = item.evaluate()
      return value
    }

    highlight(start, end) {
      //let index = highlighter.ranges.length
      //highlighter.feed(this.columns.slice(index, end + 1)) // nb. it's possible index > end
      return this.highlighter.highlight(start, end)
    }
  }

  class Range {
    constructor(start, end, className) {
      if (end <= start) throw new Error('invalid range')
      this.start = start
      this.end = end
      this.className = className
    }

    size() {
      return this.end - this.start
    }

    toString() {
      return `Range(${this.start}, ${this.end}, '${this.className}')`
    }
  }

  class Highlighter {
    constructor(parser, getClass) {
      this.getClass = getClass
      this.columns = parser.columns
    }

    discard(index) {
      // nb. sometimes index > this.ranges.length; this happens when there was an error
      //this.ranges.splice(index)
      // TODO remove
    }

    feed(columns) {
      // TODO remove
    }

    _getRange(item, end, allowPartial) {
      var tag = item.tag
      if (isLR0(tag)) {
        if (!allowPartial) return
        tag = tag.rule.target
      }

      let className = this.getClass(tag)
      if (className === undefined) throw 'class cannot be undefined'
      if (!className) return

      let start = item.start.index
      if (start === end) return
      return new Range(start, end, className)
    }

    _collect(item, end, seen, out, allowPartial) {
      if (!item) return
      if (seen.has(item)) return
      seen.add(item)

      let range = this._getRange(item, end, allowPartial)
      if (range) out.push(range)

      if (!item.right) return
      let split = item.right.start.index
      this._collect(item.left, split, seen, out)
      this._collect(item.right, end, seen, out, allowPartial)
    }

    _ranges(start, end) {
      let columns = this.columns
      var index = Math.min(end, columns.length - 1)
      var column = columns[index]
      if (!column) return
      var span = column.unique[start]
      if (!span) return

      let seen = new Set()
      let ranges = []
      for (let item of span.values()) {
        if (!item.rule) continue
        this._collect(item, index, seen, ranges, true)
      }
      return ranges
    }

    highlight(start, end) {
      if (!this.columns[start]) {
        return [new Range(start, end, 'error')]
      }

      var ranges = this._ranges(start, end)
      let index = end
      while (!ranges && index > 0) {
        ranges = this._ranges(start, --index)
      }

      let pointsSet = new Set()
      ranges.forEach(range => {
        pointsSet.add(range.start)
        pointsSet.add(range.end)
        ranges.push(range)
      })

      // longest ranges first
      ranges.sort((a, b) => {
        return b.size() - a.size()
      })

      // partial parses should not be tagged
      if (index < end) {
        pointsSet.add(index)
        ranges.push(new Range(index, end, ''))
      }

      // otherwise, default to 'error'
      ranges.unshift(new Range(start, end, 'error'))

      // clean up boundaries
      pointsSet.add(start)
      if (pointsSet.has(end)) pointsSet.delete(end)

      // split on each range boundary
      let points = Array.from(pointsSet).sort((a, b) => a - b)
      let classes = {}
      points.forEach(index => {
        classes[index] = ""
      })

      // color between points using ranges. shortest range wins
      ranges.forEach(range => {
        let rangeStart = Math.max(start, range.start)
        let rangeEnd = Math.min(end, range.end)
        for (var index = rangeStart; index < rangeEnd; index++) {
          if (index in classes) {
            classes[index] = range.className
          }
        }
      })

      // put the ranges together
      return points.map((regionStart, index) => {
        let regionEnd = points[index + 1] || end
        return new Range(regionStart, regionEnd, classes[regionStart])
      })
    }
  }

  class Completer {
    constructor(grammar, options) {
      this.leftParser = new Parser(grammar, options)
      this.rightParser = new Parser(grammar.reverse(), options)
    }

    rewind(index) { return this.leftParser.rewind(index) }
    feed(tokens) { return this.leftParser.feed(tokens) }
    highlight(start, end, getClass) { return this.leftParser.highlight(start, end, getClass) }
    parse() { return this.leftParser.parse() }

    complete(index, right) {
      // check there's no syntax error before the cursor
      if (this.leftParser.columns.length <= index) return

      // parse everything after the cursor (backwards!)
      var rightTokens = Array.from(right).reverse()
      this.rightParser.rewind(0)
      let error = this.rightParser.feed(rightTokens)
      if (error) return

      // check they're not valid
      try {
        this.leftParser.parse(left); throw false
      } catch (e) {
        if (e === false) throw 'oops'
      }
      try {
        this.rightParser.parse(right); throw false
      } catch (e) {
        if (e === false) throw 'oops'
      }
      var leftColumn = this.leftParser.columns[index].items
      var rightColumn = this.rightParser.columns[right.length].items

      var completions = []

      for (var i=0; i<leftColumn.length; i++) {
        for (var j=0; j<rightColumn.length; j++) {
          var l = leftColumn[i]
          var r = rightColumn[j]
          if (!r.rule) continue
          if (l.rule === r.rule._original
            ){

            var symbols = l.rule.symbols
            var li = l.tag.dot,
                ri = symbols.length - r.tag.dot
            var option = symbols.slice(li, ri)

            completions.push({
              start: l.start.index,
              pre: symbols.slice(0, li),
              completion: option,
              post: symbols.slice(ri),
              end: index + (right.length - r.start.index),
              rule: l.rule,
            })
          }
        }
      }

      function pretty(symbol) {
        return (typeof symbol === "string" ? symbol : symbol.toString())
      }

      console.table(completions.map(function(s) {
        return {
          target: s.rule.target,
          start: s.start,
          pre: s.pre.map(pretty).join(" "),
          completion: s.completion.map(pretty).join(" "),
          post: s.post.map(pretty).join(" "),
          end: s.end,
          build: s.rule.build,
        }
      }))

      return completions
    }

  }


  return {
    Token,
    Rule,
    Grammar,
    Parser,
    Completer,
  }
})
