
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
  hello

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

/*

var emptyGrammar = new Earley.Grammar([
  new Earley.Rule("empty", [], function() {}),
])


var Editor = function(kind) {
  this.kind = kind;
  editors[kind] = this;
  var code = localStorage['fixie-' + kind] || "";

  this.el = el('.editor');
  this.cm = CodeMirror(this.el, cmOptions);
  this.grammar = kind === 'grammar' ? BNF.grammar : emptyGrammar;

  this.maxEdits = 0;
  this.cm.setOption('onError', this.onError.bind(this));

  this.cm.setValue(code);
  this.hasErrors = ko(false);

  this.cm.clearHistory();
  assert(this.cm.getHistory().done.length === 0);

  // send options to CM, so initial highlight is correct
  this.repaint();

  this.cm.on('change', this.onChange.bind(this));
  if (this.kind === 'grammar') {
    this.compileGrammar();
  } else {
    doNext(this.tryParse.bind(this));
  }

  showDebug.subscribe(this.fixLayout.bind(this));
};

Editor.prototype.fixLayout = function(offset) {
  this.cm.setSize(NaN, this.el.clientHeight);
};

Editor.prototype.onError = function() {
  this.maxEdits += 1;
  if (this.maxEdits > 50) this.maxEdits = 50;
  this.cm.setOption('maxEdits', this.maxEdits);
  // TODO how to go down again?
  this.debounceRepaint();
};

Editor.prototype.repaint = function() {
  this.cm.setOption('grammar', this.grammar);

  // force re-highlight --slow!
  //this.cm.setOption('mode', 'fixie');

  clearTimeout(this.repaintTimeout);
  this.repaintTimeout = null;
};

Editor.prototype.debounceRepaint = function() {
  if (this.repaintTimeout) {
    clearTimeout(this.repaintTimeout);
  }
  this.repaintTimeout = setTimeout(this.repaint.bind(this), 1000);
};

Editor.prototype.activated = function() {
  doNext(function() {
    this.fixLayout();
    this.cm.focus();
    this.cm.refresh();

    this.debounceRepaint();
  }.bind(this));
};

Editor.prototype.onChange = function(cm, change) {
  if (this.kind === 'grammar') {
    this.compileGrammar();
  } else {
    this.debounceTryParse();
  }

  localStorage['fixie-' + this.kind] = this.cm.getValue();
};

Editor.prototype.compileGrammar = function() {
  if (jsOn()) return;

  var codeEditor = editors.code;
  try {
    codeEditor.grammar = BNF.parseBnf(this.cm.getValue());
  } catch (e) {
    console.log('grammar parse error: ');
    console.log(e);
    return;
  }
  codeEditor.debounceRepaint();
};

Editor.prototype.debounceTryParse = function() {
  if (this.parseTimeout) {
    clearTimeout(this.parseTimeout);
  }
  this.parseTimeout = setTimeout(this.tryParse.bind(this), 500);
};

Editor.prototype.tryParse = function() {
  if (this.parseTimeout) {
    clearTimeout(this.parseTimeout);
    this.parseTimeout = null;
  }

  var text = this.cm.getValue(); //.split(/( +)/g);

  try {
    ////eval(text);
  } catch (e) {
    if (e.constructor === SyntaxError) {
      console.log("JS: " + e.message);
    }
  }

  var f = Fixie.test(text, this.grammar);
  var parser = f.parser;
  var tokens = f.tokens;

  // var c = new Earley.StubbornCompleter(this.grammar);
  // var d = c.parse(tokens);
  // var edits = d.edits;
  // var results = d.results;
  // var edits = [];
  // if (results.length) {
  //   var result = results[0];
  //   var edits = result.item.edits;
  //   var value = result.process();
  // }

  var output = document.querySelector('.fixie-output');
  if (output) output.parentNode.removeChild(output);
  //output.innerHTML = '';
  //output.appendChild(el('', [
  //  el('.results',  d.edits + " edits"),
  //  el('.results',  results.length + " results"),
  //  el('pre.edits', edits.map(toString).join('\n')),
  //]));

  if (showDebug()) {
    if (showGraph()) {
      renderGraph(document.querySelector('.debug'), f.result);
    } else {
      renderDebug(document.querySelector('.debug'), tokens, parser, parser.error);
    }
  }
}

var measure = el('.measure.parse-table-measure');
document.body.appendChild(measure);

function renderDebug(output, tokens, parser, error) {
  output.innerHTML = '';

  if (error) {
    output.appendChild(el('.error.row', error));
  }

  var pTable = parser.table.slice();
  while (pTable.length < tokens.length + 1) {
    pTable.push({
      items: [],
    });
  }

  var table = el('div.parse-table');
  var left = 24;
  var maxHeight = 0;
  pTable.forEach(function(column, index) {
    if (index > 0) {
      var token = tokens[index - 1] || {};
      var tokenEl = el('div.parse-table-token', {
        style: "left:" + left + "px;",
        children: token,
        title: token.kind || "asdhfjklasdhjfklahsdjfklasdf",
      });
      measure.appendChild(tokenEl);
      var width = Math.max(32, tokenEl.clientWidth);
      tokenEl.style.width = width + 'px';
      left += width;
      table.appendChild(tokenEl);
    }

    var maxNameLength = 0;
    var stateStrings = column.items.map(function(state) {
      var list = state.toList();
      maxNameLength = Math.max(maxNameLength, list[0]);
      list.origin = state.start.position;
      list.isComplete = state.isComplete;

      function expand(x) {
      }

      list.error = state.cost + "+" + state.parentCost;
      list.from = state.from || '';
      list._original = state;
      list.ancestors = state.ancestors || [];

      for (var i=0; i<state.derivations.length; i++) {
        var d = state.derivations[i];
        if (d.isInsert) continue;
        list.ancestors.push(d.left);
        list.ancestors.push(d.right);
      }

      return list;
    });
    var colList = stateStrings.map(function(list) {
      var pad = maxNameLength - list[0].length;
      while (pad--) {
        list[0] += " ";
      }
      for (var i=0; i<list.length; i++) {
        var part = list[i];
        if (part === "•") {
          list[i] = el('span.parse-table-dot', "• ");
          if (list.from === 'remove') {
            for (var j=0; j<list._original.cost; j++) {
              list.splice(i, 0, el('span.parse-table-dot-remove', "•"));
              i++;
            }
          }
        } else if (part.rule || i <= 1) {
          list[i] = el('span.parse-table-name', (part.rule || part) + ' ');
        } else {
          list[i] = el('span.parse-table-literal', (part.value || part) + ' ');
        }
        if (list.from === 'insert' && list[i+1] === "•") {
          list[i].classList.add('parse-table-symbol-insert');
        }
      }
      list.push(el('span.parse-table-error', "" + (list.error || " ")));
      var stateEl = el('li.parse-table-state', {
        class: [
          list.isComplete ? 'parse-table-state-finished' : '',
          list.from ? 'parse-table-state-' + list.from : '',
        ],
        on_click: function(e) {
          console.log(list._original);
        },
        on_mouseover: function(e) {
          list.ancestors.forEach(function(item) {
            item._el.classList.add('parse-table-state-cause');
          });
        },
        on_mouseout: function(e) {
          list.ancestors.forEach(function(item) {
            item._el.classList.remove('parse-table-state-cause');
          });
        },
        title: list.from,
        children: [el('span.parse-table-origin', ''+list.origin)].concat(list),
      });
      list._original._el = stateEl;
      return stateEl;
    });
    var col = el('ul.parse-table-column', {
      style: "left:" + left + "px;",
      children: [el('span.parse-table-index', ''+index)].concat(colList),
    });
    measure.appendChild(col);
    var width = col.clientWidth;
    maxHeight = Math.max(maxHeight, col.clientHeight);

    table.appendChild(col);
    left += width;
  });

  table.appendChild(el('span.parse-table-column-spacer', {
    style: "left:" + left + "px;",
    content: " ",
  }));

  table.style.maxWidth = (left + 48) + 'px';
  table.style.height = (maxHeight + 64) + 'px';
  output.appendChild(table);
}


function renderGraph(output, item) {
  //var source = graphDot(item);

  //console.log(source);

  output.innerHTML = '';
  //var svg = Viz(source, { format: 'svg', engine: 'dot' });
  //output.innerHTML = svg;
}

var tabs = ko(['code', 'grammar']);
var editors = {};

var jsOn = ko(true);

var showDebug = ko(!jsOn());
showDebug.subscribe(function(show) {
  document.body.classList[show ? 'add' : 'remove']('show-debug');
});
var showGraph = ko(false);

//jsOn.assign(false);
//showDebug.assign(true);
//showGraph.assign(true);

function pane(name, content) {
  return el('.pane.pane-'+name, {
    class: ko(function() { if (App.tab() === name) return 'pane-active'; }),
    children: content,
  });
}

document.body.appendChild(el('.menu', [
  el('h1.title', "fixie"),
  el('.menu-button', {
    text: "debug",
    on_click: showDebug.toggle,
  }),
  el('.menu-button', {
    text: "graph",
    on_click: function() {
      showDebug.assign(true);
      showGraph.toggle();
    },
  }),
]));

document.body.appendChild(el('.wrap', {
  children: [

    el('.tabs', tabs.map(function(name) {
      var tabName = name;
      return el('li.tab', {
        class: ko(function() { if (App.tab() === name) return 'tab-active'; }),
        on_click: function(e) {
          App.tab.assign(name);
        },
        children: el('span', tabName),
      });
    })),

    pane('code', new Editor('code').el),
    pane('grammar', new Editor('grammar').el),

    el('.fixie-output'),
  ],
}));

document.body.appendChild(el('.debug'));

App.tab.subscribe(function(name) {
  editors[name].activated();
});

document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.altKey && !e.metaKey && !e.shiftKey) {
    if (49 <= e.keyCode && e.keyCode <= 57) {
      var index = e.keyCode - 49;
      if (index === 1) {
        jsOn.assign(true);
        tabs.assign(['code', 'grammar']);
      }
      var tab = tabs()[index];
      if (tab) App.tab.assign(tab);
      e.preventDefault();
    }
    if (e.keyCode === 68) {
      showDebug.toggle();
    }
    if (e.keyCode === 74) {
      jsOn.toggle();
    }
  }
});

jsOn.subscribe(function(isJs) {
  App.tab.assign('code');
  tabs.assign(isJs ? ['code'] : ['code', 'grammar']);
});


ko(function() {
  if (jsOn() && jsGrammar()) {
    editors.code.grammar = BNF.parseBnf(jsGrammar());
  } else {
    editors.code.grammar = BNF.parseBnf(editors.grammar.cm.getValue());
  }
});

*/
