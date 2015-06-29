var AudioSource = require('audiosource');
var FFT = require('audio-fft');
var drawWave = require('draw-wave');
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

src.load();
var progress = document.querySelector('.progress-contain');

src.on('time', function(time) {
  progress.style.width = time.percent;
})

src.on('load', function() {
  src.play();
  drawWave.canvas(progress.querySelector('#wave-progress'), src.buffer, '#DF79DF');
  drawWave.canvas(document.querySelector('#wave'), src.buffer, '#52F6A4');
});
