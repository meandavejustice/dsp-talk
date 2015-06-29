var createElement = require('../');

var svg = createElement('svg');
svg.appendChild(createElement('polyline', {
    stroke: 'cyan',
    strokeWidth: 4,
    fill: 'transparent',
    points: [ [ 5, 50 ], [ 450, 100 ], [ 300, 300 ], [ 150, 220 ] ].join(' ')
}));
document.body.appendChild(svg);
