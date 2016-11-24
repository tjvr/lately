(function (mod) {
  let name = 'BNF'
  if (typeof define === 'function' && define.amd) {
    // TODO require?
    define(mod()) // amd
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = mod(require('Lately')) // node
  } else {
    window[name] = mod(window.Lately)
  }
})(function(Lately) {
  let { Rule, Grammar, Token } = Lately
 
  function reEscape(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
  }

  function literalRegExp(s) {
    return new RegExp(reEscape(s))
  }


  function deSep(length, func) {
    var args = []
    var nosep = []
    for (var i=0; i<length; i++) {
      let name = 't' + i
      args.push(name)
      if (i % 2 === 0) nosep.push(name)
    }
    args = args.join(', ')
    nosep = nosep.join(', ')

    if (typeof func !== 'function') throw 'not a function'
    var build = func
    return eval('(function(' + args + ') { return build(' + nosep + '); })')
  }


  function parseStream(getChar) {
    var index = 0
    var tok = getChar(0)
    function next() {
      if (tok === undefined) throw 'Oops'
      tok = getChar(++index)
    }
    function peek() {
      return getChar(index + 1)
    }
    function peek2() {
      return getChar(index + 2)
    }
    function expect(what) {
      if (tok !== what) {
        throw `expected ${what}, got ${tok === ' ' ? 'space' : tok}`
      }
      next()
    }

    let symbolMap = new Map()


    function pGrammar() {
      var g = new Grammar()
      pBlankLines()
      var start
      while (tok) {
        let rules = pRule()
        rules.forEach(rule => g.add(rule))
        if (!start) {
          start = rules[0].target
        }
        pBlankLines()
      }
      g.add(new Rule(Token.START, [start], a => a))
      g.add(new Rule(Token.SEP, [Symbol.for('SEP')], a => a)) // TODO symbols?
      return g
    }

    function pRule() {
      let target = pSymbol()
      pWS()
      let useSep = pArrow()
      pWS()

      let rules = []
      var symbols = []
      var build
      while (tok) {
        while (tok !== '\n') {
          if (typeof tok === 'function') {
            build = tok
            next()
            break
          }
          if (useSep && symbols.length) {
            symbols.push(Token.SEP)
          }
          switch (tok) {
            case "'":
            case '"':
              // TODO use literalRegExp instead
              Array.from(pString()).forEach(c => {
                symbols.push(c)
              })
              break
            case '/':
              symbols.push(pRegex())
              break
            default:
              symbols.push(pSymbol())
          }
          pWS()
        }
        expect('\n')

        // TODO ebnf

        if (useSep && build) {
          build = deSep(symbols.length, build)
        }
        rules.push(new Rule(target, symbols, build))

        pWS()
        if (tok === '|') {
          next()
          pWS()
          symbols = []
          build = undefined
          continue // parse another alternative
        }

        return rules
      }
    }

    function pSymbol() {
      var s = ''
      while (/[A-Za-z0-9_]/.test(tok)) {
        s += tok
        next()
      }
      if (!s) throw 'Unexpected ' + tok
      return Symbol.for(s) // TODO is Symbol the best thing?
    }

    function pString() {
      let quote = tok
      next()
      var s = ''
      while (tok !== quote) {
        if (tok === '\\') {
          next()
        }
        s += tok
        next()
      }
      expect(quote)
      return s // literalRegExp(s)
    }

    function pRegex() {
      var s = ''
      expect('/')
      while (tok !== '/') {
        s += tok // TODO allow escaping
        next()
      }
      expect('/')

      var flags = ''
      while (/[A-Za-z]/.test(tok)) {
        flags += tok
        next()
      }
      return new RegExp(s, flags)
    }

    function pArrow() {
      switch (tok) {
        case '-':
          expect('-')
          expect('-')
          expect('>')
          return false // don't use SEP
        case '=':
          expect('=')
          expect('>')
          return true // use SEP
        default:
          throw `wanted arrow, got ${tok}`
      }
    }

    function pWS() {
      while (tok === ' ') next()
    }
    function pBlankLines() {
      pWS()
      while (tok === '\n') {
        next()
        pWS()
      }
    }

    return pGrammar()
  }

  function parseBnf(source) {
    return parseStream(index => {
      let c = source[index]
      switch (c) {
        case '\t': return ' '
        case '\r': return '\n'
        default: return c
      }
    })
  }

  function template(strings, ...keys) {
    let tokens = []
    for (var i=0; i<strings.length; i++) {
      let string = strings[i]
      let length = string.length
      for (var j=0; j<length; j++) {
        tokens.push(string[j])
      }
      if (i in keys) {
        if (typeof keys[i] !== 'function') {
          throw new Error('not a function: ' + keys[i])
        }
        tokens.push(keys[i])
      }
    }
    return parseStream(index => tokens[index])
  }

  return { parseBnf, template }
})
