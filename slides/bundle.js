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
  url: 'faust-clip.wav',
  context: ctx,
  gainNode: ctx.createGain(),
  nodes: [timeFFT, freqFFT]
});

src.load();

var loadBtn = document.querySelector('#load-audio');

loadBtn.addEventListener('click', function(ev) {
  loadBtn.innerText = 'playing...';
  if (src.playing) {
    src.stop();
    loadBtn.innerText = 'stopped';
  }
  else src.play();
})

var progress = document.querySelector('.progress-contain');

src.on('time', function(time) {
  progress.style.width = time.percent;
})

src.on('load', function() {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi91c3IvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL2hvbWUvbWVhbmRhdmUvRG9jdW1lbnRzL2RzcC10YWxrL3NsaWRlcy9pbmRleC5qcyIsIi9ob21lL21lYW5kYXZlL0RvY3VtZW50cy9kc3AtdGFsay9zbGlkZXMvbm9kZV9tb2R1bGVzL2F1ZGlvLWZmdC9pbmRleC5qcyIsIi9ob21lL21lYW5kYXZlL0RvY3VtZW50cy9kc3AtdGFsay9zbGlkZXMvbm9kZV9tb2R1bGVzL2F1ZGlvLXdvcmtlci1ub2RlL2xpYi9hdWRpby1wYXJhbS1pbXBsLmpzIiwiL2hvbWUvbWVhbmRhdmUvRG9jdW1lbnRzL2RzcC10YWxrL3NsaWRlcy9ub2RlX21vZHVsZXMvYXVkaW8td29ya2VyLW5vZGUvbGliL2F1ZGlvLXBhcmFtLW5vZGUuanMiLCIvaG9tZS9tZWFuZGF2ZS9Eb2N1bWVudHMvZHNwLXRhbGsvc2xpZGVzL25vZGVfbW9kdWxlcy9hdWRpby13b3JrZXItbm9kZS9saWIvYXVkaW8tcHJvY2Vzcy1idWlsZGVyLmpzIiwiL2hvbWUvbWVhbmRhdmUvRG9jdW1lbnRzL2RzcC10YWxrL3NsaWRlcy9ub2RlX21vZHVsZXMvYXVkaW8td29ya2VyLW5vZGUvbGliL2F1ZGlvLXdvcmtlci1jb2RlLmpzIiwiL2hvbWUvbWVhbmRhdmUvRG9jdW1lbnRzL2RzcC10YWxrL3NsaWRlcy9ub2RlX21vZHVsZXMvYXVkaW8td29ya2VyLW5vZGUvbGliL2F1ZGlvLXdvcmtlci1nbG9iYWwtc2NvcGUuanMiLCIvaG9tZS9tZWFuZGF2ZS9Eb2N1bWVudHMvZHNwLXRhbGsvc2xpZGVzL25vZGVfbW9kdWxlcy9hdWRpby13b3JrZXItbm9kZS9saWIvYXVkaW8td29ya2VyLWltcGwuanMiLCIvaG9tZS9tZWFuZGF2ZS9Eb2N1bWVudHMvZHNwLXRhbGsvc2xpZGVzL25vZGVfbW9kdWxlcy9hdWRpby13b3JrZXItbm9kZS9saWIvYXVkaW8td29ya2VyLW5vZGUuanMiLCIvaG9tZS9tZWFuZGF2ZS9Eb2N1bWVudHMvZHNwLXRhbGsvc2xpZGVzL25vZGVfbW9kdWxlcy9hdWRpby13b3JrZXItbm9kZS9saWIvbWVzc2FnZS1jaGFubmVsLmpzIiwiL2hvbWUvbWVhbmRhdmUvRG9jdW1lbnRzL2RzcC10YWxrL3NsaWRlcy9ub2RlX21vZHVsZXMvYXVkaW8td29ya2VyLW5vZGUvbGliL3NjcmlwdC1sb2FkZXIuanMiLCIvaG9tZS9tZWFuZGF2ZS9Eb2N1bWVudHMvZHNwLXRhbGsvc2xpZGVzL25vZGVfbW9kdWxlcy9hdWRpby13b3JrZXItbm9kZS9saWIvdXRpbHMuanMiLCIvaG9tZS9tZWFuZGF2ZS9Eb2N1bWVudHMvZHNwLXRhbGsvc2xpZGVzL25vZGVfbW9kdWxlcy9hdWRpb3NvdXJjZS9pbmRleC5qcyIsIi9ob21lL21lYW5kYXZlL0RvY3VtZW50cy9kc3AtdGFsay9zbGlkZXMvbm9kZV9tb2R1bGVzL2F1ZGlvc291cmNlL2xpYi9pbmRleC5qcyIsIi9ob21lL21lYW5kYXZlL0RvY3VtZW50cy9kc3AtdGFsay9zbGlkZXMvbm9kZV9tb2R1bGVzL2F1ZGlvc291cmNlL25vZGVfbW9kdWxlcy9yYWYvaW5kZXguanMiLCIvaG9tZS9tZWFuZGF2ZS9Eb2N1bWVudHMvZHNwLXRhbGsvc2xpZGVzL25vZGVfbW9kdWxlcy9hdWRpb3NvdXJjZS9ub2RlX21vZHVsZXMvcmFmL25vZGVfbW9kdWxlcy9wZXJmb3JtYW5jZS1ub3cvbGliL3BlcmZvcm1hbmNlLW5vdy5qcyIsIi9ob21lL21lYW5kYXZlL0RvY3VtZW50cy9kc3AtdGFsay9zbGlkZXMvbm9kZV9tb2R1bGVzL2F1ZGlvc291cmNlL25vZGVfbW9kdWxlcy94aHIvaW5kZXguanMiLCIvaG9tZS9tZWFuZGF2ZS9Eb2N1bWVudHMvZHNwLXRhbGsvc2xpZGVzL25vZGVfbW9kdWxlcy9hdWRpb3NvdXJjZS9ub2RlX21vZHVsZXMveGhyL25vZGVfbW9kdWxlcy9nbG9iYWwvd2luZG93LmpzIiwiL2hvbWUvbWVhbmRhdmUvRG9jdW1lbnRzL2RzcC10YWxrL3NsaWRlcy9ub2RlX21vZHVsZXMvYXVkaW9zb3VyY2Uvbm9kZV9tb2R1bGVzL3hoci9ub2RlX21vZHVsZXMvb25jZS9vbmNlLmpzIiwiL2hvbWUvbWVhbmRhdmUvRG9jdW1lbnRzL2RzcC10YWxrL3NsaWRlcy9ub2RlX21vZHVsZXMvYXVkaW9zb3VyY2Uvbm9kZV9tb2R1bGVzL3hoci9ub2RlX21vZHVsZXMvcGFyc2UtaGVhZGVycy9ub2RlX21vZHVsZXMvZm9yLWVhY2gvaW5kZXguanMiLCIvaG9tZS9tZWFuZGF2ZS9Eb2N1bWVudHMvZHNwLXRhbGsvc2xpZGVzL25vZGVfbW9kdWxlcy9hdWRpb3NvdXJjZS9ub2RlX21vZHVsZXMveGhyL25vZGVfbW9kdWxlcy9wYXJzZS1oZWFkZXJzL25vZGVfbW9kdWxlcy9mb3ItZWFjaC9ub2RlX21vZHVsZXMvaXMtZnVuY3Rpb24vaW5kZXguanMiLCIvaG9tZS9tZWFuZGF2ZS9Eb2N1bWVudHMvZHNwLXRhbGsvc2xpZGVzL25vZGVfbW9kdWxlcy9hdWRpb3NvdXJjZS9ub2RlX21vZHVsZXMveGhyL25vZGVfbW9kdWxlcy9wYXJzZS1oZWFkZXJzL25vZGVfbW9kdWxlcy90cmltL2luZGV4LmpzIiwiL2hvbWUvbWVhbmRhdmUvRG9jdW1lbnRzL2RzcC10YWxrL3NsaWRlcy9ub2RlX21vZHVsZXMvYXVkaW9zb3VyY2Uvbm9kZV9tb2R1bGVzL3hoci9ub2RlX21vZHVsZXMvcGFyc2UtaGVhZGVycy9wYXJzZS1oZWFkZXJzLmpzIiwiL2hvbWUvbWVhbmRhdmUvRG9jdW1lbnRzL2RzcC10YWxrL3NsaWRlcy9ub2RlX21vZHVsZXMvZHJhdy13YXZlL2luZGV4LmpzIiwiL2hvbWUvbWVhbmRhdmUvRG9jdW1lbnRzL2RzcC10YWxrL3NsaWRlcy9ub2RlX21vZHVsZXMvZHJhdy13YXZlL25vZGVfbW9kdWxlcy9zdmctY3JlYXRlLWVsZW1lbnQvaW5kZXguanMiLCIvaG9tZS9tZWFuZGF2ZS9Eb2N1bWVudHMvZHNwLXRhbGsvc2xpZGVzL25vZGVfbW9kdWxlcy9kcmF3LXdhdmUvbm9kZV9tb2R1bGVzL3N2Zy1jcmVhdGUtZWxlbWVudC9ub2RlX21vZHVsZXMvaGFzL3NyYy9pbmRleC5qcyIsIi9ob21lL21lYW5kYXZlL0RvY3VtZW50cy9kc3AtdGFsay9zbGlkZXMvbm9kZV9tb2R1bGVzL2RyYXctd2F2ZS9zdmcuanMiLCIvdXNyL2xpYi9ub2RlX21vZHVsZXMvd2F0Y2hpZnkvbm9kZV9tb2R1bGVzL2Jyb3dzZXJpZnkvbGliL19lbXB0eS5qcyIsIi91c3IvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIi91c3IvbGliL25vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvcGF0aC1icm93c2VyaWZ5L2luZGV4LmpzIiwiL3Vzci9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNySEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5SkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25QQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN0Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0tBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNmQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNkQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL1NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbE9BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBBdWRpb1NvdXJjZSA9IHJlcXVpcmUoJ2F1ZGlvc291cmNlJyk7XG52YXIgRkZUID0gcmVxdWlyZSgnYXVkaW8tZmZ0Jyk7XG52YXIgZHJhd1dhdmUgPSByZXF1aXJlKCdkcmF3LXdhdmUnKTtcbnZhciBBdWRpb1dvcmtlck5vZGUgPSByZXF1aXJlKCdhdWRpby13b3JrZXItbm9kZScpO1xudmFyIGN0eCA9IG5ldyBBdWRpb0NvbnRleHQoKTtcblxudmFyIHRpbWVGRlQgPSBuZXcgRkZUKGN0eCwge1xuICBjYW52YXM6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyN0aW1lJyksXG4gIHR5cGU6ICd0aW1lJ1xufSk7XG5cbnZhciBmcmVxRkZUID0gbmV3IEZGVChjdHgsIHtcbiAgY2FudmFzOiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZnJlcXVlbmN5Jylcbn0pO1xuXG52YXIgc3JjID0gbmV3IEF1ZGlvU291cmNlKHtcbiAgdXJsOiAnZmF1c3QtY2xpcC53YXYnLFxuICBjb250ZXh0OiBjdHgsXG4gIGdhaW5Ob2RlOiBjdHguY3JlYXRlR2FpbigpLFxuICBub2RlczogW3RpbWVGRlQsIGZyZXFGRlRdXG59KTtcblxuc3JjLmxvYWQoKTtcblxudmFyIGxvYWRCdG4gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjbG9hZC1hdWRpbycpO1xuXG5sb2FkQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24oZXYpIHtcbiAgbG9hZEJ0bi5pbm5lclRleHQgPSAncGxheWluZy4uLic7XG4gIGlmIChzcmMucGxheWluZykge1xuICAgIHNyYy5zdG9wKCk7XG4gICAgbG9hZEJ0bi5pbm5lclRleHQgPSAnc3RvcHBlZCc7XG4gIH1cbiAgZWxzZSBzcmMucGxheSgpO1xufSlcblxudmFyIHByb2dyZXNzID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLnByb2dyZXNzLWNvbnRhaW4nKTtcblxuc3JjLm9uKCd0aW1lJywgZnVuY3Rpb24odGltZSkge1xuICBwcm9ncmVzcy5zdHlsZS53aWR0aCA9IHRpbWUucGVyY2VudDtcbn0pXG5cbnNyYy5vbignbG9hZCcsIGZ1bmN0aW9uKCkge1xuICBkcmF3V2F2ZS5jYW52YXMocHJvZ3Jlc3MucXVlcnlTZWxlY3RvcignI3dhdmUtcHJvZ3Jlc3MnKSwgc3JjLmJ1ZmZlciwgJyNERjc5REYnKTtcbiAgZHJhd1dhdmUuY2FudmFzKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyN3YXZlJyksIHNyYy5idWZmZXIsICcjNTJGNkE0Jyk7XG4gIGxvYWRCdG4uaW5uZXJUZXh0ID0gJ0xPQURFRCEnO1xufSk7XG5cbi8qXG4gKlxuICogQVVESU8gV09SS0VSIE5PREVcbiAqXG4gKlxuICogKi9cblxudmFyIGNydXNoQnRuID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignI2NydXNoLWJ1dHQnKTtcbmNydXNoQnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24oKSB7XG4gIHBsYXlOb3RlKG51bGwsIHRydWUpO1xufSlcblxudmFyIGJpdGNydXNoZXJOb2RlID0gbmV3IEF1ZGlvV29ya2VyTm9kZShjdHgsIFwiYml0Y3J1c2hlci13b3JrZXIuanNcIiwgMSwgMSk7XG5iaXRjcnVzaGVyTm9kZS5hZGRQYXJhbWV0ZXIoXCJiaXRzXCIsIDgpO1xuLy8gQ3VzdG9tIHBhcmFtZXRlciAtIGZyZXF1ZW5jeSByZWR1Y3Rpb24sIDAtMSwgZGVmYXVsdCAwLjVcbmJpdGNydXNoZXJOb2RlLmFkZFBhcmFtZXRlcihcImZyZXF1ZW5jeVJlZHVjdGlvblwiLCAwLjUpO1xuXG52YXIgYml0cyA9IDg7XG52YXIgZnJlcXVlbmN5UmVkdWN0aW9uID0gMC41O1xuXG5iaXRjcnVzaGVyTm9kZS5iaXRzLnZhbHVlID0gYml0cztcbmJpdGNydXNoZXJOb2RlLmZyZXF1ZW5jeVJlZHVjdGlvbi52YWx1ZSA9IGZyZXF1ZW5jeVJlZHVjdGlvbjtcblxuLy8gVE9ETyhESik6IHBhc3MgdGhlc2UgZGlmIGNvbG9ycy4uLlxudmFyIHRpbWVGRlQyID0gbmV3IEZGVChjdHgsIHtcbiAgY2FudmFzOiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjdGltZS1iYycpLFxuICB0eXBlOiAndGltZSdcbn0pO1xuXG52YXIgZnJlcUZGVDIgPSBuZXcgRkZUKGN0eCwge1xuICBjYW52YXM6IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNmcmVxdWVuY3ktYmMnKVxufSk7XG5cbmRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJyNwbGF5LW9nJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbigpIHtcbiAgcGxheU5vdGUobnVsbCk7XG59KTtcblxuLypcbiAqXG4gKiBwbGF5YmFjayxcbiAqIGF1ZGlvIGdyYXBoXG4gKlxuICogKi9cblxuZnVuY3Rpb24gcGxheU5vdGUoZnJlcSwgY3J1c2gpIHtcbiAgZnJlcSA9ICgyMjAgKiAxLjA1OTQ2MyAqIDIpO1xuICB2YXIgb3NjICA9IGN0eC5jcmVhdGVPc2NpbGxhdG9yKCk7XG4gIHZhciBnYWluID0gY3R4LmNyZWF0ZUdhaW4oKTtcbiAgZ2Fpbi5nYWluLnZhbHVlID0gMTtcbiAgb3NjLnR5cGUgPSAndHJpYW5nbGUnO1xuICBvc2MuZnJlcXVlbmN5LnZhbHVlID0gZnJlcTtcbiAgb3NjLmNvbm5lY3QoZ2Fpbik7XG4gIGlmIChjcnVzaCkge1xuICAgIGdhaW4uY29ubmVjdChiaXRjcnVzaGVyTm9kZSk7XG4gICAgYml0Y3J1c2hlck5vZGUuY29ubmVjdCh0aW1lRkZUMi5pbnB1dCk7XG4gICAgYml0Y3J1c2hlck5vZGUuY29ubmVjdChmcmVxRkZUMi5pbnB1dCk7XG4gIH0gZWxzZSB7XG4gICAgZ2Fpbi5jb25uZWN0KHRpbWVGRlQyLmlucHV0KTtcbiAgICBnYWluLmNvbm5lY3QoZnJlcUZGVDIuaW5wdXQpO1xuICB9XG4gIHRpbWVGRlQyLmNvbm5lY3QoY3R4LmRlc3RpbmF0aW9uKTtcbiAgZnJlcUZGVDIuY29ubmVjdChjdHguZGVzdGluYXRpb24pO1xuICBvc2Muc3RhcnQoKTtcblxuICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgIGdhaW4uZGlzY29ubmVjdChjdHguZGVzdGluYXRpb24pO1xuICAgIG9zYy5zdG9wKDApO1xuICAgIG9zYy5kaXNjb25uZWN0KGdhaW4pO1xuICB9LCA0MDAwKTtcbn1cbiIsIi8qKlxuICogcHVsbGVkIGZyb20gQGpzYW50ZWxsXG4gKlxuICogaHR0cHM6Ly9naXRodWIuY29tL2pzYW50ZWxsL2RzcC13aXRoLXdlYi1hdWRpby1wcmVzZW50YXRpb24vYmxvYi9naC1wYWdlcy9leGFtcGxlcy9GRlQuanNcbiAqXG4gKi9cblxudmFyIE1BWF9VSU5UOCA9IDI1NTtcblxubW9kdWxlLmV4cG9ydHMgPSBGRlQ7XG5cbmZ1bmN0aW9uIEZGVCAoY3R4LCBvcHRpb25zKSB7XG4gIHZhciBtb2R1bGUgPSB0aGlzO1xuICB0aGlzLmZpbGxTdHlsZSA9IG9wdGlvbnMuZmlsbFN0eWxlIHx8ICcjMDAwMDAwJztcbiAgdGhpcy5zdHJva2VTdHlsZSA9IG9wdGlvbnMuc3Ryb2tlU3R5bGUgfHwgJyMwMDAwMDAnO1xuICB0aGlzLmNhbnZhcyA9IG9wdGlvbnMuY2FudmFzO1xuICB0aGlzLm9uQmVhdCA9IG9wdGlvbnMub25CZWF0O1xuICB0aGlzLm9mZkJlYXQgPSBvcHRpb25zLm9mZkJlYXQ7XG4gIHRoaXMudHlwZSA9IG9wdGlvbnMudHlwZSB8fCAnZnJlcXVlbmN5JztcbiAgdGhpcy5zcGFjaW5nID0gb3B0aW9ucy5zcGFjaW5nIHx8IDE7XG4gIHRoaXMud2lkdGggPSBvcHRpb25zLndpZHRoIHx8IDE7XG4gIHRoaXMuY291bnQgPSBvcHRpb25zLmNvdW50IHx8IDUxMjtcbiAgdGhpcy5pbnB1dCA9IHRoaXMub3V0cHV0ID0gY3R4LmNyZWF0ZUFuYWx5c2VyKCk7XG4gIHRoaXMucHJvYyA9IGN0eC5jcmVhdGVTY3JpcHRQcm9jZXNzb3IoMjU2LCAxLCAxKTtcbiAgdGhpcy5kYXRhID0gbmV3IFVpbnQ4QXJyYXkodGhpcy5pbnB1dC5mcmVxdWVuY3lCaW5Db3VudCk7XG4gIHRoaXMuY3R4ID0gdGhpcy5jYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcblxuICB0aGlzLmRlY2F5ID0gb3B0aW9ucy5kZWNheSB8fCAwLjAwMjtcbiAgdGhpcy50aHJlc2hvbGQgPSBvcHRpb25zLnRocmVzaG9sZCB8fCAwLjU7XG4gIHRoaXMucmFuZ2UgPSBvcHRpb25zLnJhbmdlIHx8IFswLCB0aGlzLmRhdGEubGVuZ3RoLTFdO1xuICB0aGlzLndhaXQgPSBvcHRpb25zLndhaXQgfHwgNTEyO1xuXG4gIHRoaXMuaCA9IHRoaXMuY2FudmFzLmhlaWdodDtcbiAgdGhpcy53ID0gdGhpcy5jYW52YXMud2lkdGg7XG5cbiAgdGhpcy5pbnB1dC5jb25uZWN0KHRoaXMucHJvYyk7XG4gIHRoaXMucHJvYy5vbmF1ZGlvcHJvY2VzcyA9IHByb2Nlc3MuYmluZChudWxsLCBtb2R1bGUpO1xuICB0aGlzLmN0eC5saW5lV2lkdGggPSBtb2R1bGUud2lkdGg7XG59XG5cbkZGVC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uIChub2RlKSB7XG4gIHRoaXMub3V0cHV0LmNvbm5lY3Qobm9kZSk7XG4gIHRoaXMucHJvYy5jb25uZWN0KG5vZGUpO1xufVxuXG5mdW5jdGlvbiBwcm9jZXNzIChtb2R1bGUpIHtcblxuICB2YXIgY3R4ID0gbW9kdWxlLmN0eDtcbiAgdmFyIGRhdGEgPSBtb2R1bGUuZGF0YTtcbiAgY3R4LmNsZWFyUmVjdCgwLCAwLCBtb2R1bGUudywgbW9kdWxlLmgpO1xuICBjdHguZmlsbFN0eWxlID0gbW9kdWxlLmZpbGxTdHlsZSB8fCAnIzAwMDAwMCc7XG4gIGN0eC5zdHJva2VTdHlsZSA9IG1vZHVsZS5zdHJva2VTdHlsZSB8fCAnIzAwMDAwMCc7XG5cbiAgaWYgKG1vZHVsZS50eXBlID09PSAnZnJlcXVlbmN5Jykge1xuICAgIG1vZHVsZS5pbnB1dC5nZXRCeXRlRnJlcXVlbmN5RGF0YShkYXRhKTtcbiAgICAvLyBBYm9ydCBpZiBubyBkYXRhIGNvbWluZyB0aHJvdWdoLCBxdWljayBoYWNrLCBuZWVkcyBmaXhlZFxuICAgIGlmIChtb2R1bGUuZGF0YVszXSA8IDUpIHJldHVybjtcblxuICAgIGZvciAodmFyIGk9IDAsIGwgPSBkYXRhLmxlbmd0aDsgaSA8IGwgJiYgaSA8IG1vZHVsZS5jb3VudDsgaSsrKSB7XG4gICAgICBjdHguZmlsbFJlY3QoXG4gICAgICAgIGkgKiAobW9kdWxlLnNwYWNpbmcgKyBtb2R1bGUud2lkdGgpLFxuICAgICAgICBtb2R1bGUuaCxcbiAgICAgICAgbW9kdWxlLndpZHRoLFxuICAgICAgICAtKG1vZHVsZS5oIC8gTUFYX1VJTlQ4KSAqIGRhdGFbaV1cbiAgICAgICk7XG4gICAgfVxuICB9IGVsc2UgaWYgKG1vZHVsZS50eXBlID09PSAndGltZScpIHtcbiAgICBtb2R1bGUuaW5wdXQuZ2V0Qnl0ZVRpbWVEb21haW5EYXRhKGRhdGEpO1xuICAgIGN0eC5iZWdpblBhdGgoKTtcbiAgICBjdHgubW92ZVRvKDAsIG1vZHVsZS5oIC8gMik7XG4gICAgZm9yICh2YXIgaT0gMCwgbCA9IGRhdGEubGVuZ3RoOyBpIDwgbCAmJiBpIDwgbW9kdWxlLmNvdW50OyBpKyspIHtcbiAgICAgIGN0eC5saW5lVG8oXG4gICAgICAgIGkgKiAobW9kdWxlLnNwYWNpbmcgKyBtb2R1bGUud2lkdGgpLFxuICAgICAgICAobW9kdWxlLmggLyBNQVhfVUlOVDgpICogZGF0YVtpXVxuICAgICAgKTtcbiAgICB9XG4gICAgY3R4LnN0cm9rZSgpO1xuICAgIGN0eC5jbG9zZVBhdGgoKTtcbiAgfVxufVxuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuXCJ1c2Ugc3RyaWN0XCI7XG5cbi8qKlxuICogIEF1ZGlvUGFyYW1JbXBsXG4gKiAgKy0tLS0tLS0tLS0tLS0tLS0tK1xuICogIHwgR2Fpbk5vZGUoaW5sZXQpIHxcbiAqICB8IGdhaW46IHZhbHVlICAgICB8XG4gKiAgKy0tLS0tLS0tLS0tLS0tLS0tK1xuICogICAgfFxuICogICstLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLStcbiAqICB8IFNjcmlwdFByb2Nlc3Nvck5vZGUob3V0bGV0KSB8XG4gKiAgKy0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tK1xuICovXG5mdW5jdGlvbiBBdWRpb1BhcmFtSW1wbChhdWRpb0NvbnRleHQsIGRlZmF1bHRWYWx1ZSwgYnVmZmVyU2l6ZSkge1xuICB0aGlzLmlubGV0ID0gYXVkaW9Db250ZXh0LmNyZWF0ZUdhaW4oKTtcbiAgdGhpcy5vdXRsZXQgPSBhdWRpb0NvbnRleHQuY3JlYXRlU2NyaXB0UHJvY2Vzc29yKGJ1ZmZlclNpemUsIDEsIDEpO1xuXG4gIHRoaXMucGFyYW0gPSB0aGlzLmlubGV0LmdhaW47XG4gIHRoaXMucGFyYW0udmFsdWUgPSBkZWZhdWx0VmFsdWU7XG4gIHRoaXMuYXJyYXkgPSBuZXcgRmxvYXQzMkFycmF5KGJ1ZmZlclNpemUpO1xuXG4gIHRoaXMuaW5sZXQuY29ubmVjdCh0aGlzLm91dGxldCk7XG5cbiAgdmFyIGFycmF5ID0gdGhpcy5hcnJheTtcbiAgdGhpcy5vdXRsZXQub25hdWRpb3Byb2Nlc3MgPSBmdW5jdGlvbihlKSB7XG4gICAgYXJyYXkuc2V0KGUuaW5wdXRCdWZmZXIuZ2V0Q2hhbm5lbERhdGEoMCkpO1xuICB9O1xufVxuXG5BdWRpb1BhcmFtSW1wbC5wcm90b3R5cGUuY29ubmVjdCA9IGZ1bmN0aW9uKGRlc3RpbmF0aW9uKSB7XG4gIGdsb2JhbC5BdWRpb05vZGUucHJvdG90eXBlLmNvbm5lY3QuY2FsbCh0aGlzLm91dGxldCwgZGVzdGluYXRpb24pO1xufTtcblxuQXVkaW9QYXJhbUltcGwucHJvdG90eXBlLmRpc2Nvbm5lY3QgPSBmdW5jdGlvbigpIHtcbiAgZ2xvYmFsLkF1ZGlvTm9kZS5wcm90b3R5cGUuZGlzY29ubmVjdC5jYWxsKHRoaXMub3V0bGV0KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQXVkaW9QYXJhbUltcGw7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgQXVkaW9QYXJhbUltcGwgPSByZXF1aXJlKFwiLi9hdWRpby1wYXJhbS1pbXBsXCIpO1xuXG5mdW5jdGlvbiBBdWRpb1BhcmFtTm9kZShhdWRpb0NvbnRleHQsIGRlZmF1bHRWYWx1ZSwgYnVmZmVyU2l6ZSkge1xuICB2YXIgaW1wbCA9IG5ldyBBdWRpb1BhcmFtSW1wbChhdWRpb0NvbnRleHQsIGRlZmF1bHRWYWx1ZSwgYnVmZmVyU2l6ZSk7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoaW1wbC5pbmxldCwge1xuICAgIHBhcmFtOiB7XG4gICAgICB2YWx1ZTogaW1wbC5wYXJhbSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9LFxuICAgIGFycmF5OiB7XG4gICAgICB2YWx1ZTogaW1wbC5hcnJheSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9LFxuICAgIGNvbm5lY3Q6IHtcbiAgICAgIHZhbHVlOiBmdW5jdGlvbihkZXN0aW5hdGlvbikge1xuICAgICAgICBpbXBsLmNvbm5lY3QoZGVzdGluYXRpb24pO1xuICAgICAgfVxuICAgIH0sXG4gICAgZGlzY29ubmVjdDoge1xuICAgICAgdmFsdWU6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpbXBsLmRpc2Nvbm5lY3QoKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBpbXBsLmlubGV0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEF1ZGlvUGFyYW1Ob2RlO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBBdWRpb1Byb2Nlc3NCdWlsZGVyID0ge307XG5cbkF1ZGlvUHJvY2Vzc0J1aWxkZXIuYnVpbGQgPSBmdW5jdGlvbihvcHRzKSB7XG4gIHZhciBudW1PZklucHV0ID0gb3B0cy5udW1PZklucHV0O1xuICB2YXIgbnVtT2ZPdXRwdXQgPSBvcHRzLm51bU9mT3V0cHV0O1xuXG4gIGlmIChudW1PZklucHV0ID09PSAxICYmIG51bU9mT3V0cHV0ID09PSAxKSB7XG4gICAgcmV0dXJuIGJ1aWxkX29uYXVkaW9wcm9jZXNzXzEob3B0cyk7XG4gIH1cbiAgaWYgKG51bU9mSW5wdXQgPT09IDIgJiYgbnVtT2ZPdXRwdXQgPT09IDIpIHtcbiAgICByZXR1cm4gYnVpbGRfb25hdWRpb3Byb2Nlc3NfMihvcHRzKTtcbiAgfVxuICByZXR1cm4gYnVpbGRfb25hdWRpb3Byb2Nlc3NfbihvcHRzKTtcbn07XG5cbmZ1bmN0aW9uIGJ1aWxkX29uYXVkaW9wcm9jZXNzXzEob3B0cykge1xuICB2YXIgZnVuYyA9IG9wdHMuZnVuYztcbiAgdmFyIHNjb3BlID0gb3B0cy5zY29wZTtcbiAgdmFyIHBhcmFtZXRlcnMgPSBvcHRzLnBhcmFtZXRlcnM7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKGUpIHtcbiAgICBlLmlucHV0QnVmZmVycyA9IFtcbiAgICAgIGUuaW5wdXRCdWZmZXIuZ2V0Q2hhbm5lbERhdGEoMClcbiAgICBdO1xuICAgIGUub3V0cHV0QnVmZmVycyA9IFtcbiAgICAgIGUub3V0cHV0QnVmZmVyLmdldENoYW5uZWxEYXRhKDApXG4gICAgXTtcbiAgICBlLnBhcmFtZXRlcnMgPSBwYXJhbWV0ZXJzO1xuXG4gICAgZnVuYy5jYWxsKHNjb3BlLCBlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gYnVpbGRfb25hdWRpb3Byb2Nlc3NfMihvcHRzKSB7XG4gIHZhciBmdW5jID0gb3B0cy5mdW5jO1xuICB2YXIgc2NvcGUgPSBvcHRzLnNjb3BlO1xuICB2YXIgcGFyYW1ldGVycyA9IG9wdHMucGFyYW1ldGVycztcblxuICByZXR1cm4gZnVuY3Rpb24oZSkge1xuICAgIHZhciBpbnAgPSBlLmlucHV0QnVmZmVyO1xuICAgIHZhciBvdXQgPSBlLm91dHB1dEJ1ZmZlcjtcbiAgICBlLmlucHV0QnVmZmVycyA9IFtcbiAgICAgIGlucC5nZXRDaGFubmVsRGF0YSgwKSxcbiAgICAgIGlucC5nZXRDaGFubmVsRGF0YSgxKVxuICAgIF07XG4gICAgZS5vdXRwdXRCdWZmZXJzID0gW1xuICAgICAgb3V0LmdldENoYW5uZWxEYXRhKDApLFxuICAgICAgb3V0LmdldENoYW5uZWxEYXRhKDEpXG4gICAgXTtcbiAgICBlLnBhcmFtZXRlcnMgPSBwYXJhbWV0ZXJzO1xuXG4gICAgZnVuYy5jYWxsKHNjb3BlLCBlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gYnVpbGRfb25hdWRpb3Byb2Nlc3NfbihvcHRzKSB7XG4gIHZhciBmdW5jID0gb3B0cy5mdW5jO1xuICB2YXIgc2NvcGUgPSBvcHRzLnNjb3BlO1xuICB2YXIgbnVtT2ZJbnB1dCA9IG9wdHMubnVtT2ZJbnB1dDtcbiAgdmFyIG51bU9mT3V0cHV0ID0gb3B0cy5udW1PZk91dHB1dDtcbiAgdmFyIHBhcmFtZXRlcnMgPSBvcHRzLnBhcmFtZXRlcnM7XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKGUpIHtcbiAgICB2YXIgaW5wdXRCdWZmZXJzID0gbmV3IEFycmF5KG51bU9mSW5wdXQpO1xuICAgIHZhciBvdXRwdXRCdWZmZXJzID0gbmV3IEFycmF5KG51bU9mT3V0cHV0KTtcbiAgICB2YXIgaTtcblxuICAgIGZvciAoaSA9IDA7IGkgPCBudW1PZklucHV0OyBpKyspIHtcbiAgICAgIGlucHV0QnVmZmVyc1tpXSA9IGUuaW5wdXRCdWZmZXIuZ2V0Q2hhbm5lbERhdGEoaSk7XG4gICAgfVxuICAgIGZvciAoaSA9IDA7IGkgPCBudW1PZk91dHB1dDsgaSsrKSB7XG4gICAgICBvdXRwdXRCdWZmZXJzW2ldID0gZS5vdXRwdXRCdWZmZXIuZ2V0Q2hhbm5lbERhdGEoaSk7XG4gICAgfVxuXG4gICAgZS5pbnB1dEJ1ZmZlcnMgPSBpbnB1dEJ1ZmZlcnM7XG4gICAgZS5vdXRwdXRCdWZmZXJzID0gb3V0cHV0QnVmZmVycztcbiAgICBlLnBhcmFtZXRlcnMgPSBwYXJhbWV0ZXJzO1xuXG4gICAgZnVuYy5jYWxsKHNjb3BlLCBlKTtcbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBBdWRpb1Byb2Nlc3NCdWlsZGVyO1xuIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBXT1JLRVJfQVRUUlMgPSBbXG4gIFwib25hdWRpb3Byb2Nlc3NcIixcbiAgXCJzYW1wbGVSYXRlXCIsXG4gIFwic2VsZlwiLFxuICBcIm9ubWVzc2FnZVwiLFxuICBcInBvc3RNZXNzYWdlXCIsXG4gIFwiY2xvc2VcIixcbiAgXCJpbXBvcnRTY3JpcHRzXCIsXG5dO1xuXG52YXIgQXVkaW9Xb3JrZXJDb2RlID0ge307XG5cbkF1ZGlvV29ya2VyQ29kZS50b2tlbnMgPSBmdW5jdGlvbihzcmMpIHtcbiAgdmFyIHBvcyA9IDA7XG4gIHZhciB0b2tlbnMgPSBbXTtcblxuICBmdW5jdGlvbiBlYXQocmUpIHtcbiAgICB3aGlsZSAocG9zIDwgc3JjLmxlbmd0aCkge1xuICAgICAgdmFyIGNoID0gc3JjLmNoYXJBdChwb3MpO1xuICAgICAgaWYgKCFyZS50ZXN0KGNoKSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHBvcyArPSAxO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGVhdFN0cmluZyhxdW90ZSkge1xuICAgIHdoaWxlIChwb3MgPCBzcmMubGVuZ3RoKSB7XG4gICAgICB2YXIgY2ggPSBzcmMuY2hhckF0KHBvcysrKTtcbiAgICAgIGlmIChjaCA9PT0gcXVvdGUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaWYgKGNoID09PSBcIlxcXFxcIikge1xuICAgICAgICBwb3MgKz0gMTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gaXN0YW5idWwgaWdub3JlIG5leHRcbiAgICB0aHJvdyBuZXcgU3ludGF4RXJyb3IoXCJVbmV4cGVjdGVkIHRva2VuIElMTEVHQUxcIik7XG4gIH1cblxuICBmdW5jdGlvbiBlYXRNdWx0aUxpbmVDb21tZW50KCkge1xuICAgIHBvcyArPSAxO1xuICAgIHdoaWxlIChwb3MgPCBzcmMubGVuZ3RoKSB7XG4gICAgICB2YXIgY2ggPSBzcmMuY2hhckF0KHBvcysrKTtcbiAgICAgIGlmIChjaCA9PT0gXCIqXCIgJiYgc3JjLmNoYXJBdChwb3MpID09PSBcIi9cIikge1xuICAgICAgICBwb3MgKz0gMTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBpc3RhbmJ1bCBpZ25vcmUgbmV4dFxuICAgIHRocm93IG5ldyBTeW50YXhFcnJvcihcIlVuZXhwZWN0ZWQgdG9rZW4gSUxMRUdBTFwiKTtcbiAgfVxuXG4gIHdoaWxlIChwb3MgPCBzcmMubGVuZ3RoKSB7XG4gICAgdmFyIGJlZ2luID0gcG9zO1xuICAgIHZhciBjaCA9IHNyYy5jaGFyQXQocG9zKyspO1xuXG4gICAgaWYgKC9cXHMvLnRlc3QoY2gpKSB7XG4gICAgICBlYXQoL1xccy8pO1xuICAgIH0gZWxzZSBpZiAoL1thLXpBLVpfJF0vLnRlc3QoY2gpKSB7XG4gICAgICBlYXQoL1tcXHckXS8pO1xuICAgIH0gZWxzZSBpZiAoL1xcZC8udGVzdChjaCkpIHtcbiAgICAgIGVhdCgvWy5cXGRdLyk7XG4gICAgfSBlbHNlIGlmICgvWydcIl0vLnRlc3QoY2gpKSB7XG4gICAgICBlYXRTdHJpbmcoY2gpO1xuICAgIH0gZWxzZSBpZiAoY2ggPT09IFwiL1wiKSB7XG4gICAgICBjaCA9IHNyYy5jaGFyQXQocG9zKTtcbiAgICAgIGlmIChjaCA9PT0gXCIvXCIpIHtcbiAgICAgICAgZWF0KC9bXlxcbl0vKTtcbiAgICAgIH0gZWxzZSBpZiAoY2ggPT09IFwiKlwiKSB7XG4gICAgICAgIGVhdE11bHRpTGluZUNvbW1lbnQoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0b2tlbnMucHVzaChzcmMuc2xpY2UoYmVnaW4sIHBvcykpO1xuICB9XG5cbiAgcmV0dXJuIHRva2Vucztcbn07XG5cbkF1ZGlvV29ya2VyQ29kZS5maWx0ZXIgPSBmdW5jdGlvbihzcmMpIHtcbiAgdmFyIHRva2VucyA9IEF1ZGlvV29ya2VyQ29kZS50b2tlbnMoc3JjKTtcblxuICBmdW5jdGlvbiBwcmV2VG9rZW4oaW5kZXgpIHtcbiAgICB3aGlsZSAoaW5kZXgtLSkge1xuICAgICAgaWYgKC9bXFxTL10vLnRlc3QodG9rZW5zW2luZGV4XS5jaGFyQXQoMCkpKSB7XG4gICAgICAgIHJldHVybiB0b2tlbnNbaW5kZXhdO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gXCJcIjtcbiAgfVxuXG4gIFdPUktFUl9BVFRSUy5mb3JFYWNoKGZ1bmN0aW9uKGF0dHIpIHtcbiAgICB2YXIgcG9zID0gMDtcbiAgICB2YXIgaW5kZXg7XG5cbiAgICB3aGlsZSAoKGluZGV4ID0gdG9rZW5zLmluZGV4T2YoYXR0ciwgcG9zKSkgIT09IC0xKSB7XG4gICAgICBpZiAocHJldlRva2VuKGluZGV4KSAhPT0gXCIuXCIpIHtcbiAgICAgICAgdG9rZW5zW2luZGV4XSA9IFwiX19zZWxmLlwiICsgdG9rZW5zW2luZGV4XTtcbiAgICAgIH1cbiAgICAgIHBvcyA9IGluZGV4ICsgMTtcbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiB0b2tlbnMuam9pbihcIlwiKTtcbn07XG5cbkF1ZGlvV29ya2VyQ29kZS5jb21waWxlID0gZnVuY3Rpb24oc3JjKSB7XG4gIHZhciBjb2RlID0gW1xuICAgIFwiKGZ1bmN0aW9uKF9fc2VsZikgeyAndXNlIHN0cmljdCc7XCIsXG4gICAgQXVkaW9Xb3JrZXJDb2RlLmZpbHRlcihzcmMpLFxuICAgIFwifSlcIlxuICBdLmpvaW4oXCJcXG5cIik7XG4gIHJldHVybiBldmFsLmNhbGwobnVsbCwgY29kZSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEF1ZGlvV29ya2VyQ29kZTtcbiIsIlwidXNlIHN0cmljdFwiO1xuXG5mdW5jdGlvbiBBdWRpb1dvcmtlckdsb2JhbFNjb3BlKG5vZGUpIHtcbiAgdmFyIG9uYXVkaW9wcm9jZXNzID0gbnVsbDtcblxuICBPYmplY3QuZGVmaW5lUHJvcGVydGllcyh0aGlzLCB7XG4gICAgc2VsZjoge1xuICAgICAgdmFsdWU6IHRoaXMsXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBzYW1wbGVSYXRlOiB7XG4gICAgICB2YWx1ZTogbm9kZS5zYW1wbGVSYXRlLFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgb25hdWRpb3Byb2Nlc3M6IHtcbiAgICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgdmFsdWUgPSBudWxsO1xuICAgICAgICB9XG4gICAgICAgIG5vZGUub25hdWRpb3Byb2Nlc3ModmFsdWUpO1xuICAgICAgICBvbmF1ZGlvcHJvY2VzcyA9IHZhbHVlO1xuICAgICAgfSxcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBvbmF1ZGlvcHJvY2VzcztcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBvbm1lc3NhZ2U6IHtcbiAgICAgIHNldDogZnVuY3Rpb24odmFsdWUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgdmFsdWUgPSB2YWx1ZS5iaW5kKHRoaXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZhbHVlID0gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICBub2RlLnBvcnQyLm9ubWVzc2FnZSA9IHZhbHVlO1xuICAgICAgfSxcbiAgICAgIGdldDogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiBub2RlLnBvcnQyLm9ubWVzc2FnZTtcbiAgICAgIH0sXG4gICAgICBlbnVtZXJhYmxlOiB0cnVlXG4gICAgfSxcbiAgICBwb3N0TWVzc2FnZToge1xuICAgICAgdmFsdWU6IGZ1bmN0aW9uKCkge1xuICAgICAgICBub2RlLnBvcnQyLnBvc3RNZXNzYWdlLmFwcGx5KG5vZGUucG9ydDIsIGFyZ3VtZW50cyk7XG4gICAgICB9XG4gICAgfSxcbiAgICBjbG9zZToge1xuICAgICAgdmFsdWU6IGZ1bmN0aW9uKCkge1xuICAgICAgICBub2RlLmNsb3NlLmFwcGx5KG5vZGUsIGFyZ3VtZW50cyk7XG4gICAgICB9XG4gICAgfSxcbiAgICBpbXBvcnRTY3JpcHRzOiB7XG4gICAgICB2YWx1ZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIG5vZGUuaW1wb3J0U2NyaXB0cy5hcHBseShub2RlLCBhcmd1bWVudHMpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gQXVkaW9Xb3JrZXJHbG9iYWxTY29wZTtcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcblwidXNlIHN0cmljdFwiO1xuXG52YXIgQXVkaW9QYXJhbU5vZGUgPSByZXF1aXJlKFwiLi9hdWRpby1wYXJhbS1ub2RlXCIpO1xudmFyIEF1ZGlvV29ya2VyR2xvYmFsU2NvcGUgPSByZXF1aXJlKFwiLi9hdWRpby13b3JrZXItZ2xvYmFsLXNjb3BlXCIpO1xudmFyIEF1ZGlvUHJvY2Vzc0J1aWxkZXIgPSByZXF1aXJlKFwiLi9hdWRpby1wcm9jZXNzLWJ1aWxkZXJcIik7XG52YXIgU2NyaXB0TG9hZGVyID0gcmVxdWlyZShcIi4vc2NyaXB0LWxvYWRlclwiKTtcbnZhciBBdWRpb1dvcmtlckNvZGUgPSByZXF1aXJlKFwiLi9hdWRpby13b3JrZXItY29kZVwiKTtcbnZhciBNZXNzYWdlQ2hhbm5lbCA9IHJlcXVpcmUoXCIuL21lc3NhZ2UtY2hhbm5lbFwiKTtcblxudmFyIEJVRkZFUl9TSVpFID0gMTAyNDtcblxuZnVuY3Rpb24gQXVkaW9Xb3JrZXJOb2RlSW1wbChhdWRpb0NvbnRleHQsIHNjcmlwdFVSTCwgbnVtT2ZJbnB1dCwgbnVtT2ZPdXRwdXQpIHtcbiAgdmFyIGNoID0gbmV3IE1lc3NhZ2VDaGFubmVsKCk7XG5cbiAgdGhpcy5hdWRpb0NvbnRleHQgPSBhdWRpb0NvbnRleHQ7XG4gIHRoaXMuc2FtcGxlUmF0ZSA9IGF1ZGlvQ29udGV4dC5zYW1wbGVSYXRlO1xuICB0aGlzLmlubGV0ID0gYXVkaW9Db250ZXh0LmNyZWF0ZVNjcmlwdFByb2Nlc3NvcihCVUZGRVJfU0laRSwgbnVtT2ZJbnB1dCwgbnVtT2ZPdXRwdXQpO1xuICB0aGlzLm91dGxldCA9IHRoaXMuaW5sZXQ7XG4gIHRoaXMucG9ydDEgPSBjaC5wb3J0MTtcbiAgdGhpcy5wb3J0MiA9IGNoLnBvcnQyO1xuICB0aGlzLnNjb3BlID0gbmV3IEF1ZGlvV29ya2VyR2xvYmFsU2NvcGUodGhpcyk7XG5cbiAgdGhpcy5fbnVtT2ZJbnB1dCA9IG51bU9mSW5wdXQ7XG4gIHRoaXMuX251bU9mT3V0cHV0ID0gbnVtT2ZPdXRwdXQ7XG4gIHRoaXMuX2lzQ29ubmVjdGVkID0gZmFsc2U7XG4gIHRoaXMuX2lzVGVybWluYXRlZCA9IGZhbHNlO1xuICB0aGlzLl9zaWxlbmNlciA9IG51bGw7XG4gIHRoaXMuX2RjMWJ1ZmZlciA9IG51bGw7XG4gIHRoaXMuX2RjMSA9IG51bGw7XG4gIHRoaXMuX3BhcmFtcyA9IHt9O1xuICB0aGlzLl9wYXJhbWV0ZXJzID0ge307XG5cbiAgdmFyIHNjb3BlID0gdGhpcy5zY29wZTtcbiAgU2NyaXB0TG9hZGVyLmxvYWQoc2NyaXB0VVJMLCBmdW5jdGlvbihzY3JpcHQpIHtcbiAgICB0cnkge1xuICAgICAgQXVkaW9Xb3JrZXJDb2RlLmNvbXBpbGUoc2NyaXB0KS5jYWxsKHNjb3BlLCBzY29wZSk7XG4gICAgfSBjYXRjaCAoZSkge31cbiAgfSk7XG59XG5cbkF1ZGlvV29ya2VyTm9kZUltcGwucHJvdG90eXBlLmNvbm5lY3QgPSBmdW5jdGlvbihkZXN0aW5hdGlvbikge1xuICB2YXIgYXVkaW9Db250ZXh0ID0gdGhpcy5hdWRpb0NvbnRleHQ7XG5cbiAgaWYgKCF0aGlzLl9pc0Nvbm5lY3RlZCkge1xuICAgIHRoaXMuX2RjMWJ1ZmZlciA9IGF1ZGlvQ29udGV4dC5jcmVhdGVCdWZmZXIoMSwgMiwgYXVkaW9Db250ZXh0LnNhbXBsZVJhdGUpO1xuICAgIHRoaXMuX2RjMWJ1ZmZlci5nZXRDaGFubmVsRGF0YSgwKS5zZXQoWyAxLCAxIF0pO1xuXG4gICAgdGhpcy5fZGMxID0gYXVkaW9Db250ZXh0LmNyZWF0ZUJ1ZmZlclNvdXJjZSgpO1xuICAgIHRoaXMuX2RjMS5idWZmZXIgPSB0aGlzLl9kYzFidWZmZXI7XG4gICAgdGhpcy5fZGMxLmxvb3AgPSB0cnVlO1xuICAgIHRoaXMuX2RjMS5zdGFydChhdWRpb0NvbnRleHQuY3VycmVudFRpbWUpO1xuXG4gICAgT2JqZWN0LmtleXModGhpcy5fcGFyYW1zKS5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIHRoaXMuX2RjMS5jb25uZWN0KHRoaXMuX3BhcmFtc1tuYW1lXSk7XG4gICAgfSwgdGhpcyk7XG5cbiAgICB0aGlzLl9pc0Nvbm5lY3RlZCA9IHRydWU7XG4gIH1cblxuICBnbG9iYWwuQXVkaW9Ob2RlLnByb3RvdHlwZS5jb25uZWN0LmNhbGwodGhpcy5pbmxldCwgZGVzdGluYXRpb24pO1xufTtcblxuQXVkaW9Xb3JrZXJOb2RlSW1wbC5wcm90b3R5cGUuZGlzY29ubmVjdCA9IGZ1bmN0aW9uKCkge1xuICB2YXIgYXVkaW9Db250ZXh0ID0gdGhpcy5hdWRpb0NvbnRleHQ7XG5cbiAgaWYgKHRoaXMuX2lzQ29ubmVjdGVkKSB7XG4gICAgdGhpcy5fZGMxLnN0b3AoYXVkaW9Db250ZXh0LmN1cnJlbnRUaW1lKTtcbiAgICB0aGlzLl9kYzEuZGlzY29ubmVjdCgpO1xuXG4gICAgdGhpcy5fZGMxYnVmZmVyID0gbnVsbDtcbiAgICB0aGlzLl9kYzEgPSBudWxsO1xuICAgIHRoaXMuX2lzQ29ubmVjdGVkID0gZmFsc2U7XG4gIH1cblxuICBnbG9iYWwuQXVkaW9Ob2RlLnByb3RvdHlwZS5kaXNjb25uZWN0LmNhbGwodGhpcy5vdXRsZXQpO1xufTtcblxuQXVkaW9Xb3JrZXJOb2RlSW1wbC5wcm90b3R5cGUudGVybWluYXRlID0gZnVuY3Rpb24oKSB7XG4gIGlmICghdGhpcy5faXNUZXJtaW5hdGVkKSB7XG4gICAgdGhpcy5pbmxldC5vbmF1ZGlvcHJvY2VzcyA9IG51bGw7XG4gICAgdGhpcy5wb3J0MS5jbG9zZSgpO1xuICAgIHRoaXMucG9ydDIuY2xvc2UoKTtcbiAgICB0aGlzLl9pc1Rlcm1pbmF0ZWQgPSB0cnVlO1xuICB9XG59O1xuXG5BdWRpb1dvcmtlck5vZGVJbXBsLnByb3RvdHlwZS5hZGRQYXJhbWV0ZXIgPSBmdW5jdGlvbihuYW1lLCBkZWZhdWx0VmFsdWUpIHtcbiAgdmFyIGF1ZGlvQ29udGV4dCA9IHRoaXMuYXVkaW9Db250ZXh0O1xuXG4gIGlmICh0aGlzLl9wYXJhbXMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICByZXR1cm4gdGhpcy5fcGFyYW1zW25hbWVdLnBhcmFtO1xuICB9XG5cbiAgaWYgKHRoaXMuX3NpbGVuY2VyID09PSBudWxsKSB7XG4gICAgdGhpcy5fc2lsZW5jZXIgPSBhdWRpb0NvbnRleHQuY3JlYXRlR2FpbigpO1xuICAgIHRoaXMuX3NpbGVuY2VyLmdhaW4udmFsdWUgPSAwO1xuICAgIHRoaXMuX3NpbGVuY2VyLmNvbm5lY3QodGhpcy5vdXRsZXQpO1xuICB9XG5cbiAgdmFyIHBhcmFtTm9kZSA9IG5ldyBBdWRpb1BhcmFtTm9kZShhdWRpb0NvbnRleHQsIGRlZmF1bHRWYWx1ZSwgQlVGRkVSX1NJWkUpO1xuXG4gIHBhcmFtTm9kZS5jb25uZWN0KHRoaXMuX3NpbGVuY2VyKTtcblxuICBpZiAodGhpcy5faXNDb25uZWN0ZWQpIHtcbiAgICB0aGlzLl9kYzEuY29ubmVjdChwYXJhbU5vZGUpO1xuICB9XG5cbiAgdGhpcy5fcGFyYW1zW25hbWVdID0gcGFyYW1Ob2RlO1xuICB0aGlzLl9wYXJhbWV0ZXJzW25hbWVdID0gcGFyYW1Ob2RlLmFycmF5O1xuXG4gIHJldHVybiBwYXJhbU5vZGUucGFyYW07XG59O1xuXG5BdWRpb1dvcmtlck5vZGVJbXBsLnByb3RvdHlwZS5nZXRQYXJhbWV0ZXIgPSBmdW5jdGlvbihuYW1lKSB7XG4gIHJldHVybiB0aGlzLl9wYXJhbXNbbmFtZV0gJiYgdGhpcy5fcGFyYW1zW25hbWVdLnBhcmFtO1xufTtcblxuQXVkaW9Xb3JrZXJOb2RlSW1wbC5wcm90b3R5cGUucmVtb3ZlUGFyYW1ldGVyID0gZnVuY3Rpb24obmFtZSkge1xuICBpZiAoIXRoaXMuX3BhcmFtcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHRoaXMuX3BhcmFtc1tuYW1lXS5kaXNjb25uZWN0KCk7XG5cbiAgZGVsZXRlIHRoaXMuX3BhcmFtc1tuYW1lXTtcbiAgZGVsZXRlIHRoaXMuX3BhcmFtZXRlcnNbbmFtZV07XG5cbiAgaWYgKE9iamVjdC5rZXlzKHRoaXMuX3BhcmFtcykubGVuZ3RoID09PSAwKSB7XG4gICAgdGhpcy5fc2lsZW5jZXIuZGlzY29ubmVjdCgpO1xuICAgIHRoaXMuX3NpbGVuY2VyID0gbnVsbDtcbiAgfVxufTtcblxuQXVkaW9Xb3JrZXJOb2RlSW1wbC5wcm90b3R5cGUub25hdWRpb3Byb2Nlc3MgPSBmdW5jdGlvbihmdW5jKSB7XG4gIGlmICh0aGlzLl9pc1Rlcm1pbmF0ZWQgfHwgdHlwZW9mIGZ1bmMgIT09IFwiZnVuY3Rpb25cIikge1xuICAgIHRoaXMuaW5sZXQub25hdWRpb3Byb2Nlc3MgPSBudWxsO1xuICB9IGVsc2Uge1xuICAgIHRoaXMuaW5sZXQub25hdWRpb3Byb2Nlc3MgPSBBdWRpb1Byb2Nlc3NCdWlsZGVyLmJ1aWxkKHtcbiAgICAgIGZ1bmM6IGZ1bmMsXG4gICAgICBzY29wZTogdGhpcy5zY29wZSxcbiAgICAgIG51bU9mSW5wdXQ6IHRoaXMuX251bU9mSW5wdXQsXG4gICAgICBudW1PZk91dHB1dDogdGhpcy5fbnVtT2ZPdXRwdXQsXG4gICAgICBwYXJhbWV0ZXJzOiB0aGlzLl9wYXJhbWV0ZXJzLFxuICAgIH0pO1xuICB9XG59O1xuXG5BdWRpb1dvcmtlck5vZGVJbXBsLnByb3RvdHlwZS5jbG9zZSA9IGZ1bmN0aW9uKCkge1xuICB0aGlzLnRlcm1pbmF0ZSgpO1xufTtcblxuQXVkaW9Xb3JrZXJOb2RlSW1wbC5wcm90b3R5cGUuaW1wb3J0U2NyaXB0cyA9IGZ1bmN0aW9uKCkge1xuICB0aHJvdyBuZXcgRXJyb3IoXCJOb3QgU3VwcG9ydGVkOiBpbXBvcnRTY3JpcHRzXCIpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBBdWRpb1dvcmtlck5vZGVJbXBsO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSkiLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIHV0aWxzID0gcmVxdWlyZShcIi4vdXRpbHNcIik7XG52YXIgQXVkaW9Xb3JrZXJJbXBsID0gcmVxdWlyZShcIi4vYXVkaW8td29ya2VyLWltcGxcIik7XG5cbmZ1bmN0aW9uIEF1ZGlvV29ya2VyTm9kZShhdWRpb0NvbnRleHQsIHNjcmlwdFVSTCwgbnVtYmVyT2ZJbnB1dENoYW5uZWxzLCBudW1iZXJPZk91dHB1dENoYW5uZWxzKSB7XG4gIG51bWJlck9mSW5wdXRDaGFubmVscyA9IHV0aWxzLmRlZmF1bHRzKG51bWJlck9mSW5wdXRDaGFubmVscywgMik7XG4gIG51bWJlck9mT3V0cHV0Q2hhbm5lbHMgPSB1dGlscy5kZWZhdWx0cyhudW1iZXJPZk91dHB1dENoYW5uZWxzLCAyKTtcblxuICB2YXIgaW1wbCA9IG5ldyBBdWRpb1dvcmtlckltcGwoYXVkaW9Db250ZXh0LCBzY3JpcHRVUkwsIG51bWJlck9mSW5wdXRDaGFubmVscywgbnVtYmVyT2ZPdXRwdXRDaGFubmVscyk7XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoaW1wbC5pbmxldCwge1xuICAgIG9ubWVzc2FnZToge1xuICAgICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICBpZiAodHlwZW9mIHZhbHVlICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICB2YWx1ZSA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgaW1wbC5wb3J0MS5vbm1lc3NhZ2UgPSB2YWx1ZTtcbiAgICAgIH0sXG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gaW1wbC5wb3J0MS5vbm1lc3NhZ2U7XG4gICAgICB9LFxuICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgIH0sXG4gICAgY29ubmVjdDoge1xuICAgICAgdmFsdWU6IGZ1bmN0aW9uKGRlc3RpbmF0aW9uKSB7XG4gICAgICAgIHJldHVybiBpbXBsLmNvbm5lY3QoZGVzdGluYXRpb24pO1xuICAgICAgfVxuICAgIH0sXG4gICAgZGlzY29ubmVjdDoge1xuICAgICAgdmFsdWU6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gaW1wbC5kaXNjb25uZWN0KCk7XG4gICAgICB9XG4gICAgfSxcbiAgICBwb3N0TWVzc2FnZToge1xuICAgICAgdmFsdWU6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gaW1wbC5wb3J0MS5wb3N0TWVzc2FnZS5hcHBseShpbXBsLnBvcnQxLCBhcmd1bWVudHMpO1xuICAgICAgfVxuICAgIH0sXG4gICAgYWRkUGFyYW1ldGVyOiB7XG4gICAgICB2YWx1ZTogZnVuY3Rpb24obmFtZSwgZGVmYXVsdFZhbHVlKSB7XG4gICAgICAgIGRlZmF1bHRWYWx1ZSA9IHV0aWxzLmRlZmF1bHRzKGRlZmF1bHRWYWx1ZSwgMCk7XG4gICAgICAgIGlmICghT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihpbXBsLmlubGV0LCBuYW1lKSkge1xuICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShpbXBsLmlubGV0LCBuYW1lLCB7XG4gICAgICAgICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICByZXR1cm4gaW1wbC5nZXRQYXJhbWV0ZXIobmFtZSk7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgICAgICAgICAgZW51bWVyYWJsZTogdHJ1ZVxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBpbXBsLmFkZFBhcmFtZXRlcihuYW1lLCBkZWZhdWx0VmFsdWUpO1xuICAgICAgfVxuICAgIH0sXG4gICAgcmVtb3ZlUGFyYW1ldGVyOiB7XG4gICAgICB2YWx1ZTogZnVuY3Rpb24obmFtZSkge1xuICAgICAgICBpZiAoT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihpbXBsLmlubGV0LCBuYW1lKSkge1xuICAgICAgICAgIGRlbGV0ZSBpbXBsLmlubGV0W25hbWVdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBpbXBsLnJlbW92ZVBhcmFtZXRlcihuYW1lKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIHRlcm1pbmF0ZToge1xuICAgICAgdmFsdWU6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gaW1wbC50ZXJtaW5hdGUoKTtcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiBpbXBsLmlubGV0O1xufVxubW9kdWxlLmV4cG9ydHMgPSBBdWRpb1dvcmtlck5vZGU7XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG5cInVzZSBzdHJpY3RcIjtcblxuZnVuY3Rpb24gTWVzc2FnZUNoYW5uZWxTaGltKCkge1xuICB0aGlzLnBvcnQxID0gbmV3IE1lc3NhZ2VQb3J0KCk7XG4gIHRoaXMucG9ydDIgPSBuZXcgTWVzc2FnZVBvcnQoKTtcbiAgdGhpcy5wb3J0MS5fdGFyZ2V0ID0gdGhpcy5wb3J0MjtcbiAgdGhpcy5wb3J0Mi5fdGFyZ2V0ID0gdGhpcy5wb3J0MTtcbn1cblxuZnVuY3Rpb24gTWVzc2FnZVBvcnQoKSB7XG4gIHRoaXMuX29ubWVzc2FnZSA9IG51bGw7XG4gIHRoaXMuX3RhcmdldCA9IG51bGw7XG4gIHRoaXMuX2lzQ2xvc2VkID0gZmFsc2U7XG4gIHRoaXMuX3BlbmRpbmdzID0gW107XG5cbiAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXModGhpcywge1xuICAgIG9ubWVzc2FnZToge1xuICAgICAgc2V0OiBmdW5jdGlvbih2YWx1ZSkge1xuICAgICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuICAgICAgICB0aGlzLl9vbm1lc3NhZ2UgPSB2YWx1ZTtcbiAgICAgICAgaWYgKHRoaXMuX3BlbmRpbmdzLmxlbmd0aCkge1xuICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICBfdGhpcy5fcGVuZGluZ3Muc3BsaWNlKDApLmZvckVhY2goZnVuY3Rpb24oZSkge1xuICAgICAgICAgICAgICBfdGhpcy5fb25tZXNzYWdlKGUpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSwgMCk7XG4gICAgICAgIH1cbiAgICAgIH0sXG4gICAgICBnZXQ6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5fb25tZXNzYWdlO1xuICAgICAgfSxcbiAgICAgIGVudW1lcmFibGU6IHRydWVcbiAgICB9XG4gIH0pO1xufVxuXG5NZXNzYWdlUG9ydC5wcm90b3R5cGUucG9zdE1lc3NhZ2UgPSBmdW5jdGlvbihtZXNzYWdlKSB7XG4gIHZhciB0YXJnZXQgPSB0aGlzLl90YXJnZXQ7XG4gIGlmICghdGhpcy5faXNDbG9zZWQpIHtcbiAgICB2YXIgZSA9IHtcbiAgICAgIHR5cGU6IFwibWVzc2FnZVwiLFxuICAgICAgZGF0YTogbWVzc2FnZVxuICAgIH07XG4gICAgaWYgKHR5cGVvZiB0YXJnZXQuX29ubWVzc2FnZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICB0YXJnZXQuX29ubWVzc2FnZShlKTtcbiAgICAgIH0sIDApO1xuICAgIH0gZWxzZSB7XG4gICAgICB0YXJnZXQuX3BlbmRpbmdzLnB1c2goZSk7XG4gICAgfVxuICB9XG59O1xuXG5NZXNzYWdlUG9ydC5wcm90b3R5cGUuY2xvc2UgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5faXNDbG9zZWQgPSB0cnVlO1xuICB0aGlzLl9wZW5kaW5ncy5zcGxpY2UoMCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGdsb2JhbC5NZXNzYWdlQ2hhbm5lbCB8fCBNZXNzYWdlQ2hhbm5lbFNoaW07XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KSIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcblwidXNlIHN0cmljdFwiO1xuXG52YXIgU2NyaXB0TG9hZGVyID0ge307XG5cblNjcmlwdExvYWRlci5sb2FkID0gZnVuY3Rpb24oc2NyaXB0VVJMLCBjYWxsYmFjaykge1xuICB2YXIgeGhyID0gbmV3IGdsb2JhbC5YTUxIdHRwUmVxdWVzdCgpO1xuICB4aHIub3BlbihcIkdFVFwiLCBzY3JpcHRVUkwpO1xuICB4aHIub25sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgaWYgKHhoci5zdGF0dXMgPT09IDIwMCkge1xuICAgICAgY2FsbGJhY2soeGhyLnJlc3BvbnNlKTtcbiAgICB9XG4gIH07XG4gIHhoci5zZW5kKCk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNjcmlwdExvYWRlcjtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbmZ1bmN0aW9uIGRlZmF1bHRzKHZhbHVlLCBkZWZhdWx0VmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlICE9PSB1bmRlZmluZWQgPyB2YWx1ZSA6IGRlZmF1bHRWYWx1ZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGRlZmF1bHRzOiBkZWZhdWx0c1xufTtcbiIsIm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9saWIvaW5kZXguanMnKTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIF9pbnRlcm9wUmVxdWlyZVdpbGRjYXJkID0gZnVuY3Rpb24gKG9iaikgeyByZXR1cm4gb2JqICYmIG9iai5fX2VzTW9kdWxlID8gb2JqIDogeyAnZGVmYXVsdCc6IG9iaiB9OyB9O1xuXG52YXIgX2NsYXNzQ2FsbENoZWNrID0gZnVuY3Rpb24gKGluc3RhbmNlLCBDb25zdHJ1Y3RvcikgeyBpZiAoIShpbnN0YW5jZSBpbnN0YW5jZW9mIENvbnN0cnVjdG9yKSkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdDYW5ub3QgY2FsbCBhIGNsYXNzIGFzIGEgZnVuY3Rpb24nKTsgfSB9O1xuXG52YXIgX2NyZWF0ZUNsYXNzID0gKGZ1bmN0aW9uICgpIHsgZnVuY3Rpb24gZGVmaW5lUHJvcGVydGllcyh0YXJnZXQsIHByb3BzKSB7IGZvciAodmFyIGkgPSAwOyBpIDwgcHJvcHMubGVuZ3RoOyBpKyspIHsgdmFyIGRlc2NyaXB0b3IgPSBwcm9wc1tpXTsgZGVzY3JpcHRvci5lbnVtZXJhYmxlID0gZGVzY3JpcHRvci5lbnVtZXJhYmxlIHx8IGZhbHNlOyBkZXNjcmlwdG9yLmNvbmZpZ3VyYWJsZSA9IHRydWU7IGlmICgndmFsdWUnIGluIGRlc2NyaXB0b3IpIGRlc2NyaXB0b3Iud3JpdGFibGUgPSB0cnVlOyBPYmplY3QuZGVmaW5lUHJvcGVydHkodGFyZ2V0LCBkZXNjcmlwdG9yLmtleSwgZGVzY3JpcHRvcik7IH0gfSByZXR1cm4gZnVuY3Rpb24gKENvbnN0cnVjdG9yLCBwcm90b1Byb3BzLCBzdGF0aWNQcm9wcykgeyBpZiAocHJvdG9Qcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvci5wcm90b3R5cGUsIHByb3RvUHJvcHMpOyBpZiAoc3RhdGljUHJvcHMpIGRlZmluZVByb3BlcnRpZXMoQ29uc3RydWN0b3IsIHN0YXRpY1Byb3BzKTsgcmV0dXJuIENvbnN0cnVjdG9yOyB9OyB9KSgpO1xuXG52YXIgX2dldCA9IGZ1bmN0aW9uIGdldChvYmplY3QsIHByb3BlcnR5LCByZWNlaXZlcikgeyB2YXIgZGVzYyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3Iob2JqZWN0LCBwcm9wZXJ0eSk7IGlmIChkZXNjID09PSB1bmRlZmluZWQpIHsgdmFyIHBhcmVudCA9IE9iamVjdC5nZXRQcm90b3R5cGVPZihvYmplY3QpOyBpZiAocGFyZW50ID09PSBudWxsKSB7IHJldHVybiB1bmRlZmluZWQ7IH0gZWxzZSB7IHJldHVybiBnZXQocGFyZW50LCBwcm9wZXJ0eSwgcmVjZWl2ZXIpOyB9IH0gZWxzZSBpZiAoJ3ZhbHVlJyBpbiBkZXNjKSB7IHJldHVybiBkZXNjLnZhbHVlOyB9IGVsc2UgeyB2YXIgZ2V0dGVyID0gZGVzYy5nZXQ7IGlmIChnZXR0ZXIgPT09IHVuZGVmaW5lZCkgeyByZXR1cm4gdW5kZWZpbmVkOyB9IHJldHVybiBnZXR0ZXIuY2FsbChyZWNlaXZlcik7IH0gfTtcblxudmFyIF9pbmhlcml0cyA9IGZ1bmN0aW9uIChzdWJDbGFzcywgc3VwZXJDbGFzcykgeyBpZiAodHlwZW9mIHN1cGVyQ2xhc3MgIT09ICdmdW5jdGlvbicgJiYgc3VwZXJDbGFzcyAhPT0gbnVsbCkgeyB0aHJvdyBuZXcgVHlwZUVycm9yKCdTdXBlciBleHByZXNzaW9uIG11c3QgZWl0aGVyIGJlIG51bGwgb3IgYSBmdW5jdGlvbiwgbm90ICcgKyB0eXBlb2Ygc3VwZXJDbGFzcyk7IH0gc3ViQ2xhc3MucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShzdXBlckNsYXNzICYmIHN1cGVyQ2xhc3MucHJvdG90eXBlLCB7IGNvbnN0cnVjdG9yOiB7IHZhbHVlOiBzdWJDbGFzcywgZW51bWVyYWJsZTogZmFsc2UsIHdyaXRhYmxlOiB0cnVlLCBjb25maWd1cmFibGU6IHRydWUgfSB9KTsgaWYgKHN1cGVyQ2xhc3MpIHN1YkNsYXNzLl9fcHJvdG9fXyA9IHN1cGVyQ2xhc3M7IH07XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xuXG52YXIgX0V2ZW50RW1pdHRlcjIgPSByZXF1aXJlKCdldmVudHMnKTtcblxudmFyIF9FdmVudEVtaXR0ZXIzID0gX2ludGVyb3BSZXF1aXJlV2lsZGNhcmQoX0V2ZW50RW1pdHRlcjIpO1xuXG52YXIgX3JhZiA9IHJlcXVpcmUoJ3JhZicpO1xuXG52YXIgX3JhZjIgPSBfaW50ZXJvcFJlcXVpcmVXaWxkY2FyZChfcmFmKTtcblxudmFyIF94aHIgPSByZXF1aXJlKCd4aHInKTtcblxudmFyIF94aHIyID0gX2ludGVyb3BSZXF1aXJlV2lsZGNhcmQoX3hocik7XG5cbnZhciBfZnMgPSByZXF1aXJlKCdmcycpO1xuXG52YXIgX2ZzMiA9IF9pbnRlcm9wUmVxdWlyZVdpbGRjYXJkKF9mcyk7XG5cbnZhciBfcGF0aCA9IHJlcXVpcmUoJ3BhdGgnKTtcblxudmFyIF9wYXRoMiA9IF9pbnRlcm9wUmVxdWlyZVdpbGRjYXJkKF9wYXRoKTtcblxudmFyIEF1ZGlvU291cmNlID0gKGZ1bmN0aW9uIChfRXZlbnRFbWl0dGVyKSB7XG4gIGZ1bmN0aW9uIEF1ZGlvU291cmNlKG9wdHMpIHtcbiAgICBfY2xhc3NDYWxsQ2hlY2sodGhpcywgQXVkaW9Tb3VyY2UpO1xuXG4gICAgaWYgKCFvcHRzLmNvbnRleHQpIHRocm93IG5ldyBFcnJvcignWW91IG11c3QgcGFzcyBhbiBhdWRpbyBjb250ZXh0IHRvIHVzZSB0aGlzIG1vZHVsZScpO1xuICAgIF9nZXQoT2JqZWN0LmdldFByb3RvdHlwZU9mKEF1ZGlvU291cmNlLnByb3RvdHlwZSksICdjb25zdHJ1Y3RvcicsIHRoaXMpLmNhbGwodGhpcyk7XG4gICAgdGhpcy5jb250ZXh0ID0gb3B0cy5jb250ZXh0O1xuICAgIHRoaXMudXJsID0gb3B0cy51cmwgPyBvcHRzLnVybCA6IHVuZGVmaW5lZDtcbiAgICB0aGlzLm5vZGVzID0gb3B0cy5ub2RlcyA/IG9wdHMubm9kZXMgOiBbXTtcbiAgICB0aGlzLmdhaW5Ob2RlID0gb3B0cy5nYWluTm9kZSA/IG9wdHMuZ2Fpbk5vZGUgOiB1bmRlZmluZWQ7XG5cbiAgICBpZiAodGhpcy5ub2Rlcy5sZW5ndGggJiYgIXRoaXMuZ2Fpbk5vZGUpIHRocm93IG5ldyBFcnJvcignTXVzdCBwYXNzIGdhaW5Ob2RlIGluIG9wdGlvbnMgd2l0aCBub2RlIGFycmF5Jyk7XG4gICAgdGhpcy5idWZmZXIgPSB1bmRlZmluZWQ7XG4gICAgdGhpcy5fbXljYiA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnN0YXJ0T2Zmc2V0ID0gMDtcbiAgICB0aGlzLl9pbml0ID0gdHJ1ZTsgLy8gc3dpdGNoIGZvciBpbml0aWFsIHBsYXlcbiAgfVxuXG4gIF9pbmhlcml0cyhBdWRpb1NvdXJjZSwgX0V2ZW50RW1pdHRlcik7XG5cbiAgX2NyZWF0ZUNsYXNzKEF1ZGlvU291cmNlLCBbe1xuICAgIGtleTogJ190b0FycmF5QnVmZmVyJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gX3RvQXJyYXlCdWZmZXIoYnVmZmVyKSB7XG4gICAgICB2YXIgYWIgPSBuZXcgQXJyYXlCdWZmZXIoYnVmZmVyLmxlbmd0aCk7XG4gICAgICB2YXIgdmlldyA9IG5ldyBVaW50OEFycmF5KGFiKTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgYnVmZmVyLmxlbmd0aDsgKytpKSB7XG4gICAgICAgIHZpZXdbaV0gPSBidWZmZXJbaV07XG4gICAgICB9XG4gICAgICByZXR1cm4gYWI7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnbG9hZCcsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGxvYWQodXJsLCBjYiwgaXNGaWxlKSB7XG4gICAgICBpZiAodHlwZW9mIHVybCA9PT0gJ2Z1bmN0aW9uJykgY2IgPSB1cmw7ZWxzZSBpZiAodXJsKSB0aGlzLnVybCA9IHVybDtcblxuICAgICAgaWYgKCF0aGlzLnVybCkgdGhyb3cgbmV3IEVycm9yKCdZb3UgbXVzdCBwYXNzIGEgdXJsIG9yIGhhdmUgaW5zdGFudGlhdGVkIHRoZSBjbGFzcyB3aXRoIHRoZSB1cmwgb3B0aW9uIHRvIGNhbGwgXCJBdWRpb1NvdXJjZS5sb2FkXCInKTtcbiAgICAgIGlmICghdGhpcy5saXN0ZW5lcnMoJ2xvYWQnKS5sZW5ndGggJiYgIWNiKSBjb25zb2xlLndhcm4oJ05vIGNhbGxiYWNrIHBhc3NlZCB0byBMb2FkIG1ldGhvZCwgbm9yIGxpc3RlbmVyIHNldCB1cCBmb3IgXCJsb2FkXCIgZXZlbnQuJyk7XG4gICAgICB0aGlzLl9yZXEoY2IpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3JlYWQnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiByZWFkKGZpbGVwYXRoLCBjYikge1xuICAgICAgaWYgKHR5cGVvZiBmaWxlcGF0aCA9PSAnZnVuY3Rpb24nKSBjYiA9IGZpbGVwYXRoO2Vsc2UgdGhpcy51cmwgPSBmaWxlcGF0aDtcbiAgICAgIGlmIChjYikgdGhpcy5fbXljYiA9IGNiO1xuICAgICAgX2ZzMlsnZGVmYXVsdCddLnJlYWRGaWxlKF9wYXRoMlsnZGVmYXVsdCddLnJlc29sdmUoZmlsZXBhdGgpLCAoZnVuY3Rpb24gKGVyciwgYnVmZmVyKSB7XG4gICAgICAgIGlmIChlcnIpIHRoaXMuX2ZhaWwoZXJyKTtcbiAgICAgICAgdGhpcy5jb250ZXh0LmRlY29kZUF1ZGlvRGF0YSh0aGlzLl90b0FycmF5QnVmZmVyKGJ1ZmZlciksIChmdW5jdGlvbiAoYnVmZmVyKSB7XG4gICAgICAgICAgdGhpcy5idWZmZXIgPSBidWZmZXI7XG4gICAgICAgICAgdGhpcy5lbWl0KCdsb2FkJywgdGhpcy50aW1lKCkpO1xuICAgICAgICAgIGlmICh0aGlzLl9teWNiKSB0aGlzLl9teWNiKG51bGwsIHRoaXMpO1xuICAgICAgICB9KS5iaW5kKHRoaXMpLCB0aGlzLl9mYWlsLmJpbmQodGhpcykpO1xuICAgICAgfSkuYmluZCh0aGlzKSk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnZGlzY29ubmVjdCcsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGRpc2Nvbm5lY3QoKSB7XG4gICAgICBpZiAodGhpcy5zb3VyY2UpIHRoaXMuc291cmNlLmRpc2Nvbm5lY3QodGhpcy5jb250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdfc2V0dXAnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBfc2V0dXAoYnVmZmVyKSB7XG4gICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gICAgICB0aGlzLmRpc2Nvbm5lY3QoKTtcbiAgICAgIHRoaXMuc291cmNlID0gdGhpcy5jb250ZXh0LmNyZWF0ZUJ1ZmZlclNvdXJjZSgpO1xuICAgICAgdGhpcy5zb3VyY2UuYnVmZmVyID0gdGhpcy5idWZmZXI7XG5cbiAgICAgIGlmICh0aGlzLmdhaW5Ob2RlKSB7XG4gICAgICAgIC8qXG4gICAgICAgICAqIFJlYWxseSBkb24ndCBsaWtlIGhhdmluZyB0byBkbyB0aGlzIGV2ZXJ5dGltZVxuICAgICAgICAgKiB3ZSBnZXQgYSBmcmVzaCBidWZmZXIgb24gcGxheWJhY2ssIGJ1dCBpdCBzZWVtc1xuICAgICAgICAgKiB0aGF0IHRoaXMgaXMgdGhlIG9ubHkgb3B0aW9uIHVudGlsIHRoZSB3ZWIgYXVkaW9cbiAgICAgICAgICogc3BlYyBpcyB1cGRhdGVkLiA6JyhcbiAgICAgICAgICogKi9cbiAgICAgICAgdGhpcy5zb3VyY2UuY29ubmVjdCh0aGlzLmdhaW5Ob2RlKTtcbiAgICAgICAgdGhpcy5ub2Rlcy5mb3JFYWNoKGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgICAgX3RoaXMuZ2Fpbk5vZGUuY29ubmVjdChub2RlLmlucHV0KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgdGhpcy5nYWluTm9kZS5jb25uZWN0KHRoaXMuY29udGV4dC5kZXN0aW5hdGlvbik7XG5cbiAgICAgICAgLy8gaG9vayB1cCBhbmFseXNlciBub2Rlc1xuICAgICAgICB0aGlzLm5vZGVzLmZvckVhY2goZnVuY3Rpb24gKG5vZGUpIHtcbiAgICAgICAgICBpZiAobm9kZS5pbnB1dC5oYXNPd25Qcm9wZXJ0eSgnZmZ0U2l6ZScpKSBub2RlLmNvbm5lY3QoX3RoaXMuY29udGV4dC5kZXN0aW5hdGlvbik7XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHRoaXMuc291cmNlLmNvbm5lY3QodGhpcy5jb250ZXh0LmRlc3RpbmF0aW9uKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdfZmFpbCcsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIF9mYWlsKGVycikge1xuICAgICAgLypcbiAgICAgICAqIFRoaXMgZXJyb3IgaGFuZGxpbmcgbmVlZHMgaW1wcm92ZW1lbnQsIGZvciBzdXJlLlxuICAgICAgICogKi9cbiAgICAgIGlmICh0aGlzLmxpc3RlbmVycygnZXJyb3InKS5sZW5ndGgpIHRoaXMuZW1pdCgnZXJyb3InLCBlcnIpO2Vsc2UgaWYgKHRoaXMuX215Y2IpIHRoaXMuX215Y2IobmV3IEVycm9yKGVycikpO2Vsc2UgdGhyb3cgbmV3IEVycm9yKCdObyBlcnJvciBoYW5kbGluZz86ICcsIGVycik7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnX3JlcScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIF9yZXEoY2IpIHtcbiAgICAgIHZhciBfdGhpczIgPSB0aGlzO1xuXG4gICAgICB0aGlzLl9teWNiID0gY2I7XG4gICAgICBfeGhyMlsnZGVmYXVsdCddKHtcbiAgICAgICAgdXJpOiB0aGlzLnVybCxcbiAgICAgICAgcmVzcG9uc2VUeXBlOiAnYXJyYXlidWZmZXInXG4gICAgICB9LCAoZnVuY3Rpb24gKGVyciwgcmVzcCwgYm9keSkge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgZXJyID0gbnVsbDtcbiAgICAgICAgICBfdGhpczIucmVhZChfdGhpczIudXJsLCBjYik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgX3RoaXMyLmNvbnRleHQuZGVjb2RlQXVkaW9EYXRhKGJvZHksIChmdW5jdGlvbiAoYnVmZmVyKSB7XG4gICAgICAgICAgICB0aGlzLmJ1ZmZlciA9IGJ1ZmZlcjtcbiAgICAgICAgICAgIHRoaXMuZW1pdCgnbG9hZCcsIHRoaXMudGltZSgpKTtcbiAgICAgICAgICAgIGlmICh0aGlzLl9teWNiKSB0aGlzLl9teWNiKG51bGwsIHRoaXMpO1xuICAgICAgICAgIH0pLmJpbmQoX3RoaXMyKSwgX3RoaXMyLl9mYWlsLmJpbmQoX3RoaXMyKSk7XG4gICAgICAgIH1cbiAgICAgIH0pLmJpbmQodGhpcykpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3BsYXknLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBwbGF5KG9mZnNldCkge1xuICAgICAgdGhpcy5sYXN0UGxheSA9IHRoaXMuY29udGV4dC5jdXJyZW50VGltZTtcbiAgICAgIGlmICghb2Zmc2V0KSBvZmZzZXQgPSB0aGlzLnN0YXJ0T2Zmc2V0O1xuXG4gICAgICBpZiAoIXRoaXMuX2luaXQpIHRoaXMuX3N0b3AoKTtlbHNlIHRoaXMuX2luaXQgPSBmYWxzZTtcblxuICAgICAgdGhpcy5fc2V0dXAodGhpcy5idWZmZXIpOyAvLyBnZXQgYSBmcmVzaCBidWZmZXJcbiAgICAgIHRoaXMuc291cmNlLnN0YXJ0KDAsIG9mZnNldCk7XG4gICAgICB0aGlzLnBsYXlpbmcgPSB0cnVlO1xuICAgICAgdGhpcy5pbnRlcnZhbCA9IF9yYWYyWydkZWZhdWx0J10odGhpcy5fYnJvYWRjYXN0VGltZS5iaW5kKHRoaXMpKTtcbiAgICAgIHRoaXMuZW1pdCgncGxheScsIHRoaXMudGltZSgpKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdfc3RvcCcsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIF9zdG9wKCkge1xuICAgICAgdGhpcy5zb3VyY2Uuc3RvcCh0aGlzLmNvbnRleHQuY3VycmVudFRpbWUpO1xuICAgICAgdGhpcy5wbGF5aW5nID0gZmFsc2U7XG4gICAgICB0aGlzLmludGVydmFsID0gX3JhZjJbJ2RlZmF1bHQnXS5jYW5jZWwodGhpcy5pbnRlcnZhbCk7XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnc3RvcCcsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHN0b3AoKSB7XG4gICAgICB0aGlzLnN0YXJ0T2Zmc2V0ID0gMDtcbiAgICAgIHRoaXMubGFzdFBsYXkgPSAwO1xuICAgICAgdGhpcy5fc3RvcCgpO1xuICAgICAgdGhpcy5lbWl0KCdzdG9wJywgdGhpcy50aW1lKCkpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3NlZWsnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBzZWVrKHRpbWUpIHtcbiAgICAgIGlmICh0aW1lKSBza2lwKHRpbWUpO2Vsc2UgYmFjayh0aW1lKTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdza2lwJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gc2tpcCh0aW1lKSB7XG4gICAgICBpZiAoIXRpbWUpIHRpbWUgPSA1O1xuICAgICAgdGhpcy5sYXN0UGxheSA9IHRoaXMubGFzdFBsYXkgKyB0aW1lO1xuICAgICAgdGhpcy5wYXVzZSgpO1xuICAgICAgdGhpcy5lbWl0KCdza2lwJywgdGhpcy50aW1lKCksIHRpbWUpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2JhY2snLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBiYWNrKHRpbWUpIHtcbiAgICAgIGlmICghdGltZSkgdGltZSA9IC01O1xuICAgICAgdGhpcy5sYXN0UGxheSA9IHRoaXMubGFzdFBsYXkgKyB0aW1lO1xuICAgICAgdGhpcy5wYXVzZSgpO1xuICAgICAgdGhpcy5lbWl0KCdiYWNrJywgdGhpcy50aW1lKCksIHRpbWUpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3BhdXNlJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gcGF1c2UoKSB7XG4gICAgICB0aGlzLl9zdG9wKCk7XG4gICAgICB0aGlzLnN0YXJ0T2Zmc2V0ICs9IHRoaXMuY29udGV4dC5jdXJyZW50VGltZSAtIHRoaXMubGFzdFBsYXk7XG4gICAgICB0aGlzLmVtaXQoJ3BhdXNlJywgdGhpcy50aW1lKCkpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3JlbW92ZScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHJlbW92ZSgpIHtcbiAgICAgIHRoaXMuZGlzY29ubmVjdCgpO1xuICAgICAgdGhpcy5lbWl0KCdyZW1vdmUnLCB0aGlzLnRpbWUoKSk7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ3RpbWUnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiB0aW1lKCkge1xuICAgICAgdmFyIGN1ciA9IHRoaXMuY29udGV4dC5jdXJyZW50VGltZSAtIHRoaXMubGFzdFBsYXkgKyB0aGlzLnN0YXJ0T2Zmc2V0O1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgY3VycmVudDogY3VyLFxuICAgICAgICByZW1haW5pbmc6IHRoaXMuYnVmZmVyLmR1cmF0aW9uIC0gY3VyLFxuICAgICAgICBwZXJjZW50OiAoY3VyIC8gdGhpcy5idWZmZXIuZHVyYXRpb24gKiAxMDApLnRvRml4ZWQoMikgKyAnJScsXG4gICAgICAgIHRvdGFsOiB0aGlzLmJ1ZmZlci5kdXJhdGlvblxuICAgICAgfTtcbiAgICB9XG4gIH0sIHtcbiAgICBrZXk6ICdfYnJvYWRjYXN0VGltZScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIF9icm9hZGNhc3RUaW1lKCkge1xuICAgICAgdmFyIHRpbWUgPSB0aGlzLnRpbWUoKTtcbiAgICAgIGlmICh0aW1lLmN1cnJlbnQgPiB0aW1lLnRvdGFsKSB0aGlzLnN0b3AoKTtlbHNlIHtcbiAgICAgICAgdGhpcy5lbWl0KCd0aW1lJywgdGltZSk7XG4gICAgICAgIF9yYWYyWydkZWZhdWx0J10odGhpcy5fYnJvYWRjYXN0VGltZS5iaW5kKHRoaXMpKTtcbiAgICAgIH1cbiAgICB9XG4gIH1dKTtcblxuICByZXR1cm4gQXVkaW9Tb3VyY2U7XG59KShfRXZlbnRFbWl0dGVyM1snZGVmYXVsdCddKTtcblxuZXhwb3J0c1snZGVmYXVsdCddID0gQXVkaW9Tb3VyY2U7XG5tb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHNbJ2RlZmF1bHQnXTsiLCJ2YXIgbm93ID0gcmVxdWlyZSgncGVyZm9ybWFuY2Utbm93JylcbiAgLCBnbG9iYWwgPSB0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJyA/IHt9IDogd2luZG93XG4gICwgdmVuZG9ycyA9IFsnbW96JywgJ3dlYmtpdCddXG4gICwgc3VmZml4ID0gJ0FuaW1hdGlvbkZyYW1lJ1xuICAsIHJhZiA9IGdsb2JhbFsncmVxdWVzdCcgKyBzdWZmaXhdXG4gICwgY2FmID0gZ2xvYmFsWydjYW5jZWwnICsgc3VmZml4XSB8fCBnbG9iYWxbJ2NhbmNlbFJlcXVlc3QnICsgc3VmZml4XVxuICAsIGlzTmF0aXZlID0gdHJ1ZVxuXG5mb3IodmFyIGkgPSAwOyBpIDwgdmVuZG9ycy5sZW5ndGggJiYgIXJhZjsgaSsrKSB7XG4gIHJhZiA9IGdsb2JhbFt2ZW5kb3JzW2ldICsgJ1JlcXVlc3QnICsgc3VmZml4XVxuICBjYWYgPSBnbG9iYWxbdmVuZG9yc1tpXSArICdDYW5jZWwnICsgc3VmZml4XVxuICAgICAgfHwgZ2xvYmFsW3ZlbmRvcnNbaV0gKyAnQ2FuY2VsUmVxdWVzdCcgKyBzdWZmaXhdXG59XG5cbi8vIFNvbWUgdmVyc2lvbnMgb2YgRkYgaGF2ZSByQUYgYnV0IG5vdCBjQUZcbmlmKCFyYWYgfHwgIWNhZikge1xuICBpc05hdGl2ZSA9IGZhbHNlXG5cbiAgdmFyIGxhc3QgPSAwXG4gICAgLCBpZCA9IDBcbiAgICAsIHF1ZXVlID0gW11cbiAgICAsIGZyYW1lRHVyYXRpb24gPSAxMDAwIC8gNjBcblxuICByYWYgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIGlmKHF1ZXVlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgdmFyIF9ub3cgPSBub3coKVxuICAgICAgICAsIG5leHQgPSBNYXRoLm1heCgwLCBmcmFtZUR1cmF0aW9uIC0gKF9ub3cgLSBsYXN0KSlcbiAgICAgIGxhc3QgPSBuZXh0ICsgX25vd1xuICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGNwID0gcXVldWUuc2xpY2UoMClcbiAgICAgICAgLy8gQ2xlYXIgcXVldWUgaGVyZSB0byBwcmV2ZW50XG4gICAgICAgIC8vIGNhbGxiYWNrcyBmcm9tIGFwcGVuZGluZyBsaXN0ZW5lcnNcbiAgICAgICAgLy8gdG8gdGhlIGN1cnJlbnQgZnJhbWUncyBxdWV1ZVxuICAgICAgICBxdWV1ZS5sZW5ndGggPSAwXG4gICAgICAgIGZvcih2YXIgaSA9IDA7IGkgPCBjcC5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmKCFjcFtpXS5jYW5jZWxsZWQpIHtcbiAgICAgICAgICAgIHRyeXtcbiAgICAgICAgICAgICAgY3BbaV0uY2FsbGJhY2sobGFzdClcbiAgICAgICAgICAgIH0gY2F0Y2goZSkge1xuICAgICAgICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkgeyB0aHJvdyBlIH0sIDApXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9LCBNYXRoLnJvdW5kKG5leHQpKVxuICAgIH1cbiAgICBxdWV1ZS5wdXNoKHtcbiAgICAgIGhhbmRsZTogKytpZCxcbiAgICAgIGNhbGxiYWNrOiBjYWxsYmFjayxcbiAgICAgIGNhbmNlbGxlZDogZmFsc2VcbiAgICB9KVxuICAgIHJldHVybiBpZFxuICB9XG5cbiAgY2FmID0gZnVuY3Rpb24oaGFuZGxlKSB7XG4gICAgZm9yKHZhciBpID0gMDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICBpZihxdWV1ZVtpXS5oYW5kbGUgPT09IGhhbmRsZSkge1xuICAgICAgICBxdWV1ZVtpXS5jYW5jZWxsZWQgPSB0cnVlXG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oZm4pIHtcbiAgLy8gV3JhcCBpbiBhIG5ldyBmdW5jdGlvbiB0byBwcmV2ZW50XG4gIC8vIGBjYW5jZWxgIHBvdGVudGlhbGx5IGJlaW5nIGFzc2lnbmVkXG4gIC8vIHRvIHRoZSBuYXRpdmUgckFGIGZ1bmN0aW9uXG4gIGlmKCFpc05hdGl2ZSkge1xuICAgIHJldHVybiByYWYuY2FsbChnbG9iYWwsIGZuKVxuICB9XG4gIHJldHVybiByYWYuY2FsbChnbG9iYWwsIGZ1bmN0aW9uKCkge1xuICAgIHRyeXtcbiAgICAgIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cylcbiAgICB9IGNhdGNoKGUpIHtcbiAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7IHRocm93IGUgfSwgMClcbiAgICB9XG4gIH0pXG59XG5tb2R1bGUuZXhwb3J0cy5jYW5jZWwgPSBmdW5jdGlvbigpIHtcbiAgY2FmLmFwcGx5KGdsb2JhbCwgYXJndW1lbnRzKVxufVxuIiwiKGZ1bmN0aW9uIChwcm9jZXNzKXtcbi8vIEdlbmVyYXRlZCBieSBDb2ZmZWVTY3JpcHQgMS42LjNcbihmdW5jdGlvbigpIHtcbiAgdmFyIGdldE5hbm9TZWNvbmRzLCBocnRpbWUsIGxvYWRUaW1lO1xuXG4gIGlmICgodHlwZW9mIHBlcmZvcm1hbmNlICE9PSBcInVuZGVmaW5lZFwiICYmIHBlcmZvcm1hbmNlICE9PSBudWxsKSAmJiBwZXJmb3JtYW5jZS5ub3cpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIHBlcmZvcm1hbmNlLm5vdygpO1xuICAgIH07XG4gIH0gZWxzZSBpZiAoKHR5cGVvZiBwcm9jZXNzICE9PSBcInVuZGVmaW5lZFwiICYmIHByb2Nlc3MgIT09IG51bGwpICYmIHByb2Nlc3MuaHJ0aW1lKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiAoZ2V0TmFub1NlY29uZHMoKSAtIGxvYWRUaW1lKSAvIDFlNjtcbiAgICB9O1xuICAgIGhydGltZSA9IHByb2Nlc3MuaHJ0aW1lO1xuICAgIGdldE5hbm9TZWNvbmRzID0gZnVuY3Rpb24oKSB7XG4gICAgICB2YXIgaHI7XG4gICAgICBociA9IGhydGltZSgpO1xuICAgICAgcmV0dXJuIGhyWzBdICogMWU5ICsgaHJbMV07XG4gICAgfTtcbiAgICBsb2FkVGltZSA9IGdldE5hbm9TZWNvbmRzKCk7XG4gIH0gZWxzZSBpZiAoRGF0ZS5ub3cpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIERhdGUubm93KCkgLSBsb2FkVGltZTtcbiAgICB9O1xuICAgIGxvYWRUaW1lID0gRGF0ZS5ub3coKTtcbiAgfSBlbHNlIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gbG9hZFRpbWU7XG4gICAgfTtcbiAgICBsb2FkVGltZSA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpO1xuICB9XG5cbn0pLmNhbGwodGhpcyk7XG5cbi8qXG4vL0Agc291cmNlTWFwcGluZ1VSTD1wZXJmb3JtYW5jZS1ub3cubWFwXG4qL1xuXG59KS5jYWxsKHRoaXMscmVxdWlyZSgnX3Byb2Nlc3MnKSkiLCJcInVzZSBzdHJpY3RcIjtcbnZhciB3aW5kb3cgPSByZXF1aXJlKFwiZ2xvYmFsL3dpbmRvd1wiKVxudmFyIG9uY2UgPSByZXF1aXJlKFwib25jZVwiKVxudmFyIHBhcnNlSGVhZGVycyA9IHJlcXVpcmUoXCJwYXJzZS1oZWFkZXJzXCIpXG5cblxudmFyIFhIUiA9IHdpbmRvdy5YTUxIdHRwUmVxdWVzdCB8fCBub29wXG52YXIgWERSID0gXCJ3aXRoQ3JlZGVudGlhbHNcIiBpbiAobmV3IFhIUigpKSA/IFhIUiA6IHdpbmRvdy5YRG9tYWluUmVxdWVzdFxuXG5tb2R1bGUuZXhwb3J0cyA9IGNyZWF0ZVhIUlxuXG5mdW5jdGlvbiBjcmVhdGVYSFIob3B0aW9ucywgY2FsbGJhY2spIHtcbiAgICBmdW5jdGlvbiByZWFkeXN0YXRlY2hhbmdlKCkge1xuICAgICAgICBpZiAoeGhyLnJlYWR5U3RhdGUgPT09IDQpIHtcbiAgICAgICAgICAgIGxvYWRGdW5jKClcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGdldEJvZHkoKSB7XG4gICAgICAgIC8vIENocm9tZSB3aXRoIHJlcXVlc3RUeXBlPWJsb2IgdGhyb3dzIGVycm9ycyBhcnJvdW5kIHdoZW4gZXZlbiB0ZXN0aW5nIGFjY2VzcyB0byByZXNwb25zZVRleHRcbiAgICAgICAgdmFyIGJvZHkgPSB1bmRlZmluZWRcblxuICAgICAgICBpZiAoeGhyLnJlc3BvbnNlKSB7XG4gICAgICAgICAgICBib2R5ID0geGhyLnJlc3BvbnNlXG4gICAgICAgIH0gZWxzZSBpZiAoeGhyLnJlc3BvbnNlVHlwZSA9PT0gXCJ0ZXh0XCIgfHwgIXhoci5yZXNwb25zZVR5cGUpIHtcbiAgICAgICAgICAgIGJvZHkgPSB4aHIucmVzcG9uc2VUZXh0IHx8IHhoci5yZXNwb25zZVhNTFxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGlzSnNvbikge1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBib2R5ID0gSlNPTi5wYXJzZShib2R5KVxuICAgICAgICAgICAgfSBjYXRjaCAoZSkge31cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBib2R5XG4gICAgfVxuICAgIFxuICAgIHZhciBmYWlsdXJlUmVzcG9uc2UgPSB7XG4gICAgICAgICAgICAgICAgYm9keTogdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAgIGhlYWRlcnM6IHt9LFxuICAgICAgICAgICAgICAgIHN0YXR1c0NvZGU6IDAsXG4gICAgICAgICAgICAgICAgbWV0aG9kOiBtZXRob2QsXG4gICAgICAgICAgICAgICAgdXJsOiB1cmksXG4gICAgICAgICAgICAgICAgcmF3UmVxdWVzdDogeGhyXG4gICAgICAgICAgICB9XG4gICAgXG4gICAgZnVuY3Rpb24gZXJyb3JGdW5jKGV2dCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dFRpbWVyKVxuICAgICAgICBpZighKGV2dCBpbnN0YW5jZW9mIEVycm9yKSl7XG4gICAgICAgICAgICBldnQgPSBuZXcgRXJyb3IoXCJcIiArIChldnQgfHwgXCJ1bmtub3duXCIpIClcbiAgICAgICAgfVxuICAgICAgICBldnQuc3RhdHVzQ29kZSA9IDBcbiAgICAgICAgY2FsbGJhY2soZXZ0LCBmYWlsdXJlUmVzcG9uc2UpXG4gICAgfVxuXG4gICAgLy8gd2lsbCBsb2FkIHRoZSBkYXRhICYgcHJvY2VzcyB0aGUgcmVzcG9uc2UgaW4gYSBzcGVjaWFsIHJlc3BvbnNlIG9iamVjdFxuICAgIGZ1bmN0aW9uIGxvYWRGdW5jKCkge1xuICAgICAgICBjbGVhclRpbWVvdXQodGltZW91dFRpbWVyKVxuICAgICAgICBcbiAgICAgICAgdmFyIHN0YXR1cyA9ICh4aHIuc3RhdHVzID09PSAxMjIzID8gMjA0IDogeGhyLnN0YXR1cylcbiAgICAgICAgdmFyIHJlc3BvbnNlID0gZmFpbHVyZVJlc3BvbnNlXG4gICAgICAgIHZhciBlcnIgPSBudWxsXG4gICAgICAgIFxuICAgICAgICBpZiAoc3RhdHVzICE9PSAwKXtcbiAgICAgICAgICAgIHJlc3BvbnNlID0ge1xuICAgICAgICAgICAgICAgIGJvZHk6IGdldEJvZHkoKSxcbiAgICAgICAgICAgICAgICBzdGF0dXNDb2RlOiBzdGF0dXMsXG4gICAgICAgICAgICAgICAgbWV0aG9kOiBtZXRob2QsXG4gICAgICAgICAgICAgICAgaGVhZGVyczoge30sXG4gICAgICAgICAgICAgICAgdXJsOiB1cmksXG4gICAgICAgICAgICAgICAgcmF3UmVxdWVzdDogeGhyXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZih4aHIuZ2V0QWxsUmVzcG9uc2VIZWFkZXJzKXsgLy9yZW1lbWJlciB4aHIgY2FuIGluIGZhY3QgYmUgWERSIGZvciBDT1JTIGluIElFXG4gICAgICAgICAgICAgICAgcmVzcG9uc2UuaGVhZGVycyA9IHBhcnNlSGVhZGVycyh4aHIuZ2V0QWxsUmVzcG9uc2VIZWFkZXJzKCkpXG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBlcnIgPSBuZXcgRXJyb3IoXCJJbnRlcm5hbCBYTUxIdHRwUmVxdWVzdCBFcnJvclwiKVxuICAgICAgICB9XG4gICAgICAgIGNhbGxiYWNrKGVyciwgcmVzcG9uc2UsIHJlc3BvbnNlLmJvZHkpXG4gICAgICAgIFxuICAgIH1cbiAgICBcbiAgICBpZiAodHlwZW9mIG9wdGlvbnMgPT09IFwic3RyaW5nXCIpIHtcbiAgICAgICAgb3B0aW9ucyA9IHsgdXJpOiBvcHRpb25zIH1cbiAgICB9XG5cbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fVxuICAgIGlmKHR5cGVvZiBjYWxsYmFjayA9PT0gXCJ1bmRlZmluZWRcIil7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcImNhbGxiYWNrIGFyZ3VtZW50IG1pc3NpbmdcIilcbiAgICB9XG4gICAgY2FsbGJhY2sgPSBvbmNlKGNhbGxiYWNrKVxuXG4gICAgdmFyIHhociA9IG9wdGlvbnMueGhyIHx8IG51bGxcblxuICAgIGlmICgheGhyKSB7XG4gICAgICAgIGlmIChvcHRpb25zLmNvcnMgfHwgb3B0aW9ucy51c2VYRFIpIHtcbiAgICAgICAgICAgIHhociA9IG5ldyBYRFIoKVxuICAgICAgICB9ZWxzZXtcbiAgICAgICAgICAgIHhociA9IG5ldyBYSFIoKVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGtleVxuICAgIHZhciB1cmkgPSB4aHIudXJsID0gb3B0aW9ucy51cmkgfHwgb3B0aW9ucy51cmxcbiAgICB2YXIgbWV0aG9kID0geGhyLm1ldGhvZCA9IG9wdGlvbnMubWV0aG9kIHx8IFwiR0VUXCJcbiAgICB2YXIgYm9keSA9IG9wdGlvbnMuYm9keSB8fCBvcHRpb25zLmRhdGFcbiAgICB2YXIgaGVhZGVycyA9IHhoci5oZWFkZXJzID0gb3B0aW9ucy5oZWFkZXJzIHx8IHt9XG4gICAgdmFyIHN5bmMgPSAhIW9wdGlvbnMuc3luY1xuICAgIHZhciBpc0pzb24gPSBmYWxzZVxuICAgIHZhciB0aW1lb3V0VGltZXJcblxuICAgIGlmIChcImpzb25cIiBpbiBvcHRpb25zKSB7XG4gICAgICAgIGlzSnNvbiA9IHRydWVcbiAgICAgICAgaGVhZGVyc1tcIkFjY2VwdFwiXSB8fCAoaGVhZGVyc1tcIkFjY2VwdFwiXSA9IFwiYXBwbGljYXRpb24vanNvblwiKSAvL0Rvbid0IG92ZXJyaWRlIGV4aXN0aW5nIGFjY2VwdCBoZWFkZXIgZGVjbGFyZWQgYnkgdXNlclxuICAgICAgICBpZiAobWV0aG9kICE9PSBcIkdFVFwiICYmIG1ldGhvZCAhPT0gXCJIRUFEXCIpIHtcbiAgICAgICAgICAgIGhlYWRlcnNbXCJDb250ZW50LVR5cGVcIl0gPSBcImFwcGxpY2F0aW9uL2pzb25cIlxuICAgICAgICAgICAgYm9keSA9IEpTT04uc3RyaW5naWZ5KG9wdGlvbnMuanNvbilcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHhoci5vbnJlYWR5c3RhdGVjaGFuZ2UgPSByZWFkeXN0YXRlY2hhbmdlXG4gICAgeGhyLm9ubG9hZCA9IGxvYWRGdW5jXG4gICAgeGhyLm9uZXJyb3IgPSBlcnJvckZ1bmNcbiAgICAvLyBJRTkgbXVzdCBoYXZlIG9ucHJvZ3Jlc3MgYmUgc2V0IHRvIGEgdW5pcXVlIGZ1bmN0aW9uLlxuICAgIHhoci5vbnByb2dyZXNzID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAvLyBJRSBtdXN0IGRpZVxuICAgIH1cbiAgICB4aHIub250aW1lb3V0ID0gZXJyb3JGdW5jXG4gICAgeGhyLm9wZW4obWV0aG9kLCB1cmksICFzeW5jLCBvcHRpb25zLnVzZXJuYW1lLCBvcHRpb25zLnBhc3N3b3JkKVxuICAgIC8vaGFzIHRvIGJlIGFmdGVyIG9wZW5cbiAgICBpZighc3luYykge1xuICAgICAgICB4aHIud2l0aENyZWRlbnRpYWxzID0gISFvcHRpb25zLndpdGhDcmVkZW50aWFsc1xuICAgIH1cbiAgICAvLyBDYW5ub3Qgc2V0IHRpbWVvdXQgd2l0aCBzeW5jIHJlcXVlc3RcbiAgICAvLyBub3Qgc2V0dGluZyB0aW1lb3V0IG9uIHRoZSB4aHIgb2JqZWN0LCBiZWNhdXNlIG9mIG9sZCB3ZWJraXRzIGV0Yy4gbm90IGhhbmRsaW5nIHRoYXQgY29ycmVjdGx5XG4gICAgLy8gYm90aCBucG0ncyByZXF1ZXN0IGFuZCBqcXVlcnkgMS54IHVzZSB0aGlzIGtpbmQgb2YgdGltZW91dCwgc28gdGhpcyBpcyBiZWluZyBjb25zaXN0ZW50XG4gICAgaWYgKCFzeW5jICYmIG9wdGlvbnMudGltZW91dCA+IDAgKSB7XG4gICAgICAgIHRpbWVvdXRUaW1lciA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIHhoci5hYm9ydChcInRpbWVvdXRcIik7XG4gICAgICAgIH0sIG9wdGlvbnMudGltZW91dCsyICk7XG4gICAgfVxuXG4gICAgaWYgKHhoci5zZXRSZXF1ZXN0SGVhZGVyKSB7XG4gICAgICAgIGZvcihrZXkgaW4gaGVhZGVycyl7XG4gICAgICAgICAgICBpZihoZWFkZXJzLmhhc093blByb3BlcnR5KGtleSkpe1xuICAgICAgICAgICAgICAgIHhoci5zZXRSZXF1ZXN0SGVhZGVyKGtleSwgaGVhZGVyc1trZXldKVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSBlbHNlIGlmIChvcHRpb25zLmhlYWRlcnMpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSGVhZGVycyBjYW5ub3QgYmUgc2V0IG9uIGFuIFhEb21haW5SZXF1ZXN0IG9iamVjdFwiKVxuICAgIH1cblxuICAgIGlmIChcInJlc3BvbnNlVHlwZVwiIGluIG9wdGlvbnMpIHtcbiAgICAgICAgeGhyLnJlc3BvbnNlVHlwZSA9IG9wdGlvbnMucmVzcG9uc2VUeXBlXG4gICAgfVxuICAgIFxuICAgIGlmIChcImJlZm9yZVNlbmRcIiBpbiBvcHRpb25zICYmIFxuICAgICAgICB0eXBlb2Ygb3B0aW9ucy5iZWZvcmVTZW5kID09PSBcImZ1bmN0aW9uXCJcbiAgICApIHtcbiAgICAgICAgb3B0aW9ucy5iZWZvcmVTZW5kKHhocilcbiAgICB9XG5cbiAgICB4aHIuc2VuZChib2R5KVxuXG4gICAgcmV0dXJuIHhoclxuXG5cbn1cblxuXG5mdW5jdGlvbiBub29wKCkge31cbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbmlmICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSB3aW5kb3c7XG59IGVsc2UgaWYgKHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGdsb2JhbDtcbn0gZWxzZSBpZiAodHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIpe1xuICAgIG1vZHVsZS5leHBvcnRzID0gc2VsZjtcbn0gZWxzZSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSB7fTtcbn1cblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pIiwibW9kdWxlLmV4cG9ydHMgPSBvbmNlXG5cbm9uY2UucHJvdG8gPSBvbmNlKGZ1bmN0aW9uICgpIHtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KEZ1bmN0aW9uLnByb3RvdHlwZSwgJ29uY2UnLCB7XG4gICAgdmFsdWU6IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBvbmNlKHRoaXMpXG4gICAgfSxcbiAgICBjb25maWd1cmFibGU6IHRydWVcbiAgfSlcbn0pXG5cbmZ1bmN0aW9uIG9uY2UgKGZuKSB7XG4gIHZhciBjYWxsZWQgPSBmYWxzZVxuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIGlmIChjYWxsZWQpIHJldHVyblxuICAgIGNhbGxlZCA9IHRydWVcbiAgICByZXR1cm4gZm4uYXBwbHkodGhpcywgYXJndW1lbnRzKVxuICB9XG59XG4iLCJ2YXIgaXNGdW5jdGlvbiA9IHJlcXVpcmUoJ2lzLWZ1bmN0aW9uJylcblxubW9kdWxlLmV4cG9ydHMgPSBmb3JFYWNoXG5cbnZhciB0b1N0cmluZyA9IE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmdcbnZhciBoYXNPd25Qcm9wZXJ0eSA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHlcblxuZnVuY3Rpb24gZm9yRWFjaChsaXN0LCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIGlmICghaXNGdW5jdGlvbihpdGVyYXRvcikpIHtcbiAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignaXRlcmF0b3IgbXVzdCBiZSBhIGZ1bmN0aW9uJylcbiAgICB9XG5cbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA8IDMpIHtcbiAgICAgICAgY29udGV4dCA9IHRoaXNcbiAgICB9XG4gICAgXG4gICAgaWYgKHRvU3RyaW5nLmNhbGwobGlzdCkgPT09ICdbb2JqZWN0IEFycmF5XScpXG4gICAgICAgIGZvckVhY2hBcnJheShsaXN0LCBpdGVyYXRvciwgY29udGV4dClcbiAgICBlbHNlIGlmICh0eXBlb2YgbGlzdCA9PT0gJ3N0cmluZycpXG4gICAgICAgIGZvckVhY2hTdHJpbmcobGlzdCwgaXRlcmF0b3IsIGNvbnRleHQpXG4gICAgZWxzZVxuICAgICAgICBmb3JFYWNoT2JqZWN0KGxpc3QsIGl0ZXJhdG9yLCBjb250ZXh0KVxufVxuXG5mdW5jdGlvbiBmb3JFYWNoQXJyYXkoYXJyYXksIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IGFycmF5Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKGFycmF5LCBpKSkge1xuICAgICAgICAgICAgaXRlcmF0b3IuY2FsbChjb250ZXh0LCBhcnJheVtpXSwgaSwgYXJyYXkpXG4gICAgICAgIH1cbiAgICB9XG59XG5cbmZ1bmN0aW9uIGZvckVhY2hTdHJpbmcoc3RyaW5nLCBpdGVyYXRvciwgY29udGV4dCkge1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBzdHJpbmcubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgLy8gbm8gc3VjaCB0aGluZyBhcyBhIHNwYXJzZSBzdHJpbmcuXG4gICAgICAgIGl0ZXJhdG9yLmNhbGwoY29udGV4dCwgc3RyaW5nLmNoYXJBdChpKSwgaSwgc3RyaW5nKVxuICAgIH1cbn1cblxuZnVuY3Rpb24gZm9yRWFjaE9iamVjdChvYmplY3QsIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgZm9yICh2YXIgayBpbiBvYmplY3QpIHtcbiAgICAgICAgaWYgKGhhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBrKSkge1xuICAgICAgICAgICAgaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmplY3Rba10sIGssIG9iamVjdClcbiAgICAgICAgfVxuICAgIH1cbn1cbiIsIm1vZHVsZS5leHBvcnRzID0gaXNGdW5jdGlvblxuXG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nXG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24gKGZuKSB7XG4gIHZhciBzdHJpbmcgPSB0b1N0cmluZy5jYWxsKGZuKVxuICByZXR1cm4gc3RyaW5nID09PSAnW29iamVjdCBGdW5jdGlvbl0nIHx8XG4gICAgKHR5cGVvZiBmbiA9PT0gJ2Z1bmN0aW9uJyAmJiBzdHJpbmcgIT09ICdbb2JqZWN0IFJlZ0V4cF0nKSB8fFxuICAgICh0eXBlb2Ygd2luZG93ICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICAvLyBJRTggYW5kIGJlbG93XG4gICAgIChmbiA9PT0gd2luZG93LnNldFRpbWVvdXQgfHxcbiAgICAgIGZuID09PSB3aW5kb3cuYWxlcnQgfHxcbiAgICAgIGZuID09PSB3aW5kb3cuY29uZmlybSB8fFxuICAgICAgZm4gPT09IHdpbmRvdy5wcm9tcHQpKVxufTtcbiIsIlxuZXhwb3J0cyA9IG1vZHVsZS5leHBvcnRzID0gdHJpbTtcblxuZnVuY3Rpb24gdHJpbShzdHIpe1xuICByZXR1cm4gc3RyLnJlcGxhY2UoL15cXHMqfFxccyokL2csICcnKTtcbn1cblxuZXhwb3J0cy5sZWZ0ID0gZnVuY3Rpb24oc3RyKXtcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKC9eXFxzKi8sICcnKTtcbn07XG5cbmV4cG9ydHMucmlnaHQgPSBmdW5jdGlvbihzdHIpe1xuICByZXR1cm4gc3RyLnJlcGxhY2UoL1xccyokLywgJycpO1xufTtcbiIsInZhciB0cmltID0gcmVxdWlyZSgndHJpbScpXG4gICwgZm9yRWFjaCA9IHJlcXVpcmUoJ2Zvci1lYWNoJylcbiAgLCBpc0FycmF5ID0gZnVuY3Rpb24oYXJnKSB7XG4gICAgICByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKGFyZykgPT09ICdbb2JqZWN0IEFycmF5XSc7XG4gICAgfVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChoZWFkZXJzKSB7XG4gIGlmICghaGVhZGVycylcbiAgICByZXR1cm4ge31cblxuICB2YXIgcmVzdWx0ID0ge31cblxuICBmb3JFYWNoKFxuICAgICAgdHJpbShoZWFkZXJzKS5zcGxpdCgnXFxuJylcbiAgICAsIGZ1bmN0aW9uIChyb3cpIHtcbiAgICAgICAgdmFyIGluZGV4ID0gcm93LmluZGV4T2YoJzonKVxuICAgICAgICAgICwga2V5ID0gdHJpbShyb3cuc2xpY2UoMCwgaW5kZXgpKS50b0xvd2VyQ2FzZSgpXG4gICAgICAgICAgLCB2YWx1ZSA9IHRyaW0ocm93LnNsaWNlKGluZGV4ICsgMSkpXG5cbiAgICAgICAgaWYgKHR5cGVvZihyZXN1bHRba2V5XSkgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgcmVzdWx0W2tleV0gPSB2YWx1ZVxuICAgICAgICB9IGVsc2UgaWYgKGlzQXJyYXkocmVzdWx0W2tleV0pKSB7XG4gICAgICAgICAgcmVzdWx0W2tleV0ucHVzaCh2YWx1ZSlcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXN1bHRba2V5XSA9IFsgcmVzdWx0W2tleV0sIHZhbHVlIF1cbiAgICAgICAgfVxuICAgICAgfVxuICApXG5cbiAgcmV0dXJuIHJlc3VsdFxufSIsIm1vZHVsZS5leHBvcnRzID0ge1xuICBjYW52YXM6IGRyYXdCdWZmZXIsXG4gIHN2ZzogcmVxdWlyZSgnLi9zdmcuanMnKVxufTtcblxuZnVuY3Rpb24gZHJhd0J1ZmZlciAoY2FudmFzLCBidWZmZXIsIGNvbG9yKSB7XG4gIHZhciBjdHggPSBjYW52YXMuZ2V0Q29udGV4dCgnMmQnKTtcbiAgdmFyIHdpZHRoID0gY2FudmFzLndpZHRoO1xuICB2YXIgaGVpZ2h0ID0gY2FudmFzLmhlaWdodDtcbiAgaWYgKGNvbG9yKSB7XG4gICAgY3R4LmZpbGxTdHlsZSA9IGNvbG9yO1xuICB9XG5cbiAgICB2YXIgZGF0YSA9IGJ1ZmZlci5nZXRDaGFubmVsRGF0YSggMCApO1xuICAgIHZhciBzdGVwID0gTWF0aC5jZWlsKCBkYXRhLmxlbmd0aCAvIHdpZHRoICk7XG4gICAgdmFyIGFtcCA9IGhlaWdodCAvIDI7XG4gICAgZm9yKHZhciBpPTA7IGkgPCB3aWR0aDsgaSsrKXtcbiAgICAgICAgdmFyIG1pbiA9IDEuMDtcbiAgICAgICAgdmFyIG1heCA9IC0xLjA7XG4gICAgICAgIGZvciAodmFyIGo9MDsgajxzdGVwOyBqKyspIHtcbiAgICAgICAgICAgIHZhciBkYXR1bSA9IGRhdGFbKGkqc3RlcCkral07XG4gICAgICAgICAgICBpZiAoZGF0dW0gPCBtaW4pXG4gICAgICAgICAgICAgICAgbWluID0gZGF0dW07XG4gICAgICAgICAgICBpZiAoZGF0dW0gPiBtYXgpXG4gICAgICAgICAgICAgICAgbWF4ID0gZGF0dW07XG4gICAgICAgIH1cbiAgICAgIGN0eC5maWxsUmVjdChpLCgxK21pbikqYW1wLDEsTWF0aC5tYXgoMSwobWF4LW1pbikqYW1wKSk7XG4gICAgfVxufSIsInZhciBoYXMgPSByZXF1aXJlKCdoYXMnKTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAobmFtZSwgYXR0cikge1xuICAgIHZhciBlbGVtID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudE5TKCdodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZycsIG5hbWUpO1xuICAgIGlmICghYXR0cikgcmV0dXJuIGVsZW07XG4gICAgZm9yICh2YXIga2V5IGluIGF0dHIpIHtcbiAgICAgICAgaWYgKCFoYXMoYXR0ciwga2V5KSkgY29udGludWU7XG4gICAgICAgIHZhciBua2V5ID0ga2V5LnJlcGxhY2UoLyhbYS16XSkoW0EtWl0pL2csIGZ1bmN0aW9uIChfLCBhLCBiKSB7XG4gICAgICAgICAgICByZXR1cm4gYSArICctJyArIGIudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGVsZW0uc2V0QXR0cmlidXRlKG5rZXksIGF0dHJba2V5XSk7XG4gICAgfVxuICAgIHJldHVybiBlbGVtO1xufVxuIiwidmFyIGhhc093biA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBoYXMob2JqLCBwcm9wZXJ0eSkge1xuICByZXR1cm4gaGFzT3duLmNhbGwob2JqLCBwcm9wZXJ0eSk7XG59O1xuIiwidmFyIGNyZWF0ZUVsID0gcmVxdWlyZSgnc3ZnLWNyZWF0ZS1lbGVtZW50Jyk7XG5cbm1vZHVsZS5leHBvcnRzID0gZHJhd0J1ZmZlclNWRztcblxuZnVuY3Rpb24gZ2V0UmVjdCh4LCB5LCB3aWR0aCwgaGVpZ2h0LCBjb2xvcikge1xuICByZXR1cm4gY3JlYXRlRWwoJ3JlY3QnLCB7XG4gICAgeDogeCxcbiAgICB5OiB5LFxuICAgIHdpZHRoOiB3aWR0aCxcbiAgICBoZWlnaHQ6IGhlaWdodCxcbiAgICBmaWxsOiBjb2xvclxuICB9KTtcbn1cblxuZnVuY3Rpb24gZHJhd0J1ZmZlclNWRyhidWZmZXIsIHdpZHRoLCBoZWlnaHQsIGNvbG9yKSB7XG4gIGlmICghY29sb3IpIGNvbG9yID0gJyMwMDAnO1xuXG4gIHZhciBzdmdFbCA9IGNyZWF0ZUVsKCdzdmcnLCB7XG4gICAgd2lkdGg6IHdpZHRoLFxuICAgIGhlaWdodDogaGVpZ2h0XG4gIH0pO1xuXG4gIHN2Z0VsLnN0eWxlLmRpc3BsYXkgPSBcImJsb2NrXCI7XG5cbiAgdmFyIGcgPSBjcmVhdGVFbCgnZycpO1xuXG4gIHN2Z0VsLmFwcGVuZENoaWxkKGcpO1xuXG4gIHZhciBkYXRhID0gYnVmZmVyLmdldENoYW5uZWxEYXRhKCAwICk7XG4gIHZhciBzdGVwID0gTWF0aC5jZWlsKCBkYXRhLmxlbmd0aCAvIHdpZHRoICk7XG4gIHZhciBhbXAgPSBoZWlnaHQgLyAyO1xuICBmb3IgKHZhciBpPTA7IGkgPCB3aWR0aDsgaSsrKSB7XG4gICAgdmFyIG1pbiA9IDEuMDtcbiAgICB2YXIgbWF4ID0gLTEuMDtcbiAgICBmb3IgKHZhciBqPTA7IGo8c3RlcDsgaisrKSB7XG4gICAgICB2YXIgZGF0dW0gPSBkYXRhWyhpKnN0ZXApK2pdO1xuICAgICAgaWYgKGRhdHVtIDwgbWluKVxuICAgICAgICBtaW4gPSBkYXR1bTtcbiAgICAgIGlmIChkYXR1bSA+IG1heClcbiAgICAgICAgbWF4ID0gZGF0dW07XG4gICAgfVxuICAgIGcuYXBwZW5kQ2hpbGQoZ2V0UmVjdChpLCAoMSttaW4pKmFtcCwgMSwgTWF0aC5tYXgoMSwobWF4LW1pbikqYW1wKSwgY29sb3IpKTtcbiAgfVxuXG4gIHJldHVybiBzdmdFbDtcbn0iLG51bGwsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG5mdW5jdGlvbiBFdmVudEVtaXR0ZXIoKSB7XG4gIHRoaXMuX2V2ZW50cyA9IHRoaXMuX2V2ZW50cyB8fCB7fTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gdGhpcy5fbWF4TGlzdGVuZXJzIHx8IHVuZGVmaW5lZDtcbn1cbm1vZHVsZS5leHBvcnRzID0gRXZlbnRFbWl0dGVyO1xuXG4vLyBCYWNrd2FyZHMtY29tcGF0IHdpdGggbm9kZSAwLjEwLnhcbkV2ZW50RW1pdHRlci5FdmVudEVtaXR0ZXIgPSBFdmVudEVtaXR0ZXI7XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX2V2ZW50cyA9IHVuZGVmaW5lZDtcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuX21heExpc3RlbmVycyA9IHVuZGVmaW5lZDtcblxuLy8gQnkgZGVmYXVsdCBFdmVudEVtaXR0ZXJzIHdpbGwgcHJpbnQgYSB3YXJuaW5nIGlmIG1vcmUgdGhhbiAxMCBsaXN0ZW5lcnMgYXJlXG4vLyBhZGRlZCB0byBpdC4gVGhpcyBpcyBhIHVzZWZ1bCBkZWZhdWx0IHdoaWNoIGhlbHBzIGZpbmRpbmcgbWVtb3J5IGxlYWtzLlxuRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnMgPSAxMDtcblxuLy8gT2J2aW91c2x5IG5vdCBhbGwgRW1pdHRlcnMgc2hvdWxkIGJlIGxpbWl0ZWQgdG8gMTAuIFRoaXMgZnVuY3Rpb24gYWxsb3dzXG4vLyB0aGF0IHRvIGJlIGluY3JlYXNlZC4gU2V0IHRvIHplcm8gZm9yIHVubGltaXRlZC5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuc2V0TWF4TGlzdGVuZXJzID0gZnVuY3Rpb24obikge1xuICBpZiAoIWlzTnVtYmVyKG4pIHx8IG4gPCAwIHx8IGlzTmFOKG4pKVxuICAgIHRocm93IFR5cGVFcnJvcignbiBtdXN0IGJlIGEgcG9zaXRpdmUgbnVtYmVyJyk7XG4gIHRoaXMuX21heExpc3RlbmVycyA9IG47XG4gIHJldHVybiB0aGlzO1xufTtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5lbWl0ID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgZXIsIGhhbmRsZXIsIGxlbiwgYXJncywgaSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIElmIHRoZXJlIGlzIG5vICdlcnJvcicgZXZlbnQgbGlzdGVuZXIgdGhlbiB0aHJvdy5cbiAgaWYgKHR5cGUgPT09ICdlcnJvcicpIHtcbiAgICBpZiAoIXRoaXMuX2V2ZW50cy5lcnJvciB8fFxuICAgICAgICAoaXNPYmplY3QodGhpcy5fZXZlbnRzLmVycm9yKSAmJiAhdGhpcy5fZXZlbnRzLmVycm9yLmxlbmd0aCkpIHtcbiAgICAgIGVyID0gYXJndW1lbnRzWzFdO1xuICAgICAgaWYgKGVyIGluc3RhbmNlb2YgRXJyb3IpIHtcbiAgICAgICAgdGhyb3cgZXI7IC8vIFVuaGFuZGxlZCAnZXJyb3InIGV2ZW50XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBUeXBlRXJyb3IoJ1VuY2F1Z2h0LCB1bnNwZWNpZmllZCBcImVycm9yXCIgZXZlbnQuJyk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgaGFuZGxlciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNVbmRlZmluZWQoaGFuZGxlcikpXG4gICAgcmV0dXJuIGZhbHNlO1xuXG4gIGlmIChpc0Z1bmN0aW9uKGhhbmRsZXIpKSB7XG4gICAgc3dpdGNoIChhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICAvLyBmYXN0IGNhc2VzXG4gICAgICBjYXNlIDE6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIDI6XG4gICAgICAgIGhhbmRsZXIuY2FsbCh0aGlzLCBhcmd1bWVudHNbMV0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMzpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSwgYXJndW1lbnRzWzJdKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICAvLyBzbG93ZXJcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxlbiA9IGFyZ3VtZW50cy5sZW5ndGg7XG4gICAgICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgICAgIGZvciAoaSA9IDE7IGkgPCBsZW47IGkrKylcbiAgICAgICAgICBhcmdzW2kgLSAxXSA9IGFyZ3VtZW50c1tpXTtcbiAgICAgICAgaGFuZGxlci5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoaXNPYmplY3QoaGFuZGxlcikpIHtcbiAgICBsZW4gPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIGFyZ3MgPSBuZXcgQXJyYXkobGVuIC0gMSk7XG4gICAgZm9yIChpID0gMTsgaSA8IGxlbjsgaSsrKVxuICAgICAgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cbiAgICBsaXN0ZW5lcnMgPSBoYW5kbGVyLnNsaWNlKCk7XG4gICAgbGVuID0gbGlzdGVuZXJzLmxlbmd0aDtcbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspXG4gICAgICBsaXN0ZW5lcnNbaV0uYXBwbHkodGhpcywgYXJncyk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUuYWRkTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gVG8gYXZvaWQgcmVjdXJzaW9uIGluIHRoZSBjYXNlIHRoYXQgdHlwZSA9PT0gXCJuZXdMaXN0ZW5lclwiISBCZWZvcmVcbiAgLy8gYWRkaW5nIGl0IHRvIHRoZSBsaXN0ZW5lcnMsIGZpcnN0IGVtaXQgXCJuZXdMaXN0ZW5lclwiLlxuICBpZiAodGhpcy5fZXZlbnRzLm5ld0xpc3RlbmVyKVxuICAgIHRoaXMuZW1pdCgnbmV3TGlzdGVuZXInLCB0eXBlLFxuICAgICAgICAgICAgICBpc0Z1bmN0aW9uKGxpc3RlbmVyLmxpc3RlbmVyKSA/XG4gICAgICAgICAgICAgIGxpc3RlbmVyLmxpc3RlbmVyIDogbGlzdGVuZXIpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIC8vIE9wdGltaXplIHRoZSBjYXNlIG9mIG9uZSBsaXN0ZW5lci4gRG9uJ3QgbmVlZCB0aGUgZXh0cmEgYXJyYXkgb2JqZWN0LlxuICAgIHRoaXMuX2V2ZW50c1t0eXBlXSA9IGxpc3RlbmVyO1xuICBlbHNlIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIC8vIElmIHdlJ3ZlIGFscmVhZHkgZ290IGFuIGFycmF5LCBqdXN0IGFwcGVuZC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG4gIGVsc2VcbiAgICAvLyBBZGRpbmcgdGhlIHNlY29uZCBlbGVtZW50LCBuZWVkIHRvIGNoYW5nZSB0byBhcnJheS5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBbdGhpcy5fZXZlbnRzW3R5cGVdLCBsaXN0ZW5lcl07XG5cbiAgLy8gQ2hlY2sgZm9yIGxpc3RlbmVyIGxlYWtcbiAgaWYgKGlzT2JqZWN0KHRoaXMuX2V2ZW50c1t0eXBlXSkgJiYgIXRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQpIHtcbiAgICB2YXIgbTtcbiAgICBpZiAoIWlzVW5kZWZpbmVkKHRoaXMuX21heExpc3RlbmVycykpIHtcbiAgICAgIG0gPSB0aGlzLl9tYXhMaXN0ZW5lcnM7XG4gICAgfSBlbHNlIHtcbiAgICAgIG0gPSBFdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycztcbiAgICB9XG5cbiAgICBpZiAobSAmJiBtID4gMCAmJiB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoID4gbSkge1xuICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLndhcm5lZCA9IHRydWU7XG4gICAgICBjb25zb2xlLmVycm9yKCcobm9kZSkgd2FybmluZzogcG9zc2libGUgRXZlbnRFbWl0dGVyIG1lbW9yeSAnICtcbiAgICAgICAgICAgICAgICAgICAgJ2xlYWsgZGV0ZWN0ZWQuICVkIGxpc3RlbmVycyBhZGRlZC4gJyArXG4gICAgICAgICAgICAgICAgICAgICdVc2UgZW1pdHRlci5zZXRNYXhMaXN0ZW5lcnMoKSB0byBpbmNyZWFzZSBsaW1pdC4nLFxuICAgICAgICAgICAgICAgICAgICB0aGlzLl9ldmVudHNbdHlwZV0ubGVuZ3RoKTtcbiAgICAgIGlmICh0eXBlb2YgY29uc29sZS50cmFjZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAvLyBub3Qgc3VwcG9ydGVkIGluIElFIDEwXG4gICAgICAgIGNvbnNvbGUudHJhY2UoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUub24gPSBFdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyO1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uY2UgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgdmFyIGZpcmVkID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gZygpIHtcbiAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGcpO1xuXG4gICAgaWYgKCFmaXJlZCkge1xuICAgICAgZmlyZWQgPSB0cnVlO1xuICAgICAgbGlzdGVuZXIuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9XG4gIH1cblxuICBnLmxpc3RlbmVyID0gbGlzdGVuZXI7XG4gIHRoaXMub24odHlwZSwgZyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBlbWl0cyBhICdyZW1vdmVMaXN0ZW5lcicgZXZlbnQgaWZmIHRoZSBsaXN0ZW5lciB3YXMgcmVtb3ZlZFxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5yZW1vdmVMaXN0ZW5lciA9IGZ1bmN0aW9uKHR5cGUsIGxpc3RlbmVyKSB7XG4gIHZhciBsaXN0LCBwb3NpdGlvbiwgbGVuZ3RoLCBpO1xuXG4gIGlmICghaXNGdW5jdGlvbihsaXN0ZW5lcikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCdsaXN0ZW5lciBtdXN0IGJlIGEgZnVuY3Rpb24nKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIGxpc3QgPSB0aGlzLl9ldmVudHNbdHlwZV07XG4gIGxlbmd0aCA9IGxpc3QubGVuZ3RoO1xuICBwb3NpdGlvbiA9IC0xO1xuXG4gIGlmIChsaXN0ID09PSBsaXN0ZW5lciB8fFxuICAgICAgKGlzRnVuY3Rpb24obGlzdC5saXN0ZW5lcikgJiYgbGlzdC5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICBpZiAodGhpcy5fZXZlbnRzLnJlbW92ZUxpc3RlbmVyKVxuICAgICAgdGhpcy5lbWl0KCdyZW1vdmVMaXN0ZW5lcicsIHR5cGUsIGxpc3RlbmVyKTtcblxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGxpc3QpKSB7XG4gICAgZm9yIChpID0gbGVuZ3RoOyBpLS0gPiAwOykge1xuICAgICAgaWYgKGxpc3RbaV0gPT09IGxpc3RlbmVyIHx8XG4gICAgICAgICAgKGxpc3RbaV0ubGlzdGVuZXIgJiYgbGlzdFtpXS5saXN0ZW5lciA9PT0gbGlzdGVuZXIpKSB7XG4gICAgICAgIHBvc2l0aW9uID0gaTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHBvc2l0aW9uIDwgMClcbiAgICAgIHJldHVybiB0aGlzO1xuXG4gICAgaWYgKGxpc3QubGVuZ3RoID09PSAxKSB7XG4gICAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gICAgICBkZWxldGUgdGhpcy5fZXZlbnRzW3R5cGVdO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaXN0LnNwbGljZShwb3NpdGlvbiwgMSk7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG4gIH1cblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlQWxsTGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIga2V5LCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8gbm90IGxpc3RlbmluZyBmb3IgcmVtb3ZlTGlzdGVuZXIsIG5vIG5lZWQgdG8gZW1pdFxuICBpZiAoIXRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAwKVxuICAgICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgZWxzZSBpZiAodGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIGVtaXQgcmVtb3ZlTGlzdGVuZXIgZm9yIGFsbCBsaXN0ZW5lcnMgb24gYWxsIGV2ZW50c1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMCkge1xuICAgIGZvciAoa2V5IGluIHRoaXMuX2V2ZW50cykge1xuICAgICAgaWYgKGtleSA9PT0gJ3JlbW92ZUxpc3RlbmVyJykgY29udGludWU7XG4gICAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycyhrZXkpO1xuICAgIH1cbiAgICB0aGlzLnJlbW92ZUFsbExpc3RlbmVycygncmVtb3ZlTGlzdGVuZXInKTtcbiAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIGxpc3RlbmVycyA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICBpZiAoaXNGdW5jdGlvbihsaXN0ZW5lcnMpKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBsaXN0ZW5lcnMpO1xuICB9IGVsc2Uge1xuICAgIC8vIExJRk8gb3JkZXJcbiAgICB3aGlsZSAobGlzdGVuZXJzLmxlbmd0aClcbiAgICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzW2xpc3RlbmVycy5sZW5ndGggLSAxXSk7XG4gIH1cbiAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICByZXR1cm4gdGhpcztcbn07XG5cbkV2ZW50RW1pdHRlci5wcm90b3R5cGUubGlzdGVuZXJzID0gZnVuY3Rpb24odHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIXRoaXMuX2V2ZW50cyB8fCAhdGhpcy5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IFtdO1xuICBlbHNlIGlmIChpc0Z1bmN0aW9uKHRoaXMuX2V2ZW50c1t0eXBlXSkpXG4gICAgcmV0ID0gW3RoaXMuX2V2ZW50c1t0eXBlXV07XG4gIGVsc2VcbiAgICByZXQgPSB0aGlzLl9ldmVudHNbdHlwZV0uc2xpY2UoKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICB2YXIgcmV0O1xuICBpZiAoIWVtaXR0ZXIuX2V2ZW50cyB8fCAhZW1pdHRlci5fZXZlbnRzW3R5cGVdKVxuICAgIHJldCA9IDA7XG4gIGVsc2UgaWYgKGlzRnVuY3Rpb24oZW1pdHRlci5fZXZlbnRzW3R5cGVdKSlcbiAgICByZXQgPSAxO1xuICBlbHNlXG4gICAgcmV0ID0gZW1pdHRlci5fZXZlbnRzW3R5cGVdLmxlbmd0aDtcbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGlzRnVuY3Rpb24oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnZnVuY3Rpb24nO1xufVxuXG5mdW5jdGlvbiBpc051bWJlcihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdudW1iZXInO1xufVxuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbiIsIihmdW5jdGlvbiAocHJvY2Vzcyl7XG4vLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuLy8gcmVzb2x2ZXMgLiBhbmQgLi4gZWxlbWVudHMgaW4gYSBwYXRoIGFycmF5IHdpdGggZGlyZWN0b3J5IG5hbWVzIHRoZXJlXG4vLyBtdXN0IGJlIG5vIHNsYXNoZXMsIGVtcHR5IGVsZW1lbnRzLCBvciBkZXZpY2UgbmFtZXMgKGM6XFwpIGluIHRoZSBhcnJheVxuLy8gKHNvIGFsc28gbm8gbGVhZGluZyBhbmQgdHJhaWxpbmcgc2xhc2hlcyAtIGl0IGRvZXMgbm90IGRpc3Rpbmd1aXNoXG4vLyByZWxhdGl2ZSBhbmQgYWJzb2x1dGUgcGF0aHMpXG5mdW5jdGlvbiBub3JtYWxpemVBcnJheShwYXJ0cywgYWxsb3dBYm92ZVJvb3QpIHtcbiAgLy8gaWYgdGhlIHBhdGggdHJpZXMgdG8gZ28gYWJvdmUgdGhlIHJvb3QsIGB1cGAgZW5kcyB1cCA+IDBcbiAgdmFyIHVwID0gMDtcbiAgZm9yICh2YXIgaSA9IHBhcnRzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgdmFyIGxhc3QgPSBwYXJ0c1tpXTtcbiAgICBpZiAobGFzdCA9PT0gJy4nKSB7XG4gICAgICBwYXJ0cy5zcGxpY2UoaSwgMSk7XG4gICAgfSBlbHNlIGlmIChsYXN0ID09PSAnLi4nKSB7XG4gICAgICBwYXJ0cy5zcGxpY2UoaSwgMSk7XG4gICAgICB1cCsrO1xuICAgIH0gZWxzZSBpZiAodXApIHtcbiAgICAgIHBhcnRzLnNwbGljZShpLCAxKTtcbiAgICAgIHVwLS07XG4gICAgfVxuICB9XG5cbiAgLy8gaWYgdGhlIHBhdGggaXMgYWxsb3dlZCB0byBnbyBhYm92ZSB0aGUgcm9vdCwgcmVzdG9yZSBsZWFkaW5nIC4uc1xuICBpZiAoYWxsb3dBYm92ZVJvb3QpIHtcbiAgICBmb3IgKDsgdXAtLTsgdXApIHtcbiAgICAgIHBhcnRzLnVuc2hpZnQoJy4uJyk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHBhcnRzO1xufVxuXG4vLyBTcGxpdCBhIGZpbGVuYW1lIGludG8gW3Jvb3QsIGRpciwgYmFzZW5hbWUsIGV4dF0sIHVuaXggdmVyc2lvblxuLy8gJ3Jvb3QnIGlzIGp1c3QgYSBzbGFzaCwgb3Igbm90aGluZy5cbnZhciBzcGxpdFBhdGhSZSA9XG4gICAgL14oXFwvP3wpKFtcXHNcXFNdKj8pKCg/OlxcLnsxLDJ9fFteXFwvXSs/fCkoXFwuW14uXFwvXSp8KSkoPzpbXFwvXSopJC87XG52YXIgc3BsaXRQYXRoID0gZnVuY3Rpb24oZmlsZW5hbWUpIHtcbiAgcmV0dXJuIHNwbGl0UGF0aFJlLmV4ZWMoZmlsZW5hbWUpLnNsaWNlKDEpO1xufTtcblxuLy8gcGF0aC5yZXNvbHZlKFtmcm9tIC4uLl0sIHRvKVxuLy8gcG9zaXggdmVyc2lvblxuZXhwb3J0cy5yZXNvbHZlID0gZnVuY3Rpb24oKSB7XG4gIHZhciByZXNvbHZlZFBhdGggPSAnJyxcbiAgICAgIHJlc29sdmVkQWJzb2x1dGUgPSBmYWxzZTtcblxuICBmb3IgKHZhciBpID0gYXJndW1lbnRzLmxlbmd0aCAtIDE7IGkgPj0gLTEgJiYgIXJlc29sdmVkQWJzb2x1dGU7IGktLSkge1xuICAgIHZhciBwYXRoID0gKGkgPj0gMCkgPyBhcmd1bWVudHNbaV0gOiBwcm9jZXNzLmN3ZCgpO1xuXG4gICAgLy8gU2tpcCBlbXB0eSBhbmQgaW52YWxpZCBlbnRyaWVzXG4gICAgaWYgKHR5cGVvZiBwYXRoICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcignQXJndW1lbnRzIHRvIHBhdGgucmVzb2x2ZSBtdXN0IGJlIHN0cmluZ3MnKTtcbiAgICB9IGVsc2UgaWYgKCFwYXRoKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICByZXNvbHZlZFBhdGggPSBwYXRoICsgJy8nICsgcmVzb2x2ZWRQYXRoO1xuICAgIHJlc29sdmVkQWJzb2x1dGUgPSBwYXRoLmNoYXJBdCgwKSA9PT0gJy8nO1xuICB9XG5cbiAgLy8gQXQgdGhpcyBwb2ludCB0aGUgcGF0aCBzaG91bGQgYmUgcmVzb2x2ZWQgdG8gYSBmdWxsIGFic29sdXRlIHBhdGgsIGJ1dFxuICAvLyBoYW5kbGUgcmVsYXRpdmUgcGF0aHMgdG8gYmUgc2FmZSAobWlnaHQgaGFwcGVuIHdoZW4gcHJvY2Vzcy5jd2QoKSBmYWlscylcblxuICAvLyBOb3JtYWxpemUgdGhlIHBhdGhcbiAgcmVzb2x2ZWRQYXRoID0gbm9ybWFsaXplQXJyYXkoZmlsdGVyKHJlc29sdmVkUGF0aC5zcGxpdCgnLycpLCBmdW5jdGlvbihwKSB7XG4gICAgcmV0dXJuICEhcDtcbiAgfSksICFyZXNvbHZlZEFic29sdXRlKS5qb2luKCcvJyk7XG5cbiAgcmV0dXJuICgocmVzb2x2ZWRBYnNvbHV0ZSA/ICcvJyA6ICcnKSArIHJlc29sdmVkUGF0aCkgfHwgJy4nO1xufTtcblxuLy8gcGF0aC5ub3JtYWxpemUocGF0aClcbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMubm9ybWFsaXplID0gZnVuY3Rpb24ocGF0aCkge1xuICB2YXIgaXNBYnNvbHV0ZSA9IGV4cG9ydHMuaXNBYnNvbHV0ZShwYXRoKSxcbiAgICAgIHRyYWlsaW5nU2xhc2ggPSBzdWJzdHIocGF0aCwgLTEpID09PSAnLyc7XG5cbiAgLy8gTm9ybWFsaXplIHRoZSBwYXRoXG4gIHBhdGggPSBub3JtYWxpemVBcnJheShmaWx0ZXIocGF0aC5zcGxpdCgnLycpLCBmdW5jdGlvbihwKSB7XG4gICAgcmV0dXJuICEhcDtcbiAgfSksICFpc0Fic29sdXRlKS5qb2luKCcvJyk7XG5cbiAgaWYgKCFwYXRoICYmICFpc0Fic29sdXRlKSB7XG4gICAgcGF0aCA9ICcuJztcbiAgfVxuICBpZiAocGF0aCAmJiB0cmFpbGluZ1NsYXNoKSB7XG4gICAgcGF0aCArPSAnLyc7XG4gIH1cblxuICByZXR1cm4gKGlzQWJzb2x1dGUgPyAnLycgOiAnJykgKyBwYXRoO1xufTtcblxuLy8gcG9zaXggdmVyc2lvblxuZXhwb3J0cy5pc0Fic29sdXRlID0gZnVuY3Rpb24ocGF0aCkge1xuICByZXR1cm4gcGF0aC5jaGFyQXQoMCkgPT09ICcvJztcbn07XG5cbi8vIHBvc2l4IHZlcnNpb25cbmV4cG9ydHMuam9pbiA9IGZ1bmN0aW9uKCkge1xuICB2YXIgcGF0aHMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDApO1xuICByZXR1cm4gZXhwb3J0cy5ub3JtYWxpemUoZmlsdGVyKHBhdGhzLCBmdW5jdGlvbihwLCBpbmRleCkge1xuICAgIGlmICh0eXBlb2YgcCAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IG5ldyBUeXBlRXJyb3IoJ0FyZ3VtZW50cyB0byBwYXRoLmpvaW4gbXVzdCBiZSBzdHJpbmdzJyk7XG4gICAgfVxuICAgIHJldHVybiBwO1xuICB9KS5qb2luKCcvJykpO1xufTtcblxuXG4vLyBwYXRoLnJlbGF0aXZlKGZyb20sIHRvKVxuLy8gcG9zaXggdmVyc2lvblxuZXhwb3J0cy5yZWxhdGl2ZSA9IGZ1bmN0aW9uKGZyb20sIHRvKSB7XG4gIGZyb20gPSBleHBvcnRzLnJlc29sdmUoZnJvbSkuc3Vic3RyKDEpO1xuICB0byA9IGV4cG9ydHMucmVzb2x2ZSh0bykuc3Vic3RyKDEpO1xuXG4gIGZ1bmN0aW9uIHRyaW0oYXJyKSB7XG4gICAgdmFyIHN0YXJ0ID0gMDtcbiAgICBmb3IgKDsgc3RhcnQgPCBhcnIubGVuZ3RoOyBzdGFydCsrKSB7XG4gICAgICBpZiAoYXJyW3N0YXJ0XSAhPT0gJycpIGJyZWFrO1xuICAgIH1cblxuICAgIHZhciBlbmQgPSBhcnIubGVuZ3RoIC0gMTtcbiAgICBmb3IgKDsgZW5kID49IDA7IGVuZC0tKSB7XG4gICAgICBpZiAoYXJyW2VuZF0gIT09ICcnKSBicmVhaztcbiAgICB9XG5cbiAgICBpZiAoc3RhcnQgPiBlbmQpIHJldHVybiBbXTtcbiAgICByZXR1cm4gYXJyLnNsaWNlKHN0YXJ0LCBlbmQgLSBzdGFydCArIDEpO1xuICB9XG5cbiAgdmFyIGZyb21QYXJ0cyA9IHRyaW0oZnJvbS5zcGxpdCgnLycpKTtcbiAgdmFyIHRvUGFydHMgPSB0cmltKHRvLnNwbGl0KCcvJykpO1xuXG4gIHZhciBsZW5ndGggPSBNYXRoLm1pbihmcm9tUGFydHMubGVuZ3RoLCB0b1BhcnRzLmxlbmd0aCk7XG4gIHZhciBzYW1lUGFydHNMZW5ndGggPSBsZW5ndGg7XG4gIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuZ3RoOyBpKyspIHtcbiAgICBpZiAoZnJvbVBhcnRzW2ldICE9PSB0b1BhcnRzW2ldKSB7XG4gICAgICBzYW1lUGFydHNMZW5ndGggPSBpO1xuICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgdmFyIG91dHB1dFBhcnRzID0gW107XG4gIGZvciAodmFyIGkgPSBzYW1lUGFydHNMZW5ndGg7IGkgPCBmcm9tUGFydHMubGVuZ3RoOyBpKyspIHtcbiAgICBvdXRwdXRQYXJ0cy5wdXNoKCcuLicpO1xuICB9XG5cbiAgb3V0cHV0UGFydHMgPSBvdXRwdXRQYXJ0cy5jb25jYXQodG9QYXJ0cy5zbGljZShzYW1lUGFydHNMZW5ndGgpKTtcblxuICByZXR1cm4gb3V0cHV0UGFydHMuam9pbignLycpO1xufTtcblxuZXhwb3J0cy5zZXAgPSAnLyc7XG5leHBvcnRzLmRlbGltaXRlciA9ICc6JztcblxuZXhwb3J0cy5kaXJuYW1lID0gZnVuY3Rpb24ocGF0aCkge1xuICB2YXIgcmVzdWx0ID0gc3BsaXRQYXRoKHBhdGgpLFxuICAgICAgcm9vdCA9IHJlc3VsdFswXSxcbiAgICAgIGRpciA9IHJlc3VsdFsxXTtcblxuICBpZiAoIXJvb3QgJiYgIWRpcikge1xuICAgIC8vIE5vIGRpcm5hbWUgd2hhdHNvZXZlclxuICAgIHJldHVybiAnLic7XG4gIH1cblxuICBpZiAoZGlyKSB7XG4gICAgLy8gSXQgaGFzIGEgZGlybmFtZSwgc3RyaXAgdHJhaWxpbmcgc2xhc2hcbiAgICBkaXIgPSBkaXIuc3Vic3RyKDAsIGRpci5sZW5ndGggLSAxKTtcbiAgfVxuXG4gIHJldHVybiByb290ICsgZGlyO1xufTtcblxuXG5leHBvcnRzLmJhc2VuYW1lID0gZnVuY3Rpb24ocGF0aCwgZXh0KSB7XG4gIHZhciBmID0gc3BsaXRQYXRoKHBhdGgpWzJdO1xuICAvLyBUT0RPOiBtYWtlIHRoaXMgY29tcGFyaXNvbiBjYXNlLWluc2Vuc2l0aXZlIG9uIHdpbmRvd3M/XG4gIGlmIChleHQgJiYgZi5zdWJzdHIoLTEgKiBleHQubGVuZ3RoKSA9PT0gZXh0KSB7XG4gICAgZiA9IGYuc3Vic3RyKDAsIGYubGVuZ3RoIC0gZXh0Lmxlbmd0aCk7XG4gIH1cbiAgcmV0dXJuIGY7XG59O1xuXG5cbmV4cG9ydHMuZXh0bmFtZSA9IGZ1bmN0aW9uKHBhdGgpIHtcbiAgcmV0dXJuIHNwbGl0UGF0aChwYXRoKVszXTtcbn07XG5cbmZ1bmN0aW9uIGZpbHRlciAoeHMsIGYpIHtcbiAgICBpZiAoeHMuZmlsdGVyKSByZXR1cm4geHMuZmlsdGVyKGYpO1xuICAgIHZhciByZXMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHhzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGlmIChmKHhzW2ldLCBpLCB4cykpIHJlcy5wdXNoKHhzW2ldKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbn1cblxuLy8gU3RyaW5nLnByb3RvdHlwZS5zdWJzdHIgLSBuZWdhdGl2ZSBpbmRleCBkb24ndCB3b3JrIGluIElFOFxudmFyIHN1YnN0ciA9ICdhYicuc3Vic3RyKC0xKSA9PT0gJ2InXG4gICAgPyBmdW5jdGlvbiAoc3RyLCBzdGFydCwgbGVuKSB7IHJldHVybiBzdHIuc3Vic3RyKHN0YXJ0LCBsZW4pIH1cbiAgICA6IGZ1bmN0aW9uIChzdHIsIHN0YXJ0LCBsZW4pIHtcbiAgICAgICAgaWYgKHN0YXJ0IDwgMCkgc3RhcnQgPSBzdHIubGVuZ3RoICsgc3RhcnQ7XG4gICAgICAgIHJldHVybiBzdHIuc3Vic3RyKHN0YXJ0LCBsZW4pO1xuICAgIH1cbjtcblxufSkuY2FsbCh0aGlzLHJlcXVpcmUoJ19wcm9jZXNzJykpIiwiLy8gc2hpbSBmb3IgdXNpbmcgcHJvY2VzcyBpbiBicm93c2VyXG5cbnZhciBwcm9jZXNzID0gbW9kdWxlLmV4cG9ydHMgPSB7fTtcblxucHJvY2Vzcy5uZXh0VGljayA9IChmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGNhblNldEltbWVkaWF0ZSA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnXG4gICAgJiYgd2luZG93LnNldEltbWVkaWF0ZTtcbiAgICB2YXIgY2FuUG9zdCA9IHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnXG4gICAgJiYgd2luZG93LnBvc3RNZXNzYWdlICYmIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyXG4gICAgO1xuXG4gICAgaWYgKGNhblNldEltbWVkaWF0ZSkge1xuICAgICAgICByZXR1cm4gZnVuY3Rpb24gKGYpIHsgcmV0dXJuIHdpbmRvdy5zZXRJbW1lZGlhdGUoZikgfTtcbiAgICB9XG5cbiAgICBpZiAoY2FuUG9zdCkge1xuICAgICAgICB2YXIgcXVldWUgPSBbXTtcbiAgICAgICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCBmdW5jdGlvbiAoZXYpIHtcbiAgICAgICAgICAgIHZhciBzb3VyY2UgPSBldi5zb3VyY2U7XG4gICAgICAgICAgICBpZiAoKHNvdXJjZSA9PT0gd2luZG93IHx8IHNvdXJjZSA9PT0gbnVsbCkgJiYgZXYuZGF0YSA9PT0gJ3Byb2Nlc3MtdGljaycpIHtcbiAgICAgICAgICAgICAgICBldi5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICBpZiAocXVldWUubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZm4gPSBxdWV1ZS5zaGlmdCgpO1xuICAgICAgICAgICAgICAgICAgICBmbigpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSwgdHJ1ZSk7XG5cbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIG5leHRUaWNrKGZuKSB7XG4gICAgICAgICAgICBxdWV1ZS5wdXNoKGZuKTtcbiAgICAgICAgICAgIHdpbmRvdy5wb3N0TWVzc2FnZSgncHJvY2Vzcy10aWNrJywgJyonKTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICByZXR1cm4gZnVuY3Rpb24gbmV4dFRpY2soZm4pIHtcbiAgICAgICAgc2V0VGltZW91dChmbiwgMCk7XG4gICAgfTtcbn0pKCk7XG5cbnByb2Nlc3MudGl0bGUgPSAnYnJvd3Nlcic7XG5wcm9jZXNzLmJyb3dzZXIgPSB0cnVlO1xucHJvY2Vzcy5lbnYgPSB7fTtcbnByb2Nlc3MuYXJndiA9IFtdO1xuXG5mdW5jdGlvbiBub29wKCkge31cblxucHJvY2Vzcy5vbiA9IG5vb3A7XG5wcm9jZXNzLmFkZExpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3Mub25jZSA9IG5vb3A7XG5wcm9jZXNzLm9mZiA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUxpc3RlbmVyID0gbm9vcDtcbnByb2Nlc3MucmVtb3ZlQWxsTGlzdGVuZXJzID0gbm9vcDtcbnByb2Nlc3MuZW1pdCA9IG5vb3A7XG5cbnByb2Nlc3MuYmluZGluZyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmJpbmRpbmcgaXMgbm90IHN1cHBvcnRlZCcpO1xufVxuXG4vLyBUT0RPKHNodHlsbWFuKVxucHJvY2Vzcy5jd2QgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnLycgfTtcbnByb2Nlc3MuY2hkaXIgPSBmdW5jdGlvbiAoZGlyKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdwcm9jZXNzLmNoZGlyIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG4iXX0=
