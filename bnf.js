var BNF = (function() {
  'use strict';


  function assert(x, message) {
    if (!x) {
      var err = new Error("Assertion failed: " + (message || ''));
      var lines = err.stack.split("\n");
      lines.splice(1, 1);
      throw err;
    }
  }


  var Earley
  if (typeof module !== 'undefined') {
    Earley = require('./lately.js')
  } else {
    Earley = window.Lately
  }

  var Grammar = Earley.Grammar;
  var Parser = Earley.Parser;

  var Rule = function(name, symbols, process) {
    var ruleSymbols = symbols.map(function(symbol) {
      if (symbol instanceof Array) {
        assert(symbol.length === 1);
        symbol = {kind: "symbol", value: symbol[0]};
      }
      if (typeof symbol === "object") {
        symbol = new SymbolSpec(symbol.kind, symbol.value);
      }
      return symbol;
    });
    return new Earley.Rule(name, ruleSymbols, process);
  };



  /* tokenizer */

  var Token = function(kind, text, value) {
    this.kind = kind;
    this.text = text;
    this.value = value;
    this.symbol = this.kind;
  };

  Token.prototype.toString = function() {
    var args = [this.kind, this.text, this.value];
    return "BNF.Token(" + args.map(JSON.stringify).join(", ") + ")";
  };

  Token.prototype.scan = function() {
    return [this.kind, this.value];
  };

  var TOKENS = [
    ['comment', /(#.*)$/],
    ['colons-ws',   /:::?_/],
    ['colons',   /:::?/],
    ['code', /\{\{ ([^}]*) \}\}/],

    ['identifier', /[a-z][A-Za-z-]*/],

    // ['literal', /[a-z][A-Za-z]*/],
    // ['literal', /[^?'"]/],
    // ['literal', /'(.)'/],

    ['null', /ε/],
    //['optional', /\?/],

    ['string',  /"((\\["\\]|[^"\\])*)"/],
    // ['range',   /\[[^\]]+\]/],

    ['literal', /[^ \t]+/],
  ];

  var backslashEscapeSingle = /(\\['\\])/g;
  var backslashEscapeDouble = /(\\["\\])/g;

  var whitespacePat = /^(?:[ \t]+|$)/;

  var tokenize = function(input) {
    var remain = input;
    var tokens = [];

    // consume whitespace
    var m = whitespacePat.exec(input);
    if (m && m[0]) {
      remain = remain.slice(m[0].length);
      tokens.push(new Token('indent', m[0], m[0]));
    }

    while (remain) {
      var kind = null;
      for (var i=0; i<TOKENS.length; i++) {
        var kind_and_pat = TOKENS[i],
            kind = kind_and_pat[0],
            pat  = kind_and_pat[1];
        var m = pat.exec(remain);
        if (m && m.index == 0) {
          var text = m[0];
          var value = m[1] === undefined ? m[0] : m[1];
          break;
        }
      }
      if (i === TOKENS.length) {
        tokens.push(new Token('error', remain, "Can't match token"));
        return tokens;
      }

      // consume token text
      remain = remain.slice(text.length);

      // consume whitespace
      var m = whitespacePat.exec(remain);
      if (!m) {
        tokens.push(new Token('error', remain, "Expected whitespace"));
        return tokens;
      }
      remain = remain.slice(m[0].length);
      text += m[0];

      // push the token
      tokens.push(new Token(kind, text, value));
    }
    return tokens;
  };


  /* grammar */

  function identity(x) {
    assert(arguments.length === 1);
    return x;
  }
  function listify(/*...*/) {
    return [this.name].concat([].slice.apply(arguments));
  }
  function first()  { return arguments[0]; }
  function second() { return arguments[1]; }
  function box(a) {
    return [a];
  }
  function push(l, b)     { l = l.slice(); l.push(b); return l; }
  function push2(l, _, c) { l = l.slice(); l.push(c); return l; }
  function concat(a, b)     { return a.concat(b); }
  function concat2(a, _, c) { return a.concat(c); }

  function literal(x) {
    assert(arguments.length === 1);
    return x.value;
  }

  function stringLiteral(a) {
    assert(arguments.length === 1);
    var quote = a.text.trim()[0];
    var backslashEscape = quote === '"' ? backslashEscapeDouble
                                        : backslashEscapeSingle;
    var parts = a.value.split(backslashEscape);
    return parts.map(function(p) {
      if (p === "\\\\") return "\\";
      if (p === "\\"+quote) return quote;
      return p;
    }).join("");
  }

  var LETTERS = [].slice.apply("abcdefghijklmnopqrstuvwxyz");

  function parseCode(code, letters) {
    var index = code.indexOf('=>');
    var body, args;
    if (index === -1) {
      body = code;
      args = LETTERS.slice(0, length).join(", ");
    } else {
      args = code.slice(0, index).trim();
      args = args.replace(/([^,]) /g, "$1, ");
      body = code.slice(index+2).trim();
    }
    if (!/return/.test(body)) {
      var lines = body.split(";");
      lines[lines.length - 1] = "return " + lines[lines.length - 1];
      body = lines.join(";");
    }
    code = "(function (" + args + ") { " + body + "; })"
    console.log(code);
    var func = eval(code); // TODO scoped eval
    return func;
  }

  function constant(x) {
    return function() { return x; }
  }

  function alternatives(symbols) {
    for (var i=0; i<symbols.length; i++) {
      var sym = symbols[i];
      if (sym.optional) {
        delete sym.optional;
        sym.value = sym.value.slice(0, sym.value.length - 1);

        var sofarWithout = symbols.slice(0, i);
        var sofar = symbols.slice(0, i + 1);

        return alternatives(symbols.slice(i + 1)).map(function(way) {
          return sofar.concat(way);
        }).concat(alternatives(symbols.slice(i + 1)).map(function(way) {
          return sofarWithout.concat(way);
        }));
      }
    }
    return [symbols];
  }

  var ref = literal;
  function rule(name, _, o) {
    assert(typeof name === 'string');
    return alternatives(o.symbols).map(function(symbols) {

      var ruleSymbols = symbols.slice();

      var stringLiteral = false; // TODO shadowing argh
      /*
      var ruleSymbols = [];
      if (symbols.length === 1 && symbols[0] instanceof MatchChar) {
        var stringLiteral = symbols[0].value;
      }
      for (var i=0; i<symbols.length; i++) {
        var sym = symbols[i];
        if (sym instanceof MatchChar && sym.value.length > 1) {
          for (var j=0; j<sym.value.length; j++) {
            ruleSymbols.push(new MatchChar(sym.value[j]));
          }
        } else {
          ruleSymbols.push(sym);
        }
      }
      */

      var code = o.code;
      var process;
      if (!code) {
        process = (ruleSymbols.length === 1) ? identity
                  : stringLiteral ? constant(stringLiteral) : listify;
      } else {
        console.log(code);
        process = parseCode(code, symbols.length);
      }
      var sepProcess = !o.sep ? process : function() {
        var argsNoSep = [];
        for (var i = 0; i < arguments.length; i += 2) {
          argsNoSep.push(arguments[i]);
        }
        return process.apply(this, argsNoSep);
      };

      return new Earley.Rule(name, ruleSymbols, sepProcess);
    });
  }
  function rules(name, _, __, alternatives) {
    var results = [];
    alternatives.forEach(function(symbols) {
      results = results.concat(rule(name, null, symbols));
    });
    return results;
  }

  function symbols1(_, s) {
    return {
      symbols: s,
      code: null,
    }
  }
  function symbols2(_, s, f) {
    return {
      symbols: s,
      code: f,
    }
  }
  function symbols0(s, f) {
    return {
      symbols: s,
      code: f,
    }
  }
  function optional(symbol, _) {
    symbol.optional = true;
  }
  function rangeLiteral(a) {
    throw "oops";
    return new RegExp(a.value);
  }
  function terminal(value) {
    return value; // TODO ???
    //return Fixie.matcher(value);
  }
  function ignore() { return null; }

  function ruleSep(name, _, o) {
    var sepSymbols = [];
    o.symbols.forEach(function(sym, index) {
      if (index > 0) sepSymbols.push("sEP"); sepSymbols.push(sym);
    });
    var o = {
      symbols: sepSymbols,
      code: o.code,
      sep: true,
    };
    return rule(name, _, o);
  }

  function rulesSep(name, _, __, alternatives) {
    var results = [];
    alternatives.forEach(function(symbols) {
      results = results.concat(ruleSep(name, null, symbols));
    });
    return results;
  }

  var g = new Grammar();
  [
    Rule(Earley.Token.START, ["File"], identity),

    Rule("File", ["NL", "File"], second),
    Rule("File", ["Grammar"], identity),

    Rule("Grammar", ["Grammar", "Rule"], concat),
    Rule("Grammar", ["Rule"], identity),

    Rule("Rule", ["Identifier", "colons", "FunctionSymbols", "BlankLines"], ruleSep),
    Rule("Rule", ["Identifier", "colons", "NL", "Alternatives", "BlankLines"], rulesSep),

    Rule("Rule", ["Identifier", "colons-ws", "FunctionSymbols", "BlankLines"], rule),
    Rule("Rule", ["Identifier", "colons-ws", "NL", "Alternatives", "BlankLines"], rules),

    Rule("Alternatives", ["IndentedSymbols"], box),
    Rule("Alternatives", ["Alternatives", "NL", "IndentedSymbols"], push2),

    Rule("FunctionSymbols", ["Symbols", "Function"], symbols0),
    Rule("FunctionSymbols", ["Symbols"], symbols0),

    Rule("IndentedSymbols", ["indent", "Symbols", "Function"], symbols2),
    Rule("IndentedSymbols", ["indent", "Symbols"], symbols1),

    Rule("Symbols", ["Symbols", "OptSym"], push),
    Rule("Symbols", ["OptSym"], box),
    Rule("Symbols", ["null"], function() { return []; }),

    // Rule("OptSym", ["Sym", "optional"], optional),
    Rule("OptSym", ["Sym"], identity),

    Rule("Sym", ["Identifier"], identity),
    Rule("Sym", ["Terminal"], terminal),

    Rule("Identifier", ["identifier"], literal),

    Rule("Terminal", ["literal"], literal),
    Rule("Terminal", ["string"], stringLiteral),
    //Rule("Terminal", ["range"], rangeLiteral),

    Rule("Function", ["code"], literal),

    Rule("BlankLines", ["BlankLines", "NL"], ignore),
    Rule("BlankLines", ["NL"], ignore),

    Rule("NL", ["newline"], ignore),
    Rule("NL", ["comment", "newline"], ignore),
  ].forEach(rule => g.add(rule));
  console.log(g)

  var SymbolSpec = function(kind) {
    this.kind = kind;
  };
  SymbolSpec.prototype.match = function(token) {
    return this.kind === token.kind;
  };
  SymbolSpec.prototype.toString = function() {
    return "<" + this.kind + ">";
  };

  TOKENS.map(function(token) {
    return token[0];
  }).concat([
    "newline", "indent",
  ]).forEach(function(kind) {
    if (g.has(kind)) return;
    g.add(Rule(kind, [new SymbolSpec(kind)], identity));
  });


  /* parser */

  function parseBnf(text) {
    var tokens = [];
    var lines = text.split("\n");
    lines.forEach(function(line, index) {
      if (index > 0) {
        var token = new Token('newline')
        token.line = index - 1;
        tokens.push(token);
      }
      var lineTokens = tokenize(line);
      if (lineTokens.length) {
        var token = lineTokens[lineTokens.length - 1];
        if (token.kind === "error") {
          throw token.value + " at: " + JSON.stringify(token.text) + " line " + index;
        }
      }
      lineTokens.forEach(function(x) { x.line = index; });
      tokens = tokens.concat(lineTokens);
    });
    var token = new Token('newline');
    token.line = lines.length;
    tokens.push(token);

    var p = new Parser(g);

    p.feed(tokens)
    var item = p.parse();
    if (p.error) {
      console.error(p.error);
      throw p.error;
    }

    var results = [item]

    console.log(results.length + ' results:');
    assert(results.length === 1, results.length);
    var result = results[0];
    var rules = result;
    //console.log(rules.map(function(x) { return x.toString(); }));

    //rules = Fixie.tokenGrammar.rules.concat(rules);

    var grammar = new Grammar();
    rules.forEach(rule => grammar.add(rule))
    grammar.add(Rule(Earley.Token.START, [rules[0].target], identity))
    grammar.add(Rule("nL", ['\n'], identity))
    grammar.add(Rule("sEP", [' '], identity))
    grammar.log()
    return grammar;
  }


  return {
    parseBnf: parseBnf,
    grammar: g,
  }

})();

if (typeof module !== 'undefined') module.exports = BNF;

