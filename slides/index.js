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
