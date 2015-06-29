# svg-create-element

create an svg element

# example

``` js
var createElement = require('svg-create-element');

var svg = createElement('svg');
svg.appendChild(createElement('polyline', {
    stroke: 'cyan',
    strokeWidth: 4,
    fill: 'transparent',
    points: [ [ 5, 50 ], [ 450, 100 ], [ 300, 300 ], [ 150, 220 ] ].join(' ')
}));
document.body.appendChild(svg);
```

# methods

``` js
var createElement = require('svg-create-element')
```

## var elem = createElement(name, attr)

Create a new svg dom element `elem` named by the string `name`.

Optionally you can set attributes on the newly-created element by supplying
`attr` mappings. Camel-cased `attr` keys will automatically be converted to
hypthenated names.

# install

With [npm](https://npmjs.org) do:

```
npm install svg-create-element
```

# license

MIT
