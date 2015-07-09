(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({"/home/meandave/Documents/dsp-talk/slides/index.js":[function(require,module,exports){
var AudioSource = require('audiosource');
var FFT = require('audio-fft');
var drawWave = require('draw-wave');
var AudioWorkerNode = require('audio-worker-node');
var ctx = new AudioContext();

var timeFFT = new FFT(ctx, {
  canvas: document.querySelector('#time'),
  type: 'time'
});

var freqFFT = new FFT(ctx, {
  canvas: document.querySelector('#frequency')
});

var src = new AudioSource({
  url: 'else-marie.mp3',
  context: ctx,
  gainNode: ctx.createGain(),
  nodes: [timeFFT, freqFFT]
});

var loadBtn = document.querySelector('#load-audio');

loadBtn.addEventListener('click', function(ev) {
  loadBtn.innerText = 'loading...';
  if (src.playing) {
    src.stop();
    loadBtn.innerText = 'stopped';
  }
  else src.load();
})

var progress = document.querySelector('.progress-contain');

src.on('time', function(time) {
  progress.style.width = time.percent;
})

src.on('load', function() {
  src.play();
  drawWave.canvas(progress.querySelector('#wave-progress'), src.buffer, '#DF79DF');
  drawWave.canvas(document.querySelector('#wave'), src.buffer, '#52F6A4');
  loadBtn.innerText = 'LOADED!';
});

/*
 *
 * AUDIO WORKER NODE
 *
 *
 * */

var crushBtn = document.querySelector('#crush-butt');
crushBtn.addEventListener('click', function() {
  playNote(null, true);
})

var bitcrusherNode = new AudioWorkerNode(ctx, "bitcrusher-worker.js", 1, 1);
bitcrusherNode.addParameter("bits", 8);
// Custom parameter - frequency reduction, 0-1, default 0.5
bitcrusherNode.addParameter("frequencyReduction", 0.5);

var bits = 8;
var frequencyReduction = 0.5;

bitcrusherNode.bits.value = bits;
bitcrusherNode.frequencyReduction.value = frequencyReduction;

// TODO(DJ): pass these dif colors...
var timeFFT2 = new FFT(ctx, {
  canvas: document.querySelector('#time-bc'),
  type: 'time'
});

var freqFFT2 = new FFT(ctx, {
  canvas: document.querySelector('#frequency-bc')
});

document.querySelector('#play-og').addEventListener('click', function() {
  playNote(null);
});

/*
 *
 * playback,
 * audio graph
 *
 * */

function playNote(freq, crush) {
  freq = (220 * 1.059463 * 2);
  var osc  = ctx.createOscillator();
  var gain = ctx.createGain();
  gain.gain.value = 1;
  osc.type = 'triangle';
  osc.frequency.value = freq;
  osc.connect(gain);
  if (crush) {
    gain.connect(bitcrusherNode);
    bitcrusherNode.connect(timeFFT2.input);
    bitcrusherNode.connect(freqFFT2.input);
  } else {
    gain.connect(timeFFT2.input);
    gain.connect(freqFFT2.input);
  }
  timeFFT2.connect(ctx.destination);
  freqFFT2.connect(ctx.destination);
  osc.start();

  setTimeout(function() {
    gain.disconnect(ctx.destination);
    osc.stop(0);
    osc.disconnect(gain);
  }, 4000);
}

},{"audio-fft":"/home/meandave/Documents/dsp-talk/slides/node_modules/audio-fft/index.js","audio-worker-node":"/home/meandave/Documents/dsp-talk/slides/node_modules/audio-worker-node/lib/audio-worker-node.js","audiosource":"/home/meandave/Documents/dsp-talk/slides/node_modules/audiosource/index.js","draw-wave":"/home/meandave/Documents/dsp-talk/slides/node_modules/draw-wave/index.js"}],"/home/meandave/Documents/dsp-talk/slides/node_modules/audio-fft/index.js":[function(require,module,exports){
/**
 * pulled from @jsantell
 *
 * https://github.com/jsantell/dsp-with-web-audio-presentation/blob/gh-pages/examples/FFT.js
 *
 */

var MAX_UINT8 = 255;

module.exports = FFT;

function FFT (ctx, options) {
  var module = this;
  this.fillStyle = options.fillStyle || '#000000';
  this.strokeStyle = options.strokeStyle || '#000000';
  this.canvas = options.canvas;
  this.onBeat = options.onBeat;
  this.offBeat = options.offBeat;
  this.type = options.type || 'frequency';
  this.spacing = options.spacing || 1;
  this.width = options.width || 1;
  this.count = options.count || 512;
  this.input = this.output = ctx.createAnalyser();
  this.proc = ctx.createScriptProcessor(256, 1, 1);
  this.data = new Uint8Array(this.input.frequencyBinCount);
  this.ctx = this.canvas.getContext('2d');

  this.decay = options.decay || 0.002;
  this.threshold = options.threshold || 0.5;
  this.range = options.range || [0, this.data.length-1];
  this.wait = options.wait || 512;

  this.h = this.canvas.height;
  this.w = this.canvas.width;

  this.input.connect(this.proc);
  this.proc.onaudioprocess = process.bind(null, module);
  this.ctx.lineWidth = module.width;
}

FFT.prototype.connect = function (node) {
  this.output.connect(node);
  this.proc.connect(node);
}

function process (module) {

  var ctx = module.ctx;
  var data = module.data;
  ctx.clearRect(0, 0, module.w, module.h);
  ctx.fillStyle = module.fillStyle || '#000000';
  ctx.strokeStyle = module.strokeStyle || '#000000';

  if (module.type === 'frequency') {
    module.input.getByteFrequencyData(data);
    // Abort if no data coming through, quick hack, needs fixed
    if (module.data[3] < 5) return;

    for (var i= 0, l = data.length; i < l && i < module.count; i++) {
      ctx.fillRect(
        i * (module.spacing + module.width),
        module.h,
        module.width,
        -(module.h / MAX_UINT8) * data[i]
      );
    }
  } else if (module.type === 'time') {
    module.input.getByteTimeDomainData(data);
    ctx.beginPath();
    ctx.moveTo(0, module.h / 2);
    for (var i= 0, l = data.length; i < l && i < module.count; i++) {
      ctx.lineTo(
        i * (module.spacing + module.width),
        (module.h / MAX_UINT8) * data[i]
      );
    }
    ctx.stroke();
    ctx.closePath();
  }
}

},{}],"/home/meandave/Documents/dsp-talk/slides/node_modules/audio-worker-node/lib/audio-param-impl.js":[function(require,module,exports){
(function (global){
"use strict";

/**
 *  AudioParamImpl
 *  +-----------------+
 *  | GainNode(inlet) |
 *  | gain: value     |
 *  +-----------------+
 *    |
 *  +-----------------------------+
 *  | ScriptProcessorNode(outlet) |
 *  +-----------------------------+
 */
function AudioParamImpl(audioContext, defaultValue, bufferSize) {
  this.inlet = audioContext.createGain();
  this.outlet = audioContext.createScriptProcessor(bufferSize, 1, 1);

  this.param = this.inlet.gain;
  this.param.value = defaultValue;
  this.array = new Float32Array(bufferSize);

  this.inlet.connect(this.outlet);

  var array = this.array;
  this.outlet.onaudioprocess = function(e) {
    array.set(e.inputBuffer.getChannelData(0));
  };
}

AudioParamImpl.prototype.connect = function(destination) {
  global.AudioNode.prototype.connect.call(this.outlet, destination);
};

AudioParamImpl.prototype.disconnect = function() {
  global.AudioNode.prototype.disconnect.call(this.outlet);
};

module.exports = AudioParamImpl;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],"/home/meandave/Documents/dsp-talk/slides/node_modules/audio-worker-node/lib/audio-param-node.js":[function(require,module,exports){
"use strict";

var AudioParamImpl = require("./audio-param-impl");

function AudioParamNode(audioContext, defaultValue, bufferSize) {
  var impl = new AudioParamImpl(audioContext, defaultValue, bufferSize);

  Object.defineProperties(impl.inlet, {
    param: {
      value: impl.param,
      enumerable: true
    },
    array: {
      value: impl.array,
      enumerable: true
    },
    connect: {
      value: function(destination) {
        impl.connect(destination);
      }
    },
    disconnect: {
      value: function() {
        impl.disconnect();
      }
    }
  });

  return impl.inlet;
}

module.exports = AudioParamNode;

},{"./audio-param-impl":"/home/meandave/Documents/dsp-talk/slides/node_modules/audio-worker-node/lib/audio-param-impl.js"}],"/home/meandave/Documents/dsp-talk/slides/node_modules/audio-worker-node/lib/audio-process-builder.js":[function(require,module,exports){
"use strict";

var AudioProcessBuilder = {};

AudioProcessBuilder.build = function(opts) {
  var numOfInput = opts.numOfInput;
  var numOfOutput = opts.numOfOutput;

  if (numOfInput === 1 && numOfOutput === 1) {
    return build_onaudioprocess_1(opts);
  }
  if (numOfInput === 2 && numOfOutput === 2) {
    return build_onaudioprocess_2(opts);
  }
  return build_onaudioprocess_n(opts);
};

function build_onaudioprocess_1(opts) {
  var func = opts.func;
  var scope = opts.scope;
  var parameters = opts.parameters;

  return function(e) {
    e.inputBuffers = [
      e.inputBuffer.getChannelData(0)
    ];
    e.outputBuffers = [
      e.outputBuffer.getChannelData(0)
    ];
    e.parameters = parameters;

    func.call(scope, e);
  };
}

function build_onaudioprocess_2(opts) {
  var func = opts.func;
  var scope = opts.scope;
  var parameters = opts.parameters;

  return function(e) {
    var inp = e.inputBuffer;
    var out = e.outputBuffer;
    e.inputBuffers = [
      inp.getChannelData(0),
      inp.getChannelData(1)
    ];
    e.outputBuffers = [
      out.getChannelData(0),
      out.getChannelData(1)
    ];
    e.parameters = parameters;

    func.call(scope, e);
  };
}

function build_onaudioprocess_n(opts) {
  var func = opts.func;
  var scope = opts.scope;
  var numOfInput = opts.numOfInput;
  var numOfOutput = opts.numOfOutput;
  var parameters = opts.parameters;

  return function(e) {
    var inputBuffers = new Array(numOfInput);
    var outputBuffers = new Array(numOfOutput);
    var i;

    for (i = 0; i < numOfInput; i++) {
      inputBuffers[i] = e.inputBuffer.getChannelData(i);
    }
    for (i = 0; i < numOfOutput; i++) {
      outputBuffers[i] = e.outputBuffer.getChannelData(i);
    }

    e.inputBuffers = inputBuffers;
    e.outputBuffers = outputBuffers;
    e.parameters = parameters;

    func.call(scope, e);
  };
}

module.exports = AudioProcessBuilder;

},{}],"/home/meandave/Documents/dsp-talk/slides/node_modules/audio-worker-node/lib/audio-worker-code.js":[function(require,module,exports){
"use strict";

var WORKER_ATTRS = [
  "onaudioprocess",
  "sampleRate",
  "self",
  "onmessage",
  "postMessage",
  "close",
  "importScripts",
];

var AudioWorkerCode = {};

AudioWorkerCode.tokens = function(src) {
  var pos = 0;
  var tokens = [];

  function eat(re) {
    while (pos < src.length) {
      var ch = src.charAt(pos);
      if (!re.test(ch)) {
        break;
      }
      pos += 1;
    }
  }

  function eatString(quote) {
    while (pos < src.length) {
      var ch = src.charAt(pos++);
      if (ch === quote) {
        return;
      }
      if (ch === "\\") {
        pos += 1;
      }
    }
    // istanbul ignore next
    throw new SyntaxError("Unexpected token ILLEGAL");
  }

  function eatMultiLineComment() {
    pos += 1;
    while (pos < src.length) {
      var ch = src.charAt(pos++);
      if (ch === "*" && src.charAt(pos) === "/") {
        pos += 1;
        return;
      }
    }
    // istanbul ignore next
    throw new SyntaxError("Unexpected token ILLEGAL");
  }

  while (pos < src.length) {
    var begin = pos;
    var ch = src.charAt(pos++);

    if (/\s/.test(ch)) {
      eat(/\s/);
    } else if (/[a-zA-Z_$]/.test(ch)) {
      eat(/[\w$]/);
    } else if (/\d/.test(ch)) {
      eat(/[.\d]/);
    } else if (/['"]/.test(ch)) {
      eatString(ch);
    } else if (ch === "/") {
      ch = src.charAt(pos);
      if (ch === "/") {
        eat(/[^\n]/);
      } else if (ch === "*") {
        eatMultiLineComment();
      }
    }

    tokens.push(src.slice(begin, pos));
  }

  return tokens;
};

AudioWorkerCode.filter = function(src) {
  var tokens = AudioWorkerCode.tokens(src);

  function prevToken(index) {
    while (index--) {
      if (/[\S/]/.test(tokens[index].charAt(0))) {
        return tokens[index];
      }
    }
    return "";
  }

  WORKER_ATTRS.forEach(function(attr) {
    var pos = 0;
    var index;

    while ((index = tokens.indexOf(attr, pos)) !== -1) {
      if (prevToken(index) !== ".") {
        tokens[index] = "__self." + tokens[index];
      }
      pos = index + 1;
    }
  });

  return tokens.join("");
};

AudioWorkerCode.compile = function(src) {
  var code = [
    "(function(__self) { 'use strict';",
    AudioWorkerCode.filter(src),
    "})"
  ].join("\n");
  return eval.call(null, code);
};

module.exports = AudioWorkerCode;

},{}],"/home/meandave/Documents/dsp-talk/slides/node_modules/audio-worker-node/lib/audio-worker-global-scope.js":[function(require,module,exports){
"use strict";

function AudioWorkerGlobalScope(node) {
  var onaudioprocess = null;

  Object.defineProperties(this, {
    self: {
      value: this,
      enumerable: true
    },
    sampleRate: {
      value: node.sampleRate,
      enumerable: true
    },
    onaudioprocess: {
      set: function(value) {
        if (typeof value !== "function") {
          value = null;
        }
        node.onaudioprocess(value);
        onaudioprocess = value;
      },
      get: function() {
        return onaudioprocess;
      },
      enumerable: true
    },
    onmessage: {
      set: function(value) {
        if (typeof value === "function") {
          value = value.bind(this);
        } else {
          value = null;
        }
        node.port2.onmessage = value;
      },
      get: function() {
        return node.port2.onmessage;
      },
      enumerable: true
    },
    postMessage: {
      value: function() {
        node.port2.postMessage.apply(node.port2, arguments);
      }
    },
    close: {
      value: function() {
        node.close.apply(node, arguments);
      }
    },
    importScripts: {
      value: function() {
        node.importScripts.apply(node, arguments);
      }
    }
  });
}

module.exports = AudioWorkerGlobalScope;

},{}],"/home/meandave/Documents/dsp-talk/slides/node_modules/audio-worker-node/lib/audio-worker-impl.js":[function(require,module,exports){
(function (global){
"use strict";

var AudioParamNode = require("./audio-param-node");
var AudioWorkerGlobalScope = require("./audio-worker-global-scope");
var AudioProcessBuilder = require("./audio-process-builder");
var ScriptLoader = require("./script-loader");
var AudioWorkerCode = require("./audio-worker-code");
var MessageChannel = require("./message-channel");

var BUFFER_SIZE = 1024;

function AudioWorkerNodeImpl(audioContext, scriptURL, numOfInput, numOfOutput) {
  var ch = new MessageChannel();

  this.audioContext = audioContext;
  this.sampleRate = audioContext.sampleRate;
  this.inlet = audioContext.createScriptProcessor(BUFFER_SIZE, numOfInput, numOfOutput);
  this.outlet = this.inlet;
  this.port1 = ch.port1;
  this.port2 = ch.port2;
  this.scope = new AudioWorkerGlobalScope(this);

  this._numOfInput = numOfInput;
  this._numOfOutput = numOfOutput;
  this._isConnected = false;
  this._isTerminated = false;
  this._silencer = null;
  this._dc1buffer = null;
  this._dc1 = null;
  this._params = {};
  this._parameters = {};

  var scope = this.scope;
  ScriptLoader.load(scriptURL, function(script) {
    try {
      AudioWorkerCode.compile(script).call(scope, scope);
    } catch (e) {}
  });
}

AudioWorkerNodeImpl.prototype.connect = function(destination) {
  var audioContext = this.audioContext;

  if (!this._isConnected) {
    this._dc1buffer = audioContext.createBuffer(1, 2, audioContext.sampleRate);
    this._dc1buffer.getChannelData(0).set([ 1, 1 ]);

    this._dc1 = audioContext.createBufferSource();
    this._dc1.buffer = this._dc1buffer;
    this._dc1.loop = true;
    this._dc1.start(audioContext.currentTime);

    Object.keys(this._params).forEach(function(name) {
      this._dc1.connect(this._params[name]);
    }, this);

    this._isConnected = true;
  }

  global.AudioNode.prototype.connect.call(this.inlet, destination);
};

AudioWorkerNodeImpl.prototype.disconnect = function() {
  var audioContext = this.audioContext;

  if (this._isConnected) {
    this._dc1.stop(audioContext.currentTime);
    this._dc1.disconnect();

    this._dc1buffer = null;
    this._dc1 = null;
    this._isConnected = false;
  }

  global.AudioNode.prototype.disconnect.call(this.outlet);
};

AudioWorkerNodeImpl.prototype.terminate = function() {
  if (!this._isTerminated) {
    this.inlet.onaudioprocess = null;
    this.port1.close();
    this.port2.close();
    this._isTerminated = true;
  }
};

AudioWorkerNodeImpl.prototype.addParameter = function(name, defaultValue) {
  var audioContext = this.audioContext;

  if (this._params.hasOwnProperty(name)) {
    return this._params[name].param;
  }

  if (this._silencer === null) {
    this._silencer = audioContext.createGain();
    this._silencer.gain.value = 0;
    this._silencer.connect(this.outlet);
  }

  var paramNode = new AudioParamNode(audioContext, defaultValue, BUFFER_SIZE);

  paramNode.connect(this._silencer);

  if (this._isConnected) {
    this._dc1.connect(paramNode);
  }

  this._params[name] = paramNode;
  this._parameters[name] = paramNode.array;

  return paramNode.param;
};

AudioWorkerNodeImpl.prototype.getParameter = function(name) {
  return this._params[name] && this._params[name].param;
};

AudioWorkerNodeImpl.prototype.removeParameter = function(name) {
  if (!this._params.hasOwnProperty(name)) {
    return;
  }

  this._params[name].disconnect();

  delete this._params[name];
  delete this._parameters[name];

  if (Object.keys(this._params).length === 0) {
    this._silencer.disconnect();
    this._silencer = null;
  }
};

AudioWorkerNodeImpl.prototype.onaudioprocess = function(func) {
  if (this._isTerminated || typeof func !== "function") {
    this.inlet.onaudioprocess = null;
  } else {
    this.inlet.onaudioprocess = AudioProcessBuilder.build({
      func: func,
      scope: this.scope,
      numOfInput: this._numOfInput,
      numOfOutput: this._numOfOutput,
      parameters: this._parameters,
    });
  }
};

AudioWorkerNodeImpl.prototype.close = function() {
  this.terminate();
};

AudioWorkerNodeImpl.prototype.importScripts = function() {
  throw new Error("Not Supported: importScripts");
};

module.exports = AudioWorkerNodeImpl;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./audio-param-node":"/home/meandave/Documents/dsp-talk/slides/node_modules/audio-worker-node/lib/audio-param-node.js","./audio-process-builder":"/home/meandave/Documents/dsp-talk/slides/node_modules/audio-worker-node/lib/audio-process-builder.js","./audio-worker-code":"/home/meandave/Documents/dsp-talk/slides/node_modules/audio-worker-node/lib/audio-worker-code.js","./audio-worker-global-scope":"/home/meandave/Documents/dsp-talk/slides/node_modules/audio-worker-node/lib/audio-worker-global-scope.js","./message-channel":"/home/meandave/Documents/dsp-talk/slides/node_modules/audio-worker-node/lib/message-channel.js","./script-loader":"/home/meandave/Documents/dsp-talk/slides/node_modules/audio-worker-node/lib/script-loader.js"}],"/home/meandave/Documents/dsp-talk/slides/node_modules/audio-worker-node/lib/audio-worker-node.js":[function(require,module,exports){
"use strict";

var utils = require("./utils");
var AudioWorkerImpl = require("./audio-worker-impl");

function AudioWorkerNode(audioContext, scriptURL, numberOfInputChannels, numberOfOutputChannels) {
  numberOfInputChannels = utils.defaults(numberOfInputChannels, 2);
  numberOfOutputChannels = utils.defaults(numberOfOutputChannels, 2);

  var impl = new AudioWorkerImpl(audioContext, scriptURL, numberOfInputChannels, numberOfOutputChannels);

  Object.defineProperties(impl.inlet, {
    onmessage: {
      set: function(value) {
        if (typeof value !== "function") {
          value = null;
        }
        impl.port1.onmessage = value;
      },
      get: function() {
        return impl.port1.onmessage;
      },
      enumerable: true
    },
    connect: {
      value: function(destination) {
        return impl.connect(destination);
      }
    },
    disconnect: {
      value: function() {
        return impl.disconnect();
      }
    },
    postMessage: {
      value: function() {
        return impl.port1.postMessage.apply(impl.port1, arguments);
      }
    },
    addParameter: {
      value: function(name, defaultValue) {
        defaultValue = utils.defaults(defaultValue, 0);
        if (!Object.getOwnPropertyDescriptor(impl.inlet, name)) {
          Object.defineProperty(impl.inlet, name, {
            get: function() {
              return impl.getParameter(name);
            },
            configurable: true,
            enumerable: true
          });
        }
        return impl.addParameter(name, defaultValue);
      }
    },
    removeParameter: {
      value: function(name) {
        if (Object.getOwnPropertyDescriptor(impl.inlet, name)) {
          delete impl.inlet[name];
        }
        return impl.removeParameter(name);
      }
    },
    terminate: {
      value: function() {
        return impl.terminate();
      }
    }
  });

  return impl.inlet;
}
module.exports = AudioWorkerNode;

},{"./audio-worker-impl":"/home/meandave/Documents/dsp-talk/slides/node_modules/audio-worker-node/lib/audio-worker-impl.js","./utils":"/home/meandave/Documents/dsp-talk/slides/node_modules/audio-worker-node/lib/utils.js"}],"/home/meandave/Documents/dsp-talk/slides/node_modules/audio-worker-node/lib/message-channel.js":[function(require,module,exports){
(function (global){
"use strict";

function MessageChannelShim() {
  this.port1 = new MessagePort();
  this.port2 = new MessagePort();
  this.port1._target = this.port2;
  this.port2._target = this.port1;
}

function MessagePort() {
  this._onmessage = null;
  this._target = null;
  this._isClosed = false;
  this._pendings = [];

  Object.defineProperties(this, {
    onmessage: {
      set: function(value) {
        var _this = this;
        this._onmessage = value;
        if (this._pendings.length) {
          setTimeout(function() {
            _this._pendings.splice(0).forEach(function(e) {
              _this._onmessage(e);
            });
          }, 0);
        }
      },
      get: function() {
        return this._onmessage;
      },
      enumerable: true
    }
  });
}

MessagePort.prototype.postMessage = function(message) {
  var target = this._target;
  if (!this._isClosed) {
    var e = {
      type: "message",
      data: message
    };
    if (typeof target._onmessage === "function") {
      setTimeout(function() {
        target._onmessage(e);
      }, 0);
    } else {
      target._pendings.push(e);
    }
  }
};

MessagePort.prototype.close = function() {
  this._isClosed = true;
  this._pendings.splice(0);
};

module.exports = global.MessageChannel || MessageChannelShim;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],"/home/meandave/Documents/dsp-talk/slides/node_modules/audio-worker-node/lib/script-loader.js":[function(require,module,exports){
(function (global){
"use strict";

var ScriptLoader = {};

ScriptLoader.load = function(scriptURL, callback) {
  var xhr = new global.XMLHttpRequest();
  xhr.open("GET", scriptURL);
  xhr.onload = function() {
    if (xhr.status === 200) {
      callback(xhr.response);
    }
  };
  xhr.send();
};

module.exports = ScriptLoader;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],"/home/meandave/Documents/dsp-talk/slides/node_modules/audio-worker-node/lib/utils.js":[function(require,module,exports){
"use strict";

function defaults(value, defaultValue) {
  return value !== undefined ? value : defaultValue;
}

module.exports = {
  defaults: defaults
};

},{}],"/home/meandave/Documents/dsp-talk/slides/node_modules/audiosource/index.js":[function(require,module,exports){
module.exports = require('./lib/index.js');

},{"./lib/index.js":"/home/meandave/Documents/dsp-talk/slides/node_modules/audiosource/lib/index.js"}],"/home/meandave/Documents/dsp-talk/slides/node_modules/audiosource/lib/index.js":[function(require,module,exports){
'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(object, property, receiver) { var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _inherits = function (subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _EventEmitter2 = require('events');

var _EventEmitter3 = _interopRequireWildcard(_EventEmitter2);

var _raf = require('raf');

var _raf2 = _interopRequireWildcard(_raf);

var _xhr = require('xhr');

var _xhr2 = _interopRequireWildcard(_xhr);

var _fs = require('fs');

var _fs2 = _interopRequireWildcard(_fs);

var _path = require('path');

var _path2 = _interopRequireWildcard(_path);

var AudioSource = (function (_EventEmitter) {
  function AudioSource(opts) {
    _classCallCheck(this, AudioSource);

    if (!opts.context) throw new Error('You must pass an audio context to use this module');
    _get(Object.getPrototypeOf(AudioSource.prototype), 'constructor', this).call(this);
    this.context = opts.context;
    this.url = opts.url ? opts.url : undefined;
    this.nodes = opts.nodes ? opts.nodes : [];
    this.gainNode = opts.gainNode ? opts.gainNode : undefined;

    if (this.nodes.length && !this.gainNode) throw new Error('Must pass gainNode in options with node array');
    this.buffer = undefined;
    this._mycb = undefined;
    this.startOffset = 0;
    this._init = true; // switch for initial play
  }

  _inherits(AudioSource, _EventEmitter);

  _createClass(AudioSource, [{
    key: '_toArrayBuffer',
    value: function _toArrayBuffer(buffer) {
      var ab = new ArrayBuffer(buffer.length);
      var view = new Uint8Array(ab);
      for (var i = 0; i < buffer.length; ++i) {
        view[i] = buffer[i];
      }
      return ab;
    }
  }, {
    key: 'load',
    value: function load(url, cb, isFile) {
      if (typeof url === 'function') cb = url;else if (url) this.url = url;

      if (!this.url) throw new Error('You must pass a url or have instantiated the class with the url option to call "AudioSource.load"');
      if (!this.listeners('load').length && !cb) console.warn('No callback passed to Load method, nor listener set up for "load" event.');
      this._req(cb);
    }
  }, {
    key: 'read',
    value: function read(filepath, cb) {
      if (typeof filepath == 'function') cb = filepath;else this.url = filepath;
      if (cb) this._mycb = cb;
      _fs2['default'].readFile(_path2['default'].resolve(filepath), (function (err, buffer) {
        if (err) this._fail(err);
        this.context.decodeAudioData(this._toArrayBuffer(buffer), (function (buffer) {
          this.buffer = buffer;
          this.emit('load', this.time());
          if (this._mycb) this._mycb(null, this);
        }).bind(this), this._fail.bind(this));
      }).bind(this));
    }
  }, {
    key: 'disconnect',
    value: function disconnect() {
      if (this.source) this.source.disconnect(this.context.destination);
    }
  }, {
    key: '_setup',
    value: function _setup(buffer) {
      var _this = this;

      this.disconnect();
      this.source = this.context.createBufferSource();
      this.source.buffer = this.buffer;

      if (this.gainNode) {
        /*
         * Really don't like having to do this everytime
         * we get a fresh buffer on playback, but it seems
         * that this is the only option until the web audio
         * spec is updated. :'(
         * */
        this.source.connect(this.gainNode);
        this.nodes.forEach(function (node) {
          _this.gainNode.connect(node.input);
        });

        this.gainNode.connect(this.context.destination);

        // hook up analyser nodes
        this.nodes.forEach(function (node) {
          if (node.input.hasOwnProperty('fftSize')) node.connect(_this.context.destination);
        });
      } else this.source.connect(this.context.destination);
    }
  }, {
    key: '_fail',
    value: function _fail(err) {
      /*
       * This error handling needs improvement, for sure.
       * */
      if (this.listeners('error').length) this.emit('error', err);else if (this._mycb) this._mycb(new Error(err));else throw new Error('No error handling?: ', err);
    }
  }, {
    key: '_req',
    value: function _req(cb) {
      var _this2 = this;

      this._mycb = cb;
      _xhr2['default']({
        uri: this.url,
        responseType: 'arraybuffer'
      }, (function (err, resp, body) {
        if (err) {
          err = null;
          _this2.read(_this2.url, cb);
        } else {
          _this2.context.decodeAudioData(body, (function (buffer) {
            this.buffer = buffer;
            this.emit('load', this.time());
            if (this._mycb) this._mycb(null, this);
          }).bind(_this2), _this2._fail.bind(_this2));
        }
      }).bind(this));
    }
  }, {
    key: 'play',
    value: function play(offset) {
      this.lastPlay = this.context.currentTime;
      if (!offset) offset = this.startOffset;

      if (!this._init) this._stop();else this._init = false;

      this._setup(this.buffer); // get a fresh buffer
      this.source.start(0, offset);
      this.playing = true;
      this.interval = _raf2['default'](this._broadcastTime.bind(this));
      this.emit('play', this.time());
    }
  }, {
    key: '_stop',
    value: function _stop() {
      this.source.stop(this.context.currentTime);
      this.playing = false;
      this.interval = _raf2['default'].cancel(this.interval);
    }
  }, {
    key: 'stop',
    value: function stop() {
      this.startOffset = 0;
      this.lastPlay = 0;
      this._stop();
      this.emit('stop', this.time());
    }
  }, {
    key: 'seek',
    value: function seek(time) {
      if (time) skip(time);else back(time);
    }
  }, {
    key: 'skip',
    value: function skip(time) {
      if (!time) time = 5;
      this.lastPlay = this.lastPlay + time;
      this.pause();
      this.emit('skip', this.time(), time);
    }
  }, {
    key: 'back',
    value: function back(time) {
      if (!time) time = -5;
      this.lastPlay = this.lastPlay + time;
      this.pause();
      this.emit('back', this.time(), time);
    }
  }, {
    key: 'pause',
    value: function pause() {
      this._stop();
      this.startOffset += this.context.currentTime - this.lastPlay;
      this.emit('pause', this.time());
    }
  }, {
    key: 'remove',
    value: function remove() {
      this.disconnect();
      this.emit('remove', this.time());
      this.removeAllListeners();
    }
  }, {
    key: 'time',
    value: function time() {
      var cur = this.context.currentTime - this.lastPlay + this.startOffset;
      return {
        current: cur,
        remaining: this.buffer.duration - cur,
        percent: (cur / this.buffer.duration * 100).toFixed(2) + '%',
        total: this.buffer.duration
      };
    }
  }, {
    key: '_broadcastTime',
    value: function _broadcastTime() {
      var time = this.time();
      if (time.current > time.total) this.stop();else {
        this.emit('time', time);
        _raf2['default'](this._broadcastTime.bind(this));
      }
    }
  }]);

  return AudioSource;
})(_EventEmitter3['default']);

exports['default'] = AudioSource;
module.exports = exports['default'];
},{"events":"/usr/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js","fs":"/usr/lib/node_modules/watchify/node_modules/browserify/lib/_empty.js","path":"/usr/lib/node_modules/watchify/node_modules/browserify/node_modules/path-browserify/index.js","raf":"/home/meandave/Documents/dsp-talk/slides/node_modules/audiosource/node_modules/raf/index.js","xhr":"/home/meandave/Documents/dsp-talk/slides/node_modules/audiosource/node_modules/xhr/index.js"}],"/home/meandave/Documents/dsp-talk/slides/node_modules/audiosource/node_modules/raf/index.js":[function(require,module,exports){
var now = require('performance-now')
  , global = typeof window === 'undefined' ? {} : window
  , vendors = ['moz', 'webkit']
  , suffix = 'AnimationFrame'
  , raf = global['request' + suffix]
  , caf = global['cancel' + suffix] || global['cancelRequest' + suffix]
  , isNative = true

for(var i = 0; i < vendors.length && !raf; i++) {
  raf = global[vendors[i] + 'Request' + suffix]
  caf = global[vendors[i] + 'Cancel' + suffix]
      || global[vendors[i] + 'CancelRequest' + suffix]
}

// Some versions of FF have rAF but not cAF
if(!raf || !caf) {
  isNative = false

  var last = 0
    , id = 0
    , queue = []
    , frameDuration = 1000 / 60

  raf = function(callback) {
    if(queue.length === 0) {
      var _now = now()
        , next = Math.max(0, frameDuration - (_now - last))
      last = next + _now
      setTimeout(function() {
        var cp = queue.slice(0)
        // Clear queue here to prevent
        // callbacks from appending listeners
        // to the current frame's queue
        queue.length = 0
        for(var i = 0; i < cp.length; i++) {
          if(!cp[i].cancelled) {
            try{
              cp[i].callback(last)
            } catch(e) {
              setTimeout(function() { throw e }, 0)
            }
          }
        }
      }, Math.round(next))
    }
    queue.push({
      handle: ++id,
      callback: callback,
      cancelled: false
    })
    return id
  }

  caf = function(handle) {
    for(var i = 0; i < queue.length; i++) {
      if(queue[i].handle === handle) {
        queue[i].cancelled = true
      }
    }
  }
}

module.exports = function(fn) {
  // Wrap in a new function to prevent
  // `cancel` potentially being assigned
  // to the native rAF function
  if(!isNative) {
    return raf.call(global, fn)
  }
  return raf.call(global, function() {
    try{
      fn.apply(this, arguments)
    } catch(e) {
      setTimeout(function() { throw e }, 0)
    }
  })
}
module.exports.cancel = function() {
  caf.apply(global, arguments)
}

},{"performance-now":"/home/meandave/Documents/dsp-talk/slides/node_modules/audiosource/node_modules/raf/node_modules/performance-now/lib/performance-now.js"}],"/home/meandave/Documents/dsp-talk/slides/node_modules/audiosource/node_modules/raf/node_modules/performance-now/lib/performance-now.js":[function(require,module,exports){
(function (process){
// Generated by CoffeeScript 1.6.3
(function() {
  var getNanoSeconds, hrtime, loadTime;

  if ((typeof performance !== "undefined" && performance !== null) && performance.now) {
    module.exports = function() {
      return performance.now();
    };
  } else if ((typeof process !== "undefined" && process !== null) && process.hrtime) {
    module.exports = function() {
      return (getNanoSeconds() - loadTime) / 1e6;
    };
    hrtime = process.hrtime;
    getNanoSeconds = function() {
      var hr;
      hr = hrtime();
      return hr[0] * 1e9 + hr[1];
    };
    loadTime = getNanoSeconds();
  } else if (Date.now) {
    module.exports = function() {
      return Date.now() - loadTime;
    };
    loadTime = Date.now();
  } else {
    module.exports = function() {
      return new Date().getTime() - loadTime;
    };
    loadTime = new Date().getTime();
  }

}).call(this);

/*
//@ sourceMappingURL=performance-now.map
*/

}).call(this,require('_process'))
},{"_process":"/usr/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js"}],"/home/meandave/Documents/dsp-talk/slides/node_modules/audiosource/node_modules/xhr/index.js":[function(require,module,exports){
"use strict";
var window = require("global/window")
var once = require("once")
var parseHeaders = require("parse-headers")


var XHR = window.XMLHttpRequest || noop
var XDR = "withCredentials" in (new XHR()) ? XHR : window.XDomainRequest

module.exports = createXHR

function createXHR(options, callback) {
    function readystatechange() {
        if (xhr.readyState === 4) {
            loadFunc()
        }
    }

    function getBody() {
        // Chrome with requestType=blob throws errors arround when even testing access to responseText
        var body = undefined

        if (xhr.response) {
            body = xhr.response
        } else if (xhr.responseType === "text" || !xhr.responseType) {
            body = xhr.responseText || xhr.responseXML
        }

        if (isJson) {
            try {
                body = JSON.parse(body)
            } catch (e) {}
        }

        return body
    }
    
    var failureResponse = {
                body: undefined,
                headers: {},
                statusCode: 0,
                method: method,
                url: uri,
                rawRequest: xhr
            }
    
    function errorFunc(evt) {
        clearTimeout(timeoutTimer)
        if(!(evt instanceof Error)){
            evt = new Error("" + (evt || "unknown") )
        }
        evt.statusCode = 0
        callback(evt, failureResponse)
    }

    // will load the data & process the response in a special response object
    function loadFunc() {
        clearTimeout(timeoutTimer)
        
        var status = (xhr.status === 1223 ? 204 : xhr.status)
        var response = failureResponse
        var err = null
        
        if (status !== 0){
            response = {
                body: getBody(),
                statusCode: status,
                method: method,
                headers: {},
                url: uri,
                rawRequest: xhr
            }
            if(xhr.getAllResponseHeaders){ //remember xhr can in fact be XDR for CORS in IE
                response.headers = parseHeaders(xhr.getAllResponseHeaders())
            }
        } else {
            err = new Error("Internal XMLHttpRequest Error")
        }
        callback(err, response, response.body)
        
    }
    
    if (typeof options === "string") {
        options = { uri: options }
    }

    options = options || {}
    if(typeof callback === "undefined"){
        throw new Error("callback argument missing")
    }
    callback = once(callback)

    var xhr = options.xhr || null

    if (!xhr) {
        if (options.cors || options.useXDR) {
            xhr = new XDR()
        }else{
            xhr = new XHR()
        }
    }

    var key
    var uri = xhr.url = options.uri || options.url
    var method = xhr.method = options.method || "GET"
    var body = options.body || options.data
    var headers = xhr.headers = options.headers || {}
    var sync = !!options.sync
    var isJson = false
    var timeoutTimer

    if ("json" in options) {
        isJson = true
        headers["Accept"] || (headers["Accept"] = "application/json") //Don't override existing accept header declared by user
        if (method !== "GET" && method !== "HEAD") {
            headers["Content-Type"] = "application/json"
            body = JSON.stringify(options.json)
        }
    }

    xhr.onreadystatechange = readystatechange
    xhr.onload = loadFunc
    xhr.onerror = errorFunc
    // IE9 must have onprogress be set to a unique function.
    xhr.onprogress = function () {
        // IE must die
    }
    xhr.ontimeout = errorFunc
    xhr.open(method, uri, !sync, options.username, options.password)
    //has to be after open
    if(!sync) {
        xhr.withCredentials = !!options.withCredentials
    }
    // Cannot set timeout with sync request
    // not setting timeout on the xhr object, because of old webkits etc. not handling that correctly
    // both npm's request and jquery 1.x use this kind of timeout, so this is being consistent
    if (!sync && options.timeout > 0 ) {
        timeoutTimer = setTimeout(function(){
            xhr.abort("timeout");
        }, options.timeout+2 );
    }

    if (xhr.setRequestHeader) {
        for(key in headers){
            if(headers.hasOwnProperty(key)){
                xhr.setRequestHeader(key, headers[key])
            }
        }
    } else if (options.headers) {
        throw new Error("Headers cannot be set on an XDomainRequest object")
    }

    if ("responseType" in options) {
        xhr.responseType = options.responseType
    }
    
    if ("beforeSend" in options && 
        typeof options.beforeSend === "function"
    ) {
        options.beforeSend(xhr)
    }

    xhr.send(body)

    return xhr


}


function noop() {}

},{"global/window":"/home/meandave/Documents/dsp-talk/slides/node_modules/audiosource/node_modules/xhr/node_modules/global/window.js","once":"/home/meandave/Documents/dsp-talk/slides/node_modules/audiosource/node_modules/xhr/node_modules/once/once.js","parse-headers":"/home/meandave/Documents/dsp-talk/slides/node_modules/audiosource/node_modules/xhr/node_modules/parse-headers/parse-headers.js"}],"/home/meandave/Documents/dsp-talk/slides/node_modules/audiosource/node_modules/xhr/node_modules/global/window.js":[function(require,module,exports){
(function (global){
if (typeof window !== "undefined") {
    module.exports = window;
} else if (typeof global !== "undefined") {
    module.exports = global;
} else if (typeof self !== "undefined"){
    module.exports = self;
} else {
    module.exports = {};
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],"/home/meandave/Documents/dsp-talk/slides/node_modules/audiosource/node_modules/xhr/node_modules/once/once.js":[function(require,module,exports){
module.exports = once

once.proto = once(function () {
  Object.defineProperty(Function.prototype, 'once', {
    value: function () {
      return once(this)
    },
    configurable: true
  })
})

function once (fn) {
  var called = false
  return function () {
    if (called) return
    called = true
    return fn.apply(this, arguments)
  }
}

},{}],"/home/meandave/Documents/dsp-talk/slides/node_modules/audiosource/node_modules/xhr/node_modules/parse-headers/node_modules/for-each/index.js":[function(require,module,exports){
var isFunction = require('is-function')

module.exports = forEach

var toString = Object.prototype.toString
var hasOwnProperty = Object.prototype.hasOwnProperty

function forEach(list, iterator, context) {
    if (!isFunction(iterator)) {
        throw new TypeError('iterator must be a function')
    }

    if (arguments.length < 3) {
        context = this
    }
    
    if (toString.call(list) === '[object Array]')
        forEachArray(list, iterator, context)
    else if (typeof list === 'string')
        forEachString(list, iterator, context)
    else
        forEachObject(list, iterator, context)
}

function forEachArray(array, iterator, context) {
    for (var i = 0, len = array.length; i < len; i++) {
        if (hasOwnProperty.call(array, i)) {
            iterator.call(context, array[i], i, array)
        }
    }
}

function forEachString(string, iterator, context) {
    for (var i = 0, len = string.length; i < len; i++) {
        // no such thing as a sparse string.
        iterator.call(context, string.charAt(i), i, string)
    }
}

function forEachObject(object, iterator, context) {
    for (var k in object) {
        if (hasOwnProperty.call(object, k)) {
            iterator.call(context, object[k], k, object)
        }
    }
}

},{"is-function":"/home/meandave/Documents/dsp-talk/slides/node_modules/audiosource/node_modules/xhr/node_modules/parse-headers/node_modules/for-each/node_modules/is-function/index.js"}],"/home/meandave/Documents/dsp-talk/slides/node_modules/audiosource/node_modules/xhr/node_modules/parse-headers/node_modules/for-each/node_modules/is-function/index.js":[function(require,module,exports){
module.exports = isFunction

var toString = Object.prototype.toString

function isFunction (fn) {
  var string = toString.call(fn)
  return string === '[object Function]' ||
    (typeof fn === 'function' && string !== '[object RegExp]') ||
    (typeof window !== 'undefined' &&
     // IE8 and below
     (fn === window.setTimeout ||
      fn === window.alert ||
      fn === window.confirm ||
      fn === window.prompt))
};

},{}],"/home/meandave/Documents/dsp-talk/slides/node_modules/audiosource/node_modules/xhr/node_modules/parse-headers/node_modules/trim/index.js":[function(require,module,exports){

exports = module.exports = trim;

function trim(str){
  return str.replace(/^\s*|\s*$/g, '');
}

exports.left = function(str){
  return str.replace(/^\s*/, '');
};

exports.right = function(str){
  return str.replace(/\s*$/, '');
};

},{}],"/home/meandave/Documents/dsp-talk/slides/node_modules/audiosource/node_modules/xhr/node_modules/parse-headers/parse-headers.js":[function(require,module,exports){
var trim = require('trim')
  , forEach = require('for-each')
  , isArray = function(arg) {
      return Object.prototype.toString.call(arg) === '[object Array]';
    }

module.exports = function (headers) {
  if (!headers)
    return {}

  var result = {}

  forEach(
      trim(headers).split('\n')
    , function (row) {
        var index = row.indexOf(':')
          , key = trim(row.slice(0, index)).toLowerCase()
          , value = trim(row.slice(index + 1))

        if (typeof(result[key]) === 'undefined') {
          result[key] = value
        } else if (isArray(result[key])) {
          result[key].push(value)
        } else {
          result[key] = [ result[key], value ]
        }
      }
  )

  return result
}
},{"for-each":"/home/meandave/Documents/dsp-talk/slides/node_modules/audiosource/node_modules/xhr/node_modules/parse-headers/node_modules/for-each/index.js","trim":"/home/meandave/Documents/dsp-talk/slides/node_modules/audiosource/node_modules/xhr/node_modules/parse-headers/node_modules/trim/index.js"}],"/home/meandave/Documents/dsp-talk/slides/node_modules/draw-wave/index.js":[function(require,module,exports){
module.exports = {
  canvas: drawBuffer,
  svg: require('./svg.js')
};

function drawBuffer (canvas, buffer, color) {
  var ctx = canvas.getContext('2d');
  var width = canvas.width;
  var height = canvas.height;
  if (color) {
    ctx.fillStyle = color;
  }

    var data = buffer.getChannelData( 0 );
    var step = Math.ceil( data.length / width );
    var amp = height / 2;
    for(var i=0; i < width; i++){
        var min = 1.0;
        var max = -1.0;
        for (var j=0; j<step; j++) {
            var datum = data[(i*step)+j];
            if (datum < min)
                min = datum;
            if (datum > max)
                max = datum;
        }
      ctx.fillRect(i,(1+min)*amp,1,Math.max(1,(max-min)*amp));
    }
}
},{"./svg.js":"/home/meandave/Documents/dsp-talk/slides/node_modules/draw-wave/svg.js"}],"/home/meandave/Documents/dsp-talk/slides/node_modules/draw-wave/node_modules/svg-create-element/index.js":[function(require,module,exports){
var has = require('has');

module.exports = function (name, attr) {
    var elem = document.createElementNS('http://www.w3.org/2000/svg', name);
    if (!attr) return elem;
    for (var key in attr) {
        if (!has(attr, key)) continue;
        var nkey = key.replace(/([a-z])([A-Z])/g, function (_, a, b) {
            return a + '-' + b.toLowerCase();
        });
        elem.setAttribute(nkey, attr[key]);
    }
    return elem;
}

},{"has":"/home/meandave/Documents/dsp-talk/slides/node_modules/draw-wave/node_modules/svg-create-element/node_modules/has/src/index.js"}],"/home/meandave/Documents/dsp-talk/slides/node_modules/draw-wave/node_modules/svg-create-element/node_modules/has/src/index.js":[function(require,module,exports){
var hasOwn = Object.prototype.hasOwnProperty;


module.exports = function has(obj, property) {
  return hasOwn.call(obj, property);
};

},{}],"/home/meandave/Documents/dsp-talk/slides/node_modules/draw-wave/svg.js":[function(require,module,exports){
var createEl = require('svg-create-element');

module.exports = drawBufferSVG;

function getRect(x, y, width, height, color) {
  return createEl('rect', {
    x: x,
    y: y,
    width: width,
    height: height,
    fill: color
  });
}

function drawBufferSVG(buffer, width, height, color) {
  if (!color) color = '#000';

  var svgEl = createEl('svg', {
    width: width,
    height: height
  });

  svgEl.style.display = "block";

  var g = createEl('g');

  svgEl.appendChild(g);

  var data = buffer.getChannelData( 0 );
  var step = Math.ceil( data.length / width );
  var amp = height / 2;
  for (var i=0; i < width; i++) {
    var min = 1.0;
    var max = -1.0;
    for (var j=0; j<step; j++) {
      var datum = data[(i*step)+j];
      if (datum < min)
        min = datum;
      if (datum > max)
        max = datum;
    }
    g.appendChild(getRect(i, (1+min)*amp, 1, Math.max(1,(max-min)*amp), color));
  }

  return svgEl;
}
},{"svg-create-element":"/home/meandave/Documents/dsp-talk/slides/node_modules/draw-wave/node_modules/svg-create-element/index.js"}],"/usr/lib/node_modules/watchify/node_modules/browserify/lib/_empty.js":[function(require,module,exports){

},{}],"/usr/lib/node_modules/watchify/node_modules/browserify/node_modules/events/events.js":[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw TypeError('Uncaught, unspecified "error" event.');
      }
      return false;
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],"/usr/lib/node_modules/watchify/node_modules/browserify/node_modules/path-browserify/index.js":[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":"/usr/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js"}],"/usr/lib/node_modules/watchify/node_modules/browserify/node_modules/process/browser.js":[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}]},{},["/home/meandave/Documents/dsp-talk/slides/index.js"])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi91c3IvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL2hvbWUvbWVhbmRhdmUvRG9jdW1lbnRzL2RzcC10YWxrL3NsaWRlcy9pbmRleC5qcyIsIi9ob21lL21lYW5kYXZlL0RvY3VtZW50cy9kc3AtdGFsay9zbGlkZXMvbm9kZV9tb2R1bGVzL2F1ZGlvLWZmdC9pbmRleC5qcyIsIi9ob21lL21lYW5kYXZlL0RvY3VtZW50cy9kc3AtdGFsay9zbGlkZXMvbm9kZV9tb2R1bGVzL2F1ZGlvLXdvcmtlci1ub2RlL2xpYi9hdWRpby1wYXJhbS1pbXBsLmpzIiwiL2hvbWUvbWVhbmRhdmUvRG9jdW1lbnRzL2RzcC10YWxrL3NsaWRlcy9ub2RlX21vZHVsZXMvYXVkaW8td29ya2VyLW5vZGUvbGliL2F1ZGlvLXBhcmFtLW5vZGUuanMiLCIvaG9tZS9tZWFuZGF2ZS9Eb2N1bWVudHMvZHNwLXRhbGsvc2xpZGVzL25vZGVfbW9kdWxlcy9hdWRpby13b3JrZXItbm9kZS9saWIvYXVkaW8tcHJvY2Vzcy1idWlsZGVyLmpzIiwiL2hvbWUvbWVhbmRhdmUvRG9jdW1lbnRzL2RzcC10YWxrL3NsaWRlcy9ub2RlX21vZHVsZXMvYXVkaW8td29ya2VyLW5vZGUvbGliL2F1ZGlvLXdvcmtlci1jb2RlLmpzIiwiL2hvbWUvbWVhbmRhdmUvRG9jdW1lbnRzL2RzcC10YWxrL3NsaWRlcy9ub2RlX21vZHVsZXMvYXVkaW8td29ya2VyLW5vZGUvbGliL2F1ZGlvLXdvcmtlci1nbG9iYWwtc2NvcGUuanMiLCIvaG9tZS9tZWFuZGF2ZS9Eb2N1bWVudHMvZHNwLXRhbGsvc2xpZGVzL25vZGVfbW9kdWxlcy9hdWRpby13b3JrZXItbm9kZS9saWIvYXVkaW8td29ya2VyLWltcGwuanMiLCIvaG9tZS9tZWFuZGF2ZS9Eb2N1bWVudHMvZHNwLXRhbGsvc2xpZGVzL25vZGVfbW9kdWxlcy9hdWRpby13b3JrZXItbm9kZS9saWIvYXVkaW8td29ya2VyLW5vZGUuanMiLCIvaG9tZS9tZWFuZGF2ZS9Eb2N1bWVudHMvZHNwLXRhbGsvc2xpZGVzL25vZGVfbW9kdWxlcy9hdWRpby13b3JrZXItbm9kZS9saWIvbWVzc2FnZS1jaGFubmVsLmpzIiwiL2hvbWUvbWVhbmRhdmUvRG9jdW1lbnRzL2RzcC10YWxrL3NsaWRlcy9ub2RlX21vZHVsZXMvYXVkaW8td29ya2VyLW5vZGUvbGliL3NjcmlwdC1sb2FkZXIuanMiLCIvaG9tZS9tZWFuZGF2ZS9Eb2N1bWVudHMvZHNwLXRhbGsvc2xpZGVzL25vZGVfbW9kdWxlcy9hdWRpby13b3JrZXItbm9kZS9saWIvdXRpbHMuanMiLCIvaG9tZS9tZWFuZGF2ZS9Eb2N1bWVudHMvZHNwLXRhbGsvc2xpZGVzL25vZGVfbW9kdWxlcy9hdWRpb3NvdXJjZS9pbmRleC5qcyIsIi9ob21lL21lYW5kYXZlL0RvY3VtZW50cy9kc3AtdGFsay9zbGlkZXMvbm9kZV9tb2R1bGVzL2F1ZGlvc291cmNlL2xpYi9pbmRleC5qcyIsIi9ob21lL21lYW5kYXZlL0RvY3VtZW50cy9kc3AtdGFsay9zbGlkZXMvbm9kZV9tb2R1bGVzL2F1ZGlvc291cmNlL25vZGVfbW9kdWxlcy9yYWYvaW5kZXguanMiLCIvaG9tZS9tZWFuZGF2ZS9Eb2N1bWVudHMvZHNwLXRhbGsvc2xpZGVzL25vZGVfbW9kdWxlcy9hdWRpb3NvdXJjZS9ub2RlX21vZHVsZXMvcmFmL25vZGVfbW9kdWxlcy9wZXJmb3JtYW5jZS1ub3cvbGliL3BlcmZvcm1hbmNlLW5vdy5qcyIsIi9ob21lL21lYW5kYXZlL0RvY3VtZW50cy9kc3AtdGFsay9zbGlkZXMvbm9kZV9tb2R1bGVzL2F1ZGlvc291cmNlL25vZGVfbW9kdWxlcy94aHIvaW5kZXguanMiLCIvaG9tZS9tZWFuZGF2ZS9Eb2N1bWVudHMvZHNwLXRhbGsvc2xpZGVzL25vZGVfbW9kdWxlcy9hdWRpb3NvdXJjZS9ub2RlX21vZHVsZXMveGhyL25vZGVfbW9kdWxlcy9nbG9iYWwvd2luZG93LmpzIiwiL2hvbWUvbWVhbmRhdmUvRG9jdW1lbnRzL2RzcC10YWxrL3NsaWRlcy9ub2RlX21vZHVsZXMvYXVkaW9zb3VyY2Uvbm9kZV9tb2R1bGVzL3hoci9ub2RlX21vZHVsZXMvb25jZS9vbmNlLmpzIiwiL2hvbWUvbWVhbmRhdmUvRG9jdW1lbnRzL2RzcC10YWxrL3NsaWRlcy9ub2RlX21vZHVsZXMvYXVkaW9zb3VyY2Uvbm9kZV9tb2R1bGVzL3hoci9ub2RlX21vZHVsZXMvcGFyc2UtaGVhZGVycy9ub2RlX21vZHVsZXMvZm9yLWVhY2gvaW5kZXguanMiLCIvaG9tZS9tZWFuZGF2ZS9Eb2N1bWVudHMvZHNwLXRhbGsvc2xpZGVzL25vZGVfbW9kdWxlcy9hdWRpb3NvdXJjZS9ub2RlX21vZHVsZXMveGhyL25vZGVfbW9kdWxlcy9wYXJzZS1oZWFkZXJzL25vZGVfbW9kdWxlcy9mb3ItZWFjaC9ub2RlX21vZHVsZXMvaXMtZnVuY3Rpb24vaW5kZXguanMiLCIvaG9tZS9tZWFuZGF2ZS9Eb2N1bWVudHMvZHNwLXRhbGsvc2xpZGVzL25vZGVfbW9kdWxlcy9hdWRpb3NvdXJjZS9ub2RlX21vZHVsZXMveGhyL25vZGVfbW9kdWxlcy9wYXJzZS1oZWFkZXJzL25vZGVfbW9kdWxlcy90cmltL2luZGV4LmpzIiwiL2hvbWUvbWVhbmRhdmUvRG9jdW1lbnRzL2RzcC10YWxrL3NsaWRlcy9ub2RlX21vZHVsZXMvYXVkaW9zb3VyY2Uvbm9kZV9tb2R1bGVzL3hoci9ub2RlX21vZHVsZXMvcGFyc2UtaGVhZGVycy9wYXJzZS1oZWFkZXJzLmpzIiwiL2hvbWUvbWVhbmRhdmUvRG9jdW1lbnRzL2RzcC10YWxrL3NsaWRlcy9ub2RlX21vZHVsZXMvZHJhdy13YXZlL2luZGV4LmpzIiwiL2hvbWUvbWVhbmRhdmUvRG9jdW1lbnRzL2RzcC10YWxrL3NsaWRlcy9ub2RlX21vZHVsZXMvZHJhdy13YXZlL25vZGVfbW9kdWxlcy9zdmctY3JlYXRlLWVsZW1lbnQvaW5kZXguanMiLCIvaG9tZS9tZWFuZGF2ZS9Eb2N1bWVudHMvZHNwLXRhbGsvc2xpZGVzL25vZGVfbW9kdWxlcy9kcmF3LXdhdmUvbm9kZV9tb2R1bGVzL3N2Zy1jcmVhdGUtZWxlbWVudC9ub2RlX21vZHVsZXMvaGFzL3NyYy9pbmRleC5qcyIsIi9ob21lL21lYW5kYXZlL0RvY3VtZW50cy9kc3AtdGFsay9zbGlkZXMvbm9kZV9tb2R1bGVzL2RyYXctd2F2ZS9zdmcuanMiLCIvdXNyL2xpYi9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbGliL19lbXB0eS5qcyIsIi91c3IvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIi91c3IvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcGF0aC1icm93c2VyaWZ5L2luZGV4LmpzIiwiL3Vzci9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUpBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVEE7QUFDQTs7QUNEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0NBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9TQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgQXVkaW9Tb3VyY2UgPSByZXF1aXJlKCdhdWRpb3NvdXJjZScpO1xudmFyIEZGVCA9IHJlcXVpcmUoJ2F1ZGlvLWZmdCcpO1xudmFyIGRyYXdXYXZlID0gcmVxdWlyZSgnZHJhdy13YXZlJyk7XG52YXIgQXVkaW9Xb3JrZXJOb2RlID0gcmVxdWlyZSgnYXVkaW8td29ya2VyLW5vZGUnKTtcbnZhciBjdHggPSBuZXcgQXVkaW9Db250ZXh0KCk7XG5cbnZhciB0aW1lRkZUID0gbmV3IEZGVChjdHgsIHtcbiAgY2FudmFzOiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjdGltZScpLFxuICB0eXBlOiAndGltZSdcbn0pO1xuXG52YXIgZnJlcUZGVCA9IG5ldyBGRlQoY3R4LCB7XG4gIGNhbnZhczogZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2ZyZXF1ZW5jeScpXG59KTtcblxudmFyIHNyYyA9IG5ldyBBdWRpb1NvdXJjZSh7XG4gIHVybDogJ2Vsc2UtbWFyaWUubXAzJyxcbiAgY29udGV4dDogY3R4LFxuICBnYWluTm9kZTogY3R4LmNyZWF0ZUdhaW4oKSxcbiAgbm9kZXM6IFt0aW1lRkZULCBmcmVxRkZUXVxufSk7XG5cbnZhciBsb2FkQnRuID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2xvYWQtYXVkaW8nKTtcblxubG9hZEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uKGV2KSB7XG4gIGxvYWRCdG4uaW5uZXJUZXh0ID0gJ2xvYWRpbmcuLi4nO1xuICBpZiAoc3JjLnBsYXlpbmcpIHtcbiAgICBzcmMuc3RvcCgpO1xuICAgIGxvYWRCdG4uaW5uZXJUZXh0ID0gJ3N0b3BwZWQnO1xuICB9XG4gIGVsc2Ugc3JjLmxvYWQoKTtcbn0pXG5cbnZhciBwcm9ncmVzcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJy5wcm9ncmVzcy1jb250YWluJyk7XG5cbnNyYy5vbigndGltZScsIGZ1bmN0aW9uKHRpbWUpIHtcbiAgcHJvZ3Jlc3Muc3R5bGUud2lkdGggPSB0aW1lLnBlcmNlbnQ7XG59KVxuXG5zcmMub24oJ2xvYWQnLCBmdW5jdGlvbigpIHtcbiAgc3JjLnBsYXkoKTtcbiAgZHJhd1dhdmUuY2FudmFzKHByb2dyZXNzLnF1ZXJ5U2VsZWN0b3IoJyN3YXZlLXByb2dyZXNzJyksIHNyYy5idWZmZXIsICcjREY3OURGJyk7XG4gIGRyYXdXYXZlLmNhbnZhcyhkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjd2F2ZScpLCBzcmMuYnVmZmVyLCAnIzUyRjZBNCcpO1xuICBsb2FkQnRuLmlubmVyVGV4dCA9ICdMT0FERUQhJztcbn0pO1xuXG4vKlxuICpcbiAqIEFVRElPIFdPUktFUiBOT0RFXG4gKlxuICpcbiAqICovXG5cbnZhciBjcnVzaEJ0biA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNjcnVzaC1idXR0Jyk7XG5jcnVzaEJ0bi5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uKCkge1xuICBwbGF5Tm90ZShudWxsLCB0cnVlKTtcbn0pXG5cbnZhciBiaXRjcnVzaGVyTm9kZSA9IG5ldyBBdWRpb1dvcmtlck5vZGUoY3R4LCBcImJpdGNydXNoZXItd29ya2VyLmpzXCIsIDEsIDEpO1xuYml0Y3J1c2hlck5vZGUuYWRkUGFyYW1ldGVyKFwiYml0c1wiLCA4KTtcbi8vIEN1c3RvbSBwYXJhbWV0ZXIgLSBmcmVxdWVuY3kgcmVkdWN0aW9uLCAwLTEsIGRlZmF1bHQgMC41XG5iaXRjcnVzaGVyTm9kZS5hZGRQYXJhbWV0ZXIoXCJmcmVxdWVuY3lSZWR1Y3Rpb25cIiwgMC41KTtcblxudmFyIGJpdHMgPSA4O1xudmFyIGZyZXF1ZW5jeVJlZHVjdGlvbiA9IDAuNTtcblxuYml0Y3J1c2hlck5vZGUuYml0cy52YWx1ZSA9IGJpdHM7XG5iaXRjcnVzaGVyTm9kZS5mcmVxdWVuY3lSZWR1Y3Rpb24udmFsdWUgPSBmcmVxdWVuY3lSZWR1Y3Rpb247XG5cbi8vIFRPRE8oREopOiBwYXNzIHRoZXNlIGRpZiBjb2xvcnMuLi5cbnZhciB0aW1lRkZUMiA9IG5ldyBGRlQoY3R4LCB7XG4gIGNhbnZhczogZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI3RpbWUtYmMnKSxcbiAgdHlwZTogJ3RpbWUnXG59KTtcblxudmFyIGZyZXFGRlQyID0gbmV3IEZGVChjdHgsIHtcbiAgY2FudmFzOiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZnJlcXVlbmN5LWJjJylcbn0pO1xuXG5kb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjcGxheS1vZycpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24oKSB7XG4gIHBsYXlOb3RlKG51bGwpO1xufSk7XG5cbi8qXG4gKlxuICogcGxheWJhY2ssXG4gKiBhdWRpbyBncmFwaFxuICpcbiAqICovXG5cbmZ1bmN0aW9uIHBsYXlOb3RlKGZyZXEsIGNydXNoKSB7XG4gIGZyZXEgPSAoMjIwICogMS4wNTk0NjMgKiAyKTtcbiAgdmFyIG9zYyAgPSBjdHguY3JlYXRlT3NjaWxsYXRvcigpO1xuICB2YXIgZ2FpbiA9IGN0eC5jcmVhdGVHYWluKCk7XG4gIGdhaW4uZ2Fpbi52YWx1ZSA9IDE7XG4gIG9zYy50eXBlID0gJ3RyaWFuZ2xlJztcbiAgb3NjLmZyZXF1ZW5jeS52YWx1ZSA9IGZyZXE7XG4gIG9zYy5jb25uZWN0KGdhaW4pO1xuICBpZiAoY3J1c2gpIHtcbiAgICBnYWluLmNvbm5lY3QoYml0Y3J1c2hlck5vZGUpO1xuICAgIGJpdGNydXNoZXJOb2RlLmNvbm5lY3QodGltZUZGVDIuaW5wdXQpO1xuICAgIGJpdGNydXNoZXJOb2RlLmNvbm5lY3QoZnJlcUZGVDIuaW5wdXQpO1xuICB9IGVsc2Uge1xuICAgIGdhaW4uY29ubmVjdCh0aW1lRkZUMi5pbnB1dCk7XG4gICAgZ2Fpbi5jb25uZWN0KGZyZXFGRlQyLmlucHV0KTtcbiAgfVxuICB0aW1lRkZUMi5jb25uZWN0KGN0eC5kZXN0aW5hdGlvbik7XG4gIGZyZXFGRlQyLmNvbm5lY3QoY3R4LmRlc3RpbmF0aW9uKTtcbiAgb3NjLnN0YXJ0KCk7XG5cbiAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICBnYWluLmRpc2Nvbm5lY3QoY3R4LmRlc3RpbmF0aW9uKTtcbiAgICBvc2Muc3RvcCgwKTtcbiAgICBvc2MuZGlzY29ubmVjdChnYWluKTtcbiAgfSwgNDAwMCk7XG59XG4iLCIvKipcbiAqIHB1bGxlZCBmcm9tIEBqc2FudGVsbFxuICpcbiAqIGh0dHBzOi8vZ2l0aHViLmNvbS9qc2FudGVsbC9kc3Atd2l0aC13ZWItYXVkaW8tcHJlc2VudGF0aW9uL2Jsb2IvZ2gtcGFnZXMvZXhhbXBsZXMvRkZULmpzXG4gKlxuICovXG5cbnZhciBNQVhfVUlOVDggPSAyNTU7XG5cbm1vZHVsZS5leHBvcnRzID0gRkZUO1xuXG5mdW5jdGlvbiBGRlQgKGN0eCwgb3B0aW9ucykge1xuICB2YXIgbW9kdWxlID0gdGhpcztcbiAgdGhpcy5maWxsU3R5bGUgPSBvcHRpb25zLmZpbGxTdHlsZSB8fCAnIzAwMDAwMCc7XG4gIHRoaXMuc3Ryb2tlU3R5bGUgPSBvcHRpb25zLnN0cm9rZVN0eWxlIHx8ICcjMDAwMDAwJztcbiAgdGhpcy5jYW52YXMgPSBvcHRpb25zLmNhbnZhcztcbiAgdGhpcy5vbkJlYXQgPSBvcHRpb25zLm9uQmVhdDtcbiAgdGhpcy5vZmZCZWF0ID0gb3B0aW9ucy5vZmZCZWF0O1xuICB0aGlzLnR5cGUgPSBvcHRpb25zLnR5cGUgfHwgJ2ZyZXF1ZW5jeSc7XG4gIHRoaXMuc3BhY2luZyA9IG9wdGlvbnMuc3BhY2luZyB8fCAxO1xuICB0aGlzLndpZHRoID0gb3B0aW9ucy53aWR0aCB8fCAxO1xuICB0aGlzLmNvdW50ID0gb3B0aW9ucy5jb3VudCB8fCA1MTI7XG4gIHRoaXMuaW5wdXQgPSB0aGlzLm91dHB1dCA9IGN0eC5jcmVhdGVBbmFseXNlcigpO1xuICB0aGlzLnByb2MgPSBjdHguY3JlYXRlU2NyaXB0UHJvY2Vzc29yKDI1NiwgMSwgMSk7XG4gIHRoaXMuZGF0YSA9IG5ldyBVaW50OEFycmF5KHRoaXMuaW5wdXQuZnJlcXVlbmN5QmluQ291bnQpO1xuICB0aGlzLmN0eCA9IHRoaXMuY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG5cbiAgdGhpcy5kZWNheSA9IG9wdGlvbnMuZGVjYXkgfHwgMC4wMDI7XG4gIHRoaXMudGhyZXNob2xkID0gb3B0aW9ucy50aHJlc2hvbGQgfHwgMC41O1xuICB0aGlzLnJhbmdlID0gb3B0aW9ucy5yYW5nZSB8fCBbMCwgdGhpcy5kYXRhLmxlbmd0aC0xXTtcbiAgdGhpcy53YWl0ID0gb3B0aW9ucy53YWl0IHx8IDUxMjtcblxuICB0aGlzLmggPSB0aGlzLmNhbnZhcy5oZWlnaHQ7XG4gIHRoaXMudyA9IHRoaXMuY2FudmFzLndpZHRoO1xuXG4gIHRoaXMuaW5wdXQuY29ubmVjdCh0aGlzLnByb2MpO1xuICB0aGlzLnByb2Mub25hdWRpb3Byb2Nlc3MgPSBwcm9jZXNzLmJpbmQobnVsbCwgbW9kdWxlKTtcbiAgdGhpcy5jdHgubGluZVdpZHRoID0gbW9kdWxlLndpZHRoO1xufVxuXG5GRlQucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbiAobm9kZSkge1xuICB0aGlzLm91dHB1dC5jb25uZWN0KG5vZGUpO1xuICB0aGlzLnByb2MuY29ubmVjdChub2RlKTtcbn1cblxuZnVuY3Rpb24gcHJvY2VzcyAobW9kdWxlKSB7XG5cbiAgdmFyIGN0eCA9IG1vZHVsZS5jdHg7XG4gIHZhciBkYXRhID0gbW9kdWxlLmRhdGE7XG4gIGN0eC5jbGVhclJlY3QoMCwgMCwgbW9kdWxlLncsIG1vZHVsZS5oKTtcbiAgY3R4LmZpbGxTdHlsZSA9IG1vZHVsZS5maWxsU3R5bGUgfHwgJyMwMDAwMDAnO1xuICBjdHguc3Ryb2tlU3R5bGUgPSBtb2R1bGUuc3Ryb2tlU3R5bGUgfHwgJyMwMDAwMDAnO1xuXG4gIGlmIChtb2R1bGUudHlwZSA9PT0gJ2ZyZXF1ZW5jeScpIHtcbiAgICBtb2R1bGUuaW5wdXQuZ2V0Qnl0ZUZyZXF1ZW5jeURhdGEoZGF0YSk7XG4gICAgLy8gQWJvcnQgaWYgbm8gZGF0YSBjb21pbmcgdGhyb3VnaCwgcXVpY2sgaGFjaywgbmVlZHMgZml4ZWRcbiAgICBpZiAobW9kdWxlLmRhdGFbM10gPCA1KSByZXR1cm47XG5cbiAgICBmb3IgKHZhciBpPSAwLCBsID0gZGF0YS5sZW5ndGg7IGkgPCBsICYmIGkgPCBtb2R1bGUuY291bnQ7IGkrKykge1xuICAgICAgY3R4LmZpbGxSZWN0KFxuICAgICAgICBpICogKG1vZHVsZS5zcGFjaW5nICsgbW9kdWxlLndpZHRoKSxcbiAgICAgICAgbW9kdWxlLmgsXG4gICAgICAgIG1vZHVsZS53aWR0aCxcbiAgICAgICAgLShtb2R1bGUuaCAvIE1BWF9VSU5UOCkgKiBkYXRhW2ldXG4gICAgICApO1xuICAgIH1cbiAgfSBlbHNlIGlmIChtb2R1bGUudHlwZSA9PT0gJ3RpbWUnKSB7XG4gICAgbW9kdWxlLmlucHV0LmdldEJ5dGVUaW1lRG9tYWluRGF0YShkYXRhKTtcbiAgICBjdHguYmVnaW5QYXRoKCk7XG4gICAgY3R4Lm1vdmVUbygwLCBtb2R1bGUuaCAvIDIpO1xuICAgIGZvciAodmFyIGk9IDAsIGwgPSBkYXRhLmxlbmd0aDsgaSA8IGwgJiYgaSA8IG1vZHVsZS5jb3VudDsgaSsrKSB7XG4gICAgICBjdHgubGluZVRvKFxuICAgICAgICBpICogKG1vZHVsZS5zcGFjaW5nICsgbW9kdWxlLndpZHRoKSxcbiAgICAgICAgKG1vZHVsZS5oIC8gTUFYX1VJTlQ4KSAqIGRhdGFbaV1cbiAgICAgICk7XG4gICAgfVxuICAgIGN0eC5zdHJva2UoKTtcbiAgICBjdHguY2xvc2VQYXRoKCk7XG4gIH1cbn1cbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcblwidXNlIHN0cmljdFwiO1xuXG4vKipcbiAqICBBdWRpb1BhcmFtSW1wbFxuICogICstLS0tLS0tLS0tLS0tLS0tLStcbiAqICB8IEdhaW5Ob2RlKGlubGV0KSB8XG4gKiAgfCBnYWluOiB2YWx1ZSAgICAgfFxuICogICstLS0tLS0tLS0tLS0tLS0tLStcbiAqICAgIHxcbiAqICArLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0rXG4gKiAgfCBTY3JpcHRQcm9jZXNzb3JOb2RlKG91dGxldCkgfFxuICogICstLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLStcbiAqL1xuZnVuY3Rpb24gQXVkaW9QYXJhbUltcGwoYXVkaW9Db250ZXh0LCBkZWZhdWx0VmFsdWUsIGJ1ZmZlclNpemUpIHtcbiAgdGhpcy5pbmxldCA9IGF1ZGlvQ29udGV4dC5jcmVhdGVHYWluKCk7XG4gIHRoaXMub3V0bGV0ID0gYXVkaW9Db250ZXh0LmNyZWF0ZVNjcmlwdFByb2Nlc3NvcihidWZmZXJTaXplLCAxLCAxKTtcblxuICB0aGlzLnBhcmFtID0gdGhpcy5pbmxldC5nYWluO1xuICB0aGlzLnBhcmFtLnZhbHVlID0gZGVmYXVsdFZhbHVlO1xuICB0aGlzLmFycmF5ID0gbmV3IEZsb2F0MzJBcnJheShidWZmZXJTaXplKTtcblxuICB0aGlzLmlubGV0LmNvbm5lY3QodGhpcy5vdXRsZXQpO1xuXG4gIHZhciBhcnJheSA9IHRoaXMuYXJyYXk7XG4gIHRoaXMub3V0bGV0Lm9uYXVkaW9wcm9jZXNzID0gZnVuY3Rpb24oZSkge1xuICAgIGFycmF5LnNldChlLmlucHV0QnVmZmVyLmdldENoYW5uZWxEYXRhKDApKTtcbiAgfTtcbn1cblxuQXVkaW9QYXJhbUltcGwucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbihkZXN0aW5hdGlvbikge1xuICBnbG9iYWwuQXVkaW9Ob2RlLnByb3RvdHlwZS5jb25uZWN0LmNhbGwodGhpcy5vdXRsZXQsIGRlc3RpbmF0aW9uKTtcbn07XG5cbkF1ZGlvUGFyYW1JbXBsLnByb3RvdHlwZS5kaXNjb25uZWN0ID0gZnVuY3Rpb24oKSB7XG4gIGdsb2JhbC5BdWRpb05vZGUucHJvdG90eXBlLmRpc2Nvbm5lY3QuY2FsbCh0aGlzLm91dGxldCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1ZGlvUGFyYW1JbXBsO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIEF1ZGlvUGFyYW1JbXBsID0gcmVxdWlyZShcIi4vYXVkaW8tcGFyYW0taW1wbFwiKTtcblxuZnVuY3Rpb24gQXVkaW9QYXJhbU5vZGUoYXVkaW9Db250ZXh0LCBkZWZhdWx0VmFsdWUsIGJ1ZmZlclNpemUpIHtcbiAgdmFyIGltcGwgPSBuZXcgQXVkaW9QYXJhbUltcGwoYXVkaW9Db250ZXh0LCBkZWZhdWx0VmFsdWUsIGJ1ZmZlclNpemUpO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKGltcGwuaW5sZXQsIHtcbiAgICBwYXJhbToge1xuICAgICAgdmFsdWU6IGltcGwucGFyYW0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBhcnJheToge1xuICAgICAgdmFsdWU6IGltcGwuYXJyYXksXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBjb25uZWN0OiB7XG4gICAgICB2YWx1ZTogZnVuY3Rpb24oZGVzdGluYXRpb24pIHtcbiAgICAgICAgaW1wbC5jb25uZWN0KGRlc3RpbmF0aW9uKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIGRpc2Nvbm5lY3Q6IHtcbiAgICAgIHZhbHVlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgaW1wbC5kaXNjb25uZWN0KCk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gaW1wbC5pbmxldDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBBdWRpb1BhcmFtTm9kZTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgQXVkaW9Qcm9jZXNzQnVpbGRlciA9IHt9O1xuXG5BdWRpb1Byb2Nlc3NCdWlsZGVyLmJ1aWxkID0gZnVuY3Rpb24ob3B0cykge1xuICB2YXIgbnVtT2ZJbnB1dCA9IG9wdHMubnVtT2ZJbnB1dDtcbiAgdmFyIG51bU9mT3V0cHV0ID0gb3B0cy5udW1PZk91dHB1dDtcblxuICBpZiAobnVtT2ZJbnB1dCA9PT0gMSAmJiBudW1PZk91dHB1dCA9PT0gMSkge1xuICAgIHJldHVybiBidWlsZF9vbmF1ZGlvcHJvY2Vzc18xKG9wdHMpO1xuICB9XG4gIGlmIChudW1PZklucHV0ID09PSAyICYmIG51bU9mT3V0cHV0ID09PSAyKSB7XG4gICAgcmV0dXJuIGJ1aWxkX29uYXVkaW9wcm9jZXNzXzIob3B0cyk7XG4gIH1cbiAgcmV0dXJuIGJ1aWxkX29uYXVkaW9wcm9jZXNzX24ob3B0cyk7XG59O1xuXG5mdW5jdGlvbiBidWlsZF9vbmF1ZGlvcHJvY2Vzc18xKG9wdHMpIHtcbiAgdmFyIGZ1bmMgPSBvcHRzLmZ1bmM7XG4gIHZhciBzY29wZSA9IG9wdHMuc2NvcGU7XG4gIHZhciBwYXJhbWV0ZXJzID0gb3B0cy5wYXJhbWV0ZXJzO1xuXG4gIHJldHVybiBmdW5jdGlvbihlKSB7XG4gICAgZS5pbnB1dEJ1ZmZlcnMgPSBbXG4gICAgICBlLmlucHV0QnVmZmVyLmdldENoYW5uZWxEYXRhKDApXG4gICAgXTtcbiAgICBlLm91dHB1dEJ1ZmZlcnMgPSBbXG4gICAgICBlLm91dHB1dEJ1ZmZlci5nZXRDaGFubmVsRGF0YSgwKVxuICAgIF07XG4gICAgZS5wYXJhbWV0ZXJzID0gcGFyYW1ldGVycztcblxuICAgIGZ1bmMuY2FsbChzY29wZSwgZSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIGJ1aWxkX29uYXVkaW9wcm9jZXNzXzIob3B0cykge1xuICB2YXIgZnVuYyA9IG9wdHMuZnVuYztcbiAgdmFyIHNjb3BlID0gb3B0cy5zY29wZTtcbiAgdmFyIHBhcmFtZXRlcnMgPSBvcHRzLnBhcmFtZXRlcnM7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKGUpIHtcbiAgICB2YXIgaW5wID0gZS5pbnB1dEJ1ZmZlcjtcbiAgICB2YXIgb3V0ID0gZS5vdXRwdXRCdWZmZXI7XG4gICAgZS5pbnB1dEJ1ZmZlcnMgPSBbXG4gICAgICBpbnAuZ2V0Q2hhbm5lbERhdGEoMCksXG4gICAgICBpbnAuZ2V0Q2hhbm5lbERhdGEoMSlcbiAgICBdO1xuICAgIGUub3V0cHV0QnVmZmVycyA9IFtcbiAgICAgIG91dC5nZXRDaGFubmVsRGF0YSgwKSxcbiAgICAgIG91dC5nZXRDaGFubmVsRGF0YSgxKVxuICAgIF07XG4gICAgZS5wYXJhbWV0ZXJzID0gcGFyYW1ldGVycztcblxuICAgIGZ1bmMuY2FsbChzY29wZSwgZSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIGJ1aWxkX29uYXVkaW9wcm9jZXNzX24ob3B0cykge1xuICB2YXIgZnVuYyA9IG9wdHMuZnVuYztcbiAgdmFyIHNjb3BlID0gb3B0cy5zY29wZTtcbiAgdmFyIG51bU9mSW5wdXQgPSBvcHRzLm51bU9mSW5wdXQ7XG4gIHZhciBudW1PZk91dHB1dCA9IG9wdHMubnVtT2ZPdXRwdXQ7XG4gIHZhciBwYXJhbWV0ZXJzID0gb3B0cy5wYXJhbWV0ZXJzO1xuXG4gIHJldHVybiBmdW5jdGlvbihlKSB7XG4gICAgdmFyIGlucHV0QnVmZmVycyA9IG5ldyBBcnJheShudW1PZklucHV0KTtcbiAgICB2YXIgb3V0cHV0QnVmZmVycyA9IG5ldyBBcnJheShudW1PZk91dHB1dCk7XG4gICAgdmFyIGk7XG5cbiAgICBmb3IgKGkgPSAwOyBpIDwgbnVtT2ZJbnB1dDsgaSsrKSB7XG4gICAgICBpbnB1dEJ1ZmZlcnNbaV0gPSBlLmlucHV0QnVmZmVyLmdldENoYW5uZWxEYXRhKGkpO1xuICAgIH1cbiAgICBmb3IgKGkgPSAwOyBpIDwgbnVtT2ZPdXRwdXQ7IGkrKykge1xuICAgICAgb3V0cHV0QnVmZmVyc1tpXSA9IGUub3V0cHV0QnVmZmVyLmdldENoYW5uZWxEYXRhKGkpO1xuICAgIH1cblxuICAgIGUuaW5wdXRCdWZmZXJzID0gaW5wdXRCdWZmZXJzO1xuICAgIGUub3V0cHV0QnVmZmVycyA9IG91dHB1dEJ1ZmZlcnM7XG4gICAgZS5wYXJhbWV0ZXJzID0gcGFyYW1ldGVycztcblxuICAgIGZ1bmMuY2FsbChzY29wZSwgZSk7XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gQXVkaW9Qcm9jZXNzQnVpbGRlcjtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgV09SS0VSX0FUVFJTID0gW1xuICBcIm9uYXVkaW9wcm9jZXNzXCIsXG4gIFwic2FtcGxlUmF0ZVwiLFxuICBcInNlbGZcIixcbiAgXCJvbm1lc3NhZ2VcIixcbiAgXCJwb3N0TWVzc2FnZVwiLFxuICBcImNsb3NlXCIsXG4gIFwiaW1wb3J0U2NyaXB0c1wiLFxuXTtcblxudmFyIEF1ZGlvV29ya2VyQ29kZSA9IHt9O1xuXG5BdWRpb1dvcmtlckNvZGUudG9rZW5zID0gZnVuY3Rpb24oc3JjKSB7XG4gIHZhciBwb3MgPSAwO1xuICB2YXIgdG9rZW5zID0gW107XG5cbiAgZnVuY3Rpb24gZWF0KHJlKSB7XG4gICAgd2hpbGUgKHBvcyA8IHNyYy5sZW5ndGgpIHtcbiAgICAgIHZhciBjaCA9IHNyYy5jaGFyQXQocG9zKTtcbiAgICAgIGlmICghcmUudGVzdChjaCkpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBwb3MgKz0gMTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBlYXRTdHJpbmcocXVvdGUpIHtcbiAgICB3aGlsZSAocG9zIDwgc3JjLmxlbmd0aCkge1xuICAgICAgdmFyIGNoID0gc3JjLmNoYXJBdChwb3MrKyk7XG4gICAgICBpZiAoY2ggPT09IHF1b3RlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGlmIChjaCA9PT0gXCJcXFxcXCIpIHtcbiAgICAgICAgcG9zICs9IDE7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGlzdGFuYnVsIGlnbm9yZSBuZXh0XG4gICAgdGhyb3cgbmV3IFN5bnRheEVycm9yKFwiVW5leHBlY3RlZCB0b2tlbiBJTExFR0FMXCIpO1xuICB9XG5cbiAgZnVuY3Rpb24gZWF0TXVsdGlMaW5lQ29tbWVudCgpIHtcbiAgICBwb3MgKz0gMTtcbiAgICB3aGlsZSAocG9zIDwgc3JjLmxlbmd0aCkge1xuICAgICAgdmFyIGNoID0gc3JjLmNoYXJBdChwb3MrKyk7XG4gICAgICBpZiAoY2ggPT09IFwiKlwiICYmIHNyYy5jaGFyQXQocG9zKSA9PT0gXCIvXCIpIHtcbiAgICAgICAgcG9zICs9IDE7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gaXN0YW5idWwgaWdub3JlIG5leHRcbiAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoXCJVbmV4cGVjdGVkIHRva2VuIElMTEVHQUxcIik7XG4gIH1cblxuICB3aGlsZSAocG9zIDwgc3JjLmxlbmd0aCkge1xuICAgIHZhciBiZWdpbiA9IHBvcztcbiAgICB2YXIgY2ggPSBzcmMuY2hhckF0KHBvcysrKTtcblxuICAgIGlmICgvXFxzLy50ZXN0KGNoKSkge1xuICAgICAgZWF0KC9cXHMvKTtcbiAgICB9IGVsc2UgaWYgKC9bYS16QS1aXyRdLy50ZXN0KGNoKSkge1xuICAgICAgZWF0KC9bXFx3JF0vKTtcbiAgICB9IGVsc2UgaWYgKC9cXGQvLnRlc3QoY2gpKSB7XG4gICAgICBlYXQoL1suXFxkXS8pO1xuICAgIH0gZWxzZSBpZiAoL1snXCJdLy50ZXN0KGNoKSkge1xuICAgICAgZWF0U3RyaW5nKGNoKTtcbiAgICB9IGVsc2UgaWYgKGNoID09PSBcIi9cIikge1xuICAgICAgY2ggPSBzcmMuY2hhckF0KHBvcyk7XG4gICAgICBpZiAoY2ggPT09IFwiL1wiKSB7XG4gICAgICAgIGVhdCgvW15cXG5dLyk7XG4gICAgICB9IGVsc2UgaWYgKGNoID09PSBcIipcIikge1xuICAgICAgICBlYXRNdWx0aUxpbmVDb21tZW50KCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdG9rZW5zLnB1c2goc3JjLnNsaWNlKGJlZ2luLCBwb3MpKTtcbiAgfVxuXG4gIHJldHVybiB0b2tlbnM7XG59O1xuXG5BdWRpb1dvcmtlckNvZGUuZmlsdGVyID0gZnVuY3Rpb24oc3JjKSB7XG4gIHZhciB0b2tlbnMgPSBBdWRpb1dvcmtlckNvZGUudG9rZW5zKHNyYyk7XG5cbiAgZnVuY3Rpb24gcHJldlRva2VuKGluZGV4KSB7XG4gICAgd2hpbGUgKGluZGV4LS0pIHtcbiAgICAgIGlmICgvW1xcUy9dLy50ZXN0KHRva2Vuc1tpbmRleF0uY2hhckF0KDApKSkge1xuICAgICAgICByZXR1cm4gdG9rZW5zW2luZGV4XTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIFwiXCI7XG4gIH1cblxuICBXT1JLRVJfQVRUUlMuZm9yRWFjaChmdW5jdGlvbihhdHRyKSB7XG4gICAgdmFyIHBvcyA9IDA7XG4gICAgdmFyIGluZGV4O1xuXG4gICAgd2hpbGUgKChpbmRleCA9IHRva2Vucy5pbmRleE9mKGF0dHIsIHBvcykpICE9PSAtMSkge1xuICAgICAgaWYgKHByZXZUb2tlbihpbmRleCkgIT09IFwiLlwiKSB7XG4gICAgICAgIHRva2Vuc1tpbmRleF0gPSBcIl9fc2VsZi5cIiArIHRva2Vuc1tpbmRleF07XG4gICAgICB9XG4gICAgICBwb3MgPSBpbmRleCArIDE7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gdG9rZW5zLmpvaW4oXCJcIik7XG59O1xuXG5BdWRpb1dvcmtlckNvZGUuY29tcGlsZSA9IGZ1bmN0aW9uKHNyYykge1xuICB2YXIgY29kZSA9IFtcbiAgICBcIihmdW5jdGlvbihfX3NlbGYpIHsgJ3VzZSBzdHJpY3QnO1wiLFxuICAgIEF1ZGlvV29ya2VyQ29kZS5maWx0ZXIoc3JjKSxcbiAgICBcIn0pXCJcbiAgXS5qb2luKFwiXFxuXCIpO1xuICByZXR1cm4gZXZhbC5jYWxsKG51bGwsIGNvZGUpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdWRpb1dvcmtlckNvZGU7XG4iLCJcInVzZSBzdHJpY3RcIjtcblxuZnVuY3Rpb24gQXVkaW9Xb3JrZXJHbG9iYWxTY29wZShub2RlKSB7XG4gIHZhciBvbmF1ZGlvcHJvY2VzcyA9IG51bGw7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgIHNlbGY6IHtcbiAgICAgIHZhbHVlOiB0aGlzLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgc2FtcGxlUmF0ZToge1xuICAgICAgdmFsdWU6IG5vZGUuc2FtcGxlUmF0ZSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9LFxuICAgIG9uYXVkaW9wcm9jZXNzOiB7XG4gICAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgIHZhbHVlID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBub2RlLm9uYXVkaW9wcm9jZXNzKHZhbHVlKTtcbiAgICAgICAgb25hdWRpb3Byb2Nlc3MgPSB2YWx1ZTtcbiAgICAgIH0sXG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gb25hdWRpb3Byb2Nlc3M7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgb25tZXNzYWdlOiB7XG4gICAgICBzZXQ6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgIHZhbHVlID0gdmFsdWUuYmluZCh0aGlzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YWx1ZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgbm9kZS5wb3J0Mi5vbm1lc3NhZ2UgPSB2YWx1ZTtcbiAgICAgIH0sXG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gbm9kZS5wb3J0Mi5vbm1lc3NhZ2U7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgcG9zdE1lc3NhZ2U6IHtcbiAgICAgIHZhbHVlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgbm9kZS5wb3J0Mi5wb3N0TWVzc2FnZS5hcHBseShub2RlLnBvcnQyLCBhcmd1bWVudHMpO1xuICAgICAgfVxuICAgIH0sXG4gICAgY2xvc2U6IHtcbiAgICAgIHZhbHVlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgbm9kZS5jbG9zZS5hcHBseShub2RlLCBhcmd1bWVudHMpO1xuICAgICAgfVxuICAgIH0sXG4gICAgaW1wb3J0U2NyaXB0czoge1xuICAgICAgdmFsdWU6IGZ1bmN0aW9uKCkge1xuICAgICAgICBub2RlLmltcG9ydFNjcmlwdHMuYXBwbHkobm9kZSwgYXJndW1lbnRzKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEF1ZGlvV29ya2VyR2xvYmFsU2NvcGU7XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG5cInVzZSBzdHJpY3RcIjtcblxudmFyIEF1ZGlvUGFyYW1Ob2RlID0gcmVxdWlyZShcIi4vYXVkaW8tcGFyYW0tbm9kZVwiKTtcbnZhciBBdWRpb1dvcmtlckdsb2JhbFNjb3BlID0gcmVxdWlyZShcIi4vYXVkaW8td29ya2VyLWdsb2JhbC1zY29wZVwiKTtcbnZhciBBdWRpb1Byb2Nlc3NCdWlsZGVyID0gcmVxdWlyZShcIi4vYXVkaW8tcHJvY2Vzcy1idWlsZGVyXCIpO1xudmFyIFNjcmlwdExvYWRlciA9IHJlcXVpcmUoXCIuL3NjcmlwdC1sb2FkZXJcIik7XG52YXIgQXVkaW9Xb3JrZXJDb2RlID0gcmVxdWlyZShcIi4vYXVkaW8td29ya2VyLWNvZGVcIik7XG52YXIgTWVzc2FnZUNoYW5uZWwgPSByZXF1aXJlKFwiLi9tZXNzYWdlLWNoYW5uZWxcIik7XG5cbnZhciBCVUZGRVJfU0laRSA9IDEwMjQ7XG5cbmZ1bmN0aW9uIEF1ZGlvV29ya2VyTm9kZUltcGwoYXVkaW9Db250ZXh0LCBzY3JpcHRVUkwsIG51bU9mSW5wdXQsIG51bU9mT3V0cHV0KSB7XG4gIHZhciBjaCA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpO1xuXG4gIHRoaXMuYXVkaW9Db250ZXh0ID0gYXVkaW9Db250ZXh0O1xuICB0aGlzLnNhbXBsZVJhdGUgPSBhdWRpb0NvbnRleHQuc2FtcGxlUmF0ZTtcbiAgdGhpcy5pbmxldCA9IGF1ZGlvQ29udGV4dC5jcmVhdGVTY3JpcHRQcm9jZXNzb3IoQlVGRkVSX1NJWkUsIG51bU9mSW5wdXQsIG51bU9mT3V0cHV0KTtcbiAgdGhpcy5vdXRsZXQgPSB0aGlzLmlubGV0O1xuICB0aGlzLnBvcnQxID0gY2gucG9ydDE7XG4gIHRoaXMucG9ydDIgPSBjaC5wb3J0MjtcbiAgdGhpcy5zY29wZSA9IG5ldyBBdWRpb1dvcmtlckdsb2JhbFNjb3BlKHRoaXMpO1xuXG4gIHRoaXMuX251bU9mSW5wdXQgPSBudW1PZklucHV0O1xuICB0aGlzLl9udW1PZk91dHB1dCA9IG51bU9mT3V0cHV0O1xuICB0aGlzLl9pc0Nvbm5lY3RlZCA9IGZhbHNlO1xuICB0aGlzLl9pc1Rlcm1pbmF0ZWQgPSBmYWxzZTtcbiAgdGhpcy5fc2lsZW5jZXIgPSBudWxsO1xuICB0aGlzLl9kYzFidWZmZXIgPSBudWxsO1xuICB0aGlzLl9kYzEgPSBudWxsO1xuICB0aGlzLl9wYXJhbXMgPSB7fTtcbiAgdGhpcy5fcGFyYW1ldGVycyA9IHt9O1xuXG4gIHZhciBzY29wZSA9IHRoaXMuc2NvcGU7XG4gIFNjcmlwdExvYWRlci5sb2FkKHNjcmlwdFVSTCwgZnVuY3Rpb24oc2NyaXB0KSB7XG4gICAgdHJ5IHtcbiAgICAgIEF1ZGlvV29ya2VyQ29kZS5jb21waWxlKHNjcmlwdCkuY2FsbChzY29wZSwgc2NvcGUpO1xuICAgIH0gY2F0Y2ggKGUpIHt9XG4gIH0pO1xufVxuXG5BdWRpb1dvcmtlck5vZGVJbXBsLnByb3RvdHlwZS5jb25uZWN0ID0gZnVuY3Rpb24oZGVzdGluYXRpb24pIHtcbiAgdmFyIGF1ZGlvQ29udGV4dCA9IHRoaXMuYXVkaW9Db250ZXh0O1xuXG4gIGlmICghdGhpcy5faXNDb25uZWN0ZWQpIHtcbiAgICB0aGlzLl9kYzFidWZmZXIgPSBhdWRpb0NvbnRleHQuY3JlYXRlQnVmZmVyKDEsIDIsIGF1ZGlvQ29udGV4dC5zYW1wbGVSYXRlKTtcbiAgICB0aGlzLl9kYzFidWZmZXIuZ2V0Q2hhbm5lbERhdGEoMCkuc2V0KFsgMSwgMSBdKTtcblxuICAgIHRoaXMuX2RjMSA9IGF1ZGlvQ29udGV4dC5jcmVhdGVCdWZmZXJTb3VyY2UoKTtcbiAgICB0aGlzLl9kYzEuYnVmZmVyID0gdGhpcy5fZGMxYnVmZmVyO1xuICAgIHRoaXMuX2RjMS5sb29wID0gdHJ1ZTtcbiAgICB0aGlzLl9kYzEuc3RhcnQoYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lKTtcblxuICAgIE9iamVjdC5rZXlzKHRoaXMuX3BhcmFtcykuZm9yRWFjaChmdW5jdGlvbihuYW1lKSB7XG4gICAgICB0aGlzLl9kYzEuY29ubmVjdCh0aGlzLl9wYXJhbXNbbmFtZV0pO1xuICAgIH0sIHRoaXMpO1xuXG4gICAgdGhpcy5faXNDb25uZWN0ZWQgPSB0cnVlO1xuICB9XG5cbiAgZ2xvYmFsLkF1ZGlvTm9kZS5wcm90b3R5cGUuY29ubmVjdC5jYWxsKHRoaXMuaW5sZXQsIGRlc3RpbmF0aW9uKTtcbn07XG5cbkF1ZGlvV29ya2VyTm9kZUltcGwucHJvdG90eXBlLmRpc2Nvbm5lY3QgPSBmdW5jdGlvbigpIHtcbiAgdmFyIGF1ZGlvQ29udGV4dCA9IHRoaXMuYXVkaW9Db250ZXh0O1xuXG4gIGlmICh0aGlzLl9pc0Nvbm5lY3RlZCkge1xuICAgIHRoaXMuX2RjMS5zdG9wKGF1ZGlvQ29udGV4dC5jdXJyZW50VGltZSk7XG4gICAgdGhpcy5fZGMxLmRpc2Nvbm5lY3QoKTtcblxuICAgIHRoaXMuX2RjMWJ1ZmZlciA9IG51bGw7XG4gICAgdGhpcy5fZGMxID0gbnVsbDtcbiAgICB0aGlzLl9pc0Nvbm5lY3RlZCA9IGZhbHNlO1xuICB9XG5cbiAgZ2xvYmFsLkF1ZGlvTm9kZS5wcm90b3R5cGUuZGlzY29ubmVjdC5jYWxsKHRoaXMub3V0bGV0KTtcbn07XG5cbkF1ZGlvV29ya2VyTm9kZUltcGwucHJvdG90eXBlLnRlcm1pbmF0ZSA9IGZ1bmN0aW9uKCkge1xuICBpZiAoIXRoaXMuX2lzVGVybWluYXRlZCkge1xuICAgIHRoaXMuaW5sZXQub25hdWRpb3Byb2Nlc3MgPSBudWxsO1xuICAgIHRoaXMucG9ydDEuY2xvc2UoKTtcbiAgICB0aGlzLnBvcnQyLmNsb3NlKCk7XG4gICAgdGhpcy5faXNUZXJtaW5hdGVkID0gdHJ1ZTtcbiAgfVxufTtcblxuQXVkaW9Xb3JrZXJOb2RlSW1wbC5wcm90b3R5cGUuYWRkUGFyYW1ldGVyID0gZnVuY3Rpb24obmFtZSwgZGVmYXVsdFZhbHVlKSB7XG4gIHZhciBhdWRpb0NvbnRleHQgPSB0aGlzLmF1ZGlvQ29udGV4dDtcblxuICBpZiAodGhpcy5fcGFyYW1zLmhhc093blByb3BlcnR5KG5hbWUpKSB7XG4gICAgcmV0dXJuIHRoaXMuX3BhcmFtc1tuYW1lXS5wYXJhbTtcbiAgfVxuXG4gIGlmICh0aGlzLl9zaWxlbmNlciA9PT0gbnVsbCkge1xuICAgIHRoaXMuX3NpbGVuY2VyID0gYXVkaW9Db250ZXh0LmNyZWF0ZUdhaW4oKTtcbiAgICB0aGlzLl9zaWxlbmNlci5nYWluLnZhbHVlID0gMDtcbiAgICB0aGlzLl9zaWxlbmNlci5jb25uZWN0KHRoaXMub3V0bGV0KTtcbiAgfVxuXG4gIHZhciBwYXJhbU5vZGUgPSBuZXcgQXVkaW9QYXJhbU5vZGUoYXVkaW9Db250ZXh0LCBkZWZhdWx0VmFsdWUsIEJVRkZFUl9TSVpFKTtcblxuICBwYXJhbU5vZGUuY29ubmVjdCh0aGlzLl9zaWxlbmNlcik7XG5cbiAgaWYgKHRoaXMuX2lzQ29ubmVjdGVkKSB7XG4gICAgdGhpcy5fZGMxLmNvbm5lY3QocGFyYW1Ob2RlKTtcbiAgfVxuXG4gIHRoaXMuX3BhcmFtc1tuYW1lXSA9IHBhcmFtTm9kZTtcbiAgdGhpcy5fcGFyYW1ldGVyc1tuYW1lXSA9IHBhcmFtTm9kZS5hcnJheTtcblxuICByZXR1cm4gcGFyYW1Ob2RlLnBhcmFtO1xufTtcblxuQXVkaW9Xb3JrZXJOb2RlSW1wbC5wcm90b3R5cGUuZ2V0UGFyYW1ldGVyID0gZnVuY3Rpb24obmFtZSkge1xuICByZXR1cm4gdGhpcy5fcGFyYW1zW25hbWVdICYmIHRoaXMuX3BhcmFtc1tuYW1lXS5wYXJhbTtcbn07XG5cbkF1ZGlvV29ya2VyTm9kZUltcGwucHJvdG90eXBlLnJlbW92ZVBhcmFtZXRlciA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgaWYgKCF0aGlzLl9wYXJhbXMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB0aGlzLl9wYXJhbXNbbmFtZV0uZGlzY29ubmVjdCgpO1xuXG4gIGRlbGV0ZSB0aGlzLl9wYXJhbXNbbmFtZV07XG4gIGRlbGV0ZSB0aGlzLl9wYXJhbWV0ZXJzW25hbWVdO1xuXG4gIGlmIChPYmplY3Qua2V5cyh0aGlzLl9wYXJhbXMpLmxlbmd0aCA9PT0gMCkge1xuICAgIHRoaXMuX3NpbGVuY2VyLmRpc2Nvbm5lY3QoKTtcbiAgICB0aGlzLl9zaWxlbmNlciA9IG51bGw7XG4gIH1cbn07XG5cbkF1ZGlvV29ya2VyTm9kZUltcGwucHJvdG90eXBlLm9uYXVkaW9wcm9jZXNzID0gZnVuY3Rpb24oZnVuYykge1xuICBpZiAodGhpcy5faXNUZXJtaW5hdGVkIHx8IHR5cGVvZiBmdW5jICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICB0aGlzLmlubGV0Lm9uYXVkaW9wcm9jZXNzID0gbnVsbDtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLmlubGV0Lm9uYXVkaW9wcm9jZXNzID0gQXVkaW9Qcm9jZXNzQnVpbGRlci5idWlsZCh7XG4gICAgICBmdW5jOiBmdW5jLFxuICAgICAgc2NvcGU6IHRoaXMuc2NvcGUsXG4gICAgICBudW1PZklucHV0OiB0aGlzLl9udW1PZklucHV0LFxuICAgICAgbnVtT2ZPdXRwdXQ6IHRoaXMuX251bU9mT3V0cHV0LFxuICAgICAgcGFyYW1ldGVyczogdGhpcy5fcGFyYW1ldGVycyxcbiAgICB9KTtcbiAgfVxufTtcblxuQXVkaW9Xb3JrZXJOb2RlSW1wbC5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy50ZXJtaW5hdGUoKTtcbn07XG5cbkF1ZGlvV29ya2VyTm9kZUltcGwucHJvdG90eXBlLmltcG9ydFNjcmlwdHMgPSBmdW5jdGlvbigpIHtcbiAgdGhyb3cgbmV3IEVycm9yKFwiTm90IFN1cHBvcnRlZDogaW1wb3J0U2NyaXB0c1wiKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXVkaW9Xb3JrZXJOb2RlSW1wbDtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciB1dGlscyA9IHJlcXVpcmUoXCIuL3V0aWxzXCIpO1xudmFyIEF1ZGlvV29ya2VySW1wbCA9IHJlcXVpcmUoXCIuL2F1ZGlvLXdvcmtlci1pbXBsXCIpO1xuXG5mdW5jdGlvbiBBdWRpb1dvcmtlck5vZGUoYXVkaW9Db250ZXh0LCBzY3JpcHRVUkwsIG51bWJlck9mSW5wdXRDaGFubmVscywgbnVtYmVyT2ZPdXRwdXRDaGFubmVscykge1xuICBudW1iZXJPZklucHV0Q2hhbm5lbHMgPSB1dGlscy5kZWZhdWx0cyhudW1iZXJPZklucHV0Q2hhbm5lbHMsIDIpO1xuICBudW1iZXJPZk91dHB1dENoYW5uZWxzID0gdXRpbHMuZGVmYXVsdHMobnVtYmVyT2ZPdXRwdXRDaGFubmVscywgMik7XG5cbiAgdmFyIGltcGwgPSBuZXcgQXVkaW9Xb3JrZXJJbXBsKGF1ZGlvQ29udGV4dCwgc2NyaXB0VVJMLCBudW1iZXJPZklucHV0Q2hhbm5lbHMsIG51bWJlck9mT3V0cHV0Q2hhbm5lbHMpO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKGltcGwuaW5sZXQsIHtcbiAgICBvbm1lc3NhZ2U6IHtcbiAgICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgdmFsdWUgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIGltcGwucG9ydDEub25tZXNzYWdlID0gdmFsdWU7XG4gICAgICB9LFxuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGltcGwucG9ydDEub25tZXNzYWdlO1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9LFxuICAgIGNvbm5lY3Q6IHtcbiAgICAgIHZhbHVlOiBmdW5jdGlvbihkZXN0aW5hdGlvbikge1xuICAgICAgICByZXR1cm4gaW1wbC5jb25uZWN0KGRlc3RpbmF0aW9uKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIGRpc2Nvbm5lY3Q6IHtcbiAgICAgIHZhbHVlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGltcGwuZGlzY29ubmVjdCgpO1xuICAgICAgfVxuICAgIH0sXG4gICAgcG9zdE1lc3NhZ2U6IHtcbiAgICAgIHZhbHVlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGltcGwucG9ydDEucG9zdE1lc3NhZ2UuYXBwbHkoaW1wbC5wb3J0MSwgYXJndW1lbnRzKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIGFkZFBhcmFtZXRlcjoge1xuICAgICAgdmFsdWU6IGZ1bmN0aW9uKG5hbWUsIGRlZmF1bHRWYWx1ZSkge1xuICAgICAgICBkZWZhdWx0VmFsdWUgPSB1dGlscy5kZWZhdWx0cyhkZWZhdWx0VmFsdWUsIDApO1xuICAgICAgICBpZiAoIU9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoaW1wbC5pbmxldCwgbmFtZSkpIHtcbiAgICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoaW1wbC5pbmxldCwgbmFtZSwge1xuICAgICAgICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGltcGwuZ2V0UGFyYW1ldGVyKG5hbWUpO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICAgICAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaW1wbC5hZGRQYXJhbWV0ZXIobmFtZSwgZGVmYXVsdFZhbHVlKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIHJlbW92ZVBhcmFtZXRlcjoge1xuICAgICAgdmFsdWU6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgICAgaWYgKE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoaW1wbC5pbmxldCwgbmFtZSkpIHtcbiAgICAgICAgICBkZWxldGUgaW1wbC5pbmxldFtuYW1lXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gaW1wbC5yZW1vdmVQYXJhbWV0ZXIobmFtZSk7XG4gICAgICB9XG4gICAgfSxcbiAgICB0ZXJtaW5hdGU6IHtcbiAgICAgIHZhbHVlOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIGltcGwudGVybWluYXRlKCk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gaW1wbC5pbmxldDtcbn1cbm1vZHVsZS5leHBvcnRzID0gQXVkaW9Xb3JrZXJOb2RlO1xuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuXCJ1c2Ugc3RyaWN0XCI7XG5cbmZ1bmN0aW9uIE1lc3NhZ2VDaGFubmVsU2hpbSgpIHtcbiAgdGhpcy5wb3J0MSA9IG5ldyBNZXNzYWdlUG9ydCgpO1xuICB0aGlzLnBvcnQyID0gbmV3IE1lc3NhZ2VQb3J0KCk7XG4gIHRoaXMucG9ydDEuX3RhcmdldCA9IHRoaXMucG9ydDI7XG4gIHRoaXMucG9ydDIuX3RhcmdldCA9IHRoaXMucG9ydDE7XG59XG5cbmZ1bmN0aW9uIE1lc3NhZ2VQb3J0KCkge1xuICB0aGlzLl9vbm1lc3NhZ2UgPSBudWxsO1xuICB0aGlzLl90YXJnZXQgPSBudWxsO1xuICB0aGlzLl9pc0Nsb3NlZCA9IGZhbHNlO1xuICB0aGlzLl9wZW5kaW5ncyA9IFtdO1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0aWVzKHRoaXMsIHtcbiAgICBvbm1lc3NhZ2U6IHtcbiAgICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgdmFyIF90aGlzID0gdGhpcztcbiAgICAgICAgdGhpcy5fb25tZXNzYWdlID0gdmFsdWU7XG4gICAgICAgIGlmICh0aGlzLl9wZW5kaW5ncy5sZW5ndGgpIHtcbiAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgX3RoaXMuX3BlbmRpbmdzLnNwbGljZSgwKS5mb3JFYWNoKGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgICAgICAgX3RoaXMuX29ubWVzc2FnZShlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgIH0sIDApO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgZ2V0OiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuX29ubWVzc2FnZTtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfVxuICB9KTtcbn1cblxuTWVzc2FnZVBvcnQucHJvdG90eXBlLnBvc3RNZXNzYWdlID0gZnVuY3Rpb24obWVzc2FnZSkge1xuICB2YXIgdGFyZ2V0ID0gdGhpcy5fdGFyZ2V0O1xuICBpZiAoIXRoaXMuX2lzQ2xvc2VkKSB7XG4gICAgdmFyIGUgPSB7XG4gICAgICB0eXBlOiBcIm1lc3NhZ2VcIixcbiAgICAgIGRhdGE6IG1lc3NhZ2VcbiAgICB9O1xuICAgIGlmICh0eXBlb2YgdGFyZ2V0Ll9vbm1lc3NhZ2UgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgdGFyZ2V0Ll9vbm1lc3NhZ2UoZSk7XG4gICAgICB9LCAwKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGFyZ2V0Ll9wZW5kaW5ncy5wdXNoKGUpO1xuICAgIH1cbiAgfVxufTtcblxuTWVzc2FnZVBvcnQucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24oKSB7XG4gIHRoaXMuX2lzQ2xvc2VkID0gdHJ1ZTtcbiAgdGhpcy5fcGVuZGluZ3Muc3BsaWNlKDApO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBnbG9iYWwuTWVzc2FnZUNoYW5uZWwgfHwgTWVzc2FnZUNoYW5uZWxTaGltO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG5cInVzZSBzdHJpY3RcIjtcblxudmFyIFNjcmlwdExvYWRlciA9IHt9O1xuXG5TY3JpcHRMb2FkZXIubG9hZCA9IGZ1bmN0aW9uKHNjcmlwdFVSTCwgY2FsbGJhY2spIHtcbiAgdmFyIHhociA9IG5ldyBnbG9iYWwuWE1MSHR0cFJlcXVlc3QoKTtcbiAgeGhyLm9wZW4oXCJHRVRcIiwgc2NyaXB0VVJMKTtcbiAgeGhyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuICAgIGlmICh4aHIuc3RhdHVzID09PSAyMDApIHtcbiAgICAgIGNhbGxiYWNrKHhoci5yZXNwb25zZSk7XG4gICAgfVxuICB9O1xuICB4aHIuc2VuZCgpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTY3JpcHRMb2FkZXI7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSIsIlwidXNlIHN0cmljdFwiO1xuXG5mdW5jdGlvbiBkZWZhdWx0cyh2YWx1ZSwgZGVmYXVsdFZhbHVlKSB7XG4gIHJldHVybiB2YWx1ZSAhPT0gdW5kZWZpbmVkID8gdmFsdWUgOiBkZWZhdWx0VmFsdWU7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBkZWZhdWx0czogZGVmYXVsdHNcbn07XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliL2luZGV4LmpzJyk7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZCA9IGZ1bmN0aW9uIChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgJ2RlZmF1bHQnOiBvYmogfTsgfTtcblxudmFyIF9jbGFzc0NhbGxDaGVjayA9IGZ1bmN0aW9uIChpbnN0YW5jZSwgQ29uc3RydWN0b3IpIHsgaWYgKCEoaW5zdGFuY2UgaW5zdGFuY2VvZiBDb25zdHJ1Y3RvcikpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcignQ2Fubm90IGNhbGwgYSBjbGFzcyBhcyBhIGZ1bmN0aW9uJyk7IH0gfTtcblxudmFyIF9jcmVhdGVDbGFzcyA9IChmdW5jdGlvbiAoKSB7IGZ1bmN0aW9uIGRlZmluZVByb3BlcnRpZXModGFyZ2V0LCBwcm9wcykgeyBmb3IgKHZhciBpID0gMDsgaSA8IHByb3BzLmxlbmd0aDsgaSsrKSB7IHZhciBkZXNjcmlwdG9yID0gcHJvcHNbaV07IGRlc2NyaXB0b3IuZW51bWVyYWJsZSA9IGRlc2NyaXB0b3IuZW51bWVyYWJsZSB8fCBmYWxzZTsgZGVzY3JpcHRvci5jb25maWd1cmFibGUgPSB0cnVlOyBpZiAoJ3ZhbHVlJyBpbiBkZXNjcmlwdG9yKSBkZXNjcmlwdG9yLndyaXRhYmxlID0gdHJ1ZTsgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRhcmdldCwgZGVzY3JpcHRvci5rZXksIGRlc2NyaXB0b3IpOyB9IH0gcmV0dXJuIGZ1bmN0aW9uIChDb25zdHJ1Y3RvciwgcHJvdG9Qcm9wcywgc3RhdGljUHJvcHMpIHsgaWYgKHByb3RvUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IucHJvdG90eXBlLCBwcm90b1Byb3BzKTsgaWYgKHN0YXRpY1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLCBzdGF0aWNQcm9wcyk7IHJldHVybiBDb25zdHJ1Y3RvcjsgfTsgfSkoKTtcblxudmFyIF9nZXQgPSBmdW5jdGlvbiBnZXQob2JqZWN0LCBwcm9wZXJ0eSwgcmVjZWl2ZXIpIHsgdmFyIGRlc2MgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG9iamVjdCwgcHJvcGVydHkpOyBpZiAoZGVzYyA9PT0gdW5kZWZpbmVkKSB7IHZhciBwYXJlbnQgPSBPYmplY3QuZ2V0UHJvdG90eXBlT2Yob2JqZWN0KTsgaWYgKHBhcmVudCA9PT0gbnVsbCkgeyByZXR1cm4gdW5kZWZpbmVkOyB9IGVsc2UgeyByZXR1cm4gZ2V0KHBhcmVudCwgcHJvcGVydHksIHJlY2VpdmVyKTsgfSB9IGVsc2UgaWYgKCd2YWx1ZScgaW4gZGVzYykgeyByZXR1cm4gZGVzYy52YWx1ZTsgfSBlbHNlIHsgdmFyIGdldHRlciA9IGRlc2MuZ2V0OyBpZiAoZ2V0dGVyID09PSB1bmRlZmluZWQpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfSByZXR1cm4gZ2V0dGVyLmNhbGwocmVjZWl2ZXIpOyB9IH07XG5cbnZhciBfaW5oZXJpdHMgPSBmdW5jdGlvbiAoc3ViQ2xhc3MsIHN1cGVyQ2xhc3MpIHsgaWYgKHR5cGVvZiBzdXBlckNsYXNzICE9PSAnZnVuY3Rpb24nICYmIHN1cGVyQ2xhc3MgIT09IG51bGwpIHsgdGhyb3cgbmV3IFR5cGVFcnJvcignU3VwZXIgZXhwcmVzc2lvbiBtdXN0IGVpdGhlciBiZSBudWxsIG9yIGEgZnVuY3Rpb24sIG5vdCAnICsgdHlwZW9mIHN1cGVyQ2xhc3MpOyB9IHN1YkNsYXNzLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoc3VwZXJDbGFzcyAmJiBzdXBlckNsYXNzLnByb3RvdHlwZSwgeyBjb25zdHJ1Y3RvcjogeyB2YWx1ZTogc3ViQ2xhc3MsIGVudW1lcmFibGU6IGZhbHNlLCB3cml0YWJsZTogdHJ1ZSwgY29uZmlndXJhYmxlOiB0cnVlIH0gfSk7IGlmIChzdXBlckNsYXNzKSBzdWJDbGFzcy5fX3Byb3RvX18gPSBzdXBlckNsYXNzOyB9O1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgJ19fZXNNb2R1bGUnLCB7XG4gIHZhbHVlOiB0cnVlXG59KTtcblxudmFyIF9FdmVudEVtaXR0ZXIyID0gcmVxdWlyZSgnZXZlbnRzJyk7XG5cbnZhciBfRXZlbnRFbWl0dGVyMyA9IF9pbnRlcm9wUmVxdWlyZVdpbGRjYXJkKF9FdmVudEVtaXR0ZXIyKTtcblxudmFyIF9yYWYgPSByZXF1aXJlKCdyYWYnKTtcblxudmFyIF9yYWYyID0gX2ludGVyb3BSZXF1aXJlV2lsZGNhcmQoX3JhZik7XG5cbnZhciBfeGhyID0gcmVxdWlyZSgneGhyJyk7XG5cbnZhciBfeGhyMiA9IF9pbnRlcm9wUmVxdWlyZVdpbGRjYXJkKF94aHIpO1xuXG52YXIgX2ZzID0gcmVxdWlyZSgnZnMnKTtcblxudmFyIF9mczIgPSBfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZChfZnMpO1xuXG52YXIgX3BhdGggPSByZXF1aXJlKCdwYXRoJyk7XG5cbnZhciBfcGF0aDIgPSBfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZChfcGF0aCk7XG5cbnZhciBBdWRpb1NvdXJjZSA9IChmdW5jdGlvbiAoX0V2ZW50RW1pdHRlcikge1xuICBmdW5jdGlvbiBBdWRpb1NvdXJjZShvcHRzKSB7XG4gICAgX2NsYXNzQ2FsbENoZWNrKHRoaXMsIEF1ZGlvU291cmNlKTtcblxuICAgIGlmICghb3B0cy5jb250ZXh0KSB0aHJvdyBuZXcgRXJyb3IoJ1lvdSBtdXN0IHBhc3MgYW4gYXVkaW8gY29udGV4dCB0byB1c2UgdGhpcyBtb2R1bGUnKTtcbiAgICBfZ2V0KE9iamVjdC5nZXRQcm90b3R5cGVPZihBdWRpb1NvdXJjZS5wcm90b3R5cGUpLCAnY29uc3RydWN0b3InLCB0aGlzKS5jYWxsKHRoaXMpO1xuICAgIHRoaXMuY29udGV4dCA9IG9wdHMuY29udGV4dDtcbiAgICB0aGlzLnVybCA9IG9wdHMudXJsID8gb3B0cy51cmwgOiB1bmRlZmluZWQ7XG4gICAgdGhpcy5ub2RlcyA9IG9wdHMubm9kZXMgPyBvcHRzLm5vZGVzIDogW107XG4gICAgdGhpcy5nYWluTm9kZSA9IG9wdHMuZ2Fpbk5vZGUgPyBvcHRzLmdhaW5Ob2RlIDogdW5kZWZpbmVkO1xuXG4gICAgaWYgKHRoaXMubm9kZXMubGVuZ3RoICYmICF0aGlzLmdhaW5Ob2RlKSB0aHJvdyBuZXcgRXJyb3IoJ011c3QgcGFzcyBnYWluTm9kZSBpbiBvcHRpb25zIHdpdGggbm9kZSBhcnJheScpO1xuICAgIHRoaXMuYnVmZmVyID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuX215Y2IgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5zdGFydE9mZnNldCA9IDA7XG4gICAgdGhpcy5faW5pdCA9IHRydWU7IC8vIHN3aXRjaCBmb3IgaW5pdGlhbCBwbGF5XG4gIH1cblxuICBfaW5oZXJpdHMoQXVkaW9Tb3VyY2UsIF9FdmVudEVtaXR0ZXIpO1xuXG4gIF9jcmVhdGVDbGFzcyhBdWRpb1NvdXJjZSwgW3tcbiAgICBrZXk6ICdfdG9BcnJheUJ1ZmZlcicsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIF90b0FycmF5QnVmZmVyKGJ1ZmZlcikge1xuICAgICAgdmFyIGFiID0gbmV3IEFycmF5QnVmZmVyKGJ1ZmZlci5sZW5ndGgpO1xuICAgICAgdmFyIHZpZXcgPSBuZXcgVWludDhBcnJheShhYik7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGJ1ZmZlci5sZW5ndGg7ICsraSkge1xuICAgICAgICB2aWV3W2ldID0gYnVmZmVyW2ldO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGFiO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2xvYWQnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBsb2FkKHVybCwgY2IsIGlzRmlsZSkge1xuICAgICAgaWYgKHR5cGVvZiB1cmwgPT09ICdmdW5jdGlvbicpIGNiID0gdXJsO2Vsc2UgaWYgKHVybCkgdGhpcy51cmwgPSB1cmw7XG5cbiAgICAgIGlmICghdGhpcy51cmwpIHRocm93IG5ldyBFcnJvcignWW91IG11c3QgcGFzcyBhIHVybCBvciBoYXZlIGluc3RhbnRpYXRlZCB0aGUgY2xhc3Mgd2l0aCB0aGUgdXJsIG9wdGlvbiB0byBjYWxsIFwiQXVkaW9Tb3VyY2UubG9hZFwiJyk7XG4gICAgICBpZiAoIXRoaXMubGlzdGVuZXJzKCdsb2FkJykubGVuZ3RoICYmICFjYikgY29uc29sZS53YXJuKCdObyBjYWxsYmFjayBwYXNzZWQgdG8gTG9hZCBtZXRob2QsIG5vciBsaXN0ZW5lciBzZXQgdXAgZm9yIFwibG9hZFwiIGV2ZW50LicpO1xuICAgICAgdGhpcy5fcmVxKGNiKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdyZWFkJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gcmVhZChmaWxlcGF0aCwgY2IpIHtcbiAgICAgIGlmICh0eXBlb2YgZmlsZXBhdGggPT0gJ2Z1bmN0aW9uJykgY2IgPSBmaWxlcGF0aDtlbHNlIHRoaXMudXJsID0gZmlsZXBhdGg7XG4gICAgICBpZiAoY2IpIHRoaXMuX215Y2IgPSBjYjtcbiAgICAgIF9mczJbJ2RlZmF1bHQnXS5yZWFkRmlsZShfcGF0aDJbJ2RlZmF1bHQnXS5yZXNvbHZlKGZpbGVwYXRoKSwgKGZ1bmN0aW9uIChlcnIsIGJ1ZmZlcikge1xuICAgICAgICBpZiAoZXJyKSB0aGlzLl9mYWlsKGVycik7XG4gICAgICAgIHRoaXMuY29udGV4dC5kZWNvZGVBdWRpb0RhdGEodGhpcy5fdG9BcnJheUJ1ZmZlcihidWZmZXIpLCAoZnVuY3Rpb24gKGJ1ZmZlcikge1xuICAgICAgICAgIHRoaXMuYnVmZmVyID0gYnVmZmVyO1xuICAgICAgICAgIHRoaXMuZW1pdCgnbG9hZCcsIHRoaXMudGltZSgpKTtcbiAgICAgICAgICBpZiAodGhpcy5fbXljYikgdGhpcy5fbXljYihudWxsLCB0aGlzKTtcbiAgICAgICAgfSkuYmluZCh0aGlzKSwgdGhpcy5fZmFpbC5iaW5kKHRoaXMpKTtcbiAgICAgIH0pLmJpbmQodGhpcykpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2Rpc2Nvbm5lY3QnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBkaXNjb25uZWN0KCkge1xuICAgICAgaWYgKHRoaXMuc291cmNlKSB0aGlzLnNvdXJjZS5kaXNjb25uZWN0KHRoaXMuY29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnX3NldHVwJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gX3NldHVwKGJ1ZmZlcikge1xuICAgICAgdmFyIF90aGlzID0gdGhpcztcblxuICAgICAgdGhpcy5kaXNjb25uZWN0KCk7XG4gICAgICB0aGlzLnNvdXJjZSA9IHRoaXMuY29udGV4dC5jcmVhdGVCdWZmZXJTb3VyY2UoKTtcbiAgICAgIHRoaXMuc291cmNlLmJ1ZmZlciA9IHRoaXMuYnVmZmVyO1xuXG4gICAgICBpZiAodGhpcy5nYWluTm9kZSkge1xuICAgICAgICAvKlxuICAgICAgICAgKiBSZWFsbHkgZG9uJ3QgbGlrZSBoYXZpbmcgdG8gZG8gdGhpcyBldmVyeXRpbWVcbiAgICAgICAgICogd2UgZ2V0IGEgZnJlc2ggYnVmZmVyIG9uIHBsYXliYWNrLCBidXQgaXQgc2VlbXNcbiAgICAgICAgICogdGhhdCB0aGlzIGlzIHRoZSBvbmx5IG9wdGlvbiB1bnRpbCB0aGUgd2ViIGF1ZGlvXG4gICAgICAgICAqIHNwZWMgaXMgdXBkYXRlZC4gOicoXG4gICAgICAgICAqICovXG4gICAgICAgIHRoaXMuc291cmNlLmNvbm5lY3QodGhpcy5nYWluTm9kZSk7XG4gICAgICAgIHRoaXMubm9kZXMuZm9yRWFjaChmdW5jdGlvbiAobm9kZSkge1xuICAgICAgICAgIF90aGlzLmdhaW5Ob2RlLmNvbm5lY3Qobm9kZS5pbnB1dCk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRoaXMuZ2Fpbk5vZGUuY29ubmVjdCh0aGlzLmNvbnRleHQuZGVzdGluYXRpb24pO1xuXG4gICAgICAgIC8vIGhvb2sgdXAgYW5hbHlzZXIgbm9kZXNcbiAgICAgICAgdGhpcy5ub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgICAgaWYgKG5vZGUuaW5wdXQuaGFzT3duUHJvcGVydHkoJ2ZmdFNpemUnKSkgbm9kZS5jb25uZWN0KF90aGlzLmNvbnRleHQuZGVzdGluYXRpb24pO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB0aGlzLnNvdXJjZS5jb25uZWN0KHRoaXMuY29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnX2ZhaWwnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfZmFpbChlcnIpIHtcbiAgICAgIC8qXG4gICAgICAgKiBUaGlzIGVycm9yIGhhbmRsaW5nIG5lZWRzIGltcHJvdmVtZW50LCBmb3Igc3VyZS5cbiAgICAgICAqICovXG4gICAgICBpZiAodGhpcy5saXN0ZW5lcnMoJ2Vycm9yJykubGVuZ3RoKSB0aGlzLmVtaXQoJ2Vycm9yJywgZXJyKTtlbHNlIGlmICh0aGlzLl9teWNiKSB0aGlzLl9teWNiKG5ldyBFcnJvcihlcnIpKTtlbHNlIHRocm93IG5ldyBFcnJvcignTm8gZXJyb3IgaGFuZGxpbmc/OiAnLCBlcnIpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ19yZXEnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfcmVxKGNiKSB7XG4gICAgICB2YXIgX3RoaXMyID0gdGhpcztcblxuICAgICAgdGhpcy5fbXljYiA9IGNiO1xuICAgICAgX3hocjJbJ2RlZmF1bHQnXSh7XG4gICAgICAgIHVyaTogdGhpcy51cmwsXG4gICAgICAgIHJlc3BvbnNlVHlwZTogJ2FycmF5YnVmZmVyJ1xuICAgICAgfSwgKGZ1bmN0aW9uIChlcnIsIHJlc3AsIGJvZHkpIHtcbiAgICAgICAgaWYgKGVycikge1xuICAgICAgICAgIGVyciA9IG51bGw7XG4gICAgICAgICAgX3RoaXMyLnJlYWQoX3RoaXMyLnVybCwgY2IpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIF90aGlzMi5jb250ZXh0LmRlY29kZUF1ZGlvRGF0YShib2R5LCAoZnVuY3Rpb24gKGJ1ZmZlcikge1xuICAgICAgICAgICAgdGhpcy5idWZmZXIgPSBidWZmZXI7XG4gICAgICAgICAgICB0aGlzLmVtaXQoJ2xvYWQnLCB0aGlzLnRpbWUoKSk7XG4gICAgICAgICAgICBpZiAodGhpcy5fbXljYikgdGhpcy5fbXljYihudWxsLCB0aGlzKTtcbiAgICAgICAgICB9KS5iaW5kKF90aGlzMiksIF90aGlzMi5fZmFpbC5iaW5kKF90aGlzMikpO1xuICAgICAgICB9XG4gICAgICB9KS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdwbGF5JyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gcGxheShvZmZzZXQpIHtcbiAgICAgIHRoaXMubGFzdFBsYXkgPSB0aGlzLmNvbnRleHQuY3VycmVudFRpbWU7XG4gICAgICBpZiAoIW9mZnNldCkgb2Zmc2V0ID0gdGhpcy5zdGFydE9mZnNldDtcblxuICAgICAgaWYgKCF0aGlzLl9pbml0KSB0aGlzLl9zdG9wKCk7ZWxzZSB0aGlzLl9pbml0ID0gZmFsc2U7XG5cbiAgICAgIHRoaXMuX3NldHVwKHRoaXMuYnVmZmVyKTsgLy8gZ2V0IGEgZnJlc2ggYnVmZmVyXG4gICAgICB0aGlzLnNvdXJjZS5zdGFydCgwLCBvZmZzZXQpO1xuICAgICAgdGhpcy5wbGF5aW5nID0gdHJ1ZTtcbiAgICAgIHRoaXMuaW50ZXJ2YWwgPSBfcmFmMlsnZGVmYXVsdCddKHRoaXMuX2Jyb2FkY2FzdFRpbWUuYmluZCh0aGlzKSk7XG4gICAgICB0aGlzLmVtaXQoJ3BsYXknLCB0aGlzLnRpbWUoKSk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnX3N0b3AnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfc3RvcCgpIHtcbiAgICAgIHRoaXMuc291cmNlLnN0b3AodGhpcy5jb250ZXh0LmN1cnJlbnRUaW1lKTtcbiAgICAgIHRoaXMucGxheWluZyA9IGZhbHNlO1xuICAgICAgdGhpcy5pbnRlcnZhbCA9IF9yYWYyWydkZWZhdWx0J10uY2FuY2VsKHRoaXMuaW50ZXJ2YWwpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3N0b3AnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBzdG9wKCkge1xuICAgICAgdGhpcy5zdGFydE9mZnNldCA9IDA7XG4gICAgICB0aGlzLmxhc3RQbGF5ID0gMDtcbiAgICAgIHRoaXMuX3N0b3AoKTtcbiAgICAgIHRoaXMuZW1pdCgnc3RvcCcsIHRoaXMudGltZSgpKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdzZWVrJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gc2Vlayh0aW1lKSB7XG4gICAgICBpZiAodGltZSkgc2tpcCh0aW1lKTtlbHNlIGJhY2sodGltZSk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnc2tpcCcsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHNraXAodGltZSkge1xuICAgICAgaWYgKCF0aW1lKSB0aW1lID0gNTtcbiAgICAgIHRoaXMubGFzdFBsYXkgPSB0aGlzLmxhc3RQbGF5ICsgdGltZTtcbiAgICAgIHRoaXMucGF1c2UoKTtcbiAgICAgIHRoaXMuZW1pdCgnc2tpcCcsIHRoaXMudGltZSgpLCB0aW1lKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdiYWNrJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gYmFjayh0aW1lKSB7XG4gICAgICBpZiAoIXRpbWUpIHRpbWUgPSAtNTtcbiAgICAgIHRoaXMubGFzdFBsYXkgPSB0aGlzLmxhc3RQbGF5ICsgdGltZTtcbiAgICAgIHRoaXMucGF1c2UoKTtcbiAgICAgIHRoaXMuZW1pdCgnYmFjaycsIHRoaXMudGltZSgpLCB0aW1lKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdwYXVzZScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHBhdXNlKCkge1xuICAgICAgdGhpcy5fc3RvcCgpO1xuICAgICAgdGhpcy5zdGFydE9mZnNldCArPSB0aGlzLmNvbnRleHQuY3VycmVudFRpbWUgLSB0aGlzLmxhc3RQbGF5O1xuICAgICAgdGhpcy5lbWl0KCdwYXVzZScsIHRoaXMudGltZSgpKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdyZW1vdmUnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiByZW1vdmUoKSB7XG4gICAgICB0aGlzLmRpc2Nvbm5lY3QoKTtcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlJywgdGhpcy50aW1lKCkpO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICd0aW1lJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gdGltZSgpIHtcbiAgICAgIHZhciBjdXIgPSB0aGlzLmNvbnRleHQuY3VycmVudFRpbWUgLSB0aGlzLmxhc3RQbGF5ICsgdGhpcy5zdGFydE9mZnNldDtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGN1cnJlbnQ6IGN1cixcbiAgICAgICAgcmVtYWluaW5nOiB0aGlzLmJ1ZmZlci5kdXJhdGlvbiAtIGN1cixcbiAgICAgICAgcGVyY2VudDogKGN1ciAvIHRoaXMuYnVmZmVyLmR1cmF0aW9uICogMTAwKS50b0ZpeGVkKDIpICsgJyUnLFxuICAgICAgICB0b3RhbDogdGhpcy5idWZmZXIuZHVyYXRpb25cbiAgICAgIH07XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnX2Jyb2FkY2FzdFRpbWUnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfYnJvYWRjYXN0VGltZSgpIHtcbiAgICAgIHZhciB0aW1lID0gdGhpcy50aW1lKCk7XG4gICAgICBpZiAodGltZS5jdXJyZW50ID4gdGltZS50b3RhbCkgdGhpcy5zdG9wKCk7ZWxzZSB7XG4gICAgICAgIHRoaXMuZW1pdCgndGltZScsIHRpbWUpO1xuICAgICAgICBfcmFmMlsnZGVmYXVsdCddKHRoaXMuX2Jyb2FkY2FzdFRpbWUuYmluZCh0aGlzKSk7XG4gICAgICB9XG4gICAgfVxuICB9XSk7XG5cbiAgcmV0dXJuIEF1ZGlvU291cmNlO1xufSkoX0V2ZW50RW1pdHRlcjNbJ2RlZmF1bHQnXSk7XG5cbmV4cG9ydHNbJ2RlZmF1bHQnXSA9IEF1ZGlvU291cmNlO1xubW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzWydkZWZhdWx0J107IiwidmFyIG5vdyA9IHJlcXVpcmUoJ3BlcmZvcm1hbmNlLW5vdycpXG4gICwgZ2xvYmFsID0gdHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcgPyB7fSA6IHdpbmRvd1xuICAsIHZlbmRvcnMgPSBbJ21veicsICd3ZWJraXQnXVxuICAsIHN1ZmZpeCA9ICdBbmltYXRpb25GcmFtZSdcbiAgLCByYWYgPSBnbG9iYWxbJ3JlcXVlc3QnICsgc3VmZml4XVxuICAsIGNhZiA9IGdsb2JhbFsnY2FuY2VsJyArIHN1ZmZpeF0gfHwgZ2xvYmFsWydjYW5jZWxSZXF1ZXN0JyArIHN1ZmZpeF1cbiAgLCBpc05hdGl2ZSA9IHRydWVcblxuZm9yKHZhciBpID0gMDsgaSA8IHZlbmRvcnMubGVuZ3RoICYmICFyYWY7IGkrKykge1xuICByYWYgPSBnbG9iYWxbdmVuZG9yc1tpXSArICdSZXF1ZXN0JyArIHN1ZmZpeF1cbiAgY2FmID0gZ2xvYmFsW3ZlbmRvcnNbaV0gKyAnQ2FuY2VsJyArIHN1ZmZpeF1cbiAgICAgIHx8IGdsb2JhbFt2ZW5kb3JzW2ldICsgJ0NhbmNlbFJlcXVlc3QnICsgc3VmZml4XVxufVxuXG4vLyBTb21lIHZlcnNpb25zIG9mIEZGIGhhdmUgckFGIGJ1dCBub3QgY0FGXG5pZighcmFmIHx8ICFjYWYpIHtcbiAgaXNOYXRpdmUgPSBmYWxzZVxuXG4gIHZhciBsYXN0ID0gMFxuICAgICwgaWQgPSAwXG4gICAgLCBxdWV1ZSA9IFtdXG4gICAgLCBmcmFtZUR1cmF0aW9uID0gMTAwMCAvIDYwXG5cbiAgcmFmID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICBpZihxdWV1ZS5sZW5ndGggPT09IDApIHtcbiAgICAgIHZhciBfbm93ID0gbm93KClcbiAgICAgICAgLCBuZXh0ID0gTWF0aC5tYXgoMCwgZnJhbWVEdXJhdGlvbiAtIChfbm93IC0gbGFzdCkpXG4gICAgICBsYXN0ID0gbmV4dCArIF9ub3dcbiAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBjcCA9IHF1ZXVlLnNsaWNlKDApXG4gICAgICAgIC8vIENsZWFyIHF1ZXVlIGhlcmUgdG8gcHJldmVudFxuICAgICAgICAvLyBjYWxsYmFja3MgZnJvbSBhcHBlbmRpbmcgbGlzdGVuZXJzXG4gICAgICAgIC8vIHRvIHRoZSBjdXJyZW50IGZyYW1lJ3MgcXVldWVcbiAgICAgICAgcXVldWUubGVuZ3RoID0gMFxuICAgICAgICBmb3IodmFyIGkgPSAwOyBpIDwgY3AubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBpZighY3BbaV0uY2FuY2VsbGVkKSB7XG4gICAgICAgICAgICB0cnl7XG4gICAgICAgICAgICAgIGNwW2ldLmNhbGxiYWNrKGxhc3QpXG4gICAgICAgICAgICB9IGNhdGNoKGUpIHtcbiAgICAgICAgICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHsgdGhyb3cgZSB9LCAwKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSwgTWF0aC5yb3VuZChuZXh0KSlcbiAgICB9XG4gICAgcXVldWUucHVzaCh7XG4gICAgICBoYW5kbGU6ICsraWQsXG4gICAgICBjYWxsYmFjazogY2FsbGJhY2ssXG4gICAgICBjYW5jZWxsZWQ6IGZhbHNlXG4gICAgfSlcbiAgICByZXR1cm4gaWRcbiAgfVxuXG4gIGNhZiA9IGZ1bmN0aW9uKGhhbmRsZSkge1xuICAgIGZvcih2YXIgaSA9IDA7IGkgPCBxdWV1ZS5sZW5ndGg7IGkrKykge1xuICAgICAgaWYocXVldWVbaV0uaGFuZGxlID09PSBoYW5kbGUpIHtcbiAgICAgICAgcXVldWVbaV0uY2FuY2VsbGVkID0gdHJ1ZVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGZuKSB7XG4gIC8vIFdyYXAgaW4gYSBuZXcgZnVuY3Rpb24gdG8gcHJldmVudFxuICAvLyBgY2FuY2VsYCBwb3RlbnRpYWxseSBiZWluZyBhc3NpZ25lZFxuICAvLyB0byB0aGUgbmF0aXZlIHJBRiBmdW5jdGlvblxuICBpZighaXNOYXRpdmUpIHtcbiAgICByZXR1cm4gcmFmLmNhbGwoZ2xvYmFsLCBmbilcbiAgfVxuICByZXR1cm4gcmFmLmNhbGwoZ2xvYmFsLCBmdW5jdGlvbigpIHtcbiAgICB0cnl7XG4gICAgICBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpXG4gICAgfSBjYXRjaChlKSB7XG4gICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyB0aHJvdyBlIH0sIDApXG4gICAgfVxuICB9KVxufVxubW9kdWxlLmV4cG9ydHMuY2FuY2VsID0gZnVuY3Rpb24oKSB7XG4gIGNhZi5hcHBseShnbG9iYWwsIGFyZ3VtZW50cylcbn1cbiIsIihmdW5jdGlvbiAocHJvY2Vzcyl7XG4vLyBHZW5lcmF0ZWQgYnkgQ29mZmVlU2NyaXB0IDEuNi4zXG4oZnVuY3Rpb24oKSB7XG4gIHZhciBnZXROYW5vU2Vjb25kcywgaHJ0aW1lLCBsb2FkVGltZTtcblxuICBpZiAoKHR5cGVvZiBwZXJmb3JtYW5jZSAhPT0gXCJ1bmRlZmluZWRcIiAmJiBwZXJmb3JtYW5jZSAhPT0gbnVsbCkgJiYgcGVyZm9ybWFuY2Uubm93KSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICB9O1xuICB9IGVsc2UgaWYgKCh0eXBlb2YgcHJvY2VzcyAhPT0gXCJ1bmRlZmluZWRcIiAmJiBwcm9jZXNzICE9PSBudWxsKSAmJiBwcm9jZXNzLmhydGltZSkge1xuICAgIG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gKGdldE5hbm9TZWNvbmRzKCkgLSBsb2FkVGltZSkgLyAxZTY7XG4gICAgfTtcbiAgICBocnRpbWUgPSBwcm9jZXNzLmhydGltZTtcbiAgICBnZXROYW5vU2Vjb25kcyA9IGZ1bmN0aW9uKCkge1xuICAgICAgdmFyIGhyO1xuICAgICAgaHIgPSBocnRpbWUoKTtcbiAgICAgIHJldHVybiBoclswXSAqIDFlOSArIGhyWzFdO1xuICAgIH07XG4gICAgbG9hZFRpbWUgPSBnZXROYW5vU2Vjb25kcygpO1xuICB9IGVsc2UgaWYgKERhdGUubm93KSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBEYXRlLm5vdygpIC0gbG9hZFRpbWU7XG4gICAgfTtcbiAgICBsb2FkVGltZSA9IERhdGUubm93KCk7XG4gIH0gZWxzZSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIGxvYWRUaW1lO1xuICAgIH07XG4gICAgbG9hZFRpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKTtcbiAgfVxuXG59KS5jYWxsKHRoaXMpO1xuXG4vKlxuLy9AIHNvdXJjZU1hcHBpbmdVUkw9cGVyZm9ybWFuY2Utbm93Lm1hcFxuKi9cblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoJ19wcm9jZXNzJykpIiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgd2luZG93ID0gcmVxdWlyZShcImdsb2JhbC93aW5kb3dcIilcbnZhciBvbmNlID0gcmVxdWlyZShcIm9uY2VcIilcbnZhciBwYXJzZUhlYWRlcnMgPSByZXF1aXJlKFwicGFyc2UtaGVhZGVyc1wiKVxuXG5cbnZhciBYSFIgPSB3aW5kb3cuWE1MSHR0cFJlcXVlc3QgfHwgbm9vcFxudmFyIFhEUiA9IFwid2l0aENyZWRlbnRpYWxzXCIgaW4gKG5ldyBYSFIoKSkgPyBYSFIgOiB3aW5kb3cuWERvbWFpblJlcXVlc3RcblxubW9kdWxlLmV4cG9ydHMgPSBjcmVhdGVYSFJcblxuZnVuY3Rpb24gY3JlYXRlWEhSKG9wdGlvbnMsIGNhbGxiYWNrKSB7XG4gICAgZnVuY3Rpb24gcmVhZHlzdGF0ZWNoYW5nZSgpIHtcbiAgICAgICAgaWYgKHhoci5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgICAgICBsb2FkRnVuYygpXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBnZXRCb2R5KCkge1xuICAgICAgICAvLyBDaHJvbWUgd2l0aCByZXF1ZXN0VHlwZT1ibG9iIHRocm93cyBlcnJvcnMgYXJyb3VuZCB3aGVuIGV2ZW4gdGVzdGluZyBhY2Nlc3MgdG8gcmVzcG9uc2VUZXh0XG4gICAgICAgIHZhciBib2R5ID0gdW5kZWZpbmVkXG5cbiAgICAgICAgaWYgKHhoci5yZXNwb25zZSkge1xuICAgICAgICAgICAgYm9keSA9IHhoci5yZXNwb25zZVxuICAgICAgICB9IGVsc2UgaWYgKHhoci5yZXNwb25zZVR5cGUgPT09IFwidGV4dFwiIHx8ICF4aHIucmVzcG9uc2VUeXBlKSB7XG4gICAgICAgICAgICBib2R5ID0geGhyLnJlc3BvbnNlVGV4dCB8fCB4aHIucmVzcG9uc2VYTUxcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChpc0pzb24pIHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgYm9keSA9IEpTT04ucGFyc2UoYm9keSlcbiAgICAgICAgICAgIH0gY2F0Y2ggKGUpIHt9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYm9keVxuICAgIH1cbiAgICBcbiAgICB2YXIgZmFpbHVyZVJlc3BvbnNlID0ge1xuICAgICAgICAgICAgICAgIGJvZHk6IHVuZGVmaW5lZCxcbiAgICAgICAgICAgICAgICBoZWFkZXJzOiB7fSxcbiAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiAwLFxuICAgICAgICAgICAgICAgIG1ldGhvZDogbWV0aG9kLFxuICAgICAgICAgICAgICAgIHVybDogdXJpLFxuICAgICAgICAgICAgICAgIHJhd1JlcXVlc3Q6IHhoclxuICAgICAgICAgICAgfVxuICAgIFxuICAgIGZ1bmN0aW9uIGVycm9yRnVuYyhldnQpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRUaW1lcilcbiAgICAgICAgaWYoIShldnQgaW5zdGFuY2VvZiBFcnJvcikpe1xuICAgICAgICAgICAgZXZ0ID0gbmV3IEVycm9yKFwiXCIgKyAoZXZ0IHx8IFwidW5rbm93blwiKSApXG4gICAgICAgIH1cbiAgICAgICAgZXZ0LnN0YXR1c0NvZGUgPSAwXG4gICAgICAgIGNhbGxiYWNrKGV2dCwgZmFpbHVyZVJlc3BvbnNlKVxuICAgIH1cblxuICAgIC8vIHdpbGwgbG9hZCB0aGUgZGF0YSAmIHByb2Nlc3MgdGhlIHJlc3BvbnNlIGluIGEgc3BlY2lhbCByZXNwb25zZSBvYmplY3RcbiAgICBmdW5jdGlvbiBsb2FkRnVuYygpIHtcbiAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXRUaW1lcilcbiAgICAgICAgXG4gICAgICAgIHZhciBzdGF0dXMgPSAoeGhyLnN0YXR1cyA9PT0gMTIyMyA/IDIwNCA6IHhoci5zdGF0dXMpXG4gICAgICAgIHZhciByZXNwb25zZSA9IGZhaWx1cmVSZXNwb25zZVxuICAgICAgICB2YXIgZXJyID0gbnVsbFxuICAgICAgICBcbiAgICAgICAgaWYgKHN0YXR1cyAhPT0gMCl7XG4gICAgICAgICAgICByZXNwb25zZSA9IHtcbiAgICAgICAgICAgICAgICBib2R5OiBnZXRCb2R5KCksXG4gICAgICAgICAgICAgICAgc3RhdHVzQ29kZTogc3RhdHVzLFxuICAgICAgICAgICAgICAgIG1ldGhvZDogbWV0aG9kLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHt9LFxuICAgICAgICAgICAgICAgIHVybDogdXJpLFxuICAgICAgICAgICAgICAgIHJhd1JlcXVlc3Q6IHhoclxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYoeGhyLmdldEFsbFJlc3BvbnNlSGVhZGVycyl7IC8vcmVtZW1iZXIgeGhyIGNhbiBpbiBmYWN0IGJlIFhEUiBmb3IgQ09SUyBpbiBJRVxuICAgICAgICAgICAgICAgIHJlc3BvbnNlLmhlYWRlcnMgPSBwYXJzZUhlYWRlcnMoeGhyLmdldEFsbFJlc3BvbnNlSGVhZGVycygpKVxuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZXJyID0gbmV3IEVycm9yKFwiSW50ZXJuYWwgWE1MSHR0cFJlcXVlc3QgRXJyb3JcIilcbiAgICAgICAgfVxuICAgICAgICBjYWxsYmFjayhlcnIsIHJlc3BvbnNlLCByZXNwb25zZS5ib2R5KVxuICAgICAgICBcbiAgICB9XG4gICAgXG4gICAgaWYgKHR5cGVvZiBvcHRpb25zID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgIG9wdGlvbnMgPSB7IHVyaTogb3B0aW9ucyB9XG4gICAgfVxuXG4gICAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge31cbiAgICBpZih0eXBlb2YgY2FsbGJhY2sgPT09IFwidW5kZWZpbmVkXCIpe1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJjYWxsYmFjayBhcmd1bWVudCBtaXNzaW5nXCIpXG4gICAgfVxuICAgIGNhbGxiYWNrID0gb25jZShjYWxsYmFjaylcblxuICAgIHZhciB4aHIgPSBvcHRpb25zLnhociB8fCBudWxsXG5cbiAgICBpZiAoIXhocikge1xuICAgICAgICBpZiAob3B0aW9ucy5jb3JzIHx8IG9wdGlvbnMudXNlWERSKSB7XG4gICAgICAgICAgICB4aHIgPSBuZXcgWERSKClcbiAgICAgICAgfWVsc2V7XG4gICAgICAgICAgICB4aHIgPSBuZXcgWEhSKClcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHZhciBrZXlcbiAgICB2YXIgdXJpID0geGhyLnVybCA9IG9wdGlvbnMudXJpIHx8IG9wdGlvbnMudXJsXG4gICAgdmFyIG1ldGhvZCA9IHhoci5tZXRob2QgPSBvcHRpb25zLm1ldGhvZCB8fCBcIkdFVFwiXG4gICAgdmFyIGJvZHkgPSBvcHRpb25zLmJvZHkgfHwgb3B0aW9ucy5kYXRhXG4gICAgdmFyIGhlYWRlcnMgPSB4aHIuaGVhZGVycyA9IG9wdGlvbnMuaGVhZGVycyB8fCB7fVxuICAgIHZhciBzeW5jID0gISFvcHRpb25zLnN5bmNcbiAgICB2YXIgaXNKc29uID0gZmFsc2VcbiAgICB2YXIgdGltZW91dFRpbWVyXG5cbiAgICBpZiAoXCJqc29uXCIgaW4gb3B0aW9ucykge1xuICAgICAgICBpc0pzb24gPSB0cnVlXG4gICAgICAgIGhlYWRlcnNbXCJBY2NlcHRcIl0gfHwgKGhlYWRlcnNbXCJBY2NlcHRcIl0gPSBcImFwcGxpY2F0aW9uL2pzb25cIikgLy9Eb24ndCBvdmVycmlkZSBleGlzdGluZyBhY2NlcHQgaGVhZGVyIGRlY2xhcmVkIGJ5IHVzZXJcbiAgICAgICAgaWYgKG1ldGhvZCAhPT0gXCJHRVRcIiAmJiBtZXRob2QgIT09IFwiSEVBRFwiKSB7XG4gICAgICAgICAgICBoZWFkZXJzW1wiQ29udGVudC1UeXBlXCJdID0gXCJhcHBsaWNhdGlvbi9qc29uXCJcbiAgICAgICAgICAgIGJvZHkgPSBKU09OLnN0cmluZ2lmeShvcHRpb25zLmpzb24pXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICB4aHIub25yZWFkeXN0YXRlY2hhbmdlID0gcmVhZHlzdGF0ZWNoYW5nZVxuICAgIHhoci5vbmxvYWQgPSBsb2FkRnVuY1xuICAgIHhoci5vbmVycm9yID0gZXJyb3JGdW5jXG4gICAgLy8gSUU5IG11c3QgaGF2ZSBvbnByb2dyZXNzIGJlIHNldCB0byBhIHVuaXF1ZSBmdW5jdGlvbi5cbiAgICB4aHIub25wcm9ncmVzcyA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gSUUgbXVzdCBkaWVcbiAgICB9XG4gICAgeGhyLm9udGltZW91dCA9IGVycm9yRnVuY1xuICAgIHhoci5vcGVuKG1ldGhvZCwgdXJpLCAhc3luYywgb3B0aW9ucy51c2VybmFtZSwgb3B0aW9ucy5wYXNzd29yZClcbiAgICAvL2hhcyB0byBiZSBhZnRlciBvcGVuXG4gICAgaWYoIXN5bmMpIHtcbiAgICAgICAgeGhyLndpdGhDcmVkZW50aWFscyA9ICEhb3B0aW9ucy53aXRoQ3JlZGVudGlhbHNcbiAgICB9XG4gICAgLy8gQ2Fubm90IHNldCB0aW1lb3V0IHdpdGggc3luYyByZXF1ZXN0XG4gICAgLy8gbm90IHNldHRpbmcgdGltZW91dCBvbiB0aGUgeGhyIG9iamVjdCwgYmVjYXVzZSBvZiBvbGQgd2Via2l0cyBldGMuIG5vdCBoYW5kbGluZyB0aGF0IGNvcnJlY3RseVxuICAgIC8vIGJvdGggbnBtJ3MgcmVxdWVzdCBhbmQganF1ZXJ5IDEueCB1c2UgdGhpcyBraW5kIG9mIHRpbWVvdXQsIHNvIHRoaXMgaXMgYmVpbmcgY29uc2lzdGVudFxuICAgIGlmICghc3luYyAmJiBvcHRpb25zLnRpbWVvdXQgPiAwICkge1xuICAgICAgICB0aW1lb3V0VGltZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICB4aHIuYWJvcnQoXCJ0aW1lb3V0XCIpO1xuICAgICAgICB9LCBvcHRpb25zLnRpbWVvdXQrMiApO1xuICAgIH1cblxuICAgIGlmICh4aHIuc2V0UmVxdWVzdEhlYWRlcikge1xuICAgICAgICBmb3Ioa2V5IGluIGhlYWRlcnMpe1xuICAgICAgICAgICAgaWYoaGVhZGVycy5oYXNPd25Qcm9wZXJ0eShrZXkpKXtcbiAgICAgICAgICAgICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcihrZXksIGhlYWRlcnNba2V5XSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0gZWxzZSBpZiAob3B0aW9ucy5oZWFkZXJzKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIkhlYWRlcnMgY2Fubm90IGJlIHNldCBvbiBhbiBYRG9tYWluUmVxdWVzdCBvYmplY3RcIilcbiAgICB9XG5cbiAgICBpZiAoXCJyZXNwb25zZVR5cGVcIiBpbiBvcHRpb25zKSB7XG4gICAgICAgIHhoci5yZXNwb25zZVR5cGUgPSBvcHRpb25zLnJlc3BvbnNlVHlwZVxuICAgIH1cbiAgICBcbiAgICBpZiAoXCJiZWZvcmVTZW5kXCIgaW4gb3B0aW9ucyAmJiBcbiAgICAgICAgdHlwZW9mIG9wdGlvbnMuYmVmb3JlU2VuZCA9PT0gXCJmdW5jdGlvblwiXG4gICAgKSB7XG4gICAgICAgIG9wdGlvbnMuYmVmb3JlU2VuZCh4aHIpXG4gICAgfVxuXG4gICAgeGhyLnNlbmQoYm9keSlcblxuICAgIHJldHVybiB4aHJcblxuXG59XG5cblxuZnVuY3Rpb24gbm9vcCgpIHt9XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG5pZiAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgIG1vZHVsZS5leHBvcnRzID0gd2luZG93O1xufSBlbHNlIGlmICh0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBnbG9iYWw7XG59IGVsc2UgaWYgKHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiKXtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IHNlbGY7XG59IGVsc2Uge1xuICAgIG1vZHVsZS5leHBvcnRzID0ge307XG59XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSIsIm1vZHVsZS5leHBvcnRzID0gb25jZVxuXG5vbmNlLnByb3RvID0gb25jZShmdW5jdGlvbiAoKSB7XG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShGdW5jdGlvbi5wcm90b3R5cGUsICdvbmNlJywge1xuICAgIHZhbHVlOiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gb25jZSh0aGlzKVxuICAgIH0sXG4gICAgY29uZmlndXJhYmxlOiB0cnVlXG4gIH0pXG59KVxuXG5mdW5jdGlvbiBvbmNlIChmbikge1xuICB2YXIgY2FsbGVkID0gZmFsc2VcbiAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoY2FsbGVkKSByZXR1cm5cbiAgICBjYWxsZWQgPSB0cnVlXG4gICAgcmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbiAgfVxufVxuIiwidmFyIGlzRnVuY3Rpb24gPSByZXF1aXJlKCdpcy1mdW5jdGlvbicpXG5cbm1vZHVsZS5leHBvcnRzID0gZm9yRWFjaFxuXG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nXG52YXIgaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5XG5cbmZ1bmN0aW9uIGZvckVhY2gobGlzdCwgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICBpZiAoIWlzRnVuY3Rpb24oaXRlcmF0b3IpKSB7XG4gICAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ2l0ZXJhdG9yIG11c3QgYmUgYSBmdW5jdGlvbicpXG4gICAgfVxuXG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPCAzKSB7XG4gICAgICAgIGNvbnRleHQgPSB0aGlzXG4gICAgfVxuICAgIFxuICAgIGlmICh0b1N0cmluZy5jYWxsKGxpc3QpID09PSAnW29iamVjdCBBcnJheV0nKVxuICAgICAgICBmb3JFYWNoQXJyYXkobGlzdCwgaXRlcmF0b3IsIGNvbnRleHQpXG4gICAgZWxzZSBpZiAodHlwZW9mIGxpc3QgPT09ICdzdHJpbmcnKVxuICAgICAgICBmb3JFYWNoU3RyaW5nKGxpc3QsIGl0ZXJhdG9yLCBjb250ZXh0KVxuICAgIGVsc2VcbiAgICAgICAgZm9yRWFjaE9iamVjdChsaXN0LCBpdGVyYXRvciwgY29udGV4dClcbn1cblxuZnVuY3Rpb24gZm9yRWFjaEFycmF5KGFycmF5LCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBhcnJheS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICBpZiAoaGFzT3duUHJvcGVydHkuY2FsbChhcnJheSwgaSkpIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgYXJyYXlbaV0sIGksIGFycmF5KVxuICAgICAgICB9XG4gICAgfVxufVxuXG5mdW5jdGlvbiBmb3JFYWNoU3RyaW5nKHN0cmluZywgaXRlcmF0b3IsIGNvbnRleHQpIHtcbiAgICBmb3IgKHZhciBpID0gMCwgbGVuID0gc3RyaW5nLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIC8vIG5vIHN1Y2ggdGhpbmcgYXMgYSBzcGFyc2Ugc3RyaW5nLlxuICAgICAgICBpdGVyYXRvci5jYWxsKGNvbnRleHQsIHN0cmluZy5jaGFyQXQoaSksIGksIHN0cmluZylcbiAgICB9XG59XG5cbmZ1bmN0aW9uIGZvckVhY2hPYmplY3Qob2JqZWN0LCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIGZvciAodmFyIGsgaW4gb2JqZWN0KSB7XG4gICAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwgaykpIHtcbiAgICAgICAgICAgIGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgb2JqZWN0W2tdLCBrLCBvYmplY3QpXG4gICAgICAgIH1cbiAgICB9XG59XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGlzRnVuY3Rpb25cblxudmFyIHRvU3RyaW5nID0gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZ1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uIChmbikge1xuICB2YXIgc3RyaW5nID0gdG9TdHJpbmcuY2FsbChmbilcbiAgcmV0dXJuIHN0cmluZyA9PT0gJ1tvYmplY3QgRnVuY3Rpb25dJyB8fFxuICAgICh0eXBlb2YgZm4gPT09ICdmdW5jdGlvbicgJiYgc3RyaW5nICE9PSAnW29iamVjdCBSZWdFeHBdJykgfHxcbiAgICAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgICAgLy8gSUU4IGFuZCBiZWxvd1xuICAgICAoZm4gPT09IHdpbmRvdy5zZXRUaW1lb3V0IHx8XG4gICAgICBmbiA9PT0gd2luZG93LmFsZXJ0IHx8XG4gICAgICBmbiA9PT0gd2luZG93LmNvbmZpcm0gfHxcbiAgICAgIGZuID09PSB3aW5kb3cucHJvbXB0KSlcbn07XG4iLCJcbmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cyA9IHRyaW07XG5cbmZ1bmN0aW9uIHRyaW0oc3RyKXtcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzKnxcXHMqJC9nLCAnJyk7XG59XG5cbmV4cG9ydHMubGVmdCA9IGZ1bmN0aW9uKHN0cil7XG4gIHJldHVybiBzdHIucmVwbGFjZSgvXlxccyovLCAnJyk7XG59O1xuXG5leHBvcnRzLnJpZ2h0ID0gZnVuY3Rpb24oc3RyKXtcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9cXHMqJC8sICcnKTtcbn07XG4iLCJ2YXIgdHJpbSA9IHJlcXVpcmUoJ3RyaW0nKVxuICAsIGZvckVhY2ggPSByZXF1aXJlKCdmb3ItZWFjaCcpXG4gICwgaXNBcnJheSA9IGZ1bmN0aW9uKGFyZykge1xuICAgICAgcmV0dXJuIE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChhcmcpID09PSAnW29iamVjdCBBcnJheV0nO1xuICAgIH1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoaGVhZGVycykge1xuICBpZiAoIWhlYWRlcnMpXG4gICAgcmV0dXJuIHt9XG5cbiAgdmFyIHJlc3VsdCA9IHt9XG5cbiAgZm9yRWFjaChcbiAgICAgIHRyaW0oaGVhZGVycykuc3BsaXQoJ1xcbicpXG4gICAgLCBmdW5jdGlvbiAocm93KSB7XG4gICAgICAgIHZhciBpbmRleCA9IHJvdy5pbmRleE9mKCc6JylcbiAgICAgICAgICAsIGtleSA9IHRyaW0ocm93LnNsaWNlKDAsIGluZGV4KSkudG9Mb3dlckNhc2UoKVxuICAgICAgICAgICwgdmFsdWUgPSB0cmltKHJvdy5zbGljZShpbmRleCArIDEpKVxuXG4gICAgICAgIGlmICh0eXBlb2YocmVzdWx0W2tleV0pID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgIHJlc3VsdFtrZXldID0gdmFsdWVcbiAgICAgICAgfSBlbHNlIGlmIChpc0FycmF5KHJlc3VsdFtrZXldKSkge1xuICAgICAgICAgIHJlc3VsdFtrZXldLnB1c2godmFsdWUpXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzdWx0W2tleV0gPSBbIHJlc3VsdFtrZXldLCB2YWx1ZSBdXG4gICAgICAgIH1cbiAgICAgIH1cbiAgKVxuXG4gIHJldHVybiByZXN1bHRcbn0iLCJtb2R1bGUuZXhwb3J0cyA9IHtcbiAgY2FudmFzOiBkcmF3QnVmZmVyLFxuICBzdmc6IHJlcXVpcmUoJy4vc3ZnLmpzJylcbn07XG5cbmZ1bmN0aW9uIGRyYXdCdWZmZXIgKGNhbnZhcywgYnVmZmVyLCBjb2xvcikge1xuICB2YXIgY3R4ID0gY2FudmFzLmdldENvbnRleHQoJzJkJyk7XG4gIHZhciB3aWR0aCA9IGNhbnZhcy53aWR0aDtcbiAgdmFyIGhlaWdodCA9IGNhbnZhcy5oZWlnaHQ7XG4gIGlmIChjb2xvcikge1xuICAgIGN0eC5maWxsU3R5bGUgPSBjb2xvcjtcbiAgfVxuXG4gICAgdmFyIGRhdGEgPSBidWZmZXIuZ2V0Q2hhbm5lbERhdGEoIDAgKTtcbiAgICB2YXIgc3RlcCA9IE1hdGguY2VpbCggZGF0YS5sZW5ndGggLyB3aWR0aCApO1xuICAgIHZhciBhbXAgPSBoZWlnaHQgLyAyO1xuICAgIGZvcih2YXIgaT0wOyBpIDwgd2lkdGg7IGkrKyl7XG4gICAgICAgIHZhciBtaW4gPSAxLjA7XG4gICAgICAgIHZhciBtYXggPSAtMS4wO1xuICAgICAgICBmb3IgKHZhciBqPTA7IGo8c3RlcDsgaisrKSB7XG4gICAgICAgICAgICB2YXIgZGF0dW0gPSBkYXRhWyhpKnN0ZXApK2pdO1xuICAgICAgICAgICAgaWYgKGRhdHVtIDwgbWluKVxuICAgICAgICAgICAgICAgIG1pbiA9IGRhdHVtO1xuICAgICAgICAgICAgaWYgKGRhdHVtID4gbWF4KVxuICAgICAgICAgICAgICAgIG1heCA9IGRhdHVtO1xuICAgICAgICB9XG4gICAgICBjdHguZmlsbFJlY3QoaSwoMSttaW4pKmFtcCwxLE1hdGgubWF4KDEsKG1heC1taW4pKmFtcCkpO1xuICAgIH1cbn0iLCJ2YXIgaGFzID0gcmVxdWlyZSgnaGFzJyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKG5hbWUsIGF0dHIpIHtcbiAgICB2YXIgZWxlbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUygnaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnLCBuYW1lKTtcbiAgICBpZiAoIWF0dHIpIHJldHVybiBlbGVtO1xuICAgIGZvciAodmFyIGtleSBpbiBhdHRyKSB7XG4gICAgICAgIGlmICghaGFzKGF0dHIsIGtleSkpIGNvbnRpbnVlO1xuICAgICAgICB2YXIgbmtleSA9IGtleS5yZXBsYWNlKC8oW2Etel0pKFtBLVpdKS9nLCBmdW5jdGlvbiAoXywgYSwgYikge1xuICAgICAgICAgICAgcmV0dXJuIGEgKyAnLScgKyBiLnRvTG93ZXJDYXNlKCk7XG4gICAgICAgIH0pO1xuICAgICAgICBlbGVtLnNldEF0dHJpYnV0ZShua2V5LCBhdHRyW2tleV0pO1xuICAgIH1cbiAgICByZXR1cm4gZWxlbTtcbn1cbiIsInZhciBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaGFzKG9iaiwgcHJvcGVydHkpIHtcbiAgcmV0dXJuIGhhc093bi5jYWxsKG9iaiwgcHJvcGVydHkpO1xufTtcbiIsInZhciBjcmVhdGVFbCA9IHJlcXVpcmUoJ3N2Zy1jcmVhdGUtZWxlbWVudCcpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGRyYXdCdWZmZXJTVkc7XG5cbmZ1bmN0aW9uIGdldFJlY3QoeCwgeSwgd2lkdGgsIGhlaWdodCwgY29sb3IpIHtcbiAgcmV0dXJuIGNyZWF0ZUVsKCdyZWN0Jywge1xuICAgIHg6IHgsXG4gICAgeTogeSxcbiAgICB3aWR0aDogd2lkdGgsXG4gICAgaGVpZ2h0OiBoZWlnaHQsXG4gICAgZmlsbDogY29sb3JcbiAgfSk7XG59XG5cbmZ1bmN0aW9uIGRyYXdCdWZmZXJTVkcoYnVmZmVyLCB3aWR0aCwgaGVpZ2h0LCBjb2xvcikge1xuICBpZiAoIWNvbG9yKSBjb2xvciA9ICcjMDAwJztcblxuICB2YXIgc3ZnRWwgPSBjcmVhdGVFbCgnc3ZnJywge1xuICAgIHdpZHRoOiB3aWR0aCxcbiAgICBoZWlnaHQ6IGhlaWdodFxuICB9KTtcblxuICBzdmdFbC5zdHlsZS5kaXNwbGF5ID0gXCJibG9ja1wiO1xuXG4gIHZhciBnID0gY3JlYXRlRWwoJ2cnKTtcblxuICBzdmdFbC5hcHBlbmRDaGlsZChnKTtcblxuICB2YXIgZGF0YSA9IGJ1ZmZlci5nZXRDaGFubmVsRGF0YSggMCApO1xuICB2YXIgc3RlcCA9IE1hdGguY2VpbCggZGF0YS5sZW5ndGggLyB3aWR0aCApO1xuICB2YXIgYW1wID0gaGVpZ2h0IC8gMjtcbiAgZm9yICh2YXIgaT0wOyBpIDwgd2lkdGg7IGkrKykge1xuICAgIHZhciBtaW4gPSAxLjA7XG4gICAgdmFyIG1heCA9IC0xLjA7XG4gICAgZm9yICh2YXIgaj0wOyBqPHN0ZXA7IGorKykge1xuICAgICAgdmFyIGRhdHVtID0gZGF0YVsoaSpzdGVwKStqXTtcbiAgICAgIGlmIChkYXR1bSA8IG1pbilcbiAgICAgICAgbWluID0gZGF0dW07XG4gICAgICBpZiAoZGF0dW0gPiBtYXgpXG4gICAgICAgIG1heCA9IGRhdHVtO1xuICAgIH1cbiAgICBnLmFwcGVuZENoaWxkKGdldFJlY3QoaSwgKDErbWluKSphbXAsIDEsIE1hdGgubWF4KDEsKG1heC1taW4pKmFtcCksIGNvbG9yKSk7XG4gIH1cblxuICByZXR1cm4gc3ZnRWw7XG59IixudWxsLCIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuZnVuY3Rpb24gRXZlbnRFbWl0dGVyKCkge1xuICB0aGlzLl9ldmVudHMgPSB0aGlzLl9ldmVudHMgfHwge307XG4gIHRoaXMuX21heExpc3RlbmVycyA9IHRoaXMuX21heExpc3RlbmVycyB8fCB1bmRlZmluZWQ7XG59XG5tb2R1bGUuZXhwb3J0cyA9IEV2ZW50RW1pdHRlcjtcblxuLy8gQmFja3dhcmRzLWNvbXBhdCB3aXRoIG5vZGUgMC4xMC54XG5FdmVudEVtaXR0ZXIuRXZlbnRFbWl0dGVyID0gRXZlbnRFbWl0dGVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9ldmVudHMgPSB1bmRlZmluZWQ7XG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLl9tYXhMaXN0ZW5lcnMgPSB1bmRlZmluZWQ7XG5cbi8vIEJ5IGRlZmF1bHQgRXZlbnRFbWl0dGVycyB3aWxsIHByaW50IGEgd2FybmluZyBpZiBtb3JlIHRoYW4gMTAgbGlzdGVuZXJzIGFyZVxuLy8gYWRkZWQgdG8gaXQuIFRoaXMgaXMgYSB1c2VmdWwgZGVmYXVsdCB3aGljaCBoZWxwcyBmaW5kaW5nIG1lbW9yeSBsZWFrcy5cbkV2ZW50RW1pdHRlci5kZWZhdWx0TWF4TGlzdGVuZXJzID0gMTA7XG5cbi8vIE9idmlvdXNseSBub3QgYWxsIEVtaXR0ZXJzIHNob3VsZCBiZSBsaW1pdGVkIHRvIDEwLiBUaGlzIGZ1bmN0aW9uIGFsbG93c1xuLy8gdGhhdCB0byBiZSBpbmNyZWFzZWQuIFNldCB0byB6ZXJvIGZvciB1bmxpbWl0ZWQuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnNldE1heExpc3RlbmVycyA9IGZ1bmN0aW9uKG4pIHtcbiAgaWYgKCFpc051bWJlcihuKSB8fCBuIDwgMCB8fCBpc05hTihuKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ24gbXVzdCBiZSBhIHBvc2l0aXZlIG51bWJlcicpO1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSBuO1xuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuZW1pdCA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGVyLCBoYW5kbGVyLCBsZW4sIGFyZ3MsIGksIGxpc3RlbmVycztcblxuICBpZiAoIXRoaXMuX2V2ZW50cylcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcblxuICAvLyBJZiB0aGVyZSBpcyBubyAnZXJyb3InIGV2ZW50IGxpc3RlbmVyIHRoZW4gdGhyb3cuXG4gIGlmICh0eXBlID09PSAnZXJyb3InKSB7XG4gICAgaWYgKCF0aGlzLl9ldmVudHMuZXJyb3IgfHxcbiAgICAgICAgKGlzT2JqZWN0KHRoaXMuX2V2ZW50cy5lcnJvcikgJiYgIXRoaXMuX2V2ZW50cy5lcnJvci5sZW5ndGgpKSB7XG4gICAgICBlciA9IGFyZ3VtZW50c1sxXTtcbiAgICAgIGlmIChlciBpbnN0YW5jZW9mIEVycm9yKSB7XG4gICAgICAgIHRocm93IGVyOyAvLyBVbmhhbmRsZWQgJ2Vycm9yJyBldmVudFxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgVHlwZUVycm9yKCdVbmNhdWdodCwgdW5zcGVjaWZpZWQgXCJlcnJvclwiIGV2ZW50LicpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGhhbmRsZXIgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzVW5kZWZpbmVkKGhhbmRsZXIpKVxuICAgIHJldHVybiBmYWxzZTtcblxuICBpZiAoaXNGdW5jdGlvbihoYW5kbGVyKSkge1xuICAgIHN3aXRjaCAoYXJndW1lbnRzLmxlbmd0aCkge1xuICAgICAgLy8gZmFzdCBjYXNlc1xuICAgICAgY2FzZSAxOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcyk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAyOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDM6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgLy8gc2xvd2VyXG4gICAgICBkZWZhdWx0OlxuICAgICAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgICAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgICAgICBmb3IgKGkgPSAxOyBpIDwgbGVuOyBpKyspXG4gICAgICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgbGVuID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICBhcmdzID0gbmV3IEFycmF5KGxlbiAtIDEpO1xuICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuXG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgdmFyIG07XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCFlbWl0dGVyLl9ldmVudHMgfHwgIWVtaXR0ZXIuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSAwO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKGVtaXR0ZXIuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gMTtcbiAgZWxzZVxuICAgIHJldCA9IGVtaXR0ZXIuX2V2ZW50c1t0eXBlXS5sZW5ndGg7XG4gIHJldHVybiByZXQ7XG59O1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG4iLCIoZnVuY3Rpb24gKHByb2Nlc3Mpe1xuLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbi8vIHJlc29sdmVzIC4gYW5kIC4uIGVsZW1lbnRzIGluIGEgcGF0aCBhcnJheSB3aXRoIGRpcmVjdG9yeSBuYW1lcyB0aGVyZVxuLy8gbXVzdCBiZSBubyBzbGFzaGVzLCBlbXB0eSBlbGVtZW50cywgb3IgZGV2aWNlIG5hbWVzIChjOlxcKSBpbiB0aGUgYXJyYXlcbi8vIChzbyBhbHNvIG5vIGxlYWRpbmcgYW5kIHRyYWlsaW5nIHNsYXNoZXMgLSBpdCBkb2VzIG5vdCBkaXN0aW5ndWlzaFxuLy8gcmVsYXRpdmUgYW5kIGFic29sdXRlIHBhdGhzKVxuZnVuY3Rpb24gbm9ybWFsaXplQXJyYXkocGFydHMsIGFsbG93QWJvdmVSb290KSB7XG4gIC8vIGlmIHRoZSBwYXRoIHRyaWVzIHRvIGdvIGFib3ZlIHRoZSByb290LCBgdXBgIGVuZHMgdXAgPiAwXG4gIHZhciB1cCA9IDA7XG4gIGZvciAodmFyIGkgPSBwYXJ0cy5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuICAgIHZhciBsYXN0ID0gcGFydHNbaV07XG4gICAgaWYgKGxhc3QgPT09ICcuJykge1xuICAgICAgcGFydHMuc3BsaWNlKGksIDEpO1xuICAgIH0gZWxzZSBpZiAobGFzdCA9PT0gJy4uJykge1xuICAgICAgcGFydHMuc3BsaWNlKGksIDEpO1xuICAgICAgdXArKztcbiAgICB9IGVsc2UgaWYgKHVwKSB7XG4gICAgICBwYXJ0cy5zcGxpY2UoaSwgMSk7XG4gICAgICB1cC0tO1xuICAgIH1cbiAgfVxuXG4gIC8vIGlmIHRoZSBwYXRoIGlzIGFsbG93ZWQgdG8gZ28gYWJvdmUgdGhlIHJvb3QsIHJlc3RvcmUgbGVhZGluZyAuLnNcbiAgaWYgKGFsbG93QWJvdmVSb290KSB7XG4gICAgZm9yICg7IHVwLS07IHVwKSB7XG4gICAgICBwYXJ0cy51bnNoaWZ0KCcuLicpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBwYXJ0cztcbn1cblxuLy8gU3BsaXQgYSBmaWxlbmFtZSBpbnRvIFtyb290LCBkaXIsIGJhc2VuYW1lLCBleHRdLCB1bml4IHZlcnNpb25cbi8vICdyb290JyBpcyBqdXN0IGEgc2xhc2gsIG9yIG5vdGhpbmcuXG52YXIgc3BsaXRQYXRoUmUgPVxuICAgIC9eKFxcLz98KShbXFxzXFxTXSo/KSgoPzpcXC57MSwyfXxbXlxcL10rP3wpKFxcLlteLlxcL10qfCkpKD86W1xcL10qKSQvO1xudmFyIHNwbGl0UGF0aCA9IGZ1bmN0aW9uKGZpbGVuYW1lKSB7XG4gIHJldHVybiBzcGxpdFBhdGhSZS5leGVjKGZpbGVuYW1lKS5zbGljZSgxKTtcbn07XG5cbi8vIHBhdGgucmVzb2x2ZShbZnJvbSAuLi5dLCB0bylcbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMucmVzb2x2ZSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgcmVzb2x2ZWRQYXRoID0gJycsXG4gICAgICByZXNvbHZlZEFic29sdXRlID0gZmFsc2U7XG5cbiAgZm9yICh2YXIgaSA9IGFyZ3VtZW50cy5sZW5ndGggLSAxOyBpID49IC0xICYmICFyZXNvbHZlZEFic29sdXRlOyBpLS0pIHtcbiAgICB2YXIgcGF0aCA9IChpID49IDApID8gYXJndW1lbnRzW2ldIDogcHJvY2Vzcy5jd2QoKTtcblxuICAgIC8vIFNraXAgZW1wdHkgYW5kIGludmFsaWQgZW50cmllc1xuICAgIGlmICh0eXBlb2YgcGF0aCAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50cyB0byBwYXRoLnJlc29sdmUgbXVzdCBiZSBzdHJpbmdzJyk7XG4gICAgfSBlbHNlIGlmICghcGF0aCkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgcmVzb2x2ZWRQYXRoID0gcGF0aCArICcvJyArIHJlc29sdmVkUGF0aDtcbiAgICByZXNvbHZlZEFic29sdXRlID0gcGF0aC5jaGFyQXQoMCkgPT09ICcvJztcbiAgfVxuXG4gIC8vIEF0IHRoaXMgcG9pbnQgdGhlIHBhdGggc2hvdWxkIGJlIHJlc29sdmVkIHRvIGEgZnVsbCBhYnNvbHV0ZSBwYXRoLCBidXRcbiAgLy8gaGFuZGxlIHJlbGF0aXZlIHBhdGhzIHRvIGJlIHNhZmUgKG1pZ2h0IGhhcHBlbiB3aGVuIHByb2Nlc3MuY3dkKCkgZmFpbHMpXG5cbiAgLy8gTm9ybWFsaXplIHRoZSBwYXRoXG4gIHJlc29sdmVkUGF0aCA9IG5vcm1hbGl6ZUFycmF5KGZpbHRlcihyZXNvbHZlZFBhdGguc3BsaXQoJy8nKSwgZnVuY3Rpb24ocCkge1xuICAgIHJldHVybiAhIXA7XG4gIH0pLCAhcmVzb2x2ZWRBYnNvbHV0ZSkuam9pbignLycpO1xuXG4gIHJldHVybiAoKHJlc29sdmVkQWJzb2x1dGUgPyAnLycgOiAnJykgKyByZXNvbHZlZFBhdGgpIHx8ICcuJztcbn07XG5cbi8vIHBhdGgubm9ybWFsaXplKHBhdGgpXG4vLyBwb3NpeCB2ZXJzaW9uXG5leHBvcnRzLm5vcm1hbGl6ZSA9IGZ1bmN0aW9uKHBhdGgpIHtcbiAgdmFyIGlzQWJzb2x1dGUgPSBleHBvcnRzLmlzQWJzb2x1dGUocGF0aCksXG4gICAgICB0cmFpbGluZ1NsYXNoID0gc3Vic3RyKHBhdGgsIC0xKSA9PT0gJy8nO1xuXG4gIC8vIE5vcm1hbGl6ZSB0aGUgcGF0aFxuICBwYXRoID0gbm9ybWFsaXplQXJyYXkoZmlsdGVyKHBhdGguc3BsaXQoJy8nKSwgZnVuY3Rpb24ocCkge1xuICAgIHJldHVybiAhIXA7XG4gIH0pLCAhaXNBYnNvbHV0ZSkuam9pbignLycpO1xuXG4gIGlmICghcGF0aCAmJiAhaXNBYnNvbHV0ZSkge1xuICAgIHBhdGggPSAnLic7XG4gIH1cbiAgaWYgKHBhdGggJiYgdHJhaWxpbmdTbGFzaCkge1xuICAgIHBhdGggKz0gJy8nO1xuICB9XG5cbiAgcmV0dXJuIChpc0Fic29sdXRlID8gJy8nIDogJycpICsgcGF0aDtcbn07XG5cbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMuaXNBYnNvbHV0ZSA9IGZ1bmN0aW9uKHBhdGgpIHtcbiAgcmV0dXJuIHBhdGguY2hhckF0KDApID09PSAnLyc7XG59O1xuXG4vLyBwb3NpeCB2ZXJzaW9uXG5leHBvcnRzLmpvaW4gPSBmdW5jdGlvbigpIHtcbiAgdmFyIHBhdGhzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAwKTtcbiAgcmV0dXJuIGV4cG9ydHMubm9ybWFsaXplKGZpbHRlcihwYXRocywgZnVuY3Rpb24ocCwgaW5kZXgpIHtcbiAgICBpZiAodHlwZW9mIHAgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdBcmd1bWVudHMgdG8gcGF0aC5qb2luIG11c3QgYmUgc3RyaW5ncycpO1xuICAgIH1cbiAgICByZXR1cm4gcDtcbiAgfSkuam9pbignLycpKTtcbn07XG5cblxuLy8gcGF0aC5yZWxhdGl2ZShmcm9tLCB0bylcbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMucmVsYXRpdmUgPSBmdW5jdGlvbihmcm9tLCB0bykge1xuICBmcm9tID0gZXhwb3J0cy5yZXNvbHZlKGZyb20pLnN1YnN0cigxKTtcbiAgdG8gPSBleHBvcnRzLnJlc29sdmUodG8pLnN1YnN0cigxKTtcblxuICBmdW5jdGlvbiB0cmltKGFycikge1xuICAgIHZhciBzdGFydCA9IDA7XG4gICAgZm9yICg7IHN0YXJ0IDwgYXJyLmxlbmd0aDsgc3RhcnQrKykge1xuICAgICAgaWYgKGFycltzdGFydF0gIT09ICcnKSBicmVhaztcbiAgICB9XG5cbiAgICB2YXIgZW5kID0gYXJyLmxlbmd0aCAtIDE7XG4gICAgZm9yICg7IGVuZCA+PSAwOyBlbmQtLSkge1xuICAgICAgaWYgKGFycltlbmRdICE9PSAnJykgYnJlYWs7XG4gICAgfVxuXG4gICAgaWYgKHN0YXJ0ID4gZW5kKSByZXR1cm4gW107XG4gICAgcmV0dXJuIGFyci5zbGljZShzdGFydCwgZW5kIC0gc3RhcnQgKyAxKTtcbiAgfVxuXG4gIHZhciBmcm9tUGFydHMgPSB0cmltKGZyb20uc3BsaXQoJy8nKSk7XG4gIHZhciB0b1BhcnRzID0gdHJpbSh0by5zcGxpdCgnLycpKTtcblxuICB2YXIgbGVuZ3RoID0gTWF0aC5taW4oZnJvbVBhcnRzLmxlbmd0aCwgdG9QYXJ0cy5sZW5ndGgpO1xuICB2YXIgc2FtZVBhcnRzTGVuZ3RoID0gbGVuZ3RoO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGZyb21QYXJ0c1tpXSAhPT0gdG9QYXJ0c1tpXSkge1xuICAgICAgc2FtZVBhcnRzTGVuZ3RoID0gaTtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIHZhciBvdXRwdXRQYXJ0cyA9IFtdO1xuICBmb3IgKHZhciBpID0gc2FtZVBhcnRzTGVuZ3RoOyBpIDwgZnJvbVBhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgb3V0cHV0UGFydHMucHVzaCgnLi4nKTtcbiAgfVxuXG4gIG91dHB1dFBhcnRzID0gb3V0cHV0UGFydHMuY29uY2F0KHRvUGFydHMuc2xpY2Uoc2FtZVBhcnRzTGVuZ3RoKSk7XG5cbiAgcmV0dXJuIG91dHB1dFBhcnRzLmpvaW4oJy8nKTtcbn07XG5cbmV4cG9ydHMuc2VwID0gJy8nO1xuZXhwb3J0cy5kZWxpbWl0ZXIgPSAnOic7XG5cbmV4cG9ydHMuZGlybmFtZSA9IGZ1bmN0aW9uKHBhdGgpIHtcbiAgdmFyIHJlc3VsdCA9IHNwbGl0UGF0aChwYXRoKSxcbiAgICAgIHJvb3QgPSByZXN1bHRbMF0sXG4gICAgICBkaXIgPSByZXN1bHRbMV07XG5cbiAgaWYgKCFyb290ICYmICFkaXIpIHtcbiAgICAvLyBObyBkaXJuYW1lIHdoYXRzb2V2ZXJcbiAgICByZXR1cm4gJy4nO1xuICB9XG5cbiAgaWYgKGRpcikge1xuICAgIC8vIEl0IGhhcyBhIGRpcm5hbWUsIHN0cmlwIHRyYWlsaW5nIHNsYXNoXG4gICAgZGlyID0gZGlyLnN1YnN0cigwLCBkaXIubGVuZ3RoIC0gMSk7XG4gIH1cblxuICByZXR1cm4gcm9vdCArIGRpcjtcbn07XG5cblxuZXhwb3J0cy5iYXNlbmFtZSA9IGZ1bmN0aW9uKHBhdGgsIGV4dCkge1xuICB2YXIgZiA9IHNwbGl0UGF0aChwYXRoKVsyXTtcbiAgLy8gVE9ETzogbWFrZSB0aGlzIGNvbXBhcmlzb24gY2FzZS1pbnNlbnNpdGl2ZSBvbiB3aW5kb3dzP1xuICBpZiAoZXh0ICYmIGYuc3Vic3RyKC0xICogZXh0Lmxlbmd0aCkgPT09IGV4dCkge1xuICAgIGYgPSBmLnN1YnN0cigwLCBmLmxlbmd0aCAtIGV4dC5sZW5ndGgpO1xuICB9XG4gIHJldHVybiBmO1xufTtcblxuXG5leHBvcnRzLmV4dG5hbWUgPSBmdW5jdGlvbihwYXRoKSB7XG4gIHJldHVybiBzcGxpdFBhdGgocGF0aClbM107XG59O1xuXG5mdW5jdGlvbiBmaWx0ZXIgKHhzLCBmKSB7XG4gICAgaWYgKHhzLmZpbHRlcikgcmV0dXJuIHhzLmZpbHRlcihmKTtcbiAgICB2YXIgcmVzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCB4cy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoZih4c1tpXSwgaSwgeHMpKSByZXMucHVzaCh4c1tpXSk7XG4gICAgfVxuICAgIHJldHVybiByZXM7XG59XG5cbi8vIFN0cmluZy5wcm90b3R5cGUuc3Vic3RyIC0gbmVnYXRpdmUgaW5kZXggZG9uJ3Qgd29yayBpbiBJRThcbnZhciBzdWJzdHIgPSAnYWInLnN1YnN0cigtMSkgPT09ICdiJ1xuICAgID8gZnVuY3Rpb24gKHN0ciwgc3RhcnQsIGxlbikgeyByZXR1cm4gc3RyLnN1YnN0cihzdGFydCwgbGVuKSB9XG4gICAgOiBmdW5jdGlvbiAoc3RyLCBzdGFydCwgbGVuKSB7XG4gICAgICAgIGlmIChzdGFydCA8IDApIHN0YXJ0ID0gc3RyLmxlbmd0aCArIHN0YXJ0O1xuICAgICAgICByZXR1cm4gc3RyLnN1YnN0cihzdGFydCwgbGVuKTtcbiAgICB9XG47XG5cbn0pLmNhbGwodGhpcyxyZXF1aXJlKCdfcHJvY2VzcycpKSIsIi8vIHNoaW0gZm9yIHVzaW5nIHByb2Nlc3MgaW4gYnJvd3NlclxuXG52YXIgcHJvY2VzcyA9IG1vZHVsZS5leHBvcnRzID0ge307XG5cbnByb2Nlc3MubmV4dFRpY2sgPSAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBjYW5TZXRJbW1lZGlhdGUgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5zZXRJbW1lZGlhdGU7XG4gICAgdmFyIGNhblBvc3QgPSB0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJ1xuICAgICYmIHdpbmRvdy5wb3N0TWVzc2FnZSAmJiB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lclxuICAgIDtcblxuICAgIGlmIChjYW5TZXRJbW1lZGlhdGUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIChmKSB7IHJldHVybiB3aW5kb3cuc2V0SW1tZWRpYXRlKGYpIH07XG4gICAgfVxuXG4gICAgaWYgKGNhblBvc3QpIHtcbiAgICAgICAgdmFyIHF1ZXVlID0gW107XG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24gKGV2KSB7XG4gICAgICAgICAgICB2YXIgc291cmNlID0gZXYuc291cmNlO1xuICAgICAgICAgICAgaWYgKChzb3VyY2UgPT09IHdpbmRvdyB8fCBzb3VyY2UgPT09IG51bGwpICYmIGV2LmRhdGEgPT09ICdwcm9jZXNzLXRpY2snKSB7XG4gICAgICAgICAgICAgICAgZXYuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICAgICAgaWYgKHF1ZXVlLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGZuID0gcXVldWUuc2hpZnQoKTtcbiAgICAgICAgICAgICAgICAgICAgZm4oKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sIHRydWUpO1xuXG4gICAgICAgIHJldHVybiBmdW5jdGlvbiBuZXh0VGljayhmbikge1xuICAgICAgICAgICAgcXVldWUucHVzaChmbik7XG4gICAgICAgICAgICB3aW5kb3cucG9zdE1lc3NhZ2UoJ3Byb2Nlc3MtdGljaycsICcqJyk7XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIGZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gICAgICAgIHNldFRpbWVvdXQoZm4sIDApO1xuICAgIH07XG59KSgpO1xuXG5wcm9jZXNzLnRpdGxlID0gJ2Jyb3dzZXInO1xucHJvY2Vzcy5icm93c2VyID0gdHJ1ZTtcbnByb2Nlc3MuZW52ID0ge307XG5wcm9jZXNzLmFyZ3YgPSBbXTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn1cblxuLy8gVE9ETyhzaHR5bG1hbilcbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xuIl19
